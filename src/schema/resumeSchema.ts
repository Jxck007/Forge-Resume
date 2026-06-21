import { LinkDisplayMode, ProfileData, ResumeData, ResumeSectionConfig, StandardSectionKey, TemplateId, isTemplateId } from '../types';
import { DEFAULT_SECTION_ORDER, normalizeSectionOrder } from '../utils/sectionOrder';
import { formatEducationScore, normalizeEducationScore } from '../utils/educationScore';
import { createDefaultSectionConfig, normalizeSectionConfig } from '../utils/resolveSectionHeading';

export interface ResumeProject {
  id: string;
  title: string;
  date: string;
  tech: string[];
  links: {
    github?: string;
    demo?: string;
  };
  description: string;
}

export interface ResumeCertification {
  id: string;
  name: string;
  issuer: string;
  date: string;
  credentialUrl?: string;
}

export interface ResumeSkillBlock {
  languages: string[];
  frameworks: string[];
  tools: string[];
  databases: string[];
  concepts: string[];
}

export interface ResumeEducation {
  id: string;
  degree: string;
  institution: string;
  location: string;
  date: string;
  gpaOrPercentage?: string;
  description: string;
}

export interface ResumeExperience {
  id: string;
  role: string;
  company: string;
  location: string;
  details?: string;
  date: string;
  bullets: string[];
}

export interface ResumeAchievement {
  id: string;
  title: string;
  date?: string;
  description: string;
}

export type NormalizedResumeSource = 'blank' | 'profile' | 'parser' | 'import' | 'migration';

export interface NormalizedContact {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedIn: string;
  github: string;
  portfolio: string;
  otherLinks: string[];
}

export interface NormalizedSectionSettings {
  sectionConfig: ResumeSectionConfig;
  sectionOrder: string[];
  sectionOrderMode: 'template' | 'custom';
  hiddenSections: string[];
}

export interface NormalizedLinkSettings {
  defaultDisplayMode: Exclude<LinkDisplayMode, 'inherit'>;
  displayMode?: Exclude<LinkDisplayMode, 'inherit'>;
  otherLinks: string[];
}

export interface NormalizedResumeMetadata {
  normalizedAt: string;
  originalSchemaVersion?: number;
  importedAt?: string;
  migratedFrom?: string;
  notes: string[];
}

export interface NormalizedResume {
  id: string;
  ownerId?: string;
  title: string;
  templateId: TemplateId;
  createdAt: string;
  updatedAt: string;
  contact: NormalizedContact;
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedIn: string;
  github: string;
  portfolio: string;
  otherLinks: string[];
  summary: string;
  experience: ResumeExperience[];
  internships: ResumeExperience[];
  education: ResumeEducation[];
  skills: ResumeSkillBlock;
  projects: ResumeProject[];
  certifications: ResumeCertification[];
  achievements: ResumeAchievement[];
  volunteering: ResumeExperience[];
  sectionSettings: NormalizedSectionSettings;
  linkSettings: NormalizedLinkSettings;
  customSections: ResumeData['customSections'];
  metadata: NormalizedResumeMetadata;
  source: NormalizedResumeSource;
  schemaVersion: number;
  useProfilePhoto: boolean;
  sectionConfig: ResumeSectionConfig;
  linkDisplayMode: 'embedded' | 'raw';
  additionalDetails: string[];
  learningTargets: string[];
  candidateMode: 'student' | 'professional' | 'auto';
  resolvedCandidateMode: 'student' | 'professional';
}

const SCHEMA_VERSION = 1;

const nowIso = () => new Date().toISOString();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const toStr = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value.trim() : fallback;

const toArray = <T = unknown>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];

const uniqueStrings = (values: string[]) => Array.from(new Set(values.map(value => value.trim()).filter(Boolean)));

const firstString = (...values: unknown[]) => {
  for (const value of values) {
    const str = toStr(value);
    if (str) return str;
  }
  return '';
};

const flattenLinks = (value: unknown): string[] => {
  if (!value) return [];
  if (typeof value === 'string') return [value.trim()].filter(Boolean);
  if (Array.isArray(value)) {
    return uniqueStrings(value.flatMap(item => flattenLinks(item)));
  }
  if (!isRecord(value)) return [];
  return uniqueStrings([
    firstString(value.url, value.href, value.link, value.address),
    ...flattenLinks(value.otherLinks),
  ]);
};

const normalizeContact = (input: Record<string, unknown>): NormalizedContact => ({
  name: firstString(
    input.name,
    input.fullName,
    input.personalDetails && isRecord(input.personalDetails) ? input.personalDetails.fullName : '',
    input.contact && isRecord(input.contact) ? input.contact.name : ''
  ),
  email: firstString(
    input.email,
    input.personalDetails && isRecord(input.personalDetails) ? input.personalDetails.email : '',
    input.contact && isRecord(input.contact) ? input.contact.email : ''
  ),
  phone: firstString(
    input.phone,
    input.personalDetails && isRecord(input.personalDetails) ? input.personalDetails.phone : '',
    input.contact && isRecord(input.contact) ? input.contact.phone : ''
  ),
  location: firstString(
    input.location,
    input.personalDetails && isRecord(input.personalDetails) ? input.personalDetails.location : '',
    input.contact && isRecord(input.contact) ? input.contact.location : ''
  ),
  linkedIn: firstString(
    input.linkedIn,
    input.linkedin,
    input.personalDetails && isRecord(input.personalDetails) ? input.personalDetails.linkedin : '',
    input.contact && isRecord(input.contact) ? input.contact.linkedIn : '',
    input.contact && isRecord(input.contact) ? input.contact.linkedin : ''
  ),
  github: firstString(
    input.github,
    input.personalDetails && isRecord(input.personalDetails) ? input.personalDetails.github : '',
    input.contact && isRecord(input.contact) ? input.contact.github : ''
  ),
  portfolio: firstString(
    input.portfolio,
    input.website,
    input.personalDetails && isRecord(input.personalDetails) ? input.personalDetails.website : '',
    input.contact && isRecord(input.contact) ? input.contact.portfolio : '',
    input.contact && isRecord(input.contact) ? input.contact.website : ''
  ),
  otherLinks: uniqueStrings([
    ...flattenLinks(input.otherLinks),
    ...flattenLinks(input.links),
    ...flattenLinks(input.contact && isRecord(input.contact) ? input.contact.otherLinks : undefined),
  ]),
});

const normalizeSkills = (input: Record<string, unknown>): ResumeSkillBlock => {
  const skills = isRecord(input.skills) ? input.skills : {};
  const skillArray = Array.isArray(input.skills) ? input.skills : [];
  return {
    languages: uniqueStrings([
      ...toArray<string>(skills.programmingLanguages),
      ...toArray<string>(skills.languages),
      ...skillArray.map(value => String(value)),
    ]),
    frameworks: uniqueStrings([
      ...toArray<string>(skills.frameworks),
      ...toArray<string>(skills.libraries),
    ]),
    tools: uniqueStrings([
      ...toArray<string>(skills.tools),
      ...toArray<string>(skills.devTools),
    ]),
    databases: uniqueStrings([
      ...toArray<string>(skills.databases),
      ...toArray<string>(skills.dataStores),
    ]),
    concepts: uniqueStrings([
      ...toArray<string>(skills.softSkills),
      ...toArray<string>(skills.concepts),
    ]),
  };
};

const joinDate = (...parts: Array<string | undefined>) => parts.map(part => part?.trim()).filter(Boolean).join(' - ');

const splitBullets = (description: string): string[] => {
  const lines = description
    .split(/\r?\n|(?:^|\s)[•●▪]\s+|(?:^|\s)-\s+/)
    .map(line => line.trim())
    .filter(Boolean);
  return lines.length > 0 ? lines : description.trim() ? [description.trim()] : [];
};

const splitTech = (technologies: string): string[] =>
  uniqueStrings(
    technologies
      .split(/[,;|]/)
      .map(value => value.trim())
      .filter(Boolean)
  );

const normalizeExperience = (
  entries: Array<{
    id?: string;
    title?: string;
    role?: string;
    company?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    description?: string;
    technologiesUsed?: string;
  }>
): ResumeExperience[] =>
  entries.map((entry, index) => ({
    id: entry.id || `exp-${index}`,
    role: firstString(entry.role, entry.title),
    company: firstString(entry.company),
    location: firstString(entry.location),
    details: entry.technologiesUsed ? entry.technologiesUsed.trim() : undefined,
    date: joinDate(entry.startDate, entry.endDate),
    bullets: splitBullets(firstString(entry.description)),
  }));

const normalizeEducation = (
  entries: Array<{
    id?: string;
    degree?: string;
    institution?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    gpa?: string;
    scoreType?: unknown;
    description?: string;
    gpaOrPercentage?: string;
    date?: string;
  }>
): ResumeEducation[] =>
  entries.map((entry, index) => {
    const normalizedScore = normalizeEducationScore(entry as Record<string, unknown>);
    const scoreLabel = formatEducationScore({
      degree: firstString(entry.degree),
      gpa: normalizedScore.gpa,
      scoreType: normalizedScore.scoreType,
    });
    return {
      id: entry.id || `edu-${index}`,
      degree: firstString(entry.degree),
      institution: firstString(entry.institution),
      location: firstString(entry.location),
      date: firstString(entry.date, joinDate(entry.startDate, entry.endDate)),
      gpaOrPercentage: firstString(entry.gpaOrPercentage, scoreLabel, normalizedScore.gpa),
      description: firstString(entry.description),
    };
  });

const normalizeProjects = (entries: Array<{
  id?: string;
  name?: string;
  title?: string;
  description?: string;
  technologies?: string;
  tech?: string[];
  startDate?: string;
  endDate?: string;
  date?: string;
  github?: string;
  live?: string;
  links?: { github?: string; demo?: string };
}>): ResumeProject[] =>
  entries.map((entry, index) => ({
    id: entry.id || `proj-${index}`,
    title: firstString(entry.title, entry.name),
    date: firstString(entry.date, joinDate(entry.startDate, entry.endDate)),
    tech: splitTech([
      ...(entry.tech || []),
      ...(entry.technologies ? [entry.technologies] : []),
    ].join(', ')),
    links: {
      github: firstString(entry.github, entry.links?.github) || undefined,
      demo: firstString(entry.live, entry.links?.demo) || undefined,
    },
    description: firstString(entry.description),
  }));

const normalizeCertifications = (entries: Array<{
  id?: string;
  name?: string;
  issuer?: string;
  date?: string;
  url?: string;
  credentialUrl?: string;
}>): ResumeCertification[] =>
  entries.map((entry, index) => ({
    id: entry.id || `cert-${index}`,
    name: firstString(entry.name),
    issuer: firstString(entry.issuer),
    date: firstString(entry.date),
    credentialUrl: firstString(entry.url, entry.credentialUrl) || undefined,
  }));

const normalizeAchievements = (entries: unknown[]): ResumeAchievement[] =>
  entries.map((entry, index) => {
    if (typeof entry === 'string') {
      const [possibleTitle, ...rest] = entry.split(':');
      const hasTitle = rest.length > 0 && possibleTitle.trim().length <= 80;
      return {
        id: `ach-${index}`,
        title: hasTitle ? possibleTitle.trim() : '',
        description: hasTitle ? rest.join(':').trim() : entry.trim(),
      };
    }

    if (!isRecord(entry)) {
      return {
        id: `ach-${index}`,
        title: '',
        description: '',
      };
    }

    return {
      id: firstString(entry.id, `ach-${index}`),
      title: firstString(entry.title),
      date: firstString(entry.date) || undefined,
      description: firstString(entry.description, entry.text),
    };
  });

const normalizeCustomSections = (input: unknown): ResumeData['customSections'] => {
  const sections = toArray<Record<string, unknown>>(input);
  return sections.map((section, index) => ({
    id: firstString(section.id, `custom-${index}`),
    title: firstString(section.title),
    items: toArray<Record<string, unknown>>(section.items).map((item, itemIndex) => ({
      id: firstString(item.id, `custom-${index}-${itemIndex}`),
      title: firstString(item.title),
      subtitle: firstString(item.subtitle) || undefined,
      date: firstString(item.date) || undefined,
      description: firstString(item.description),
    })),
  }));
};

const normalizeSource = (input: Record<string, unknown>, fallback: NormalizedResumeSource): NormalizedResumeSource => {
  const candidate = firstString(input.source);
  if (candidate === 'blank' || candidate === 'profile' || candidate === 'parser' || candidate === 'import' || candidate === 'migration') {
    return candidate;
  }
  if (fallback) return fallback;
  if (Array.isArray(input.pages) || Array.isArray(input.textItems) || input.fileName || input.parser) return 'parser';
  if (input.importSource || input.importMode) return 'import';
  if (input.careerObjective || input.personalDetails || input.profile) return 'profile';
  if (!Object.keys(input).length) return 'blank';
  return 'migration';
};

const normalizeMetadata = (
  input: Record<string, unknown>,
  source: NormalizedResumeSource,
  normalizedAt: string
): NormalizedResumeMetadata => {
  const metadata = isRecord(input.metadata) ? input.metadata : {};
  return {
    normalizedAt,
    originalSchemaVersion: typeof input.schemaVersion === 'number' ? input.schemaVersion : undefined,
    importedAt: firstString(metadata.importedAt, input.importedAt) || undefined,
    migratedFrom: firstString(metadata.migratedFrom, input.migratedFrom) || undefined,
    notes: uniqueStrings([
      ...toArray<string>(metadata.notes),
      source === 'migration' ? 'Normalized from legacy resume shape.' : '',
      source === 'blank' ? 'Initialized as blank resume.' : '',
    ]),
  };
};

export function createEmptyNormalizedResume(): NormalizedResume {
  const normalizedAt = nowIso();
  const sectionConfig = createDefaultSectionConfig();
  return {
    id: `resume_${Math.random().toString(36).substring(2, 11)}`,
    ownerId: undefined,
    title: 'Untitled Resume',
    templateId: 'modern',
    createdAt: normalizedAt,
    updatedAt: normalizedAt,
    contact: {
      name: '',
      email: '',
      phone: '',
      location: '',
      linkedIn: '',
      github: '',
      portfolio: '',
      otherLinks: [],
    },
    name: '',
    email: '',
    phone: '',
    location: '',
    linkedIn: '',
    github: '',
    portfolio: '',
    otherLinks: [],
    summary: '',
    experience: [],
    internships: [],
    education: [],
    skills: {
      languages: [],
      frameworks: [],
      tools: [],
      databases: [],
      concepts: [],
    },
    projects: [],
    certifications: [],
    achievements: [],
    volunteering: [],
    sectionSettings: {
      sectionConfig,
      sectionOrder: [...DEFAULT_SECTION_ORDER],
      sectionOrderMode: 'custom',
      hiddenSections: [],
    },
    linkSettings: {
      defaultDisplayMode: 'embedded',
      otherLinks: [],
    },
    customSections: [],
    metadata: {
      normalizedAt,
      notes: ['Initialized as blank resume.'],
    },
    source: 'blank',
    schemaVersion: SCHEMA_VERSION,
    useProfilePhoto: false,
    sectionConfig,
    linkDisplayMode: 'embedded',
    additionalDetails: [],
    learningTargets: [],
    candidateMode: 'auto',
    resolvedCandidateMode: 'student',
  };
}

const uniqueByJson = <T,>(items: T[]): T[] => {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = JSON.stringify(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export function normalizeResumeModel(
  input: unknown,
  options?: { source?: NormalizedResumeSource }
): NormalizedResume {
  const raw = isRecord(input) ? input : {};
  const normalizedAt = nowIso();
  const contact = normalizeContact(raw);
  const rawSectionSettings: Record<string, unknown> = isRecord(raw.sectionSettings) ? raw.sectionSettings : {};
  const rawSummary: Record<string, unknown> = isRecord(raw.summary) ? raw.summary : {};
  const sectionConfig = normalizeSectionConfig(
    raw.sectionConfig || rawSectionSettings.sectionConfig || rawSectionSettings || createDefaultSectionConfig()
  );
  const customSections = normalizeCustomSections(raw.customSections);
  const sectionOrder = normalizeSectionOrder(
    rawSectionSettings.sectionOrder || raw.sectionOrder,
    customSections.map(section => section.id)
  );
  const sectionOrderMode = rawSectionSettings.sectionOrderMode === 'template'
    ? 'template'
    : raw.sectionOrderMode === 'template'
      ? 'template'
      : 'custom';
  const hiddenSections = uniqueStrings([
    ...toArray<string>(raw.hiddenSections),
    ...toArray<string>(rawSectionSettings.hiddenSections),
  ]);
  const rawLinkSettings: Record<string, unknown> = isRecord(raw.linkSettings) ? raw.linkSettings : {};
  const linkDisplayMode = rawLinkSettings.defaultDisplayMode === 'raw' || rawLinkSettings.displayMode === 'raw'
    ? 'raw'
    : raw.linkDisplayMode === 'raw'
      ? 'raw'
      : 'embedded';
  const otherLinks = uniqueStrings([
    ...contact.otherLinks,
    ...flattenLinks(raw.otherLinks),
  ]);
  const source = normalizeSource(raw, options?.source || 'migration');

  const normalized: NormalizedResume = {
    id: firstString(raw.id, `resume_${Math.random().toString(36).substring(2, 11)}`),
    ownerId: firstString(raw.ownerId, raw.userId) || undefined,
    title: firstString(raw.title, 'Untitled Resume'),
    templateId: isTemplateId(raw.templateId) ? raw.templateId : 'modern',
    createdAt: firstString(raw.createdAt, normalizedAt),
    updatedAt: firstString(raw.updatedAt, normalizedAt),
    contact,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    location: contact.location,
    linkedIn: contact.linkedIn,
    github: contact.github,
    portfolio: contact.portfolio,
    otherLinks,
    summary: firstString(raw.summary, raw.careerObjective, rawSummary.content),
    experience: normalizeExperience(
      toArray<Record<string, unknown>>(raw.experience || raw.workExperience || raw.employmentHistory)
        .map((entry, index) => ({
          id: firstString(entry.id, `exp-${index}`),
          title: firstString(entry.title),
          role: firstString(entry.role, entry.title),
          company: firstString(entry.company),
          location: firstString(entry.location),
          startDate: firstString(entry.startDate),
          endDate: firstString(entry.endDate),
          description: firstString(entry.description, entry.details),
          technologiesUsed: firstString(entry.technologiesUsed),
        }))
    ),
    internships: normalizeExperience(
      toArray<Record<string, unknown>>(raw.internships).map((entry, index) => ({
        id: firstString(entry.id, `intern-${index}`),
        title: firstString(entry.title, entry.role),
        role: firstString(entry.role, entry.title),
        company: firstString(entry.company),
        location: firstString(entry.location),
        startDate: firstString(entry.startDate),
        endDate: firstString(entry.endDate),
        description: firstString(entry.description, entry.details),
        technologiesUsed: firstString(entry.technologiesUsed),
      }))
    ),
    education: normalizeEducation(toArray<Record<string, unknown>>(raw.education)),
    skills: normalizeSkills(raw),
    projects: normalizeProjects(toArray<Record<string, unknown>>(raw.projects || raw.portfolioProjects)),
    certifications: normalizeCertifications(toArray<Record<string, unknown>>(raw.certifications || raw.certs)),
    achievements: normalizeAchievements(toArray<unknown>(raw.achievements || raw.awards)),
    volunteering: normalizeExperience(
      toArray<Record<string, unknown>>(raw.volunteering).map((entry, index) => ({
        id: firstString(entry.id, `vol-${index}`),
        title: firstString(entry.title, entry.role),
        role: firstString(entry.role, entry.title),
        company: firstString(entry.company),
        location: firstString(entry.location),
        startDate: firstString(entry.startDate),
        endDate: firstString(entry.endDate),
        description: firstString(entry.description, entry.details),
        technologiesUsed: firstString(entry.technologiesUsed),
      }))
    ),
    sectionSettings: {
      sectionConfig,
      sectionOrder,
      sectionOrderMode,
      hiddenSections,
    },
    linkSettings: {
      defaultDisplayMode: linkDisplayMode,
      displayMode: linkDisplayMode,
      otherLinks,
    },
    customSections,
    metadata: normalizeMetadata(raw, source, normalizedAt),
    source,
    schemaVersion: typeof raw.schemaVersion === 'number' ? raw.schemaVersion : SCHEMA_VERSION,
    useProfilePhoto: raw.useProfilePhoto !== false,
    sectionConfig,
    linkDisplayMode,
    additionalDetails: uniqueStrings(toArray<string>(raw.additionalDetails).map(value => toStr(value))),
    learningTargets: uniqueStrings(toArray<string>(raw.learningTargets).map(value => toStr(value))),
    candidateMode: raw.candidateMode === 'student' || raw.candidateMode === 'professional' ? raw.candidateMode : 'auto',
    resolvedCandidateMode:
      raw.candidateMode === 'student' || raw.candidateMode === 'professional'
        ? raw.candidateMode
        : toArray<unknown>(raw.experience).length > 0 ? 'professional' : 'student',
  };

  return normalized;
}

export function mergeProfileIntoResume(profile: ProfileData, resume: unknown): NormalizedResume {
  const normalizedResume = normalizeResumeModel(resume, { source: 'migration' });
  const profileContact = normalizeContact(profile as unknown as Record<string, unknown>);
  const profileModel = normalizeResumeModel(profile as unknown as Record<string, unknown>, { source: 'profile' });

  return {
    ...normalizedResume,
    ownerId: normalizedResume.ownerId || profile.uid || undefined,
    contact: {
      name: profileContact.name || normalizedResume.contact.name,
      email: profileContact.email || normalizedResume.contact.email,
      phone: profileContact.phone || normalizedResume.contact.phone,
      location: profileContact.location || normalizedResume.contact.location,
      linkedIn: profileContact.linkedIn || normalizedResume.contact.linkedIn,
      github: profileContact.github || normalizedResume.contact.github,
      portfolio: profileContact.portfolio || normalizedResume.contact.portfolio,
      otherLinks: uniqueByJson([...profileContact.otherLinks, ...normalizedResume.contact.otherLinks]),
    },
    name: profileContact.name || normalizedResume.name,
    email: profileContact.email || normalizedResume.email,
    phone: profileContact.phone || normalizedResume.phone,
    location: profileContact.location || normalizedResume.location,
    linkedIn: profileContact.linkedIn || normalizedResume.linkedIn,
    github: profileContact.github || normalizedResume.github,
    portfolio: profileContact.portfolio || normalizedResume.portfolio,
    otherLinks: uniqueByJson([...profileContact.otherLinks, ...normalizedResume.otherLinks]),
    summary: profile.summary?.trim() || profile.careerObjective?.trim() || normalizedResume.summary,
    experience: profileModel.experience.length > 0 ? profileModel.experience : normalizedResume.experience,
    internships: profileModel.internships.length > 0 ? profileModel.internships : normalizedResume.internships,
    education: profileModel.education.length > 0 ? profileModel.education : normalizedResume.education,
    skills: {
      languages: profileModel.skills.languages.length > 0 ? profileModel.skills.languages : normalizedResume.skills.languages,
      frameworks: profileModel.skills.frameworks.length > 0 ? profileModel.skills.frameworks : normalizedResume.skills.frameworks,
      tools: profileModel.skills.tools.length > 0 ? profileModel.skills.tools : normalizedResume.skills.tools,
      databases: profileModel.skills.databases.length > 0 ? profileModel.skills.databases : normalizedResume.skills.databases,
      concepts: profileModel.skills.concepts.length > 0 ? profileModel.skills.concepts : normalizedResume.skills.concepts,
    },
    projects: profileModel.projects.length > 0 ? profileModel.projects : normalizedResume.projects,
    certifications: profileModel.certifications.length > 0 ? profileModel.certifications : normalizedResume.certifications,
    achievements: profileModel.achievements.length > 0 ? profileModel.achievements : normalizedResume.achievements,
    volunteering: profileModel.volunteering.length > 0 ? profileModel.volunteering : normalizedResume.volunteering,
    sectionSettings: {
      sectionConfig: normalizedResume.sectionConfig,
      sectionOrder: normalizedResume.sectionSettings.sectionOrder,
      sectionOrderMode: normalizedResume.sectionSettings.sectionOrderMode,
      hiddenSections: normalizedResume.sectionSettings.hiddenSections,
    },
    linkSettings: {
      defaultDisplayMode: profile.linkDisplayMode === 'raw' ? 'raw' : normalizedResume.linkSettings.defaultDisplayMode,
      displayMode: profile.linkDisplayMode === 'raw' ? 'raw' : normalizedResume.linkSettings.displayMode,
      otherLinks: uniqueByJson([...profileContact.otherLinks, ...normalizedResume.linkSettings.otherLinks]),
    },
    customSections: profile.customSections?.length ? profile.customSections : normalizedResume.customSections,
    metadata: {
      ...normalizedResume.metadata,
      notes: uniqueStrings([
        ...normalizedResume.metadata.notes,
        'Merged profile data into resume.',
      ]),
    },
    source: normalizedResume.source === 'blank' ? 'profile' : normalizedResume.source,
    schemaVersion: SCHEMA_VERSION,
    useProfilePhoto: profile.personalDetails?.profilePhoto ? true : normalizedResume.useProfilePhoto,
    sectionConfig: normalizedResume.sectionConfig,
    linkDisplayMode: profile.linkDisplayMode === 'raw' ? 'raw' : normalizedResume.linkDisplayMode,
  };
}

export const normalizeResumeData = (resume: ResumeData): NormalizedResume => normalizeResumeModel(resume, { source: 'migration' });

export function mergeNormalizedIntoResumeData(normalized: NormalizedResume, base: ResumeData): ResumeData {
  const projectById = new Map(normalized.projects.map(project => [project.id, project]));
  const experienceById = new Map(normalized.experience.map(entry => [entry.id, entry]));

  return {
    ...base,
    summary: normalized.summary,
    skills: {
      programmingLanguages: [...normalized.skills.languages],
      frameworks: [...normalized.skills.frameworks],
      tools: [...normalized.skills.tools],
      databases: [...normalized.skills.databases],
      softSkills: [...normalized.skills.concepts],
    },
    projects: base.projects.map(project => {
      const next = projectById.get(project.id);
      return next ? {
        ...project,
        name: next.title,
        description: next.description,
        technologies: next.tech.join(', '),
        github: next.links.github || '',
        live: next.links.demo || '',
      } : project;
    }),
    experience: base.experience.map(entry => {
      const next = experienceById.get(entry.id);
      return next ? { ...entry, title: next.role, description: next.bullets.join('\n') } : entry;
    }),
    sectionOrder: [...normalized.sectionSettings.sectionOrder],
    sectionOrderMode: normalized.sectionSettings.sectionOrderMode,
    linkDisplayMode: normalized.linkSettings.defaultDisplayMode,
    linkSettings: { defaultDisplayMode: normalized.linkSettings.defaultDisplayMode },
    additionalDetails: [...normalized.additionalDetails],
    learningTargets: [...normalized.learningTargets],
    candidateMode: normalized.candidateMode,
    updatedAt: new Date().toISOString(),
  };
}
