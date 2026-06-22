import { UserSettings } from '../types';
import { callAIUnified, cleanJsonOutput, getDefaultModel } from './ai';
import { AiJsonSchema } from '../utils/atsAiValidators';
import { AiPromptBundle } from '../utils/atsAiPrompts';

export const AI_ATS_FALLBACK_MESSAGE = 'AI analysis temporarily unavailable. Structural checks are still available.';

export interface AiProviderConfig {
  provider: UserSettings['aiProvider'];
  model: string;
  apiKeyConfigured: boolean;
}

export interface AiProvider {
  generateJson<T>(prompt: AiPromptBundle, schema: AiJsonSchema<T>): Promise<T>;
}

// Legacy browser-side provider keys are intentionally disabled until a secure boundary exists.
const providerKeyPresent = (_settings: UserSettings) => false;

export const getAiProviderConfig = (settings?: UserSettings | null): AiProviderConfig | null => {
  if (!settings?.aiProvider) return null;
  return {
    provider: settings.aiProvider,
    model: settings.modelId || settings.providerModels?.[settings.aiProvider] || getDefaultModel(settings.aiProvider),
    apiKeyConfigured: providerKeyPresent(settings),
  };
};

export const hasAiProviderConfigured = (settings?: UserSettings | null) =>
  Boolean(settings && getAiProviderConfig(settings)?.apiKeyConfigured);

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs = 20000): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('AI request timed out.')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

export function createAiProvider(settings?: UserSettings | null): AiProvider | null {
  if (!settings || !hasAiProviderConfigured(settings)) return null;

  return {
    async generateJson<T>(prompt: AiPromptBundle, schema: AiJsonSchema<T>): Promise<T> {
      try {
        const raw = await withTimeout(
          callAIUnified(
            {
              ...settings,
              modelId: getAiProviderConfig(settings)?.model || settings.modelId,
              temperature: settings.temperature ?? 0.2,
            },
            prompt.system,
            prompt.user,
            true
          )
        );
        const parsed = JSON.parse(cleanJsonOutput(raw));
        const validated = schema.validate(parsed);
        if (!validated) {
          throw new Error(`AI returned invalid ${schema.name} JSON.`);
        }
        return validated;
      } catch {
        if (import.meta.env.DEV) console.warn('Legacy AI provider JSON generation failed.');
        throw new Error(AI_ATS_FALLBACK_MESSAGE);
      }
    },
  };
}
