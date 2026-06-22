import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildAiPrompt } from './promptBuilder.js';
import { checkQuota, incrementQuota, isQuotaStoreConfigured, QuotaError } from './quota.js';
import type { AiRewriteStyle, AiTask } from './types.js';

type ApiRequest = IncomingMessage & { body?: unknown };
type ApiResponse = ServerResponse & {
  status: (statusCode: number) => ApiResponse;
  json: (body: unknown) => void;
};
type ServerProvider = 'groq' | 'cerebras' | 'gemini';
type Tone = 'professional' | 'simple' | 'student' | 'impactful';

type ActionRequest = {
  task: AiTask;
  input: string;
  tone?: Tone;
  rewriteStyle?: AiRewriteStyle;
  maxOutputTokens?: number;
};

const FREE_AI_LIMITS = {
  maxInputChars: 12000,
  maxOutputTokens: 1200,
} as const;

const SERVER_AI_ROUTES: Record<AiTask, ServerProvider[]> = {
  grammar_fix: ['groq', 'cerebras', 'gemini'],
  rewrite_bullet: ['groq', 'cerebras', 'gemini'],
  improve_summary: ['groq', 'cerebras', 'gemini'],
  suggest_wording: ['groq', 'cerebras', 'gemini'],
  import_text_resume: ['gemini', 'cerebras'],
};

const TASKS = new Set<AiTask>(Object.keys(SERVER_AI_ROUTES) as AiTask[]);
const TONES = new Set<Tone>(['professional', 'simple', 'student', 'impactful']);
const REWRITE_STYLES = new Set<AiRewriteStyle>([
  'professional', 'ats_friendly', 'shorter', 'longer', 'student_friendly',
  'impactful', 'stronger_verbs', 'star_format', 'explain_impact', 'grammar_fix',
]);

class SafeApiError extends Error {
  constructor(public readonly statusCode: number, public readonly code: string, message: string) {
    super(message);
  }
}

const sendError = (response: ApiResponse, statusCode: number, code: string, message: string) =>
  response.status(statusCode).json({ ok: false, code, message });

const parseBody = (body: unknown): unknown => {
  if (typeof body !== 'string') return body;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
};

const validateRequest = (value: unknown): ActionRequest => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SafeApiError(400, 'INVALID_REQUEST', 'The AI request is invalid.');
  }
  const candidate = value as Record<string, unknown>;
  if (!TASKS.has(candidate.task as AiTask)) {
    throw new SafeApiError(400, 'INVALID_TASK', 'This AI action is not supported.');
  }
  const input = typeof candidate.input === 'string' ? candidate.input.trim() : '';
  if (!input) throw new SafeApiError(400, 'EMPTY_INPUT', 'Add some text before using AI help.');
  if (input.length > FREE_AI_LIMITS.maxInputChars) {
    throw new SafeApiError(413, 'INPUT_TOO_LONG', 'This text is too long for one AI action.');
  }
  const tone = TONES.has(candidate.tone as Tone) ? candidate.tone as Tone : undefined;
  const rewriteStyle = REWRITE_STYLES.has(candidate.rewriteStyle as AiRewriteStyle)
    ? candidate.rewriteStyle as AiRewriteStyle
    : undefined;
  const requestedTokens = typeof candidate.maxOutputTokens === 'number' && Number.isFinite(candidate.maxOutputTokens)
    ? Math.floor(candidate.maxOutputTokens)
    : FREE_AI_LIMITS.maxOutputTokens;
  return {
    task: candidate.task as AiTask,
    input,
    tone,
    rewriteStyle,
    maxOutputTokens: Math.max(1, Math.min(requestedTokens, FREE_AI_LIMITS.maxOutputTokens)),
  };
};

const getProviderKey = (provider: ServerProvider) => {
  if (provider === 'groq') return process.env.GROQ_API_KEY?.trim() || '';
  if (provider === 'cerebras') return process.env.CEREBRAS_API_KEY?.trim() || '';
  return process.env.GEMINI_API_KEY?.trim() || '';
};

const sanitizeText = (text: string) => text
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  .trim()
  .slice(0, 16000);

const fetchWithTimeout = async (url: string, init: RequestInit) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const callOpenAiCompatible = async (
  provider: 'groq' | 'cerebras',
  key: string,
  systemPrompt: string,
  userPrompt: string,
  maxOutputTokens: number
) => {
  const endpoint = provider === 'groq'
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : 'https://api.cerebras.ai/v1/chat/completions';
  const model = provider === 'groq' ? 'llama-3.1-8b-instant' : 'gpt-oss-120b';
  const response = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      ...(provider === 'groq' ? { max_tokens: maxOutputTokens } : { max_completion_tokens: maxOutputTokens }),
    }),
  });
  if (!response.ok) throw new Error('Provider unavailable.');
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const text = sanitizeText(String(data.choices?.[0]?.message?.content || ''));
  if (!text) throw new Error('Provider unavailable.');
  return text;
};

const callGemini = async (key: string, systemPrompt: string, userPrompt: string, maxOutputTokens: number) => {
  const response = await fetchWithTimeout(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens },
      }),
    }
  );
  if (!response.ok) throw new Error('Provider unavailable.');
  const data = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = sanitizeText(data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || '');
  if (!text) throw new Error('Provider unavailable.');
  return text;
};

const callProvider = async (provider: ServerProvider, request: ActionRequest) => {
  const key = getProviderKey(provider);
  if (!key) return null;
  const prompt = buildAiPrompt(request);
  try {
    const text = provider === 'gemini'
      ? await callGemini(key, prompt.system, prompt.user, request.maxOutputTokens || FREE_AI_LIMITS.maxOutputTokens)
      : await callOpenAiCompatible(provider, key, prompt.system, prompt.user, request.maxOutputTokens || FREE_AI_LIMITS.maxOutputTokens);
    return { provider, text };
  } catch {
    return null;
  }
};

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'private, no-store');
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendError(response, 405, 'METHOD_NOT_ALLOWED', 'Use POST for this AI action.');
  }

  try {
    if (process.env.AI_FREE_BETA_ENABLED !== 'true') {
      throw new SafeApiError(503, 'FREE_BETA_DISABLED', 'Forge Free AI is unavailable. Use BYOK or continue manually.');
    }
    if (!isQuotaStoreConfigured()) {
      throw new SafeApiError(503, 'QUOTA_STORE_MISSING', 'Free AI quota store is not configured.');
    }

    const action = validateRequest(parseBody(request.body));
    if (!SERVER_AI_ROUTES[action.task].some(provider => Boolean(getProviderKey(provider)))) {
      throw new SafeApiError(503, 'MISSING_PROVIDER_KEYS', 'Forge Free AI provider setup is incomplete. Use BYOK or continue manually.');
    }

    const isImport = action.task === 'import_text_resume';
    const reservation = await checkQuota(request, isImport);

    let result: { provider: ServerProvider; text: string } | null = null;
    for (const provider of SERVER_AI_ROUTES[action.task]) {
      result = await callProvider(provider, action);
      if (result) break;
    }
    if (!result) {
      throw new SafeApiError(503, 'PROVIDERS_BUSY', 'Forge Free AI is busy right now. Try BYOK or continue manually.');
    }

    const quota = await incrementQuota(reservation.identity, reservation.window, isImport);
    return response.status(200).json({
      ok: true,
      text: result.text,
      actionsRemaining: quota.actionsRemaining,
      provider: result.provider,
      freeBeta: true,
    });
  } catch (error) {
    if (error instanceof SafeApiError) {
      return sendError(response, error.statusCode, error.code, error.message);
    }
    if (error instanceof QuotaError) {
      const quotaErrors: Record<QuotaError['code'], { status: number; message: string }> = {
        COOLDOWN: { status: 429, message: 'Please wait 10 seconds before using Forge Free AI again.' },
        DEVICE_LIMIT: { status: 429, message: 'Free AI limit reached for this device. Use BYOK or try again after reset.' },
        IP_LIMIT: { status: 429, message: 'Free AI limit reached for this network. Use BYOK or try again after reset.' },
        IMPORT_LIMIT: { status: 429, message: 'Free pasted-text import limit reached. Use BYOK or try again after reset.' },
        GLOBAL_LIMIT: { status: 503, message: 'Forge Free AI is busy right now. Try BYOK or continue manually.' },
        QUOTA_STORE_UNAVAILABLE: { status: 503, message: 'Free AI quota store is not configured.' },
      };
      const detail = quotaErrors[error.code];
      return sendError(response, detail.status, error.code, detail.message);
    }
    return sendError(response, 503, 'FREE_AI_UNAVAILABLE', 'Forge Free AI is unavailable. Use BYOK or continue manually.');
  }
}
