import { EducationEntry, EducationScoreType } from '../types';

const SCHOOL_LEVEL_PATTERN =
  /\b(sslc|10th|tenth|secondary school|high school|hsc|12th|twelfth|higher secondary)\b/i;
const COLLEGE_LEVEL_PATTERN =
  /\b(diploma|polytechnic|associate|bachelor|b\.?\s*[a-z]{1,4}\b|master|m\.?\s*[a-z]{1,4}\b|ph\.?\s*d|doctorate|university|college)\b/i;

export const EDUCATION_SCORE_TYPES: { value: EducationScoreType; label: string }[] = [
  { value: 'cgpa', label: 'CGPA' },
  { value: 'gpa', label: 'GPA' },
  { value: 'percentage', label: 'Percentage' },
];

export function inferEducationScoreType(
  degree = '',
  score = '',
  explicitType?: unknown
): EducationScoreType {
  const normalizedType = String(explicitType || '').trim().toLowerCase();
  if (normalizedType === 'percentage' || normalizedType === 'percent' || normalizedType === '%') {
    return 'percentage';
  }
  if (normalizedType === 'cgpa') return 'cgpa';
  if (normalizedType === 'gpa') return 'gpa';

  const normalizedScore = score.trim();
  if (/%|\bpercent(?:age)?\b/i.test(normalizedScore)) return 'percentage';
  if (/\bcgpa\b/i.test(normalizedScore) || /\/\s*10(?:\.0+)?\b/.test(normalizedScore)) return 'cgpa';
  if (/\bgpa\b/i.test(normalizedScore) || /\/\s*4(?:\.0+)?\b/.test(normalizedScore)) return 'gpa';

  if (SCHOOL_LEVEL_PATTERN.test(degree)) return 'percentage';
  if (COLLEGE_LEVEL_PATTERN.test(degree)) {
    const numericScore = Number.parseFloat(normalizedScore);
    if (Number.isFinite(numericScore) && numericScore <= 4) return 'gpa';
    return 'cgpa';
  }

  const numericScore = Number.parseFloat(normalizedScore);
  if (Number.isFinite(numericScore)) {
    if (numericScore > 10) return 'percentage';
    if (numericScore <= 4) return 'gpa';
  }
  return 'cgpa';
}

export function getEducationScoreType(entry: Pick<EducationEntry, 'degree' | 'gpa' | 'scoreType'>) {
  return inferEducationScoreType(entry.degree, entry.gpa, entry.scoreType);
}

export function getEducationScoreLabel(
  entry: Pick<EducationEntry, 'degree' | 'gpa' | 'scoreType'>
) {
  const type = getEducationScoreType(entry);
  return type === 'percentage' ? 'Percentage' : type.toUpperCase();
}

export function getEducationScoreFieldLabel(
  entry: Pick<EducationEntry, 'degree' | 'gpa' | 'scoreType'>
) {
  return `${getEducationScoreLabel(entry)} (Optional)`;
}

export function getEducationScorePlaceholder(
  entry: Pick<EducationEntry, 'degree' | 'gpa' | 'scoreType'>
) {
  const type = getEducationScoreType(entry);
  if (type === 'percentage') return 'e.g., 92%';
  if (type === 'gpa') return 'e.g., 3.8 / 4.0';
  return 'e.g., 8.4 / 10';
}

export function formatEducationScore(
  entry: Pick<EducationEntry, 'degree' | 'gpa' | 'scoreType'>
) {
  const value = entry.gpa?.trim();
  if (!value) return '';
  if (/^(?:cgpa|gpa|percentage|percent)\b\s*[:\-]?/i.test(value)) return value;
  return `${getEducationScoreLabel(entry)}: ${value}`;
}

export function normalizeEducationScore(entry: Record<string, unknown>) {
  const degree = String(entry.degree || '').trim();
  const score = String(
    entry.score ?? entry.percentage ?? entry.cgpa ?? entry.gpa ?? ''
  ).trim();
  return {
    gpa: score,
    scoreType: inferEducationScoreType(degree, score, entry.scoreType),
  };
}
