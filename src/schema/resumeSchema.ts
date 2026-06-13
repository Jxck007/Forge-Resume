import { ResumeData } from '../types';
import { formatEducationScore } from '../utils/educationScore';

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

export interface NormalizedResume {
  source: ResumeData;
  projects: ResumeProject[];
  certifications: ResumeCertification[];
  skills: ResumeSkillBlock;
  education: ResumeEducation[];
  experience: ResumeExperience[];
  internships: ResumeExperience[];
  volunteering: ResumeExperience[];
  achievements: ResumeAchievement[];
}

const joinDate = (...parts: Array<string | undefined>) =>
  parts.map(part => part?.trim()).filter(Boolean).join(' - ');

const splitBullets = (description: string): string[] => {
  const lines = description
    .split(/\r?\n|(?:^|\s)[•●▪]\s+|(?:^|\s)-\s+/)
    .map(line => line.trim())
    .filter(Boolean);
  return lines.length > 0 ? lines : description.trim() ? [description.trim()] : [];
};

const splitTech = (technologies: string): string[] =>
  technologies
    .split(/[,;|]/)
    .map(value => value.trim())
    .filter(Boolean);

const normalizeExperience = (
  entries: Array<{
    id: string;
    title?: string;
    role?: string;
    company: string;
    location: string;
    startDate: string;
    endDate: string;
    description: string;
    technologiesUsed?: string;
  }>
): ResumeExperience[] =>
  entries.map(entry => ({
    id: entry.id,
    role: entry.role || entry.title || '',
    company: entry.company,
    location: entry.location,
    details: entry.technologiesUsed || undefined,
    date: joinDate(entry.startDate, entry.endDate),
    bullets: splitBullets(entry.description),
  }));

export const normalizeResumeData = (resume: ResumeData): NormalizedResume => ({
  source: resume,
  projects: resume.projects.map(project => ({
    id: project.id,
    title: project.name,
    date: joinDate(project.startDate, project.endDate),
    tech: splitTech(project.technologies),
    links: {
      github: project.github || undefined,
      demo: project.live || undefined,
    },
    description: project.description,
  })),
  certifications: resume.certifications.map(certification => ({
    id: certification.id,
    name: certification.name,
    issuer: certification.issuer,
    date: certification.date,
    credentialUrl: certification.url || undefined,
  })),
  skills: {
    languages: [...resume.skills.programmingLanguages],
    frameworks: [...resume.skills.frameworks],
    tools: [...resume.skills.tools],
    databases: [...resume.skills.databases],
    concepts: [...resume.skills.softSkills],
  },
  education: resume.education.map(education => ({
    id: education.id,
    degree: education.degree,
    institution: education.institution,
    location: education.location,
    date: joinDate(education.startDate, education.endDate),
    gpaOrPercentage: education.gpa ? formatEducationScore(education) : undefined,
    description: education.description,
  })),
  experience: normalizeExperience(resume.experience),
  internships: normalizeExperience(resume.internships || []),
  volunteering: normalizeExperience(resume.volunteering),
  achievements: resume.achievements.map((achievement, index) => {
    const [possibleTitle, ...rest] = achievement.split(':');
    const hasTitle = rest.length > 0 && possibleTitle.trim().length <= 80;
    return {
      id: `achievement-${index}`,
      title: hasTitle ? possibleTitle.trim() : '',
      description: hasTitle ? rest.join(':').trim() : achievement,
    };
  }),
});
