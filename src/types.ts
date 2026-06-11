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

export interface EducationEntry {
  id: string;
  degree: string;
  institution: string;
  location: string;
  startDate: string;
  endDate: string;
  gpa: string;
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
  userId: string;
  title: string;
  templateId: TemplateId;
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
  sectionOrder: string[];
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
  updatedAt: string;
}

export interface AtsReport {
  id: string;
  resumeId: string;
  userId: string;
  jobDescription: string;
  score: number;
  breakdown: {
    formatting: number;
    skills: number;
    experience: number;
    keyword: number;
    education: number;
  };
  matchScore: number;
  keywordCoverage: number;
  missingSkills: string[];
  missingKeywords: string[];
  suggestedImprovements: string[];
  strengths: string[];
  weaknesses: string[];
  createdAt: string;
}
