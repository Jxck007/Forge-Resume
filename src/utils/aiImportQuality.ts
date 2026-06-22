import { ProfileData, ResumeData } from '../types';
import { normalizeEducationScore } from './educationScore';
import {
  extractMeaningfulText,
  normalizeBulletList,
  normalizeLanguageList,
  normalizeSkillList,
  normalizeStringList,
} from './importNormalization';

export type ImportConfidenceLevel = 'high' | 'medium' | 'low';

export interface ImportSectionConfidence {
  score: number;
  level: ImportConfidenceLevel;
  accepted: boolean;
}

export interface ImportConfidenceReport {
  overall: number;
  level: ImportConfidenceLevel;
  sections: Record<string, ImportSectionConfidence>;
  rejectedFields: number;
}

export interface ReviewedImport<T> {
  data: Partial<T>;
  confidence: ImportConfidenceReport;
}

const MIN_FIELD_CONFIDENCE = 70;
const PLACEHOLDER_PATTERN = /^(?:n\/?a|none|unknown|confidential|private|redacted|not (?:available|provided|specified)|company name|project name|candidate|your name|example|tbd|-+|\[object Object\])$/i;
let importInProgress = false;

export class ImportInProgressError extends Error {
  constructor() {
    super('Import already in progress.');
    this.name = 'ImportInProgressError';
  }
}

export async function runAiImportSingleFlight<T>(operation: () => Promise<T>): Promise<T> {
  if (importInProgress) throw new ImportInProgressError();
  importInProgress = true;
  try {
    return await operation();
  } finally {
    importInProgress = false;
  }
}

const asRecord = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {};

const asObjectArray = (value: unknown): Record<string, any>[] => {
  if (Array.isArray(value)) {
    return value.filter(item => item && typeof item === 'object' && !Array.isArray(item));
  }
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, any>;
  const values = Object.values(record);
  return values.length > 0 && values.every(item => item && typeof item === 'object' && !Array.isArray(item))
    ? values as Record<string, any>[]
    : [record];
};

const normalizeEvidence = (value: string) =>
  value
    .toLowerCase()
    .replace(/https?:\/\/(?:www\.)?/g, '')
    .replace(/[^a-z0-9+#.%@/-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const meaningfulTokens = (value: string) =>
  normalizeEvidence(value).split(' ').filter(token => token.length > 1);

const buildEvidenceText = (parsedValue: unknown) => {
  const parsed = asRecord(parsedValue);
  const personal = asRecord(parsed.personalDetails);
  return [
    extractMeaningfulText(personal.fullName),
    extractMeaningfulText(personal.professionalTitle),
    extractMeaningfulText(personal.email),
    extractMeaningfulText(personal.phone),
    extractMeaningfulText(parsed.summary),
    ...normalizeBulletList(parsed.achievements),
    ...normalizeLanguageList(parsed.languages),
    ...normalizeStringList(parsed.skills),
    ...normalizeStringList(parsed.experience),
    ...normalizeStringList(parsed.education),
    ...normalizeStringList(parsed.projects),
    ...normalizeStringList(parsed.certifications),
  ].filter(Boolean).join(' ');
};

const evidenceScore = (value: unknown, source: string): number => {
  const text = String(value ?? '').trim();
  if (!text || PLACEHOLDER_PATTERN.test(text)) return 0;

  const normalizedValue = normalizeEvidence(text);
  if (!normalizedValue) return 0;
  if (source.includes(normalizedValue)) return 98;

  const tokens = meaningfulTokens(text);
  if (!tokens.length) return 0;
  const matched = tokens.filter(token => source.includes(token)).length;
  const coverage = matched / tokens.length;
  if (coverage >= 0.9) return 88;
  if (coverage >= 0.75 && tokens.length >= 3) return 76;
  return 0;
};

type AssessmentState = {
  source: string;
  acceptedScores: number[];
  rejectedFields: number;
  sectionScores: Record<string, number[]>;
};

const acceptText = (state: AssessmentState, section: string, value: unknown): string => {
  const text = extractMeaningfulText(value);
  const score = evidenceScore(text, state.source);
  if (score < MIN_FIELD_CONFIDENCE) {
    if (text) state.rejectedFields += 1;
    return '';
  }
  state.acceptedScores.push(score);
  (state.sectionScores[section] ||= []).push(score);
  return text;
};

const acceptList = (state: AssessmentState, section: string, value: unknown) =>
  normalizeStringList(value)
    .map(item => acceptText(state, section, item))
    .filter(Boolean);

const acceptBulletList = (state: AssessmentState, section: string, value: unknown) =>
  normalizeBulletList(value)
    .map(item => acceptText(state, section, item))
    .filter(Boolean);

const acceptLanguageList = (state: AssessmentState, section: string, value: unknown) =>
  normalizeLanguageList(value)
    .map(item => acceptText(state, section, item))
    .filter(Boolean);

const stableId = (prefix: string, index: number) => `${prefix}_import_${index + 1}`;

const confidenceLevel = (score: number): ImportConfidenceLevel =>
  score >= 90 ? 'high' : score >= MIN_FIELD_CONFIDENCE ? 'medium' : 'low';

const buildReport = (state: AssessmentState): ImportConfidenceReport => {
  const sections = Object.fromEntries(
    Object.entries(state.sectionScores).map(([key, scores]) => {
      const score = scores.length
        ? Math.round(scores.reduce((total, value) => total + value, 0) / scores.length)
        : 0;
      return [key, { score, level: confidenceLevel(score), accepted: score >= MIN_FIELD_CONFIDENCE }];
    })
  );
  const overall = state.acceptedScores.length
    ? Math.round(state.acceptedScores.reduce((total, value) => total + value, 0) / state.acceptedScores.length)
    : 0;
  return {
    overall,
    level: confidenceLevel(overall),
    sections,
    rejectedFields: state.rejectedFields,
  };
};

const createState = (rawText: string): AssessmentState => ({
  source: normalizeEvidence(rawText),
  acceptedScores: [],
  rejectedFields: 0,
  sectionScores: {},
});

const sanitizeImport = (parsedValue: unknown, rawText: string, includeCareerObjective: boolean) => {
  const fallbackEvidence = buildEvidenceText(parsedValue);
  const state = createState(rawText.trim().length >= 80 ? rawText : `${rawText}\n${fallbackEvidence}`.trim());
  const parsed = asRecord(parsedValue);
  const personal = asRecord(parsed.personalDetails);
  const skills = asRecord(parsed.skills);

  const personalDetails = {
    fullName: acceptText(state, 'personalDetails', personal.fullName),
    professionalTitle: acceptText(state, 'personalDetails', personal.professionalTitle),
    email: acceptText(state, 'personalDetails', personal.email),
    phone: acceptText(state, 'personalDetails', personal.phone),
    location: acceptText(state, 'personalDetails', personal.location),
    linkedin: acceptText(state, 'personalDetails', personal.linkedin),
    github: acceptText(state, 'personalDetails', personal.github),
    website: acceptText(state, 'personalDetails', personal.website),
    profilePhoto: '',
  };

  const education = asObjectArray(parsed.education).map((entry, index) => {
    const item = {
      id: stableId('edu', index),
      degree: acceptText(state, 'education', entry.degree),
      institution: acceptText(state, 'education', entry.institution),
      location: acceptText(state, 'education', entry.location),
      startDate: acceptText(state, 'education', entry.startDate),
      endDate: acceptText(state, 'education', entry.endDate),
      gpa: acceptText(state, 'education', entry.gpa ?? entry.score),
      scoreType: entry.scoreType,
      description: acceptText(state, 'education', entry.description),
    };
    return { ...item, ...normalizeEducationScore(item) };
  }).filter(entry => Boolean(entry.degree || entry.institution));

  const experience = asObjectArray(parsed.experience).map((entry, index) => ({
    id: stableId('exp', index),
    title: acceptText(state, 'experience', entry.title ?? entry.role),
    company: acceptText(state, 'experience', entry.company),
    location: acceptText(state, 'experience', entry.location),
    startDate: acceptText(state, 'experience', entry.startDate),
    endDate: acceptText(state, 'experience', entry.endDate),
    description: acceptText(state, 'experience', entry.description),
  })).filter(entry => Boolean(entry.title || entry.company));

  const internships = asObjectArray(parsed.internships).map((entry, index) => ({
    id: stableId('intern', index),
    role: acceptText(state, 'internships', entry.role ?? entry.title),
    company: acceptText(state, 'internships', entry.company),
    location: acceptText(state, 'internships', entry.location),
    startDate: acceptText(state, 'internships', entry.startDate),
    endDate: acceptText(state, 'internships', entry.endDate),
    description: acceptText(state, 'internships', entry.description),
    technologiesUsed: acceptText(state, 'internships', entry.technologiesUsed ?? entry.technologies),
  })).filter(entry => Boolean(entry.role || entry.company));

  const projects = asObjectArray(parsed.projects).map((entry, index) => ({
    id: stableId('proj', index),
    name: acceptText(state, 'projects', entry.name ?? entry.title),
    description: acceptText(state, 'projects', entry.description),
    technologies: acceptText(state, 'projects', entry.technologies),
    github: acceptText(state, 'projects', entry.github),
    live: acceptText(state, 'projects', entry.live),
  })).filter(entry => Boolean(entry.name));

  const certifications = asObjectArray(parsed.certifications).map((entry, index) => ({
    id: stableId('cert', index),
    name: acceptText(state, 'certifications', entry.name ?? entry.title),
    issuer: acceptText(state, 'certifications', entry.issuer),
    date: acceptText(state, 'certifications', entry.date),
    url: acceptText(state, 'certifications', entry.url),
  })).filter(entry => Boolean(entry.name));

  const volunteering = asObjectArray(parsed.volunteering).map((entry, index) => ({
    id: stableId('vol', index),
    title: acceptText(state, 'volunteering', entry.title ?? entry.role),
    company: acceptText(state, 'volunteering', entry.company ?? entry.organization),
    location: acceptText(state, 'volunteering', entry.location),
    startDate: acceptText(state, 'volunteering', entry.startDate),
    endDate: acceptText(state, 'volunteering', entry.endDate),
    description: acceptText(state, 'volunteering', entry.description),
  })).filter(entry => Boolean(entry.title || entry.company));

  const data: Partial<ProfileData> = {
    personalDetails,
    summary: acceptText(state, 'summary', parsed.summary),
    education,
    experience,
    internships,
    projects,
    skills: {
      programmingLanguages: normalizeSkillList(skills.programmingLanguages).map(item => acceptText(state, 'skills', item)).filter(Boolean),
      frameworks: normalizeSkillList(skills.frameworks).map(item => acceptText(state, 'skills', item)).filter(Boolean),
      tools: normalizeSkillList(skills.tools).map(item => acceptText(state, 'skills', item)).filter(Boolean),
      databases: normalizeSkillList(skills.databases).map(item => acceptText(state, 'skills', item)).filter(Boolean),
      softSkills: normalizeSkillList(skills.softSkills).map(item => acceptText(state, 'skills', item)).filter(Boolean),
    },
    certifications,
    achievements: acceptBulletList(state, 'achievements', parsed.achievements),
    volunteering,
    languages: acceptLanguageList(state, 'languages', parsed.languages),
  };
  if (includeCareerObjective) {
    data.careerObjective = acceptText(state, 'careerObjective', parsed.careerObjective);
  }

  const report = buildReport(state);
  const hasIdentity = Boolean(personalDetails.fullName || personalDetails.email || personalDetails.phone);
  const hasResumeSection = Boolean(
    education.length || experience.length || internships.length || projects.length ||
    certifications.length || volunteering.length ||
    Object.values(data.skills || {}).some(values => values.length > 0)
  );
  const reliable = state.acceptedScores.length >= 2 && (hasIdentity || hasResumeSection);

  if (!reliable) throw new Error('No reliable information detected.');
  return { data, confidence: report };
};

export const assessResumeImport = (
  parsedValue: unknown,
  rawText: string
): ReviewedImport<ResumeData> =>
  sanitizeImport(parsedValue, rawText, false) as ReviewedImport<ResumeData>;

export const assessProfileImport = (
  parsedValue: unknown,
  rawText: string
): ReviewedImport<ProfileData> =>
  sanitizeImport(parsedValue, rawText, true) as ReviewedImport<ProfileData>;
