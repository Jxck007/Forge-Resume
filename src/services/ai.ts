import { UserSettings } from '../types';

// Legacy browser-side provider path.
// Deprecated: active product flows must not rely on client-persisted provider keys.
// Future BYOK must be session-memory only, and Forge-owned keys must be server-side only.

interface AIRateLimit {
  lastRequestTime: number;
  requestQueue: Array<() => Promise<any>>;
  isProcessing: boolean;
}

const rateLimit: AIRateLimit = {
  lastRequestTime: 0,
  requestQueue: [],
  isProcessing: false,
};

const COOLDOWN_MS = 1000; // 1 second between requests

async function processQueue() {
  if (rateLimit.isProcessing || rateLimit.requestQueue.length === 0) return;
  
  rateLimit.isProcessing = true;
  
  while (rateLimit.requestQueue.length > 0) {
    const now = Date.now();
    const waitTime = Math.max(0, COOLDOWN_MS - (now - rateLimit.lastRequestTime));
    
    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    const task = rateLimit.requestQueue.shift();
    if (task) {
      try {
        await task();
      } catch {
        if (import.meta.env.DEV) console.warn('Legacy AI queue task failed.');
      }
      rateLimit.lastRequestTime = Date.now();
    }
  }
  
  rateLimit.isProcessing = false;
}

export async function callAIUnified(
  settings: UserSettings,
  systemPrompt: string,
  userPrompt: string,
  jsonMode = false
): Promise<string> {
  return new Promise((resolve, reject) => {
    const task = async () => {
      try {
        const result = await executeAICall(settings, systemPrompt, userPrompt, jsonMode);
        resolve(result);
      } catch (err) {
        // Simple retry mechanism
        try {
          if (import.meta.env.DEV) console.warn('Legacy AI request failed. Retrying once.');
          await new Promise(r => setTimeout(r, 2000));
          const result = await executeAICall(settings, systemPrompt, userPrompt, jsonMode);
          resolve(result);
        } catch (retryErr) {
          reject(retryErr);
        }
      }
    };
    
    rateLimit.requestQueue.push(task);
    processQueue();
  });
}

async function executeAICall(
  _settings: UserSettings,
  _systemPrompt: string,
  _userPrompt: string,
  _jsonMode = false
): Promise<string> {
  throw new Error('Legacy AI provider access is unavailable. Use session-only AI Assist.');
}

export function getDefaultModel(provider: string): string {
  switch (provider) {
    case 'Groq': return 'llama-3.3-70b-versatile';
    case 'OpenAI': return 'gpt-4o-mini';
    case 'Gemini': return 'gemini-1.5-flash';
    case 'OpenRouter': return 'anthropic/claude-3-haiku';
    default: return '';
  }
}

export async function testAIConnection(settings: UserSettings): Promise<void> {
  await executeAICall(
    settings,
    'Reply with the single word OK.',
    'Connection test',
    false
  );
}

export function cleanJsonOutput(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  return cleaned.trim();
}
