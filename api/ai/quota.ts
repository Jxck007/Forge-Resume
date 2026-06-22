import { createHash } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

const WINDOW_MS = 12 * 60 * 60 * 1000;

export const FREE_AI_QUOTA = {
  deviceActions: 25,
  ipActions: 40,
  imports: 3,
  globalActions: 800,
  cooldownSeconds: 10,
  windowHours: 12,
} as const;

export type QuotaFailureCode =
  | 'COOLDOWN'
  | 'DEVICE_LIMIT'
  | 'IP_LIMIT'
  | 'IMPORT_LIMIT'
  | 'GLOBAL_LIMIT'
  | 'QUOTA_STORE_UNAVAILABLE';

export class QuotaError extends Error {
  constructor(public readonly code: QuotaFailureCode) {
    super(code);
    this.name = 'QuotaError';
  }
}

type RedisResponse = { result?: unknown; error?: string };
type QuotaIdentity = { deviceHash: string; ipHash: string };

export const isQuotaStoreConfigured = () => Boolean(
  process.env.UPSTASH_REDIS_REST_URL?.trim() &&
  process.env.UPSTASH_REDIS_REST_TOKEN?.trim() &&
  process.env.AI_ABUSE_HASH_SALT?.trim()
);

const hashIdentifier = (kind: 'device' | 'ip', value: string) => createHash('sha256')
  .update(`${process.env.AI_ABUSE_HASH_SALT!.trim()}|${kind}|${value}`)
  .digest('hex');

const getClientIp = (request: IncomingMessage) => {
  const forwarded = request.headers['x-forwarded-for'];
  const firstForwarded = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return firstForwarded?.split(',')[0]?.trim() || request.socket?.remoteAddress || 'unknown';
};

export const getQuotaIdentity = (request: IncomingMessage): QuotaIdentity => {
  if (!isQuotaStoreConfigured()) throw new QuotaError('QUOTA_STORE_UNAVAILABLE');
  const ip = getClientIp(request);
  const deviceHeader = request.headers['x-forge-device'];
  const device = (Array.isArray(deviceHeader) ? deviceHeader[0] : deviceHeader)?.trim() || `ip-fallback:${ip}`;
  return {
    deviceHash: hashIdentifier('device', device),
    ipHash: hashIdentifier('ip', ip),
  };
};

const getWindow = (now = Date.now()) => {
  const id = Math.floor(now / WINDOW_MS);
  const resetAtMs = (id + 1) * WINDOW_MS;
  return {
    id: String(id),
    resetAt: new Date(resetAtMs).toISOString(),
    ttlSeconds: Math.max(60, Math.ceil((resetAtMs - now) / 1000) + 60),
  };
};

const redisCommand = async (command: unknown[]) => {
  if (!isQuotaStoreConfigured()) throw new QuotaError('QUOTA_STORE_UNAVAILABLE');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(process.env.UPSTASH_REDIS_REST_URL!.replace(/\/$/, ''), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN!}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null) as RedisResponse | null;
    if (!response.ok || !payload || payload.error) throw new QuotaError('QUOTA_STORE_UNAVAILABLE');
    return payload.result;
  } catch (error) {
    if (error instanceof QuotaError) throw error;
    throw new QuotaError('QUOTA_STORE_UNAVAILABLE');
  } finally {
    clearTimeout(timeout);
  }
};

const getKeys = (identity: QuotaIdentity, windowId: string) => {
  const prefix = `forge:free-ai:v1:${windowId}`;
  return {
    deviceActions: `${prefix}:device:${identity.deviceHash}:actions`,
    ipActions: `${prefix}:ip:${identity.ipHash}:actions`,
    globalActions: `${prefix}:global:actions`,
    deviceImports: `${prefix}:device:${identity.deviceHash}:imports`,
    ipImports: `${prefix}:ip:${identity.ipHash}:imports`,
    deviceCooldown: `forge:free-ai:v1:cooldown:device:${identity.deviceHash}`,
    ipCooldown: `forge:free-ai:v1:cooldown:ip:${identity.ipHash}`,
  };
};

const CHECK_SCRIPT = `
local deviceActions = tonumber(redis.call('GET', KEYS[1]) or '0')
local ipActions = tonumber(redis.call('GET', KEYS[2]) or '0')
local globalActions = tonumber(redis.call('GET', KEYS[3]) or '0')
local deviceImports = tonumber(redis.call('GET', KEYS[4]) or '0')
local ipImports = tonumber(redis.call('GET', KEYS[5]) or '0')
if deviceActions >= tonumber(ARGV[1]) then return {'DEVICE_LIMIT', deviceActions} end
if ipActions >= tonumber(ARGV[2]) then return {'IP_LIMIT', deviceActions} end
if globalActions >= tonumber(ARGV[3]) then return {'GLOBAL_LIMIT', deviceActions} end
if ARGV[5] == '1' and (deviceImports >= tonumber(ARGV[4]) or ipImports >= tonumber(ARGV[4])) then
  return {'IMPORT_LIMIT', deviceActions}
end
if redis.call('EXISTS', KEYS[6]) == 1 or redis.call('EXISTS', KEYS[7]) == 1 then
  return {'COOLDOWN', deviceActions}
end
redis.call('SET', KEYS[6], '1', 'EX', ARGV[6])
redis.call('SET', KEYS[7], '1', 'EX', ARGV[6])
return {'OK', deviceActions}
`;

const INCREMENT_SCRIPT = `
local function increment(key, ttl)
  local value = redis.call('INCR', key)
  if value == 1 then redis.call('EXPIRE', key, ttl) end
  return value
end
local deviceActions = increment(KEYS[1], ARGV[1])
increment(KEYS[2], ARGV[1])
increment(KEYS[3], ARGV[1])
if ARGV[2] == '1' then
  increment(KEYS[4], ARGV[1])
  increment(KEYS[5], ARGV[1])
end
return deviceActions
`;

const CONSUME_SCRIPT = `
local deviceActions = tonumber(redis.call('GET', KEYS[1]) or '0')
local ipActions = tonumber(redis.call('GET', KEYS[2]) or '0')
local globalActions = tonumber(redis.call('GET', KEYS[3]) or '0')
local deviceImports = tonumber(redis.call('GET', KEYS[4]) or '0')
local ipImports = tonumber(redis.call('GET', KEYS[5]) or '0')
if deviceActions >= tonumber(ARGV[1]) then return {'DEVICE_LIMIT', deviceActions} end
if ipActions >= tonumber(ARGV[2]) then return {'IP_LIMIT', deviceActions} end
if globalActions >= tonumber(ARGV[3]) then return {'GLOBAL_LIMIT', deviceActions} end
if ARGV[5] == '1' and (deviceImports >= tonumber(ARGV[4]) or ipImports >= tonumber(ARGV[4])) then
  return {'IMPORT_LIMIT', deviceActions}
end
if redis.call('EXISTS', KEYS[6]) == 1 or redis.call('EXISTS', KEYS[7]) == 1 then
  return {'COOLDOWN', deviceActions}
end
local function increment(key, ttl)
  local value = redis.call('INCR', key)
  if value == 1 then redis.call('EXPIRE', key, ttl) end
  return value
end
local used = increment(KEYS[1], ARGV[7])
increment(KEYS[2], ARGV[7])
increment(KEYS[3], ARGV[7])
if ARGV[5] == '1' then
  increment(KEYS[4], ARGV[7])
  increment(KEYS[5], ARGV[7])
end
redis.call('SET', KEYS[6], '1', 'EX', ARGV[6])
redis.call('SET', KEYS[7], '1', 'EX', ARGV[6])
return {'OK', used}
`;

const QUOTA_FAILURE_CODES = new Set<QuotaFailureCode>([
  'COOLDOWN',
  'DEVICE_LIMIT',
  'IP_LIMIT',
  'IMPORT_LIMIT',
  'GLOBAL_LIMIT',
  'QUOTA_STORE_UNAVAILABLE',
]);

export const checkQuota = async (request: IncomingMessage, isImport: boolean) => {
  const identity = getQuotaIdentity(request);
  const window = getWindow();
  const keys = getKeys(identity, window.id);
  const result = await redisCommand([
    'EVAL', CHECK_SCRIPT, 7,
    keys.deviceActions, keys.ipActions, keys.globalActions, keys.deviceImports,
    keys.ipImports, keys.deviceCooldown, keys.ipCooldown,
    FREE_AI_QUOTA.deviceActions, FREE_AI_QUOTA.ipActions, FREE_AI_QUOTA.globalActions,
    FREE_AI_QUOTA.imports, isImport ? 1 : 0, FREE_AI_QUOTA.cooldownSeconds,
  ]);
  const values = Array.isArray(result) ? result : [];
  const code = String(values[0] || 'QUOTA_STORE_UNAVAILABLE');
  if (code !== 'OK') {
    throw new QuotaError(QUOTA_FAILURE_CODES.has(code as QuotaFailureCode)
      ? code as QuotaFailureCode
      : 'QUOTA_STORE_UNAVAILABLE');
  }
  return { identity, window };
};

export const incrementQuota = async (
  identity: QuotaIdentity,
  window: ReturnType<typeof getWindow>,
  isImport: boolean
) => {
  const keys = getKeys(identity, window.id);
  const result = await redisCommand([
    'EVAL', INCREMENT_SCRIPT, 5,
    keys.deviceActions, keys.ipActions, keys.globalActions, keys.deviceImports, keys.ipImports,
    window.ttlSeconds, isImport ? 1 : 0,
  ]);
  const used = Math.max(0, Number(result || 0));
  return {
    used,
    actionsRemaining: Math.max(0, FREE_AI_QUOTA.deviceActions - used),
  };
};

export const consumeQuota = async (request: IncomingMessage, isImport: boolean) => {
  const identity = getQuotaIdentity(request);
  const window = getWindow();
  const keys = getKeys(identity, window.id);
  const result = await redisCommand([
    'EVAL', CONSUME_SCRIPT, 7,
    keys.deviceActions, keys.ipActions, keys.globalActions, keys.deviceImports,
    keys.ipImports, keys.deviceCooldown, keys.ipCooldown,
    FREE_AI_QUOTA.deviceActions, FREE_AI_QUOTA.ipActions, FREE_AI_QUOTA.globalActions,
    FREE_AI_QUOTA.imports, isImport ? 1 : 0, FREE_AI_QUOTA.cooldownSeconds, window.ttlSeconds,
  ]);
  const values = Array.isArray(result) ? result : [];
  const code = String(values[0] || 'QUOTA_STORE_UNAVAILABLE');
  if (code !== 'OK') {
    throw new QuotaError(QUOTA_FAILURE_CODES.has(code as QuotaFailureCode)
      ? code as QuotaFailureCode
      : 'QUOTA_STORE_UNAVAILABLE');
  }
  const used = Math.max(0, Number(values[1] || 0));
  return {
    used,
    actionsRemaining: Math.max(0, FREE_AI_QUOTA.deviceActions - used),
  };
};

export const getQuotaStatus = async (request: IncomingMessage) => {
  const identity = getQuotaIdentity(request);
  const window = getWindow();
  const keys = getKeys(identity, window.id);
  const [actionResult, importResult] = await Promise.all([
    redisCommand(['GET', keys.deviceActions]),
    redisCommand(['GET', keys.deviceImports]),
  ]);
  const parsed = Number(actionResult || 0);
  const parsedImports = Number(importResult || 0);
  const used = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  const importsUsed = Number.isFinite(parsedImports) ? Math.max(0, parsedImports) : 0;
  return {
    used,
    actionsRemaining: Math.max(0, FREE_AI_QUOTA.deviceActions - used),
    importsRemaining: Math.max(0, FREE_AI_QUOTA.imports - importsUsed),
    resetAt: window.resetAt,
  };
};
