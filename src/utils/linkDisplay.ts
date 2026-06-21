import { LinkDisplayMode, ResumeData } from '../types';

export type ResumeLinkKind =
  | 'linkedin'
  | 'github'
  | 'portfolio'
  | 'project-github'
  | 'project-demo'
  | 'certificate'
  | 'custom';

export interface ResumeLinkInput {
  href?: string;
  url?: string;
  label?: string;
  displayMode?: LinkDisplayMode;
  kind?: ResumeLinkKind;
}

export interface ResumeLinkSettingsLike {
  linkDisplayMode?: 'embedded' | 'raw';
  linkSettings?: {
    defaultDisplayMode?: 'embedded' | 'raw';
  };
}

export interface SectionLinkSettingsLike {
  linkDisplayMode?: LinkDisplayMode;
}

export interface FormattedResumeLink {
  label: string;
  url: string;
  displayMode: Exclude<LinkDisplayMode, 'inherit'>;
}

const normalizeUrl = (value?: string) => {
  const url = value?.trim();
  if (!url) return '';
  if (/^(?:https?:\/\/|mailto:|tel:)/i.test(url)) return url;
  return `https://${url}`;
};

const firstMode = (...values: Array<LinkDisplayMode | 'embedded' | 'raw' | undefined>) =>
  values.find((value): value is Exclude<LinkDisplayMode, 'inherit'> => value === 'embedded' || value === 'raw') || 'embedded';

export function resolveLinkDisplayMode(
  globalSettings?: Pick<ResumeData, 'linkDisplayMode' | 'linkSettings'> | ResumeLinkSettingsLike,
  sectionSettings?: SectionLinkSettingsLike | null,
  link?: ResumeLinkInput | null
): Exclude<LinkDisplayMode, 'inherit'> {
  return firstMode(
    link?.displayMode,
    sectionSettings?.linkDisplayMode,
    globalSettings?.linkSettings?.defaultDisplayMode,
    globalSettings?.linkDisplayMode
  );
}

const displayNameFromKind = (kind?: ResumeLinkKind) => {
  switch (kind) {
    case 'linkedin': return 'LinkedIn Profile';
    case 'github': return 'GitHub Profile';
    case 'portfolio': return 'Portfolio';
    case 'project-github': return 'GitHub';
    case 'project-demo': return 'Live Demo';
    case 'certificate': return 'Credential';
    default: return 'Link';
  }
};

export function getLinkLabel(link: ResumeLinkInput, mode: Exclude<LinkDisplayMode, 'inherit'>): string {
  const url = normalizeUrl(link.href || link.url);
  if (mode === 'raw') return url;
  return link.label?.trim() || displayNameFromKind(link.kind) || url;
}

export function formatResumeLink(
  link: ResumeLinkInput | string | null | undefined,
  mode: Exclude<LinkDisplayMode, 'inherit'> = 'embedded'
): FormattedResumeLink | null {
  if (!link) return null;
  const input = typeof link === 'string' ? { href: link } : link;
  const url = normalizeUrl(input.href || input.url);
  if (!url) return null;
  return {
    label: getLinkLabel(input, mode),
    url,
    displayMode: mode,
  };
}

export const safePdfUrl = normalizeUrl;
