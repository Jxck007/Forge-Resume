import type { IncomingMessage, ServerResponse } from 'node:http';
import { getAdminAuth, getAdminDb } from '../firebaseAdmin';

type ApiRequest = IncomingMessage;
type ApiResponse = ServerResponse & {
  status: (statusCode: number) => ApiResponse;
  json: (body: unknown) => void;
};

const LIMIT = 25;
const WINDOW_HOURS = 12;

const getNextResetAt = () => {
  const now = new Date();
  const reset = new Date(now);
  reset.setUTCHours(now.getUTCHours() < 12 ? 12 : 24, 0, 0, 0);
  return reset.toISOString();
};

const sendStatus = (
  response: ApiResponse,
  input: {
    signedIn: boolean;
    freeBetaAvailable: boolean;
    reason?: 'guest' | 'env_disabled' | 'firestore_disabled' | 'missing_provider_keys' | 'server_error';
    used?: number;
  }
) => {
  response.setHeader('Cache-Control', 'private, no-store');
  return response.status(200).json({
  ok: true,
  signedIn: input.signedIn,
  freeBetaAvailable: input.freeBetaAvailable,
  ...(input.reason ? { reason: input.reason } : {}),
  limit: LIMIT,
  used: input.used || 0,
  actionsRemaining: input.signedIn ? Math.max(0, LIMIT - (input.used || 0)) : 0,
  resetAt: getNextResetAt(),
  windowHours: WINDOW_HOURS,
  });
};

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED', message: 'Use GET for AI status.' });
  }

  const authorization = request.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return sendStatus(response, { signedIn: false, freeBetaAvailable: false, reason: 'guest' });

  try {
    const auth = getAdminAuth();
    const db = getAdminDb();
    let uid = '';
    try {
      uid = (await auth.verifyIdToken(token)).uid;
    } catch {
      return sendStatus(response, { signedIn: false, freeBetaAvailable: false, reason: 'guest' });
    }

    if (process.env.AI_FREE_BETA_ENABLED !== 'true') {
      return sendStatus(response, { signedIn: true, freeBetaAvailable: false, reason: 'env_disabled' });
    }

    const configSnapshot = await db.doc('aiSystem/config').get();
    if (configSnapshot.exists && configSnapshot.data()?.freeBetaEnabled === false) {
      return sendStatus(response, { signedIn: true, freeBetaAvailable: false, reason: 'firestore_disabled' });
    }

    const hasProviderKey = Boolean(
      process.env.GROQ_API_KEY?.trim() ||
      process.env.CEREBRAS_API_KEY?.trim() ||
      process.env.GEMINI_API_KEY?.trim()
    );
    if (!hasProviderKey) {
      return sendStatus(response, { signedIn: true, freeBetaAvailable: false, reason: 'missing_provider_keys' });
    }

    const day = new Date().toISOString().slice(0, 10);
    const usageSnapshot = await db.doc(`aiUsage/${uid}/days/${day}`).get();
    const rawUsed = Number(usageSnapshot.data()?.actionsUsed || 0);
    const used = Number.isFinite(rawUsed) ? Math.max(0, rawUsed) : 0;
    return sendStatus(response, { signedIn: true, freeBetaAvailable: true, used });
  } catch {
    return sendStatus(response, { signedIn: true, freeBetaAvailable: false, reason: 'server_error' });
  }
}
