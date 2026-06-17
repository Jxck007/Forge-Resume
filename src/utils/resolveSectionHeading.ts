import {
  ResumeSectionConfig,
  StandardSectionKey,
  STANDARD_SECTION_KEYS,
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

export const createDefaultSectionConfig = (): ResumeSectionConfig => (
  Object.fromEntries(
    STANDARD_SECTION_KEYS.map(sectionKey => [sectionKey, { mode: 'default' as const }])
  ) as ResumeSectionConfig
);

export const normalizeSectionConfig = (value: unknown): ResumeSectionConfig => {
  const incoming = value && typeof value === 'object'
    ? value as Partial<Record<StandardSectionKey, { mode?: unknown; customTitle?: unknown }>>
    : {};
  const defaults = createDefaultSectionConfig();

  STANDARD_SECTION_KEYS.forEach(sectionKey => {
    const config = incoming[sectionKey];
    if (!config || typeof config !== 'object') return;
    const customTitle = typeof config.customTitle === 'string' ? config.customTitle.trim() : '';
    defaults[sectionKey] = {
      mode: config.mode === 'custom' && customTitle ? 'custom' : 'default',
      ...(customTitle ? { customTitle } : {}),
    };
  });

  return defaults;
};

export function resolveSectionHeading(
  sectionKey: StandardSectionKey,
  sectionConfig: ResumeSectionConfig,
  defaultTitle = DEFAULT_SECTION_HEADINGS[sectionKey]
): string {
  const config = sectionConfig[sectionKey];
  const customTitle = config?.customTitle?.trim();
  if (config?.mode === 'custom' && customTitle) return customTitle;
  return defaultTitle;
}
