import type React from 'react';
import { Link, Text, View } from '@react-pdf/renderer';

export type PdfViewStyle = React.ComponentProps<typeof View>['style'];
export type PdfTextStyle = React.ComponentProps<typeof Text>['style'];
export type PdfLinkStyle = React.ComponentProps<typeof Link>['style'];

export interface ResumePrimitiveStyles {
  section: PdfViewStyle;
  terminalSection: PdfViewStyle;
  sectionLead: PdfViewStyle;
  sectionHeading: PdfTextStyle;
  summary: PdfTextStyle;
  executiveSummary: PdfTextStyle;
  entry: PdfViewStyle;
  projectEntry: PdfViewStyle;
  entryTop: PdfViewStyle;
  entryTitle: PdfTextStyle;
  date: PdfTextStyle;
  entryDetailRow: PdfViewStyle;
  entryDetailMeta: PdfTextStyle;
  metadata: PdfTextStyle;
  description: PdfTextStyle;
  inlineLinks: PdfViewStyle;
  entryLink: PdfLinkStyle;
  contactRow: PdfViewStyle;
  contactItem: PdfTextStyle;
  contactSeparator: PdfTextStyle;
  link: PdfLinkStyle;
  header: PdfViewStyle;
  headerCopy: PdfViewStyle;
  name: PdfTextStyle;
  title: PdfTextStyle;
  photo: PdfViewStyle;
  skillRows: PdfViewStyle;
  skillRow: PdfViewStyle;
  skillLabel: PdfTextStyle;
  skillValues: PdfTextStyle;
  compactSkillGrid: PdfViewStyle;
  compactSkillGroup: PdfViewStyle;
  listItem: PdfViewStyle;
  bullet: PdfTextStyle;
}

export interface PaginationPolicy {
  entry: number;
  section: number;
  heading: number;
  achievement: number;
  orphans: number;
  widows: number;
}

export interface LabeledLink {
  label: string;
  url?: string;
}

export const safePdfUrl = (value?: string) => {
  const url = value?.trim();
  if (!url) return '';
  if (/^(?:https?:\/\/|mailto:|tel:)/i.test(url)) return url;
  return `https://${url}`;
};
