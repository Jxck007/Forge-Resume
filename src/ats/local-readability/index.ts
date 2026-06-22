import type { NormalizedResume } from '../../schema/resumeSchema';
import type { AtsIssue as LegacyAtsIssue } from '../../types';
import {
  AtsParserCoordinate,
  AtsRenderMetrics,
  runAtsStructuralScan,
} from '../../utils/atsV2';
import type {
  AtsIssue,
  AtsIssueCategory,
  AtsIssueSeverity,
  LocalReadabilityResult,
} from '../core/types';

export interface LocalReadabilityInput {
  resume: NormalizedResume;
  templateId?: string;
  parserCoordinates?: AtsParserCoordinate[];
  renderMetrics?: Pick<
    AtsRenderMetrics,
    | 'estimatedPages'
    | 'headerOverflowRisk'
    | 'textOverflowRisk'
    | 'skillsSideBySide'
    | 'experienceSideBySide'
    | 'projectTechOverlapRisk'
    | 'certificationLinkOverlapRisk'
  >;
}

const categoryFor = (issue: LegacyAtsIssue): AtsIssueCategory => {
  const value = `${issue.group} ${issue.category}`.toLowerCase();
  if (value.includes('contact') || value.includes('email') || value.includes('phone')) return 'contact';
  if (value.includes('order')) return 'section_order';
  if (value.includes('section')) return 'sections';
  if (value.includes('parser') || value.includes('extraction')) return 'pdf_text_extraction';
  if (value.includes('link')) return 'links';
  if (value.includes('page')) return 'page_length';
  return 'layout_safety';
};

const severityFor = (severity: LegacyAtsIssue['severity']): AtsIssueSeverity => severity.toLowerCase() as AtsIssueSeverity;

const adaptIssue = (legacy: LegacyAtsIssue): AtsIssue => ({
  id: legacy.id,
  title: legacy.title,
  severity: severityFor(legacy.severity),
  category: categoryFor(legacy),
  affectedSection: legacy.affectedSection,
  explanation: legacy.explanation,
  suggestedFix: legacy.suggestedFix,
  evidence: legacy.evidence,
  scoreImpact: legacy.scoreImpact,
});

const ratingFor = (score: number): LocalReadabilityResult['rating'] =>
  score >= 85 ? 'strong_structure' : score >= 70 ? 'good_structure' : score >= 50 ? 'fair' : 'needs_work';

export function runLocalReadabilityCheck(input: LocalReadabilityInput): LocalReadabilityResult {
  const result = runAtsStructuralScan({
    resume: input.resume,
    templateId: input.templateId,
    parserCoordinates: input.parserCoordinates,
    renderMetrics: input.renderMetrics,
  });
  const secondaryScore = result.score ?? 0;
  const issues = result.issues
    .filter(issue => issue.group !== 'Responsiveness')
    .map(adaptIssue);

  return {
    mode: 'local_readability',
    label: 'Local Resume Readability',
    status: 'ready',
    rating: ratingFor(secondaryScore),
    secondaryScore,
    confidence: result.confidence || 'low',
    issues,
    evidence: issues.map(issue => issue.evidence).filter((value): value is string => Boolean(value)),
    generatedAt: new Date().toISOString(),
    disclaimer: 'This is a local structure check, not a full ATS scan.',
    warning: 'This local check reviews structure and parseability only. It does not evaluate job fit, keyword relevance, grammar, or content quality without AI.',
  };
}
