import { isTemplateId, ResumeData } from './types';
import { normalizeSectionOrder } from './utils/sectionOrder';
import { normalizeEducationScore } from './utils/educationScore';
import { analyzeResumeLanguageQuality } from './utils/languageQuality';
import { createDefaultSectionConfig, normalizeSectionConfig } from './utils/resolveSectionHeading';
import { normalizeBulletList, normalizeLanguageList, normalizeSkillList } from './utils/importNormalization';

export function normalizeResume(data: any): ResumeData {
  const normalizedResume: ResumeData = {
    id: data.id || '',
    ownerId: data.ownerId || data.userId || '',
    userId: data.userId || data.ownerId || '',
    title: data.title || 'Untitled Resume',
    templateId: isTemplateId(data.templateId) ? data.templateId : 'modern',
    linkDisplayMode: data.linkDisplayMode === 'raw' ? 'raw' : 'embedded',
    useProfilePhoto: data.useProfilePhoto !== false,
    personalDetails: {
      fullName: data.personalDetails?.fullName || '',
      professionalTitle: data.personalDetails?.professionalTitle || '',
      email: data.personalDetails?.email || '',
      phone: data.personalDetails?.phone || '',
      location: data.personalDetails?.location || '',
      linkedin: data.personalDetails?.linkedin || '',
      github: data.personalDetails?.github || '',
      website: data.personalDetails?.website || '',
      profilePhoto: data.personalDetails?.profilePhoto || '',
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
        degree: e.degree || '',
        institution: e.institution || '',
        location: e.location || '',
        startDate: e.startDate || '',
        endDate: e.endDate || '',
        ...score,
        description: e.description || '',
      };
    }) : [],
    experience: Array.isArray(data.experience) ? data.experience.map((e: any) => ({
      id: e.id || Math.random().toString(36).substring(2, 9),
      title: e.title || '',
      company: e.company || '',
      location: e.location || '',
      startDate: e.startDate || '',
      endDate: e.endDate || '',
      description: e.description || '',
    })) : [],
    internships: Array.isArray(data.internships) ? data.internships.map((i: any) => ({
      id: i.id || Math.random().toString(36).substring(2, 9),
      role: i.role || '',
      company: i.company || '',
      location: i.location || '',
      startDate: i.startDate || '',
      endDate: i.endDate || '',
      description: i.description || '',
      technologiesUsed: i.technologiesUsed || '',
    })) : [],
    projects: Array.isArray(data.projects) ? data.projects.map((p: any) => ({
      id: p.id || Math.random().toString(36).substring(2, 9),
      name: p.name || '',
      description: p.description || '',
      technologies: p.technologies || '',
      startDate: p.startDate || '',
      endDate: p.endDate || '',
      github: p.github || '',
      live: p.live || '',
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
      name: c.name || '',
      issuer: c.issuer || '',
      date: c.date || '',
      url: c.url || '',
    })) : [],
    achievements: normalizeBulletList(data.achievements),
    volunteering: Array.isArray(data.volunteering) ? data.volunteering.map((v: any) => ({
      id: v.id || Math.random().toString(36).substring(2, 9),
      title: v.title || '',
      company: v.company || '',
      location: v.location || '',
      startDate: v.startDate || '',
      endDate: v.endDate || '',
      description: v.description || '',
    })) : [],
    languages: normalizeLanguageList(data.languages),
    customSections: Array.isArray(data.customSections) ? data.customSections.map((s: any) => ({
      id: s.id || Math.random().toString(36).substring(2, 9),
      title: s.title || '',
      items: Array.isArray(s.items) ? s.items.map((it: any) => ({
        id: it.id || Math.random().toString(36).substring(2, 9),
        title: it.title || '',
        subtitle: it.subtitle || '',
        date: it.date || '',
        description: it.description || '',
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
      title: data.title || 'Untitled Resume',
      templateId: isTemplateId(data.templateId) ? data.templateId : 'modern',
      linkDisplayMode: data.linkDisplayMode === 'raw' ? 'raw' : 'embedded',
      useProfilePhoto: data.useProfilePhoto !== false,
      personalDetails: {
        fullName: data.personalDetails?.fullName || '',
        professionalTitle: data.personalDetails?.professionalTitle || '',
        email: data.personalDetails?.email || '',
        phone: data.personalDetails?.phone || '',
        location: data.personalDetails?.location || '',
        linkedin: data.personalDetails?.linkedin || '',
        github: data.personalDetails?.github || '',
        website: data.personalDetails?.website || '',
        profilePhoto: data.personalDetails?.profilePhoto || '',
      },
      summary: typeof data.summary === 'string'
        ? data.summary
        : typeof data.summary?.content === 'string'
          ? data.summary.content
          : '',
      education: Array.isArray(data.education) ? data.education.map((e: any) => ({
        id: e.id || Math.random().toString(36).substring(2, 9),
        degree: e.degree || '',
        institution: e.institution || '',
        location: e.location || '',
        startDate: e.startDate || '',
        endDate: e.endDate || '',
        ...normalizeEducationScore(e),
        description: e.description || '',
      })) : [],
      experience: Array.isArray(data.experience) ? data.experience.map((e: any) => ({
        id: e.id || Math.random().toString(36).substring(2, 9),
        title: e.title || '',
        company: e.company || '',
        location: e.location || '',
        startDate: e.startDate || '',
        endDate: e.endDate || '',
        description: e.description || '',
      })) : [],
      internships: Array.isArray(data.internships) ? data.internships.map((i: any) => ({
        id: i.id || Math.random().toString(36).substring(2, 9),
        role: i.role || '',
        company: i.company || '',
        location: i.location || '',
        startDate: i.startDate || '',
        endDate: i.endDate || '',
        description: i.description || '',
        technologiesUsed: i.technologiesUsed || '',
      })) : [],
      projects: Array.isArray(data.projects) ? data.projects.map((p: any) => ({
        id: p.id || Math.random().toString(36).substring(2, 9),
        name: p.name || '',
        description: p.description || '',
        technologies: p.technologies || '',
        startDate: p.startDate || '',
        endDate: p.endDate || '',
        github: p.github || '',
        live: p.live || '',
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
        name: c.name || '',
        issuer: c.issuer || '',
        date: c.date || '',
        url: c.url || '',
      })) : [],
      achievements: normalizeBulletList(data.achievements),
      volunteering: Array.isArray(data.volunteering) ? data.volunteering.map((v: any) => ({
        id: v.id || Math.random().toString(36).substring(2, 9),
        title: v.title || '',
        company: v.company || '',
        location: v.location || '',
        startDate: v.startDate || '',
        endDate: v.endDate || '',
        description: v.description || '',
      })) : [],
      languages: normalizeLanguageList(data.languages),
      customSections: Array.isArray(data.customSections) ? data.customSections.map((s: any) => ({
        id: s.id || Math.random().toString(36).substring(2, 9),
        title: s.title || '',
        items: Array.isArray(s.items) ? s.items.map((it: any) => ({
          id: it.id || Math.random().toString(36).substring(2, 9),
          title: it.title || '',
          subtitle: it.subtitle || '',
          date: it.date || '',
          description: it.description || '',
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
