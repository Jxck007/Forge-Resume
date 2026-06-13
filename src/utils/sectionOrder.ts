import { ResumeData, TemplateId } from '../types';
import { formatEducationScore } from './educationScore';

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

export const TEMPLATE_SECTION_PRIORITIES: Record<TemplateId, readonly string[]> = {
  modern: ['summary', 'experience', 'skills', 'projects'],
  minimal: ['summary', 'experience', 'education', 'skills'],
  corporate: ['summary', 'experience', 'education', 'skills', 'certifications'],
  executive: ['summary', 'experience', 'achievements', 'education', 'certifications'],
  creative: ['projects', 'summary', 'experience', 'skills', 'achievements'],
  atsFriendly: ['summary', 'skills', 'experience', 'projects', 'education'],
  softwareEngineer: ['skills', 'projects', 'experience', 'education', 'certifications'],
  student: ['education', 'projects', 'skills', 'internships', 'summary', 'experience'],
  startup: ['projects', 'experience', 'skills', 'education', 'achievements', 'summary'],
  designer: ['projects', 'summary', 'experience', 'skills', 'education'],
  dataAnalyst: ['summary', 'skills', 'projects', 'experience', 'education'],
  classic: ['summary', 'experience', 'education', 'projects', 'certifications'],
};

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

export function resolveResumeSectionOrder(
  resume: Pick<ResumeData, 'sectionOrder' | 'sectionOrderMode' | 'customSections' | 'templateId'>,
  templateId: TemplateId = resume.templateId
): string[] {
  const normalizedOrder = normalizeSectionOrder(
    resume.sectionOrder,
    resume.customSections.map(section => section.id)
  );
  if (resume.sectionOrderMode !== 'template') return normalizedOrder;

  const priority = TEMPLATE_SECTION_PRIORITIES[templateId];
  const prioritized = priority.filter(sectionId => normalizedOrder.includes(sectionId));
  return [
    ...prioritized,
    ...normalizedOrder.filter(sectionId => !prioritized.includes(sectionId)),
  ];
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
          ? [`Skills:\n${categories.map(([label, values]) =>
              `${label}:\n${(values as string[]).join('\n')}`
            ).join('\n\n')}`]
          : [];
      }
      case 'projects':
        return resume.projects.length > 0
          ? [`Projects:\n${resume.projects.map(project =>
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
          ? [`Certifications:\n${resume.certifications.map(entry =>
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
