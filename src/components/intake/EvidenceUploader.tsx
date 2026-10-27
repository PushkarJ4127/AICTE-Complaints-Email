import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileCheck2, Loader2, Paperclip, ShieldAlert, ShieldCheck, ShieldQuestion, Trash2 } from 'lucide-react';
import {
  ACCEPTED_EVIDENCE_TYPES,
  MAX_EVIDENCE_BYTES,
  buildEvidenceItem,
  extractFromFile,
  makeSampleReceipt,
  type RawExtraction,
} from '../../services/gemini/evidenceAnalyzer';
import { formatINR } from '../../services/evidence/amounts';
import type { EvidenceItem } from '../../types/database.types';

const MAX_FILES = 5;

interface Entry {
  id: string;
  file: File;
  raw: RawExtraction | null;
}

interface EvidenceUploaderProps {
  /** Title + description the person wrote (the claim to compare against) */
  claimedText: string;
  complainantName?: string;
  institutionName?: string;
  onChange: (items: EvidenceItem[], files: File[]) => void;
}

export const VerdictBadge: React.FC<{ verdict: EvidenceItem['verdict'] }> = ({ verdict }) => {
  if (verdict === 'consistent') {
    return (
      <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
        <ShieldCheck className="w-3 h-3" />
        <span>MATCHES COMPLAINT</span>
      </span>
    );
  }
  if (verdict === 'mismatch') {
    return (
      <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-200">
        <ShieldAlert className="w-3 h-3" />
        <span>NEEDS ATTENTION</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
      <ShieldQuestion className="w-3 h-3" />
      <span>NOT VERIFIED</span>
    </span>
  );
};

/** Shows what was read from a document and any mismatch flags. Used by the form and by officers. */
export const EvidenceCard: React.FC<{ item: EvidenceItem; busy?: boolean; onRemove?: () => void; extra?: React.ReactNode }> = ({
  item,
  busy,
  onRemove,
  extra,
}) => {
  const e = item.extracted;
  return (
    <div
      className={`border rounded p-3 text-xs bg-white space-y-2 ${
        item.verdict === 'mismatch' ? 'border-red-300' : item.verdict === 'consistent' ? 'border-emerald-300' : 'border-slate-200'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-slate-900 truncate flex items-center space-x-1.5">
            <FileCheck2 className="w-3.5 h-3.5 text-[#0b3b60] shrink-0" />
            <span className="truncate">{item.file_name}</span>
          </div>
          <div className="text-[10px] text-slate-500">
            {item.document_type || 'Document'} • {item.size < 1024 ? `${item.size} B` : `${(item.size / 1024).toFixed(0)} KB`}
            {item.checked_by === 'gemini' && ' • read by AI'}
            {item.checked_by === 'text-parser' && ' • read in browser'}
          </div>
        </div>
        <div className="flex items-center space-x-2 shrink-0">
          {busy ? (
            <span className="text-[10px] text-slate-500 flex items-center space-x-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Reading...</span>
            </span>
          ) : (
            <VerdictBadge verdict={item.verdict} />
          )}
          {onRemove && (
            <button type="button" onClick={onRemove} className="text-slate-400 hover:text-red-600" title="Remove file">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {!busy && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <div className="bg-slate-50 rounded p-1.5">
              <div className="text-slate-500">Amount on document</div>
              <div className="font-bold text-slate-900">{e.primary_amount !== null ? formatINR(e.primary_amount) : '—'}</div>
            </div>
            <div className="bg-slate-50 rounded p-1.5">
              <div className="text-slate-500">Amount in complaint</div>
              <div className="font-bold text-slate-900">{item.claimed_amounts.length ? item.claimed_amounts.map(formatINR).join(', ') : '—'}</div>
            </div>
            <div className="bg-slate-50 rounded p-1.5">
              <div className="text-slate-500">Date</div>
              <div className="font-bold text-slate-900">{e.dates[0] || '—'}</div>
            </div>
            <div className="bg-slate-50 rounded p-1.5">
              <div className="text-slate-500">Name / Receipt no.</div>
              <div className="font-bold text-slate-900 truncate">{[e.payer_name, e.receipt_number].filter(Boolean).join(' / ') || '—'}</div>
            </div>
          </div>
          {item.flags.length > 0 && (
            <ul className="space-y-1">
              {item.flags.map((f, i) => (
                <li
                  key={i}
                  className={`text-[11px] px-2 py-1 rounded border ${
                    f.severity === 'high'
                      ? 'bg-red-50 border-red-200 text-red-800'
                      : f.severity === 'medium'
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  {f.message}
                </li>
              ))}
            </ul>
          )}
          {item.verdict === 'consistent' && item.flags.length === 0 && (
            <p className="text-[11px] text-emerald-700">The amount and details on this document agree with what you wrote.</p>
          )}
        </>
      )}
      {extra}
    </div>
  );
};

export const EvidenceUploader: React.FC<EvidenceUploaderProps> = ({ claimedText, complainantName, institutionName, onChange }) => {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Flags are recomputed whenever the complaint text changes. The AI is only called once per file.
  const items = useMemo(
    () =>
      entries
        .filter((e) => e.raw)
        .map((e) => buildEvidenceItem(e.file, e.raw as RawExtraction, { claimedText, complainantName, institutionName })),
    [entries, claimedText, complainantName, institutionName]
  );
  const files = useMemo(() => entries.filter((e) => e.raw).map((e) => e.file), [entries]);

  useEffect(() => {
    onChangeRef.current(items, files);
  }, [items, files]);

  const addFiles = async (list: FileList | File[]) => {
    setError(null);
    const incoming = Array.from(list);
    const room = MAX_FILES - entries.length;
    if (incoming.length > room) setError(`You can attach up to ${MAX_FILES} files.`);

    for (const file of incoming.slice(0, Math.max(room, 0))) {
      const okType = ACCEPTED_EVIDENCE_TYPES.includes(file.type) || /\.(txt|csv|pdf|png|jpe?g|webp)$/i.test(file.name);
      if (!okType) {
        setError(`"${file.name}" is not supported. Please attach a PDF, image (PNG/JPG) or text receipt.`);
        continue;
      }
      if (file.size > MAX_EVIDENCE_BYTES) {
        setError(`"${file.name}" is larger than 8 MB.`);
        continue;
      }
      const id = `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setEntries((prev) => [...prev, { id, file, raw: null }]);
      const raw = await extractFromFile(file);
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, raw } : e)));
    }
  };

  const remove = (id: string) => setEntries((prev) => prev.filter((e) => e.id !== id));

  return (
    <div className="border border-slate-300 rounded-md p-3 space-y-3 bg-slate-50/60">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <div className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
            <Paperclip className="w-4 h-4 text-[#0b3b60]" />
            <span>Attach evidence (optional)</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Fee receipt, bank slip, demand letter or screenshot. AI reads the amount and dates and warns you if they do not match what you wrote.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="px-3 py-1.5 text-xs font-semibold border border-[#0b3b60] text-[#0b3b60] rounded bg-white hover:bg-slate-50"
          >
            Choose files
          </button>
          <button
            type="button"
            onClick={() => addFiles([makeSampleReceipt(90000, complainantName || 'Aarav Sharma', institutionName)])}
            className="text-[11px] underline text-slate-500 hover:text-slate-800"
            title="Adds a made-up text receipt for ₹90,000 so you can see the check working"
          >
            Try a sample receipt
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,image/*,application/pdf,text/plain"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {error && <p className="text-[11px] text-red-600">{error}</p>}

      {entries.map((entry) => {
        const item = items.find((i) => i.file_name === entry.file.name && i.size === entry.file.size);
        const placeholder: EvidenceItem = {
          file_name: entry.file.name,
          mime_type: entry.file.type,
          size: entry.file.size,
          extracted: { amounts: [], primary_amount: null, dates: [] },
          claimed_amounts: [],
          flags: [],
          verdict: 'unverified',
          checked_by: 'none',
        };
        return <EvidenceCard key={entry.id} item={entry.raw && item ? item : placeholder} busy={!entry.raw} onRemove={() => remove(entry.id)} />;
      })}
    </div>
  );
};
