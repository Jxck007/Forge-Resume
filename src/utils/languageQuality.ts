import {
  LanguageIssue,
  LanguageIssueCategory,
  LanguageSuggestion,
  ResumeData,
  ResumeLanguageQuality,
  StandardSectionKey,
} from '../types';
import { DEFAULT_SECTION_HEADINGS, resolveSectionHeading } from './resolveSectionHeading';

type TextNode = {
  path: string;
  sectionKey: string;
  label: string;
  text: string;
};

const COMMON_REPLACEMENTS: Record<string, string> = {
  teh: 'the',
  recieve: 'receive',
  acheived: 'achieved',
  acheive: 'achieve',
  seperately: 'separately',
  responsiblity: 'responsibility',
  managment: 'management',
  enviroment: 'environment',
  experiance: 'experience',
  implemnted: 'implemented',
  sucessfully: 'successfully',
};

const sectionFromPath = (path: string) => path.split('.')[0] || 'resume';

const createSuggestion = (issueId: string, replacement: string, label: string): LanguageSuggestion => ({
  id: `${issueId}-suggestion-${replacement}`,
  replacement,
  label,
  status: 'pending',
});

const createIssue = (
  node: TextNode,
  category: LanguageIssueCategory,
  severity: LanguageIssue['severity'],
  message: string,
  replacement?: string
): LanguageIssue => {
  const id = `${node.path}:${category}:${message}:${node.text}`;
  return {
    id,
    path: node.path,
    sectionKey: node.sectionKey,
    label: node.label,
    category,
    severity,
    message,
    originalText: node.text,
    suggestions: replacement
      ? [createSuggestion(id, replacement, `Replace with "${replacement}"`)]
      : [],
  };
};

const collectResumeTextNodes = (resume: ResumeData): TextNode[] => {
  const nodes: TextNode[] = [
    {
      path: 'personalDetails.fullName',
      sectionKey: 'header',
      label: 'Full name',
      text: resume.personalDetails.fullName,
    },
    {
      path: 'personalDetails.professionalTitle',
      sectionKey: 'header',
      label: 'Professional title',
      text: resume.personalDetails.professionalTitle,
    },
    {
      path: 'summary',
      sectionKey: 'summary',
      label: resolveSectionHeading('summary', resume.sectionConfig, DEFAULT_SECTION_HEADINGS.summary),
      text: resume.summary,
    },
  ];

  (Object.keys(DEFAULT_SECTION_HEADINGS) as StandardSectionKey[]).forEach(sectionKey => {
    nodes.push({
      path: `sectionConfig.${sectionKey}.customTitle`,
      sectionKey,
      label: `${DEFAULT_SECTION_HEADINGS[sectionKey]} heading`,
      text: resolveSectionHeading(sectionKey, resume.sectionConfig, DEFAULT_SECTION_HEADINGS[sectionKey]),
    });
  });

  resume.education.forEach(entry => {
    nodes.push(
      { path: `education.${entry.id}.degree`, sectionKey: 'education', label: 'Education degree', text: entry.degree },
      { path: `education.${entry.id}.institution`, sectionKey: 'education', label: 'Education institution', text: entry.institution },
      { path: `education.${entry.id}.description`, sectionKey: 'education', label: 'Education description', text: entry.description },
    );
  });
  resume.experience.forEach(entry => {
    nodes.push(
      { path: `experience.${entry.id}.title`, sectionKey: 'experience', label: 'Experience title', text: entry.title },
      { path: `experience.${entry.id}.company`, sectionKey: 'experience', label: 'Experience company', text: entry.company },
      { path: `experience.${entry.id}.description`, sectionKey: 'experience', label: 'Experience description', text: entry.description },
    );
  });
  (resume.internships || []).forEach(entry => {
    nodes.push(
      { path: `internships.${entry.id}.role`, sectionKey: 'internships', label: 'Internship role', text: entry.role },
      { path: `internships.${entry.id}.company`, sectionKey: 'internships', label: 'Internship company', text: entry.company },
      { path: `internships.${entry.id}.description`, sectionKey: 'internships', label: 'Internship description', text: entry.description },
      { path: `internships.${entry.id}.technologiesUsed`, sectionKey: 'internships', label: 'Internship technologies', text: entry.technologiesUsed },
    );
  });
  resume.projects.forEach(entry => {
    nodes.push(
      { path: `projects.${entry.id}.name`, sectionKey: 'projects', label: 'Project name', text: entry.name },
      { path: `projects.${entry.id}.description`, sectionKey: 'projects', label: 'Project description', text: entry.description },
      { path: `projects.${entry.id}.technologies`, sectionKey: 'projects', label: 'Project technologies', text: entry.technologies },
    );
  });
  (Object.entries(resume.skills) as Array<[keyof ResumeData['skills'], string[]]>).forEach(([key, values]) => {
    values.forEach((value, index) => {
      nodes.push({
        path: `skills.${key}.${index}`,
        sectionKey: 'skills',
        label: `Skills ${key}`,
        text: value,
      });
    });
  });
  resume.certifications.forEach(entry => {
    nodes.push(
      { path: `certifications.${entry.id}.name`, sectionKey: 'certifications', label: 'Certification name', text: entry.name },
      { path: `certifications.${entry.id}.issuer`, sectionKey: 'certifications', label: 'Certification issuer', text: entry.issuer },
    );
  });
  resume.achievements.forEach((value, index) => {
    nodes.push({ path: `achievements.${index}`, sectionKey: 'achievements', label: 'Achievement', text: value });
  });
  resume.volunteering.forEach(entry => {
    nodes.push(
      { path: `volunteering.${entry.id}.title`, sectionKey: 'volunteering', label: 'Volunteer title', text: entry.title },
      { path: `volunteering.${entry.id}.company`, sectionKey: 'volunteering', label: 'Volunteer organization', text: entry.company },
      { path: `volunteering.${entry.id}.description`, sectionKey: 'volunteering', label: 'Volunteer description', text: entry.description },
    );
  });
  resume.languages.forEach((value, index) => {
    nodes.push({ path: `languages.${index}`, sectionKey: 'languages', label: 'Language', text: value });
  });
  resume.customSections.forEach(section => {
    nodes.push({ path: `customSections.${section.id}.title`, sectionKey: section.id, label: 'Custom section heading', text: section.title });
    section.items.forEach(item => {
      nodes.push(
        { path: `customSections.${section.id}.${item.id}.title`, sectionKey: section.id, label: 'Custom item title', text: item.title },
        { path: `customSections.${section.id}.${item.id}.subtitle`, sectionKey: section.id, label: 'Custom item subtitle', text: item.subtitle || '' },
        { path: `customSections.${section.id}.${item.id}.description`, sectionKey: section.id, label: 'Custom item description', text: item.description },
      );
    });
  });

  return nodes.filter(node => node.text.trim());
};

const sentenceStyleIssues = (node: TextNode): LanguageIssue[] => {
  const text = node.text.trim();
  const issues: LanguageIssue[] = [];

  if (/\s{2,}/.test(text)) {
    issues.push(createIssue(node, 'clarity', 'low', 'Contains repeated spaces.', text.replace(/\s{2,}/g, ' ')));
  }

  if (/\b(\w+)\s+\1\b/i.test(text)) {
    issues.push(createIssue(node, 'duplicate', 'medium', 'Contains a repeated word.', text.replace(/\b(\w+)\s+\1\b/i, '$1')));
  }

  if (text.length > 50 && /^[a-z]/.test(text)) {
    issues.push(createIssue(node, 'grammar', 'medium', 'Starts with a lowercase letter.', text.charAt(0).toUpperCase() + text.slice(1)));
  }

  if (text.length > 80 && !/[.!?]$/.test(text) && !text.includes('\n')) {
    issues.push(createIssue(node, 'grammar', 'low', 'Long sentence should end with punctuation.', `${text}.`));
  }

  const hasPastTense = /\b(?:led|built|created|managed|improved|reduced|increased|developed|designed|implemented)\b/i.test(text);
  const hasPresentTense = /\b(?:lead|build|create|manage|improve|reduce|increase|develop|design|implement)\b/i.test(text);
  if (hasPastTense && hasPresentTense) {
    issues.push(createIssue(node, 'consistency', 'low', 'Check tense consistency within this entry.'));
  }

  return issues;
};

const spellingIssues = (node: TextNode): LanguageIssue[] => {
  const lower = node.text.toLowerCase();
  return Object.entries(COMMON_REPLACEMENTS)
    .filter(([wrong]) => new RegExp(`\\b${wrong}\\b`, 'i').test(lower))
    .map(([wrong, correct]) => createIssue(
      node,
      'spelling',
      'high',
      `Possible misspelling: "${wrong}".`,
      node.text.replace(new RegExp(`\\b${wrong}\\b`, 'gi'), correct)
    ));
};

const consistencyIssues = (node: TextNode): LanguageIssue[] => {
  const text = node.text.trim();
  if (!/^[A-Z0-9][^a-z]*$/.test(text) || text.split(/\s+/).length > 5) return [];
  if (text === text.toUpperCase() || text === text.toLowerCase()) {
    const normalized = text
      .toLowerCase()
      .split(/\s+/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
    if (normalized !== text) {
      return [createIssue(node, 'consistency', 'low', 'Heading casing is inconsistent.', normalized)];
    }
  }
  return [];
};

export const analyzeResumeLanguageQuality = (resume: ResumeData): ResumeLanguageQuality => {
  const issues = collectResumeTextNodes(resume)
    .flatMap(node => [
      ...spellingIssues(node),
      ...sentenceStyleIssues(node),
      ...consistencyIssues(node),
    ])
    .filter((issue, index, all) => all.findIndex(candidate => candidate.id === issue.id) === index);

  const summary = {
    total: issues.length,
    spelling: issues.filter(issue => issue.category === 'spelling').length,
    grammar: issues.filter(issue => issue.category === 'grammar').length,
    clarity: issues.filter(issue => issue.category === 'clarity').length,
    consistency: issues.filter(issue => issue.category === 'consistency').length,
    duplicate: issues.filter(issue => issue.category === 'duplicate').length,
    highSeverity: issues.filter(issue => issue.severity === 'high').length,
  };

  const score = Math.max(
    0,
    100 -
      summary.spelling * 8 -
      summary.grammar * 6 -
      summary.clarity * 4 -
      summary.consistency * 3 -
      summary.duplicate * 4
  );

  return {
    score,
    issues,
    summary,
    updatedAt: new Date().toISOString(),
  };
};

const updateValueAtPath = (resume: ResumeData, path: string, value: string): ResumeData => {
  const parts = path.split('.');
  const [root, first, second, third] = parts;

  if (root === 'summary') return { ...resume, summary: value };
  if (root === 'personalDetails' && first) {
    return {
      ...resume,
      personalDetails: { ...resume.personalDetails, [first]: value },
    };
  }
  if (root === 'sectionConfig' && first && second === 'customTitle') {
    const sectionKey = first as StandardSectionKey;
    return {
      ...resume,
      sectionConfig: {
        ...resume.sectionConfig,
        [sectionKey]: {
          ...resume.sectionConfig[sectionKey],
          mode: value.trim() ? 'custom' : 'default',
          customTitle: value,
        },
      },
    };
  }
  if (root === 'achievements' && first !== undefined) {
    const achievementIndex = Number(first);
    return {
      ...resume,
      achievements: resume.achievements.map((item, index) => index === achievementIndex ? value : item),
    };
  }
  if (root === 'languages' && first !== undefined) {
    const languageIndex = Number(first);
    return {
      ...resume,
      languages: resume.languages.map((item, index) => index === languageIndex ? value : item),
    };
  }
  if (root === 'skills' && first && second !== undefined) {
    const skillIndex = Number(second);
    const values = resume.skills[first as keyof ResumeData['skills']];
    return {
      ...resume,
      skills: {
        ...resume.skills,
        [first]: values.map((item, index) => index === skillIndex ? value : item),
      },
    };
  }

  const updateCollection = <T extends { id: string }>(
    items: T[],
    targetId: string,
    targetField: keyof T
  ) => items.map(item => item.id === targetId ? { ...item, [targetField]: value } : item);

  switch (root) {
    case 'education':
      return { ...resume, education: updateCollection(resume.education, first, second as keyof ResumeData['education'][number]) };
    case 'experience':
      return { ...resume, experience: updateCollection(resume.experience, first, second as keyof ResumeData['experience'][number]) };
    case 'internships':
      return { ...resume, internships: updateCollection(resume.internships || [], first, second as keyof NonNullable<ResumeData['internships']>[number]) };
    case 'projects':
      return { ...resume, projects: updateCollection(resume.projects, first, second as keyof ResumeData['projects'][number]) };
    case 'certifications':
      return { ...resume, certifications: updateCollection(resume.certifications, first, second as keyof ResumeData['certifications'][number]) };
    case 'volunteering':
      return { ...resume, volunteering: updateCollection(resume.volunteering, first, second as keyof ResumeData['volunteering'][number]) };
    case 'customSections':
      return {
        ...resume,
        customSections: resume.customSections.map(section => {
          if (section.id !== first) return section;
          if (second === 'title') return { ...section, title: value };
          return {
            ...section,
            items: section.items.map(item => item.id === second ? { ...item, [third || 'title']: value } : item),
          };
        }),
      };
    default:
      return resume;
  }
};

export const applyLanguageSuggestion = (resume: ResumeData, issueId: string, suggestionId: string): ResumeData => {
  const issue = resume.languageQuality.issues.find(candidate => candidate.id === issueId);
  const suggestion = issue?.suggestions.find(candidate => candidate.id === suggestionId);
  if (!issue || !suggestion) return resume;
  return updateValueAtPath(resume, issue.path, suggestion.replacement);
};

export const refreshResumeLanguageQuality = (resume: ResumeData): ResumeData => ({
  ...resume,
  languageQuality: analyzeResumeLanguageQuality(resume),
});

export const issuesForSection = (resume: ResumeData, sectionKey: string) =>
  resume.languageQuality.issues.filter(issue => issue.sectionKey === sectionKey || sectionFromPath(issue.path) === sectionKey);
