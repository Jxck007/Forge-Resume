import type {
  AtsSuggestion as LegacyAtsSuggestion,
  ResumePatch as LegacyResumePatch,
} from '../../types';

export type AtsMode = 'local_readability' | 'ai_job_match';

export type AtsStageStatus =
  | 'ready'
  | 'needs_ai'
  | 'needs_job_description'
  | 'not_run'
  | 'error';

export type AtsIssueSeverity = 'critical' | 'high' | 'medium' | 'low';

export type AtsIssueCategory =
  | 'contact'
  | 'sections'
  | 'section_order'
  | 'parseability'
  | 'pdf_text_extraction'
  | 'links'
  | 'page_length'
  | 'layout_safety'
  | 'keyword_match'
  | 'job_match'
  | 'content_quality'
  | 'language_quality'
  | 'impact'
  | 'project_relevance'
  | 'skill_coverage';

export interface AtsIssue {
  id: string;
  title: string;
  severity: AtsIssueSeverity;
  category: AtsIssueCategory;
  affectedSection: string;
  explanation: string;
  suggestedFix: string;
  evidence?: string;
  scoreImpact: number;
}

export interface LocalReadabilityResult {
  mode: 'local_readability';
  label: 'Local Resume Readability';
  status: Extract<AtsStageStatus, 'ready' | 'error'>;
  rating: 'needs_work' | 'fair' | 'good_structure' | 'strong_structure';
  secondaryScore: number;
  confidence: 'low' | 'medium' | 'high';
  issues: AtsIssue[];
  evidence: string[];
  generatedAt: string;
  disclaimer: 'This is a local structure check, not a full ATS scan.';
  warning: 'This local check reviews structure and parseability only. It does not evaluate job fit, keyword relevance, grammar, or content quality without AI.';
}

export interface AiJobMatchResult {
  mode: 'ai_job_match';
  label: 'AI Job Match';
  status: AtsStageStatus;
  score: number | null;
  matchedKeywords: string[];
  missingKeywords: string[];
  partialMatches: Array<{ keyword: string; evidence: string; reason: string }>;
  roleFitSummary: string;
  issues: AtsIssue[];
  generatedAt?: string;
}

// Adapter-first aliases keep the existing approved patch flow usable during migration.
export type AtsSuggestion = LegacyAtsSuggestion;
export type ResumePatch = LegacyResumePatch;

export interface AtsReport {
  schemaVersion: 1;
  resumeId: string;
  mode: AtsMode;
  localReadability: LocalReadabilityResult;
  aiJobMatch: AiJobMatchResult | null;
  suggestions: AtsSuggestion[];
  patches: ResumePatch[];
  generatedAt: string;
}
