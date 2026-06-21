import { normalizeResumeModel, NormalizedResume } from '../schema/resumeSchema';
import { ResumeData, TemplateId } from '../types';
import { AtsParserCoordinate } from './atsV2';
import { CANONICAL_SECTION_KEYS, canonicalizeSectionId } from './sectionEngine';

export type ParserConfidence = 'low' | 'medium' | 'high';

export interface PdfMetadata {
  fileName: string;
  pageCount: number;
  title?: string;
  author?: string;
  creationDate?: string;
  modificationDate?: string;
  producer?: string;
  creator?: string;
  embeddedLinks: string[];
  fontNames: string[];
}

export interface PdfTextItem {
  text: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  fontName?: string;
}

export interface ResumeParserIssue {
  code: string;
  message: string;
}

export interface ResumeParseDiagnostics {
  parseConfidence: ParserConfidence;
  readingOrderConfidence: ParserConfidence;
  sectionDetectionConfidence: ParserConfidence;
  contactParsed: boolean;
  linksParsed: boolean;
  multiColumnRisk: boolean;
  detectedIssues: ResumeParserIssue[];
}

export interface ParsedResumeFields {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedIn: string;
  github: string;
  portfolio: string;
  summary: string;
  education: string[];
  experience: string[];
  skills: string[];
  projects: string[];
  certifications: string[];
  achievements: string[];
}

export interface ResumeParserResult {
  metadata: PdfMetadata;
  textItems: PdfTextItem[];
  rawText: string;
  detectedSections: Partial<Record<CanonicalParserSectionId, string[]>>;
  detectedFields: ParsedResumeFields;
  normalizedResume: NormalizedResume;
  diagnostics: ResumeParseDiagnostics;
}

type CanonicalParserSectionId = typeof CANONICAL_SECTION_KEYS[number];

type PdfTextLike = {
  str?: string;
  width?: number;
  height?: number;
  transform?: number[];
  fontName?: string;
};

const SKILL_KEYWORDS = {
  languages: ['javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'go', 'ruby', 'php', 'swift', 'kotlin', 'rust', 'sql', 'html', 'css'],
  frameworks: ['react', 'vue', 'angular', 'node', 'node.js', 'express', 'next', 'nestjs', 'django', 'flask', 'spring', 'tailwind'],
  databases: ['postgres', 'postgresql', 'mysql', 'mongodb', 'firebase', 'redis', 'sqlite', 'dynamodb'],
  tools: ['git', 'github', 'docker', 'kubernetes', 'jira', 'figma', 'vercel', 'webpack', 'vite', 'postman', 'linux', 'aws', 'gcp', 'azure'],
};

const EMAIL_PATTERN = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/;
const PHONE_PATTERN = /(?:\+?\d{1,3}[\s().-]*)?(?:\(?\d{2,4}\)?[\s.-]*)?\d{3,4}[\s.-]?\d{3,4}/;
const URL_PATTERN = /(https?:\/\/[^\s)]+|www\.[^\s)]+)/gi;
const LINKEDIN_PATTERN = /linkedin\.com/i;
const GITHUB_PATTERN = /github\.com/i;
const LOCATION_PATTERN = /^[A-Za-z][A-Za-z\s.-]+,\s*[A-Za-z][A-Za-z\s.-]+$/;

const unique = (values: string[]) => [...new Set(values.map(value => value.trim()).filter(Boolean))];
const normalizeUrl = (value: string) => value && !/^https?:\/\//i.test(value) ? `https://${value}` : value;
const clamp = <T,>(value: T | undefined, fallback: T) => value === undefined ? fallback : value;

const parsePdfDate = (value?: string) => {
  if (!value) return undefined;
  const raw = value.replace(/^D:/, '').trim();
  const match = raw.match(/^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/);
  if (!match) return value;
  const [, year, month, day, hour = '00', minute = '00', second = '00'] = match;
  const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
  return Number.isNaN(Date.parse(iso)) ? value : new Date(iso).toISOString();
};

const getPdfLib = async () => {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
  return pdfjsLib;
};

const sortItemsForReading = (items: PdfTextItem[]) =>
  [...items].sort((a, b) => a.pageNumber !== b.pageNumber ? a.pageNumber - b.pageNumber : Math.abs(b.y - a.y) > 3 ? b.y - a.y : a.x - b.x);

const groupLines = (items: PdfTextItem[]) => {
  const lines: Array<{ pageNumber: number; y: number; fontSize: number; items: PdfTextItem[]; text: string }> = [];
  sortItemsForReading(items).forEach(item => {
    const threshold = Math.max(3, (item.fontSize || 12) * 0.35);
    const line = lines.find(candidate => candidate.pageNumber === item.pageNumber && Math.abs(candidate.y - item.y) <= threshold);
    if (line) {
      line.items.push(item);
      line.fontSize = Math.max(line.fontSize, item.fontSize || line.fontSize || 12);
      line.text = line.items.sort((a, b) => a.x - b.x).map(entry => entry.text).join(' ').replace(/\s+/g, ' ').trim();
    } else {
      lines.push({
        pageNumber: item.pageNumber,
        y: item.y,
        fontSize: item.fontSize || 12,
        items: [item],
        text: item.text,
      });
    }
  });

  return lines
    .map(line => ({
      ...line,
      text: line.items.sort((a, b) => a.x - b.x).map(entry => entry.text).join(' ').replace(/\s+/g, ' ').trim(),
    }))
    .filter(line => line.text);
};

const pickName = (lines: string[]) =>
  lines.find(line =>
    line.length >= 3 &&
    line.length <= 60 &&
    !EMAIL_PATTERN.test(line) &&
    !PHONE_PATTERN.test(line) &&
    !URL_PATTERN.test(line) &&
    !canonicalizeSectionId(line)
      .split(' ')
      .some(part => CANONICAL_SECTION_KEYS.includes(part as CanonicalParserSectionId))
  ) || '';

const parseLinks = (text: string, embeddedLinks: string[]) => {
  const urls = unique([...(text.match(URL_PATTERN) || []), ...embeddedLinks].map(normalizeUrl));
  const linkedIn = urls.find(url => LINKEDIN_PATTERN.test(url)) || '';
  const github = urls.find(url => GITHUB_PATTERN.test(url)) || '';
  const portfolio = urls.find(url => url && !LINKEDIN_PATTERN.test(url) && !GITHUB_PATTERN.test(url)) || '';
  return { urls, linkedIn, github, portfolio };
};

const detectSectionHeadings = (lines: ReturnType<typeof groupLines>) => {
  const averageFont = lines.reduce((sum, line) => sum + line.fontSize, 0) / Math.max(lines.length, 1);
  return lines
    .map((line, index) => {
      const canonicalId = canonicalizeSectionId(line.text) as CanonicalParserSectionId | '';
      const isCanonical = CANONICAL_SECTION_KEYS.includes(canonicalId as CanonicalParserSectionId);
      const looksLikeHeading = line.text.length <= 48 && (isCanonical || line.fontSize >= averageFont * 1.08);
      return looksLikeHeading && isCanonical ? { index, canonicalId, text: line.text } : null;
    })
    .filter((value): value is { index: number; canonicalId: CanonicalParserSectionId; text: string } => !!value);
};

const collectSectionLines = (lines: ReturnType<typeof groupLines>) => {
  const headings = detectSectionHeadings(lines);
  const detectedSections: Partial<Record<CanonicalParserSectionId, string[]>> = {};

  headings.forEach((heading, index) => {
    const nextIndex = headings[index + 1]?.index ?? lines.length;
    const content = lines
      .slice(heading.index + 1, nextIndex)
      .map(line => line.text.trim())
      .filter(Boolean);
    if (content.length) detectedSections[heading.canonicalId] = content;
  });

  return { headings, detectedSections };
};

const splitList = (lines: string[]) =>
  unique(
    lines
      .flatMap(line => line.split(/\s*[•·▪|]\s*|\s*,\s*|\s*;\s*/))
      .map(line => line.replace(/^[-–]\s*/, '').trim())
      .filter(Boolean)
  );

const classifySkills = (skills: string[]) => {
  const buckets = {
    languages: [] as string[],
    frameworks: [] as string[],
    databases: [] as string[],
    tools: [] as string[],
    concepts: [] as string[],
  };

  skills.forEach(skill => {
    const lower = skill.toLowerCase();
    if (SKILL_KEYWORDS.languages.some(keyword => lower.includes(keyword))) buckets.languages.push(skill);
    else if (SKILL_KEYWORDS.frameworks.some(keyword => lower.includes(keyword))) buckets.frameworks.push(skill);
    else if (SKILL_KEYWORDS.databases.some(keyword => lower.includes(keyword))) buckets.databases.push(skill);
    else if (SKILL_KEYWORDS.tools.some(keyword => lower.includes(keyword))) buckets.tools.push(skill);
    else buckets.concepts.push(skill);
  });

  return {
    languages: unique(buckets.languages),
    frameworks: unique(buckets.frameworks),
    databases: unique(buckets.databases),
    tools: unique(buckets.tools),
    concepts: unique(buckets.concepts),
  };
};

const toBulletLines = (lines: string[]) => lines.map(line => line.replace(/^[-•▪]\s*/, '').trim()).filter(Boolean);

const buildNormalizedResume = (
  fileName: string,
  fields: ParsedResumeFields,
  sections: Partial<Record<CanonicalParserSectionId, string[]>>,
  templateId: TemplateId = 'modern'
) => {
  const skills = classifySkills(fields.skills);
  const rawResume = {
    title: fileName.replace(/\.[^/.]+$/, '') || 'Imported Resume',
    templateId,
    source: 'parser' as const,
    personalDetails: {
      fullName: fields.name,
      professionalTitle: '',
      email: fields.email,
      phone: fields.phone,
      location: fields.location,
      linkedin: fields.linkedIn,
      github: fields.github,
      website: fields.portfolio,
    },
    summary: fields.summary,
    education: sections.education?.map((line, index) => ({
      id: `edu-${index}`,
      degree: line,
      institution: '',
      location: '',
      startDate: '',
      endDate: '',
      gpa: '',
      description: '',
    })) || [],
    experience: (sections.experience || []).length ? [{
      id: 'exp-0',
      title: '',
      company: '',
      location: '',
      startDate: '',
      endDate: '',
      description: toBulletLines(sections.experience || []).join('\n'),
    }] : [],
    skills,
    projects: sections.projects?.map((line, index) => ({
      id: `proj-${index}`,
      name: line,
      description: '',
      technologies: '',
      github: '',
      live: '',
    })) || [],
    certifications: sections.certifications?.map((line, index) => ({
      id: `cert-${index}`,
      name: line,
      issuer: '',
      date: '',
      url: '',
    })) || [],
    achievements: fields.achievements,
  };

  return normalizeResumeModel(rawResume, { source: 'parser' });
};

const buildDetectedFields = (
  rawText: string,
  lines: ReturnType<typeof groupLines>,
  metadata: PdfMetadata,
  detectedSections: Partial<Record<CanonicalParserSectionId, string[]>>
): ParsedResumeFields => {
  const topLines = unique(lines.slice(0, 8).map(line => line.text));
  const email = rawText.match(EMAIL_PATTERN)?.[0] || '';
  const phone = rawText.match(PHONE_PATTERN)?.[0] || '';
  const { linkedIn, github, portfolio } = parseLinks(rawText, metadata.embeddedLinks);
  const summaryLines = detectedSections.summary || [];
  const skills = splitList(detectedSections.skills || []);
  const fallbackLocation = topLines.find(line => LOCATION_PATTERN.test(line)) || '';

  return {
    name: pickName(topLines),
    email,
    phone,
    location: fallbackLocation,
    linkedIn,
    github,
    portfolio,
    summary: summaryLines.join(' ').trim(),
    education: detectedSections.education || [],
    experience: detectedSections.experience || [],
    skills,
    projects: detectedSections.projects || [],
    certifications: detectedSections.certifications || [],
    achievements: detectedSections.achievements || [],
  };
};


const ocrPdfPage = async (pdf: Awaited<ReturnType<Awaited<ReturnType<typeof getPdfLib>>['getDocument']>['promise']>, pageNumber: number) => {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1.6 });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return [] as PdfTextItem[];
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');
  try {
    const result = await worker.recognize(canvas);
    return result.data.text
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map((line, index) => ({
        text: line,
        pageNumber,
        x: 0,
        y: Math.max(0, viewport.height - ((index + 1) * 18)),
        width: viewport.width,
        height: 14,
        fontSize: 12,
        fontName: 'ocr',
      }));
  } finally {
    await worker.terminate();
  }
};

const detectMultiColumnRisk = (items: PdfTextItem[]) => {
  const byPage = new Map<number, PdfTextItem[]>();
  items.forEach(item => {
    const list = byPage.get(item.pageNumber) || [];
    list.push(item);
    byPage.set(item.pageNumber, list);
  });

  for (const pageItems of byPage.values()) {
    const clusters = unique(pageItems.map(item => String(Math.round(item.x / 50) * 50)).filter(value => Number(value) > 0));
    const xs = clusters.map(Number).sort((a, b) => a - b);
    if (xs.length >= 2 && xs[xs.length - 1] - xs[0] >= 140) return true;
  }
  return false;
};

const confidenceFrom = (value: number): ParserConfidence => value >= 0.75 ? 'high' : value >= 0.45 ? 'medium' : 'low';

export async function parseResumePdf(file: File, templateId: TemplateId = 'modern'): Promise<ResumeParserResult> {
  const pdfjsLib = await getPdfLib();
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const rawMetadata = await pdf.getMetadata().catch(() => null);
  const textItems: PdfTextItem[] = [];
  const embeddedLinks: string[] = [];
  const fontNames = new Set<string>();
  const pagesNeedingOcr: number[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageItems = (textContent.items as PdfTextLike[])
      .filter(item => item.str?.trim())
      .map(item => {
        const x = clamp(item.transform?.[4], 0);
        const y = clamp(item.transform?.[5], 0);
        const fontSize = Math.abs(clamp(item.transform?.[0], clamp(item.transform?.[3], 0)));
        const textItem: PdfTextItem = {
          text: item.str!.trim(),
          pageNumber,
          x,
          y,
          width: clamp(item.width, 0),
          height: clamp(item.height, fontSize || 0),
          fontSize: fontSize || undefined,
          fontName: item.fontName,
        };
        if (textItem.fontName) fontNames.add(textItem.fontName);
        return textItem;
      });

    textItems.push(...pageItems);
    if (!pageItems.length) pagesNeedingOcr.push(pageNumber);

    const annotations = await page.getAnnotations().catch(() => [] as Array<{ unsafeUrl?: string; url?: string; a?: { uri?: string } }>);
    annotations.forEach(annotation => {
      const candidate = annotation.unsafeUrl || annotation.url || annotation.a?.uri || '';
      if (candidate) embeddedLinks.push(normalizeUrl(candidate));
    });
  }

  if (pagesNeedingOcr.length) {
    for (const pageNumber of pagesNeedingOcr) {
      const ocrItems = await ocrPdfPage(pdf, pageNumber);
      if (ocrItems.length) {
        textItems.push(...ocrItems);
        fontNames.add('ocr');
      }
    }
  }

  const lines = groupLines(textItems);
  const rawText = lines.map(line => line.text).join('\n');
  const { detectedSections } = collectSectionLines(lines);
  const metadata: PdfMetadata = {
    fileName: file.name,
    pageCount: pdf.numPages,
    title: rawMetadata?.info?.Title || undefined,
    author: rawMetadata?.info?.Author || undefined,
    creationDate: parsePdfDate(rawMetadata?.info?.CreationDate),
    modificationDate: parsePdfDate(rawMetadata?.info?.ModDate),
    producer: rawMetadata?.info?.Producer || undefined,
    creator: rawMetadata?.info?.Creator || undefined,
    embeddedLinks: unique(embeddedLinks),
    fontNames: [...fontNames],
  };

  const detectedFields = buildDetectedFields(rawText, lines, metadata, detectedSections);
  const normalizedResume = buildNormalizedResume(file.name, detectedFields, detectedSections, templateId);
  const multiColumnRisk = detectMultiColumnRisk(textItems);
  const issues: ResumeParserIssue[] = [];

  if (!rawText.trim()) issues.push({ code: 'no-text', message: 'No readable text was extracted from the PDF.' });
  if (!detectedFields.email) issues.push({ code: 'missing-email', message: 'Email was not confidently detected.' });
  if (!Object.keys(detectedSections).length) issues.push({ code: 'missing-sections', message: 'Section headings were not confidently detected.' });
  if (multiColumnRisk) issues.push({ code: 'multi-column-risk', message: 'Possible multi-column layout detected from PDF coordinates.' });

  const parseConfidenceScore = [rawText.trim().length > 200, textItems.length > 40, !!detectedFields.email || !!detectedFields.phone].filter(Boolean).length / 3;
  const readingOrderScore = [lines.length > 10, !multiColumnRisk, textItems.length > 40].filter(Boolean).length / 3;
  const sectionScore = Math.min(1, Object.keys(detectedSections).length / 4);

  return {
    metadata,
    textItems,
    rawText,
    detectedSections,
    detectedFields,
    normalizedResume,
    diagnostics: {
      parseConfidence: confidenceFrom(parseConfidenceScore),
      readingOrderConfidence: confidenceFrom(readingOrderScore),
      sectionDetectionConfidence: confidenceFrom(sectionScore),
      contactParsed: Boolean(detectedFields.email || detectedFields.phone),
      linksParsed: Boolean(detectedFields.linkedIn || detectedFields.github || detectedFields.portfolio || metadata.embeddedLinks.length),
      multiColumnRisk,
      detectedIssues: issues,
    },
  };
}

export const parserResultToAtsCoordinates = (result: ResumeParserResult): AtsParserCoordinate[] => {
  const sectionEntries = Object.entries(result.detectedSections).flatMap(([sectionId, lines]) =>
    (lines || []).map(line => ({ sectionId, text: line }))
  );

  return result.textItems.map(item => ({
    page: item.pageNumber,
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    text: item.text,
    sectionId: sectionEntries.find(entry => entry.text.includes(item.text))?.sectionId,
  }));
};

export const parserResultToResumeData = (
  result: ResumeParserResult,
  options?: { id?: string; ownerId?: string; title?: string; templateId?: TemplateId }
): Partial<ResumeData> => {
  const resume = result.normalizedResume;
  return {
    id: options?.id || resume.id,
    ownerId: options?.ownerId || resume.ownerId || 'guest',
    userId: options?.ownerId || resume.ownerId || 'guest',
    title: options?.title || resume.title,
    templateId: options?.templateId || resume.templateId,
    linkDisplayMode: resume.linkDisplayMode,
    linkSettings: { defaultDisplayMode: resume.linkSettings.defaultDisplayMode },
    useProfilePhoto: resume.useProfilePhoto,
    personalDetails: {
      fullName: resume.name,
      professionalTitle: '',
      email: resume.email,
      phone: resume.phone,
      location: resume.location,
      linkedin: resume.linkedIn,
      github: resume.github,
      website: resume.portfolio,
    },
    summary: resume.summary,
    education: resume.education.map(entry => ({
      id: entry.id,
      degree: entry.degree,
      institution: entry.institution,
      location: entry.location,
      startDate: '',
      endDate: entry.date,
      gpa: entry.gpaOrPercentage || '',
      description: entry.description,
    })),
    experience: resume.experience.map(entry => ({
      id: entry.id,
      title: entry.role,
      company: entry.company,
      location: entry.location,
      startDate: '',
      endDate: entry.date,
      description: entry.bullets.join('\n'),
    })),
    projects: resume.projects.map(entry => ({
      id: entry.id,
      name: entry.title,
      description: entry.description,
      technologies: entry.tech.join(', '),
      github: entry.links.github || '',
      live: entry.links.demo || '',
    })),
    skills: {
      programmingLanguages: resume.skills.languages,
      frameworks: resume.skills.frameworks,
      tools: resume.skills.tools,
      databases: resume.skills.databases,
      softSkills: resume.skills.concepts,
    },
    certifications: resume.certifications.map(entry => ({
      id: entry.id,
      name: entry.name,
      issuer: entry.issuer,
      date: entry.date,
      url: entry.credentialUrl || '',
    })),
    achievements: resume.achievements.map(entry => [entry.title, entry.description].filter(Boolean).join(': ')),
    volunteering: [],
    languages: [],
    customSections: [],
    sectionConfig: resume.sectionConfig,
    languageQuality: {
      score: 100,
      issues: [],
      summary: {
        total: 0,
        spelling: 0,
        grammar: 0,
        clarity: 0,
        consistency: 0,
        duplicate: 0,
        highSeverity: 0,
      },
      updatedAt: new Date().toISOString(),
    },
    sectionOrder: resume.sectionSettings.sectionOrder,
    sectionOrderMode: resume.sectionSettings.sectionOrderMode,
    hiddenSections: resume.sectionSettings.hiddenSections,
    isArchived: false,
    createdAt: resume.createdAt,
    updatedAt: resume.updatedAt,
  };
};
