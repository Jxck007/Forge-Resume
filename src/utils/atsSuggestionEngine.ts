import { NormalizedResume } from '../schema/resumeSchema';
import { AtsSuggestion, AtsSuggestionType, ResumePatch } from '../types';

const ALLOWED_ROOTS = new Set([
  'summary', 'skills', 'projects', 'experience', 'additionalDetails', 'learningTargets', 'sectionSettings', 'linkSettings',
]);
const BLOCKED_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const pathParts = (path: string) => path.split('.').map(part => part.trim()).filter(Boolean);

const assertSafePath = (path: string) => {
  const parts = pathParts(path);
  if (!parts.length || !ALLOWED_ROOTS.has(parts[0]) || parts.some(part => BLOCKED_SEGMENTS.has(part))) {
    throw new Error('ATS suggestion targeted an unsupported resume field.');
  }
  return parts;
};

const resolveContainer = (root: unknown, parts: string[]) => {
  let current = root as Record<string, unknown> | unknown[];
  for (const part of parts.slice(0, -1)) {
    if (Array.isArray(current)) {
      const item = current.find(candidate =>
        !!candidate && typeof candidate === 'object' && (candidate as { id?: string }).id === part
      );
      if (!item) throw new Error(`ATS patch item "${part}" was not found.`);
      current = item as Record<string, unknown>;
    } else {
      const next = current[part];
      if (!next || typeof next !== 'object') throw new Error(`ATS patch path "${part}" was not found.`);
      current = next as Record<string, unknown> | unknown[];
    }
  }
  return { container: current, key: parts.at(-1)! };
};

const readPath = (root: unknown, path: string): unknown => {
  const parts = assertSafePath(path);
  const { container, key } = resolveContainer(root, parts);
  if (Array.isArray(container)) {
    return container.find(candidate => !!candidate && typeof candidate === 'object' && (candidate as { id?: string }).id === key);
  }
  return container[key];
};

const writePath = (root: unknown, path: string, operation: ResumePatch['operation'], value: unknown) => {
  const parts = assertSafePath(path);
  const { container, key } = resolveContainer(root, parts);
  if (Array.isArray(container)) throw new Error('ATS patches cannot replace an array item directly.');

  if (operation === 'append') {
    const current = container[key];
    if (Array.isArray(current)) container[key] = [...current, value];
    else if (typeof current === 'string') container[key] = [current, String(value)].filter(Boolean).join('\n');
    else throw new Error('ATS append operation requires a list or text field.');
    return;
  }
  container[key] = clone(value);
};

export function createSuggestionFromAtsFinding(input: {
  id?: string;
  type: AtsSuggestionType;
  sectionId: string;
  itemId?: string;
  fieldPath: string;
  originalValue?: unknown;
  suggestedValue: unknown;
  reason: string;
  evidence?: string;
  confidence?: number;
  requiresUserConfirmation?: boolean;
  truthWarning?: string;
}): AtsSuggestion {
  const confidence = Math.max(0, Math.min(1, input.confidence ?? 0));
  return {
    id: input.id || `ats-suggestion-${Math.random().toString(36).slice(2, 10)}`,
    type: input.type,
    target: { sectionId: input.sectionId, itemId: input.itemId, fieldPath: input.fieldPath },
    originalValue: input.originalValue ?? '',
    suggestedValue: input.suggestedValue,
    reason: input.reason,
    evidence: input.evidence || '',
    confidence,
    requiresUserConfirmation: input.requiresUserConfirmation ?? confidence < 0.8,
    truthWarning: input.truthWarning || 'Apply only if this statement is truthful and supported by your experience.',
    status: 'pending',
  };
}

export function createResumePatch(
  resume: NormalizedResume,
  suggestion: AtsSuggestion,
  editedValue?: unknown
): ResumePatch {
  const path = suggestion.type === 'add_learning_target' ? 'learningTargets' : suggestion.target.fieldPath;
  const operation: ResumePatch['operation'] = suggestion.type === 'add_keyword' || suggestion.type === 'add_learning_target'
    ? 'append'
    : suggestion.type === 'fix_section_order' ? 'reorder' : 'replace';
  let value = editedValue ?? suggestion.suggestedValue;
  if (suggestion.type === 'rewrite_bullet') {
    const bullets = readPath(resume, path);
    if (!Array.isArray(bullets)) throw new Error('The target experience bullets are unavailable.');
    const originalIndex = bullets.findIndex(bullet => String(bullet).trim() === String(suggestion.originalValue).trim());
    if (originalIndex < 0) throw new Error('The original bullet changed. Run ATS again before applying this rewrite.');
    value = bullets.map((bullet, index) => index === originalIndex ? value : bullet);
  }
  return {
    id: `resume-patch-${Math.random().toString(36).slice(2, 10)}`,
    suggestionId: suggestion.id,
    operation,
    path,
    value,
    previousValue: clone(readPath(resume, path)),
  };
}

export const previewResumePatch = (resume: NormalizedResume, patch: ResumePatch): NormalizedResume => {
  const next = clone(resume);
  writePath(next, patch.path, patch.operation, patch.value);
  next.updatedAt = new Date().toISOString();
  return next;
};

export const applyResumePatch = previewResumePatch;

export const undoResumePatch = (resume: NormalizedResume, patch: ResumePatch): NormalizedResume => {
  const next = clone(resume);
  writePath(next, patch.path, 'set', patch.previousValue);
  next.updatedAt = new Date().toISOString();
  return next;
};

export const markSuggestionIgnored = (suggestion: AtsSuggestion): AtsSuggestion => ({ ...suggestion, status: 'ignored' });

export type KeywordEvidenceLevel = 'evidence_found' | 'possible_unconfirmed' | 'no_evidence';

export const classifyKeywordEvidence = (suggestion: AtsSuggestion): KeywordEvidenceLevel => {
  if (suggestion.type !== 'add_keyword') return 'evidence_found';
  if (!suggestion.evidence.trim()) return 'no_evidence';
  return suggestion.confidence >= 0.75 && !suggestion.requiresUserConfirmation
    ? 'evidence_found'
    : 'possible_unconfirmed';
};

export const markSuggestionNotTrue = (suggestion: AtsSuggestion): AtsSuggestion => ({ ...suggestion, status: 'not_true' });
