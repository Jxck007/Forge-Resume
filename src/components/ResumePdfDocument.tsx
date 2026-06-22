import React from 'react';
import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
  Link,
} from '@react-pdf/renderer';
import {
  ResumeData,
  TemplateId,
  StandardSectionKey,
} from '../types';
import { resolveResumeSectionOrder } from '../utils/sectionOrder';
import { resolveSectionHeading } from '../utils/resolveSectionHeading';
import { resolveLinkDisplayMode } from '../utils/linkDisplay';
import {
  resumeAlignment,
  resumeSpacing,
  resumeTemplatePlans,
  resumeTypography,
} from '../design-system/resumeSystem';
import { normalizeResumeData, ResumeExperience } from '../schema/resumeSchema';
import { AchievementBullet } from './resume/AchievementBullet';
import { CertificationBlock } from './resume/CertificationBlock';
import { EducationBlock } from './resume/EducationBlock';
import { ExperienceBlock } from './resume/ExperienceBlock';
import { HeaderBlock } from './resume/HeaderBlock';
import { ProjectBlock } from './resume/ProjectBlock';
import { SkillsBlock } from './resume/SkillsBlock';
import { SummaryBlock } from './resume/SummaryBlock';
import {
  PaginationPolicy,
  ResumePrimitiveStyles,
} from './resume/types';

export type ResumePdfMode = 'single' | 'multi';
export const SINGLE_PAGE_MAX_COMPACT_LEVEL = 3;
export const FORCE_SINGLE_PAGE_PROFILE = -1;

interface ResumePdfDocumentProps {
  resume: ResumeData;
  templateId: TemplateId;
  mode: ResumePdfMode;
  profilePhoto?: string;
  compactLevel?: number;
  onRender?: (result: { pageCount: number }) => void;
}

type HeaderLayout = 'line' | 'centered' | 'band' | 'rail' | 'editorial' | 'technical';
type HeadingLayout = 'rule' | 'label' | 'block' | 'inline' | 'double';
type EntryLayout = 'plain' | 'rail' | 'card' | 'compact' | 'editorial';
type SkillsLayout = 'rows' | 'chips' | 'inline' | 'grid';
type BodyLayout = 'single' | 'portfolio';
type SpecialtyLayout = 'none' | 'developer' | 'startup' | 'analytics' | 'academic' | 'executive';

const fontSource = (fileName: string) => {
  if (typeof window !== 'undefined') return `/fonts/${fileName}`;
  const pathname = decodeURIComponent(
    new URL(`../../public/fonts/${fileName}`, import.meta.url).pathname
  );
  return /^\/[a-zA-Z]:\//.test(pathname) ? pathname.slice(1) : pathname;
};

Font.register({
  family: 'Inter',
  fonts: [
    { src: fontSource('inter-400.ttf'), fontWeight: 400 },
    { src: fontSource('inter-600.ttf'), fontWeight: 600 },
    { src: fontSource('inter-700.ttf'), fontWeight: 700 },
  ],
});
Font.register({
  family: 'Merriweather',
  fonts: [
    { src: fontSource('merriweather-400.ttf'), fontWeight: 400 },
    { src: fontSource('merriweather-400-italic.ttf'), fontWeight: 400, fontStyle: 'italic' },
    { src: fontSource('merriweather-700.ttf'), fontWeight: 700 },
  ],
});
Font.register({
  family: 'Aptos',
  fonts: [
    { src: fontSource('carlito-400.ttf'), fontWeight: 400 },
    { src: fontSource('carlito-700.ttf'), fontWeight: 700 },
  ],
});
Font.register({
  family: 'Arial',
  fonts: [
    { src: fontSource('arimo-400.ttf'), fontWeight: 400 },
    { src: fontSource('arimo-700.ttf'), fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback(word => [word]);

interface PdfTemplateProfile {
  accent: string;
  accentSoft: string;
  text: string;
  muted: string;
  border: string;
  headerBackground?: string;
  headerText?: string;
  fontFamily: 'Helvetica' | 'Arial' | 'Inter' | 'Merriweather' | 'Aptos';
  displayFontFamily?: 'Helvetica' | 'Arial' | 'Inter' | 'Merriweather' | 'Aptos';
  headerLayout: HeaderLayout;
  headingLayout: HeadingLayout;
  entryLayout: EntryLayout;
  skillsLayout: SkillsLayout;
  centeredHeader?: boolean;
  photoRound?: boolean;
  pageRail?: boolean;
  dense?: boolean;
  nameScale?: number;
  sectionScale?: number;
  projectEmphasis?: boolean;
  bodyLayout?: BodyLayout;
  specialty?: SpecialtyLayout;
  photoPolicy?: 'never' | 'optional' | 'preferred';
  spacingScale?: number;
  pageInset?: number;
}

interface TemplateCompactionProfile {
  spacing: number;
  header: number;
  heading: number;
  entry: number;
  project: number;
  skills: number;
  achievement: number;
  sidebar: number;
  columns: number;
  summary: number;
  pageInset: number;
  entryPresence: number;
  sectionPresence: number;
  headingPresence: number;
}

type ForceCompressionProfile = Partial<Pick<
  TemplateCompactionProfile,
  | 'spacing'
  | 'header'
  | 'heading'
  | 'entry'
  | 'project'
  | 'skills'
  | 'achievement'
  | 'sidebar'
  | 'columns'
  | 'summary'
>>;

const PROFILES: Record<TemplateId, PdfTemplateProfile> = {
  modern: {
    accent: '#0f766e',
    accentSoft: '#e8f7f4',
    text: '#172126',
    muted: '#526168',
    border: '#cad8d8',
    fontFamily: 'Inter',
    displayFontFamily: 'Inter',
    headerLayout: 'line',
    headingLayout: 'rule',
    entryLayout: 'rail',
    skillsLayout: 'chips',
    pageRail: true,
  },
  minimal: {
    accent: '#111111',
    accentSoft: '#f5f5f5',
    text: '#111111',
    muted: '#555555',
    border: '#c7c7c7',
    fontFamily: 'Inter',
    displayFontFamily: 'Merriweather',
    headerLayout: 'centered',
    headingLayout: 'inline',
    entryLayout: 'compact',
    skillsLayout: 'inline',
    centeredHeader: true,
    nameScale: 1.02,
    spacingScale: 1.3,
    pageInset: 7,
  },
  corporate: {
    accent: '#17436b',
    accentSoft: '#edf4f9',
    text: '#172033',
    muted: '#526176',
    border: '#bdcad6',
    headerBackground: '#17436b',
    headerText: '#ffffff',
    fontFamily: 'Aptos',
    displayFontFamily: 'Aptos',
    headerLayout: 'band',
    headingLayout: 'block',
    entryLayout: 'plain',
    skillsLayout: 'rows',
  },
  executive: {
    accent: '#315b4a',
    accentSoft: '#eef5f1',
    text: '#1f2d27',
    muted: '#596761',
    border: '#aebdb6',
    fontFamily: 'Merriweather',
    displayFontFamily: 'Merriweather',
    headerLayout: 'editorial',
    headingLayout: 'double',
    entryLayout: 'editorial',
    skillsLayout: 'grid',
    centeredHeader: true,
    nameScale: 1.12,
    sectionScale: 1.08,
    spacingScale: 1.1,
    pageInset: 3,
    specialty: 'executive',
  },
  creative: {
    accent: '#0f8c80',
    accentSoft: '#e4f5f2',
    text: '#13282b',
    muted: '#52666a',
    border: '#a9cbc6',
    headerBackground: '#10282d',
    headerText: '#ffffff',
    fontFamily: 'Inter',
    displayFontFamily: 'Inter',
    headerLayout: 'rail',
    headingLayout: 'label',
    entryLayout: 'card',
    skillsLayout: 'chips',
    pageRail: true,
    projectEmphasis: true,
    nameScale: 1.08,
    photoPolicy: 'preferred',
  },
  atsFriendly: {
    accent: '#111111',
    accentSoft: '#ffffff',
    text: '#111111',
    muted: '#3f3f3f',
    border: '#6f6f6f',
    fontFamily: 'Arial',
    headerLayout: 'line',
    headingLayout: 'rule',
    entryLayout: 'compact',
    skillsLayout: 'rows',
    dense: true,
    nameScale: 0.9,
    sectionScale: 0.94,
    photoPolicy: 'never',
  },
  softwareEngineer: {
    accent: '#0f766e',
    accentSoft: '#edf8f6',
    text: '#152421',
    muted: '#4c625e',
    border: '#b7d0cb',
    headerBackground: '#10211f',
    headerText: '#f4fffc',
    fontFamily: 'Inter',
    displayFontFamily: 'Inter',
    headerLayout: 'technical',
    headingLayout: 'block',
    entryLayout: 'rail',
    skillsLayout: 'grid',
    dense: true,
    projectEmphasis: true,
    specialty: 'developer',
  },
  student: {
    accent: '#5b4a87',
    accentSoft: '#f2eff8',
    text: '#272236',
    muted: '#655e73',
    border: '#cec6dc',
    fontFamily: 'Inter',
    displayFontFamily: 'Merriweather',
    headerLayout: 'centered',
    headingLayout: 'label',
    entryLayout: 'card',
    skillsLayout: 'chips',
    centeredHeader: true,
    photoRound: true,
    projectEmphasis: true,
    specialty: 'academic',
  },
  startup: {
    accent: '#9a4a08',
    accentSoft: '#fff3e5',
    text: '#29241e',
    muted: '#6b6258',
    border: '#dac8b5',
    fontFamily: 'Inter',
    displayFontFamily: 'Inter',
    headerLayout: 'rail',
    headingLayout: 'block',
    entryLayout: 'card',
    skillsLayout: 'inline',
    pageRail: true,
    dense: true,
    nameScale: 1.04,
    specialty: 'startup',
  },
  designer: {
    accent: '#9b7a4c',
    accentSoft: '#f1f0ed',
    text: '#17202a',
    muted: '#59636d',
    border: '#c7c9c7',
    headerBackground: '#17202a',
    headerText: '#f8f6f1',
    fontFamily: 'Inter',
    displayFontFamily: 'Inter',
    headerLayout: 'band',
    headingLayout: 'label',
    entryLayout: 'compact',
    skillsLayout: 'rows',
    dense: true,
    projectEmphasis: true,
    nameScale: 1.18,
    sectionScale: 0.94,
    bodyLayout: 'portfolio',
    photoPolicy: 'optional',
  },
  dataAnalyst: {
    accent: '#08717b',
    accentSoft: '#e7f4f5',
    text: '#17272a',
    muted: '#52666a',
    border: '#b5d2d5',
    fontFamily: 'Inter',
    displayFontFamily: 'Inter',
    headerLayout: 'technical',
    headingLayout: 'block',
    entryLayout: 'rail',
    skillsLayout: 'grid',
    photoRound: true,
    dense: true,
    projectEmphasis: true,
    specialty: 'analytics',
  },
  classic: {
    accent: '#343434',
    accentSoft: '#f4f2ee',
    text: '#222222',
    muted: '#626262',
    border: '#aaa49a',
    fontFamily: 'Merriweather',
    displayFontFamily: 'Merriweather',
    headerLayout: 'editorial',
    headingLayout: 'double',
    entryLayout: 'editorial',
    skillsLayout: 'rows',
    centeredHeader: true,
    nameScale: 1.04,
    spacingScale: 1.1,
    pageInset: 3,
  },
};

const DEFAULT_COMPACTION: TemplateCompactionProfile = {
  spacing: 0.9,
  header: 0.82,
  heading: 0.82,
  entry: 0.8,
  project: 0.75,
  skills: 0.75,
  achievement: 0.75,
  sidebar: 0.8,
  columns: 0.8,
  summary: 0.8,
  pageInset: 0,
  entryPresence: 18,
  sectionPresence: 24,
  headingPresence: 18,
};

const TEMPLATE_COMPACTION: Partial<Record<TemplateId, Partial<TemplateCompactionProfile>>> = {
  atsFriendly: {
    spacing: 0.88,
    entryPresence: 12,
    sectionPresence: 18,
    headingPresence: 14,
  },
  modern: { skills: 0.52 },
  corporate: { header: 0.68, heading: 0.68 },
  student: { entry: 0.58, project: 0.52, skills: 0.52 },
  softwareEngineer: { project: 0.52, skills: 0.56, heading: 0.72 },
  startup: { entry: 0.58, project: 0.58, achievement: 0.52 },
  dataAnalyst: { project: 0.52, skills: 0.52, heading: 0.72 },
  executive: { spacing: 0.78, heading: 0.7, summary: 0.58, pageInset: 0 },
  classic: { spacing: 0.8, heading: 0.72, pageInset: 0 },
  minimal: { spacing: 0.7, pageInset: 0 },
  designer: {
    entry: 0.58,
    project: 0.52,
    skills: 0.5,
    sidebar: 0.55,
    columns: 0.62,
  },
  creative: { entry: 0.58, project: 0.52, skills: 0.52 },
};

const FORCE_COMPACTION: Record<TemplateId, ForceCompressionProfile> = {
  atsFriendly: {},
  modern: { skills: 0.5 },
  corporate: { header: 0.64, heading: 0.6 },
  student: { entry: 0.58, project: 0.52 },
  softwareEngineer: { skills: 0.55, project: 0.52 },
  startup: { achievement: 0.5, project: 0.52 },
  dataAnalyst: { skills: 0.5, project: 0.52 },
  executive: { summary: 0.5, heading: 0.58 },
  classic: { spacing: 0.62 },
  minimal: { spacing: 0.58 },
  designer: { sidebar: 0.5, skills: 0.52, columns: 0.5 },
  creative: { entry: 0.58, project: 0.52, skills: 0.52 },
};

const SINGLE_PAGE_LAYOUTS = [
  {
    pagePadding: 27,
    bodyFont: resumeTypography.body,
    lineHeight: 1.24,
    sectionGap: 6,
    itemGap: 3,
  },
  {
    pagePadding: 24,
    bodyFont: resumeTypography.body,
    lineHeight: 1.21,
    sectionGap: 5.3,
    itemGap: 2.8,
  },
  {
    pagePadding: 21,
    bodyFont: resumeTypography.body,
    lineHeight: 1.18,
    sectionGap: 4.6,
    itemGap: 2.4,
  },
  {
    pagePadding: 18,
    bodyFont: resumeTypography.body,
    lineHeight: 1.15,
    sectionGap: 4,
    itemGap: 2,
  },
] as const;

const buildStyles = (
  templateId: TemplateId,
  profile: PdfTemplateProfile,
  mode: ResumePdfMode,
  requestedCompactLevel: number
) => {
  const forceMode = requestedCompactLevel === FORCE_SINGLE_PAGE_PROFILE;
  const compactLevel = forceMode
    ? SINGLE_PAGE_MAX_COMPACT_LEVEL
    : Math.max(0, Math.min(SINGLE_PAGE_MAX_COMPACT_LEVEL, requestedCompactLevel));
  const singlePageLayout = SINGLE_PAGE_LAYOUTS[compactLevel];
  const compactProgress = mode === 'single'
    ? compactLevel / SINGLE_PAGE_MAX_COMPACT_LEVEL
    : 0;
  const compactProfile = {
    ...DEFAULT_COMPACTION,
    ...TEMPLATE_COMPACTION[templateId],
  };
  const templatePlan = resumeTemplatePlans[templateId];
  const compactFactor = (target: number) => 1 - (1 - target) * compactProgress;
  const forceProfile = FORCE_COMPACTION[templateId];
  const forceFactor = (key: keyof ForceCompressionProfile) =>
    forceMode ? forceProfile[key] ?? 1 : 1;
  const denseFactor =
    (profile.dense ? 0.92 : (profile.spacingScale || 1)) *
    compactFactor(compactProfile.spacing) *
    forceFactor('spacing');
  const pagePadding =
    (mode === 'single' ? singlePageLayout.pagePadding : 30) +
    (profile.pageInset || 0) * compactFactor(compactProfile.pageInset);
  const bodyFont = mode === 'single' ? singlePageLayout.bodyFont : resumeTypography.body;
  const lineHeight = mode === 'single'
    ? singlePageLayout.lineHeight
    : profile.dense
      ? 1.17
      : resumeSpacing.lineHeight;
  const sectionGap = (mode === 'single' ? singlePageLayout.sectionGap : 6) * denseFactor;
  const itemGap = (mode === 'single' ? singlePageLayout.itemGap : 3) * denseFactor;
  const headerFactor = compactFactor(compactProfile.header) * forceFactor('header');
  const headingFactor = compactFactor(compactProfile.heading) * forceFactor('heading');
  const entryFactor = compactFactor(compactProfile.entry) * forceFactor('entry');
  const projectFactor = compactFactor(compactProfile.project) * forceFactor('project');
  const skillsFactor = compactFactor(compactProfile.skills) * forceFactor('skills');
  const achievementFactor =
    compactFactor(compactProfile.achievement) * forceFactor('achievement');
  const sidebarFactor = compactFactor(compactProfile.sidebar) * forceFactor('sidebar');
  const columnFactor = compactFactor(compactProfile.columns) * forceFactor('columns');
  const summaryFactor = compactFactor(compactProfile.summary) * forceFactor('summary');
  const isBand = ['corporate', 'technical', 'analytical', 'portfolio'].includes(
    templatePlan.header
  );
  const isEditorial = ['executive', 'editorial', 'minimal'].includes(
    templatePlan.header
  );
  const isRailHeader = ['creative', 'impact'].includes(templatePlan.header);
  const headingScale = profile.sectionScale || 1;
  const headingBlock = ['corporate', 'technical', 'analytical', 'impact'].includes(
    templatePlan.header
  );
  const headingLabel = ['academic', 'creative', 'portfolio'].includes(
    templatePlan.header
  );
  const headingInline = templatePlan.header === 'minimal';
  const headingDouble = ['executive', 'editorial'].includes(templatePlan.header);
  const entryCard = templatePlan.entry === 'card';
  const entryRail = templatePlan.entry === 'rail';
  const entryCompact = templatePlan.entry === 'compact';

  return StyleSheet.create({
    page: {
      paddingTop: pagePadding,
      paddingRight: pagePadding,
      paddingBottom: pagePadding,
      paddingLeft: pagePadding + (profile.pageRail ? 5 : 0),
      borderLeftWidth: profile.pageRail ? 4 : 0,
      borderLeftColor: profile.accent,
      backgroundColor: '#ffffff',
      color: profile.text,
      fontFamily: profile.fontFamily,
      fontSize: bodyFont,
      lineHeight,
    },
    header: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: profile.centeredHeader ? 'center' : 'flex-start',
      justifyContent: profile.centeredHeader ? 'center' : 'space-between',
      gap: (mode === 'single' ? 8 : 12) * headerFactor,
      marginBottom: (mode === 'single' ? Math.max(5, 9 - compactLevel) : 13) * headerFactor,
      paddingTop: (isBand ? (mode === 'single' ? 9 : 13) : isEditorial ? 3 : 0) * headerFactor,
      paddingRight: (
        isBand ? (mode === 'single' ? 10 : 14) : isRailHeader ? resumeAlignment.railHeaderInset : 0
      ) * headerFactor,
      paddingBottom: isBand
        ? (mode === 'single' ? 9 : 13) * headerFactor
        : isEditorial
          ? (mode === 'single' ? 6 : 9) * headerFactor
          : (mode === 'single' ? Math.max(5, 7 - compactLevel) : 10) * headerFactor,
      paddingLeft: (
        isBand ? (mode === 'single' ? 10 : 14) : isRailHeader ? resumeAlignment.railHeaderInset : 0
      ) * headerFactor,
      borderLeftWidth: isRailHeader ? 5 : 0,
      borderLeftColor: profile.accent,
      borderTopWidth: isEditorial ? 1.5 : 0,
      borderBottomWidth: isBand ? 0 : isEditorial ? 1.5 : 1.5,
      borderTopColor: profile.accent,
      borderBottomColor: profile.accent,
      backgroundColor: profile.headerBackground || '#ffffff',
      color: profile.headerText || profile.text,
    },
    headerCopy: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 0,
      alignItems: profile.centeredHeader ? 'center' : 'flex-start',
      textAlign: profile.centeredHeader ? 'center' : 'left',
    },
    name: {
      maxWidth: '100%',
      fontSize: (
        mode === 'single'
          ? Math.max(18, resumeTypography.name - compactLevel * 0.3)
          : resumeTypography.name
      ) * (profile.nameScale || 1),
      lineHeight: 1.02,
      fontWeight: 700,
      fontFamily: profile.displayFontFamily || profile.fontFamily,
      letterSpacing: isEditorial ? 0.6 : -0.3,
      textTransform: ['technical', 'analytical'].includes(templatePlan.header)
        ? 'uppercase'
        : 'none',
      color: profile.headerText || profile.text,
    },
    title: {
      maxWidth: '100%',
      marginTop: mode === 'single' ? 3 : 4,
      fontSize: resumeTypography.title,
      lineHeight: 1.2,
      fontWeight: isEditorial ? 400 : 600,
      fontFamily: profile.fontFamily,
      letterSpacing: isEditorial ? 0.5 : 0,
      color: profile.headerText || profile.accent,
    },
    contactRow: {
      display: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: profile.centeredHeader ? 'center' : 'flex-start',
      gap: mode === 'single' ? 5 : 6,
      marginTop: (mode === 'single' ? Math.max(2, 4 - compactLevel * 0.5) : 5) * headerFactor,
      maxWidth: '100%',
    },
    contactItem: {
      fontSize: resumeTypography.metadata,
      lineHeight: 1.15,
      color: profile.headerText || profile.muted,
    },
    contactSeparator: {
      fontSize: resumeTypography.metadata,
      lineHeight: 1.15,
      color: profile.headerText || profile.muted,
    },
    inlineLinks: {
      display: 'flex',
      flexDirection: 'row',
      flexWrap: 'nowrap',
      flexShrink: 0,
      justifyContent: 'flex-end',
      gap: mode === 'single' ? 5 : 6,
      maxWidth: '100%',
    },
    link: {
      color: profile.headerText || profile.accent,
      textDecoration: 'underline',
      fontWeight: 600,
      fontSize: resumeTypography.metadata,
      lineHeight: 1.15,
    },
    entryLink: {
      color: profile.accent,
      textDecoration: 'underline',
      fontWeight: 600,
      fontSize: resumeTypography.metadata,
      lineHeight: 1.15,
    },
    photo: {
      width: mode === 'single' ? Math.max(40, 50 - compactLevel * 3) : 58,
      height: mode === 'single' ? Math.max(40, 50 - compactLevel * 3) : 58,
      borderRadius: profile.photoRound ? 999 : isEditorial ? 0 : 5,
      objectFit: 'cover',
      borderWidth: isBand ? 1.5 : 1,
      borderColor: profile.headerText || profile.accent,
      flexShrink: 0,
      alignSelf: 'flex-start',
    },
    section: {
      marginBottom: sectionGap,
    },
    terminalSection: {
      marginBottom: 0,
    },
    sectionLead: {
      marginBottom: itemGap,
    },
    sectionHeading: {
      alignSelf: headingLabel || headingInline ? 'flex-start' : 'stretch',
      marginBottom: headingInline ? 1 : 0,
      paddingTop: (headingBlock ? 3 : headingLabel ? 2 : 0) * headingFactor,
      paddingRight: (headingBlock ? 5 : headingLabel ? 6 : 0) * headingFactor,
      paddingBottom: (
        headingBlock ? 3 : headingLabel ? 2 : Math.max(1.5, 2.5 - compactLevel * 0.25)
      ) * headingFactor,
      paddingLeft: (headingBlock ? 5 : headingLabel ? 6 : 0) * headingFactor,
      borderTopWidth: headingDouble ? 0.8 : 0,
      borderBottomWidth: headingInline || headingLabel ? 0 : headingDouble ? 0.8 : 0.8,
      borderTopColor: profile.border,
      borderBottomColor: profile.border,
      backgroundColor: headingBlock ? profile.accent : headingLabel ? profile.accentSoft : '#ffffff',
      color: headingBlock ? (profile.headerText || '#ffffff') : profile.accent,
      fontSize: resumeTypography.sectionHeader * headingScale,
      fontWeight: 700,
      fontFamily: profile.displayFontFamily || profile.fontFamily,
      letterSpacing: headingInline ? 0.2 : 0.65,
      textTransform: headingInline || isEditorial ? 'none' : 'uppercase',
    },
    summary: {
      marginTop: itemGap,
      color: profile.text,
    },
    entry: {
      marginBottom: entryCompact ? itemGap * 0.72 : itemGap,
      paddingTop: (entryCard ? 5 : entryRail ? 1 : 0) * entryFactor,
      paddingRight: (entryCard ? 6 : 0) * entryFactor,
      paddingBottom: (entryCard ? 5 : 0) * entryFactor,
      paddingLeft: (entryCard ? 6 : entryRail ? 7 : 0) * entryFactor,
      borderLeftWidth: entryRail ? 1.5 : 0,
      borderLeftColor: profile.accent,
      borderBottomWidth: templatePlan.entry === 'editorial' ? 0.5 : 0,
      borderBottomColor: profile.border,
      backgroundColor: entryCard ? profile.accentSoft : '#ffffff',
    },
    projectEntry: {
      marginBottom: entryCompact ? itemGap * 0.72 : itemGap,
      paddingTop: (profile.projectEmphasis ? 6 : entryCard ? 5 : 0) * projectFactor,
      paddingRight: (profile.projectEmphasis ? 7 : entryCard ? 6 : 0) * projectFactor,
      paddingBottom: (profile.projectEmphasis ? 6 : entryCard ? 5 : 0) * projectFactor,
      paddingLeft: (
        profile.projectEmphasis ? 7 : entryCard ? 6 : entryRail ? 7 : 0
      ) * projectFactor,
      borderWidth: profile.projectEmphasis ? 0.8 : 0,
      borderLeftWidth: entryRail && !profile.projectEmphasis ? 1.5 : profile.projectEmphasis ? 0.8 : 0,
      borderColor: profile.border,
      backgroundColor: profile.projectEmphasis || entryCard ? profile.accentSoft : '#ffffff',
    },
    entryTop: {
      display: 'flex',
      flexDirection: templatePlan.bodyLayout === 'sidebar' ? 'column' : 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      flexWrap: 'wrap',
      gap: templatePlan.bodyLayout === 'sidebar' ? 1 : 6,
    },
    entryTitle: {
      flexGrow: templatePlan.bodyLayout === 'sidebar' ? 0 : 1,
      flexShrink: 1,
      flexBasis: templatePlan.bodyLayout === 'sidebar' ? 'auto' : 0,
      minWidth: 0,
      fontWeight: 700,
      fontFamily: profile.displayFontFamily || profile.fontFamily,
      color: profile.text,
      fontSize: resumeTypography.entryTitle,
    },
    date: {
      flexShrink: 0,
      maxWidth: '100%',
      alignSelf: templatePlan.bodyLayout === 'sidebar' ? 'flex-end' : 'auto',
      marginLeft: templatePlan.bodyLayout === 'sidebar' ? 0 : 8,
      textAlign: 'right',
      color: profile.muted,
      fontSize: resumeTypography.date,
    },
    meta: {
      marginTop: 1,
      color: profile.muted,
      fontSize: resumeTypography.metadata,
      fontStyle: templatePlan.entry === 'editorial' ? 'italic' : 'normal',
    },
    metadata: {
      marginTop: 1,
      color: profile.muted,
      fontSize: resumeTypography.metadata,
      fontStyle: templatePlan.entry === 'editorial' ? 'italic' : 'normal',
    },
    entryDetailRow: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 4,
      marginTop: 1.5,
      flexWrap: 'wrap',
    },
    entryDetailMeta: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 0,
      color: profile.muted,
      fontSize: resumeTypography.metadata,
      fontStyle: profile.entryLayout === 'editorial' ? 'italic' : 'normal',
    },
    projectHeader: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      width: '100%',
      gap: 6,
    },
    projectHeaderMeta: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      maxWidth: '42%',
      flexShrink: 0,
    },
    projectLinks: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'flex-end',
      flexWrap: 'wrap',
      width: '100%',
      marginTop: 1,
    },
    projectLinkItem: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'flex-end',
      maxWidth: '100%',
      marginLeft: 4,
    },
    projectLink: {
      maxWidth: '100%',
      flexShrink: 1,
      color: profile.accent,
      textDecoration: 'underline',
      fontWeight: 600,
      fontSize: resumeTypography.metadata,
      lineHeight: 1.25,
      textAlign: 'right',
    },
    projectTech: {
      width: '100%',
      marginTop: 2,
      marginBottom: 0.5,
      color: profile.muted,
      fontSize: resumeTypography.metadata,
      lineHeight: 1.3,
      fontStyle: profile.entryLayout === 'editorial' ? 'italic' : 'normal',
    },
    projectDescription: {
      width: '100%',
      marginTop: entryCompact ? 1.5 : 2.5,
      color: profile.text,
      fontSize: resumeTypography.body,
      lineHeight: 1.28,
    },
    description: {
      marginTop: entryCompact ? 1.5 : 2.5,
      color: profile.text,
      fontSize: resumeTypography.body,
      lineHeight: 1.24,
    },
    skillRows: {
      marginTop: (
        templatePlan.bodyLayout === 'sidebar'
          ? resumeAlignment.sidebarHeadingContentGap
          : resumeAlignment.headingContentGap
      ) * skillsFactor,
    },
    skillRow: {
      display: 'flex',
      flexDirection: 'row',
      marginTop: 2 * skillsFactor,
      paddingBottom: (templatePlan.skills === 'rows' ? 0.6 : 0) * skillsFactor,
      borderBottomWidth: 0,
      borderBottomColor: profile.border,
    },
    skillLabel: {
      width: mode === 'single' ? 108 : 116,
      fontWeight: 700,
      color: profile.text,
      fontSize: resumeTypography.body,
    },
    skillValues: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 0,
      color: profile.muted,
      fontWeight: 400,
      fontSize: resumeTypography.body,
      lineHeight: 1.22,
    },
    compactSkillGrid: {
      display: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 3 * skillsFactor,
      marginTop: (
        templatePlan.bodyLayout === 'sidebar'
          ? resumeAlignment.sidebarHeadingContentGap
          : resumeAlignment.headingContentGap
      ) * skillsFactor,
    },
    compactSkillGroup: {
      width: '48.5%',
      display: 'flex',
      flexDirection: 'row',
      gap: 3 * skillsFactor,
      paddingBottom: 1 * skillsFactor,
    },
    listItem: {
      display: 'flex',
      flexDirection: 'row',
      marginTop: 2,
      gap: 4,
    },
    bullet: {
      color: profile.accent,
    },
    bodyColumns: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: (mode === 'single' ? 10 : 14) * columnFactor,
    },
    portfolioSidebar: {
      width: '31%',
      paddingTop: resumeAlignment.sidebarTopPadding * sidebarFactor,
      paddingRight: 8 * sidebarFactor,
      paddingBottom: 7 * sidebarFactor,
      paddingLeft: 8 * sidebarFactor,
      borderWidth: templateId === 'designer' ? 0 : 0.8,
      borderTopWidth: templateId === 'designer' ? 3 : 0.8,
      borderColor: profile.border,
      borderTopColor: profile.accent,
      backgroundColor: templateId === 'designer' ? '#e5e7e6' : profile.accentSoft,
    },
    portfolioMain: {
      width: '69%',
      paddingLeft: 2 * columnFactor,
    },
    designerContact: {
      marginBottom: sectionGap,
      paddingBottom: 5 * sidebarFactor,
      borderBottomWidth: 0.7,
      borderBottomColor: profile.border,
    },
    designerContactLine: {
      marginTop: 2,
      color: profile.muted,
      fontSize: resumeTypography.metadata,
      lineHeight: 1.25,
    },
    executiveSummary: {
      marginBottom: sectionGap,
      paddingTop: 7 * summaryFactor,
      paddingRight: 10 * summaryFactor,
      paddingBottom: 7 * summaryFactor,
      paddingLeft: 10 * summaryFactor,
      borderTopWidth: 0.8,
      borderBottomWidth: 0.8,
      borderColor: profile.border,
      backgroundColor: '#ffffff',
      fontFamily: profile.displayFontFamily || profile.fontFamily,
      fontSize: bodyFont + 0.5,
      lineHeight: 1.42,
      textAlign: 'center',
    },
  });
};

function ResumePdfDocument({
  resume,
  templateId,
  mode,
  profilePhoto,
  compactLevel = 0,
  onRender,
}: ResumePdfDocumentProps) {
  const profile = PROFILES[templateId];
  const forceMode = compactLevel === FORCE_SINGLE_PAGE_PROFILE;
  const styles = buildStyles(templateId, profile, mode, compactLevel);
  const compactProgress = mode === 'single'
    ? forceMode
      ? 1
      : Math.max(0, Math.min(SINGLE_PAGE_MAX_COMPACT_LEVEL, compactLevel)) /
        SINGLE_PAGE_MAX_COMPACT_LEVEL
    : 0;
  const compactProfile = {
    ...DEFAULT_COMPACTION,
    ...TEMPLATE_COMPACTION[templateId],
  };
  const interpolatePresence = (natural: number, compact: number) =>
    Math.round(natural - (natural - compact) * compactProgress);
  const pagination: PaginationPolicy = {
    entry: forceMode ? 8 : interpolatePresence(32, compactProfile.entryPresence),
    section: forceMode ? 12 : interpolatePresence(40, compactProfile.sectionPresence),
    heading: forceMode ? 10 : interpolatePresence(32, compactProfile.headingPresence),
    achievement: forceMode ? 8 : interpolatePresence(24, 12),
    orphans: forceMode ? 3 : compactLevel >= 2 && mode === 'single' ? 2 : 3,
    widows: forceMode ? 3 : compactLevel >= 2 && mode === 'single' ? 2 : 3,
  };
  const hiddenSections = new Set(resume.hiddenSections || []);
  const customSections = new Map(resume.customSections.map(section => [section.id, section]));
  const requestedSectionOrder = resolveResumeSectionOrder(resume, templateId);
  const plan = resumeTemplatePlans[templateId];
  const sectionOrder = resume.sectionOrderMode === 'custom'
    ? requestedSectionOrder
    : [
        ...plan.sectionOrder,
        ...requestedSectionOrder.filter(sectionId => !plan.sectionOrder.includes(sectionId)),
      ];
  const normalized = normalizeResumeData(resume);
  const primitiveStyles = styles as unknown as ResumePrimitiveStyles;
  const photoSource = resume.personalDetails.profilePhoto?.trim() || profilePhoto?.trim() || '';
  const usePhoto =
    profile.photoPolicy !== 'never' &&
    resume.useProfilePhoto !== false &&
    Boolean(photoSource);
  const details = resume.personalDetails;
  const resolvedHeading = (sectionKey: StandardSectionKey, fallback?: string) =>
    resolveSectionHeading(sectionKey, resume.sectionConfig, fallback);
  const resolvedLinkMode = (sectionKey: StandardSectionKey) =>
    resolveLinkDisplayMode(
      { linkDisplayMode: resume.linkDisplayMode, linkSettings: resume.linkSettings },
      resume.sectionConfig[sectionKey]
    );

  const hasSectionContent = (sectionId: string) => {
    if (hiddenSections.has(sectionId)) return false;
    const customSection = customSections.get(sectionId);
    if (customSection) return customSection.items.length > 0;

    switch (sectionId) {
      case 'summary': return Boolean(resume.summary);
      case 'experience': return resume.experience.length > 0;
      case 'internships': return (resume.internships || []).length > 0;
      case 'education': return resume.education.length > 0;
      case 'projects': return resume.projects.length > 0;
      case 'certifications': return resume.certifications.length > 0;
      case 'skills': return Object.values(resume.skills).some(values => values.length > 0);
      case 'achievements': return resume.achievements.length > 0;
      case 'volunteering': return resume.volunteering.length > 0;
      case 'languages': return resume.languages.length > 0;
      default: return false;
    }
  };

  const renderEntrySection = (
    title: string,
    items: React.ReactNode[],
    terminal: boolean
  ) => {
    if (items.length === 0) return null;
    return (
      <View
        key={title}
        style={[styles.section, terminal ? styles.terminalSection : null]}
      >
        <View
          style={styles.sectionLead}
          wrap={false}
          minPresenceAhead={pagination.section}
        >
          <Text style={styles.sectionHeading}>{title}</Text>
        </View>
        {items}
      </View>
    );
  };

  const renderSection = (sectionId: string, terminal = false) => {
    if (hiddenSections.has(sectionId)) return null;
    const useTerminalStyle = terminal;
    const customSection = customSections.get(sectionId);
    if (customSection) {
      const customEntries: ResumeExperience[] = customSection.items.map(item => ({
        id: item.id,
        role: item.title,
        company: item.subtitle || '',
        location: '',
        date: item.date || '',
        bullets: item.description ? [item.description] : [],
      }));
      return (
        <View
          key={sectionId}
          style={[styles.section, useTerminalStyle ? styles.terminalSection : null]}
        >
          <Text style={styles.sectionHeading}>{customSection.title}</Text>
          {customEntries.map(entry => (
            <ExperienceBlock
              key={entry.id}
              experience={entry}
              styles={primitiveStyles}
              pagination={pagination}
            />
          ))}
        </View>
      );
    }

    switch (sectionId) {
      case 'summary':
        return (
          <SummaryBlock
            key={sectionId}
            summary={resume.summary}
            heading={resolvedHeading('summary')}
            plan={plan}
            styles={primitiveStyles}
            pagination={pagination}
            terminal={useTerminalStyle}
          />
        );
      case 'experience':
        return renderEntrySection(
          resolvedHeading('experience'),
          normalized.experience.map(entry => (
            <ExperienceBlock
              key={entry.id}
              experience={entry}
              styles={primitiveStyles}
              pagination={pagination}
            />
          )),
          useTerminalStyle
        );
      case 'internships':
        return renderEntrySection(
          resolvedHeading('internships'),
          normalized.internships.map(entry => (
            <ExperienceBlock
              key={entry.id}
              experience={entry}
              styles={primitiveStyles}
              pagination={pagination}
            />
          )),
          useTerminalStyle
        );
      case 'education':
        return renderEntrySection(
          resolvedHeading('education'),
          normalized.education.map(entry => (
            <EducationBlock
              key={entry.id}
              education={entry}
              styles={primitiveStyles}
              pagination={pagination}
            />
          )),
          useTerminalStyle
        );
      case 'projects':
        return renderEntrySection(
          resolvedHeading('projects', plan.projectEmphasis === 'primary' ? 'Selected Projects' : 'Projects'),
          normalized.projects.map(project => (
            <ProjectBlock
              key={project.id}
              project={project}
              linkDisplayMode={resolvedLinkMode('projects')}
              styles={primitiveStyles}
              pagination={pagination}
              emphasized={plan.projectEmphasis === 'primary'}
            />
          )),
          useTerminalStyle
        );
      case 'certifications':
        return renderEntrySection(
          resolvedHeading('certifications'),
          normalized.certifications.map(certification => (
            <CertificationBlock
              key={certification.id}
              certification={certification}
              linkDisplayMode={resolvedLinkMode('certifications')}
              styles={primitiveStyles}
              pagination={pagination}
            />
          )),
          useTerminalStyle
        );
      case 'skills':
        return (
          <SkillsBlock
            key={sectionId}
            skills={normalized.skills}
            heading={resolvedHeading('skills')}
            variant={plan.skills}
            styles={primitiveStyles}
            pagination={pagination}
            terminal={useTerminalStyle}
          />
        );
      case 'achievements':
        return renderEntrySection(
          resolvedHeading('achievements', plan.family === 'business' ? 'Impact' : 'Achievements'),
          normalized.achievements.map(achievement => (
            <AchievementBullet
              key={achievement.id}
              achievement={achievement}
              styles={primitiveStyles}
            />
          )),
          useTerminalStyle
        );
      case 'volunteering':
        return renderEntrySection(
          resolvedHeading('volunteering'),
          normalized.volunteering.map(entry => (
            <ExperienceBlock
              key={entry.id}
              experience={entry}
              styles={primitiveStyles}
              pagination={pagination}
            />
          )),
          useTerminalStyle
        );
      case 'languages':
        return resume.languages.length > 0 ? (
          <View
            key={sectionId}
            style={[styles.section, styles.terminalSection]}
            wrap={false}
          >
            <Text style={styles.sectionHeading}>{resolvedHeading('languages')}</Text>
            <Text style={styles.skillValues}>{resume.languages.join(', ')}</Text>
          </View>
        ) : null;
      default:
        return null;
    }
  };

  const renderBody = () => {
    const visibleOrder = sectionOrder.filter(hasSectionContent);
    if (plan.bodyLayout !== 'sidebar') {
      return visibleOrder.map((sectionId, index) =>
        renderSection(sectionId, index === visibleOrder.length - 1)
      );
    }

    const sidebarSections = new Set(['skills', 'education', 'certifications', 'languages']);
    const sidebarOrder = visibleOrder.filter(sectionId => sidebarSections.has(sectionId));
    const mainOrder = visibleOrder.filter(sectionId => !sidebarSections.has(sectionId));
    return (
      <View style={styles.bodyColumns}>
        <View style={styles.portfolioSidebar}>
          {templateId === 'designer' && (
            <View style={styles.designerContact} wrap={false}>
              <Text style={styles.sectionHeading}>Contact</Text>
              {[details.email, details.phone, details.location].filter(Boolean).map(value => (
                <Text key={value} style={styles.designerContactLine}>{value}</Text>
              ))}
              {[
                ['LinkedIn', details.linkedin],
                ['GitHub', details.github],
                ['Portfolio', details.website],
              ].filter(([, value]) => Boolean(value)).map(([label, value]) => (
                <Link key={label} src={/^https?:\/\//i.test(value) ? value : `https://${value}`} style={styles.designerContactLine}>{label}</Link>
              ))}
            </View>
          )}
          {sidebarOrder.map((sectionId, index) =>
            renderSection(sectionId, index === sidebarOrder.length - 1)
          )}
        </View>
        <View style={styles.portfolioMain}>
          {mainOrder.map((sectionId, index) =>
            renderSection(sectionId, index === mainOrder.length - 1)
          )}
        </View>
      </View>
    );
  };

  return (
    <Document
      title={resume.title || `${details.fullName || 'Forge Resume'} Resume`}
      author={details.fullName || 'Forge Resume'}
      subject="Professional resume"
      creator="Forge Resume"
      pageLayout="singlePage"
      onRender={result => {
        const renderResult = result as typeof result & {
          _INTERNAL__LAYOUT__DATA_?: { children?: unknown[] };
        };
        onRender?.({
          pageCount: Math.max(1, renderResult._INTERNAL__LAYOUT__DATA_?.children?.length || 1),
        });
      }}
    >
      <Page size="A4" style={styles.page} wrap>
        <HeaderBlock
          details={details}
          linkDisplayMode={resolvedLinkMode('summary')}
          photoSource={photoSource}
          usePhoto={usePhoto}
          styles={primitiveStyles}
          showContact={templateId !== 'designer'}
        />
        {renderBody()}
      </Page>
    </Document>
  );
}

export default React.memo(ResumePdfDocument);
