import { isTemplateId, ResumeData } from './types';
import { normalizeSectionOrder } from './utils/sectionOrder';
import { normalizeEducationScore } from './utils/educationScore';
import { analyzeResumeLanguageQuality } from './utils/languageQuality';
import { createDefaultSectionConfig, normalizeSectionConfig } from './utils/resolveSectionHeading';
import { extractMeaningfulText, normalizeBulletList, normalizeLanguageList, normalizeSkillList } from './utils/importNormalization';

const normalizedText = (value: unknown) => extractMeaningfulText(value);

export function normalizeResume(data: any): ResumeData {
  const normalizedResume: ResumeData = {
    id: data.id || '',
    ownerId: data.ownerId || data.userId || '',
    userId: data.userId || data.ownerId || '',
    title: normalizedText(data.title) || 'Untitled Resume',
    templateId: isTemplateId(data.templateId) ? data.templateId : 'modern',
    linkDisplayMode: data.linkDisplayMode === 'raw' ? 'raw' : 'embedded',
    useProfilePhoto: data.useProfilePhoto !== false,
    personalDetails: {
      fullName: normalizedText(data.personalDetails?.fullName),
      professionalTitle: normalizedText(data.personalDetails?.professionalTitle),
      email: normalizedText(data.personalDetails?.email),
      phone: normalizedText(data.personalDetails?.phone),
      location: normalizedText(data.personalDetails?.location),
      linkedin: normalizedText(data.personalDetails?.linkedin),
      github: normalizedText(data.personalDetails?.github),
      website: normalizedText(data.personalDetails?.website),
      profilePhoto: normalizedText(data.personalDetails?.profilePhoto),
    },
    summary: typeof data.summary === 'string'
      ? data.summary
      : typeof data.summary?.content === 'string'
        ? data.summary.content
        : '',
    education: Array.isArray(data.education) ? data.education.map((e: any) => {
      const score = normalizeEducationScore(e);
      return {
        id: e.id || Math.random().toString(36).substring(2, 9),
        degree: normalizedText(e.degree),
        institution: normalizedText(e.institution),
        location: normalizedText(e.location),
        startDate: normalizedText(e.startDate),
        endDate: normalizedText(e.endDate),
        ...score,
        description: normalizedText(e.description),
      };
    }) : [],
    experience: Array.isArray(data.experience) ? data.experience.map((e: any) => ({
      id: e.id || Math.random().toString(36).substring(2, 9),
      title: normalizedText(e.title),
      company: normalizedText(e.company),
      location: normalizedText(e.location),
      startDate: normalizedText(e.startDate),
      endDate: normalizedText(e.endDate),
      description: normalizedText(e.description),
    })) : [],
    internships: Array.isArray(data.internships) ? data.internships.map((i: any) => ({
      id: i.id || Math.random().toString(36).substring(2, 9),
      role: normalizedText(i.role),
      company: normalizedText(i.company),
      location: normalizedText(i.location),
      startDate: normalizedText(i.startDate),
      endDate: normalizedText(i.endDate),
      description: normalizedText(i.description),
      technologiesUsed: normalizedText(i.technologiesUsed),
    })) : [],
    projects: Array.isArray(data.projects) ? data.projects.map((p: any) => ({
      id: p.id || Math.random().toString(36).substring(2, 9),
      name: normalizedText(p.name),
      description: normalizedText(p.description),
      technologies: normalizedText(p.technologies),
      startDate: normalizedText(p.startDate),
      endDate: normalizedText(p.endDate),
      github: normalizedText(p.github),
      live: normalizedText(p.live),
    })) : [],
    skills: {
      programmingLanguages: normalizeSkillList(data.skills?.programmingLanguages),
      frameworks: normalizeSkillList(data.skills?.frameworks),
      tools: normalizeSkillList(data.skills?.tools),
      databases: normalizeSkillList(data.skills?.databases),
      softSkills: normalizeSkillList(data.skills?.softSkills),
    },
    certifications: Array.isArray(data.certifications) ? data.certifications.map((c: any) => ({
      id: c.id || Math.random().toString(36).substring(2, 9),
      name: normalizedText(c.name),
      issuer: normalizedText(c.issuer),
      date: normalizedText(c.date),
      url: normalizedText(c.url),
    })) : [],
    achievements: normalizeBulletList(data.achievements),
    volunteering: Array.isArray(data.volunteering) ? data.volunteering.map((v: any) => ({
      id: v.id || Math.random().toString(36).substring(2, 9),
      title: normalizedText(v.title),
      company: normalizedText(v.company),
      location: normalizedText(v.location),
      startDate: normalizedText(v.startDate),
      endDate: normalizedText(v.endDate),
      description: normalizedText(v.description),
    })) : [],
    languages: normalizeLanguageList(data.languages),
    customSections: Array.isArray(data.customSections) ? data.customSections.map((s: any) => ({
      id: s.id || Math.random().toString(36).substring(2, 9),
      title: normalizedText(s.title),
      items: Array.isArray(s.items) ? s.items.map((it: any) => ({
        id: it.id || Math.random().toString(36).substring(2, 9),
        title: normalizedText(it.title),
        subtitle: normalizedText(it.subtitle),
        date: normalizedText(it.date),
        description: normalizedText(it.description),
      })) : [],
    })) : [],
    sectionConfig: normalizeSectionConfig({
      ...createDefaultSectionConfig(),
      ...(data.sectionConfig || data.sectionSettings || {}),
      ...(typeof data.summaryTitle === 'string' && data.summaryTitle.trim()
        ? {
            summary: {
              mode: 'custom',
              customTitle: data.summaryTitle.trim(),
            },
          }
        : {}),
      ...(typeof data.summary?.title === 'string' && data.summary.title.trim()
        ? {
            summary: {
              mode: 'custom',
              customTitle: data.summary.title.trim(),
            },
          }
        : {}),
    }),
    languageQuality: data.languageQuality || analyzeResumeLanguageQuality({
      id: data.id || '',
      ownerId: data.ownerId || data.userId || '',
      userId: data.userId || data.ownerId || '',
      title: normalizedText(data.title) || 'Untitled Resume',
      templateId: isTemplateId(data.templateId) ? data.templateId : 'modern',
      linkDisplayMode: data.linkDisplayMode === 'raw' ? 'raw' : 'embedded',
      useProfilePhoto: data.useProfilePhoto !== false,
      personalDetails: {
        fullName: normalizedText(data.personalDetails?.fullName),
        professionalTitle: normalizedText(data.personalDetails?.professionalTitle),
        email: normalizedText(data.personalDetails?.email),
        phone: normalizedText(data.personalDetails?.phone),
        location: normalizedText(data.personalDetails?.location),
        linkedin: normalizedText(data.personalDetails?.linkedin),
        github: normalizedText(data.personalDetails?.github),
        website: normalizedText(data.personalDetails?.website),
        profilePhoto: normalizedText(data.personalDetails?.profilePhoto),
      },
      summary: typeof data.summary === 'string'
        ? data.summary
        : typeof data.summary?.content === 'string'
          ? data.summary.content
          : '',
      education: Array.isArray(data.education) ? data.education.map((e: any) => ({
        id: e.id || Math.random().toString(36).substring(2, 9),
        degree: normalizedText(e.degree),
        institution: normalizedText(e.institution),
        location: normalizedText(e.location),
        startDate: normalizedText(e.startDate),
        endDate: normalizedText(e.endDate),
        ...normalizeEducationScore(e),
        description: normalizedText(e.description),
      })) : [],
      experience: Array.isArray(data.experience) ? data.experience.map((e: any) => ({
        id: e.id || Math.random().toString(36).substring(2, 9),
        title: normalizedText(e.title),
        company: normalizedText(e.company),
        location: normalizedText(e.location),
        startDate: normalizedText(e.startDate),
        endDate: normalizedText(e.endDate),
        description: normalizedText(e.description),
      })) : [],
      internships: Array.isArray(data.internships) ? data.internships.map((i: any) => ({
        id: i.id || Math.random().toString(36).substring(2, 9),
        role: normalizedText(i.role),
        company: normalizedText(i.company),
        location: normalizedText(i.location),
        startDate: normalizedText(i.startDate),
        endDate: normalizedText(i.endDate),
        description: normalizedText(i.description),
        technologiesUsed: normalizedText(i.technologiesUsed),
      })) : [],
      projects: Array.isArray(data.projects) ? data.projects.map((p: any) => ({
        id: p.id || Math.random().toString(36).substring(2, 9),
        name: normalizedText(p.name),
        description: normalizedText(p.description),
        technologies: normalizedText(p.technologies),
        startDate: normalizedText(p.startDate),
        endDate: normalizedText(p.endDate),
        github: normalizedText(p.github),
        live: normalizedText(p.live),
      })) : [],
      skills: {
        programmingLanguages: normalizeSkillList(data.skills?.programmingLanguages),
        frameworks: normalizeSkillList(data.skills?.frameworks),
        tools: normalizeSkillList(data.skills?.tools),
        databases: normalizeSkillList(data.skills?.databases),
        softSkills: normalizeSkillList(data.skills?.softSkills),
      },
      certifications: Array.isArray(data.certifications) ? data.certifications.map((c: any) => ({
        id: c.id || Math.random().toString(36).substring(2, 9),
        name: normalizedText(c.name),
        issuer: normalizedText(c.issuer),
        date: normalizedText(c.date),
        url: normalizedText(c.url),
      })) : [],
      achievements: normalizeBulletList(data.achievements),
      volunteering: Array.isArray(data.volunteering) ? data.volunteering.map((v: any) => ({
        id: v.id || Math.random().toString(36).substring(2, 9),
        title: normalizedText(v.title),
        company: normalizedText(v.company),
        location: normalizedText(v.location),
        startDate: normalizedText(v.startDate),
        endDate: normalizedText(v.endDate),
        description: normalizedText(v.description),
      })) : [],
      languages: normalizeLanguageList(data.languages),
      customSections: Array.isArray(data.customSections) ? data.customSections.map((s: any) => ({
        id: s.id || Math.random().toString(36).substring(2, 9),
        title: normalizedText(s.title),
        items: Array.isArray(s.items) ? s.items.map((it: any) => ({
          id: it.id || Math.random().toString(36).substring(2, 9),
          title: normalizedText(it.title),
          subtitle: normalizedText(it.subtitle),
          date: normalizedText(it.date),
          description: normalizedText(it.description),
        })) : [],
      })) : [],
      sectionConfig: normalizeSectionConfig(data.sectionConfig),
      languageQuality: data.languageQuality,
      sectionOrder: normalizeSectionOrder(data.sectionOrder, Array.isArray(data.customSections) ? data.customSections.map((section: any) => section?.id).filter(Boolean) : []),
      sectionOrderMode: data.sectionOrderMode === 'template' ? 'template' : 'custom',
      hiddenSections: Array.isArray(data.hiddenSections) ? data.hiddenSections : [],
      isArchived: !!data.isArchived,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || new Date().toISOString(),
    }),
    sectionOrder: normalizeSectionOrder(
      data.sectionOrder,
      Array.isArray(data.customSections)
        ? data.customSections.map((section: any) => section?.id).filter(Boolean)
        : []
    ),
    sectionOrderMode: data.sectionOrderMode === 'template' ? 'template' : 'custom',
    hiddenSections: Array.isArray(data.hiddenSections) ? data.hiddenSections : [],
    isArchived: !!data.isArchived,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString(),
  };

  return {
    ...normalizedResume,
    languageQuality: analyzeResumeLanguageQuality(normalizedResume),
  };
}
