import type { IncomingMessage, ServerResponse } from 'node:http';
import { consumeQuota, isQuotaStoreConfigured, QuotaError } from './quota.js';
import {
  extractMeaningfulText,
  normalizeBulletList,
  normalizeLanguageList,
  normalizeSkillList,
  normalizeStringList,
} from '../../src/utils/importNormalization.js';

type ApiRequest = IncomingMessage & { body?: unknown };
type ApiResponse = ServerResponse & { status: (statusCode: number) => ApiResponse; json: (body: unknown) => void };

type ServerProvider = 'gemini' | 'cerebras' | 'groq';
type ImportRequest = {
  sourceType: 'text' | 'pdf_text' | 'pdf_hybrid' | 'docx_text' | 'image';
  text?: string;
  imageBase64?: string;
  mimeType?: string;
  templateId: string;
};

const LIMITS = { text: 16000, imageBytes: 4 * 1024 * 1024 } as const;
const TEXT_IMPORT_PROVIDERS: ServerProvider[] = ['gemini', 'cerebras', 'groq'];

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
const sanitizeText = (text: string) => text.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();

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

const callOpenAiCompatible = async (provider: 'groq' | 'cerebras', prompt: string) => {
  const key = getProviderKey(provider);
  if (!key) throw new Error('missing key');
  const endpoint = provider === 'groq'
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : 'https://api.cerebras.ai/v1/chat/completions';
  const model = provider === 'groq' ? 'llama-3.1-8b-instant' : 'gpt-oss-120b';
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'Return only valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      ...(provider === 'groq' ? { max_tokens: 1800 } : { max_completion_tokens: 1800 }),
    }),
  });
  if (!response.ok) throw new Error('provider unavailable');
  return response.json();
};

const buildPrompt = (input: { templateId: string; sourceType: ImportRequest['sourceType'] }) => `Extract all visible resume content and return only JSON for the Forge normalized resume object with keys: title, templateId, personalDetails, summary, careerObjective, skills, experience, internships, education, projects, certifications, achievements, volunteering, languages, customSections, sectionOrder, sectionOrderMode, linkDisplayMode.
Map full name, professional title, email, phone, location, LinkedIn, GitHub, portfolio, summary/objective, education, grouped skills, complete experience and project descriptions, technologies, dates, achievements, certifications, volunteering, languages with proficiency, and custom sections. Attach embedded URLs to matching project, certification, or personal link fields. Normal resume contact details are not confidential: extract them when visible. Never emit placeholder, confidential, private, redacted, null, undefined, or [object Object] as field text. Use only visible source facts; never invent missing data. Preserve uncertainty as an empty value. templateId=${input.templateId}. sourceType=${input.sourceType}.`;

const parseJson = (value: unknown) => {
  const raw = typeof value === 'string' ? value : JSON.stringify(value);
  const match = clean(raw).match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
};

const extractResultText = (result: any) =>
  result?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('')
  || result?.choices?.[0]?.message?.content
  || '';

const asArray = <T,>(value: unknown): T[] => Array.isArray(value) ? value : [];
const asObject = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value)
  ? value as Record<string, unknown>
  : {};
const scalar = (value: unknown) => sanitizeText(extractMeaningfulText(value));

const normalizeRecordList = (value: unknown) =>
  asArray<Record<string, unknown>>(value).map((item, index) => ({
    id: scalar(item.id) || `${index + 1}`,
    title: scalar(item.title || item.role || item.name),
    name: scalar(item.name || item.title),
    company: scalar(item.company || item.organization),
    institution: scalar(item.institution),
    location: scalar(item.location),
    startDate: scalar(item.startDate),
    endDate: scalar(item.endDate),
    description: scalar(item.description || item.summary || item.details || item.bullets),
    technologies: scalar(item.technologies || item.technologiesUsed || item.tech),
    technologiesUsed: scalar(item.technologiesUsed || item.technologies || item.tech),
    issuer: scalar(item.issuer),
    date: scalar(item.date),
    url: scalar(item.url || item.link),
    github: scalar(item.github || item.repository),
    live: scalar(item.live || item.demo || item.url),
    subtitle: scalar(item.subtitle),
    gpa: scalar(item.gpa || item.score),
  })).filter(item => item.title || item.name || item.company || item.institution || item.description);

const normalizeImportResume = (value: unknown, templateId: string) => {
  const record = asObject(value);
  const personal = asObject(record.personalDetails);
  const skills = asObject(record.skills);
  return {
    title: scalar(record.title).slice(0, 100) || 'Imported Resume',
    templateId,
    personalDetails: {
      fullName: scalar(personal.fullName),
      professionalTitle: scalar(personal.professionalTitle),
      email: scalar(personal.email),
      phone: scalar(personal.phone),
      location: scalar(personal.location),
      linkedin: scalar(personal.linkedin),
      github: scalar(personal.github),
      website: scalar(personal.website || personal.portfolio),
      profilePhoto: '',
    },
    summary: scalar(record.summary),
    careerObjective: scalar(record.careerObjective),
    skills: {
      programmingLanguages: normalizeSkillList(skills.programmingLanguages || skills.languages),
      frameworks: normalizeSkillList(skills.frameworks),
      tools: normalizeSkillList(skills.tools),
      databases: normalizeSkillList(skills.databases),
      softSkills: normalizeSkillList(skills.softSkills),
    },
    experience: normalizeRecordList(record.experience),
    internships: normalizeRecordList(record.internships).map(item => ({
      id: item.id,
      role: item.title,
      company: item.company,
      location: item.location,
      startDate: item.startDate,
      endDate: item.endDate,
      description: item.description,
      technologiesUsed: item.technologiesUsed,
    })),
    education: normalizeRecordList(record.education).map(item => ({
      id: item.id,
      degree: item.title,
      institution: item.institution,
      location: item.location,
      startDate: item.startDate,
      endDate: item.endDate,
      description: item.description,
      gpa: item.gpa,
      scoreType: undefined,
    })),
    projects: normalizeRecordList(record.projects).map(item => ({
      id: item.id,
      name: item.name || item.title,
      description: item.description,
      technologies: item.technologies,
      startDate: item.startDate,
      endDate: item.endDate,
      github: item.github,
      live: item.live || item.url,
    })),
    certifications: normalizeRecordList(record.certifications).map(item => ({
      id: item.id,
      name: item.name || item.title,
      issuer: item.issuer,
      date: item.date,
      url: item.url,
    })),
    achievements: normalizeBulletList(record.achievements),
    volunteering: normalizeRecordList(record.volunteering).map(item => ({
      id: item.id,
      title: item.title,
      company: item.company,
      location: item.location,
      startDate: item.startDate,
      endDate: item.endDate,
      description: item.description,
    })),
    languages: normalizeLanguageList(record.languages),
    customSections: asArray<Record<string, unknown>>(record.customSections).map((section, sectionIndex) => ({
      id: scalar(section.id) || `custom_${sectionIndex + 1}`,
      title: scalar(section.title || section.name) || 'Additional Information',
      items: asArray<Record<string, unknown>>(section.items || section.entries).map((item, itemIndex) => ({
        id: scalar(item.id) || `item_${itemIndex + 1}`,
        title: scalar(item.title || item.name),
        subtitle: scalar(item.subtitle || item.organization),
        date: scalar(item.date),
        description: scalar(item.description || item.details || item.value),
      })).filter(item => item.title || item.description),
    })).filter(section => section.items.length > 0),
    sectionOrder: normalizeStringList(record.sectionOrder),
    sectionOrderMode: record.sectionOrderMode === 'template' ? 'template' : 'custom',
    linkDisplayMode: record.linkDisplayMode === 'raw' ? 'raw' : 'embedded',
  };
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
    if (!body || !['text', 'pdf_text', 'pdf_hybrid', 'docx_text', 'image'].includes(body.sourceType)) {
      return sendError(response, 400, 'INVALID_REQUEST', 'The import request is invalid.');
    }

    const isImage = body.sourceType === 'image' || body.sourceType === 'pdf_hybrid';
    const sourceText = typeof body.text === 'string' ? body.text.trim() : '';
    const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64.trim() : '';
    if (isImage) {
      if (!imageBase64) return sendError(response, 400, 'EMPTY_INPUT', 'Add an image before importing.');
      if (Buffer.byteLength(imageBase64, 'base64') > LIMITS.imageBytes) return sendError(response, 413, 'INPUT_TOO_LONG', 'This image is too large for import.');
      if (sourceText.length > LIMITS.text) return sendError(response, 413, 'INPUT_TOO_LONG', 'The extracted PDF text is too long for one import.');
      if (!getProviderKey('gemini')) return sendError(response, 503, 'MISSING_PROVIDER_KEYS', 'Image import is unavailable right now.');
    } else if (!sourceText) {
      return sendError(response, 400, 'EMPTY_INPUT', 'Add resume text before importing.');
    } else if (sourceText.length > LIMITS.text) {
      return sendError(response, 413, 'INPUT_TOO_LONG', 'This text is too long for one import.');
    } else if (!TEXT_IMPORT_PROVIDERS.some(provider => Boolean(getProviderKey(provider)))) {
      return sendError(response, 503, 'MISSING_PROVIDER_KEYS', 'Resume import is unavailable right now.');
    }

    await consumeQuota(request, true);
    const prompt = buildPrompt({ sourceType: body.sourceType, templateId: body.templateId });
    let parsed: unknown = null;

    if (isImage) {
      const result = await callGemini({
        contents: [{ parts: [
          { text: `${prompt}\n${sourceText ? `Locally extracted text and embedded links:\n${sourceText}\nUse the image to recover missing or garbled content and merge both sources.` : 'Extract the visible resume content from this image.'}\nReturn JSON only.` },
          { inlineData: { mimeType: body.mimeType || 'image/png', data: imageBase64 } },
        ] }],
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json', maxOutputTokens: 1800 },
      });
      parsed = parseJson(extractResultText(result));
    } else {
      for (const provider of TEXT_IMPORT_PROVIDERS) {
        try {
          const result = provider === 'gemini'
            ? await callGemini({
              contents: [{ parts: [{ text: `${prompt}\nResume text:\n${sourceText}` }] }],
              generationConfig: { temperature: 0.1, responseMimeType: 'application/json', maxOutputTokens: 1800 },
            })
            : await callOpenAiCompatible(provider, `${prompt}\nResume text:\n${sourceText}`);
          parsed = parseJson(extractResultText(result));
          if (parsed) break;
        } catch {}
      }
    }

    if (!parsed || typeof parsed !== 'object') return sendError(response, 503, 'PROVIDER_UNAVAILABLE', 'Resume import could not be completed.');

    const normalized = normalizeImportResume(parsed, body.templateId);
    const warnings: string[] = [];
    if (!normalized.personalDetails.fullName) warnings.push('Name was not confidently detected.');
    if (!normalized.summary && normalized.experience.length === 0 && normalized.education.length === 0) {
      warnings.push('Some sections may need manual cleanup before saving.');
    }

    return response.status(200).json({ ok: true, resume: normalized, warnings });
  } catch (error) {
    if (error instanceof QuotaError) {
      const message = error.code === 'IMPORT_LIMIT'
        ? 'Free resume import limit reached. Try again after reset or use BYOK.'
        : 'Resume import is temporarily unavailable.';
      return sendError(response, 429, error.code, message);
    }
    const code = String((error as Error)?.message || 'IMPORT_FAILED');
    if (code === 'FREE_BETA_DISABLED') return sendError(response, 503, 'FREE_BETA_DISABLED', 'Forge Free AI is unavailable. Use BYOK or continue manually.');
    if (code === 'QUOTA_STORE_MISSING') return sendError(response, 503, 'QUOTA_STORE_MISSING', 'Free AI quota store is not configured.');
    return sendError(response, 503, 'IMPORT_FAILED', 'Resume import could not be completed.');
  }
}
