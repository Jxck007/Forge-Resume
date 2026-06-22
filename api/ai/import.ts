import type { IncomingMessage, ServerResponse } from 'node:http';
import { checkQuota, incrementQuota, isQuotaStoreConfigured, QuotaError } from './quota.js';

type ApiRequest = IncomingMessage & { body?: unknown };
type ApiResponse = ServerResponse & { status: (statusCode: number) => ApiResponse; json: (body: unknown) => void };

type ServerProvider = 'gemini' | 'cerebras' | 'groq';
type ImportRequest = {
  sourceType: 'text' | 'pdf_text' | 'docx_text' | 'image';
  text?: string;
  imageBase64?: string;
  mimeType?: string;
  templateId: string;
};

const LIMITS = { text: 16000, imageBytes: 4 * 1024 * 1024 } as const;

const sendError = (response: ApiResponse, statusCode: number, code: string, message: string) =>
  response.status(statusCode).json({ ok: false, code, message });

const parseBody = (body: unknown): unknown => {
  if (typeof body !== 'string') return body;
  try { return JSON.parse(body); } catch { return null; }
};

const getProviderKey = (provider: ServerProvider) => {
  if (provider === 'groq') return process.env.GROQ_API_KEY?.trim() || '';
  if (provider === 'cerebras') return process.env.CEREBRAS_API_KEY?.trim() || '';
  return process.env.GEMINI_API_KEY?.trim() || '';
};

const clean = (text: string) => text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();

const callGemini = async (payload: unknown) => {
  const key = getProviderKey('gemini');
  if (!key) throw new Error('missing key');
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error('provider unavailable');
  return response.json();
};

const buildPrompt = (input: { text?: string; templateId: string; sourceType: ImportRequest['sourceType'] }) => `Return only JSON for a normalized resume object with keys: title, templateId, personalDetails, summary, careerObjective, skills, experience, internships, education, projects, certifications, achievements, languages, customSections, sectionOrder, sectionOrderMode, linkDisplayMode.\nUse only facts present in the source. No invented data. templateId=${input.templateId}. sourceType=${input.sourceType}.`;

const parseJson = (value: unknown) => {
  const raw = typeof value === 'string' ? value : JSON.stringify(value);
  const match = clean(raw).match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
};

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'private, no-store');
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendError(response, 405, 'METHOD_NOT_ALLOWED', 'Use POST for resume import.');
  }
  try {
    if (process.env.AI_FREE_BETA_ENABLED !== 'true') throw new Error('FREE_BETA_DISABLED');
    if (!isQuotaStoreConfigured()) throw new Error('QUOTA_STORE_MISSING');
    const body = parseBody(request.body) as ImportRequest | null;
    if (!body || !['text', 'pdf_text', 'docx_text', 'image'].includes(body.sourceType)) {
      return sendError(response, 400, 'INVALID_REQUEST', 'The import request is invalid.');
    }
    const isImage = body.sourceType === 'image';
    const sourceText = typeof body.text === 'string' ? body.text.trim() : '';
    const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64.trim() : '';
    if (isImage) {
      if (!imageBase64) return sendError(response, 400, 'EMPTY_INPUT', 'Add an image before importing.');
      if (Buffer.byteLength(imageBase64, 'base64') > LIMITS.imageBytes) return sendError(response, 413, 'INPUT_TOO_LONG', 'This image is too large for import.');
    } else if (!sourceText) {
      return sendError(response, 400, 'EMPTY_INPUT', 'Add resume text before importing.');
    } else if (sourceText.length > LIMITS.text) {
      return sendError(response, 413, 'INPUT_TOO_LONG', 'This text is too long for one import.');
    }

    const reservation = await checkQuota(request, true);
    let parsed: any = null;
    if (isImage) {
      const prompt = buildPrompt({ sourceType: body.sourceType, templateId: body.templateId });
      const result = await callGemini({
        contents: [{ parts: [
          { text: `${prompt}\nExtract the resume content from this image and return JSON only.` },
          { inlineData: { mimeType: body.mimeType || 'image/png', data: imageBase64 } },
        ] }],
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json', maxOutputTokens: 1800 },
      });
      parsed = parseJson((result as any)?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '');
    } else {
      const prompt = buildPrompt({ text: sourceText, sourceType: body.sourceType, templateId: body.templateId });
      const result = await callGemini({
        contents: [{ parts: [{ text: `${prompt}\nResume text:\n${sourceText}` }] }],
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json', maxOutputTokens: 1800 },
      });
      parsed = parseJson((result as any)?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '');
    }
    if (!parsed || typeof parsed !== 'object') return sendError(response, 503, 'PROVIDER_UNAVAILABLE', 'Resume import could not be completed.');
    await incrementQuota(reservation.identity, reservation.window, true);
    return response.status(200).json({ ok: true, resume: { ...parsed, templateId: body.templateId }, warnings: [] });
  } catch (error) {
    if (error instanceof QuotaError) {
      return sendError(response, 429, error.code, 'Resume import is temporarily unavailable.');
    }
    const code = String((error as Error)?.message || 'IMPORT_FAILED');
    if (code === 'FREE_BETA_DISABLED') return sendError(response, 503, 'FREE_BETA_DISABLED', 'Forge Free AI is unavailable. Use BYOK or continue manually.');
    if (code === 'QUOTA_STORE_MISSING') return sendError(response, 503, 'QUOTA_STORE_MISSING', 'Free AI quota store is not configured.');
    return sendError(response, 503, 'IMPORT_FAILED', 'Resume import could not be completed.');
  }
}
