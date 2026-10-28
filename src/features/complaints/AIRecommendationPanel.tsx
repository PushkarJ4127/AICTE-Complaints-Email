import React, { useState } from 'react';
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  FileText,
  BookOpen,
  ClipboardList,
  Zap,
  RefreshCw,
  Shield,
} from 'lucide-react';
import {
  getComplaintRecommendations,
  type ComplaintContext,
  type AIRecommendation,
} from '../../services/gemini/complaintAdvisor';

interface AIRecommendationPanelProps {
  ctx: ComplaintContext;
}

export const AIRecommendationPanel: React.FC<AIRecommendationPanelProps> = ({ ctx }) => {
  const [expanded, setExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<AIRecommendation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);

  const generate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getComplaintRecommendations(ctx);
      setRecommendation(result);
      setHasGenerated(true);
      setExpanded(true);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e?.message || 'Failed to generate AI recommendations. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="border-2 border-violet-200 rounded-lg overflow-hidden shadow-sm bg-white">
      {/* Panel Header */}
      <div className="bg-gradient-to-r from-violet-700 to-indigo-700 text-white px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 bg-white/15 rounded-md">
            <Sparkles className="w-4 h-4 text-violet-200" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-wide">AICTE InspectorAI</div>
            <div className="text-[11px] text-violet-200">
              Gemini-powered investigation guidance &amp; execution roadmap
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {hasGenerated && (
            <button
              type="button"
              onClick={generate}
              disabled={isLoading}
              title="Regenerate recommendations"
              className="p-1.5 hover:bg-white/20 rounded-md transition text-violet-200 hover:text-white"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
          {hasGenerated && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="p-1.5 hover:bg-white/20 rounded-md transition text-violet-200 hover:text-white"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Generate CTA — shown before first generation */}
      {!hasGenerated && (
        <div className="px-5 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 bg-violet-50/60 border-b border-violet-100">
          <div className="text-xs text-slate-700 leading-relaxed">
            <span className="font-semibold text-violet-800">AI Execution Advisor</span> analyzes this complaint's
            category, description, institution, priority, and deadline — then generates{' '}
            <strong>step-by-step investigation instructions</strong>, evidence requirements, applicable AICTE
            regulations, and estimated resolution timeline tailored for the{' '}
            <strong>{ctx.bureau} bureau</strong>.
          </div>
          <button
            type="button"
            onClick={generate}
            disabled={isLoading}
            className="shrink-0 px-5 py-2.5 bg-violet-700 hover:bg-violet-800 text-white text-xs font-bold rounded-md shadow-sm flex items-center space-x-2 transition disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Analysing Complaint...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate Investigation Roadmap</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Loading overlay when regenerating */}
      {isLoading && hasGenerated && (
        <div className="px-5 py-4 bg-violet-50 border-b border-violet-100 flex items-center space-x-3 text-xs text-violet-700 font-medium">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span>InspectorAI is re-analysing the complaint...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="m-4 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800 flex items-start space-x-2">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Recommendation Results */}
      {recommendation && expanded && !isLoading && (
        <div className="p-5 space-y-5 text-xs">
          {/* Summary + Est. Resolution Row */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 bg-slate-50 border border-slate-200 rounded-md p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center space-x-1">
                <FileText className="w-3.5 h-3.5" />
                <span>AI Executive Summary</span>
              </div>
              <p className="text-slate-800 leading-relaxed">{recommendation.summary}</p>
            </div>

            <div className="sm:w-44 shrink-0 border border-slate-200 rounded-md p-4 bg-slate-50 flex flex-col justify-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Est. Resolution
              </div>
              <div className="font-bold text-slate-900 text-lg">
                {recommendation.estimated_resolution_days}{' '}
                <span className="text-xs font-medium text-slate-500">days</span>
              </div>
            </div>
          </div>

          {/* Bureau Action */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-md p-4 flex items-start space-x-3">
            <div className="p-1.5 bg-indigo-600 text-white rounded shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 mb-1">
                Primary Bureau Action
              </div>
              <p className="text-indigo-900 font-semibold leading-relaxed">
                {recommendation.bureau_action}
              </p>
            </div>
          </div>

          {/* Step-by-Step Execution Plan */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center space-x-1.5">
              <ClipboardList className="w-3.5 h-3.5" />
              <span>Step-by-Step Execution Roadmap</span>
            </div>
            <ol className="space-y-2">
              {recommendation.steps.map((step, idx) => (
                <li key={idx} className="flex items-start space-x-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-violet-700 text-white flex items-center justify-center font-bold text-[10px]">
                    {idx + 1}
                  </span>
                  <span className="text-slate-700 leading-relaxed pt-0.5">
                    {/* Remove "Step N:" prefix if Gemini included it */}
                    {step.replace(/^Step\s+\d+:\s*/i, '')}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {/* Two-column: Documents + Legal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Documents Needed */}
            <div className="border border-slate-200 rounded-md p-4 bg-slate-50">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center space-x-1.5">
                <FileText className="w-3.5 h-3.5" />
                <span>Evidence &amp; Documents Required</span>
              </div>
              <ul className="space-y-2">
                {recommendation.documents_needed.map((doc, idx) => (
                  <li key={idx} className="flex items-start space-x-2 text-slate-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{doc}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal Provisions */}
            <div className="border border-amber-200 rounded-md p-4 bg-amber-50/50">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-3 flex items-center space-x-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Applicable AICTE Regulations</span>
              </div>
              <ul className="space-y-2">
                {recommendation.legal_provisions.map((law, idx) => (
                  <li key={idx} className="flex items-start space-x-2 text-amber-900">
                    <Zap className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span className="font-medium">{law}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* AI Disclaimer */}
          <div className="text-[10px] text-slate-400 border-t border-slate-100 pt-3 italic">
            AI-generated guidance — powered by Google Gemini. This is an advisory tool only. Final decisions and official actions remain the responsibility of the authorised AICTE bureau officer.
          </div>
        </div>
      )}

      {/* Collapsed Summary Bar (after generation, when collapsed) */}
      {hasGenerated && !expanded && recommendation && !isLoading && (
        <div className="px-5 py-3 bg-violet-50/60 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-3 text-slate-700">
            <span className="font-semibold text-violet-800">
              {recommendation.steps.length} execution steps
            </span>
            <span className="text-slate-400">•</span>
            <span>~{recommendation.estimated_resolution_days} day resolution</span>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-violet-700 font-semibold hover:underline"
          >
            Expand Roadmap →
          </button>
        </div>
      )}
    </div>
  );
};
