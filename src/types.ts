export const TEMPLATE_IDS = [
  'modern',
  'minimal',
  'corporate',
  'executive',
  'creative',
  'atsFriendly',
  'softwareEngineer',
  'student',
  'startup',
  'designer',
  'dataAnalyst',
  'classic',
] as const;

export type TemplateId = (typeof TEMPLATE_IDS)[number];

export function isTemplateId(value: unknown): value is TemplateId {
  return typeof value === 'string' && TEMPLATE_IDS.includes(value as TemplateId);
}

export const STANDARD_SECTION_KEYS = [
  'summary',
  'education',
  'experience',
  'skills',
  'projects',
  'certifications',
  'achievements',
  'internships',
  'volunteering',
  'languages',
] as const;

export type StandardSectionKey = (typeof STANDARD_SECTION_KEYS)[number];

export interface SectionHeadingConfig {
  mode: 'default' | 'custom';
  customTitle?: string;
}

export type ResumeSectionConfig = Record<StandardSectionKey, SectionHeadingConfig>;

export type LanguageIssueSeverity = 'low' | 'medium' | 'high';
export type LanguageIssueCategory =
  | 'spelling'
  | 'grammar'
  | 'clarity'
  | 'consistency'
  | 'duplicate';

export interface LanguageSuggestion {
  id: string;
  replacement: string;
  label: string;
  status: 'pending' | 'accepted' | 'dismissed';
}

export interface LanguageIssue {
  id: string;
  path: string;
  sectionKey: string;
  label: string;
  message: string;
  category: LanguageIssueCategory;
  severity: LanguageIssueSeverity;
  originalText: string;
  suggestions: LanguageSuggestion[];
}

export interface ResumeLanguageQuality {
  score: number;
  issues: LanguageIssue[];
  summary: {
    total: number;
    spelling: number;
    grammar: number;
    clarity: number;
    consistency: number;
    duplicate: number;
    highSeverity: number;
  };
  updatedAt: string;
}

export interface PersonalDetails {
  fullName: string;
  professionalTitle: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  website: string;
  profilePhoto?: string;
}

export type EducationScoreType = 'cgpa' | 'gpa' | 'percentage';

export interface EducationEntry {
  id: string;
  degree: string;
  institution: string;
  location: string;
  startDate: string;
  endDate: string;
  gpa: string;
  scoreType?: EducationScoreType;
  description: string;
}

export interface ExperienceEntry {
  id: string;
  title: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface ProjectEntry {
  id: string;
  name: string;
  description: string;
  technologies: string;
  startDate?: string;
  endDate?: string;
  github: string;
  live: string;
}

export interface SkillCategory {
  programmingLanguages: string[];
  frameworks: string[];
  tools: string[];
  databases: string[];
  softSkills: string[];
}

export interface CertificationEntry {
  id: string;
  name: string;
  issuer: string;
  date: string;
  url: string;
}

export interface CustomSectionItem {
  id: string;
  title: string;
  subtitle?: string;
  date?: string;
  description: string;
}

export interface InternshipEntry {
  id: string;
  role: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  description: string;
  technologiesUsed: string;
}

export interface CustomSection {
  id: string;
  title: string;
  items: CustomSectionItem[];
}

export interface ResumeData {
  id: string;
  ownerId: string;
  userId: string;
  title: string;
  templateId: TemplateId;
  linkDisplayMode: 'embedded' | 'raw';
  useProfilePhoto: boolean;
  personalDetails: PersonalDetails;
  summary: string;
  education: EducationEntry[];
  experience: ExperienceEntry[];
  internships?: InternshipEntry[];
  projects: ProjectEntry[];
  skills: SkillCategory;
  certifications: CertificationEntry[];
  achievements: string[];
  volunteering: ExperienceEntry[]; // shared model
  languages: string[];
  customSections: CustomSection[];
  sectionConfig: ResumeSectionConfig;
  languageQuality: ResumeLanguageQuality;
  sectionOrder: string[];
  sectionOrderMode?: 'template' | 'custom';
  hiddenSections: string[];
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserSettings {
  uid: string;
  email: string;
  aiProvider: 'Groq' | 'Gemini' | 'OpenAI' | 'OpenRouter';
  groqApiKey?: string;
  geminiApiKey?: string;
  openaiApiKey?: string;
  openRouterApiKey?: string;
  hasCompletedProfile?: boolean;
  modelId?: string;
  providerModels?: Partial<Record<UserSettings['aiProvider'], string>>;
  temperature?: number;
  defaultTemplate?: string;
  defaultExportFormat?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProfileData {
  uid: string;
  personalDetails: PersonalDetails;
  summary: string;
  careerObjective: string;
  education: EducationEntry[];
  experience: ExperienceEntry[];
  internships: InternshipEntry[];
  projects: ProjectEntry[];
  skills: SkillCategory;
  certifications: CertificationEntry[];
  achievements: string[];
  volunteering: ExperienceEntry[];
  languages: string[];
  customSections: CustomSection[];
  linkDisplayMode?: 'embedded' | 'raw';
  updatedAt: string;
}

export type AtsDiagnosticCategoryId =
  | 'contentQuality'
  | 'sectionCompleteness'
  | 'sectionOrder'
  | 'atsFormatting'
  | 'keywordsMatch'
  | 'layoutStructure'
  | 'hrRiskFlags'
  | 'seniorityFit'
  | 'tailoringScore'
  | 'responsivenessScore';

export type AtsIssueSeverity = 'low' | 'medium' | 'high';
export type AtsIssueCategory = 'content' | 'layout' | 'structure' | 'spelling' | 'atsRules' | 'responsiveness';

export interface AtsDiagnosticIssue {
  id: string;
  title: string;
  severity: AtsIssueSeverity;
  category: AtsIssueCategory;
  affectedSection: string;
  explanation: string;
  suggestedFix: string;
  location: string;
  impact: number;
}

export interface AtsDiagnosticCategoryScore {
  id: AtsDiagnosticCategoryId;
  label: string;
  score: number;
  explanation: string;
  issues: string[];
}

export interface AtsLanguageAnalysis {
  spellingAccuracy: number;
  grammarCorrectness: number;
  readability: number;
  clarity: number;
}

export interface AtsLayoutAnalysis {
  estimatedLineDensity: number;
  sectionSizeWeight: number;
  templateScalingFactor: number;
  expectedColumns: 'single' | 'flexible';
  detectedColumns: 'single' | 'multi';
}

export interface AtsResponsivenessAnalysis {
  score: number;
  mobileScore: number;
  tabletScore: number;
  textOverflowRisk: 'low' | 'medium' | 'high';
  columnCollapseRisk: 'low' | 'medium' | 'high';
  notes: string[];
}

export interface AtsReport {
  id: string;
  resumeId: string;
  userId: string;
  jobDescription: string;
  atsScore: number;
  matchScore: number | null;
  breakdown: {
    parsing: number;
    contact: number;
    completeness: number;
    skills: number;
    experience: number;
    projects: number;
    readability: number;
  };
  pageFitDetails: {
    score: number;
    estimatedPages: number;
    fitCategory: 'single-page safe' | 'near limit' | 'multi-page likely';
    overflowRisk: 'low' | 'medium' | 'high';
  };
  keywordGaps: {
    missing: string[];
    weakCoverage: string[];
    strongCoverage: string[];
  };
  skillAnalysis: {
    coveragePercent: number;
    diversityScore: number;
    visible: boolean;
    placement: 'main' | 'sidebar';
    templateFamily: 'ats' | 'student' | 'business' | 'creative' | 'unknown';
  };
  projectAnalysis: {
    hasLinks: number;
    hasMetrics: number;
    qualityScore: number;
  };
  targetComparison: {
    roleFamily:
      | 'software-development'
      | 'cybersecurity'
      | 'data-analytics'
      | 'product-startup'
      | 'design-creative'
      | 'general-other';
    roleFamilyLabel: string;
    keywordOverlap: number;
    roleRelevance: number;
    skillAlignment: number;
    projectEvidence: number;
    experienceEvidence: number;
    missingCriticalSkills: string[];
    positionalKeywords: string[];
    strongEvidence: string[];
    weakEvidence: string[];
  } | null;
  analysisModules: Array<{
    id: 'content' | 'structure' | 'evidence' | 'roleMatch' | 'pageFit' | 'synthesis';
    label: string;
    score: number;
    status: 'passed' | 'review';
    evidence: string;
  }>;
  strengths: string[];
  missingItems: string[];
  warnings: string[];
  recommendations: string[];
  diagnosticCategories: AtsDiagnosticCategoryScore[];
  diagnosticIssues: AtsDiagnosticIssue[];
  languageAnalysis: AtsLanguageAnalysis;
  layoutAnalysis: AtsLayoutAnalysis;
  responsivenessAnalysis: AtsResponsivenessAnalysis;
  createdAt: string;
}
