import React, { useState } from 'react';
import { Languages, Loader2, Sparkles, Undo2, Info } from 'lucide-react';
import { VoiceInput } from './VoiceInput';
import {
  INTAKE_LANGUAGES,
  analyzeMultilingualComplaint,
  isNonEnglish,
  type IntakeAnalysis,
} from '../../services/gemini/multilingual';

export interface OriginalWords {
  language: string;
  text: string;
}

interface MultilingualIntakeProps {
  description: string;
  onDescriptionChange: React.Dispatch<React.SetStateAction<string>>;
  title: string;
  onTitleChange: (v: string) => void;
  onCategoryChange: (v: string) => void;
  categories: string[];
  original: OriginalWords | null;
  onOriginalChange: (o: OriginalWords | null) => void;
}

export const MultilingualIntake: React.FC<MultilingualIntakeProps> = ({
  description,
  onDescriptionChange,
  title,
  onTitleChange,
  onCategoryChange,
  categories,
  original,
  onOriginalChange,
}) => {
  const [lang, setLang] = useState('hi-IN');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IntakeAnalysis | null>(null);

  const appendSpoken = (chunk: string) => {
    if (!chunk) return;
    onDescriptionChange((current) => (current ? `${current.trimEnd()} ${chunk}` : chunk));
  };

  const needsTranslation = !original && description.trim().length > 0 && isNonEnglish(description);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await analyzeMultilingualComplaint(description, categories, lang);
      setResult(res);
      onCategoryChange(res.category);
      if (!title.trim() && res.english_title) onTitleChange(res.english_title);
      if (res.used_ai || res.english_description !== description) {
        onOriginalChange({ language: res.detected_language, text: description });
        onDescriptionChange(res.english_description);
      }
    } catch (e) {
      setError((e as Error).message || 'Could not translate. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const restore = () => {
    if (!original) return;
    onDescriptionChange(original.text);
    onOriginalChange(null);
    setResult(null);
  };

  return (
    <div className="border border-blue-200 bg-blue-50/60 rounded-md p-3 space-y-2">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <div className="text-xs font-bold text-[#0b3b60] flex items-center space-x-1.5">
            <Languages className="w-4 h-4" />
            <span>Write or speak in your own language / अपनी भाषा में बोलें या लिखें</span>
          </div>
          <p className="text-[11px] text-slate-600 mt-0.5">
            Hindi, Marathi, Tamil, Telugu, Bengali, Gujarati, Kannada, Malayalam, Punjabi or English. We translate it for the officer and pick the category. Your original words are saved too.
          </p>
        </div>
      </div>

      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">Language</label>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="text-xs border border-slate-300 rounded px-2 py-1.5 bg-white text-slate-900"
          >
            {INTAKE_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <VoiceInput language={lang} onFinalText={appendSpoken} />
        <button
          type="button"
          onClick={run}
          disabled={busy || !description.trim()}
          className="px-3 py-1.5 rounded text-xs font-bold bg-[#0b3b60] text-white hover:bg-[#072a45] disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1.5"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-300" />}
          <span>{busy ? 'Translating...' : 'Translate to English & auto-fill'}</span>
        </button>
      </div>

      {needsTranslation && !busy && (
        <p className="text-[11px] text-blue-800 flex items-center space-x-1">
          <Info className="w-3.5 h-3.5 shrink-0" />
          <span>Your text is not in English. Click "Translate to English &amp; auto-fill" so the officer can read it.</span>
        </p>
      )}

      {error && <p className="text-[11px] text-red-600">{error}</p>}

      {result && (
        <div className="bg-white border border-emerald-200 rounded p-2.5 text-[11px] text-slate-700 space-y-1">
          <div>
            <strong className="text-emerald-700">{result.used_ai ? 'Understood:' : 'Note:'}</strong> {result.summary}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-slate-500">
            <span>
              Language: <strong className="text-slate-800">{result.detected_language}</strong>
            </span>
            <span>
              Category: <strong className="text-slate-800">{result.category}</strong>
            </span>
          </div>
          {result.note && <div className="text-amber-700">{result.note}</div>}
        </div>
      )}

      {original && (
        <div className="bg-white border border-slate-200 rounded p-2.5 text-[11px] space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700">Your original words ({original.language}) are saved with the complaint</span>
            <button type="button" onClick={restore} className="text-[#0b3b60] underline flex items-center space-x-1">
              <Undo2 className="w-3 h-3" />
              <span>Undo translation</span>
            </button>
          </div>
          <p className="text-slate-600 whitespace-pre-wrap max-h-20 overflow-y-auto">{original.text}</p>
        </div>
      )}
    </div>
  );
};
