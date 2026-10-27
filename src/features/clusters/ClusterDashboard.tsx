import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  DEFAULT_CLUSTER_OPTIONS,
  detectClusters,
  type ClusterableComplaint,
  type ComplaintCluster,
} from '../../services/clustering/clusterDetector';
import { getOpenComplaintsForClustering, mergeComplaintsIntoCase } from '../../services/supabase/clusters';
import { formatINR } from '../../services/evidence/amounts';
import { makeDemoComplaints } from './demoClusterData';
import { AlertTriangle, CheckCircle2, GitMerge, Loader2, RefreshCw, Users, FlaskConical } from 'lucide-react';

interface ClusterDashboardProps {
  onSelectComplaint: (id: string) => void;
}

const SEVERITY_STYLE: Record<ComplaintCluster['severity'], string> = {
  Critical: 'bg-red-100 text-red-800 border-red-300',
  High: 'bg-orange-100 text-orange-800 border-orange-300',
  Watch: 'bg-amber-100 text-amber-800 border-amber-300',
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

export const ClusterDashboard: React.FC<ClusterDashboardProps> = ({ onSelectComplaint }) => {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState<ClusterableComplaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [minSize, setMinSize] = useState(DEFAULT_CLUSTER_OPTIONS.minSize);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [mergingId, setMergingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setComplaints(await getOpenComplaintsForClustering());
      setDemo(false);
    } catch (e) {
      setComplaints([]);
      setError((e as Error).message || 'Could not load complaints.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const clusters = useMemo(
    () => detectClusters(complaints, { minSize }),
    [complaints, minSize]
  );

  const stats = useMemo(() => {
    const inClusters = clusters.reduce((s, c) => s + c.members.length, 0);
    return {
      clusters: clusters.length,
      inClusters,
      affected: clusters.reduce((s, c) => s + c.total_affected, 0),
      saved: clusters.reduce((s, c) => s + c.members.length - 1, 0),
    };
  }, [clusters]);

  const toggle = (id: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const merge = async (cluster: ComplaintCluster) => {
    const children = cluster.members.filter((m) => m.id !== cluster.parent.id && !excluded.has(m.id));
    if (children.length === 0) return;
    if (!window.confirm(`Merge ${children.length} complaint(s) into ${cluster.parent.complaint_number}? The merged complaints will be closed and counted as affected persons of the lead case.`)) return;

    setMergingId(cluster.id);
    setNotice(null);
    setError(null);
    try {
      if (demo) {
        // Demo data lives only in memory
        const childIds = new Set(children.map((c) => c.id));
        const added = children.reduce((s, c) => s + (c.affected_count || 1), 0);
        setComplaints((prev) =>
          prev
            .filter((c) => !childIds.has(c.id))
            .map((c) => (c.id === cluster.parent.id ? { ...c, affected_count: (c.affected_count || 1) + added } : c))
        );
        setNotice(`Demo: ${children.length} complaints merged into ${cluster.parent.complaint_number}. Now ${(cluster.parent.affected_count || 1) + added} persons affected.`);
      } else {
        const total = await mergeComplaintsIntoCase(cluster.parent, children, user?.id ?? null);
        setNotice(`${children.length} complaints merged into ${cluster.parent.complaint_number}. Total affected persons: ${total}.`);
        await load();
      }
    } catch (e) {
      setError((e as Error).message || 'Merge failed. Your bureau may not have permission, or the database migration has not been applied.');
    } finally {
      setMergingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <Users className="w-5 h-5 text-[#0b3b60]" />
            <span>Mass Complaint Clusters</span>
          </h2>
          <p className="text-xs text-slate-500">
            When many students at one college report the same problem, handle it as <strong>one case</strong> with a count of affected persons.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setComplaints(makeDemoComplaints());
              setDemo(true);
              setError(null);
              setNotice(null);
            }}
            className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded flex items-center space-x-1.5"
            title="Loads made-up complaints so you can see clustering without any database data"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span>Load demo data</span>
          </button>
          <button onClick={load} className="p-2 border border-slate-200 hover:bg-slate-50 rounded text-slate-600" title="Reload from database">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {demo && (
        <div className="bg-blue-50 border border-blue-200 text-blue-900 text-xs rounded p-3 flex items-center space-x-2">
          <FlaskConical className="w-4 h-4 shrink-0" />
          <span>Showing made-up demo complaints. Merging here only changes this screen, nothing is saved. Press reload to return to real data.</span>
        </div>
      )}
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded p-3 flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-xs rounded p-3 flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Clusters found', value: stats.clusters },
          { label: 'Complaints inside clusters', value: stats.inClusters },
          { label: 'Persons affected', value: stats.affected },
          { label: 'Duplicate cases avoided', value: stats.saved },
        ].map((t) => (
          <div key={t.label} className="bg-white border border-slate-200 rounded p-4 shadow-sm">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{t.label}</div>
            <div className="text-2xl font-extrabold text-[#0b3b60] mt-1">{t.value}</div>
          </div>
        ))}
      </div>

      {/* Sensitivity */}
      <div className="bg-white border border-slate-200 rounded p-4 shadow-sm text-xs">
        <label className="block">
          <span className="font-semibold text-slate-700">
            Minimum complaints to call it a cluster: <span className="font-mono text-[#0b3b60]">{minSize}</span>
          </span>
          <input type="range" min={2} max={10} value={minSize} onChange={(e) => setMinSize(Number(e.target.value))} className="w-full mt-1" />
        </label>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded p-10 flex items-center justify-center text-xs text-slate-500 space-x-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Scanning open complaints...</span>
        </div>
      ) : clusters.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded p-10 text-center text-xs text-slate-500">
          No mass complaints found. Complaints are grouped only when they are about the same college, still open, and describe the same issue.
          <br />
          Press <strong>Load demo data</strong> to see how it looks.
        </div>
      ) : (
        clusters.map((c) => {
          const selectedChildren = c.members.filter((m) => m.id !== c.parent.id && !excluded.has(m.id));
          return (
            <div key={c.id} className="bg-white border border-slate-200 rounded shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${SEVERITY_STYLE[c.severity]}`}>{c.severity.toUpperCase()}</span>
                    {c.burst && <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-purple-100 text-purple-800 border-purple-300">SUDDEN SPIKE</span>}
                    <span className="text-[11px] text-slate-500">
                      {fmtDate(c.first_at)} to {fmtDate(c.last_at)}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-slate-900 mt-1">{c.institution_name}</div>
                  <div className="text-xs text-slate-600">{c.category}</div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {c.shared_amount !== null && <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold">Same amount: {formatINR(c.shared_amount)}</span>}
                    {c.shared_terms.map((t) => (
                      <span key={t} className="text-[10px] px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600">
                        {t}
                      </span>
                    ))}
                    <span className="text-[10px] px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-800">Match strength {Math.round(c.avg_similarity * 100)}%</span>
                  </div>
                </div>
                <div className="flex md:flex-col items-center md:items-end gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-3xl font-extrabold text-amber-700 leading-none">{c.total_affected}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wide">persons affected</div>
                  </div>
                  <button
                    onClick={() => merge(c)}
                    disabled={mergingId === c.id || selectedChildren.length === 0}
                    className="px-3.5 py-2 bg-[#0b3b60] hover:bg-[#072a45] disabled:opacity-40 text-white text-xs font-bold rounded shadow-sm flex items-center space-x-1.5"
                  >
                    {mergingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitMerge className="w-3.5 h-3.5 text-amber-300" />}
                    <span>Merge {selectedChildren.length} into one case</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                    <tr>
                      <th className="py-2 px-3 w-8">Merge</th>
                      <th className="py-2 px-3">Case no.</th>
                      <th className="py-2 px-3">Complainant</th>
                      <th className="py-2 px-3">Title</th>
                      <th className="py-2 px-3">Received</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {c.members.map((m) => {
                      const isParent = m.id === c.parent.id;
                      return (
                        <tr key={m.id} className={isParent ? 'bg-amber-50/50' : 'hover:bg-slate-50'}>
                          <td className="py-2 px-3">
                            {isParent ? (
                              <span className="text-[9px] font-bold text-amber-800">LEAD</span>
                            ) : (
                              <input type="checkbox" checked={!excluded.has(m.id)} onChange={() => toggle(m.id)} className="cursor-pointer" />
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-[#0b3b60] whitespace-nowrap">
                            {demo ? (
                              m.complaint_number
                            ) : (
                              <button className="underline" onClick={() => onSelectComplaint(m.id)}>
                                {m.complaint_number}
                              </button>
                            )}
                          </td>
                          <td className="py-2 px-3 text-slate-700">{m.complainant_name || '—'}{(m.affected_count || 1) > 1 ? ` (+${(m.affected_count || 1) - 1})` : ''}</td>
                          <td className="py-2 px-3 text-slate-900 max-w-[280px] truncate">{m.title}</td>
                          <td className="py-2 px-3 text-slate-500 whitespace-nowrap">{fmtDate(m.received_at)}</td>
                          <td className="py-2 px-3 text-slate-600">{m.status}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};
