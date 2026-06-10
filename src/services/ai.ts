import { UserSettings } from '../types';

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
      } catch (err) {
        console.error('AI Queue Task Error:', err);
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
          console.warn('AI Request failed, retrying once...', err);
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
  settings: UserSettings,
  systemPrompt: string,
  userPrompt: string,
  jsonMode = false
): Promise<string> {
  const provider = settings.aiProvider || 'Groq';
  const temperature = settings.temperature ?? 0.4;
  const model = settings.modelId || getDefaultModel(provider);
  
  let apiKey = '';
  let endpoint = '';
  let headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let body: any = {};

  switch (provider) {
    case 'Groq':
      apiKey = settings.groqApiKey || '';
      endpoint = 'https://api.groq.com/openai/v1/chat/completions';
      headers['Authorization'] = `Bearer ${apiKey}`;
      body = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature,
        response_format: jsonMode ? { type: 'json_object' } : undefined
      };
      break;
    case 'OpenAI':
      apiKey = settings.openaiApiKey || '';
      endpoint = 'https://api.openai.com/v1/chat/completions';
      headers['Authorization'] = `Bearer ${apiKey}`;
      body = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature,
        response_format: jsonMode ? { type: 'json_object' } : undefined
      };
      break;
    case 'OpenRouter':
      apiKey = settings.openRouterApiKey || '';
      endpoint = 'https://openrouter.ai/api/v1/chat/completions';
      headers['Authorization'] = `Bearer ${apiKey}`;
      headers['HTTP-Referer'] = window.location.origin;
      headers['X-Title'] = 'Forge AI Resume Builder';
      body = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature
      };
      break;
    case 'Gemini':
      apiKey = settings.geminiApiKey || '';
      // Using the Google GenAI interface style but via fetch for unity
      endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      body = {
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\nTask:\n${userPrompt}` }] }
        ],
        generationConfig: {
          temperature,
          responseMimeType: jsonMode ? 'application/json' : 'text/plain'
        }
      };
      break;
    default:
      throw new Error(`Unsupported AI Provider: ${provider}`);
  }

  if (!apiKey) {
    throw new Error(`API Key for ${provider} is not configured in Settings.`);
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`${provider} API Error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  
  if (provider === 'Gemini') {
    return data.candidates[0]?.content?.parts[0]?.text || '';
  }
  
  return data.choices[0]?.message?.content || '';
}

function getDefaultModel(provider: string): string {
  switch (provider) {
    case 'Groq': return 'llama-3.3-70b-versatile';
    case 'OpenAI': return 'gpt-4o-mini';
    case 'Gemini': return 'gemini-1.5-flash';
    case 'OpenRouter': return 'anthropic/claude-3-haiku';
    default: return '';
  }
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
