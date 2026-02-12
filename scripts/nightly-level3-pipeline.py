#!/usr/bin/env python3
"""
AERA Level 3 Nightly Pipeline

Steps:
1) Load vulnerability_profiles
2) Recalculate risk score
3) KMeans clustering
4) DBSCAN density detection
5) Isolation Forest anomaly detection
6) 30-day drift calculation
7) Write region_snapshots
8) Write model_audit_log

Required env vars:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
"""

from __future__ import annotations

import datetime as dt
import json
import os
import sys
import uuid
from dataclasses import dataclass
from typing import Any, Dict, List, Tuple

import numpy as np
import pandas as pd
import requests
from sklearn.cluster import DBSCAN, KMeans
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler


@dataclass
class SupabaseClient:
    url: str
    key: str

    @property
    def headers(self) -> Dict[str, str]:
        return {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    def select(self, table: str, select: str, filters: Dict[str, Any] | None = None) -> List[Dict[str, Any]]:
        params: Dict[str, Any] = {"select": select}
        if filters:
            params.update(filters)
        resp = requests.get(f"{self.url}/rest/v1/{table}", headers=self.headers, params=params, timeout=60)
        resp.raise_for_status()
        return resp.json()

    def upsert(self, table: str, rows: List[Dict[str, Any]], on_conflict: str) -> List[Dict[str, Any]]:
        if not rows:
            return []
        headers = dict(self.headers)
        headers["Prefer"] = "resolution=merge-duplicates,return=representation"
        resp = requests.post(
            f"{self.url}/rest/v1/{table}?on_conflict={on_conflict}",
            headers=headers,
            data=json.dumps(rows),
            timeout=120,
        )
        resp.raise_for_status()
        return resp.json()

    def insert(self, table: str, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not rows:
            return []
        resp = requests.post(
            f"{self.url}/rest/v1/{table}",
            headers=self.headers,
            data=json.dumps(rows),
            timeout=120,
        )
        resp.raise_for_status()
        return resp.json()


def calculate_risk(df: pd.DataFrame) -> pd.Series:
    household_component = np.clip(df["household_size"].fillna(1).astype(float), 1, None) * 0.4
    household_component = np.minimum(household_component, 3.2)

    return (
        household_component
        + df["medication_dependency"].fillna(False).astype(int) * 1.8
        + df["insulin_dependency"].fillna(False).astype(int) * 2.2
        + df["oxygen_powered_device"].fillna(False).astype(int) * 2.5
        + df["mobility_limitation"].fillna(False).astype(int) * 1.5
        + (~df["transportation_access"].fillna(True)).astype(int) * 1.2
        + df["financial_strain"].fillna(False).astype(int) * 1.4
    ).round(4)


def classify_drift(v: float) -> str:
    if v > 0.25:
        return "ACCELERATING"
    if v > 0.15:
        return "ESCALATING"
    return "STABLE"


def prepare_features(df: pd.DataFrame) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "risk_score": df["risk_score"].fillna(0),
            "household_size": df["household_size"].fillna(1),
            "medication_dependency": df["medication_dependency"].fillna(False).astype(int),
            "insulin_dependency": df["insulin_dependency"].fillna(False).astype(int),
            "oxygen_powered_device": df["oxygen_powered_device"].fillna(False).astype(int),
            "mobility_limitation": df["mobility_limitation"].fillna(False).astype(int),
            "transportation_access": df["transportation_access"].fillna(True).astype(int),
            "financial_strain": df["financial_strain"].fillna(False).astype(int),
        }
    )


def run() -> int:
    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    model_version = os.getenv("AERA_MODEL_VERSION", "level3-2026.02")

    if not url or not key:
        print("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", file=sys.stderr)
        return 1

    client = SupabaseClient(url=url, key=key)
    run_id = str(uuid.uuid4())
    started_at = dt.datetime.now(dt.timezone.utc)

    def log_stage(stage: str, status: str, processed: int = 0, metrics: Dict[str, Any] | None = None, error: str | None = None):
        finished_at = dt.datetime.now(dt.timezone.utc)
        duration_ms = int((finished_at - started_at).total_seconds() * 1000)
        client.insert(
            "model_audit_log",
            [
                {
                    "run_id": run_id,
                    "model_name": "aera-level3",
                    "model_version": model_version,
                    "stage": stage,
                    "status": status,
                    "started_at": started_at.isoformat(),
                    "finished_at": finished_at.isoformat(),
                    "duration_ms": duration_ms,
                    "processed_records": processed,
                    "feature_set": [
                        "household_size",
                        "medication_dependency",
                        "insulin_dependency",
                        "oxygen_powered_device",
                        "mobility_limitation",
                        "transportation_access",
                        "financial_strain",
                        "risk_score",
                    ],
                    "metrics": metrics or {},
                    "error_message": error,
                    "initiated_by": "nightly_pipeline",
                }
            ],
        )

    try:
        records = client.select(
            "vulnerability_profiles",
            "id,organization_id,county_id,state_id,household_size,medication_dependency,insulin_dependency,oxygen_powered_device,mobility_limitation,transportation_access,financial_strain,risk_score,updated_at",
        )

        if not records:
            log_stage("pipeline", "SUCCESS", processed=0, metrics={"message": "no records"})
            return 0

        df = pd.DataFrame.from_records(records)

        # 1) Recalculate risk score
        df["risk_score"] = calculate_risk(df)
        risk_updates = [{"id": row["id"], "risk_score": float(row["risk_score"])} for _, row in df.iterrows()]
        client.upsert("vulnerability_profiles", risk_updates, on_conflict="id")
        log_stage("risk_score", "SUCCESS", processed=len(df), metrics={"mean_risk": float(df["risk_score"].mean())})

        # 2-4) Clustering & anomaly detection
        features = prepare_features(df)
        scaled = StandardScaler().fit_transform(features)

        k = max(2, min(6, int(np.sqrt(len(df))) or 2))
        kmeans = KMeans(n_clusters=k, random_state=42, n_init="auto")
        df["kmeans_cluster"] = kmeans.fit_predict(scaled)
        log_stage("kmeans", "SUCCESS", processed=len(df), metrics={"clusters": int(k)})

        dbscan = DBSCAN(eps=1.25, min_samples=max(3, min(8, len(df) // 20 or 3)))
        df["dbscan_cluster"] = dbscan.fit_predict(scaled)
        log_stage(
            "dbscan",
            "SUCCESS",
            processed=len(df),
            metrics={"noise_points": int((df["dbscan_cluster"] == -1).sum())},
        )

        iso = IsolationForest(contamination=0.05, random_state=42)
        df["is_outlier"] = iso.fit_predict(scaled) == -1
        log_stage("isolation_forest", "SUCCESS", processed=len(df), metrics={"outliers": int(df["is_outlier"].sum())})

        # 5-7) Drift + snapshots
        today = dt.date.today()
        prev_date = today - dt.timedelta(days=30)

        prev_snapshots = client.select(
            "region_snapshots",
            "county_id,state_id,avg_risk_score,snapshot_date",
            filters={"snapshot_date": f"eq.{prev_date.isoformat()}"},
        )
        prev_lookup: Dict[Tuple[str, str], float] = {
            (r["county_id"], r["state_id"]): float(r.get("avg_risk_score", 0) or 0) for r in prev_snapshots
        }

        grouped = (
            df.groupby(["county_id", "state_id", "organization_id"], dropna=False)
            .agg(
                profile_count=("id", "count"),
                avg_risk_score=("risk_score", "mean"),
                max_risk_score=("risk_score", "max"),
                min_risk_score=("risk_score", "min"),
                anomaly_count=("is_outlier", "sum"),
                kmeans_cluster=("kmeans_cluster", lambda s: int(pd.Series.mode(s).iloc[0]) if len(s) else None),
                dbscan_cluster=("dbscan_cluster", lambda s: int(pd.Series.mode(s).iloc[0]) if len(s) else None),
            )
            .reset_index()
        )

        snapshot_rows: List[Dict[str, Any]] = []
        for _, row in grouped.iterrows():
            county_id = row["county_id"] or "UNKNOWN"
            state_id = row["state_id"] or "UNKNOWN"
            avg_risk = float(row["avg_risk_score"])
            prev_avg = float(prev_lookup.get((county_id, state_id), 0.0))
            drift = 0.0 if prev_avg == 0 else round((avg_risk - prev_avg) / prev_avg, 4)
            growth = drift
            projection_14d = round(avg_risk * (1 + growth * 0.5), 4)

            snapshot_rows.append(
                {
                    "snapshot_date": today.isoformat(),
                    "snapshot_window_days": 30,
                    "organization_id": row["organization_id"],
                    "county_id": county_id,
                    "state_id": state_id,
                    "profile_count": int(row["profile_count"]),
                    "avg_risk_score": round(avg_risk, 4),
                    "max_risk_score": round(float(row["max_risk_score"]), 4),
                    "min_risk_score": round(float(row["min_risk_score"]), 4),
                    "risk_growth_pct": growth,
                    "drift_value": drift,
                    "drift_status": classify_drift(drift),
                    "kmeans_cluster": int(row["kmeans_cluster"]) if pd.notna(row["kmeans_cluster"]) else None,
                    "dbscan_cluster": int(row["dbscan_cluster"]) if pd.notna(row["dbscan_cluster"]) else None,
                    "anomaly_count": int(row["anomaly_count"]),
                    "projection_14d": projection_14d,
                    "model_version": model_version,
                    "pipeline_run_id": run_id,
                    "metadata": {
                        "generated_by": "nightly-level3-pipeline.py",
                    },
                }
            )

        client.upsert(
            "region_snapshots",
            snapshot_rows,
            on_conflict="snapshot_date,county_id,state_id,organization_id",
        )
        log_stage("drift", "SUCCESS", processed=len(snapshot_rows), metrics={"snapshot_rows": len(snapshot_rows)})

        log_stage("pipeline", "SUCCESS", processed=len(df), metrics={"run_id": run_id})
        print(f"Pipeline completed. run_id={run_id}, profiles={len(df)}, snapshots={len(snapshot_rows)}")
        return 0

    except Exception as exc:  # noqa: BLE001
        err = str(exc)
        try:
            log_stage("pipeline", "FAILED", error=err)
        except Exception:  # noqa: BLE001
            pass
        print(f"Pipeline failed: {err}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(run())
