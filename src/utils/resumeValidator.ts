import {
  resumeAtsRules,
  resumeConstraints,
  resumeSpacing,
  resumeTemplatePlans,
} from '../design-system/resumeSystem';
import { normalizeResumeData } from '../schema/resumeSchema';
import { ResumeData, TemplateId } from '../types';

export type ResumeValidationSeverity = 'error' | 'warning' | 'info';

export interface ResumeValidationIssue {
  code: string;
  severity: ResumeValidationSeverity;
  message: string;
}

export interface ResumeRenderMetrics {
  pageCount?: number;
  clippedTextCount?: number;
  collisionCount?: number;
  rawUrlCount?: number;
  zeroAreaLinkCount?: number;
  extractedText?: string;
}

export interface ResumeValidationResult {
  valid: boolean;
  issues: ResumeValidationIssue[];
  checks: {
    atsSafe: boolean;
    densitySafe: boolean;
    overflowSafe: boolean;
    extractable: boolean;
  };
}

const estimateLines = (value: string, charactersPerLine = 82) =>
  Math.max(1, Math.ceil(value.trim().length / charactersPerLine));

export function validateResumeArchitecture(
  resume: ResumeData,
  templateId: TemplateId,
  metrics: ResumeRenderMetrics = {}
): ResumeValidationResult {
  const normalized = normalizeResumeData(resume);
  const plan = resumeTemplatePlans[templateId];
  const issues: ResumeValidationIssue[] = [];

  if (plan.bodyLayout === 'sidebar' && templateId !== 'designer') {
    issues.push({
      code: 'ats.sidebar-restricted',
      severity: 'error',
      message: 'Designer Portfolio is the only template allowed to use a sidebar layout.',
    });
  }

  if (plan.family === 'ats' && plan.bodyLayout !== 'single') {
    issues.push({
      code: 'ats.single-column',
      severity: 'error',
      message: 'ATS-family templates must remain single-column.',
    });
  }

  if (!plan.atsLinear && templateId !== 'designer') {
    issues.push({
      code: 'ats.linear-flow',
      severity: 'error',
      message: 'Non-linear text flow is restricted to Designer Portfolio.',
    });
  }

  const skillCategoryCount = Object.values(normalized.skills).filter(
    values => values.length > 0
  ).length;
  if (skillCategoryCount > resumeConstraints.maxSkillsCategories) {
    issues.push({
      code: 'density.skill-categories',
      severity: 'error',
      message: `Skills exceed ${resumeConstraints.maxSkillsCategories} normalized categories.`,
    });
  }

  normalized.projects.forEach(project => {
    const estimatedLines =
      1 +
      (project.tech.length > 0 || project.links.github || project.links.demo ? 1 : 0) +
      estimateLines(project.description);
    if (estimatedLines > resumeConstraints.maxProjectLines + 1) {
      issues.push({
        code: 'density.project-lines',
        severity: 'warning',
        message: `${project.title || 'Project'} may exceed the compact project target.`,
      });
    }
  });

  normalized.certifications.forEach(certification => {
    const estimatedLines =
      estimateLines(certification.name, 64) +
      (certification.issuer || certification.credentialUrl ? 1 : 0);
    if (estimatedLines > resumeConstraints.maxCertLines) {
      issues.push({
        code: 'density.certification-lines',
        severity: 'warning',
        message: `${certification.name || 'Certification'} may exceed two compact lines.`,
      });
    }
  });

  if (resumeSpacing.sectionGap > 6 || resumeSpacing.entryGap > 3) {
    issues.push({
      code: 'density.spacing-token',
      severity: 'error',
      message: 'Central spacing tokens exceed the resume density contract.',
    });
  }

  if ((metrics.pageCount || 1) > 1) {
    issues.push({
      code: 'overflow.page-count',
      severity: 'info',
      message: `Rendered output requires ${metrics.pageCount} pages.`,
    });
  }
  if ((metrics.clippedTextCount || 0) > 0) {
    issues.push({
      code: 'overflow.clipping',
      severity: 'error',
      message: 'Rendered output contains clipped text.',
    });
  }
  if ((metrics.collisionCount || 0) > 0) {
    issues.push({
      code: 'overflow.collision',
      severity: 'error',
      message: 'Rendered output contains text collisions.',
    });
  }
  if ((metrics.rawUrlCount || 0) > 0) {
    issues.push({
      code: 'ats.raw-url',
      severity: 'error',
      message: 'Raw web URLs are visible in the PDF.',
    });
  }
  if ((metrics.zeroAreaLinkCount || 0) > 0) {
    issues.push({
      code: 'ats.link-annotation',
      severity: 'error',
      message: 'One or more PDF link annotations have no clickable area.',
    });
  }

  if (metrics.extractedText) {
    const requiredEvidence = [
      resume.personalDetails.fullName,
      ...normalized.experience.flatMap(entry => [entry.role, entry.company]),
      ...normalized.education.flatMap(entry => [entry.degree, entry.institution]),
      ...normalized.projects.map(project => project.title),
      ...Object.values(normalized.skills).flat(),
    ].filter(Boolean);
    const missingEvidence = requiredEvidence.filter(
      value => !metrics.extractedText?.toLocaleLowerCase().includes(value.toLocaleLowerCase())
    );
    if (missingEvidence.length > 0) {
      issues.push({
        code: 'ats.extraction-evidence',
        severity: 'error',
        message: `${missingEvidence.length} required resume values were not found in extracted text.`,
      });
    }
  }

  const atsSafe = !issues.some(
    issue => issue.severity === 'error' && issue.code.startsWith('ats.')
  );
  const densitySafe = !issues.some(
    issue => issue.severity === 'error' && issue.code.startsWith('density.')
  );
  const overflowSafe = !issues.some(
    issue => issue.severity === 'error' && issue.code.startsWith('overflow.')
  );
  const extractable = !issues.some(issue => issue.code === 'ats.extraction-evidence');

  return {
    valid: atsSafe && densitySafe && overflowSafe && extractable,
    issues,
    checks: { atsSafe, densitySafe, overflowSafe, extractable },
  };
}

export const resumeValidatorRules = {
  ...resumeAtsRules,
  ...resumeConstraints,
};
