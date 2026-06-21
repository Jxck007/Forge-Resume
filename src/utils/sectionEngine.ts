import {
  ResumeSectionConfig,
  StandardSectionKey,
  STANDARD_SECTION_KEYS,
  TemplateId,
} from '../types';

export const DEFAULT_SECTION_HEADINGS: Record<StandardSectionKey, string> = {
  summary: 'Professional Summary',
  education: 'Education',
  experience: 'Experience',
  skills: 'Skills',
  projects: 'Projects',
  certifications: 'Certifications',
  achievements: 'Achievements',
  internships: 'Internships',
  volunteering: 'Volunteering',
  languages: 'Languages',
};

export const CANONICAL_SECTION_KEYS = [
  'summary',
  'experience',
  'education',
  'skills',
  'projects',
  'certifications',
  'achievements',
] as const;

export type CanonicalSectionKey = (typeof CANONICAL_SECTION_KEYS)[number];

export const DEFAULT_SECTION_ORDER = [
  'summary',
  'experience',
  'internships',
  'education',
  'skills',
  'projects',
  'certifications',
  'achievements',
  'volunteering',
  'languages',
] as const;

export const TEMPLATE_SECTION_PRIORITIES: Record<TemplateId, readonly string[]> = {
  modern: ['summary', 'experience', 'skills', 'projects'],
  minimal: ['summary', 'experience', 'education', 'skills'],
  corporate: ['summary', 'experience', 'education', 'skills', 'certifications'],
  executive: ['summary', 'experience', 'achievements', 'education', 'certifications'],
  creative: ['projects', 'summary', 'experience', 'skills', 'achievements'],
  atsFriendly: ['summary', 'skills', 'experience', 'projects', 'education'],
  softwareEngineer: ['skills', 'projects', 'experience', 'education', 'certifications'],
  student: ['education', 'projects', 'skills', 'internships', 'summary', 'experience'],
  startup: ['projects', 'experience', 'skills', 'education', 'achievements', 'summary'],
  designer: ['projects', 'summary', 'experience', 'skills', 'education'],
  dataAnalyst: ['summary', 'skills', 'projects', 'experience', 'education'],
  classic: ['summary', 'experience', 'education', 'projects', 'certifications'],
};

export const SECTION_HEADING_ALIASES: Record<CanonicalSectionKey, readonly RegExp[]> = {
  summary: [
    /^(?:professional\s+)?summary$/i,
    /^career\s+objective$/i,
    /^objective$/i,
    /^profile$/i,
    /^about(?:\s+me)?$/i,
  ],
  experience: [
    /^(?:professional\s+|work\s+)?experience$/i,
    /^employment(?:\s+history)?$/i,
    /^work history$/i,
    /^internships?$/i,
  ],
  education: [
    /^education$/i,
    /^academic(?:\s+background|\s+details)?$/i,
    /^qualifications?$/i,
  ],
  skills: [
    /^(?:technical|core)\s+skills$/i,
    /^skills$/i,
    /^core competencies$/i,
    /^technologies$/i,
  ],
  projects: [
    /^(?:technical\s+|academic\s+)?projects?$/i,
    /^selected projects$/i,
    /^personal projects$/i,
    /^portfolio$/i,
  ],
  certifications: [
    /^certifications?$/i,
    /^certificates?$/i,
    /^licenses?$/i,
    /^credentials?$/i,
  ],
  achievements: [
    /^achievements?$/i,
    /^awards?$/i,
    /^honors?$/i,
    /^accomplishments?$/i,
  ],
};

const canonicalKeySet = new Set<string>(CANONICAL_SECTION_KEYS);
export interface SectionOrderLike {
  sectionOrder?: unknown;
  sectionOrderMode?: 'template' | 'custom';
  customSections?: Array<{ id: string }>;
  templateId?: TemplateId;
}

export interface SectionPresenceLike {
  summary?: string;
  careerObjective?: string;
  experience?: Array<unknown>;
  internships?: Array<unknown>;
  education?: Array<unknown>;
  skills?: unknown;
  projects?: Array<unknown>;
  certifications?: Array<unknown>;
  achievements?: Array<unknown>;
}

export interface SectionContextLike extends SectionOrderLike, SectionPresenceLike {}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const normalizeHeading = (value: string) => value.replace(/[:|]+$/, '').trim().replace(/\s+/g, ' ');

const toString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const toStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean) : [];

export const isCanonicalSectionKey = (value: unknown): value is CanonicalSectionKey =>
  typeof value === 'string' && canonicalKeySet.has(value);

export function canonicalizeSectionId(input: unknown): string {
  const normalized = toString(input);
  if (!normalized) return '';
  const lower = normalizeHeading(normalized).toLowerCase();
  if (canonicalKeySet.has(lower)) return lower;
  const aliasMatch = (Object.entries(SECTION_HEADING_ALIASES) as Array<[CanonicalSectionKey, readonly RegExp[]]>)
    .find(([, patterns]) => patterns.some(pattern => pattern.test(lower)))?.[0];
  return aliasMatch || lower;
}

export const createDefaultSectionConfig = (): ResumeSectionConfig => (
  Object.fromEntries(
    STANDARD_SECTION_KEYS.map(sectionKey => [sectionKey, { mode: 'default' as const }])
  ) as ResumeSectionConfig
);

export const normalizeSectionConfig = (value: unknown): ResumeSectionConfig => {
  const incoming = value && typeof value === 'object'
    ? value as Partial<Record<StandardSectionKey, { mode?: unknown; customTitle?: unknown; linkDisplayMode?: unknown }>>
    : {};
  const defaults = createDefaultSectionConfig();

  STANDARD_SECTION_KEYS.forEach(sectionKey => {
    const config = incoming[sectionKey];
    if (!config || typeof config !== 'object') return;
    const customTitle = typeof config.customTitle === 'string' ? config.customTitle.trim() : '';
    const linkDisplayMode = config.linkDisplayMode === 'embedded' || config.linkDisplayMode === 'raw' || config.linkDisplayMode === 'inherit'
      ? config.linkDisplayMode
      : undefined;
    defaults[sectionKey] = {
      mode: config.mode === 'custom' && customTitle ? 'custom' : 'default',
      ...(customTitle ? { customTitle } : {}),
      ...(linkDisplayMode ? { linkDisplayMode } : {}),
    };
  });

  return defaults;
};

const isSectionConfigLike = (value: unknown): value is { sectionConfig?: unknown; customSections?: Array<{ id?: string; title?: string }>; sectionOrder?: unknown; sectionOrderMode?: unknown; hiddenSections?: unknown } =>
  isRecord(value);

const extractSectionConfig = (settings: unknown): ResumeSectionConfig => {
  if (settings && isRecord(settings) && 'summary' in settings && 'experience' in settings) {
    return normalizeSectionConfig(settings);
  }
  if (isSectionConfigLike(settings) && settings.sectionConfig) {
    return normalizeSectionConfig(settings.sectionConfig);
  }
  return createDefaultSectionConfig();
};

const extractCustomSectionTitle = (settings: unknown, sectionId: string) => {
  if (!isSectionConfigLike(settings) || !Array.isArray(settings.customSections)) return '';
  const match = settings.customSections.find(section => toString(section?.id) === sectionId);
  return toString(match?.title);
};

export function resolveSectionHeading(
  sectionId: string,
  settings: unknown,
  _templateId?: TemplateId | string
): string {
  const normalizedId = canonicalizeSectionId(sectionId);
  const customSectionTitle = extractCustomSectionTitle(settings, sectionId);
  if (customSectionTitle) return customSectionTitle;

  const sectionConfig = extractSectionConfig(settings);
  if (normalizedId in sectionConfig) {
    const config = sectionConfig[normalizedId as StandardSectionKey];
    const customTitle = config?.customTitle?.trim();
    if (config?.mode === 'custom' && customTitle) return customTitle;
    return DEFAULT_SECTION_HEADINGS[normalizedId as StandardSectionKey];
  }

  return sectionId
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, char => char.toUpperCase());
}

const hasSkills = (skills: unknown) => {
  if (!isRecord(skills)) return false;
  return Object.values(skills).some(value => Array.isArray(value) && value.length > 0);
};

export function isSectionPresent(
  resume: SectionPresenceLike,
  canonicalSectionId: CanonicalSectionKey | string
): boolean {
  const sectionId = canonicalizeSectionId(canonicalSectionId);
  switch (sectionId) {
    case 'summary':
      return Boolean((resume.summary || '').trim() || (resume as { careerObjective?: string }).careerObjective?.trim());
    case 'experience':
      return Boolean((resume.experience?.length || 0) > 0 || (resume.internships?.length || 0) > 0);
    case 'education':
      return Boolean((resume.education?.length || 0) > 0);
    case 'skills':
      return hasSkills(resume.skills);
    case 'projects':
      return Boolean((resume.projects?.length || 0) > 0);
    case 'certifications':
      return Boolean((resume.certifications?.length || 0) > 0);
    case 'achievements':
      return Boolean((resume.achievements?.length || 0) > 0);
    default:
      return false;
  }
}

const normalizeOrderList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
      .map(item => canonicalizeSectionId(item))
      .filter(Boolean)
      .filter((item, index, array) => array.indexOf(item) === index)
    : [];

export function getRecommendedSectionOrder(
  templateId: TemplateId | string,
  resumeContext: SectionContextLike = {}
): string[] {
  const canonicalPriorities = TEMPLATE_SECTION_PRIORITIES[templateId as TemplateId] || CANONICAL_SECTION_KEYS;
  const normalizedCurrent = normalizeOrderList(resumeContext.sectionOrder);
  const prioritized = canonicalPriorities
    .map(canonicalizeSectionId)
    .filter((sectionId): sectionId is string => Boolean(sectionId));
  const presentSections = prioritized.filter(sectionId => isSectionPresent(resumeContext, sectionId));
  const remainingPriorities = prioritized.filter(sectionId => !presentSections.includes(sectionId));
  const fallbackCanonical = CANONICAL_SECTION_KEYS.filter(sectionId => !prioritized.includes(sectionId));
  const customSections = resumeContext.customSections?.map(section => section.id).filter(Boolean) || [];

  return [
    ...presentSections,
    ...remainingPriorities,
    ...fallbackCanonical,
    ...customSections,
    ...normalizedCurrent.filter(sectionId => ![...presentSections, ...remainingPriorities, ...fallbackCanonical, ...customSections].includes(sectionId)),
  ];
}

export function getSectionOrder(
  resume: SectionOrderLike
): string[] {
  const customSectionIds = resume.customSections?.map(section => section.id).filter(Boolean) || [];
  const normalizedCurrent = normalizeOrderList(resume.sectionOrder);
  const currentOrder = normalizedCurrent.length
    ? normalizedCurrent.filter(sectionId => sectionId === 'languages' || sectionId === 'volunteering' || canonicalKeySet.has(sectionId) || customSectionIds.includes(sectionId))
    : [];
  const deduped = [...currentOrder];
  [...DEFAULT_SECTION_ORDER, ...customSectionIds].forEach(sectionId => {
    const normalizedId = canonicalizeSectionId(sectionId);
    const finalId = customSectionIds.includes(sectionId) ? sectionId : normalizedId;
    if (!deduped.includes(finalId)) deduped.push(finalId);
  });

  if (resume.sectionOrderMode === 'template') {
    return getRecommendedSectionOrder(resume.templateId as TemplateId, { ...resume, sectionOrder: deduped });
  }

  return deduped;
}
