import { NormalizedResume, normalizeResumeModel } from '../schema/resumeSchema';
import {
  AtsIssue,
  AtsIssueGroupV2,
  AtsIssueSeverityV2,
  AtsResult,
  AtsSuggestion,
  AtsStageId,
  AtsStageResult,
  LinkDisplayMode,
  TemplateId,
  ResumeData,
  UserSettings,
} from '../types';
import { canonicalizeSectionId, getRecommendedSectionOrder, getSectionOrder, isSectionPresent } from './sectionEngine';
import { resolveLinkDisplayMode, safePdfUrl } from './linkDisplay';
import { createAiProvider, AI_ATS_FALLBACK_MESSAGE, hasAiProviderConfigured } from '../services/aiProvider';
import {
  buildInterviewAnswerFeedbackPrompt,
  buildXyzRewritePrompt,
} from './atsAiPrompts';
import {
  AtsIntelligencePayload,
  AtsInterviewAnswerFeedbackPayload,
  AtsXyzRewritePayload,
  interviewAnswerFeedbackSchema,
  xyzRewriteSchema,
} from './atsAiValidators';
import { createSuggestionFromAtsFinding } from './atsSuggestionEngine';
import { runAiJobMatch } from '../ats/ai-job-match';

export interface AtsParserCoordinate {
  page?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  sectionId?: string;
}

export interface AtsRenderMetrics {
  estimatedPages?: number;
  headerOverflowRisk?: 'low' | 'medium' | 'high';
  mobileRisk?: 'low' | 'medium' | 'high';
  tabletRisk?: 'low' | 'medium' | 'high';
  textOverflowRisk?: 'low' | 'medium' | 'high';
  skillsSideBySide?: boolean;
  experienceSideBySide?: boolean;
  projectTechOverlapRisk?: 'low' | 'medium' | 'high';
  certificationLinkOverlapRisk?: 'low' | 'medium' | 'high';
}

export interface AtsStructuralScanInput {
  resume: NormalizedResume | ReturnType<typeof normalizeResumeModel>;
  templateId?: TemplateId | string;
  sectionSettings?: NormalizedResume['sectionSettings'];
  linkSettings?: NormalizedResume['linkSettings'];
  parserCoordinates?: AtsParserCoordinate[];
  renderMetrics?: AtsRenderMetrics;
  settings?: UserSettings | null;
  jobDescription?: string;
}

const DISCLAIMER =
  'AI-powered ATS analysis provides guidance and recommendations based on industry best practices. Results may differ from external ATS platforms, recruiters, or employer-specific screening systems. AI analysis can occasionally make mistakes and should be used as a decision-support tool rather than a guaranteed assessment.';

const STAGE_IDS: AtsStageId[] = ['structureCheck', 'jobMatch', 'contentUpgrade', 'applyToBuilder'];

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(value)));

const unique = (values: string[]) => [...new Set(values.filter(Boolean))];

const issue = (input: {
  title: string;
  severity: AtsIssueSeverityV2;
  group: AtsIssueGroupV2;
  category: string;
  affectedSection: string;
  explanation: string;
  suggestedFix: string;
  scoreImpact: number;
  evidence?: string;
}): AtsIssue => ({
  id: `${input.group}-${input.category}-${input.affectedSection}-${input.title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, ''),
  ...input,
});

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/;

const isValidUrl = (value: string) => {
  const normalized = safePdfUrl(value);
  if (!normalized) return false;
  try {
    // eslint-disable-next-line no-new
    new URL(normalized);
    return true;
  } catch {
    return false;
  }
};

const collectLinkCandidates = (resume: NormalizedResume) => {
  const resumeSectionLinks: Array<{ sectionId: string; value: string }> = [];
  const globalLinks: Array<{ sectionId: string; value: string }> = [
    { sectionId: 'header', value: resume.linkedIn },
    { sectionId: 'header', value: resume.github },
    { sectionId: 'header', value: resume.portfolio },
    ...resume.otherLinks.map(value => ({ sectionId: 'header', value })),
  ];

  resume.projects.forEach(project => {
    if (project.links.github) resumeSectionLinks.push({ sectionId: 'projects', value: project.links.github });
    if (project.links.demo) resumeSectionLinks.push({ sectionId: 'projects', value: project.links.demo });
  });

  resume.certifications.forEach(certification => {
    if (certification.credentialUrl) resumeSectionLinks.push({ sectionId: 'certifications', value: certification.credentialUrl });
  });

  return [...globalLinks, ...resumeSectionLinks].filter(link => link.value.trim());
};

const countSkillBuckets = (resume: NormalizedResume) =>
  Object.values(resume.skills).map(values => values.length);

const estimatePages = (resume: NormalizedResume, metrics?: AtsRenderMetrics, coords?: AtsParserCoordinate[]) => {
  if (typeof metrics?.estimatedPages === 'number' && Number.isFinite(metrics.estimatedPages)) {
    return metrics.estimatedPages;
  }
  const maxPage = coords?.reduce((max, coord) => Math.max(max, Number(coord.page || 0)), 0) || 0;
  if (maxPage > 0) return maxPage;

  const textMass =
    resume.summary.length +
    resume.experience.reduce((sum, entry) => sum + entry.bullets.join(' ').length + entry.role.length + entry.company.length, 0) +
    resume.education.reduce((sum, entry) => sum + entry.description.length + entry.degree.length + entry.institution.length, 0) +
    resume.projects.reduce((sum, entry) => sum + entry.description.length + entry.title.length, 0);

  if (textMass < 900) return 1;
  if (textMass < 1800) return 1.2;
  if (textMass < 3000) return 1.6;
  return 2.1;
};

const detectOrderIssue = (resume: NormalizedResume, templateId: TemplateId | string) => {
  const orderSource = {
    sectionOrder: resume.sectionSettings.sectionOrder,
    sectionOrderMode: resume.sectionSettings.sectionOrderMode,
    customSections: resume.customSections.map(section => ({ id: section.id })),
    templateId: resume.templateId,
  };
  const recommended = getRecommendedSectionOrder(templateId as TemplateId, orderSource).map(canonicalizeSectionId);
  const actual = getSectionOrder(orderSource).map(canonicalizeSectionId);
  const relevant = ['summary', 'experience', 'education', 'skills'].filter(sectionId => isSectionPresent(resume, sectionId));
  const actualPositions = relevant.map(sectionId => actual.indexOf(sectionId));
  const recommendedPositions = relevant.map(sectionId => recommended.indexOf(sectionId));
  const monotonic = actualPositions.every((position, index, array) => index === 0 || position >= array[index - 1]);
  if (monotonic) return null;

  return issue({
    title: 'Section order may reduce ATS readability',
    severity: 'Medium',
    group: 'Structure',
    category: 'section-order',
    affectedSection: 'Sections',
    explanation: `Core sections are present but the order differs from the recommended ATS order for this template.`,
    suggestedFix: 'Place Summary, Experience, Education, and Skills in a clearer top-to-bottom order.',
    scoreImpact: 4,
    evidence: `Actual order: ${actual.join(' > ') || 'unavailable'}; recommended order: ${recommendedPositions.length ? recommended.join(' > ') : 'unavailable'}.`,
  });
};

const detectMultiColumnRisk = (coords?: AtsParserCoordinate[]) => {
  if (!coords?.length) return null;
  const byPage = new Map<number, AtsParserCoordinate[]>();
  coords.forEach(coord => {
    const page = Number(coord.page || 0);
    if (!page) return;
    const list = byPage.get(page) || [];
    list.push(coord);
    byPage.set(page, list);
  });

  for (const [page, pageCoords] of byPage.entries()) {
    const xs = unique(pageCoords
      .map(coord => Math.round((coord.x || 0) / 40) * 40)
      .filter(value => Number.isFinite(value) && value > 0)
      .map(value => String(value)));
    if (xs.length >= 2) {
      const xValues = xs.map(value => Number(value)).sort((a, b) => a - b);
      if (xValues[xValues.length - 1] - xValues[0] >= 140) {
        return issue({
          title: 'Possible multi-column layout detected',
          severity: 'Medium',
          group: 'Layout',
          category: 'multi-column-risk',
          affectedSection: 'Layout',
          explanation: `Parser coordinates on page ${page} appear in multiple horizontal clusters, which can confuse ATS reading order.`,
          suggestedFix: 'Prefer a single-column or clearly ordered layout for ATS-facing output.',
          scoreImpact: 8,
          evidence: `Page ${page} has horizontal clusters at approximately ${xValues.join(', ')}.`,
        });
      }
    }
  }

  return null;
};

const detectSideBySideRisk = (coords?: AtsParserCoordinate[], metrics?: AtsRenderMetrics) => {
  if (metrics?.skillsSideBySide || metrics?.experienceSideBySide) {
    return issue({
      title: 'Side-by-side content may affect reading order',
      severity: 'Medium',
      group: 'Layout',
      category: 'side-by-side-risk',
      affectedSection: metrics.skillsSideBySide ? 'Skills' : 'Experience',
      explanation: 'Render metrics indicate a side-by-side arrangement that may complicate ATS text flow.',
      suggestedFix: 'Use a single-column text flow for core ATS sections.',
      scoreImpact: 6,
      evidence: metrics.skillsSideBySide ? 'skillsSideBySide=true' : 'experienceSideBySide=true',
    });
  }

  if (!coords?.length) return null;
  const sections = new Map<string, AtsParserCoordinate[]>();
  coords.forEach(coord => {
    if (!coord.sectionId) return;
    const list = sections.get(coord.sectionId) || [];
    list.push(coord);
    sections.set(coord.sectionId, list);
  });

  const skills = sections.get('skills');
  const experience = sections.get('experience');
  if (!skills?.length || !experience?.length) return null;

  const skillsPages = new Set(skills.map(item => item.page).filter((page): page is number => typeof page === 'number'));
  const experiencePages = new Set(experience.map(item => item.page).filter((page): page is number => typeof page === 'number'));
  const sharedPages = [...skillsPages].filter(page => experiencePages.has(page));
  if (!sharedPages.length) return null;

  const skillsX = skills.map(item => item.x || 0).filter(Boolean);
  const experienceX = experience.map(item => item.x || 0).filter(Boolean);
  if (!skillsX.length || !experienceX.length) return null;
  const xGap = Math.abs(Math.min(...skillsX) - Math.min(...experienceX));
  if (xGap < 120) return null;

  return issue({
    title: 'Skills and experience may be side-by-side',
    severity: 'Medium',
    group: 'Layout',
    category: 'skills-experience-side-by-side',
    affectedSection: 'Skills',
    explanation: 'Skills and experience coordinates overlap across the same page and appear horizontally separated.',
    suggestedFix: 'Keep Skills and Experience in a single-column flow for ATS parsing reliability.',
    scoreImpact: 6,
    evidence: `Shared pages: ${sharedPages.join(', ')}; approximate horizontal gap: ${Math.round(xGap)}px.`,
  });
};

const detectHeaderOverflowRisk = (metrics?: AtsRenderMetrics, coords?: AtsParserCoordinate[]) => {
  if (metrics?.headerOverflowRisk && metrics.headerOverflowRisk !== 'low') {
    return issue({
      title: 'Header may be too dense',
      severity: metrics.headerOverflowRisk === 'high' ? 'High' : 'Medium',
      group: 'Layout',
      category: 'header-overflow',
      affectedSection: 'Header',
      explanation: 'Render metrics suggest the contact/header area may overflow or crowd the top of the page.',
      suggestedFix: 'Reduce header density or move less important links into the body.',
      scoreImpact: metrics.headerOverflowRisk === 'high' ? 7 : 4,
      evidence: `headerOverflowRisk=${metrics.headerOverflowRisk}`,
    });
  }

  if (!coords?.length) return null;
  const topBand = coords.filter(coord => typeof coord.y === 'number' && coord.y <= 120);
  if (topBand.length < 6) return null;
  const widthEstimate = topBand.reduce((sum, coord) => sum + (coord.width || 0), 0);
  if (widthEstimate < 600) return null;

  return issue({
    title: 'Header/contact block may be crowded',
    severity: 'Low',
    group: 'Layout',
    category: 'header-density',
    affectedSection: 'Header',
    explanation: 'The first text band contains many items, which can crowd the page header.',
    suggestedFix: 'Shorten link labels or reduce the number of visible contact items.',
    scoreImpact: 2,
    evidence: `Top-band items: ${topBand.length}; estimated width load: ${Math.round(widthEstimate)}.`,
  });
};

const detectMissingLinksAndOverflow = (resume: NormalizedResume, linkMode: Exclude<LinkDisplayMode, 'inherit'>) => {
  const issues: AtsIssue[] = [];
  const linkCandidates = collectLinkCandidates(resume);
  linkCandidates.forEach(({ sectionId, value }) => {
    const normalized = safePdfUrl(value);
    if (!normalized || /\s{2,}/.test(value) || /^(?:https?:\/\/)?\s*$/.test(value)) {
      issues.push(issue({
        title: 'A link appears malformed or empty',
        severity: 'Low',
        group: 'ATS Essentials',
        category: 'broken-link',
        affectedSection: sectionId,
        explanation: 'A stored link value does not resolve cleanly to a selectable URL.',
        suggestedFix: 'Verify the URL format or remove empty link fields.',
        scoreImpact: 2,
        evidence: value,
      }));
      return;
    }

    if (!isValidUrl(normalized)) {
      issues.push(issue({
        title: 'A link may not be parseable',
        severity: 'Low',
        group: 'ATS Essentials',
        category: 'unparseable-link',
        affectedSection: sectionId,
        explanation: 'The link resolves to text but may not be parseable as a URL by all readers.',
        suggestedFix: 'Store links using a standard URL format.',
        scoreImpact: 2,
        evidence: normalized,
      }));
    }

    if (linkMode === 'raw' && normalized.length > 80) {
      issues.push(issue({
        title: 'Raw URL may wrap or overflow',
        severity: 'Low',
        group: 'Layout',
        category: 'raw-link-overflow',
        affectedSection: sectionId,
        explanation: 'Raw link display prints the full URL and can stretch line length.',
        suggestedFix: 'Use embedded link mode or shorten the visible URL where possible.',
        scoreImpact: 1,
        evidence: normalized,
      }));
    }
  });

  return issues;
};

const detectSkillsConsistency = (resume: NormalizedResume) => {
  const counts = countSkillBuckets(resume).filter(count => count > 0);
  if (counts.length < 2) return null;
  const max = Math.max(...counts);
  const min = Math.min(...counts);
  if (max < 6 || max / Math.max(1, min) < 3) return null;

  return issue({
    title: 'Skills layout is uneven',
    severity: 'Low',
    group: 'Formatting',
    category: 'skills-layout',
    affectedSection: 'Skills',
    explanation: 'Skill categories are unevenly distributed, which can make the section read inconsistently.',
    suggestedFix: 'Balance skill group sizes or split dense lists into clearer categories.',
    scoreImpact: 2,
    evidence: `Skill counts: ${counts.join(', ')}`,
  });
};

const detectRequiredSectionIssues = (resume: NormalizedResume) => {
  const issues: AtsIssue[] = [];
  const required: Array<[string, string]> = [
    ['summary', 'Summary'],
    ['education', 'Education'],
    ['skills', 'Skills'],
    [resume.resolvedCandidateMode === 'student' ? 'projects' : 'experience', resume.resolvedCandidateMode === 'student' ? 'Projects' : 'Experience'],
  ];
  required.forEach(([id, label]) => {
    if (!isSectionPresent(resume, id)) {
      issues.push(issue({
        title: `${label} section is missing`,
        severity: 'High',
        group: 'Structure',
        category: 'missing-required-section',
        affectedSection: label,
        explanation: `The resume does not expose a recognizable ${label.toLowerCase()} section to ATS parsing.`,
        suggestedFix: `Add a clear ${label} section or rename an existing section using a recognized alias.`,
        scoreImpact: 10,
        evidence: id,
      }));
    }
  });
  return issues;
};

const detectRecommendedSectionIssues = (resume: NormalizedResume) => {
  const issues: AtsIssue[] = [];
  const recommended: Array<[string, string]> = [
    [resume.resolvedCandidateMode === 'student' ? 'experience' : 'projects', resume.resolvedCandidateMode === 'student' ? 'Experience' : 'Projects'],
    ['certifications', 'Certifications'],
    ['achievements', 'Achievements'],
  ];
  recommended.forEach(([id, label]) => {
    if (!isSectionPresent(resume, id)) {
      issues.push(issue({
        title: `${label} section is optional but helpful`,
        severity: 'Low',
        group: 'Structure',
        category: 'missing-recommended-section',
        affectedSection: label,
        explanation: `The resume does not include ${label.toLowerCase()}, which often helps ATS and recruiters evaluate evidence.`,
        suggestedFix: `Add ${label.toLowerCase()} only if you have relevant content.`,
        scoreImpact: 2,
        evidence: id,
      }));
    }
  });
  return issues;
};

const detectContactIssues = (resume: NormalizedResume) => {
  const issues: AtsIssue[] = [];
  const name = resume.contact.name || resume.name;
  const email = resume.contact.email || resume.email;
  const phone = resume.contact.phone || resume.phone;

  if (!name.trim()) {
    issues.push(issue({
      title: 'Name is missing from the header',
      severity: 'Critical',
      group: 'ATS Essentials',
      category: 'missing-contact-name',
      affectedSection: 'Header',
      explanation: 'A resume header without a name is difficult for ATS and recruiters to identify.',
      suggestedFix: 'Add the candidate name in the top header area.',
      scoreImpact: 15,
    }));
  }

  if (!email.trim() || !emailPattern.test(email.trim())) {
    issues.push(issue({
      title: 'Email is missing or invalid',
      severity: 'High',
      group: 'ATS Essentials',
      category: 'invalid-email',
      affectedSection: 'Header',
      explanation: 'ATS systems depend on a valid email address for contact and identity matching.',
      suggestedFix: 'Use a standard email address in the header.',
      scoreImpact: 12,
      evidence: email || 'missing',
    }));
  }

  if (phone.trim() && !phonePattern.test(phone.trim())) {
    issues.push(issue({
      title: 'Phone number format is invalid',
      severity: 'Medium',
      group: 'ATS Essentials',
      category: 'invalid-phone',
      affectedSection: 'Header',
      explanation: 'The provided phone number may not be recognized reliably by resume parsers.',
      suggestedFix: 'Use a recognizable phone number format in the header.',
      scoreImpact: 5,
      evidence: phone,
    }));
  }

  return issues;
};

export function runAtsStructuralScan(input: AtsStructuralScanInput): AtsStageResult {
  const resume = input.resume;
  const templateId = (input.templateId || resume.templateId) as TemplateId;
  const sectionSettings = input.sectionSettings || resume.sectionSettings;
  const linkSettings = input.linkSettings || resume.linkSettings;
  const linkMode = resolveLinkDisplayMode(
    { linkDisplayMode: resume.linkDisplayMode, linkSettings },
    sectionSettings.sectionConfig.summary,
  );
  const issues: AtsIssue[] = [];

  issues.push(...detectContactIssues(resume));
  issues.push(...detectRequiredSectionIssues(resume));
  issues.push(...detectRecommendedSectionIssues(resume));

  const orderIssue = detectOrderIssue(resume, templateId);
  if (orderIssue) issues.push(orderIssue);

  const multiColumnIssue = detectMultiColumnRisk(input.parserCoordinates);
  if (multiColumnIssue) issues.push(multiColumnIssue);

  const sideBySideIssue = detectSideBySideRisk(input.parserCoordinates, input.renderMetrics);
  if (sideBySideIssue) issues.push(sideBySideIssue);

  const headerIssue = detectHeaderOverflowRisk(input.renderMetrics, input.parserCoordinates);
  if (headerIssue) issues.push(headerIssue);

  issues.push(...detectMissingLinksAndOverflow(resume, linkMode));

  if (input.renderMetrics?.projectTechOverlapRisk === 'medium' || input.renderMetrics?.projectTechOverlapRisk === 'high') {
    issues.push(issue({
      title: 'Project technology text may overlap its description', severity: input.renderMetrics.projectTechOverlapRisk === 'high' ? 'High' : 'Medium',
      group: 'Layout', category: 'project-tech-overlap', affectedSection: 'Projects',
      explanation: 'Document layout metrics detected insufficient separation between project technology text and description content.',
      suggestedFix: 'Render links, technology stack, and description as separate wrapping rows.', scoreImpact: input.renderMetrics.projectTechOverlapRisk === 'high' ? 7 : 4,
      evidence: `projectTechOverlapRisk=${input.renderMetrics.projectTechOverlapRisk}`,
    }));
  }
  if (input.renderMetrics?.certificationLinkOverlapRisk === 'medium' || input.renderMetrics?.certificationLinkOverlapRisk === 'high') {
    issues.push(issue({
      title: 'Certification link may overlap certification content', severity: input.renderMetrics.certificationLinkOverlapRisk === 'high' ? 'High' : 'Medium',
      group: 'Layout', category: 'certification-link-overlap', affectedSection: 'Certifications',
      explanation: 'Document layout metrics detected insufficient space for certification text and its link.',
      suggestedFix: 'Move the credential link onto a wrapping row or use a short embedded label.', scoreImpact: input.renderMetrics.certificationLinkOverlapRisk === 'high' ? 6 : 3,
      evidence: `certificationLinkOverlapRisk=${input.renderMetrics.certificationLinkOverlapRisk}`,
    }));
  }

  const skillsIssue = detectSkillsConsistency(resume);
  if (skillsIssue) issues.push(skillsIssue);

  resume.projects.forEach(project => {
    const techLine = project.tech.join(' • ');
    if (techLine.length > 160) {
      issues.push(issue({
        title: 'Project technology line may wrap heavily', severity: 'Low', group: 'Layout', category: 'project-tech-overflow',
        affectedSection: 'Projects', explanation: 'The project technology list is long enough to create layout pressure in compact templates.',
        suggestedFix: 'Keep only the most relevant technologies or allow the technology line to wrap above the description.',
        scoreImpact: 1, evidence: `${project.title}: ${techLine.length} characters`,
      }));
    }
  });
  resume.certifications.forEach(certification => {
    const lineLength = `${certification.name} ${certification.issuer} ${certification.credentialUrl || ''}`.length;
    if (lineLength > 180) {
      issues.push(issue({
        title: 'Certification row may be too dense', severity: 'Low', group: 'Layout', category: 'certification-layout',
        affectedSection: 'Certifications', explanation: 'The certification label, issuer, and link may compete for horizontal space.',
        suggestedFix: 'Use an embedded link label or move the credential link below the certification title.', scoreImpact: 1,
        evidence: `${certification.name}: ${lineLength} characters`,
      }));
    }
  });
  if (input.parserCoordinates?.length) {
    const extractedCharacters = input.parserCoordinates.reduce((count, item) => count + (item.text?.trim().length || 0), 0);
    if (extractedCharacters < 100) {
      issues.push(issue({
        title: 'PDF text extraction is limited', severity: 'High', group: 'ATS Essentials', category: 'parser-readability',
        affectedSection: 'Document', explanation: 'Parser coordinates contain too little selectable text for reliable ATS extraction.',
        suggestedFix: 'Export a text-based PDF and verify that resume text can be selected and copied.', scoreImpact: 8,
        evidence: `${extractedCharacters} extracted characters`,
      }));
    }
  }

  const pages = estimatePages(resume, input.renderMetrics, input.parserCoordinates);
  if (pages > 1.25) {
    issues.push(issue({
      title: 'Document may run longer than a single page',
      severity: pages >= 2 ? 'Medium' : 'Low',
      group: 'Layout',
      category: 'page-count',
      affectedSection: 'Layout',
      explanation: 'The resume content appears likely to exceed a single page.',
      suggestedFix: 'Trim content, reduce section density, or choose a denser template.',
      scoreImpact: pages >= 2 ? 4 : 2,
      evidence: `estimatedPages=${pages.toFixed(1)}`,
    }));
  }

  const uniqueIssues = issues.filter((entry, index, array) => array.findIndex(other => other.id === entry.id) === index);
  const score = clamp(100 - uniqueIssues.reduce((sum, entry) => sum + entry.scoreImpact, 0));
  const evidenceIncomplete = !input.parserCoordinates?.length || !input.renderMetrics;
  const status: AtsStageResult['status'] = evidenceIncomplete ? 'partial' : 'ready';
  const summaryParts = [
    `${uniqueIssues.length} structural issue${uniqueIssues.length === 1 ? '' : 's'} found`,
    `estimated pages: ${pages.toFixed(1)}`,
    evidenceIncomplete ? 'evidence is incomplete' : 'evidence is complete',
  ];

  return {
    stageId: 'structureCheck',
    score,
    summary: summaryParts.join(' · '),
    issues: uniqueIssues,
    status,
    confidence: evidenceIncomplete ? 'low' : 'high',
  };
}

const notRunStage = (stageId: Exclude<AtsStageId, 'structureCheck'>, summary: string): AtsStageResult => ({
  stageId,
  score: null,
  summary,
  issues: [],
  status: 'not_run',
});

const needsJobDescriptionStage = (): AtsStageResult => ({
  stageId: 'jobMatch',
  score: null,
  summary: 'Add a job description to compare your resume against this role.',
  issues: [],
  status: 'needs_job_description',
});

const needsAiStage = (stageId: Exclude<AtsStageId, 'structureCheck' | 'applyToBuilder'>): AtsStageResult => ({
  stageId,
  score: null,
  summary: stageId === 'jobMatch'
    ? 'Connect an AI provider to run semantic job matching.'
    : 'Connect an AI provider to check content quality, grammar, spelling, and rewrite suggestions.',
  issues: [],
  status: 'needs_ai',
});

const aiErrorStage = (stageId: Exclude<AtsStageId, 'structureCheck'>): AtsStageResult => ({
  stageId,
  score: null,
  summary: AI_ATS_FALLBACK_MESSAGE,
  issues: [],
  status: 'error',
});

const noSuggestionsStage = (): AtsStageResult => notRunStage(
  'applyToBuilder',
  'Run AI Job Match to generate builder-ready suggestions.'
);

const mapIntelligence = (payload: AtsIntelligencePayload): { stages: AtsStageResult[]; suggestions: AtsSuggestion[] } => {
  const suggestions = payload.suggestions.map(suggestion => createSuggestionFromAtsFinding({
    id: suggestion.id,
    type: suggestion.type,
    sectionId: suggestion.target.sectionId,
    itemId: suggestion.target.itemId,
    fieldPath: suggestion.target.fieldPath,
    originalValue: suggestion.originalValue,
    suggestedValue: suggestion.suggestedValue,
    reason: suggestion.reason,
    evidence: suggestion.evidence,
    confidence: suggestion.confidence,
    requiresUserConfirmation: suggestion.requiresUserConfirmation,
    truthWarning: suggestion.truthWarning,
  }));
  const jobIssues = [
    ...payload.jobMatch.missingKeywords.map(keyword => issue({
      title: `Missing keyword: ${keyword}`,
      severity: 'Medium', group: 'Content', category: 'missing-keyword', affectedSection: 'Skills',
      explanation: 'The target role mentions this keyword, but the resume does not provide confirmed evidence.',
      suggestedFix: 'Confirm real experience before adding it, or keep it as a learning target.', scoreImpact: 3, evidence: keyword,
    })),
    ...payload.jobMatch.partialMatches.map(match => issue({
      title: `Partial match: ${match.keyword}`,
      severity: 'Low', group: 'Content', category: 'partial-match', affectedSection: 'Skills',
      explanation: match.reason, suggestedFix: 'Clarify truthful evidence in the most relevant section.', scoreImpact: 1,
      evidence: match.evidence,
    })),
  ];
  const contentIssues = [
    ...suggestions.filter(suggestion => suggestion.type !== 'add_keyword' && suggestion.type !== 'add_learning_target')
      .map(suggestion => issue({
      title: suggestion.reason,
      severity: suggestion.requiresUserConfirmation ? 'Medium' : 'Low', group: 'Content', category: suggestion.type,
      affectedSection: suggestion.target.sectionId, explanation: suggestion.reason,
      suggestedFix: String(suggestion.suggestedValue), scoreImpact: 2, evidence: suggestion.evidence,
      })),
    ...payload.contentUpgrade.grammarIssues.map((message, index) => issue({
      title: `Grammar issue ${index + 1}`, severity: 'Low', group: 'Grammar', category: 'grammar', affectedSection: 'Content',
      explanation: message, suggestedFix: 'Review and apply a correction only after confirming the intended meaning.', scoreImpact: 1,
    })),
    ...payload.contentUpgrade.spellingIssues.map((message, index) => issue({
      title: `Spelling issue ${index + 1}`, severity: 'Low', group: 'Spelling', category: 'spelling', affectedSection: 'Content',
      explanation: message, suggestedFix: 'Correct the spelling while preserving names and technical terminology.', scoreImpact: 1,
    })),
  ];

  return {
    suggestions,
    stages: [
      { stageId: 'jobMatch', score: clamp(payload.jobMatch.score), summary: payload.jobMatch.roleFitSummary, issues: jobIssues, status: 'ready', confidence: 'medium' },
      { stageId: 'contentUpgrade', score: null, summary: `${contentIssues.length} evidence-based content suggestion${contentIssues.length === 1 ? '' : 's'} prepared.`, issues: contentIssues, status: 'ready', confidence: 'medium' },
      suggestions.length
        ? { stageId: 'applyToBuilder', score: null, summary: `${suggestions.length} suggestion${suggestions.length === 1 ? '' : 's'} awaiting user review.`, issues: [], status: 'ready', confidence: 'high' }
        : noSuggestionsStage(),
    ],
  };
};

async function buildAiStages(input: AtsStructuralScanInput): Promise<{ stages: AtsStageResult[]; suggestions: AtsSuggestion[] }> {
  const execution = await runAiJobMatch({
    resume: input.resume,
    jobDescription: input.jobDescription || '',
    settings: input.settings,
  });
  if (execution.status === 'needs_ai') {
    return { stages: [needsAiStage('jobMatch'), needsAiStage('contentUpgrade'), noSuggestionsStage()], suggestions: [] };
  }
  if (execution.status === 'needs_job_description') {
    return { stages: [needsJobDescriptionStage(), notRunStage('contentUpgrade', 'Add a job description to run targeted content analysis.'), noSuggestionsStage()], suggestions: [] };
  }
  if (execution.status === 'error' || !execution.payload) {
    return { stages: [aiErrorStage('jobMatch'), aiErrorStage('contentUpgrade'), noSuggestionsStage()], suggestions: [] };
  }
  return mapIntelligence(execution.payload);
}

export function runAtsAnalysisV2(input: AtsStructuralScanInput): AtsResult {
  const structural = runAtsStructuralScan(input);
  const aiConfigured = hasAiProviderConfigured(input.settings);
  const stages: AtsStageResult[] = [
    structural,
    input.jobDescription?.trim()
      ? aiConfigured ? notRunStage('jobMatch', 'Run AI Job Match to analyze this role.') : needsAiStage('jobMatch')
      : needsJobDescriptionStage(),
    aiConfigured ? notRunStage('contentUpgrade', 'Run AI Job Match to check content quality.') : needsAiStage('contentUpgrade'),
    noSuggestionsStage(),
  ];
  const issues = stages.flatMap(stage => stage.issues);
  const availableStages = stages.filter(stage => typeof stage.score === 'number');
  const overallScore = availableStages.length
    ? clamp(availableStages.reduce((sum, stage) => sum + (stage.score ?? 0), 0) / availableStages.length)
    : 0;

  return {
    overallScore,
    stages,
    issues,
    generatedAt: new Date().toISOString(),
    disclaimer: DISCLAIMER,
    scanMode: 'local',
    candidateMode: input.resume.resolvedCandidateMode,
    suggestions: [],
  };
}

export async function runAtsAnalysisV2WithAI(input: AtsStructuralScanInput): Promise<AtsResult> {
  const structural = runAtsStructuralScan(input);
  const aiResult = await buildAiStages(input);
  const stages: AtsStageResult[] = [structural, ...aiResult.stages];
  const issues = stages.flatMap(stage => stage.issues);
  const jobMatchScore = stages.find(stage => stage.stageId === 'jobMatch' && stage.status === 'ready')?.score;
  const overallScore = typeof jobMatchScore === 'number' ? jobMatchScore : structural.score ?? 0;

  return {
    overallScore,
    stages,
    issues,
    generatedAt: new Date().toISOString(),
    disclaimer: DISCLAIMER,
    scanMode: typeof jobMatchScore === 'number' ? 'ai-assisted' : 'local',
    candidateMode: input.resume.resolvedCandidateMode,
    suggestions: aiResult.suggestions,
  };
}

export function runAtsStructuralScanFromResumeData(
  resume: ResumeData,
  input: Omit<AtsStructuralScanInput, 'resume'> = {}
): AtsStageResult {
  return runAtsStructuralScan({
    ...input,
    resume: normalizeResumeModel(resume, { source: 'migration' }),
  });
}

export const createEmptyAtsResult = (): AtsResult => ({
  overallScore: 0,
  stages: STAGE_IDS.map(stageId => ({
    stageId,
    score: stageId === 'structureCheck' ? 0 : null,
    summary: 'Unavailable',
    issues: [],
    status: stageId === 'structureCheck' ? 'partial' : 'not_run',
  })),
  issues: [],
  generatedAt: new Date().toISOString(),
  disclaimer: DISCLAIMER,
  scanMode: 'local',
  candidateMode: 'student',
  suggestions: [],
});

export async function rewriteBulletWithGoogleXyz(
  settings: UserSettings,
  bullet: string
): Promise<AtsXyzRewritePayload> {
  const provider = createAiProvider(settings);
  if (!provider) throw new Error(AI_ATS_FALLBACK_MESSAGE);
  return provider.generateJson(buildXyzRewritePrompt(bullet), xyzRewriteSchema);
}

export async function generateInterviewAnswerFeedback(
  settings: UserSettings,
  question: string,
  answer: string
): Promise<AtsInterviewAnswerFeedbackPayload> {
  const provider = createAiProvider(settings);
  if (!provider) throw new Error(AI_ATS_FALLBACK_MESSAGE);
  return provider.generateJson(
    buildInterviewAnswerFeedbackPrompt(question, answer),
    interviewAnswerFeedbackSchema
  );
}
