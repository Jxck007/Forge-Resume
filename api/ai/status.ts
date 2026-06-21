import type { IncomingMessage, ServerResponse } from 'node:http';
import { FREE_AI_QUOTA, getQuotaStatus, isQuotaStoreConfigured } from './quota.js';

type ApiRequest = IncomingMessage;
type ApiResponse = ServerResponse & {
  status: (statusCode: number) => ApiResponse;
  json: (body: unknown) => void;
};

type StatusReason = 'ok' | 'missing_provider_keys' | 'quota_store_missing' | 'env_disabled';

const getProviderStatus = () => ({
  groq: Boolean(process.env.GROQ_API_KEY?.trim()),
  cerebras: Boolean(process.env.CEREBRAS_API_KEY?.trim()),
  gemini: Boolean(process.env.GEMINI_API_KEY?.trim()),
});

const getFallbackResetAt = () => {
  const windowMs = FREE_AI_QUOTA.windowHours * 60 * 60 * 1000;
  return new Date((Math.floor(Date.now() / windowMs) + 1) * windowMs).toISOString();
};

const sendStatus = (
  response: ApiResponse,
  input: {
    available: boolean;
    reason: StatusReason;
    used?: number;
    actionsRemaining?: number;
    resetAt?: string;
  }
) => {
  const providers = getProviderStatus();
  response.setHeader('Cache-Control', 'private, no-store');
  return response.status(200).json({
    ok: true,
    signedIn: false,
    freeBetaAvailable: input.available,
    reason: input.reason,
    configured: {
      quotaStore: isQuotaStoreConfigured(),
      ...providers,
      freeBetaEnv: process.env.AI_FREE_BETA_ENABLED === 'true',
    },
    limit: FREE_AI_QUOTA.deviceActions,
    used: input.used || 0,
    actionsRemaining: input.actionsRemaining ?? FREE_AI_QUOTA.deviceActions,
    resetAt: input.resetAt || getFallbackResetAt(),
    windowHours: FREE_AI_QUOTA.windowHours,
  });
};

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED', message: 'Use GET for AI status.' });
  }

  try {
    if (process.env.AI_FREE_BETA_ENABLED !== 'true') {
      return sendStatus(response, { available: false, reason: 'env_disabled' });
    }
    const providers = getProviderStatus();
    if (!providers.groq && !providers.cerebras && !providers.gemini) {
      return sendStatus(response, { available: false, reason: 'missing_provider_keys' });
    }
    if (!isQuotaStoreConfigured()) {
      return sendStatus(response, { available: false, reason: 'quota_store_missing' });
    }

    const quota = await getQuotaStatus(request);
    return sendStatus(response, {
      available: true,
      reason: 'ok',
      used: quota.used,
      actionsRemaining: quota.actionsRemaining,
      resetAt: quota.resetAt,
    });
  } catch {
    return sendStatus(response, { available: false, reason: 'quota_store_missing' });
  }
}
