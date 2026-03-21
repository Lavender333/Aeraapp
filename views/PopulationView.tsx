import React, { useCallback, useEffect, useMemo, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { CircleMarker, GeoJSON, MapContainer, Popup, TileLayer } from 'react-leaflet';
import type { PathOptions } from 'leaflet';
import { ViewState, UserRole } from '../types';
import { ArrowLeft, Layers, Users, Map as MapIcon, List, AlertTriangle, Activity, Loader2 } from 'lucide-react';
import { StorageService } from '../services/storage';
import { getConnectedMemberCountByOrgIds, listChildOrganizations, listConnectedMembersByOrgIds, type ConnectedMemberMapRecord } from '../services/api';
import {
  getCurrentMapScope,
  listActiveStateAlerts,
  listLatestRegionSnapshots,
  listMapRegions,
  listOrganizationPopulationRollup,
  listOrganizationPopulationRollups,
  listStateHouseholdJoinActivity,
  type MapRegionRecord,
  type OrganizationPopulationRollupRecord,
  type RegionSnapshotLatestRecord,
  type StateHouseholdJoinActivityRecord,
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

const getRiskDriftStatus = (avgRiskScore: number): 'ACCELERATING' | 'ESCALATING' | 'STABLE' => {
  if (avgRiskScore >= 8) return 'ACCELERATING';
  if (avgRiskScore >= 5) return 'ESCALATING';
  return 'STABLE';
};

const buildScopeKey = (stateId?: string | null, countyId?: string | null): string =>
  `${String(stateId || '').trim().toUpperCase()}::${String(countyId || '').trim().toUpperCase()}`;

type PopulationSnapshotRow = RegionSnapshotLatestRecord & {
  linkedMemberCount?: number;
  evacuationAssistCount?: number;
  transportationGapCount?: number;
  mobilityLimitedCount?: number;
  source: 'region' | 'org-members';
};

export const PopulationView: React.FC<{ setView: (v: ViewState) => void }> = ({ setView }) => {
  const [viewMode, setViewMode] = useState<'MAP' | 'LIST'>('MAP');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [regions, setRegions] = useState<MapRegionRecord[]>([]);
  const [snapshots, setSnapshots] = useState<RegionSnapshotLatestRecord[]>([]);
  const [alerts, setAlerts] = useState<StateAlertRecord[]>([]);
  const [householdJoinActivity, setHouseholdJoinActivity] = useState<StateHouseholdJoinActivityRecord[]>([]);
  const [orgPopulationRollups, setOrgPopulationRollups] = useState<OrganizationPopulationRollupRecord[]>([]);
  const [connectedMemberTotal, setConnectedMemberTotal] = useState(0);
  const [linkedMembers, setLinkedMembers] = useState<ConnectedMemberMapRecord[]>([]);
  const [showLinkedMembers, setShowLinkedMembers] = useState(true);
  const [mapScope, setMapScope] = useState<{ role?: UserRole; org_id?: string | null; county_id?: string | null; state_id?: string | null } | null>(null);

  const localProfile = useMemo(() => StorageService.getProfile(), []);
  const effectiveRole = (mapScope?.role || localProfile.role || 'GENERAL_USER') as UserRole;
  const canSeeAggregate = AGGREGATE_ROLES.includes(effectiveRole);
  const canSeeOrgDetail = ORG_ROLES.includes(effectiveRole);

  const loadPopulationData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const scope = await getCurrentMapScope();
      const scopedRole = (scope?.role || localProfile.role || 'GENERAL_USER') as UserRole;
      let scopedOrgIds: string[] = [];

      if (scope?.org_id) {
        scopedOrgIds = [scope.org_id];

        if (scopedRole === 'INSTITUTION_ADMIN' && localProfile.communityId) {
          try {
            const childRows = await listChildOrganizations(localProfile.communityId);
            scopedOrgIds = Array.from(
              new Set([scope.org_id, ...(childRows || []).map((row: any) => String(row?.id || '').trim()).filter(Boolean)]),
            );
          } catch (childLookupError) {
            console.warn('Unable to resolve child orgs for population rollup', childLookupError);
          }
        }
      }

      const [regionRows, snapshotRows, alertRows, joinRows, orgRollupRows] = await Promise.all([
        listMapRegions(),
        listLatestRegionSnapshots(),
        listActiveStateAlerts(100),
        listStateHouseholdJoinActivity(),
        scopedOrgIds.length > 1
          ? listOrganizationPopulationRollups(scopedOrgIds)
          : scope?.org_id
            ? listOrganizationPopulationRollup(scope.org_id)
            : Promise.resolve([]),
      ]);

      let connectedTotal = 0;
      let connectedMembers: ConnectedMemberMapRecord[] = [];
      if (ORG_ROLES.includes(scopedRole) && scopedOrgIds.length > 0) {
        try {
          const [count, members] = await Promise.all([
            getConnectedMemberCountByOrgIds(scopedOrgIds),
            listConnectedMembersByOrgIds(scopedOrgIds),
          ]);
          connectedTotal = count;
          connectedMembers = members;
        } catch (countError) {
          console.warn('Unable to load connected members for map scope', countError);
        }
      }

      setMapScope(scope as any);
      setRegions(regionRows);
      setSnapshots(snapshotRows);
      setAlerts(alertRows);
      setHouseholdJoinActivity(joinRows);
      setOrgPopulationRollups(orgRollupRows);
      setConnectedMemberTotal(connectedTotal);
      setLinkedMembers(connectedMembers);
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vulnerability_profiles' }, () => {
        loadPopulationData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        loadPopulationData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'household_join_requests' }, () => {
        loadPopulationData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadPopulationData]);

  const visibleSnapshots = useMemo<PopulationSnapshotRow[]>(() => {
    if (effectiveRole === 'COUNTY_ADMIN' && mapScope?.county_id) {
      return snapshots
        .filter((row) => row.county_id === mapScope.county_id)
        .map((row) => ({ ...row, source: 'region' as const }));
    }

    if (canSeeAggregate) {
      return snapshots.map((row) => ({ ...row, source: 'region' as const }));
    }

    if (canSeeOrgDetail && mapScope?.org_id) {
      if (orgPopulationRollups.length > 0) {
        const snapshotByKey = new Map<string, RegionSnapshotLatestRecord>();

        for (const row of snapshots) {
          const key = buildScopeKey(row.state_id, row.county_id);
          const current = snapshotByKey.get(key);
          const rowMatchesOrg = row.organization_id === mapScope.org_id;
          const currentMatchesOrg = current?.organization_id === mapScope.org_id;

          if (!current || (rowMatchesOrg && !currentMatchesOrg)) {
            snapshotByKey.set(key, row);
          }
        }

        return orgPopulationRollups.map((rollup) => {
          const key = buildScopeKey(rollup.state_id, rollup.county_id);
          const snapshot = snapshotByKey.get(key);
          const avgRiskScore = snapshot ? Number(snapshot.avg_risk_score || rollup.avg_risk_score) : rollup.avg_risk_score;
          const driftStatus = snapshot?.drift_status || getRiskDriftStatus(rollup.avg_risk_score);

          return {
            id: snapshot?.id || `org-members-${key}`,
            snapshot_date: snapshot?.snapshot_date || new Date().toISOString().slice(0, 10),
            organization_id: mapScope.org_id,
            county_id: rollup.county_id,
            state_id: rollup.state_id,
            region_id: snapshot?.region_id || null,
            profile_count: rollup.profile_count,
            avg_risk_score: avgRiskScore,
            max_risk_score: snapshot ? Number(snapshot.max_risk_score || rollup.max_risk_score) : rollup.max_risk_score,
            min_risk_score: snapshot ? Number(snapshot.min_risk_score || rollup.min_risk_score) : rollup.min_risk_score,
            risk_growth_pct: Number(snapshot?.risk_growth_pct || 0),
            drift_value: Number(snapshot?.drift_value || 0),
            drift_status: driftStatus,
            kmeans_cluster: snapshot?.kmeans_cluster ?? null,
            dbscan_cluster: snapshot?.dbscan_cluster ?? null,
            anomaly_count: Number(snapshot?.anomaly_count || 0),
            projection_14d: snapshot?.projection_14d ?? null,
            model_version: snapshot?.model_version || 'org-member-rollup',
            pipeline_run_id: snapshot?.pipeline_run_id || null,
            created_at: snapshot?.created_at,
            linkedMemberCount: rollup.profile_count,
            evacuationAssistCount: rollup.evacuation_assist_count,
            transportationGapCount: rollup.transportation_gap_count,
            mobilityLimitedCount: rollup.mobility_limited_count,
            source: 'org-members' as const,
          };
        });
      }

      return snapshots
        .filter((row) => row.organization_id === mapScope.org_id)
        .map((row) => ({ ...row, source: 'region' as const }));
    }

    return [];
  }, [canSeeAggregate, canSeeOrgDetail, effectiveRole, mapScope?.county_id, mapScope?.org_id, orgPopulationRollups, snapshots]);

  const snapshotByRegionKey = useMemo(() => {
    const map = new Map<string, PopulationSnapshotRow>();
    for (const row of visibleSnapshots) {
      const key = buildScopeKey(row.state_id, row.county_id);
      if (!map.has(key)) map.set(key, row);
    }
    return map;
  }, [visibleSnapshots]);

  const featureCollection = useMemo(() => {
    const visibleRegionKeys = new Set(visibleSnapshots.map((row) => buildScopeKey(row.state_id, row.county_id)));
    const shouldScopeRegions = effectiveRole === 'COUNTY_ADMIN' || (canSeeOrgDetail && Boolean(mapScope?.org_id));

    return {
      type: 'FeatureCollection',
      features: regions
        .filter((r) => {
          if (!r.geojson) return false;
          if (!shouldScopeRegions) return true;
          return visibleRegionKeys.has(buildScopeKey(r.state_id, r.county_id));
        })
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
  }, [canSeeOrgDetail, effectiveRole, mapScope?.org_id, regions, visibleSnapshots]);

  const centroidByScopeKey = useMemo(() => {
    const map = new Map<string, { lat: number; lng: number }>();
    for (const region of regions) {
      const raw = (region as any)?.centroid_geojson;
      const key = buildScopeKey(region.state_id, region.county_id);
      if (!raw || map.has(key)) continue;

      let lng: number | null = null;
      let lat: number | null = null;

      if (raw?.type === 'Point' && Array.isArray(raw.coordinates) && raw.coordinates.length >= 2) {
        lng = Number(raw.coordinates[0]);
        lat = Number(raw.coordinates[1]);
      } else if (Array.isArray(raw) && raw.length >= 2) {
        lng = Number(raw[0]);
        lat = Number(raw[1]);
      } else if (typeof raw === 'object') {
        lng = Number(raw.lng ?? raw.longitude ?? raw.lon ?? NaN);
        lat = Number(raw.lat ?? raw.latitude ?? NaN);
      }

      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        map.set(key, { lat: Number(lat), lng: Number(lng) });
      }
    }
    return map;
  }, [regions]);

  const linkedMemberMarkers = useMemo(() => {
    const hash = (value: string) => {
      let h = 0;
      for (let i = 0; i < value.length; i += 1) {
        h = (h << 5) - h + value.charCodeAt(i);
        h |= 0;
      }
      return Math.abs(h);
    };

    const withPoints = linkedMembers
      .map((member) => {
        const key = buildScopeKey(member.stateId, member.countyId);
        const centroid = centroidByScopeKey.get(key);
        if (!centroid) return null;

        const seed = hash(member.id);
        const angle = (seed % 360) * (Math.PI / 180);
        const magnitude = ((seed % 11) / 10) * 0.07;

        return {
          ...member,
          lat: centroid.lat + Math.sin(angle) * magnitude,
          lng: centroid.lng + Math.cos(angle) * magnitude,
        };
      })
      .filter(Boolean) as Array<ConnectedMemberMapRecord & { lat: number; lng: number }>;

    return withPoints;
  }, [centroidByScopeKey, linkedMembers]);

  const clusteredLinkedMemberMarkers = useMemo(() => {
    const gridSize = 0.06;
    const grouped = new Map<string, {
      latSum: number;
      lngSum: number;
      members: Array<ConnectedMemberMapRecord & { lat: number; lng: number }>;
      dangerCount: number;
      safeCount: number;
      unknownCount: number;
    }>();

    for (const marker of linkedMemberMarkers) {
      const latBucket = Math.round(marker.lat / gridSize);
      const lngBucket = Math.round(marker.lng / gridSize);
      const key = `${latBucket}:${lngBucket}`;
      const current = grouped.get(key) || {
        latSum: 0,
        lngSum: 0,
        members: [],
        dangerCount: 0,
        safeCount: 0,
        unknownCount: 0,
      };

      current.latSum += marker.lat;
      current.lngSum += marker.lng;
      current.members.push(marker);

      if (marker.status === 'DANGER') current.dangerCount += 1;
      else if (marker.status === 'SAFE') current.safeCount += 1;
      else current.unknownCount += 1;

      grouped.set(key, current);
    }

    return Array.from(grouped.values()).map((group, idx) => {
      const count = group.members.length;
      const lat = group.latSum / Math.max(count, 1);
      const lng = group.lngSum / Math.max(count, 1);
      const dominantStatus = group.dangerCount > 0 ? 'DANGER' : group.unknownCount > 0 ? 'UNKNOWN' : 'SAFE';
      return {
        id: `cluster-${idx}-${lat.toFixed(4)}-${lng.toFixed(4)}`,
        lat,
        lng,
        count,
        members: group.members,
        dangerCount: group.dangerCount,
        safeCount: group.safeCount,
        unknownCount: group.unknownCount,
        dominantStatus,
      };
    });
  }, [linkedMemberMarkers]);

  const mapStyle = useCallback(
    (feature: any): PathOptions => {
      const key = buildScopeKey(feature?.properties?.state_id, feature?.properties?.county_id);
      const snapshot = snapshotByRegionKey.get(key);
      if (!snapshot) {
        return {
          color: '#94a3b8',
          weight: 1,
          fillColor: '#cbd5e1',
          fillOpacity: 0.12,
        };
      }
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
    if (effectiveRole === 'ORG_ADMIN' || effectiveRole === 'INSTITUTION_ADMIN') return 'Organization member-linked overlays enabled';
    if (effectiveRole === 'MEMBER' || effectiveRole === 'GENERAL_USER') return 'Member view: alerts and limited area status';
    return 'Role-based map visibility applied';
  }, [effectiveRole]);

  const topRiskRows = useMemo(
    () => [...visibleSnapshots].sort((a, b) => Number(b.avg_risk_score || 0) - Number(a.avg_risk_score || 0)).slice(0, 20),
    [visibleSnapshots],
  );

  const joinActivitySummary = useMemo(() => {
    const pending = householdJoinActivity.reduce((sum, row) => sum + Number(row.pending_requests || 0), 0);
    const approved24h = householdJoinActivity.reduce((sum, row) => sum + Number(row.approved_last_24h || 0), 0);
    const submitted24h = householdJoinActivity.reduce((sum, row) => sum + Number(row.submitted_last_24h || 0), 0);
    return { pending, approved24h, submitted24h };
  }, [householdJoinActivity]);

  const orgPopulationSummary = useMemo(() => {
    return orgPopulationRollups.reduce(
      (summary, row) => {
        summary.trackedMembers += Number(row.profile_count || 0);
        summary.highRisk += Number(row.high_risk_count || 0);
        summary.evacuationAssist += Number(row.evacuation_assist_count || 0);
        return summary;
      },
      { trackedMembers: 0, highRisk: 0, evacuationAssist: 0 },
    );
  }, [orgPopulationRollups]);

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
          {canSeeOrgDetail && mapScope?.org_id && (
            <span className="px-3 py-1 bg-cyan-50 border border-cyan-200 text-cyan-700 rounded-full text-xs font-medium whitespace-nowrap">
              Linked Members: {connectedMemberTotal}
            </span>
          )}
          {canSeeOrgDetail && mapScope?.org_id && (
            <button
              type="button"
              onClick={() => setShowLinkedMembers((value) => !value)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap border ${showLinkedMembers ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
            >
              Member Points: {showLinkedMembers ? 'On' : 'Off'} ({linkedMemberMarkers.length} members / {clusteredLinkedMemberMarkers.length} clusters)
            </button>
          )}
          {canSeeOrgDetail && mapScope?.org_id && (
            <span className="px-3 py-1 bg-rose-50 border border-rose-200 text-rose-700 rounded-full text-xs font-medium whitespace-nowrap">
              Evac Assist: {orgPopulationSummary.evacuationAssist}
            </span>
          )}
          <span className="px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full text-xs font-medium whitespace-nowrap">Join Requests Pending: {joinActivitySummary.pending}</span>
          <span className="px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-xs font-medium whitespace-nowrap">Join Approvals 24h: {joinActivitySummary.approved24h}</span>
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
                      const key = buildScopeKey(feature?.properties?.state_id, feature?.properties?.county_id);
                      const snapshot = snapshotByRegionKey.get(key);
                      const title = feature?.properties?.region_name || 'Region';
                      if (!snapshot) {
                        layer.bindTooltip(`${title}: No snapshot data`, { sticky: true });
                        layer.bindPopup(`<strong>${title}</strong><br/>No snapshot data is currently available for this region.`);
                        return;
                      }

                      const drift = snapshot.drift_status || 'STABLE';
                      const avgRisk = Number(snapshot.avg_risk_score || 0).toFixed(2);
                      const growth = Number(snapshot.risk_growth_pct || 0) * 100;
                      const linkedMembers = Number(snapshot.linkedMemberCount || snapshot.profile_count || 0);
                      const evacAssist = Number(snapshot.evacuationAssistCount || 0);
                      const sourceLabel = snapshot.source === 'org-members' ? 'Organization Members' : 'Region Snapshot';

                      layer.bindTooltip(`${title}: ${drift} · Risk ${avgRisk}`, { sticky: true });
                      layer.bindPopup(
                        `<strong>${title}</strong><br/>Source: ${sourceLabel}<br/>Drift: ${drift}<br/>Avg Risk: ${avgRisk}<br/>Growth: ${growth.toFixed(1)}%<br/>Linked Members: ${linkedMembers}<br/>Evac Assist: ${evacAssist}`,
                      );
                    }}
                  />
                )}
                {canSeeOrgDetail && showLinkedMembers && clusteredLinkedMemberMarkers.map((cluster) => {
                  const color = cluster.dominantStatus === 'DANGER' ? '#ef4444' : cluster.dominantStatus === 'SAFE' ? '#22c55e' : '#3b82f6';
                  const radius = Math.min(12, 3 + Math.log2(cluster.count + 1) * 2);
                  const previewMembers = cluster.members.slice(0, 8);
                  return (
                    <CircleMarker
                      key={cluster.id}
                      center={[cluster.lat, cluster.lng]}
                      radius={radius}
                      pathOptions={{ color, fillColor: color, fillOpacity: 0.85, weight: 1 }}
                    >
                      <Popup>
                        <div className="text-sm">
                          <p><strong>Linked Members: {cluster.count}</strong></p>
                          <p>Status mix: {cluster.dangerCount} danger, {cluster.unknownCount} unknown, {cluster.safeCount} safe</p>
                          {previewMembers.map((member) => (
                            <p key={`${member.orgId}-${member.id}`}>• {member.name} ({member.status})</p>
                          ))}
                          {cluster.count > previewMembers.length && (
                            <p>• +{cluster.count - previewMembers.length} more</p>
                          )}
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}
              </MapContainer>

              <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur p-4 rounded-xl shadow-lg border border-slate-200">
                <div className="flex justify-between items-end gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase">Map Summary</p>
                    <p className="text-base font-bold text-slate-900">{visibleSnapshots.length} region snapshot(s)</p>
                    <p className="text-sm text-slate-600">
                      {alerts.length} active alert(s) • {joinActivitySummary.submitted24h} join submissions in 24h • realtime enabled
                      {canSeeOrgDetail && mapScope?.org_id ? ` • ${connectedMemberTotal} linked org members (${linkedMemberMarkers.length} mapped, ${clusteredLinkedMemberMarkers.length} clusters)` : ''}
                    </p>
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
                            Avg Risk {Number(row.avg_risk_score || 0).toFixed(2)} • Profiles {row.linkedMemberCount || row.profile_count}
                          </p>
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <Activity size={12} /> Growth {(Number(row.risk_growth_pct || 0) * 100).toFixed(1)}%
                          </p>
                          {Number(row.evacuationAssistCount || 0) > 0 && (
                            <p className="text-xs text-rose-600">Evac assistance needed: {row.evacuationAssistCount}</p>
                          )}
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
