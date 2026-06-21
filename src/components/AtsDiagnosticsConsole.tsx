import React, { useEffect, useId, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Search,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { AtsIssue, AtsResult, AtsStageId, AtsStageResult, AtsSuggestion } from '../types';
import { classifyKeywordEvidence } from '../utils/atsSuggestionEngine';

interface AtsDiagnosticsConsoleProps {
  result: AtsResult | null;
  isLoading?: boolean;
  onSuggestionAction?: (suggestion: AtsSuggestion, action: 'apply' | 'learning' | 'ignore' | 'not_true', editedValue?: string) => void;
}

const TAB_META: Record<AtsStageId, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  structureCheck: { label: 'Structure', icon: Search },
  jobMatch: { label: 'Job Match', icon: Sparkles },
  contentUpgrade: { label: 'Content Upgrade', icon: Wrench },
  applyToBuilder: { label: 'Apply to Builder', icon: CheckCircle2 },
};

const statusTone = (status: AtsStageResult['status']) => {
  switch (status) {
    case 'ready':
      return 'border-emerald-200 bg-emerald-50/70 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300';
    case 'partial':
      return 'border-amber-200 bg-amber-50/70 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300';
    case 'needs_ai':
      return 'border-amber-200 bg-amber-50/70 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300';
    case 'error':
      return 'border-rose-200 bg-rose-50/70 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300';
    default:
      return 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300';
  }
};

const statusLabel = (status: AtsStageResult['status']) => status === 'needs_ai'
  ? 'Needs AI'
  : status === 'needs_job_description'
    ? 'Add job description'
    : status === 'not_run'
      ? 'Not run'
  : status.charAt(0).toUpperCase() + status.slice(1);

const severityTone = (severity: AtsIssue['severity']) => {
  switch (severity) {
    case 'Critical':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300';
    case 'High':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300';
    case 'Medium':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300';
    default:
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300';
  }
};

function AtsLoadingState() {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-950">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
          <Loader2 className="h-5 w-5 animate-spin text-cyan-600" />
        </div>
        <div>
          <h3 className="text-sm font-black text-gray-900 dark:text-white">ATS Diagnostics Console</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Scanning resume structure and preparing staged results.</p>
        </div>
      </div>
      <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-[11px] text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
        Structural checks run locally first. AI-assisted stages appear only when a provider is configured.
      </div>
    </div>
  );
}

function AtsEmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-950">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
        <AlertCircle className="h-5 w-5 text-gray-500" />
      </div>
      <h3 className="mt-4 text-sm font-black text-gray-900 dark:text-white">No ATS scan yet.</h3>
      <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
        Run a local readability check, then connect AI and add a job description for job-specific analysis.
      </p>
    </div>
  );
}

function AtsScoreCard({ stage }: { stage: AtsStageResult }) {
  const hasScore = typeof stage.score === 'number';
  const structureRating = stage.score! >= 85 ? 'Strong structure' : stage.score! >= 70 ? 'Good structure' : stage.score! >= 50 ? 'Fair' : 'Needs work';
  const scoreLabel = stage.stageId === 'structureCheck'
    ? 'Local Resume Readability'
    : stage.status === 'ready'
      ? 'AI stage score'
      : 'Stage status';

  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">{scoreLabel}</p>
          <div className="mt-2 font-black text-gray-900 dark:text-white">
            {stage.stageId === 'structureCheck' && hasScore
              ? <span className="text-xl">{structureRating}</span>
              : <span className="text-3xl">{hasScore ? stage.score : '—'}</span>}
          </div>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusTone(stage.status)}`}>
          {statusLabel(stage.status)}
        </span>
      </div>
      {hasScore && stage.stageId !== 'structureCheck' && (
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
          <div
            className={`h-full rounded-full ${stage.score! >= 80 ? 'bg-emerald-500' : stage.score! >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`}
            style={{ width: `${Math.max(6, stage.score!)}%` }}
          />
        </div>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">{stage.summary}</p>
    </div>
  );
}

function AtsIssueAccordion({
  issue,
  expanded,
  onToggle,
}: {
  key?: React.Key;
  issue: AtsIssue;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-950">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-950"
        aria-expanded={expanded}
        aria-label={`Toggle ATS issue: ${issue.title}`}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-black text-gray-900 dark:text-white">{issue.title}</h4>
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${severityTone(issue.severity)}`}>
              {issue.severity}
            </span>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
            {issue.affectedSection} · -{issue.scoreImpact} points
          </p>
        </div>
        <ChevronDown className={`mt-0.5 h-4 w-4 flex-none text-gray-400 transition ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-4 text-[12px] leading-relaxed dark:border-gray-800">
          <dl className="space-y-3">
            <div>
              <dt className="font-bold text-gray-900 dark:text-white">Explanation</dt>
              <dd className="mt-1 text-gray-600 dark:text-gray-300">{issue.explanation}</dd>
            </div>
            <div>
              <dt className="font-bold text-gray-900 dark:text-white">Suggested fix</dt>
              <dd className="mt-1 text-gray-600 dark:text-gray-300">{issue.suggestedFix}</dd>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <dt className="font-bold text-gray-900 dark:text-white">ATS score impact</dt>
                <dd className="mt-1 text-gray-600 dark:text-gray-300">-{issue.scoreImpact} points</dd>
              </div>
              {issue.evidence ? (
                <div>
                  <dt className="font-bold text-gray-900 dark:text-white">Evidence</dt>
                  <dd className="mt-1 break-words font-mono text-[11px] text-gray-500 dark:text-gray-400">{issue.evidence}</dd>
                </div>
              ) : null}
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}

export default function AtsDiagnosticsConsole({
  result,
  isLoading = false,
  onSuggestionAction,
}: AtsDiagnosticsConsoleProps) {
  const tabs = useMemo(() => result?.stages || [], [result]);
  const [activeStageId, setActiveStageId] = useState<AtsStageId>('structureCheck');
  const [expandedIssueIds, setExpandedIssueIds] = useState<string[]>([]);
  const [showAllIssues, setShowAllIssues] = useState(false);
  const [editingSuggestionId, setEditingSuggestionId] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const tabsId = useId();

  useEffect(() => {
    const available = tabs.find(stage => stage.stageId === activeStageId);
    if (!available && tabs[0]) setActiveStageId(tabs[0].stageId);
  }, [activeStageId, tabs]);

  useEffect(() => {
    setExpandedIssueIds([]);
    setShowAllIssues(false);
  }, [activeStageId]);

  if (isLoading) return <AtsLoadingState />;
  if (!result) return <AtsEmptyState />;

  const activeStage = tabs.find(stage => stage.stageId === activeStageId) || tabs[0];
  if (!activeStage) return <AtsEmptyState />;
  const hasReadyAiStage = result.scanMode === 'ai-assisted';
  const overallLabel = hasReadyAiStage ? 'AI Job Match' : 'Local Resume Readability';
  const totalIssues = tabs.reduce((count, stage) => count + stage.issues.length, 0);
  const aiStatus = hasReadyAiStage
    ? 'Connected'
    : tabs.some(stage => stage.status === 'needs_ai')
      ? 'AI not connected'
      : tabs.some(stage => stage.status === 'error')
        ? 'AI unavailable'
        : 'AI stages not completed';
  const structureScore = tabs.find(stage => stage.stageId === 'structureCheck')?.score ?? 0;
  const structureRating = structureScore >= 85 ? 'Strong structure' : structureScore >= 70 ? 'Good structure' : structureScore >= 50 ? 'Fair' : 'Needs work';
  const jobDescriptionStatus = tabs.some(stage => stage.status === 'needs_job_description') ? 'Missing' : 'Added';
  const openSuggestions = result.suggestions.filter(suggestion => suggestion.status === 'pending' || suggestion.status === 'edited');

  const allExpanded = activeStage.issues.length > 0 && activeStage.issues.every(issue => expandedIssueIds.includes(issue.id));
  const visibleIssues = showAllIssues ? activeStage.issues : activeStage.issues.slice(0, 3);

  const toggleIssue = (issueId: string) => {
    setExpandedIssueIds(current =>
      current.includes(issueId) ? current.filter(id => id !== issueId) : [...current, issueId]
    );
  };

  const toggleAllIssues = () => {
    setExpandedIssueIds(allExpanded ? [] : activeStage.issues.map(issue => issue.id));
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else return;

    event.preventDefault();
    const nextStage = tabs[nextIndex];
    setActiveStageId(nextStage.stageId);
    requestAnimationFrame(() => document.getElementById(`${tabsId}-${nextStage.stageId}-tab`)?.focus());
  };

  return (
    <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-xl shadow-gray-100/10 dark:border-gray-800 dark:bg-gray-950 dark:shadow-black/20">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-cyan-600" />
            <h3 className="text-sm font-black text-gray-900 dark:text-white">Forge ATS Intelligence</h3>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Local structure checks plus user-approved AI suggestions when a provider is connected.
          </p>
        </div>
        <div className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
          {overallLabel}: {hasReadyAiStage ? result.overallScore : structureRating}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-[10px] sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-900"><span className="block text-gray-400">Mode</span><strong className="text-gray-700 dark:text-gray-200">{hasReadyAiStage ? 'AI-Assisted' : 'Local'}</strong></div>
        <div className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-900"><span className="block text-gray-400">AI</span><strong className="text-gray-700 dark:text-gray-200">{aiStatus}</strong></div>
        <div className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-900"><span className="block text-gray-400">Job description</span><strong className="text-gray-700 dark:text-gray-200">{jobDescriptionStatus}</strong></div>
        <div className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-900"><span className="block text-gray-400">Issues</span><strong className="text-gray-700 dark:text-gray-200">{totalIssues}</strong></div>
        <div className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-900"><span className="block text-gray-400">Suggestions</span><strong className="text-gray-700 dark:text-gray-200">{openSuggestions.length}</strong></div>
        <div className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-900"><span className="block text-gray-400">Candidate</span><strong className="capitalize text-gray-700 dark:text-gray-200">{result.candidateMode}</strong></div>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
        {hasReadyAiStage
          ? 'AI-assisted stages ran through your configured provider and may differ from external ATS platforms.'
          : 'This local check reviews structure and parseability only. It does not evaluate job fit, keyword relevance, grammar, or content quality without AI.'}
      </p>
      {!hasReadyAiStage && (
        <p className="mt-1 text-[11px] font-semibold text-gray-600 dark:text-gray-300">This is a local structure check, not a full ATS scan.</p>
      )}
      {!hasReadyAiStage && tabs.some(stage => stage.status === 'needs_ai') && (
        <p className="mt-2 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
          Connect an AI provider to run semantic job matching, content upgrades, and builder-ready suggestions.
        </p>
      )}

      <div
        role="tablist"
        aria-label="ATS diagnostic stages"
        aria-orientation="horizontal"
        className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4"
      >
        {tabs.map((stage, index) => {
          const active = stage.stageId === activeStage.stageId;
          const Icon = TAB_META[stage.stageId].icon;
          return (
            <button
              key={stage.stageId}
              id={`${tabsId}-${stage.stageId}-tab`}
              role="tab"
              type="button"
              aria-selected={active}
              aria-controls={`${tabsId}-${stage.stageId}-panel`}
              tabIndex={active ? 0 : -1}
              onClick={() => setActiveStageId(stage.stageId)}
              onKeyDown={event => handleTabKeyDown(event, index)}
              className={`min-h-14 min-w-0 rounded-2xl border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-950 ${
                active
                  ? 'border-cyan-300 bg-cyan-50 text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-100'
                  : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 rounded-xl p-2 ${active ? 'bg-white text-cyan-700 dark:bg-gray-950 dark:text-cyan-300' : 'bg-white text-gray-500 dark:bg-gray-950 dark:text-gray-400'}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[12px] font-black">{TAB_META[stage.stageId].label}</span>
                    <span className="text-[11px] font-black">
                      {stage.stageId === 'structureCheck' ? structureRating : typeof stage.score === 'number' ? stage.score : statusLabel(stage.status)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wide">
                    <span className={`rounded-full border px-2 py-0.5 ${statusTone(stage.status)}`}>{statusLabel(stage.status)}</span>
                    <span className="text-gray-500 dark:text-gray-400">{stage.issues.length} issues</span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div
        id={`${tabsId}-${activeStage.stageId}-panel`}
        role="tabpanel"
        aria-labelledby={`${tabsId}-${activeStage.stageId}-tab`}
        className="mt-5 space-y-4"
      >
        <AtsScoreCard stage={activeStage} />

        {activeStage.stageId === 'structureCheck' && (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-[11px] text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
            Local checks can catch formatting and structure problems, but they cannot judge semantic job fit without AI.
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-black uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
              Issues
            </h4>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {activeStage.status === 'needs_ai' || activeStage.status === 'needs_job_description' || activeStage.status === 'not_run' || activeStage.status === 'error'
                ? 'Not run yet.'
                : `${activeStage.issues.length} explainable issue${activeStage.issues.length === 1 ? '' : 's'} in this stage.${activeStage.issues.length > 3 ? ' Top 3 shown first.' : ''}`}
            </p>
          </div>
          {activeStage.issues.length > 0 ? (
            <button
              type="button"
              onClick={toggleAllIssues}
              className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-600 transition hover:border-gray-300 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:text-white dark:focus-visible:ring-offset-gray-950"
              aria-label={allExpanded ? 'Collapse all issues' : 'Expand all issues'}
            >
              {allExpanded ? 'Collapse issues' : `Expand ${activeStage.issues.length} issues`}
            </button>
          ) : null}
        </div>

        {activeStage.status === 'needs_ai' && activeStage.stageId !== 'structureCheck' && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-[11px] leading-relaxed text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
            <strong className="font-black">Needs AI.</strong> Connect AI or paste a provider key in Settings to run this stage safely.
          </div>
        )}

        {activeStage.status === 'needs_job_description' && (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-[11px] leading-relaxed text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200">
            Add a target job description, then run the scan to enable semantic keyword matching.
          </div>
        )}

        {activeStage.status === 'error' && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 text-[11px] leading-relaxed text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-100">
            AI analysis temporarily unavailable. Structural checks are still available.
          </div>
        )}

        {activeStage.stageId === 'applyToBuilder' && openSuggestions.length > 0 && (
          <div className="space-y-3">
            {openSuggestions.map(suggestion => {
              const editing = editingSuggestionId === suggestion.id;
              const suggestedText = Array.isArray(suggestion.suggestedValue)
                ? suggestion.suggestedValue.join(', ')
                : String(suggestion.suggestedValue);
              const keywordEvidence = classifyKeywordEvidence(suggestion);
              const affected = suggestion.type === 'add_keyword' || suggestion.type === 'add_learning_target'
                ? ['Job Match', 'Keyword Coverage']
                : suggestion.type === 'add_metric_placeholder'
                  ? ['Content Quality', 'Measurable Impact']
                  : ['Content Quality', 'Recruiter Readability'];
              return (
                <article key={suggestion.id} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wide">
                    <span className="rounded-full bg-cyan-50 px-2 py-1 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-200">{suggestion.type.replaceAll('_', ' ')}</span>
                    <span className="text-gray-400">{suggestion.target.sectionId}</span>
                    <span className="text-gray-400">Confidence {Math.round(suggestion.confidence * 100)}%</span>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div><span className="text-[10px] font-bold uppercase text-gray-400">Current</span><p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{String(suggestion.originalValue || 'Not present')}</p></div>
                    <div><span className="text-[10px] font-bold uppercase text-gray-400">Suggested</span>{editing ? (
                      <textarea className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs dark:border-gray-700 dark:bg-gray-900" value={editedValues[suggestion.id] ?? suggestedText} onChange={event => setEditedValues(values => ({ ...values, [suggestion.id]: event.target.value }))} />
                    ) : <p className="mt-1 text-xs font-semibold text-gray-900 dark:text-white">{suggestedText}</p>}</div>
                  </div>
                  <p className="mt-3 text-xs text-gray-600 dark:text-gray-300"><strong>Why:</strong> {suggestion.reason}</p>
                  {suggestion.evidence && <p className="mt-2 text-xs text-gray-600 dark:text-gray-300"><strong>Evidence:</strong> {suggestion.evidence}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400">
                    <strong>Affected:</strong>{affected.map(label => <span key={label} className="rounded-full border border-gray-200 px-2 py-0.5 dark:border-gray-800">{label}</span>)}
                  </div>
                  {suggestion.truthWarning && <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">{suggestion.truthWarning}</p>}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {keywordEvidence !== 'no_evidence' && <button type="button" onClick={() => onSuggestionAction?.(suggestion, 'apply', editedValues[suggestion.id])} className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-bold text-white hover:bg-cyan-500">{suggestion.type === 'add_learning_target' ? 'Add to Learning Targets' : keywordEvidence === 'possible_unconfirmed' ? 'I used this — add' : 'Apply'}</button>}
                    <button type="button" onClick={() => setEditingSuggestionId(editing ? null : suggestion.id)} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold dark:border-gray-700">{editing ? 'Done editing' : 'Edit Before Applying'}</button>
                    {suggestion.type === 'add_keyword' && <button type="button" onClick={() => onSuggestionAction?.(suggestion, 'learning')} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold dark:border-gray-700">Add to Learning Targets</button>}
                    <button type="button" onClick={() => onSuggestionAction?.(suggestion, 'ignore')} className="rounded-lg px-3 py-2 text-xs font-bold text-gray-500">Ignore</button>
                    <button type="button" onClick={() => onSuggestionAction?.(suggestion, 'not_true')} className="rounded-lg px-3 py-2 text-xs font-bold text-rose-500">Mark as Not True</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {activeStage.issues.length > 0 ? (
          <div className="space-y-3">
            {visibleIssues.map(issue => (
              <AtsIssueAccordion
                key={issue.id}
                issue={issue}
                expanded={expandedIssueIds.includes(issue.id)}
                onToggle={() => toggleIssue(issue.id)}
              />
            ))}
            {activeStage.issues.length > 3 && (
              <button
                type="button"
                onClick={() => setShowAllIssues(current => !current)}
                className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-600 transition hover:border-gray-300 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:text-white dark:focus-visible:ring-offset-gray-950"
              >
                {showAllIssues ? 'Show top 3' : `Show all ${activeStage.issues.length} findings`}
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
            {activeStage.status === 'needs_ai' || activeStage.status === 'needs_job_description' || activeStage.status === 'not_run' || activeStage.status === 'error'
              ? 'Not run yet. This stage will populate when its engine is enabled.'
              : 'No issues found in this stage.'}
          </div>
        )}

        <div className="rounded-2xl border border-cyan-200 bg-cyan-50/60 p-4 text-[11px] leading-relaxed text-cyan-900 dark:border-cyan-900/40 dark:bg-cyan-950/20 dark:text-cyan-100">
          {result.disclaimer}
        </div>
      </div>
    </section>
  );
}
