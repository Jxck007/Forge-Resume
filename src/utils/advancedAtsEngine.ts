import {
  AtsDiagnosticCategoryScore,
  AtsDiagnosticIssue,
  AtsIssueCategory,
  AtsIssueSeverity,
  AtsLanguageAnalysis,
  AtsLayoutAnalysis,
  AtsResponsivenessAnalysis,
  CertificationEntry,
  EducationEntry,
  ExperienceEntry,
  InternshipEntry,
  ProfileData,
  ProjectEntry,
  ResumeData,
  SkillCategory,
  StandardSectionKey,
  TemplateId,
} from '../types';
import { normalizeEducationScore } from './educationScore';
import { ResumeTemplatePlan, resumeFamilyRules, resumeTemplatePlans } from '../design-system/resumeSystem';
import { DEFAULT_SECTION_ORDER, resolveResumeSectionOrder, TEMPLATE_SECTION_PRIORITIES } from './sectionOrder';

const ACTION_VERBS = [
  'achieved', 'architected', 'automated', 'built', 'created', 'delivered', 'designed',
  'developed', 'drove', 'executed', 'implemented', 'improved', 'increased', 'launched',
  'led', 'managed', 'optimized', 'owned', 'reduced', 'resolved', 'scaled', 'spearheaded',
  'streamlined', 'transformed', 'upgraded',
];

const IMPACT_WORDS = [
  'improved', 'increased', 'reduced', 'saved', 'grew', 'accelerated', 'boosted',
  'optimized', 'generated', 'delivered', 'resulted', 'impact', 'outcome',
];

const BUZZWORDS = [
  'results-driven', 'detail-oriented', 'hard-working', 'team player', 'go-getter',
  'self-starter', 'dynamic professional', 'synergy', 'rockstar', 'ninja', 'guru',
  'passionate professional', 'excellent communication skills',
];

const STOP_WORDS = new Set([
  'about', 'above', 'after', 'again', 'against', 'also', 'among', 'and', 'any', 'are',
  'based', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'can', 'candidate',
  'company', 'could', 'day', 'each', 'from', 'further', 'have', 'having', 'into', 'job',
  'more', 'most', 'must', 'need', 'our', 'over', 'preferred', 'required', 'requirements',
  'role', 'should', 'such', 'than', 'that', 'their', 'then', 'there', 'these', 'they',
  'this', 'those', 'through', 'under', 'using', 'very', 'what', 'when', 'where', 'which',
  'while', 'will', 'with', 'within', 'work', 'working', 'would', 'years', 'your',
]);

const LOW_VALUE_TARGET_TERMS = new Set([
  'ability', 'application', 'applications', 'business', 'candidate', 'company',
  'development', 'effective', 'environment', 'excellent', 'experience', 'knowledge',
  'management', 'professional', 'responsibilities', 'responsibility', 'role', 'software',
  'solution', 'solutions', 'strong', 'system', 'systems', 'team', 'technology',
  'understanding', 'using', 'work',
]);

export type AtsRoleFamily =
  | 'software-development'
  | 'cybersecurity'
  | 'data-analytics'
  | 'product-startup'
  | 'design-creative'
  | 'general-other';

type RoleFamilyDefinition = {
  label: string;
  signals: readonly string[];
};

const ROLE_FAMILY_DEFINITIONS: Record<
  Exclude<AtsRoleFamily, 'general-other'>,
  RoleFamilyDefinition
> = {
  'software-development': {
    label: 'Software Development',
    signals: [
      'software engineer', 'software developer', 'frontend developer', 'backend developer',
      'full stack', 'web developer', 'mobile developer', 'application developer',
      'data structures', 'algorithms', 'system design', 'microservices', 'rest api',
      'test driven development', 'continuous integration', 'continuous delivery',
    ],
  },
  cybersecurity: {
    label: 'Cybersecurity',
    signals: [
      'cybersecurity', 'cyber security', 'security analyst', 'security engineer',
      'security operations center', 'soc analyst', 'siem', 'incident response',
      'threat detection', 'threat hunting', 'vulnerability management',
      'penetration testing', 'network security', 'application security', 'zero trust',
      'identity and access management', 'security hardening', 'nist', 'mitre att&ck',
      'splunk', 'wireshark', 'intrusion detection', 'intrusion prevention',
    ],
  },
  'data-analytics': {
    label: 'Data / Analytics',
    signals: [
      'data analyst', 'data scientist', 'data engineer', 'business intelligence',
      'data analytics', 'machine learning', 'data visualization', 'data warehouse',
      'data modeling', 'etl', 'tableau', 'power bi', 'pandas', 'apache spark',
      'statistical analysis', 'predictive modeling',
    ],
  },
  'product-startup': {
    label: 'Product / Startup',
    signals: [
      'product manager', 'product management', 'product strategy', 'product roadmap',
      'go to market', 'go-to-market', 'growth strategy', 'growth product',
      'customer discovery', 'user research', 'market research', 'experimentation',
      'conversion', 'retention', 'product analytics', 'startup',
    ],
  },
  'design-creative': {
    label: 'Design / Creative',
    signals: [
      'product designer', 'ux designer', 'ui designer', 'visual designer',
      'user experience', 'user interface', 'interaction design', 'design system',
      'prototyping', 'wireframing', 'figma', 'adobe creative suite', 'typography',
      'visual identity', 'portfolio',
    ],
  },
};

const SKILL_DICTIONARY: Record<keyof SkillCategory, string[]> = {
  programmingLanguages: [
    'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'ruby', 'go', 'golang',
    'rust', 'swift', 'kotlin', 'php', 'scala', 'perl', 'dart', 'sql', 'powershell', 'bash',
    'html5', 'css3',
  ],
  frameworks: [
    'react', 'angular', 'vue', 'next.js', 'nuxt', 'svelte', 'express', 'django', 'flask',
    'spring boot', 'laravel', 'nest.js', 'fastapi', 'rails', 'asp.net', 'tailwind',
    'bootstrap', 'redux', 'graphql', 'pytorch', 'tensorflow', 'node.js',
  ],
  tools: [
    'git', 'github', 'docker', 'kubernetes', 'amazon web services', 'google cloud',
    'azure', 'jenkins', 'terraform', 'ansible', 'ci/cd', 'webpack',
    'vite', 'npm', 'yarn', 'figma', 'jira', 'linux', 'tableau', 'power bi',
  ],
  databases: [
    'postgresql', 'mysql', 'mongodb', 'redis', 'sqlite', 'mariadb', 'oracle',
    'cassandra', 'dynamodb', 'elasticsearch', 'firebase', 'firestore', 'supabase',
  ],
  softSkills: [
    'leadership', 'scrum', 'agile', 'communication', 'collaboration', 'problem solving',
    'project management', 'time management', 'teamwork', 'negotiation', 'critical thinking',
    'decision making', 'mentoring', 'active listening', 'adaptability', 'stakeholder management',
  ],
};

const CANONICAL_ALIAS_MAP = {
  javascript: ['js', 'java script', 'ecmascript'],
  typescript: ['ts'],
  html5: ['html 5', 'html'],
  css3: ['css 3', 'css'],
  react: ['react.js', 'reactjs'],
  'node.js': ['node', 'nodejs', 'node js'],
  github: ['git hub'],
  'amazon web services': ['aws'],
  'google cloud': ['gcp', 'google cloud platform'],
  kubernetes: ['k8s'],
  postgresql: ['postgres'],
} as const satisfies Record<string, readonly string[]>;

type SectionKey =
  | 'summary'
  | 'skills'
  | 'experience'
  | 'internships'
  | 'projects'
  | 'education'
  | 'certifications'
  | 'achievements';

const ROLE_SECTION_WEIGHTS: Partial<Record<SectionKey | 'header' | 'source', number>> = {
  experience: 1,
  internships: 0.95,
  projects: 0.9,
  certifications: 0.78,
  skills: 0.68,
  achievements: 0.6,
  summary: 0.52,
  education: 0.42,
  header: 0.35,
  source: 0.3,
};

const SECTION_PATTERNS: Array<[SectionKey, RegExp]> = [
  ['summary', /^(?:professional\s+)?(?:summary|profile|objective|about(?:\s+me)?)$/i],
  ['skills', /^(?:technical\s+)?skills|core competencies|technologies$/i],
  ['experience', /^(?:professional\s+|work\s+)?experience|employment(?:\s+history)?$/i],
  ['internships', /^internships?|training$/i],
  ['projects', /^(?:technical\s+|academic\s+)?projects?|portfolio$/i],
  ['education', /^education|academic(?:\s+background)?|qualifications?$/i],
  ['certifications', /^certifications?|licenses?|courses$/i],
  ['achievements', /^achievements?|awards?|accomplishments?$/i],
];

const SECTION_ALIASES: Record<SectionKey, RegExp[]> = {
  summary: [
    /^(?:professional\s+)?summary$/i,
    /^career\s+objective$/i,
    /^objective$/i,
    /^profile$/i,
    /^about(?:\s+me)?$/i,
  ],
  skills: [
    /^(?:technical|core)\s+skills$/i,
    /^skills$/i,
    /^core competencies$/i,
    /^technologies$/i,
  ],
  experience: [
    /^(?:professional\s+|work\s+)?experience$/i,
    /^employment(?:\s+history)?$/i,
    /^work history$/i,
  ],
  internships: [
    /^internships?$/i,
    /^training$/i,
  ],
  projects: [
    /^(?:technical\s+|academic\s+)?projects?$/i,
    /^portfolio$/i,
  ],
  education: [
    /^education$/i,
    /^academic(?:\s+background|\s+details)?$/i,
    /^qualifications?$/i,
  ],
  certifications: [
    /^certifications?$/i,
    /^licenses?$/i,
    /^courses$/i,
  ],
  achievements: [
    /^achievements?$/i,
    /^awards?$/i,
    /^accomplishments?$/i,
  ],
};

export type AtsSourceKind = 'structured' | 'text-pdf' | 'docx' | 'image-ocr';

export interface WeightedKeyword {
  keyword: string;
  weight: number;
  matched: boolean;
  matchType: 'exact' | 'related' | 'missing';
  placements: string[];
  evidenceStrength: 'strong' | 'weak' | 'missing';
}

export interface LocalAtsResult {
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
    roleFamily: AtsRoleFamily;
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
}

const clamp = (value: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Math.round(value)));

const unique = (values: string[]) => [...new Set(values.filter(Boolean))];

const makeIssueId = (...parts: string[]) =>
  parts
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const issueCategoryLabel = (category: AtsIssueCategory) => {
  switch (category) {
    case 'content': return 'Content';
    case 'layout': return 'Layout';
    case 'structure': return 'Structure';
    case 'spelling': return 'Spelling';
    case 'atsRules': return 'ATS Rules';
    default: return 'Issue';
  }
};

const createDiagnosticIssue = (input: {
  title: string;
  severity: AtsIssueSeverity;
  category: AtsIssueCategory;
  affectedSection: string;
  explanation: string;
  suggestedFix: string;
  location: string;
  impact: number;
}): AtsDiagnosticIssue => ({
  id: makeIssueId(input.category, input.affectedSection, input.title, input.location),
  ...input,
});

const normalizeEvidenceText = (text: string) =>
  text
    .toLowerCase()
    .replace(/c\+\+/g, 'cplusplus')
    .replace(/c#/g, 'csharp')
    .replace(/\bjava[\s.-]*script\b/g, 'javascript')
    .replace(/\breact(?:\.|\s)*js\b/g, 'react')
    .replace(/\bnode(?:\.|\s)*js\b/g, 'nodejs')
    .replace(/\bhtml\s*5\b/g, 'html5')
    .replace(/\bcss\s*3\b/g, 'css3')
    .replace(/\bnode\b/g, 'nodejs')
    .replace(/\bhtml\b/g, 'html5')
    .replace(/\bcss\b/g, 'css3')
    .replace(/\bgit\s+hub\b/g, 'github')
    .replace(/\bjs\b/g, 'javascript')
    .replace(/\bts\b/g, 'typescript')
    .replace(/\bpercent(?:age)?\b/g, 'percentage')
    .replace(/%/g, ' percentage ')
    .replace(/\bcgpa\b/g, 'cgpa')
    .replace(/\bgpa\b/g, 'gpa');

const normalizedCanonicalAliasMap = new Map<string, string>(
  Object.entries(CANONICAL_ALIAS_MAP).flatMap(([canonicalTerm, aliases]) => {
    const normalizedCanonical = normalizeEvidenceText(canonicalTerm).trim();
    return [normalizedCanonical, ...aliases.map(alias => normalizeEvidenceText(alias).trim())]
      .filter(Boolean)
      .map(term => [term, normalizedCanonical] as const);
  })
);

const canonicalAcceptedForms = new Map<string, string[]>(
  Object.entries(CANONICAL_ALIAS_MAP).map(([canonicalTerm, aliases]) => {
    const normalizedCanonical = normalizeEvidenceText(canonicalTerm).trim();
    return [
      normalizedCanonical,
      unique([
        normalizedCanonical,
        ...aliases.map(alias => normalizeEvidenceText(alias).trim()),
      ]),
    ] as const;
  })
);

const canonicalizeTerm = (term: string) => {
  const normalized = normalizeEvidenceText(term).trim();
  return normalizedCanonicalAliasMap.get(normalized) || normalized;
};

const acceptedFormsForTerm = (term: string) => {
  const canonical = canonicalizeTerm(term);
  return canonicalAcceptedForms.get(canonical) || [canonical];
};

const tokenize = (text: string) =>
  normalizeEvidenceText(text)
    .replace(/[^a-z0-9.+/#-]+/g, ' ')
    .split(/\s+/)
    .map(token => token.replace(/^[.+/#-]+|[.+/#-]+$/g, ''))
    .filter(Boolean);

const countOccurrences = (text: string, phrase: string) => {
  const normalizedText = normalizeEvidenceText(text);
  const normalizedPhrase = normalizeEvidenceText(phrase).trim();
  const escaped = normalizedPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (normalizedText.match(new RegExp(`(^|\\W)${escaped}(?=\\W|$)`, 'gi')) || []).length;
};

const hasPhrase = (text: string, phrase: string) => countOccurrences(text, phrase) > 0;

const getCanonicalMatch = (text: string, term: string) => {
  const canonical = canonicalizeTerm(term);
  if (hasPhrase(text, canonical)) {
    return { canonical, matched: true, matchType: 'exact' as const };
  }
  const aliasMatched = acceptedFormsForTerm(canonical)
    .filter(form => form !== canonical)
    .some(form => hasPhrase(text, form));
  return {
    canonical,
    matched: aliasMatched,
    matchType: aliasMatched ? 'related' as const : 'missing' as const,
  };
};

const countCanonicalOccurrences = (text: string, term: string) =>
  acceptedFormsForTerm(term).reduce((sum, form) => sum + countOccurrences(text, form), 0);

const roleFamilyLabel = (family: AtsRoleFamily) =>
  family === 'general-other' ? 'General / Other' : ROLE_FAMILY_DEFINITIONS[family].label;

const roleSignalMatches = (text: string, family: Exclude<AtsRoleFamily, 'general-other'>) =>
  ROLE_FAMILY_DEFINITIONS[family].signals.filter(signal => hasPhrase(text, signal));

const detectRoleFamily = (text: string): AtsRoleFamily => {
  const scored = (Object.keys(ROLE_FAMILY_DEFINITIONS) as Array<
    Exclude<AtsRoleFamily, 'general-other'>
  >).map(family => {
    const matches = roleSignalMatches(text, family);
    const score = matches.reduce((sum, signal) => (
      sum + (signal.includes(' ') ? 3 : 2) + Math.min(2, countOccurrences(text, signal) - 1)
    ), 0);
    return { family, score };
  }).sort((a, b) => b.score - a.score);

  if (!scored[0] || scored[0].score < 3) return 'general-other';
  return scored[0].family;
};

const strongestPlacementWeight = (placements: string[]) =>
  placements.reduce((best, placement) => (
    Math.max(best, ROLE_SECTION_WEIGHTS[placement as keyof typeof ROLE_SECTION_WEIGHTS] || 0.25)
  ), 0);

const classifyEvidenceStrength = (placements: string[]) => {
  const weight = strongestPlacementWeight(placements);
  if (weight >= 0.78) return 'strong' as const;
  if (placements.length > 0) return 'weak' as const;
  return 'missing' as const;
};

const validEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value.trim());

const validPhone = (value: string) =>
  /^\+?[\d\s().-]{7,20}$/.test(value.trim()) &&
  value.replace(/\D/g, '').length >= 7;

const extractSkills = (text: string): SkillCategory => {
  const lower = text.toLowerCase();
  return Object.fromEntries(
    Object.entries(SKILL_DICTIONARY).map(([category, skills]) => [
      category,
      unique(
        skills
          .filter(skill => getCanonicalMatch(lower, skill).matched)
          .map(skill => canonicalizeTerm(skill).toUpperCase())
      ),
    ])
  ) as unknown as SkillCategory;
};

const flattenSkills = (skills: SkillCategory) =>
  unique(Object.values(skills).flat().map(skill => canonicalizeTerm(skill)));

const detectHeading = (line: string): SectionKey | null => {
  const normalized = line.replace(/[:|]+$/, '').trim();
  if (!normalized || normalized.length > 45) return null;
  return (Object.entries(SECTION_ALIASES) as Array<[SectionKey, RegExp[]]>)
    .find(([, patterns]) => patterns.some(pattern => pattern.test(normalized)))?.[0] || null;
};

const splitBlocks = (lines: string[]) => {
  const blocks: string[][] = [];
  let current: string[] = [];
  lines.forEach(line => {
    if (!line.trim()) {
      if (current.length) blocks.push(current);
      current = [];
      return;
    }
    current.push(line.trim());
  });
  if (current.length) blocks.push(current);
  return blocks;
};

const splitDatedEntryBlocks = (lines: string[]) => {
  const explicitBlocks = splitBlocks(lines);
  if (explicitBlocks.length > 1) return explicitBlocks;
  const compactLines = lines.map(line => line.trim()).filter(Boolean);
  const blocks: string[][] = [];
  let current: string[] = [];
  compactLines.forEach((line, index) => {
    const nextLine = compactLines[index + 1] || '';
    const currentHasDate = current.some(value => /\b(?:19|20)\d{2}\b/.test(value));
    const nextHasDate = /\b(?:19|20)\d{2}\b/.test(nextLine);
    if (current.length && currentHasDate && nextHasDate && !/\b(?:19|20)\d{2}\b/.test(line)) {
      blocks.push(current);
      current = [];
    }
    current.push(line);
  });
  if (current.length) blocks.push(current);
  return blocks;
};

const extractDateRange = (text: string) => {
  const years = text.match(/\b(?:19|20)\d{2}\b/g) || [];
  return {
    startDate: years[0] || '',
    endDate: /\bpresent|current\b/i.test(text) ? 'Present' : years[1] || '',
  };
};

const entryId = (prefix: string, index: number) => `${prefix}_${index + 1}`;

const parseExperienceBlocks = (lines: string[], prefix: string): ExperienceEntry[] =>
  splitDatedEntryBlocks(lines)
    .filter(block => block.join(' ').length > 12)
    .slice(0, 12)
    .map((block, index) => {
      const text = block.join(' ');
      const dates = extractDateRange(text);
      const first = block[0] || '';
      const atParts = first.split(/\s+(?:at|@|\||–|—)\s+/i);
      return {
        id: entryId(prefix, index),
        title: atParts[0]?.trim() || first,
        company: atParts[1]?.trim() || block[1]?.trim() || '',
        location: '',
        ...dates,
        description: block.slice(atParts.length > 1 ? 1 : 2).join(' ').trim(),
      };
    });

const parseInternshipBlocks = (lines: string[]): InternshipEntry[] =>
  parseExperienceBlocks(lines, 'intern').map(entry => ({
    id: entry.id,
    role: entry.title,
    company: entry.company,
    location: entry.location,
    startDate: entry.startDate,
    endDate: entry.endDate,
    description: entry.description,
    technologiesUsed: '',
  }));

const parseProjectBlocks = (lines: string[]): ProjectEntry[] =>
  splitBlocks(lines)
    .filter(block => block.join(' ').length > 8)
    .slice(0, 12)
    .map((block, index) => {
      const text = block.join(' ');
      const github = text.match(/(?:https?:\/\/)?github\.com\/[^\s)]+/i)?.[0] || '';
      const live = text.match(/https?:\/\/(?!github\.com)[^\s)]+/i)?.[0] || '';
      const technologies = flattenSkills(extractSkills(text)).join(', ');
      return {
        id: entryId('project', index),
        name: block[0] || `Project ${index + 1}`,
        description: block.slice(1).join(' ').trim(),
        technologies,
        github,
        live,
      };
    });

const parseEducationBlocks = (lines: string[]): EducationEntry[] =>
  splitDatedEntryBlocks(lines)
    .filter(block => block.join(' ').length > 6)
    .slice(0, 10)
    .map((block, index) => {
      const text = block.join(' ');
      const dates = extractDateRange(text);
      const score = text.match(
        /\b(?:cgpa|gpa|percentage|percent)\s*[:\-]?\s*\d+(?:\.\d+)?(?:\s*\/\s*(?:4|10)(?:\.0+)?)?|\b\d+(?:\.\d+)?\s*%/i
      )?.[0] || '';
      return {
        id: entryId('education', index),
        degree: block[0] || '',
        institution: block[1] || '',
        location: '',
        ...dates,
        ...normalizeEducationScore({ degree: block[0] || '', gpa: score }),
        description: block.slice(2).join(' ').trim(),
      };
    });

const parseCertifications = (lines: string[]): CertificationEntry[] =>
  lines.filter(Boolean).slice(0, 15).map((line, index) => ({
    id: entryId('cert', index),
    name: line,
    issuer: '',
    date: extractDateRange(line).startDate,
    url: line.match(/https?:\/\/[^\s)]+/i)?.[0] || '',
  }));

const URL_PATTERN = /\bhttps?:\/\/[^\s)]+/gi;

const extractUrls = (text: string) => unique((text.match(URL_PATTERN) || []).map(url => url.trim()));

const parseTechnologyList = (technologies: string) =>
  technologies
    .split(/[,;|]/)
    .map(value => value.trim())
    .filter(Boolean);

const hasRoleLikeProjectEvidence = (project: Pick<ProjectEntry, 'name' | 'description' | 'technologies'>) => {
  const combined = `${project.name} ${project.description}`.toLowerCase();
  const hasRoleSignal = /\b(?:engineer|developer|intern|lead|manager|analyst|architect|consultant|designer|researcher)\b/i.test(project.name) ||
    /\b(?:built|developed|implemented|led|owned|delivered|launched|optimized|deployed|managed)\b/i.test(combined);
  const techCount = parseTechnologyList(project.technologies).length;
  const hasOutcome = IMPACT_WORDS.some(word => hasPhrase(combined, word)) ||
    /(?:\d+(?:\.\d+)?%|\d+\+|\$[\d,.]+|\d+(?:\.\d+)?x\b|\d+\s*(?:users|clients|hours|days|teams|projects|million|billion|k)\b)/i.test(project.description);
  return hasRoleSignal && techCount > 0 && hasOutcome;
};

export function validateResumeText(text: string): { isValid: boolean; error?: string } {
  const trimmed = text.trim();
  if (!trimmed) return { isValid: false, error: 'The uploaded file is empty.' };
  if (trimmed.length < 120) {
    return { isValid: false, error: 'The document contains too little readable resume text.' };
  }
  const signals = [
    /@/, /\bexperience\b/i, /\beducation\b/i, /\bskills?\b/i, /\bprojects?\b/i,
    /\b(?:19|20)\d{2}\b/, /\b(?:developer|engineer|manager|analyst|designer)\b/i,
  ].filter(pattern => pattern.test(trimmed)).length;
  return signals >= 3
    ? { isValid: true }
    : { isValid: false, error: 'This file does not contain enough recognizable resume structure.' };
}

export function parseResumeTextLocally(text: string, userId = 'local_user'): ProfileData {
  const rawLines = text.replace(/\r/g, '').split('\n');
  const nonEmptyLines = rawLines.map(line => line.trim()).filter(Boolean);
  const sections: Record<SectionKey, string[]> = {
    summary: [], skills: [], experience: [], internships: [], projects: [],
    education: [], certifications: [], achievements: [],
  };
  const headerLines: string[] = [];
  let currentSection: SectionKey | null = null;

  rawLines.forEach(rawLine => {
    const line = rawLine.trim();
    const heading = detectHeading(line);
    if (heading) {
      currentSection = heading;
      return;
    }
    if (currentSection) sections[currentSection].push(line);
    else if (line) headerLines.push(line);
  });

  const email = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0] || '';
  const phone = text.match(/(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/)?.[0] || '';
  const urls = extractUrls(text);
  const linkedin = urls.find(url => /linkedin\.com\/(?:in|pub)\//i.test(url)) || '';
  const github = urls.find(url => /github\.com\//i.test(url)) || '';
  const website = urls.find(url => !/linkedin\.com|github\.com/i.test(url)) || '';
  const nameCandidates = headerLines.filter(line =>
    line.length >= 3 && line.length <= 70 && !line.includes('@') && !/\d{3}/.test(line)
  );
  const fullName = nameCandidates[0] || nonEmptyLines[0] || '';
  const professionalTitle = nameCandidates.find(line => line !== fullName) || '';
  const skills = extractSkills(`${sections.skills.join(' ')} ${text}`);

  return {
    uid: userId,
    personalDetails: {
      fullName,
      professionalTitle,
      email,
      phone,
      location: '',
      linkedin,
      github,
      website,
      profilePhoto: '',
    },
    summary: sections.summary.filter(Boolean).join(' ').trim(),
    careerObjective: sections.summary.filter(Boolean).join(' ').trim(),
    education: parseEducationBlocks(sections.education),
    experience: parseExperienceBlocks(sections.experience, 'experience'),
    internships: parseInternshipBlocks(sections.internships),
    projects: parseProjectBlocks(sections.projects),
    skills,
    certifications: parseCertifications(sections.certifications),
    achievements: sections.achievements.filter(Boolean),
    volunteering: [],
    languages: [],
    customSections: [],
    linkDisplayMode: 'embedded',
    updatedAt: new Date().toISOString(),
  };
}

export function profileFromResumeData(resume: ResumeData, userId: string): ProfileData {
  return {
    uid: userId,
    personalDetails: resume.personalDetails,
    summary: resume.summary,
    careerObjective: resume.summary,
    education: resume.education,
    experience: resume.experience,
    internships: resume.internships || [],
    projects: resume.projects,
    skills: resume.skills,
    certifications: resume.certifications,
    achievements: resume.achievements,
    volunteering: resume.volunteering,
    languages: resume.languages,
    customSections: resume.customSections,
    linkDisplayMode: resume.linkDisplayMode,
    updatedAt: resume.updatedAt,
  };
}

const resumeSections = (resume: ProfileData, rawText = '') => ({
  header: [
    resume.personalDetails.fullName,
    resume.personalDetails.professionalTitle,
    resume.personalDetails.email,
    resume.personalDetails.phone,
    resume.personalDetails.location,
  ].join(' ').toLowerCase(),
  summary: `${resume.summary} ${resume.careerObjective}`.toLowerCase(),
  skills: flattenSkills(resume.skills).join(' '),
  experience: [...resume.experience, ...(resume.internships || [])]
    .map(entry => 'role' in entry
      ? `${entry.role} ${entry.company} ${entry.description} ${entry.technologiesUsed}`
      : `${entry.title} ${entry.company} ${entry.description}`)
    .join(' ')
    .toLowerCase(),
  projects: resume.projects.map(project =>
    `${project.name} ${project.description} ${project.technologies}`
  ).join(' ').toLowerCase(),
  education: resume.education.map(entry =>
    `${entry.degree} ${entry.institution} ${entry.description} ${entry.gpa}`
  ).join(' ').toLowerCase(),
  certifications: resume.certifications.map(entry =>
    `${entry.name} ${entry.issuer}`
  ).join(' ').toLowerCase(),
  achievements: resume.achievements.join(' ').toLowerCase(),
  source: rawText.toLowerCase(),
});

const buildWeightedKeywords = (
  jobDescription: string,
  sections: ReturnType<typeof resumeSections>,
  roleFamily: AtsRoleFamily
) => {
  const jdSkills = extractSkills(jobDescription);
  const technicalSkills = [
    ...jdSkills.programmingLanguages,
    ...jdSkills.frameworks,
    ...jdSkills.tools,
    ...jdSkills.databases,
  ].map(value => canonicalizeTerm(value));
  const softSkills = jdSkills.softSkills.map(value => canonicalizeTerm(value));
  const keywordLabels = new Map<string, string>();
  [...technicalSkills, ...softSkills].forEach(skill => {
    keywordLabels.set(canonicalizeTerm(skill), skill);
  });
  const technical = new Set(technicalSkills);
  const soft = new Set(softSkills);
  const roleSignals = roleFamily === 'general-other'
    ? []
    : roleSignalMatches(jobDescription, roleFamily);
  const roleTerms = new Set(roleSignals.map(signal => canonicalizeTerm(signal)));
  const frequency = new Map<string, number>();
  tokenize(jobDescription).forEach(token => {
    if (
      token.length < 4 ||
      STOP_WORDS.has(token) ||
      LOW_VALUE_TARGET_TERMS.has(token)
    ) return;
    const canonicalToken = canonicalizeTerm(token);
    frequency.set(canonicalToken, (frequency.get(canonicalToken) || 0) + 1);
  });
  [...technical, ...soft].forEach(skill => {
    frequency.set(skill, Math.max(frequency.get(skill) || 0, 2));
  });
  roleTerms.forEach(term => {
    frequency.set(term, Math.max(frequency.get(term) || 0, 2));
  });

  const candidates = [...frequency.entries()]
    .filter(([canonicalKeyword, count]) => (
      technical.has(canonicalKeyword) ||
      soft.has(canonicalKeyword) ||
      roleTerms.has(canonicalKeyword) ||
      count >= 2
    ))
    .map(([canonicalKeyword, count]) => ({
      keyword: keywordLabels.get(canonicalKeyword) || canonicalKeyword,
      weight: technical.has(canonicalKeyword)
        ? 10
        : roleTerms.has(canonicalKeyword)
          ? 9
        : soft.has(canonicalKeyword)
          ? 3
          : clamp(count, 1, 2),
    }))
    .sort((a, b) => b.weight - a.weight || b.keyword.length - a.keyword.length)
    .slice(0, 30);

  const sectionEntries = Object.entries(sections);
  return candidates.map(({ keyword, weight }): WeightedKeyword => {
    const canonicalKeyword = canonicalizeTerm(keyword);
    const exactPlacements = sectionEntries
      .filter(([, text]) => getCanonicalMatch(text, canonicalKeyword).matchType === 'exact')
      .map(([section]) => section);
    const relatedPlacements = sectionEntries
      .filter(([, text]) => getCanonicalMatch(text, canonicalKeyword).matchType === 'related')
      .map(([section]) => section);
    const placements = unique([...exactPlacements, ...relatedPlacements]);
    return {
      keyword: canonicalKeyword,
      weight,
      matched: placements.length > 0,
      matchType: exactPlacements.length
        ? 'exact'
        : relatedPlacements.length
          ? 'related'
          : 'missing',
      placements,
      evidenceStrength: classifyEvidenceStrength(placements),
    };
  });
};

const estimateYears = (entries: ExperienceEntry[]) => {
  const years = entries.flatMap(entry => [
    Number.parseInt(entry.startDate.match(/\b(?:19|20)\d{2}\b/)?.[0] || '', 10),
    Number.parseInt(entry.endDate.match(/\b(?:19|20)\d{2}\b/)?.[0] || '', 10),
  ]).filter(Number.isFinite);
  if (years.length < 2) return 0;
  return Math.max(0, Math.min(50, Math.max(...years) - Math.min(...years)));
};

const analyzeFormatting = (
  resume: ProfileData,
  rawText: string,
  sectionFeedback: string[],
  sourceKind: AtsSourceKind
) => {
  let score = 100;
  const feedback: string[] = [];

  const headingMatches = (Object.values(SECTION_ALIASES) as RegExp[][]).filter(patterns =>
    rawText.split(/\r?\n/).some(line => patterns.some(pattern => pattern.test(line.replace(/[:|]+$/, '').trim())))
  ).length;
  if (rawText && headingMatches < 3) {
    score -= 10;
    feedback.push('Section headings are sparse or inconsistent in extracted text.');
  }
  const headingOrder = rawText.split(/\r?\n/)
    .map(line => detectHeading(line))
    .filter((heading): heading is SectionKey => Boolean(heading));
  const duplicateHeadings = headingOrder.length - new Set(headingOrder).size;
  if (duplicateHeadings > 2) {
    score -= Math.min(10, duplicateHeadings * 2);
    feedback.push('Repeated section headings may indicate broken pagination or duplicated content.');
  }
  const tableSignals = rawText.split(/\r?\n/).filter(line =>
    (line.match(/\|/g) || []).length >= 2 || (line.match(/\t/g) || []).length >= 2
  ).length;
  if (tableSignals > 2) {
    score -= Math.min(15, tableSignals * 2);
    feedback.push('Table-like formatting may reduce ATS parsing reliability.');
  }
  const iconSignals = (rawText.match(/[★◆●■▶✓☎✉]/g) || []).length;
  if (iconSignals > 6) {
    score -= Math.min(10, iconSignals - 5);
    feedback.push('Excessive decorative icons may interfere with text extraction.');
  }
  if (rawText && rawText.split(/\s+/).length < 180) {
    score -= 8;
    feedback.push('The extracted resume contains limited readable text.');
  }
  if (sourceKind === 'image-ocr') {
    score -= 25;
    feedback.push('Image-based resume content relies on OCR and is less reliable for ATS parsing.');
  }
  if (!feedback.length) sectionFeedback.push('Document structure is ATS-readable.');
  return { score: clamp(score), feedback };
};

const analyzeContact = (resume: ProfileData) => {
  const details = resume.personalDetails;
  const feedback: string[] = [];
  let score = 0;
  if (details.fullName.trim()) score += 20;
  else feedback.push('Candidate name is missing.');
  if (validEmail(details.email)) score += 35;
  else feedback.push(details.email ? 'Email format appears invalid.' : 'Email address is missing.');
  if (validPhone(details.phone)) score += 30;
  else feedback.push(details.phone ? 'Phone format appears invalid.' : 'Phone number is missing.');
  if (details.location.trim()) score += 15;
  else feedback.push('Location is missing.');
  return { score: clamp(score), feedback };
};

const analyzeLinks = (resume: ProfileData, rawText = '') => {
  const details = resume.personalDetails;
  const rawUrls = extractUrls(rawText);
  const profileLinks = unique([
    details.linkedin,
    details.github,
    details.website,
    ...rawUrls.filter(url => /linkedin\.com|github\.com/i.test(url)),
  ].filter(value => value.trim())).length;
  const projectLinkCount = resume.projects.filter(project => (
    project.github || project.live || rawUrls.some(url => project.description.includes(url) || project.name.includes(url))
  )).length;
  const credentialLinkCount = resume.certifications.filter(entry => entry.url).length;
  const possibleProjectLinks = resume.projects.length ? 35 : 0;
  const possibleCredentialLinks = resume.certifications.length ? 15 : 0;
  const possible = 50 + possibleProjectLinks + possibleCredentialLinks;
  const earned =
    Math.min(50, profileLinks * 20) +
    (resume.projects.length ? projectLinkCount / resume.projects.length * possibleProjectLinks : 0) +
    (resume.certifications.length
      ? credentialLinkCount / resume.certifications.length * possibleCredentialLinks
      : 0);
  const feedback: string[] = [];
  if (!profileLinks && rawUrls.length === 0) feedback.push('Add a verified LinkedIn, GitHub, or portfolio link.');
  if (resume.projects.length && !projectLinkCount) feedback.push('Projects have no GitHub or live-demo links.');
  if (resume.certifications.length && !credentialLinkCount) feedback.push('Certifications have no credential links.');
  return { score: clamp(possible ? earned / possible * 100 : 70), feedback };
};

const analyzeKeywords = (
  weightedKeywords: WeightedKeyword[],
  sections: ReturnType<typeof resumeSections>
) => {
  const totalWeight = weightedKeywords.reduce((sum, item) => sum + item.weight, 0) || 1;
  const exactWeight = weightedKeywords.reduce((sum, item) => {
    if (item.matchType !== 'exact') return sum;
    return sum + item.weight * strongestPlacementWeight(item.placements);
  }, 0);
  const relatedWeight = weightedKeywords.reduce((sum, item) => {
    if (item.matchType !== 'related') return sum;
    return sum + item.weight * strongestPlacementWeight(item.placements) * 0.75;
  }, 0);
  const exactCoverage = exactWeight / totalWeight * 100;
  const relatedCoverage = relatedWeight / totalWeight * 100;
  const resumeText = Object.values(sections).join(' ');
  const resumeWords = Math.max(1, tokenize(resumeText).length);
  const occurrenceCounts = weightedKeywords
    .filter(item => item.matched)
    .map(item => ({
      item,
      count: countCanonicalOccurrences(resumeText, item.keyword),
    }));
  const matchedOccurrences = occurrenceCounts.reduce((sum, entry) => sum + entry.count, 0);
  const density = (matchedOccurrences / resumeWords) * 100;
  const densityScore = density < 0.5 ? density * 120 : density <= 4 ? 100 : Math.max(30, 100 - (density - 4) * 12);
  const highValue = weightedKeywords.filter(item => item.weight >= 8);
  const placementScore = highValue.length
    ? highValue.reduce((sum, item) => {
        return sum + strongestPlacementWeight(item.placements) * 100;
      }, 0) / highValue.length
    : 75;
  const unsupportedRepetition = occurrenceCounts.filter(({ item, count }) => (
    count > 5 && item.evidenceStrength !== 'strong'
  )).length;
  const stuffingPenalty = Math.min(
    24,
    unsupportedRepetition * 6 +
    (unsupportedRepetition > 0 && density > 7 ? (density - 7) * 3 : 0)
  );
  const coverage = exactCoverage + relatedCoverage;
  const score = clamp(
    coverage * 0.75 +
    densityScore * 0.08 +
    placementScore * 0.17 -
    stuffingPenalty
  );
  return {
    score,
    exactCoverage: clamp(exactCoverage),
    relatedCoverage: clamp(relatedCoverage),
    density,
    placementScore: clamp(placementScore),
    stuffingPenalty: clamp(stuffingPenalty, 0, 100),
    weightedKeywords,
  };
};

const analyzeGeneralKeywords = (
  resume: ProfileData,
  sections: ReturnType<typeof resumeSections>
) => {
  const resumeSkills = unique([
    ...flattenSkills(resume.skills),
    ...flattenSkills(extractSkills(sections.source)),
  ]);
  const evidenceSections = {
    summary: sections.summary,
    experience: sections.experience,
    projects: sections.projects,
    education: sections.education,
    source: sections.source,
  };
  const evidenceText = Object.values(evidenceSections).join(' ');
  const weightedKeywords: WeightedKeyword[] = resumeSkills.map(keyword => {
    const placements = Object.entries(evidenceSections)
      .filter(([, text]) => getCanonicalMatch(text, keyword).matched)
      .map(([section]) => section);
    return {
      keyword,
      weight: 5,
      matched: placements.length > 0,
      matchType: placements.length ? 'exact' : 'missing',
      placements,
      evidenceStrength: classifyEvidenceStrength(placements),
    };
  });
  const evidenced = weightedKeywords.filter(item => item.matched).length;
  const evidenceCoverage = resumeSkills.length ? evidenced / resumeSkills.length * 100 : 0;
  const inventoryScore = Math.min(100, resumeSkills.length * 7);
  const resumeWords = Math.max(1, tokenize(Object.values(sections).join(' ')).length);
  const occurrences = resumeSkills.reduce((sum, skill) => sum + countOccurrences(evidenceText, skill), 0);
  const density = occurrences / resumeWords * 100;
  const densityScore = density === 0 ? 20 : density <= 4 ? Math.min(100, 45 + density * 20) : Math.max(45, 100 - (density - 4) * 10);
  const score = clamp(inventoryScore * 0.4 + evidenceCoverage * 0.4 + densityScore * 0.2);
  return {
    score,
    exactCoverage: clamp(evidenceCoverage),
    relatedCoverage: 0,
    density,
    placementScore: clamp(evidenceCoverage),
    stuffingPenalty: 0,
    weightedKeywords,
  };
};

const analyzeSkills = (resume: ProfileData, jobDescription: string, sections: ReturnType<typeof resumeSections>) => {
  const target = extractSkills(jobDescription);
  const targetByCategory = Object.entries(target) as [keyof SkillCategory, string[]][];
  const sourceSkills = extractSkills(sections.source);
  const resumeSkills = unique([
    ...flattenSkills(resume.skills),
    ...flattenSkills(sourceSkills),
  ]);
  const targetSkills = unique(targetByCategory.flatMap(([, values]) => values.map(value => value.toLowerCase())));
  if (!jobDescription.trim()) {
    const evidenceText = `${sections.summary} ${sections.experience} ${sections.projects} ${sections.source}`;
    const evidenced = resumeSkills.filter(skill => hasPhrase(evidenceText, skill));
    const evidence = resumeSkills.length ? evidenced.length / resumeSkills.length * 100 : 0;
    const activeCategories = Object.keys(resume.skills).filter(category =>
      resume.skills[category as keyof SkillCategory].length > 0 ||
      sourceSkills[category as keyof SkillCategory].length > 0
    ).length;
    const diversity = Math.min(100, activeCategories * 20 + Math.min(30, resumeSkills.length * 2));
    const inventory = Math.min(100, resumeSkills.length * 7);
    return {
      score: clamp(evidence * 0.5 + diversity * 0.35 + inventory * 0.15),
      matched: evidenced,
      missing: [],
      relevance: clamp(evidence),
      diversity: clamp(diversity),
      recency: clamp(evidence),
    };
  }
  const matched = targetSkills.filter(skill =>
    resumeSkills.includes(skill) || getCanonicalMatch(Object.values(sections).join(' '), skill).matched
  );
  const missing = targetSkills.filter(skill => !matched.includes(skill));
  const relevance = targetSkills.length ? matched.length / targetSkills.length * 100 : 70;
  const activeCategories = Object.keys(resume.skills).filter(category =>
    resume.skills[category as keyof SkillCategory].length > 0 ||
    sourceSkills[category as keyof SkillCategory].length > 0
  ).length;
  const diversity = Math.min(100, activeCategories * 18 + Math.min(25, resumeSkills.length * 2));
  const recentText = `${sections.experience} ${sections.projects}`;
  const recentMatches = matched.filter(skill => hasPhrase(recentText, skill)).length;
  const recency = matched.length ? recentMatches / matched.length * 100 : 50;
  return {
    score: clamp(relevance * 0.65 + diversity * 0.2 + recency * 0.15),
    matched,
    missing,
    relevance: clamp(relevance),
    diversity: clamp(diversity),
    recency: clamp(recency),
  };
};

const analyzeRoleMatch = (
  jobDescription: string,
  sections: ReturnType<typeof resumeSections>,
  weightedKeywords: WeightedKeyword[],
  roleFamily: AtsRoleFamily
) => {
  if (!jobDescription.trim()) {
    return {
      roleScore: 0,
      hardSkillScore: 0,
      hardSkillCount: 0,
      softSkillScore: 0,
      educationRequired: false,
      familyMismatchPenalty: 0,
      resumeRoleFamily: 'general-other' as AtsRoleFamily,
      strongEvidence: [] as string[],
      weakEvidence: [] as string[],
    };
  }

  const targetSkills = extractSkills(jobDescription);
  const hardSkills = unique([
    ...targetSkills.programmingLanguages,
    ...targetSkills.frameworks,
    ...targetSkills.tools,
    ...targetSkills.databases,
  ].map(canonicalizeTerm));
  const softSkills = unique(targetSkills.softSkills.map(canonicalizeTerm));
  const allSectionText = Object.values(sections).join(' ');
  const resumeRoleFamily = detectRoleFamily(
    `${sections.header} ${sections.summary} ${sections.experience} ${sections.projects} ${sections.skills}`
  );
  const requestedRoleSignals = roleFamily === 'general-other'
    ? []
    : unique(roleSignalMatches(jobDescription, roleFamily));

  const scoreTermsByPlacement = (terms: string[]) => {
    if (!terms.length) return 0;
    return terms.reduce((sum, term) => {
      const placements = Object.entries(sections)
        .filter(([, text]) => getCanonicalMatch(text, term).matched)
        .map(([section]) => section);
      return sum + strongestPlacementWeight(placements) * 100;
    }, 0) / terms.length;
  };

  const hardSkillScore = clamp(scoreTermsByPlacement(hardSkills));
  const softSkillScore = clamp(scoreTermsByPlacement(softSkills));
  const roleSignalScore = requestedRoleSignals.length
    ? scoreTermsByPlacement(requestedRoleSignals)
    : roleFamily === 'general-other'
      ? 65
      : 0;
  const titleSignalScore = requestedRoleSignals.some(signal => hasPhrase(sections.header, signal))
    ? 100
    : roleFamily !== 'general-other' && resumeRoleFamily === roleFamily
      ? 72
      : 0;
  const roleScore = clamp(roleSignalScore * 0.72 + titleSignalScore * 0.28);
  const familyMismatchPenalty =
    roleFamily !== 'general-other' &&
    resumeRoleFamily !== 'general-other' &&
    resumeRoleFamily !== roleFamily &&
    roleScore < 40
      ? 22
      : roleFamily !== 'general-other' && roleScore < 20
        ? 12
        : 0;
  const educationRequired = /\b(?:bachelor|master|phd|doctorate|mba|degree|diploma)\b/i
    .test(jobDescription);
  const strongEvidence = weightedKeywords
    .filter(item => item.evidenceStrength === 'strong')
    .map(item => `${item.keyword.toUpperCase()} in ${item.placements.filter(
      placement => (ROLE_SECTION_WEIGHTS[placement as keyof typeof ROLE_SECTION_WEIGHTS] || 0) >= 0.78
    ).join(', ')}`);
  const weakEvidence = weightedKeywords
    .filter(item => item.evidenceStrength === 'weak')
    .map(item => `${item.keyword.toUpperCase()} appears only in ${item.placements.join(', ')}`);

  return {
    roleScore,
    hardSkillScore,
    hardSkillCount: hardSkills.length,
    softSkillScore,
    educationRequired,
    familyMismatchPenalty,
    resumeRoleFamily,
    strongEvidence: unique(strongEvidence),
    weakEvidence: unique(weakEvidence),
    targetEvidenceCount: weightedKeywords.filter(item => item.matched).length,
    targetEvidenceText: allSectionText,
  };
};

const analyzeExperience = (resume: ProfileData, jobDescription: string) => {
  const entries = [...resume.experience, ...(resume.internships || []).map(entry => ({
    id: entry.id,
    title: entry.role,
    company: entry.company,
    location: entry.location,
    startDate: entry.startDate,
    endDate: entry.endDate,
    description: entry.description,
  }))];
  const projectBackedExperience = resume.projects
    .filter(project => hasRoleLikeProjectEvidence(project))
    .map(project => ({
      id: project.id,
      title: project.name,
      company: project.technologies || 'Project-based experience',
      location: '',
      startDate: '',
      endDate: '',
      description: project.description,
    }));
  const evidenceEntries = [...entries, ...projectBackedExperience];
  if (!evidenceEntries.length) {
    return { score: 0, verbs: [], metrics: 0, impacts: 0, relevance: 0, years: 0 };
  }
  const descriptions = evidenceEntries.map(entry => entry.description).filter(Boolean);
  const text = descriptions.join(' ').toLowerCase();
  const verbs = ACTION_VERBS.filter(verb => hasPhrase(text, verb));
  const metrics = (text.match(
    /(?:\d+(?:\.\d+)?%|\d+\+|\$[\d,.]+|\d+(?:\.\d+)?x\b|\d+\s*(?:users|clients|hours|days|teams|projects|million|billion|k)\b)/gi
  ) || []).length;
  const impacts = descriptions.filter(description =>
    IMPACT_WORDS.some(word => hasPhrase(description.toLowerCase(), word))
  ).length;
  const clarity = descriptions.length
    ? descriptions.reduce((sum, description) => {
        const words = tokenize(description).length;
        return sum + (words >= 8 && words <= 80 ? 100 : words > 0 ? 55 : 0);
      }, 0) / descriptions.length
    : 35;
  const jdTokens = tokenize(jobDescription).filter(token => token.length > 4 && !STOP_WORDS.has(token));
  const titleText = evidenceEntries.map(entry => `${entry.title} ${entry.description}`).join(' ').toLowerCase();
  const relevantTokens = unique(jdTokens).slice(0, 30);
  const relevance = relevantTokens.length
    ? relevantTokens.filter(token => hasPhrase(titleText, token)).length / relevantTokens.length * 100
    : 70;
  const verbScore = Math.min(100, verbs.length * 12);
  const metricScore = Math.min(100, metrics * 20);
  const impactScore = Math.min(100, impacts / Math.max(1, evidenceEntries.length) * 100);
  return {
    score: clamp(verbScore * 0.25 + metricScore * 0.3 + impactScore * 0.2 + clarity * 0.15 + relevance * 0.1),
    verbs,
    metrics,
    impacts,
    relevance: clamp(relevance),
    years: estimateYears(resume.experience),
  };
};

const analyzeProjects = (projects: ProjectEntry[]) => {
  if (!projects.length) return { score: 0, detailed: 0, withTech: 0, withLinks: 0 };
  let total = 0;
  let detailed = 0;
  let withTech = 0;
  let withLinks = 0;
  projects.forEach(project => {
    const words = tokenize(project.description).length;
    const techCount = project.technologies.split(/[,|]/).filter(Boolean).length;
    const hasOutcome = IMPACT_WORDS.some(word => hasPhrase(project.description.toLowerCase(), word)) ||
      /\b(?:built|solved|enabled|supports?|used by|deployed)\b/i.test(project.description);
    const genericTodo = /\bto-?do\b/i.test(project.name) && words < 15;
    let score = 0;
    if (project.name) score += 10;
    if (words >= 12) { score += 30; detailed += 1; }
    else if (words > 0) score += 12;
    if (techCount >= 2) { score += 25; withTech += 1; }
    else if (techCount === 1) { score += 12; withTech += 1; }
    if (hasOutcome) score += 20;
    const descriptionLinks = extractUrls(project.description);
    if (project.github || descriptionLinks.some(url => /github\.com/i.test(url))) { score += 8; withLinks += 1; }
    if (project.live || descriptionLinks.some(url => !/github\.com/i.test(url))) { score += 7; withLinks += (project.github || descriptionLinks.some(url => /github\.com/i.test(url))) ? 0 : 1; }
    if (genericTodo) score -= 25;
    total += clamp(score);
  });
  return { score: clamp(total / projects.length), detailed, withTech, withLinks };
};

const analyzeEducation = (education: EducationEntry[], jobDescription: string) => {
  if (!education.length) return 0;
  const jd = jobDescription.toLowerCase();
  const requested = ['bachelor', 'master', 'phd', 'doctorate', 'mba', 'diploma']
    .filter(term => hasPhrase(jd, term));
  const degreeText = education.map(entry => entry.degree).join(' ').toLowerCase();
  const degreeFit = requested.length
    ? requested.some(term => hasPhrase(degreeText, term)) ? 100 : 65
    : 90;
  const completeness = education.reduce((sum, entry) => {
    return sum + [
      Boolean(entry.degree),
      Boolean(entry.institution),
      Boolean(entry.endDate || entry.startDate),
      Boolean(entry.gpa),
    ].filter(Boolean).length / 4 * 100;
  }, 0) / education.length;
  return clamp(degreeFit * 0.65 + completeness * 0.35);
};

const analyzeReadability = (resume: ProfileData) => {
  const textParts = [
    resume.summary,
    ...resume.experience.map(entry => entry.description),
    ...(resume.internships || []).map(entry => entry.description),
    ...resume.projects.map(project => project.description),
  ].filter(Boolean);
  if (!textParts.length) {
    return { score: 35, averageSentenceWords: 0, longParagraphs: 0, repeatedPhrases: 0, buzzwordCount: 0, grammarIssues: 0 };
  }
  const sentences = textParts.join(' ').split(/[.!?]+/).map(value => tokenize(value)).filter(words => words.length);
  const averageSentenceWords = sentences.length
    ? sentences.reduce((sum, words) => sum + words.length, 0) / sentences.length
    : 0;
  const longParagraphs = textParts.filter(part => tokenize(part).length > 90).length;
  const normalizedParts = textParts.map(part => tokenize(part).join(' ')).filter(Boolean);
  const repeatedPhrases = normalizedParts.length - new Set(normalizedParts).size;
  const lower = textParts.join(' ').toLowerCase();
  const buzzwordCount = BUZZWORDS.reduce((sum, buzzword) => sum + countOccurrences(lower, buzzword), 0);
  const grammarIssues = textParts.filter(part => {
    const trimmed = part.trim();
    const words = tokenize(trimmed).length;
    return words >= 10 && (
      /^[a-z]/.test(trimmed) ||
      !/[.!?)]$/.test(trimmed)
    );
  }).length;
  let score = 100;
  if (averageSentenceWords > 28) score -= Math.min(25, (averageSentenceWords - 28) * 2);
  if (averageSentenceWords > 0 && averageSentenceWords < 5) score -= 12;
  score -= Math.min(20, longParagraphs * 7);
  score -= Math.min(18, repeatedPhrases * 8);
  score -= Math.min(18, buzzwordCount * 5);
  score -= Math.min(15, grammarIssues * 4);
  return { score: clamp(score), averageSentenceWords, longParagraphs, repeatedPhrases, buzzwordCount, grammarIssues };
};

const analyzeCompleteness = (resume: ProfileData) => {
  const deductions: string[] = [];
  let score = 100;
  const contactComplete = Boolean(resume.personalDetails.fullName && resume.personalDetails.email && resume.personalDetails.phone);
  const projectExperienceEvidence = resume.projects.some(project => hasRoleLikeProjectEvidence(project));
  if (!contactComplete) { score -= 20; deductions.push('Contact information is incomplete (-20).'); }
  if (!flattenSkills(resume.skills).length) { score -= 20; deductions.push('Skills section is missing (-20).'); }
  if (!resume.experience.length && !(resume.internships || []).length && !projectExperienceEvidence) {
    score -= 25;
    deductions.push('Experience, internships, or role-structured projects are missing (-25).');
  }
  if (!resume.education.length) { score -= 15; deductions.push('Education section is missing (-15).'); }
  if (!resume.projects.length) { score -= 10; deductions.push('Projects section is missing (-10).'); }
  if (!(resume.summary || resume.careerObjective).trim()) {
    score -= 5;
    deductions.push('Professional summary or career objective is missing (-5).');
  }
  if (!resume.certifications.length && !resume.achievements.length) {
    score -= 5;
    deductions.push('No certifications or achievements are listed (-5).');
  }
  return { score: clamp(score), deductions };
};

const analyzeEvidenceStrength = (
  resume: ProfileData,
  sections: ReturnType<typeof resumeSections>,
  experience: ReturnType<typeof analyzeExperience>,
  projects: ReturnType<typeof analyzeProjects>
) => {
  const inventory = unique([
    ...flattenSkills(resume.skills),
    ...flattenSkills(extractSkills(sections.source)),
  ]);
  const contextualText = `${sections.summary} ${sections.experience} ${sections.projects} ${sections.source}`;
  const contextualSkills = inventory.filter(skill => hasPhrase(contextualText, skill)).length;
  const skillEvidence = inventory.length ? contextualSkills / inventory.length * 100 : 0;
  const impactEvidence = Math.min(
    100,
    experience.metrics * 18 + experience.impacts * 14 + experience.verbs.length * 7
  );
  const projectEvidence = resume.projects.length
    ? projects.detailed / resume.projects.length * 60 +
      projects.withTech / resume.projects.length * 25 +
      projects.withLinks / resume.projects.length * 15
    : 35;
  return clamp(skillEvidence * 0.4 + impactEvidence * 0.35 + projectEvidence * 0.25);
};

const scoreKeywordEvidenceInSections = (
  weightedKeywords: WeightedKeyword[],
  acceptedSections: string[]
) => {
  const totalWeight = weightedKeywords.reduce((sum, item) => sum + item.weight, 0) || 1;
  const supportedWeight = weightedKeywords.reduce((sum, item) => {
    const placement = item.placements.find(section => acceptedSections.includes(section));
    if (!placement) return sum;
    const matchFactor = item.matchType === 'related' ? 0.75 : 1;
    return sum + item.weight * matchFactor;
  }, 0);
  return clamp(supportedWeight / totalWeight * 100);
};

const estimateWrappedLines = (value: string, charactersPerLine: number) =>
  value.trim() ? Math.max(1, Math.ceil(value.trim().length / charactersPerLine)) : 0;

const estimatePageFit = (resume: ProfileData) => {
  const usablePageHeight = 760;
  const lineHeight = 11.5;
  let height = 54;
  let sectionWeight = 0;
  const addSection = (contentHeight: number) => {
    if (contentHeight > 0) {
      height += 17 + contentHeight + 5;
      sectionWeight += contentHeight;
    }
  };

  const contactText = [
    resume.personalDetails.phone,
    resume.personalDetails.email,
    resume.personalDetails.location,
    resume.personalDetails.linkedin ? 'LinkedIn' : '',
    resume.personalDetails.github ? 'GitHub' : '',
    resume.personalDetails.website ? 'Portfolio' : '',
  ].filter(Boolean).join(' • ');
  height += Math.max(1, Math.ceil(contactText.length / 92)) * 10;

  addSection(estimateWrappedLines(`${resume.summary} ${resume.careerObjective}`, 96) * lineHeight);
  addSection(Object.values(resume.skills)
    .filter(values => values.length > 0)
    .reduce((sum, values) => sum + Math.max(1, Math.ceil(values.join(', ').length / 82)) * 10.5, 0));
  addSection([...resume.experience, ...(resume.internships || [])].reduce((sum, entry) => (
    sum + 19 + estimateWrappedLines(entry.description, 92) * lineHeight + 4
  ), 0));
  addSection(resume.projects.reduce((sum, project) => (
    sum +
    19 +
    (project.technologies.trim() ? 10.5 : 0) +
    (project.github || project.live ? 10.5 : 0) +
    estimateWrappedLines(project.description, 92) * lineHeight +
    4
  ), 0));
  addSection(resume.education.length * 27);
  addSection(resume.certifications.length * 23);
  addSection(resume.achievements.reduce((sum, achievement) => (
    sum + estimateWrappedLines(achievement, 92) * lineHeight + 3
  ), 0));
  addSection((resume.volunteering || []).reduce((sum, entry) => (
    sum + 19 + estimateWrappedLines(entry.description, 92) * lineHeight + 4
  ), 0));
  addSection(resume.languages.length ? Math.ceil(resume.languages.join(', ').length / 92) * 11 : 0);
  addSection(resume.customSections.reduce((sum, section) => (
    sum + section.items.reduce((itemSum, item) => (
      itemSum + 17 + estimateWrappedLines(item.description, 92) * lineHeight + 3
    ), 0)
  ), 0));

  const densityRatio = height / usablePageHeight;
  const estimatedPages = Number(Math.max(1, densityRatio).toFixed(2));
  const fitCategory = densityRatio <= 1.1
    ? 'single-page safe' as const
    : densityRatio <= 1.15
      ? 'near limit' as const
      : 'multi-page likely' as const;
  const overflowRisk = densityRatio <= 1.1
    ? 'low' as const
    : densityRatio <= 1.15
      ? 'medium' as const
      : 'high' as const;
  const score = densityRatio <= 1.1
    ? clamp(100 - densityRatio * 10)
    : densityRatio <= 1.15
      ? clamp(90 - (densityRatio - 1.1) * 130)
      : clamp(60 - (densityRatio - 1.15) * 35);

  return {
    score,
    details: { estimatedPages, fitCategory, overflowRisk },
    lineDensity: Number((height / lineHeight).toFixed(1)),
    sectionWeight: Number(sectionWeight.toFixed(1)),
    densityRatio: Number(densityRatio.toFixed(2)),
  };
};

const analyzeResponsiveness = (
  resume: ProfileData,
  pageFit: ReturnType<typeof estimatePageFit>,
  templatePlan: ResumeTemplatePlan | null,
  layoutAnalysis: AtsLayoutAnalysis
): AtsResponsivenessAnalysis => {
  const textHeavySections = [
    resume.summary,
    ...resume.experience.map(entry => entry.description),
    ...(resume.internships || []).map(entry => entry.description),
    ...resume.projects.map(project => project.description),
    ...resume.achievements,
  ].filter(Boolean);
  const longBlocks = textHeavySections.filter(block => tokenize(block).length > 45).length;
  const longLinks = [
    resume.personalDetails.linkedin,
    resume.personalDetails.github,
    resume.personalDetails.website,
    ...resume.projects.flatMap(project => [project.github, project.live]),
    ...resume.certifications.map(cert => cert.url),
  ].filter(Boolean).filter(value => String(value).length > 38).length;
  const mobilePenalty =
    longBlocks * 6 +
    longLinks * 4 +
    (templatePlan?.bodyLayout === 'sidebar' ? 20 : 0) +
    (pageFit.details.estimatedPages > 1.1 ? 10 : 0);
  const tabletPenalty =
    longBlocks * 3 +
    longLinks * 2 +
    (templatePlan?.bodyLayout === 'sidebar' ? 8 : 0) +
    (pageFit.details.overflowRisk === 'high' ? 8 : 0);
  const textOverflowRisk = longBlocks >= 3 || longLinks >= 4
    ? 'high'
    : longBlocks >= 1 || longLinks >= 2
      ? 'medium'
      : 'low';
  const columnCollapseRisk = layoutAnalysis.detectedColumns === 'multi'
    ? (templatePlan?.bodyLayout === 'sidebar' ? 'high' : 'medium')
    : 'low';
  const notes = unique([
    ...(longBlocks > 0 ? [`${longBlocks} dense text block(s) may wrap poorly on small screens.`] : []),
    ...(longLinks > 0 ? [`${longLinks} long link value(s) may overflow on mobile widths.`] : []),
    ...(templatePlan?.bodyLayout === 'sidebar'
      ? ['Sidebar layouts require careful collapse behavior on tablet and mobile widths.']
      : []),
  ]);
  const mobileScore = clamp(100 - mobilePenalty);
  const tabletScore = clamp(100 - tabletPenalty);
  return {
    score: clamp(mobileScore * 0.6 + tabletScore * 0.4),
    mobileScore,
    tabletScore,
    textOverflowRisk,
    columnCollapseRisk,
    notes,
  };
};

const expectedSectionOrderForTemplate = (templateId?: TemplateId) => {
  if (!templateId) return [...DEFAULT_SECTION_ORDER];
  return [...(TEMPLATE_SECTION_PRIORITIES[templateId] || DEFAULT_SECTION_ORDER)];
};

const buildDiagnosticCategories = (
  categories: Array<{
    id: AtsDiagnosticCategoryScore['id'];
    label: string;
    score: number;
    explanation: string;
  }>,
  issues: AtsDiagnosticIssue[]
): AtsDiagnosticCategoryScore[] =>
  categories.map(category => ({
    ...category,
    score: clamp(category.score),
    issues: issues.filter(issue => {
      switch (category.id) {
        case 'contentQuality':
          return ['content', 'spelling'].includes(issue.category);
        case 'sectionCompleteness':
        case 'sectionOrder':
        case 'hrRiskFlags':
          return issue.category === 'structure';
        case 'atsFormatting':
        case 'layoutStructure':
          return ['layout', 'atsRules'].includes(issue.category);
        case 'keywordsMatch':
        case 'tailoringScore':
        case 'seniorityFit':
          return issue.category === 'content' || issue.category === 'atsRules';
        case 'responsivenessScore':
          return issue.category === 'responsiveness';
        default:
          return false;
      }
    }).map(issue => issue.id),
  }));

export function analyzeAtsLocally(
  resume: ProfileData,
  jobDescription: string,
  rawText = '',
  options: {
    sourceKind?: AtsSourceKind;
    templateId?: TemplateId;
    hiddenSections?: string[];
    languageQuality?: ResumeData['languageQuality'];
    sectionOrder?: string[];
  } = {}
): LocalAtsResult {
  const sourceKind = options.sourceKind || 'structured';
  const sections = resumeSections(resume, rawText);
  const hasJobDescription = Boolean(jobDescription.trim());
  const roleFamily = hasJobDescription ? detectRoleFamily(jobDescription) : 'general-other';
  const sectionFeedback: string[] = [];
  const sourceText = rawText || Object.values(sections).join('\n');
  const weightedKeywords = buildWeightedKeywords(jobDescription, sections, roleFamily);
  const formatting = analyzeFormatting(resume, sourceText, sectionFeedback, sourceKind);
  const contact = analyzeContact(resume);
  const links = analyzeLinks(resume, sourceText);
  const keywords = hasJobDescription
    ? analyzeKeywords(weightedKeywords, sections)
    : analyzeGeneralKeywords(resume, sections);
  const generalSkills = analyzeSkills(resume, '', sections);
  const targetSkills = hasJobDescription
    ? analyzeSkills(resume, jobDescription, sections)
    : generalSkills;
  const roleMatch = analyzeRoleMatch(jobDescription, sections, weightedKeywords, roleFamily);
  const experience = analyzeExperience(resume, '');
  const projects = analyzeProjects(resume.projects);
  const targetExperienceEvidence = hasJobDescription
    ? scoreKeywordEvidenceInSections(weightedKeywords, ['experience', 'internships'])
    : experience.score;
  const targetProjectEvidence = hasJobDescription
    ? scoreKeywordEvidenceInSections(weightedKeywords, ['projects'])
    : projects.score;
  const education = analyzeEducation(resume.education, jobDescription);
  const readability = analyzeReadability(resume);
  const completeness = analyzeCompleteness(resume);
  const evidenceStrength = analyzeEvidenceStrength(resume, sections, experience, projects);
  const pageFit = estimatePageFit(resume);
  const languageQuality = options.languageQuality;
  const templatePlan = options.templateId ? resumeTemplatePlans[options.templateId] : null;
  const templateRule = templatePlan ? resumeFamilyRules[templatePlan.family] : null;
  const skillsVisible = !options.hiddenSections?.includes('skills');
  const skillPlacement = templatePlan?.bodyLayout === 'sidebar' ? 'sidebar' : 'main';

  if (experience.metrics === 0) sectionFeedback.push('Experience lacks quantified achievements.');
  if (experience.verbs.length < 3) sectionFeedback.push('Experience uses few strong action verbs.');
  if (resume.projects.length && projects.detailed < resume.projects.length) {
    sectionFeedback.push('Some projects need clearer problem, implementation, and outcome details.');
  }
  if (readability.longParagraphs > 0) sectionFeedback.push('Long paragraphs reduce scanability.');

  const breakdown = {
    parsing: clamp(formatting.score * 0.85 + links.score * 0.15),
    contact: contact.score,
    completeness: completeness.score,
    skills: skillsVisible ? generalSkills.score : 0,
    experience: experience.score,
    projects: projects.score,
    readability: clamp(languageQuality ? readability.score * 0.65 + languageQuality.score * 0.35 : readability.score),
  };
  // General ATS readiness weights: 20/10/15/15/15/10/15. Page fit and JD data are excluded.
  const atsScore = clamp(
    breakdown.parsing * 0.20 +
    breakdown.contact * 0.10 +
    breakdown.completeness * 0.15 +
    breakdown.skills * 0.15 +
    breakdown.experience * 0.15 +
    breakdown.projects * 0.10 +
    breakdown.readability * 0.15
  );
  const educationWeight = roleMatch.educationRequired ? 5 : 0;
  const hardSkillWeight = roleMatch.hardSkillCount > 0 ? 35 : 0;
  const roleWeight = roleMatch.hardSkillCount > 0
    ? 25 + (roleMatch.educationRequired ? 0 : 5)
    : 35 + (roleMatch.educationRequired ? 0 : 10);
  const keywordWeight = roleMatch.hardSkillCount > 0 ? 15 : 25;
  const experienceWeight = roleMatch.hardSkillCount > 0 ? 10 : 15;
  const projectWeight = roleMatch.hardSkillCount > 0 ? 8 : 10;
  const softSkillWeight = roleMatch.hardSkillCount > 0 ? 2 : 5;
  const totalTargetWeight =
    hardSkillWeight +
    roleWeight +
    keywordWeight +
    experienceWeight +
    projectWeight +
    educationWeight +
    softSkillWeight;
  // Target matching uses role-specific evidence; general ATS readiness remains independent.
  const matchScore = hasJobDescription
    ? clamp(
        (
          roleMatch.hardSkillScore * hardSkillWeight +
          roleMatch.roleScore * roleWeight +
          keywords.score * keywordWeight +
          targetExperienceEvidence * experienceWeight +
          targetProjectEvidence * projectWeight +
          education * educationWeight +
          roleMatch.softSkillScore * softSkillWeight
        ) / Math.max(1, totalTargetWeight) -
        roleMatch.familyMismatchPenalty
      )
    : null;
  const missingKeywords = hasJobDescription
    ? keywords.weightedKeywords.filter(item => !item.matched).map(item => item.keyword.toUpperCase())
    : [];
  const weakCoverage = hasJobDescription
    ? keywords.weightedKeywords
        .filter(item => item.evidenceStrength === 'weak')
        .map(item => item.keyword.toUpperCase())
    : [];
  const strongCoverage = hasJobDescription
    ? keywords.weightedKeywords
        .filter(item => item.evidenceStrength === 'strong')
        .map(item => item.keyword.toUpperCase())
    : [];
  const projectMetricCount = resume.projects.reduce((sum, project) => (
    sum + (project.description.match(
      /(?:\d+(?:\.\d+)?%|\d+\+|\$[\d,.]+|\d+(?:\.\d+)?x\b|\d+\s*(?:users|clients|hours|days|teams|projects|million|billion|k)\b)/gi
    ) || []).length
  ), 0);
  const warnings = unique([
    ...formatting.feedback,
    ...contact.feedback,
    ...links.feedback,
    ...(!skillsVisible ? ['The skills section is hidden in the selected template.'] : []),
    ...(sourceKind === 'image-ocr'
      ? ['OCR-derived text may omit or reorder content; verify extracted sections.']
      : []),
    ...(pageFit.details.overflowRisk === 'high'
      ? ['Content density indicates that a multi-page resume is likely.']
      : pageFit.details.overflowRisk === 'medium'
        ? ['Content is near the one-page limit and may expand with longer fields.']
        : []),
    ...(hasJobDescription && roleMatch.familyMismatchPenalty > 0
      ? [`The resume shows limited supported ${roleFamilyLabel(roleFamily)} evidence relative to the target role.`]
      : []),
    ...(hasJobDescription && keywords.stuffingPenalty > 0
      ? ['Repeated target terms without strong section evidence were discounted as possible keyword stuffing.']
      : []),
    ...(languageQuality?.summary.total
      ? [`Language review found ${languageQuality.summary.total} live issue(s), including ${languageQuality.summary.spelling} spelling and ${languageQuality.summary.grammar} grammar concerns.`]
      : []),
  ]);
  const strongestTargetEvidence = roleMatch.strongEvidence[0]?.split(' in ')[0] || '';
  const highestPriorityGap = missingKeywords[0] || '';
  const recommendations = unique([
    ...completeness.deductions.map(item => item.replace(/\s*\(-\d+\)\.?$/, '.')),
    ...sectionFeedback.filter(item => item !== 'Document structure is ATS-readable.'),
    ...(hasJobDescription && (strongestTargetEvidence || highestPriorityGap)
      ? [
          `Your resume contains ${strongestTargetEvidence || 'some target evidence'}. ${
            highestPriorityGap
              ? `Add ${highestPriorityGap} only if it is accurate and supported by real work.`
              : 'Keep the strongest evidence in experience or project descriptions.'
          }`,
        ]
      : []),
    ...(hasJobDescription && targetSkills.missing.length
      ? ['Add only missing skills that are genuinely supported by your experience or projects.']
      : []),
    ...(languageQuality?.summary.total
      ? ['Resolve spelling, grammar, and clarity suggestions before exporting to improve ATS readability and recruiter trust.']
      : []),
  ]).slice(0, 8);
  const missingItems = completeness.deductions.map(item => item.replace(/\s*\(-\d+\)\.?$/, '.'));
  const strengths = unique([
    ...(formatting.score >= 80 ? ['Resume structure is readable by standard ATS parsers.'] : []),
    ...(contact.score >= 85 ? ['Core contact information is visible and valid.'] : []),
    ...(generalSkills.score >= 70 ? ['Skills are supported across multiple categories or evidence sections.'] : []),
    ...(experience.score >= 70 ? ['Experience uses measurable impact and strong action language.'] : []),
    ...(projects.score >= 70 ? ['Projects include useful technical detail and outcome evidence.'] : []),
    ...(languageQuality && languageQuality.score >= 92 ? ['Language quality is clean and ATS-ready across the current resume content.'] : []),
    ...strongCoverage.slice(0, 4).map(keyword => `${keyword} has strong target-role evidence.`),
  ]).slice(0, 6);
  const positionalKeywords = hasJobDescription
    ? keywords.weightedKeywords
        .filter(item => item.matched && item.placements.length > 0)
        .map(item => `${item.keyword.toUpperCase()} · ${item.placements.join(', ')}`)
    : [];
  const analysisModules: LocalAtsResult['analysisModules'] = [
    {
      id: 'content',
      label: 'Content extraction',
      score: formatting.score,
      status: formatting.score >= 70 ? 'passed' : 'review',
      evidence: `${sourceKind === 'structured' ? 'Structured resume data' : sourceKind} normalized into stable section text.`,
    },
    {
      id: 'structure',
      label: 'Structure validation',
      score: clamp((contact.score + completeness.score + links.score) / 3),
      status: contact.score >= 70 && completeness.score >= 65 ? 'passed' : 'review',
      evidence: `${completeness.score}% section completeness, ${contact.score}% contact visibility, and ${links.score}% link coverage.`,
    },
    {
      id: 'evidence',
      label: 'Evidence analysis',
      score: evidenceStrength,
      status: evidenceStrength >= 65 ? 'passed' : 'review',
      evidence: `${experience.verbs.length} action verbs, ${experience.metrics} quantified outcomes, and ${projects.detailed}/${resume.projects.length} detailed projects.`,
    },
    {
      id: 'roleMatch',
      label: hasJobDescription ? 'Role matching' : 'Skills indexing',
      score: hasJobDescription ? roleMatch.roleScore : generalSkills.score,
      status: (hasJobDescription ? roleMatch.roleScore : generalSkills.score) >= 65 ? 'passed' : 'review',
      evidence: hasJobDescription
        ? `${roleFamilyLabel(roleFamily)} evidence weighted by experience, projects, skills, summary, and other sections.`
        : `${flattenSkills(resume.skills).length} normalized skills indexed across ${Object.values(resume.skills).filter(values => values.length > 0).length} categories.`,
    },
    {
      id: 'pageFit',
      label: 'Page-fit analysis',
      score: pageFit.score,
      status: pageFit.details.overflowRisk === 'high' ? 'review' : 'passed',
      evidence: `${pageFit.details.estimatedPages} estimated pages with ${pageFit.details.overflowRisk} overflow risk.`,
    },
    {
      id: 'synthesis',
      label: 'Final synthesis',
      score: hasJobDescription ? matchScore || 0 : atsScore,
      status: (hasJobDescription ? matchScore || 0 : atsScore) >= 65 ? 'passed' : 'review',
      evidence: hasJobDescription
        ? 'Role, hard-skill, section, education, and stuffing evidence consolidated without changing the general ATS score.'
        : 'Structural, skills, experience, project, and readability evidence consolidated.',
    },
  ];

  const languageAnalysis: AtsLanguageAnalysis = {
    spellingAccuracy: clamp(
      languageQuality
        ? 100 - languageQuality.summary.spelling * 12 - languageQuality.summary.highSeverity * 4
        : breakdown.readability
    ),
    grammarCorrectness: clamp(
      languageQuality
        ? 100 - languageQuality.summary.grammar * 10 - readability.grammarIssues * 4
        : breakdown.readability
    ),
    readability: clamp(readability.score),
    clarity: clamp(100 - readability.longParagraphs * 12 - readability.repeatedPhrases * 10 - readability.buzzwordCount * 5),
  };

  const layoutAnalysis: AtsLayoutAnalysis = {
    estimatedLineDensity: pageFit.lineDensity,
    sectionSizeWeight: pageFit.sectionWeight,
    templateScalingFactor: Number(
      (templatePlan?.density === 'dense' ? 0.92 : templatePlan?.density === 'compact' ? 1 : 1.08).toFixed(2)
    ),
    expectedColumns: templateRule?.singleColumn ? 'single' : 'flexible',
    detectedColumns: templatePlan?.bodyLayout === 'sidebar' ? 'multi' : 'single',
  };
  const responsivenessAnalysis = analyzeResponsiveness(resume, pageFit, templatePlan, layoutAnalysis);

  const diagnosticIssues: AtsDiagnosticIssue[] = [];
  const pushIssue = (issue: AtsDiagnosticIssue | null) => {
    if (!issue) return;
    if (!diagnosticIssues.some(existing => existing.id === issue.id)) diagnosticIssues.push(issue);
  };

  if (!resume.personalDetails.fullName.trim() || !validEmail(resume.personalDetails.email) || !validPhone(resume.personalDetails.phone)) {
    pushIssue(createDiagnosticIssue({
      title: 'Missing or invalid contact information',
      severity: 'high',
      category: 'structure',
      affectedSection: 'Header',
      explanation: 'Essential contact fields are incomplete or invalid, which can block recruiter follow-up and ATS parsing confidence.',
      suggestedFix: 'Provide a valid full name, professional email, and phone number in the header.',
      location: 'personalDetails',
      impact: 14,
    }));
  }

  if (!(resume.summary || resume.careerObjective).trim()) {
    pushIssue(createDiagnosticIssue({
      title: 'Professional summary is missing',
      severity: 'medium',
      category: 'structure',
      affectedSection: 'Summary',
      explanation: 'A missing professional summary or career objective weakens section completeness and removes quick context for recruiters.',
      suggestedFix: 'Add a concise summary or career objective focused on role fit, core skills, and measurable value.',
      location: 'summary/careerObjective',
      impact: 5,
    }));
  }

  if (!flattenSkills(resume.skills).length) {
    pushIssue(createDiagnosticIssue({
      title: 'Skills section is missing or empty',
      severity: 'high',
      category: 'structure',
      affectedSection: 'Skills',
      explanation: 'ATS tools depend on explicit skills indexing. An empty skills section lowers match quality and completeness.',
      suggestedFix: 'Add role-relevant skills grouped under the skills section using genuine experience-backed terms.',
      location: 'skills',
      impact: 20,
    }));
  }

  if (!resume.experience.length && !(resume.internships || []).length && !resume.projects.some(project => hasRoleLikeProjectEvidence(project))) {
    pushIssue(createDiagnosticIssue({
      title: 'Experience evidence is missing',
      severity: 'high',
      category: 'structure',
      affectedSection: 'Experience',
      explanation: 'No experience or internship entries were found, which strongly reduces ATS confidence and seniority assessment.',
      suggestedFix: 'Add work experience, internships, or equivalent role-based evidence with measurable outcomes.',
      location: 'experience',
      impact: 25,
    }));
  }

  const providedOrder = (options.sectionOrder || []).filter(Boolean);
  if (options.templateId && providedOrder.length > 0) {
    const expectedOrder = expectedSectionOrderForTemplate(options.templateId).filter(sectionId => (
      ['summary', 'skills', 'experience', 'projects', 'education', 'certifications'].includes(sectionId)
    ));
    const actualOrder = providedOrder.filter(sectionId => expectedOrder.includes(sectionId));
    const mismatches = actualOrder.reduce((count, sectionId, index) => (
      expectedOrder[index] && expectedOrder[index] !== sectionId ? count + 1 : count
    ), 0);
    if (mismatches > 0) {
      pushIssue(createDiagnosticIssue({
        title: 'Section order does not match the recommended ATS flow',
        severity: mismatches >= 2 ? 'high' : 'medium',
        category: 'structure',
        affectedSection: 'Section Order',
        explanation: `The current order (${actualOrder.join(' -> ')}) deviates from the template-aware ATS recommendation (${expectedOrder.join(' -> ')}).`,
        suggestedFix: 'Move summary, skills, experience, projects, and education into the recommended order for this template.',
        location: 'sectionOrder',
        impact: mismatches >= 2 ? 10 : 6,
      }));
    }
  }

  if (templateRule?.singleColumn && layoutAnalysis.detectedColumns === 'multi') {
    pushIssue(createDiagnosticIssue({
      title: 'Multi-column layout conflicts with ATS-safe structure',
      severity: options.templateId === 'atsFriendly' ? 'high' : 'medium',
      category: 'layout',
      affectedSection: 'Layout',
      explanation: 'This template configuration is expected to remain single-column for maximum ATS extraction reliability.',
      suggestedFix: 'Use a single-column ATS-safe template or switch to a layout with linear reading order.',
      location: 'template.layout',
      impact: options.templateId === 'atsFriendly' ? 12 : 7,
    }));
  }

  if (options.templateId === 'softwareEngineer' && flattenSkills(resume.skills).length > 18) {
    pushIssue(createDiagnosticIssue({
      title: 'Skills layout structure issue',
      severity: 'medium',
      category: 'layout',
      affectedSection: 'Skills',
      explanation: 'The software developer template can become visually fragmented when too many skills are packed into grouped columns.',
      suggestedFix: 'Reduce redundant skills or rebalance them into clear grouped rows so the section remains scanable and ATS-safe.',
      location: 'skills',
      impact: 6,
    }));
  }

  if (!skillsVisible) {
    pushIssue(createDiagnosticIssue({
      title: 'Skills section is hidden',
      severity: 'high',
      category: 'atsRules',
      affectedSection: 'Skills',
      explanation: 'Hiding the skills section removes explicit keyword evidence from the rendered resume.',
      suggestedFix: 'Make the skills section visible before exporting or scanning against a job description.',
      location: 'hiddenSections.skills',
      impact: 12,
    }));
  }

  if (pageFit.details.overflowRisk !== 'low') {
    pushIssue(createDiagnosticIssue({
      title: 'Page overflow risk detected',
      severity: pageFit.details.overflowRisk === 'high' ? 'high' : 'medium',
      category: 'layout',
      affectedSection: 'Layout',
      explanation: `Estimated page count is ${pageFit.details.estimatedPages}, which indicates ${pageFit.details.fitCategory}.`,
      suggestedFix: 'Shorten dense sections, reduce repetitive bullets, or switch to a multi-page strategy when appropriate.',
      location: 'pageFit',
      impact: pageFit.details.overflowRisk === 'high' ? 10 : 5,
    }));
  }

  if (responsivenessAnalysis.textOverflowRisk !== 'low') {
    pushIssue(createDiagnosticIssue({
      title: 'Small-screen text overflow risk detected',
      severity: responsivenessAnalysis.textOverflowRisk === 'high' ? 'high' : 'medium',
      category: 'responsiveness',
      affectedSection: 'Responsive Layout',
      explanation: 'Long text blocks or long links may wrap poorly on mobile or narrow tablet layouts.',
      suggestedFix: 'Shorten dense paragraphs, trim visible URLs when raw mode is enabled, or split long content into tighter bullets.',
      location: 'responsive.text',
      impact: responsivenessAnalysis.textOverflowRisk === 'high' ? 8 : 4,
    }));
  }

  if (responsivenessAnalysis.columnCollapseRisk !== 'low') {
    pushIssue(createDiagnosticIssue({
      title: 'Column collapse behavior needs review',
      severity: responsivenessAnalysis.columnCollapseRisk === 'high' ? 'high' : 'medium',
      category: 'responsiveness',
      affectedSection: 'Responsive Layout',
      explanation: 'The current template layout may require aggressive stacking or collapse logic on tablet and mobile screens.',
      suggestedFix: 'Prefer single-column ATS-safe layouts or verify that sidebar content stacks cleanly below the main column.',
      location: 'responsive.columns',
      impact: responsivenessAnalysis.columnCollapseRisk === 'high' ? 7 : 3,
    }));
  }

  if (languageQuality) {
    languageQuality.issues.forEach(issue => {
      pushIssue(createDiagnosticIssue({
        title: `${issueCategoryLabel(issue.category === 'duplicate' ? 'content' : issue.category === 'consistency' ? 'content' : issue.category as AtsIssueCategory)} issue`,
        severity: issue.severity,
        category: issue.category === 'spelling'
          ? 'spelling'
          : issue.category === 'grammar' || issue.category === 'clarity' || issue.category === 'duplicate' || issue.category === 'consistency'
            ? 'content'
            : 'content',
        affectedSection: issue.sectionKey,
        explanation: issue.message,
        suggestedFix: issue.suggestions[0]?.label || 'Review the flagged text and apply a clearer, corrected version.',
        location: issue.path,
        impact: issue.severity === 'high' ? 4 : issue.severity === 'medium' ? 2 : 1,
      }));
    });
  }

  if (hasJobDescription && missingKeywords.length > 0) {
    pushIssue(createDiagnosticIssue({
      title: 'Important target keywords are missing',
      severity: missingKeywords.length >= 5 ? 'high' : 'medium',
      category: 'content',
      affectedSection: 'Keywords',
      explanation: `The resume is missing supported evidence for terms such as ${missingKeywords.slice(0, 5).join(', ')}.`,
      suggestedFix: 'Add only truthful, experience-backed keywords in summary, skills, experience, or projects.',
      location: 'keywords',
      impact: Math.min(14, missingKeywords.length * 2),
    }));
  }

  if (experience.years > 0 && hasJobDescription) {
    const jdSeniorityExpectation = /\b(?:senior|lead|principal|staff|manager|8\+ years|10\+ years)\b/i.test(jobDescription)
      ? 8
      : /\b(?:mid[-\s]?level|3\+ years|4\+ years|5\+ years)\b/i.test(jobDescription)
        ? 4
        : 1;
    if (experience.years + 1 < jdSeniorityExpectation) {
      pushIssue(createDiagnosticIssue({
        title: 'Seniority fit appears below target level',
        severity: jdSeniorityExpectation >= 8 ? 'high' : 'medium',
        category: 'content',
        affectedSection: 'Experience',
        explanation: `Experience evidence suggests about ${experience.years} years, while the target role appears to expect around ${jdSeniorityExpectation}+ years.`,
        suggestedFix: 'Strengthen recent senior-level scope, leadership evidence, or target a role aligned with the current experience level.',
        location: 'experience',
        impact: jdSeniorityExpectation >= 8 ? 10 : 6,
      }));
    }
  }

  const contentQualityScore = clamp(
    languageAnalysis.spellingAccuracy * 0.25 +
    languageAnalysis.grammarCorrectness * 0.25 +
    languageAnalysis.readability * 0.25 +
    languageAnalysis.clarity * 0.25
  );
  const sectionOrderScore = clamp(100 - diagnosticIssues
    .filter(issue => issue.affectedSection === 'Section Order')
    .reduce((sum, issue) => sum + issue.impact, 0));
  const formattingScore = clamp(formatting.score * 0.7 + breakdown.contact * 0.1 + links.score * 0.2);
  const layoutStructureScore = clamp(pageFit.score * 0.55 + (layoutAnalysis.detectedColumns === 'single' ? 100 : 70) * 0.2 + (templateRule?.singleColumn ? 100 : 85) * 0.25);
  const hrRiskScore = clamp(100 - diagnosticIssues
    .filter(issue => issue.severity === 'high')
    .reduce((sum, issue) => sum + issue.impact, 0));
  const seniorityFitScore = hasJobDescription
    ? clamp(experience.score * 0.5 + (matchScore || 0) * 0.25 + roleMatch.roleScore * 0.25)
    : clamp(experience.score * 0.7 + breakdown.completeness * 0.3);
  const tailoringScore = hasJobDescription
    ? clamp((matchScore || 0) * 0.5 + keywords.score * 0.3 + targetSkills.relevance * 0.2)
    : clamp(generalSkills.score * 0.6 + experience.score * 0.4);

  const diagnosticCategories = buildDiagnosticCategories([
    {
      id: 'contentQuality',
      label: 'Content Quality',
      score: contentQualityScore,
      explanation: 'Language quality combines spelling accuracy, grammar correctness, readability, and clarity.',
    },
    {
      id: 'sectionCompleteness',
      label: 'Section Completeness',
      score: breakdown.completeness,
      explanation: 'Checks whether essential resume sections and contact details are present and populated.',
    },
    {
      id: 'sectionOrder',
      label: 'Section Order',
      score: sectionOrderScore,
      explanation: 'Compares the current order against a template-aware ATS recommendation.',
    },
    {
      id: 'atsFormatting',
      label: 'ATS Formatting',
      score: formattingScore,
      explanation: 'Evaluates text extraction safety, heading consistency, icons, tables, and link presence.',
    },
    {
      id: 'keywordsMatch',
      label: 'Keywords Match',
      score: hasJobDescription ? keywords.score : generalSkills.score,
      explanation: hasJobDescription
        ? 'Measures supported overlap between resume evidence and job-description terminology.'
        : 'Measures how well explicit skills are represented and reinforced in the resume.',
    },
    {
      id: 'layoutStructure',
      label: 'Layout Structure',
      score: layoutStructureScore,
      explanation: 'Evaluates page density, overflow risk, and whether the template layout remains ATS-safe.',
    },
    {
      id: 'hrRiskFlags',
      label: 'HR Risk Flags',
      score: hrRiskScore,
      explanation: 'Flags issues likely to reduce recruiter confidence, such as missing contact data or major language errors.',
    },
    {
      id: 'seniorityFit',
      label: 'Seniority Fit',
      score: seniorityFitScore,
      explanation: 'Compares the depth of experience evidence against the expected level of the target role.',
    },
    {
      id: 'tailoringScore',
      label: 'Tailoring Score',
      score: tailoringScore,
      explanation: 'Measures how specifically the resume is aligned to the target role or to a coherent resume narrative.',
    },
    {
      id: 'responsivenessScore',
      label: 'Responsiveness Score',
      score: responsivenessAnalysis.score,
      explanation: 'Evaluates mobile and tablet adaptability, including wrapping risk, column collapse behavior, and small-screen readability.',
    },
  ], diagnosticIssues);

  return {
    atsScore,
    matchScore,
    breakdown,
    pageFitDetails: {
      score: pageFit.score,
      ...pageFit.details,
    },
    keywordGaps: {
      missing: unique(missingKeywords),
      weakCoverage: unique(weakCoverage),
      strongCoverage: unique(strongCoverage),
    },
    skillAnalysis: {
      coveragePercent: hasJobDescription
        ? roleMatch.hardSkillCount > 0
          ? roleMatch.hardSkillScore
          : roleMatch.roleScore
        : generalSkills.score,
      diversityScore: generalSkills.diversity,
      visible: skillsVisible,
      placement: skillPlacement,
      templateFamily: templatePlan?.family || 'unknown',
    },
    projectAnalysis: {
      hasLinks: projects.withLinks,
      hasMetrics: projectMetricCount,
      qualityScore: projects.score,
    },
    targetComparison: hasJobDescription ? {
      keywordOverlap: keywords.score,
      roleFamily,
      roleFamilyLabel: roleFamilyLabel(roleFamily),
      roleRelevance: roleMatch.roleScore,
      skillAlignment: roleMatch.hardSkillCount > 0
        ? roleMatch.hardSkillScore
        : roleMatch.roleScore,
      projectEvidence: targetProjectEvidence,
      experienceEvidence: targetExperienceEvidence,
      missingCriticalSkills: unique([
        ...targetSkills.missing,
        ...weightedKeywords
          .filter(item => item.weight >= 8 && !item.matched)
          .map(item => item.keyword),
      ].map(value => value.toUpperCase())),
      positionalKeywords: unique(positionalKeywords),
      strongEvidence: roleMatch.strongEvidence.slice(0, 12),
      weakEvidence: roleMatch.weakEvidence.slice(0, 12),
    } : null,
    analysisModules,
    strengths,
    missingItems,
    warnings,
    recommendations,
    diagnosticCategories,
    diagnosticIssues,
    languageAnalysis,
    layoutAnalysis,
    responsivenessAnalysis,
  };
}
