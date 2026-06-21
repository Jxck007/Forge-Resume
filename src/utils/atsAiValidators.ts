import { AtsIssue, AtsSuggestionType } from '../types';

type Validator<T> = (value: unknown) => T | null;

export interface AiJsonSchema<T> {
  name: string;
  validate: Validator<T>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const asString = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const asNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const asStringArray = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean) : [];

const asIssueArray = (value: unknown): AtsIssue[] =>
  Array.isArray(value) ? value.filter(isRecord).map((item, index) => ({
    id: asString(item.id) || `ai-issue-${index}`,
    title: asString(item.title) || 'AI issue',
    severity: item.severity === 'Critical' || item.severity === 'High' || item.severity === 'Medium' || item.severity === 'Low' ? item.severity : 'Low',
    group: item.group === 'Content' || item.group === 'Structure' || item.group === 'ATS Essentials' || item.group === 'Formatting' || item.group === 'Spelling' || item.group === 'Grammar' || item.group === 'Layout' || item.group === 'Responsiveness' ? item.group : 'Content',
    category: asString(item.category) || 'ai',
    affectedSection: asString(item.affectedSection) || 'General',
    explanation: asString(item.explanation),
    suggestedFix: asString(item.suggestedFix),
    scoreImpact: asNumber(item.scoreImpact) || 0,
    evidence: asString(item.evidence) || undefined,
  })) : [];

export interface AtsKeywordsMatchPayload {
  alignmentScore: number;
  matchVelocityIndex: number;
  matchedSkills: string[];
  partialMatches: Array<{
    requiredSkill: string;
    candidateEvidence: string;
    reason: string;
  }>;
  missingCriticalSkills: string[];
  missingNiceToHaveSkills: string[];
  recommendation: string;
  issues: AtsIssue[];
}

export interface AtsContentDiagnoserPayload {
  contentScore: number;
  weakVerbsDetected: string[];
  buzzwordFlags: Array<{
    word: string;
    reason: string;
  }>;
  flaggedBullets: Array<{
    section: string;
    original: string;
    reason: string;
    suggestedRewrite: string;
    placeholderUsed: boolean;
  }>;
  issues: AtsIssue[];
}

export interface AtsXyzRewritePayload {
  original: string;
  rewrittenXYZ: string;
  placeholderUsed: boolean;
  notes: string;
}

export interface AtsInterviewQuestionPayload {
  question: string;
  basedOn: {
    section: string;
    evidence: string;
  };
  difficulty: 'Easy' | 'Medium' | 'Hard';
  whatGoodAnswerShouldMention: string[];
  followUpQuestion: string;
}

export interface AtsInterviewAnswerFeedbackPayload {
  answerScore: number;
  strengths: string[];
  weaknesses: string[];
  improvedAnswer: string;
  followUpQuestion: string;
}

export interface AtsIntelligencePayload {
  jobMatch: {
    score: number;
    matchedKeywords: string[];
    missingKeywords: string[];
    partialMatches: Array<{ keyword: string; evidence: string; reason: string }>;
    seniorityFit: string;
    roleFitSummary: string;
  };
  contentUpgrade: {
    summarySuggestions: string[];
    bulletSuggestions: string[];
    projectSuggestions: string[];
    skillSuggestions: string[];
    grammarIssues: string[];
    spellingIssues: string[];
  };
  suggestions: Array<{
    id: string;
    type: AtsSuggestionType;
    target: { sectionId: string; itemId?: string; fieldPath: string };
    originalValue: string;
    suggestedValue: string;
    reason: string;
    evidence: string;
    confidence: number;
    requiresUserConfirmation: boolean;
    truthWarning: string;
  }>;
  warnings: string[];
}

const SUGGESTION_TYPES = new Set<AtsSuggestionType>([
  'add_keyword', 'rewrite_summary', 'rewrite_bullet', 'improve_project', 'add_metric_placeholder',
  'fix_section_order', 'change_link_mode', 'add_learning_target',
]);
const ALLOWED_SUGGESTION_ROOTS = new Set([
  'summary', 'skills', 'projects', 'experience', 'additionalDetails', 'learningTargets', 'sectionSettings', 'linkSettings',
]);

export const atsIntelligenceSchema: AiJsonSchema<AtsIntelligencePayload> = {
  name: 'atsIntelligence',
  validate(value) {
    if (!isRecord(value) || !isRecord(value.jobMatch) || !isRecord(value.contentUpgrade)) return null;
    if (
      !Array.isArray(value.jobMatch.matchedKeywords) ||
      !Array.isArray(value.jobMatch.missingKeywords) ||
      !Array.isArray(value.jobMatch.partialMatches) ||
      !Array.isArray(value.contentUpgrade.summarySuggestions) ||
      !Array.isArray(value.contentUpgrade.bulletSuggestions) ||
      !Array.isArray(value.contentUpgrade.projectSuggestions) ||
      !Array.isArray(value.contentUpgrade.skillSuggestions) ||
      !Array.isArray(value.contentUpgrade.grammarIssues) ||
      !Array.isArray(value.contentUpgrade.spellingIssues) ||
      !Array.isArray(value.suggestions) ||
      !Array.isArray(value.warnings)
    ) return null;
    const score = asNumber(value.jobMatch.score);
    if (score === null || !asString(value.jobMatch.seniorityFit) || !asString(value.jobMatch.roleFitSummary)) return null;

    const partialMatches = Array.isArray(value.jobMatch.partialMatches)
      ? value.jobMatch.partialMatches.filter(isRecord).map(item => ({
        keyword: asString(item.keyword),
        evidence: asString(item.evidence),
        reason: asString(item.reason),
      })).filter(item => item.keyword && item.reason)
      : [];
    const suggestions = Array.isArray(value.suggestions)
      ? value.suggestions.filter(isRecord).map(item => {
        if (!isRecord(item.target) || !SUGGESTION_TYPES.has(item.type as AtsSuggestionType)) return null;
        const fieldPath = asString(item.target.fieldPath);
        const sectionId = asString(item.target.sectionId);
        const root = fieldPath.split('.')[0];
        if (!fieldPath || !ALLOWED_SUGGESTION_ROOTS.has(root)) return null;
        const id = asString(item.id);
        const suggestedValue = asString(item.suggestedValue);
        const confidenceValue = asNumber(item.confidence);
        if (!id || !sectionId || !suggestedValue || !asString(item.reason) || !asString(item.truthWarning) || confidenceValue === null) return null;
        return {
          id,
          type: item.type as AtsSuggestionType,
          target: {
            sectionId,
            itemId: asString(item.target.itemId) || undefined,
            fieldPath,
          },
          originalValue: asString(item.originalValue),
          suggestedValue,
          reason: asString(item.reason),
          evidence: asString(item.evidence),
          confidence: Math.max(0, Math.min(1, confidenceValue > 1 ? confidenceValue / 100 : confidenceValue)),
          requiresUserConfirmation: Boolean(item.requiresUserConfirmation),
          truthWarning: asString(item.truthWarning),
        };
      }).filter((item): item is NonNullable<typeof item> => item !== null)
      : [];

    return {
      jobMatch: {
        score: Math.max(0, Math.min(100, score)),
        matchedKeywords: asStringArray(value.jobMatch.matchedKeywords),
        missingKeywords: asStringArray(value.jobMatch.missingKeywords),
        partialMatches,
        seniorityFit: asString(value.jobMatch.seniorityFit),
        roleFitSummary: asString(value.jobMatch.roleFitSummary),
      },
      contentUpgrade: {
        summarySuggestions: asStringArray(value.contentUpgrade.summarySuggestions),
        bulletSuggestions: asStringArray(value.contentUpgrade.bulletSuggestions),
        projectSuggestions: asStringArray(value.contentUpgrade.projectSuggestions),
        skillSuggestions: asStringArray(value.contentUpgrade.skillSuggestions),
        grammarIssues: asStringArray(value.contentUpgrade.grammarIssues),
        spellingIssues: asStringArray(value.contentUpgrade.spellingIssues),
      },
      suggestions,
      warnings: asStringArray(value.warnings),
    };
  },
};

export const keywordsMatchSchema: AiJsonSchema<AtsKeywordsMatchPayload> = {
  name: 'keywordsMatch',
  validate(value) {
    if (!isRecord(value)) return null;
    const alignmentScore = asNumber(value.alignmentScore);
    const matchVelocityIndex = asNumber(value.matchVelocityIndex);
    if (alignmentScore === null || matchVelocityIndex === null) return null;
    const partialMatches = Array.isArray(value.partialMatches)
      ? value.partialMatches.filter(isRecord).map(item => ({
        requiredSkill: asString(item.requiredSkill),
        candidateEvidence: asString(item.candidateEvidence),
        reason: asString(item.reason),
      })).filter(item => item.requiredSkill && item.reason)
      : [];
    return {
      alignmentScore,
      matchVelocityIndex,
      matchedSkills: asStringArray(value.matchedSkills),
      partialMatches,
      missingCriticalSkills: asStringArray(value.missingCriticalSkills),
      missingNiceToHaveSkills: asStringArray(value.missingNiceToHaveSkills),
      recommendation: asString(value.recommendation),
      issues: asIssueArray(value.issues),
    };
  },
};

export const contentDiagnoserSchema: AiJsonSchema<AtsContentDiagnoserPayload> = {
  name: 'contentDiagnoser',
  validate(value) {
    if (!isRecord(value)) return null;
    const contentScore = asNumber(value.contentScore);
    if (contentScore === null) return null;
    const buzzwordFlags = Array.isArray(value.buzzwordFlags)
      ? value.buzzwordFlags.filter(isRecord).map(item => ({
        word: asString(item.word),
        reason: asString(item.reason),
      })).filter(item => item.word && item.reason)
      : [];
    const flaggedBullets = Array.isArray(value.flaggedBullets)
      ? value.flaggedBullets.filter(isRecord).map(item => ({
        section: asString(item.section),
        original: asString(item.original),
        reason: asString(item.reason),
        suggestedRewrite: asString(item.suggestedRewrite),
        placeholderUsed: Boolean(item.placeholderUsed),
      })).filter(item => item.section && item.original && item.reason)
      : [];
    return {
      contentScore,
      weakVerbsDetected: asStringArray(value.weakVerbsDetected),
      buzzwordFlags,
      flaggedBullets,
      issues: asIssueArray(value.issues),
    };
  },
};

export const xyzRewriteSchema: AiJsonSchema<AtsXyzRewritePayload> = {
  name: 'xyzRewrite',
  validate(value) {
    if (!isRecord(value)) return null;
    const original = asString(value.original);
    const rewrittenXYZ = asString(value.rewrittenXYZ);
    if (!original || !rewrittenXYZ) return null;
    return {
      original,
      rewrittenXYZ,
      placeholderUsed: Boolean(value.placeholderUsed),
      notes: asString(value.notes),
    };
  },
};

export const interviewQuestionSchema: AiJsonSchema<AtsInterviewQuestionPayload> = {
  name: 'interviewQuestion',
  validate(value) {
    if (!isRecord(value) || !isRecord(value.basedOn)) return null;
    const question = asString(value.question);
    const difficulty = value.difficulty === 'Easy' || value.difficulty === 'Medium' || value.difficulty === 'Hard'
      ? value.difficulty
      : null;
    if (!question || !difficulty) return null;
    return {
      question,
      basedOn: {
        section: asString(value.basedOn.section),
        evidence: asString(value.basedOn.evidence),
      },
      difficulty,
      whatGoodAnswerShouldMention: asStringArray(value.whatGoodAnswerShouldMention),
      followUpQuestion: asString(value.followUpQuestion),
    };
  },
};

export const interviewAnswerFeedbackSchema: AiJsonSchema<AtsInterviewAnswerFeedbackPayload> = {
  name: 'interviewAnswerFeedback',
  validate(value) {
    if (!isRecord(value)) return null;
    const answerScore = asNumber(value.answerScore);
    if (answerScore === null) return null;
    return {
      answerScore,
      strengths: asStringArray(value.strengths),
      weaknesses: asStringArray(value.weaknesses),
      improvedAnswer: asString(value.improvedAnswer),
      followUpQuestion: asString(value.followUpQuestion),
    };
  },
};
