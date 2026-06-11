import { ResumeData } from '../types';

export const DEFAULT_SECTION_ORDER = [
  'summary',
  'experience',
  'internships',
  'education',
  'skills',
  'projects',
  'certifications',
  'achievements',
  'volunteering',
  'languages',
] as const;

export function normalizeSectionOrder(
  sectionOrder: unknown,
  customSectionIds: string[] = []
): string[] {
  const requestedOrder = Array.isArray(sectionOrder)
    ? sectionOrder.filter((sectionId): sectionId is string => typeof sectionId === 'string')
    : [];
  const validSectionIds = new Set<string>([...DEFAULT_SECTION_ORDER, ...customSectionIds]);
  const normalizedOrder = requestedOrder.filter(
    (sectionId, index) =>
      validSectionIds.has(sectionId) && requestedOrder.indexOf(sectionId) === index
  );

  [...DEFAULT_SECTION_ORDER, ...customSectionIds].forEach(sectionId => {
    if (!normalizedOrder.includes(sectionId)) normalizedOrder.push(sectionId);
  });

  return normalizedOrder;
}

export function serializeResumeBySectionOrder(resume: ResumeData): string {
  const hiddenSections = new Set(resume.hiddenSections);
  const customSections = new Map(resume.customSections.map(section => [section.id, section]));
  const sectionOrder = normalizeSectionOrder(
    resume.sectionOrder,
    resume.customSections.map(section => section.id)
  );

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
        return resume.summary ? [`Professional Summary:\n${resume.summary}`] : [];
      case 'experience':
        return resume.experience.length > 0
          ? [`Professional Experience:\n${resume.experience.map(entry =>
              `${entry.title} at ${entry.company} | ${entry.startDate} - ${entry.endDate}\n${entry.description}`
            ).join('\n')}`]
          : [];
      case 'internships':
        return (resume.internships || []).length > 0
          ? [`Internships:\n${(resume.internships || []).map(entry =>
              `${entry.role} at ${entry.company} | ${entry.startDate} - ${entry.endDate}\n${entry.description}`
            ).join('\n')}`]
          : [];
      case 'education':
        return resume.education.length > 0
          ? [`Education:\n${resume.education.map(entry =>
              `${entry.degree} at ${entry.institution} | ${entry.startDate} - ${entry.endDate}`
            ).join('\n')}`]
          : [];
      case 'skills': {
        const skillValues = Object.values(resume.skills).flat();
        return skillValues.length > 0 ? [`Skills:\n${skillValues.join(', ')}`] : [];
      }
      case 'projects':
        return resume.projects.length > 0
          ? [`Projects:\n${resume.projects.map(project =>
              `${project.name} | ${project.technologies}\n${project.description}`
            ).join('\n')}`]
          : [];
      case 'certifications':
        return resume.certifications.length > 0
          ? [`Certifications:\n${resume.certifications.map(entry =>
              `${entry.name} | ${entry.issuer} | ${entry.date}`
            ).join('\n')}`]
          : [];
      case 'achievements':
        return resume.achievements.length > 0
          ? [`Achievements:\n${resume.achievements.join('\n')}`]
          : [];
      case 'volunteering':
        return resume.volunteering.length > 0
          ? [`Volunteering:\n${resume.volunteering.map(entry =>
              `${entry.title} at ${entry.company}\n${entry.description}`
            ).join('\n')}`]
          : [];
      case 'languages':
        return resume.languages.length > 0 ? [`Languages:\n${resume.languages.join(', ')}`] : [];
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
