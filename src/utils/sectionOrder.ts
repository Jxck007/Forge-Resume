import { ResumeData } from '../types';
import { formatEducationScore } from './educationScore';
import {
  DEFAULT_SECTION_ORDER,
  TEMPLATE_SECTION_PRIORITIES,
  canonicalizeSectionId,
  getRecommendedSectionOrder,
  getSectionOrder,
  resolveSectionHeading,
} from './sectionEngine';

export { DEFAULT_SECTION_ORDER, TEMPLATE_SECTION_PRIORITIES };

export function normalizeSectionOrder(
  sectionOrder: unknown,
  customSectionIds: string[] = []
): string[] {
  const requestedOrder = Array.isArray(sectionOrder)
    ? sectionOrder.filter((sectionId): sectionId is string => typeof sectionId === 'string')
    : [];
  const normalizedOrder = requestedOrder
    .map(sectionId => canonicalizeSectionId(sectionId))
    .filter((sectionId, index, array) => Boolean(sectionId) && array.indexOf(sectionId) === index);

  [...DEFAULT_SECTION_ORDER, ...customSectionIds].forEach(sectionId => {
    const normalizedId = canonicalizeSectionId(sectionId);
    const finalId = customSectionIds.includes(sectionId) ? sectionId : normalizedId;
    if (!normalizedOrder.includes(finalId)) normalizedOrder.push(finalId);
  });

  return normalizedOrder.filter(sectionId => sectionId === 'languages' || sectionId === 'volunteering' || customSectionIds.includes(sectionId) || Boolean(canonicalizeSectionId(sectionId)));
}

export function resolveResumeSectionOrder(
  resume: Pick<ResumeData, 'sectionOrder' | 'sectionOrderMode' | 'customSections' | 'templateId'> & Partial<ResumeData>,
  templateId = resume.templateId
): string[] {
  if (resume.sectionOrderMode === 'template') {
    return getRecommendedSectionOrder(templateId, resume);
  }
  return getSectionOrder(resume);
}

export function serializeResumeBySectionOrder(resume: ResumeData): string {
  const hiddenSections = new Set(resume.hiddenSections);
  const customSections = new Map(resume.customSections.map(section => [section.id, section]));
  const sectionOrder = resolveResumeSectionOrder(resume);

  const sections = sectionOrder.flatMap(sectionId => {
    if (hiddenSections.has(sectionId)) return [];

    const customSection = customSections.get(sectionId);
    if (customSection) {
      const content = customSection.items
        .map(item => [item.title, item.subtitle, item.date, item.description].filter(Boolean).join(' | '))
        .join('\n');
      return content ? [`${customSection.title}:\n${content}`] : [];
    }

    switch (sectionId) {
      case 'summary':
        return resume.summary
          ? [`${resolveSectionHeading('summary', resume.sectionConfig)}:\n${resume.summary}`]
          : [];
      case 'experience':
        return resume.experience.length > 0
          ? [`${resolveSectionHeading('experience', resume.sectionConfig)}:\n${resume.experience.map(entry =>
              `${entry.title} at ${entry.company} | ${entry.startDate} - ${entry.endDate}\n${entry.description}`
            ).join('\n')}`]
          : [];
      case 'internships':
        return (resume.internships || []).length > 0
          ? [`${resolveSectionHeading('internships', resume.sectionConfig)}:\n${(resume.internships || []).map(entry =>
              `${entry.role} at ${entry.company} | ${entry.startDate} - ${entry.endDate}\n${entry.description}`
            ).join('\n')}`]
          : [];
      case 'education':
        return resume.education.length > 0
          ? [`${resolveSectionHeading('education', resume.sectionConfig)}:\n${resume.education.map(entry =>
              `${entry.degree} at ${entry.institution} | ${entry.startDate} - ${entry.endDate}${entry.gpa ? ` | ${formatEducationScore(entry)}` : ''}`
            ).join('\n')}`]
          : [];
      case 'skills': {
        const categories = [
          ['Programming Languages', resume.skills.programmingLanguages],
          ['Frameworks & Libraries', resume.skills.frameworks],
          ['Databases', resume.skills.databases],
          ['Tools', resume.skills.tools],
          ['Soft Skills', resume.skills.softSkills],
        ].filter(([, values]) => (values as string[]).length > 0);
        return categories.length > 0
          ? [`${resolveSectionHeading('skills', resume.sectionConfig)}:\n${categories.map(([label, values]) =>
              `${label}:\n${(values as string[]).join('\n')}`
            ).join('\n\n')}`]
          : [];
      }
      case 'projects':
        return resume.projects.length > 0
          ? [`${resolveSectionHeading('projects', resume.sectionConfig)}:\n${resume.projects.map(project =>
              [
                project.name,
                project.technologies ? `Technologies: ${project.technologies}` : '',
                [project.startDate, project.endDate].filter(Boolean).join(' - '),
                project.description,
                project.github ? `GitHub: ${project.github}` : '',
                project.live ? `Live Demo: ${project.live}` : '',
              ].filter(Boolean).join('\n')
            ).join('\n')}`]
          : [];
      case 'certifications':
        return resume.certifications.length > 0
          ? [`${resolveSectionHeading('certifications', resume.sectionConfig)}:\n${resume.certifications.map(entry =>
              [
                entry.name,
                entry.issuer,
                entry.date,
                entry.url ? `Credential Link: ${entry.url}` : '',
              ].filter(Boolean).join('\n')
            ).join('\n')}`]
          : [];
      case 'achievements':
        return resume.achievements.length > 0
          ? [`${resolveSectionHeading('achievements', resume.sectionConfig)}:\n${resume.achievements.join('\n')}`]
          : [];
      case 'volunteering':
        return resume.volunteering.length > 0
          ? [`${resolveSectionHeading('volunteering', resume.sectionConfig)}:\n${resume.volunteering.map(entry =>
              `${entry.title} at ${entry.company}\n${entry.description}`
            ).join('\n')}`]
          : [];
      case 'languages':
        return resume.languages.length > 0
          ? [`${resolveSectionHeading('languages', resume.sectionConfig)}:\n${resume.languages.join(', ')}`]
          : [];
      default:
        return [];
    }
  });

  return [
    `Full Name: ${resume.personalDetails.fullName}`,
    `Professional Title: ${resume.personalDetails.professionalTitle}`,
    `Email: ${resume.personalDetails.email}`,
    `Phone: ${resume.personalDetails.phone}`,
    ...sections,
  ].filter(Boolean).join('\n\n');
}
