import { AiGenerateInput, AiGenerateResult, AiProviderId } from '../types';

export interface AiProviderAdapter {
  id: AiProviderId;
  label: string;
  defaultModels: string[];
  testConnection(input: { apiKey: string; model?: string }): Promise<{ ok: boolean; models?: string[]; message?: string }>;
  listModels(input: { apiKey: string }): Promise<string[]>;
  generate(input: AiGenerateInput & { systemPrompt: string; userPrompt: string }): Promise<AiGenerateResult>;
}

const SAFE_ERROR_MESSAGE = 'AI request failed. Check your key, provider, or model and try again.';
const CONNECTION_ERROR_MESSAGE = 'Connection failed. Check your key and try again.';
const MODEL_ERROR_MESSAGE = 'This model failed. Pick another model or enter a custom model ID.';

type ProviderFailureCode = 'connection' | 'model' | 'request';

class ProviderFailure extends Error {
  constructor(public readonly code: ProviderFailureCode) {
    super(code === 'connection' ? CONNECTION_ERROR_MESSAGE : code === 'model' ? MODEL_ERROR_MESSAGE : SAFE_ERROR_MESSAGE);
  }
}

const sanitizeProviderError = (code: ProviderFailureCode = 'request') => new ProviderFailure(code);

const failureForStatus = (status: number) =>
  sanitizeProviderError(
    status === 401 || status === 403
      ? 'connection'
      : status === 400 || status === 404 || status === 422
        ? 'model'
        : 'request'
  );

const safeFailureMessage = (error: unknown) =>
  error instanceof ProviderFailure ? error.message : SAFE_ERROR_MESSAGE;

const safeJson = async (response: Response) => {
  try {
    return await response.json();
  } catch {
    throw sanitizeProviderError();
  }
};

const normalizeModelList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => {
      if (!item || typeof item !== 'object') return '';
      const id = 'id' in item ? String((item as { id?: unknown }).id || '') : '';
      const name = 'name' in item ? String((item as { name?: unknown }).name || '') : '';
      return id || name.replace(/^models\//, '');
    })
    .filter(Boolean);
};

const geminiAdapter: AiProviderAdapter = {
  id: 'gemini',
  label: 'Gemini',
  defaultModels: ['gemini-2.5-flash', 'gemini-2.5-flash-lite'],
  async listModels({ apiKey }) {
    try {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=100', {
        headers: { 'x-goog-api-key': apiKey },
      });
      if (!response.ok) {
        throw sanitizeProviderError([400, 401, 403].includes(response.status) ? 'connection' : 'request');
      }
      const data = await safeJson(response) as { models?: Array<{ name?: string; supportedGenerationMethods?: string[] }> };
      return (data.models || [])
        .filter(model => (model.supportedGenerationMethods || []).includes('generateContent'))
        .map(model => String(model.name || '').replace(/^models\//, ''))
        .filter(Boolean);
    } catch (error) {
      if (error instanceof ProviderFailure && error.code === 'connection') throw error;
      return [...geminiAdapter.defaultModels];
    }
  },
  async testConnection({ apiKey, model }) {
    try {
      const models = await geminiAdapter.listModels({ apiKey });
      const resolvedModel = model || models[0] || geminiAdapter.defaultModels[0];
      await geminiAdapter.generate({
        apiKey,
        provider: 'gemini',
        model: resolvedModel,
        task: 'suggest_wording',
        input: 'ok',
        systemPrompt: 'Reply with the single word OK.',
        userPrompt: 'OK',
        maxOutputTokens: 16,
      });
      return { ok: true, models };
    } catch (error) {
      return { ok: false, models: [...geminiAdapter.defaultModels], message: safeFailureMessage(error) };
    }
  },
  async generate(input) {
    try {
      const modelId = input.model.replace(/^models\//, '').trim();
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': input.apiKey,
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `${input.systemPrompt}\n\n${input.userPrompt}` }],
          }],
          generationConfig: {
            temperature: input.task === 'import_text_resume' ? 0 : 0.3,
            maxOutputTokens: Math.min(input.maxOutputTokens || 1200, 1200),
            responseMimeType: input.task === 'import_text_resume' ? 'application/json' : 'text/plain',
          },
        }),
      });
      if (!response.ok) throw failureForStatus(response.status);
      const data = await safeJson(response) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const text = data.candidates?.[0]?.content?.parts?.map(part => String(part.text || '')).join('').trim() || '';
      if (!text) throw sanitizeProviderError();
      return { text };
    } catch (error) {
      throw error instanceof ProviderFailure ? error : sanitizeProviderError();
    }
  },
};

const createOpenAiCompatibleAdapter = (
  id: 'groq' | 'cerebras' | 'openrouter',
  label: string,
  endpointBase: string,
  defaultModels: string[]
): AiProviderAdapter => ({
  id,
  label,
  defaultModels,
  async listModels({ apiKey }) {
    try {
      const response = await fetch(`${endpointBase}/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw sanitizeProviderError([400, 401, 403].includes(response.status) ? 'connection' : 'request');
      }
      const data = await safeJson(response) as { data?: unknown[] };
      const models = normalizeModelList(data.data);
      return models.length ? models : [...defaultModels];
    } catch (error) {
      if (error instanceof ProviderFailure && error.code === 'connection') throw error;
      return [...defaultModels];
    }
  },
  async testConnection({ apiKey, model }) {
    try {
      const models = await this.listModels({ apiKey });
      const resolvedModel = model || models[0] || defaultModels[0];
      await this.generate({
        apiKey,
        provider: id,
        model: resolvedModel,
        task: 'suggest_wording',
        input: 'ok',
        systemPrompt: 'Reply with the single word OK.',
        userPrompt: 'OK',
        maxOutputTokens: 64,
      });
      return { ok: true, models };
    } catch (error) {
      return { ok: false, models: [...defaultModels], message: safeFailureMessage(error) };
    }
  },
  async generate(input) {
    try {
      const response = await fetch(`${endpointBase}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
          'Content-Type': 'application/json',
          ...(id === 'openrouter' && typeof window !== 'undefined' ? {
            'HTTP-Referer': window.location.origin,
            'X-Title': 'Forge Resume',
          } : {}),
        },
        body: JSON.stringify({
          model: input.model,
          messages: [
            { role: 'system', content: input.systemPrompt },
            { role: 'user', content: input.userPrompt },
          ],
          temperature: input.task === 'import_text_resume' ? 0 : 0.3,
          ...(id === 'openrouter' || id === 'groq'
            ? { max_tokens: Math.min(input.maxOutputTokens || 1200, 1200) }
            : { max_completion_tokens: Math.min(input.maxOutputTokens || 1200, 1200) }),
        }),
      });
      if (!response.ok) throw failureForStatus(response.status);
      const data = await safeJson(response) as { choices?: Array<{ message?: { content?: string } }> };
      const text = String(data.choices?.[0]?.message?.content || '').trim();
      if (!text) throw sanitizeProviderError();
      return { text };
    } catch (error) {
      throw error instanceof ProviderFailure ? error : sanitizeProviderError();
    }
  },
});

const groqAdapter = createOpenAiCompatibleAdapter(
  'groq',
  'Groq',
  'https://api.groq.com/openai/v1',
  ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'qwen/qwen3-32b']
);

const cerebrasAdapter = createOpenAiCompatibleAdapter(
  'cerebras',
  'Cerebras',
  'https://api.cerebras.ai/v1',
  ['gpt-oss-120b', 'zai-glm-4.7']
);

const openRouterAdapter = createOpenAiCompatibleAdapter(
  'openrouter',
  'OpenRouter',
  'https://openrouter.ai/api/v1',
  ['openai/gpt-4o-mini', 'google/gemini-2.5-flash', 'anthropic/claude-3.5-haiku']
);

export const AI_PROVIDER_ADAPTERS: Record<AiProviderId, AiProviderAdapter> = {
  gemini: geminiAdapter,
  groq: groqAdapter,
  cerebras: cerebrasAdapter,
  openrouter: openRouterAdapter,
};

export const AI_PROVIDER_OPTIONS = Object.values(AI_PROVIDER_ADAPTERS).map(adapter => ({
  id: adapter.id,
  label: adapter.label,
  defaultModels: adapter.defaultModels,
}));

export const AI_SAFE_ERROR_MESSAGE = SAFE_ERROR_MESSAGE;
export const AI_CONNECTION_ERROR_MESSAGE = CONNECTION_ERROR_MESSAGE;
export const AI_MODEL_ERROR_MESSAGE = MODEL_ERROR_MESSAGE;
