import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHash } from 'crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { buildAiPrompt } from './promptBuilder.js';
import type { AiRewriteStyle, AiTask } from './types.js';
import {
  getAdminAuth,
  getAdminDb,
  isFirebaseAdminConfigured,
  isFirebaseAdminConfigurationError,
} from '../firebaseAdmin.js';

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
  signedInDailyActions: 25,
  guestDailyActions: 0,
  importTextDaily: 3,
  globalDailyActions: 800,
  cooldownSeconds: 10,
  perIpDailyActions: 60,
  perDeviceDailyActions: 40,
  perIpCooldownSeconds: 5,
  maxInputChars: 12000,
  maxOutputTokens: 1200,
} as const;

const SERVER_AI_ROUTES: Record<AiTask, ServerProvider[]> = {
  grammar_fix: ['groq', 'cerebras'],
  rewrite_bullet: ['groq', 'cerebras'],
  improve_summary: ['cerebras', 'groq', 'gemini'],
  suggest_wording: ['groq', 'cerebras'],
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

const hashValue = (value: string) => {
  const salt = process.env.AI_ABUSE_HASH_SALT?.trim() || '';
  return createHash('sha256').update(`${salt}|${value}`).digest('hex');
};

const getClientFingerprint = (request: ApiRequest) => {
  const forwarded = request.headers['x-forwarded-for'];
  const rawIp = Array.isArray(forwarded)
    ? forwarded[0]?.split(',')[0].trim()
    : typeof forwarded === 'string'
      ? forwarded.split(',')[0].trim()
      : undefined;

  const remoteAddress = request.socket?.remoteAddress;
  return rawIp || remoteAddress || '';
};

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

  if (!isFirebaseAdminConfigured()) {
    return response.status(503).json({ ok: false, reason: 'admin_not_configured' });
  }

  try {
    if (process.env.AI_FREE_BETA_ENABLED !== 'true') {
      throw new SafeApiError(503, 'FREE_BETA_DISABLED', 'Forge Free AI is unavailable. Use BYOK or continue manually.');
    }

    const authorization = request.headers.authorization || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    if (!token) throw new SafeApiError(401, 'AUTH_REQUIRED', 'Sign in to use Forge Free Beta AI.');

    let auth: ReturnType<typeof getAdminAuth>;
    let db: ReturnType<typeof getAdminDb>;
    try {
      auth = getAdminAuth();
      db = getAdminDb();
    } catch (error) {
      if (isFirebaseAdminConfigurationError(error)) {
        throw new SafeApiError(503, 'ADMIN_NOT_CONFIGURED', 'Server AI setup is incomplete.');
      }
      throw new SafeApiError(503, 'SERVER_ERROR', 'Server AI is not configured correctly.');
    }

    let uid = '';
    try {
      uid = (await auth.verifyIdToken(token)).uid;
    } catch {
      throw new SafeApiError(401, 'AUTH_REQUIRED', 'Sign in to use Forge Free Beta AI.');
    }

    const action = validateRequest(parseBody(request.body));
    const configSnapshot = await db.doc('aiSystem/config').get();
    const config = configSnapshot.exists ? configSnapshot.data() : undefined;
    if (config?.freeBetaEnabled === false) {
      throw new SafeApiError(503, 'FREE_BETA_DISABLED', 'Forge Free AI is unavailable. Use BYOK or continue manually.');
    }
    if (!SERVER_AI_ROUTES[action.task].some(provider => Boolean(getProviderKey(provider)))) {
      throw new SafeApiError(503, 'MISSING_PROVIDER_KEYS', 'Forge Free AI provider setup is incomplete. Use BYOK or continue manually.');
    }

    const day = new Date().toISOString().slice(0, 10);
    const userUsageRef = db.doc(`aiUsage/${uid}/days/${day}`);
    const globalUsageRef = db.doc(`aiSystem/daily/${day}`);

    const clientFingerprint = getClientFingerprint(request);
    const ipHash = clientFingerprint ? hashValue(`ip:${clientFingerprint}:${day}`) : null;
    const deviceHeader = typeof request.headers['x-forge-device'] === 'string' ? request.headers['x-forge-device'].trim() : '';
    const deviceHash = deviceHeader ? hashValue(`device:${deviceHeader}:${day}`) : null;
    const ipUsageRef = ipHash ? db.doc(`aiAbuse/ipDaily/${ipHash}`) : null;
    const deviceUsageRef = deviceHash ? db.doc(`aiAbuse/deviceDaily/${deviceHash}`) : null;

    const reservationTime = Timestamp.now();
    let previousLastActionAt: Timestamp | null = null;
    let actionsRemaining = 0;
    const requestFingerprint = hashValue(`${action.task}:${action.input}`);

    await db.runTransaction(async transaction => {
      const docs = [userUsageRef, globalUsageRef];
      if (ipUsageRef) docs.push(ipUsageRef);
      if (deviceUsageRef) docs.push(deviceUsageRef);
      const snapshots = await Promise.all(docs.map(docRef => transaction.get(docRef)));

      const userSnapshot = snapshots[0];
      const globalSnapshot = snapshots[1];
      const ipSnapshot = ipUsageRef ? snapshots[2] : null;
      const deviceSnapshot = deviceUsageRef ? snapshots[docs.length - 1] : null;

      const userUsage = userSnapshot.data() || {};
      const globalUsage = globalSnapshot.data() || {};
      const ipUsage = ipSnapshot?.data() || {};
      const deviceUsage = deviceSnapshot?.data() || {};

      const actionsUsed = Number(userUsage.actionsUsed || 0);
      const importTextUsed = Number(userUsage.importTextUsed || 0);
      const totalActions = Number(globalUsage.totalActions || 0);
      const ipActionsUsed = Number(ipUsage.actionsUsed || 0);
      const deviceActionsUsed = Number(deviceUsage.actionsUsed || 0);
      const userLastActionAt = userUsage.lastActionAt instanceof Timestamp ? userUsage.lastActionAt : null;
      const ipLastActionAt = ipUsage.lastActionAt instanceof Timestamp ? ipUsage.lastActionAt : null;
      const deviceLastActionAt = deviceUsage.lastActionAt instanceof Timestamp ? deviceUsage.lastActionAt : null;
      const previousInputHash = typeof userUsage.lastInputHash === 'string' ? userUsage.lastInputHash : null;

      if (userLastActionAt && reservationTime.toMillis() - userLastActionAt.toMillis() < FREE_AI_LIMITS.cooldownSeconds * 1000) {
        throw new SafeApiError(429, 'COOLDOWN', 'Please wait 10 seconds before using Forge Free AI again.');
      }
      if (ipLastActionAt && reservationTime.toMillis() - ipLastActionAt.toMillis() < FREE_AI_LIMITS.perIpCooldownSeconds * 1000) {
        throw new SafeApiError(429, 'COOLDOWN', 'Please wait before trying again.');
      }
      if (previousInputHash === requestFingerprint && userLastActionAt && reservationTime.toMillis() - userLastActionAt.toMillis() < 30000) {
        throw new SafeApiError(429, 'REPEATED_SPAM', 'Please wait before trying again.');
      }
      if (actionsUsed >= FREE_AI_LIMITS.signedInDailyActions) {
        throw new SafeApiError(429, 'DAILY_LIMIT', 'Daily free AI limit reached. Use BYOK or continue manually.');
      }
      if (action.task === 'import_text_resume' && importTextUsed >= FREE_AI_LIMITS.importTextDaily) {
        throw new SafeApiError(429, 'IMPORT_LIMIT', 'Daily free import limit reached. Use BYOK or continue manually.');
      }
      if (ipHash && ipActionsUsed >= FREE_AI_LIMITS.perIpDailyActions) {
        throw new SafeApiError(429, 'IP_DAILY_LIMIT', 'Daily free AI limit reached. Use BYOK or continue manually.');
      }
      if (deviceHash && deviceActionsUsed >= FREE_AI_LIMITS.perDeviceDailyActions) {
        throw new SafeApiError(429, 'DEVICE_DAILY_LIMIT', 'Daily free AI limit reached. Use BYOK or continue manually.');
      }
      if (totalActions >= FREE_AI_LIMITS.globalDailyActions) {
        throw new SafeApiError(503, 'GLOBAL_LIMIT', 'Forge Free AI is busy right now. Try BYOK or continue manually.');
      }

      const nextActionsUsed = actionsUsed + 1;
      actionsRemaining = Math.max(0, FREE_AI_LIMITS.signedInDailyActions - nextActionsUsed);

      transaction.set(userUsageRef, {
        actionsUsed: nextActionsUsed,
        importTextUsed: importTextUsed + (action.task === 'import_text_resume' ? 1 : 0),
        lastActionAt: reservationTime,
        lastInputHash: requestFingerprint,
        providerUsage: userUsage.providerUsage || {},
      }, { merge: true });

      transaction.set(globalUsageRef, {
        totalActions: totalActions + 1,
        providerUsage: globalUsage.providerUsage || {},
      }, { merge: true });

      if (ipUsageRef) {
        transaction.set(ipUsageRef, {
          actionsUsed: ipActionsUsed + 1,
          lastActionAt: reservationTime,
        }, { merge: true });
      }
      if (deviceUsageRef) {
        transaction.set(deviceUsageRef, {
          actionsUsed: deviceActionsUsed + 1,
          lastActionAt: reservationTime,
        }, { merge: true });
      }

      previousLastActionAt = userLastActionAt;
    });

    let result: { provider: ServerProvider; text: string } | null = null;
    for (const provider of SERVER_AI_ROUTES[action.task]) {
      result = await callProvider(provider, action);
      if (result) break;
    }

    if (!result) {
      await db.runTransaction(async transaction => {
        const docs = [userUsageRef, globalUsageRef];
        if (ipUsageRef) docs.push(ipUsageRef);
        if (deviceUsageRef) docs.push(deviceUsageRef);
        const snapshots = await Promise.all(docs.map(docRef => transaction.get(docRef)));

        const userSnapshot = snapshots[0];
        const globalSnapshot = snapshots[1];
        const ipSnapshot = ipUsageRef ? snapshots[2] : null;
        const deviceSnapshot = deviceUsageRef ? snapshots[docs.length - 1] : null;

        const userUsage = userSnapshot.data() || {};
        const globalUsage = globalSnapshot.data() || {};
        const ipUsage = ipSnapshot?.data() || {};
        const deviceUsage = deviceSnapshot?.data() || {};

        const currentLastActionAt = userUsage.lastActionAt;
        if (!(currentLastActionAt instanceof Timestamp) || currentLastActionAt.toMillis() !== reservationTime.toMillis()) return;

        transaction.set(userUsageRef, {
          actionsUsed: Math.max(0, Number(userUsage.actionsUsed || 1) - 1),
          importTextUsed: Math.max(0, Number(userUsage.importTextUsed || 0) - (action.task === 'import_text_resume' ? 1 : 0)),
          lastActionAt: previousLastActionAt || FieldValue.delete(),
        }, { merge: true });
        transaction.set(globalUsageRef, {
          totalActions: Math.max(0, Number(globalUsage.totalActions || 1) - 1),
        }, { merge: true });
        if (ipUsageRef) {
          transaction.set(ipUsageRef, {
            actionsUsed: Math.max(0, Number(ipUsage.actionsUsed || 1) - 1),
            lastActionAt: ipUsage.lastActionAt instanceof Timestamp && ipUsage.lastActionAt.toMillis() === reservationTime.toMillis()
              ? FieldValue.delete()
              : ipUsage.lastActionAt || FieldValue.delete(),
          }, { merge: true });
        }
        if (deviceUsageRef) {
          transaction.set(deviceUsageRef, {
            actionsUsed: Math.max(0, Number(deviceUsage.actionsUsed || 1) - 1),
            lastActionAt: deviceUsage.lastActionAt instanceof Timestamp && deviceUsage.lastActionAt.toMillis() === reservationTime.toMillis()
              ? FieldValue.delete()
              : deviceUsage.lastActionAt || FieldValue.delete(),
          }, { merge: true });
        }
      });
      throw new SafeApiError(503, 'PROVIDERS_BUSY', 'Forge Free AI is busy right now. Try BYOK or continue manually.');
    }

    await db.runTransaction(async transaction => {
      transaction.update(userUsageRef, { [`providerUsage.${result.provider}`]: FieldValue.increment(1) });
      transaction.update(globalUsageRef, { [`providerUsage.${result.provider}`]: FieldValue.increment(1) });
    }).catch(() => undefined);

    return response.status(200).json({
      ok: true,
      text: result.text,
      actionsRemaining,
      provider: result.provider,
      freeBeta: true,
    });
  } catch (error) {
    if (error instanceof SafeApiError) {
      return sendError(response, error.statusCode, error.code, error.message);
    }
    return sendError(response, 503, 'SERVER_ERROR', 'Server AI is not configured correctly.');
  }
}
