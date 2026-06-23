/**
 * Resume Normalizer for Export Engines
 *
 * Provides a clean, renderer-agnostic extraction from ResumeData.
 * Each export engine uses this to avoid duplicating field access logic.
 *
 * Future Typst engine will use the same normalization.
 */
import type { ResumeData } from '../types';

export interface NormalizedExportField {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  website: string;
  summary: string;
  experience: Array<{
    title: string;
    company: string;
    location: string;
    startDate: string;
    endDate: string;
    description: string;
  }>;
  education: Array<{
    degree: string;
    institution: string;
    location: string;
    startDate: string;
    endDate: string;
    gpa: string;
    description: string;
  }>;
  projects: Array<{
    name: string;
    description: string;
    technologies: string;
    startDate: string;
    endDate: string;
    github: string;
    live: string;
  }>;
  skills: {
    programmingLanguages: string[];
    frameworks: string[];
    tools: string[];
    databases: string[];
    softSkills: string[];
  };
  certifications: Array<{
    name: string;
    issuer: string;
    date: string;
    url: string;
  }>;
  achievements: string[];
  languages: string[];
}

export function normalizeForExport(resume: ResumeData): NormalizedExportField {
  return {
    name: resume.personalDetails?.fullName || '',
    email: resume.personalDetails?.email || '',
    phone: resume.personalDetails?.phone || '',
    location: resume.personalDetails?.location || '',
    linkedin: resume.personalDetails?.linkedin || '',
    github: resume.personalDetails?.github || '',
    website: resume.personalDetails?.website || '',
    summary: resume.summary || '',
    experience: (resume.experience || []).map(e => ({
      title: e.title,
      company: e.company,
      location: e.location,
      startDate: e.startDate,
      endDate: e.endDate,
      description: e.description,
    })),
    education: (resume.education || []).map(e => ({
      degree: e.degree,
      institution: e.institution,
      location: e.location,
      startDate: e.startDate,
      endDate: e.endDate,
      gpa: e.gpa,
      description: e.description,
    })),
    projects: (resume.projects || []).map(p => ({
      name: p.name,
      description: p.description,
      technologies: p.technologies,
      startDate: p.startDate || '',
      endDate: p.endDate || '',
      github: p.github,
      live: p.live,
    })),
    skills: {
      programmingLanguages: resume.skills?.programmingLanguages || [],
      frameworks: resume.skills?.frameworks || [],
      tools: resume.skills?.tools || [],
      databases: resume.skills?.databases || [],
      softSkills: resume.skills?.softSkills || [],
    },
    certifications: (resume.certifications || []).map(c => ({
      name: c.name,
      issuer: c.issuer,
      date: c.date,
      url: c.url,
    })),
    achievements: resume.achievements || [],
    languages: resume.languages || [],
  };
}
