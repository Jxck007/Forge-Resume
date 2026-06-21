export type AiMode = 'local' | 'free' | 'byok';

export type AiProviderId = 'gemini' | 'groq' | 'cerebras' | 'openrouter';
export type FreeAiStatusReason = 'guest' | 'env_disabled' | 'firestore_disabled' | 'missing_provider_keys' | 'admin_not_configured' | 'firestore_error' | 'server_error' | 'ok';

export type AiRewriteStyle =
  | 'professional'
  | 'ats_friendly'
  | 'shorter'
  | 'longer'
  | 'student_friendly'
  | 'impactful'
  | 'stronger_verbs'
  | 'star_format'
  | 'explain_impact'
  | 'grammar_fix';

export type AiTask =
  | 'improve_summary'
  | 'rewrite_bullet'
  | 'grammar_fix'
  | 'suggest_wording'
  | 'import_text_resume';

export interface AiSessionState {
  mode: AiMode;
  provider: AiProviderId | null;
  selectedModel: string | null;
  customModelId: string;
  isConnected: boolean;
  isTesting: boolean;
  lastError: string | null;
  freeActionsRemaining: number | null;
  freeProvider: 'groq' | 'cerebras' | 'gemini' | null;
  freeBetaAvailable: boolean | null;
  freeStatusReason: FreeAiStatusReason | null;
  freeStatusLoading: boolean;
  freeResetAt: string | null;
}

export interface AiGenerateInput {
  apiKey: string;
  provider: AiProviderId;
  model: string;
  task: AiTask;
  input: string;
  tone?: 'professional' | 'simple' | 'student' | 'impactful';
  rewriteStyle?: AiRewriteStyle;
  maxOutputTokens?: number;
}

export interface AiGenerateResult {
  text: string;
  actionsRemaining?: number;
  provider?: AiProviderId | 'forge-free';
}

export interface AiSuggestion {
  id: string;
  task: AiTask;
  originalText: string;
  suggestedText: string;
  targetLabel?: string;
}
