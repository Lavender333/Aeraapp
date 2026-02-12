import React, { useCallback, useEffect, useMemo, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { GeoJSON, MapContainer, TileLayer } from 'react-leaflet';
import type { PathOptions } from 'leaflet';
import { ViewState, UserRole } from '../types';
import { ArrowLeft, Layers, Users, Map as MapIcon, List, AlertTriangle, Activity, Loader2 } from 'lucide-react';
import { StorageService } from '../services/storage';
import {
  getCurrentMapScope,
  listActiveStateAlerts,
  listLatestRegionSnapshots,
  listMapRegions,
  type MapRegionRecord,
  type RegionSnapshotLatestRecord,
  type StateAlertRecord,
} from '../services/supabaseApi';
import { supabase } from '../services/supabase';

const AGGREGATE_ROLES: UserRole[] = ['ADMIN', 'STATE_ADMIN', 'COUNTY_ADMIN', 'LOCAL_AUTHORITY', 'FIRST_RESPONDER'];
const ORG_ROLES: UserRole[] = ['INSTITUTION_ADMIN', 'ORG_ADMIN'];

const getDriftColor = (driftStatus?: string): string => {
  if (driftStatus === 'ACCELERATING') return '#ef4444';
  if (driftStatus === 'ESCALATING') return '#f59e0b';
  return '#22c55e';
};

export const PopulationView: React.FC<{ setView: (v: ViewState) => void }> = ({ setView }) => {
  const [viewMode, setViewMode] = useState<'MAP' | 'LIST'>('MAP');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [regions, setRegions] = useState<MapRegionRecord[]>([]);
  const [snapshots, setSnapshots] = useState<RegionSnapshotLatestRecord[]>([]);
  const [alerts, setAlerts] = useState<StateAlertRecord[]>([]);
  const [mapScope, setMapScope] = useState<{ role?: UserRole; org_id?: string | null; county_id?: string | null; state_id?: string | null } | null>(null);

  const localProfile = useMemo(() => StorageService.getProfile(), []);
  const effectiveRole = (mapScope?.role || localProfile.role || 'GENERAL_USER') as UserRole;
  const canSeeAggregate = AGGREGATE_ROLES.includes(effectiveRole);
  const canSeeOrgDetail = ORG_ROLES.includes(effectiveRole);

  const loadPopulationData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [scope, regionRows, snapshotRows, alertRows] = await Promise.all([
        getCurrentMapScope(),
        listMapRegions(),
        listLatestRegionSnapshots(),
        listActiveStateAlerts(100),
      ]);

      setMapScope(scope as any);
      setRegions(regionRows);
      setSnapshots(snapshotRows);
      setAlerts(alertRows);
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to load map layers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPopulationData();
  }, [loadPopulationData]);

  useEffect(() => {
    const channel = supabase
      .channel('population-map-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'region_snapshots' }, () => {
        loadPopulationData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => {
        loadPopulationData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'geography_regions' }, () => {
        loadPopulationData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadPopulationData]);

  const visibleSnapshots = useMemo(() => {
    if (canSeeAggregate) return snapshots;

    if (effectiveRole === 'COUNTY_ADMIN' && mapScope?.county_id) {
      return snapshots.filter((row) => row.county_id === mapScope.county_id);
    }

    if (canSeeOrgDetail && mapScope?.org_id) {
      return snapshots.filter((row) => row.organization_id === mapScope.org_id);
    }

    return [];
  }, [canSeeAggregate, canSeeOrgDetail, effectiveRole, mapScope?.county_id, mapScope?.org_id, snapshots]);

  const snapshotByRegionKey = useMemo(() => {
    const map = new Map<string, RegionSnapshotLatestRecord>();
    for (const row of visibleSnapshots) {
      const key = `${row.state_id}::${row.county_id}`;
      if (!map.has(key)) map.set(key, row);
    }
    return map;
  }, [visibleSnapshots]);

  const featureCollection = useMemo(() => {
    return {
      type: 'FeatureCollection',
      features: regions
        .filter((r) => !!r.geojson)
        .map((r) => ({
          type: 'Feature',
          geometry: r.geojson,
          properties: {
            id: r.id,
            region_name: r.region_name,
            region_type: r.region_type,
            county_id: r.county_id,
            state_id: r.state_id,
          },
        })),
    } as any;
  }, [regions]);

  const mapStyle = useCallback(
    (feature: any): PathOptions => {
      const key = `${feature?.properties?.state_id || ''}::${feature?.properties?.county_id || ''}`;
      const snapshot = snapshotByRegionKey.get(key);
      const color = getDriftColor(snapshot?.drift_status);
      const fillOpacity = snapshot?.drift_status === 'ACCELERATING' ? 0.45 : snapshot?.drift_status === 'ESCALATING' ? 0.35 : 0.2;
      return {
        color,
        weight: 2,
        fillColor: color,
        fillOpacity,
      };
    },
    [snapshotByRegionKey],
  );

  const roleMessage = useMemo(() => {
    if (effectiveRole === 'STATE_ADMIN' || effectiveRole === 'ADMIN') return 'State-wide aggregate risk overlays enabled';
    if (effectiveRole === 'COUNTY_ADMIN') return 'County aggregate overlays enabled';
    if (effectiveRole === 'ORG_ADMIN' || effectiveRole === 'INSTITUTION_ADMIN') return 'Organization-scoped overlays enabled';
    if (effectiveRole === 'MEMBER' || effectiveRole === 'GENERAL_USER') return 'Member view: alerts and limited area status';
    return 'Role-based map visibility applied';
  }, [effectiveRole]);

  const topRiskRows = useMemo(
    () => [...visibleSnapshots].sort((a, b) => Number(b.avg_risk_score || 0) - Number(a.avg_risk_score || 0)).slice(0, 20),
    [visibleSnapshots],
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-safe animate-fade-in">
      <div className="bg-white border-b border-slate-200 p-4 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setView('DASHBOARD')} className="p-2 -ml-2 text-slate-500 hover:text-slate-800">
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="font-bold text-lg text-slate-900">Population Tracker</h1>
              <p className="text-[11px] text-slate-500">{roleMessage}</p>
            </div>
          </div>
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('MAP')}
              className={`p-2 rounded ${viewMode === 'MAP' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
            >
              <MapIcon size={18} />
            </button>
            <button
              onClick={() => setViewMode('LIST')}
              className={`p-2 rounded ${viewMode === 'LIST' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
            >
              <List size={18} />
            </button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          <span className="px-3 py-1 bg-slate-800 text-white rounded-full text-xs font-medium whitespace-nowrap">All Zones</span>
          <span className="px-3 py-1 bg-red-50 border border-red-200 text-red-700 rounded-full text-xs font-medium whitespace-nowrap">Accelerating</span>
          <span className="px-3 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-full text-xs font-medium whitespace-nowrap">Escalating</span>
          <span className="px-3 py-1 bg-green-50 border border-green-200 text-green-700 rounded-full text-xs font-medium whitespace-nowrap">Stable</span>
          <span className="px-3 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-full text-xs font-medium whitespace-nowrap">Active Alerts: {alerts.length}</span>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-slate-600">
          <Loader2 size={18} className="animate-spin mr-2" /> Loading map layers...
        </div>
      ) : loadError ? (
        <div className="m-4 p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">{loadError}</div>
      ) : (
        <div className="flex-1 relative">
          {viewMode === 'MAP' ? (
            <div className="absolute inset-0">
              <MapContainer center={[39.5, -98.35]} zoom={4} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {featureCollection.features.length > 0 && (
                  <GeoJSON
                    data={featureCollection as any}
                    style={mapStyle}
                    onEachFeature={(feature, layer) => {
                      const key = `${feature?.properties?.state_id || ''}::${feature?.properties?.county_id || ''}`;
                      const snapshot = snapshotByRegionKey.get(key);
                      const title = feature?.properties?.region_name || 'Region';
                      const drift = snapshot?.drift_status || 'STABLE';
                      const avgRisk = Number(snapshot?.avg_risk_score || 0).toFixed(2);
                      const growth = Number(snapshot?.risk_growth_pct || 0) * 100;
                      layer.bindPopup(
                        `<strong>${title}</strong><br/>Drift: ${drift}<br/>Avg Risk: ${avgRisk}<br/>Growth: ${growth.toFixed(1)}%`,
                      );
                    }}
                  />
                )}
              </MapContainer>

              <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur p-4 rounded-xl shadow-lg border border-slate-200">
                <div className="flex justify-between items-end gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase">Map Summary</p>
                    <p className="text-base font-bold text-slate-900">{visibleSnapshots.length} region snapshot(s)</p>
                    <p className="text-sm text-slate-600">{alerts.length} active alert(s) • realtime enabled</p>
                  </div>
                  <Layers className="text-slate-400" />
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-3 overflow-y-auto max-h-[calc(100vh-180px)]">
              {topRiskRows.length === 0 ? (
                <div className="bg-white p-4 rounded-xl border border-slate-200 text-sm text-slate-500">
                  No aggregate rows available for your role scope.
                </div>
              ) : (
                topRiskRows.map((row) => {
                  const driftColor = getDriftColor(row.drift_status);
                  return (
                    <div key={row.id} className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                          <Users size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{row.county_id}, {row.state_id}</p>
                          <p className="text-xs text-slate-500">
                            Avg Risk {Number(row.avg_risk_score || 0).toFixed(2)} • Profiles {row.profile_count}
                          </p>
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <Activity size={12} /> Growth {(Number(row.risk_growth_pct || 0) * 100).toFixed(1)}%
                          </p>
                        </div>
                      </div>
                      <span className="px-2 py-1 rounded text-xs font-bold text-white" style={{ backgroundColor: driftColor }}>
                        {row.drift_status}
                      </span>
                    </div>
                  );
                })
              )}

              {alerts.slice(0, 10).map((a) => (
                <div key={a.id} className="bg-amber-50 p-3 rounded-xl border border-amber-200 flex items-start gap-2">
                  <AlertTriangle size={16} className="text-amber-700 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-amber-800 uppercase">{a.severity} • {a.source}</p>
                    <p className="text-sm text-amber-900 font-semibold">{a.headline}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
