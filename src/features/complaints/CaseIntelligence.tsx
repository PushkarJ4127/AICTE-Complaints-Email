import React, { useEffect, useState } from 'react';
import { Users, Languages, Paperclip, ExternalLink, GitMerge } from 'lucide-react';
import { EvidenceCard } from '../../components/intake/EvidenceUploader';
import { getSupporters } from '../../services/supabase/clusters';
import { getEvidenceUrl } from '../../services/supabase/evidenceStorage';
import type { ComplaintRow, ComplaintSupporterRow, EvidenceItem } from '../../types/database.types';

const OpenFileLink: React.FC<{ path: string }> = ({ path }) => {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const url = await getEvidenceUrl(path);
        setBusy(false);
        if (url) window.open(url, '_blank', 'noopener');
        else alert('Could not open the stored file.');
      }}
      className="text-[11px] text-[#0b3b60] underline flex items-center space-x-1"
    >
      <ExternalLink className="w-3 h-3" />
      <span>{busy ? 'Opening...' : 'Open original file'}</span>
    </button>
  );
};

/** Shows, on the case page: mass-case count + supporters, original language, and evidence checks. */
export const CaseIntelligence: React.FC<{ complaint: ComplaintRow; onSelectComplaint?: (id: string) => void }> = ({ complaint }) => {
  const affected = complaint.affected_count ?? 1;
  const evidence: EvidenceItem[] = Array.isArray(complaint.evidence) ? complaint.evidence : [];
  const [supporters, setSupporters] = useState<ComplaintSupporterRow[]>([]);

  useEffect(() => {
    let alive = true;
    if (affected > 1) {
      getSupporters(complaint.id).then((rows) => alive && setSupporters(rows));
    } else {
      setSupporters([]);
    }
    return () => {
      alive = false;
    };
  }, [complaint.id, affected]);

  const hasOriginal = Boolean(complaint.original_text);
  if (affected <= 1 && !hasOriginal && evidence.length === 0 && !complaint.merged_into) return null;

  const supporterEvidence = supporters.flatMap((s) => (Array.isArray(s.evidence) ? s.evidence : []));
  const mismatches = [...evidence, ...supporterEvidence].filter((e) => e.verdict === 'mismatch').length;

  return (
    <div className="space-y-4">
      {complaint.merged_into && (
        <div className="bg-slate-100 border border-slate-300 rounded p-3 text-xs text-slate-700 flex items-center space-x-2">
          <GitMerge className="w-4 h-4 text-slate-500" />
          <span>This complaint was merged into a mass case and is closed. The complainant is counted among its affected persons.</span>
        </div>
      )}

      {affected > 1 && (
        <div className="bg-white border-2 border-amber-400 rounded shadow-sm">
          <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-amber-700" />
              <div>
                <div className="text-sm font-bold text-amber-900">Mass complaint: {affected} persons affected</div>
                <div className="text-[11px] text-amber-800">One case represents everyone who reported this issue. Act once, close for all.</div>
              </div>
            </div>
            <div className="text-2xl font-extrabold text-amber-800">{affected}</div>
          </div>
          <div className="p-4 text-xs space-y-2">
            {mismatches > 0 && (
              <div className="text-[11px] bg-red-50 border border-red-200 text-red-800 rounded px-2 py-1">
                {mismatches} attached document(s) do not match what the complainant wrote. Please check them below.
              </div>
            )}
            {supporters.length === 0 ? (
              <p className="text-slate-500">Details of the other affected persons are visible to signed-in officers once the database migration is applied.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="text-[10px] uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-1.5 pr-3">Name</th>
                      <th className="py-1.5 pr-3">Roll / ID</th>
                      <th className="py-1.5 pr-3">How added</th>
                      <th className="py-1.5 pr-3">Evidence</th>
                      <th className="py-1.5">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {supporters.map((s) => {
                      const ev = Array.isArray(s.evidence) ? s.evidence : [];
                      return (
                        <tr key={s.id}>
                          <td className="py-1.5 pr-3 font-semibold text-slate-900">{s.name}</td>
                          <td className="py-1.5 pr-3 font-mono text-slate-600">{s.roll_no || '—'}</td>
                          <td className="py-1.5 pr-3 text-slate-600">
                            {s.source === 'merged' ? `Merged from ${s.original_complaint_number || 'another case'}` : 'Joined online'}
                          </td>
                          <td className="py-1.5 pr-3">
                            {ev.length === 0 ? (
                              '—'
                            ) : ev.some((e) => e.verdict === 'mismatch') ? (
                              <span className="text-red-700 font-semibold">{ev.length} file(s), mismatch</span>
                            ) : (
                              <span className="text-slate-700">{ev.length} file(s)</span>
                            )}
                          </td>
                          <td className="py-1.5 text-slate-500">{new Date(s.created_at).toLocaleDateString('en-IN')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {hasOriginal && (
        <div className="bg-white border border-blue-200 rounded shadow-sm p-4">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-2 flex items-center space-x-1.5">
            <Languages className="w-4 h-4 text-[#0b3b60]" />
            <span>Original words of the complainant ({complaint.original_language || 'regional language'})</span>
          </h4>
          <p className="text-xs text-slate-700 bg-blue-50 border border-blue-100 rounded p-3 whitespace-pre-wrap leading-relaxed">{complaint.original_text}</p>
          <p className="text-[10px] text-slate-400 mt-1">The English text above was produced by AI translation. Check this original when the exact wording matters.</p>
        </div>
      )}

      {evidence.length > 0 && (
        <div className="bg-white border border-slate-200 rounded shadow-sm p-4 space-y-3">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center space-x-1.5">
            <Paperclip className="w-4 h-4 text-[#0b3b60]" />
            <span>Evidence &amp; AI Verification ({evidence.length})</span>
          </h4>
          {evidence.map((item, i) => (
            <EvidenceCard key={i} item={item} extra={item.storage_path ? <OpenFileLink path={item.storage_path} /> : undefined} />
          ))}
        </div>
      )}
    </div>
  );
};
