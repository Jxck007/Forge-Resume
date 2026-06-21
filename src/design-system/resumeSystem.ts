import { TemplateId } from '../types';

export const resumeTypography = {
  name: 18.4,
  title: 10,
  sectionHeader: 11,
  entryTitle: 10,
  date: 9,
  body: 9.5,
  metadata: 8.5,
} as const;

export const resumeSpacing = {
  sectionGap: 5,
  entryGap: 2.5,
  lineHeight: 1.2,
  compactGap: 2,
  denseGap: 1.5,
} as const;

export const resumeAlignment = {
  railHeaderInset: 6,
  headingContentGap: 2.5,
  sidebarHeadingContentGap: 0.75,
  sidebarTopPadding: 5,
} as const;

export const resumeConstraints = {
  maxSkillsCategories: 5,
  maxContactLines: 1,
  maxProjectLines: 3,
  maxCertLines: 2,
  maxExperienceBulletLines: 4,
  maxEducationLines: 2,
} as const;

export const resumeLinkLabels = {
  github: 'GitHub',
  demo: 'Demo',
  portfolio: 'Portfolio',
  credential: 'Credential',
  linkedin: 'LinkedIn',
} as const;

export const resumeAtsRules = {
  singleColumnOnly: true,
  creativeSidebarAllowed: true,
  textFlowMustRemainLinear: true,
} as const;

export const resumeDensityRules = {
  sectionHeadersMustRemainSubordinate: true,
  boldLabelsOnly: true,
  decorativeBlankLines: false,
  unnecessarySectionPadding: false,
  minimumBodyFont: 10,
} as const;

export type ResumeLayoutFamily = 'ats' | 'student' | 'business' | 'creative';
export type ResumeDensity = 'dense' | 'compact' | 'balanced';
export type ResumeHeaderVariant =
  | 'strict'
  | 'modern'
  | 'corporate'
  | 'academic'
  | 'technical'
  | 'executive'
  | 'impact'
  | 'analytical'
  | 'minimal'
  | 'editorial'
  | 'creative'
  | 'portfolio';
export type ResumeEntryVariant =
  | 'plain'
  | 'rail'
  | 'compact'
  | 'card'
  | 'editorial';
export type ResumeSkillsVariant = 'rows' | 'inline' | 'compact-grid';

export interface ResumeTemplatePlan {
  family: ResumeLayoutFamily;
  density: ResumeDensity;
  header: ResumeHeaderVariant;
  entry: ResumeEntryVariant;
  skills: ResumeSkillsVariant;
  sectionOrder: readonly string[];
  bodyLayout: 'single' | 'sidebar';
  summaryStyle: 'plain' | 'lead' | 'executive';
  projectEmphasis: 'standard' | 'primary';
  atsLinear: boolean;
}

export const resumeTemplatePlans: Record<TemplateId, ResumeTemplatePlan> = {
  atsFriendly: {
    family: 'ats',
    density: 'dense',
    header: 'strict',
    entry: 'compact',
    skills: 'rows',
    sectionOrder: ['summary', 'skills', 'projects', 'experience', 'education', 'certifications'],
    bodyLayout: 'single',
    summaryStyle: 'plain',
    projectEmphasis: 'standard',
    atsLinear: true,
  },
  corporate: {
    family: 'ats',
    density: 'compact',
    header: 'corporate',
    entry: 'plain',
    skills: 'rows',
    sectionOrder: ['summary', 'experience', 'skills', 'education', 'certifications', 'projects'],
    bodyLayout: 'single',
    summaryStyle: 'lead',
    projectEmphasis: 'standard',
    atsLinear: true,
  },
  modern: {
    family: 'ats',
    density: 'compact',
    header: 'modern',
    entry: 'rail',
    skills: 'inline',
    sectionOrder: ['summary', 'skills', 'experience', 'projects', 'education', 'certifications'],
    bodyLayout: 'single',
    summaryStyle: 'plain',
    projectEmphasis: 'standard',
    atsLinear: true,
  },
  student: {
    family: 'student',
    density: 'compact',
    header: 'academic',
    entry: 'card',
    skills: 'inline',
    sectionOrder: ['summary', 'education', 'projects', 'skills', 'certifications', 'achievements', 'experience'],
    bodyLayout: 'single',
    summaryStyle: 'lead',
    projectEmphasis: 'primary',
    atsLinear: true,
  },
  softwareEngineer: {
    family: 'student',
    density: 'dense',
    header: 'technical',
    entry: 'rail',
    skills: 'rows',
    sectionOrder: ['summary', 'skills', 'projects', 'experience', 'education', 'certifications', 'achievements'],
    bodyLayout: 'single',
    summaryStyle: 'plain',
    projectEmphasis: 'primary',
    atsLinear: true,
  },
  executive: {
    family: 'business',
    density: 'balanced',
    header: 'executive',
    entry: 'editorial',
    skills: 'rows',
    sectionOrder: ['summary', 'experience', 'achievements', 'education', 'certifications', 'projects', 'skills'],
    bodyLayout: 'single',
    summaryStyle: 'executive',
    projectEmphasis: 'standard',
    atsLinear: true,
  },
  startup: {
    family: 'business',
    density: 'dense',
    header: 'impact',
    entry: 'card',
    skills: 'inline',
    sectionOrder: ['summary', 'projects', 'experience', 'achievements', 'skills', 'education', 'certifications'],
    bodyLayout: 'single',
    summaryStyle: 'lead',
    projectEmphasis: 'primary',
    atsLinear: true,
  },
  dataAnalyst: {
    family: 'business',
    density: 'dense',
    header: 'analytical',
    entry: 'rail',
    skills: 'rows',
    sectionOrder: ['summary', 'experience', 'projects', 'skills', 'achievements', 'education', 'certifications'],
    bodyLayout: 'single',
    summaryStyle: 'plain',
    projectEmphasis: 'primary',
    atsLinear: true,
  },
  minimal: {
    family: 'creative',
    density: 'dense',
    header: 'minimal',
    entry: 'compact',
    skills: 'inline',
    sectionOrder: ['summary', 'experience', 'education', 'skills', 'projects', 'certifications', 'achievements'],
    bodyLayout: 'single',
    summaryStyle: 'plain',
    projectEmphasis: 'standard',
    atsLinear: true,
  },
  classic: {
    family: 'creative',
    density: 'compact',
    header: 'editorial',
    entry: 'editorial',
    skills: 'rows',
    sectionOrder: ['summary', 'experience', 'education', 'projects', 'certifications', 'skills', 'achievements'],
    bodyLayout: 'single',
    summaryStyle: 'lead',
    projectEmphasis: 'standard',
    atsLinear: true,
  },
  creative: {
    family: 'creative',
    density: 'compact',
    header: 'creative',
    entry: 'card',
    skills: 'inline',
    sectionOrder: ['projects', 'summary', 'experience', 'achievements', 'skills', 'education', 'certifications'],
    bodyLayout: 'single',
    summaryStyle: 'lead',
    projectEmphasis: 'primary',
    atsLinear: true,
  },
  designer: {
    family: 'creative',
    density: 'compact',
    header: 'portfolio',
    entry: 'card',
    skills: 'inline',
    sectionOrder: ['projects', 'summary', 'experience', 'achievements', 'skills', 'education', 'certifications'],
    bodyLayout: 'sidebar',
    summaryStyle: 'plain',
    projectEmphasis: 'primary',
    atsLinear: false,
  },
};

export const resumeFamilyRules: Record<
  ResumeLayoutFamily,
  { singleColumn: boolean; description: string }
> = {
  ats: {
    singleColumn: true,
    description: 'Strict linear flow with maximum extraction safety and compact density.',
  },
  student: {
    singleColumn: true,
    description: 'Education, projects, and demonstrable skills receive earlier placement.',
  },
  business: {
    singleColumn: true,
    description: 'Experience and measurable impact lead without isolated metric graphics.',
  },
  creative: {
    singleColumn: false,
    description: 'Expressive hierarchy with Designer Portfolio as the only sidebar exception.',
  },
};
