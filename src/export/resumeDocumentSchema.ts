/**
 * Export Document Schema
 *
 * Normalized schema shared by all export engines (PDF, DOCX, Image, future Typst).
 * This is the bridge between the Forge Resume model and any renderer.
 *
 * No export engine should depend on React-PDF internals or any UI component directly.
 * All engines consume this normalized schema.
 *
 * @see src/types.ts for the source ResumeData model
 * @see src/schema/resumeSchema.ts for the NormalizedResume model
 */

import type { ResumeData } from '../types';

/**
 * Token-based template descriptor for engine-agnostic rendering.
 * Each export engine maps these tokens to its own primitives.
 */
export interface DocumentTokens {
  pageSize: 'A4';
  pageMargins: { top: number; right: number; bottom: number; left: number };
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  colors: {
    text: string;
    muted: string;
    accent: string;
    background: string;
    border: string;
  };
}

export interface SectionBlock {
  type: 'heading' | 'text' | 'entry' | 'skill-row' | 'bullet-list' | 'link' | 'divider';
  text?: string;
  children?: SectionBlock[];
  metadata?: Record<string, string>;
}

export interface DocumentPage {
  blocks: SectionBlock[];
}

export interface ExportDocument {
  tokens: DocumentTokens;
  pages: DocumentPage[];
}

/**
 * Future Typst adapter will consume this schema:
 *
 * ```ts
 * import { typstRender } from './engines/typstEngine';
 * const doc = buildExportDocument(resume);
 * const pdf = await typstRender(doc);
 * ```
 */
export function buildExportDocument(resume: ResumeData): ExportDocument {
  // Placeholder — all engines currently use their own builders.
  // This function will be the single source of truth once Typst is live.
  // Currently returns a minimal valid document. Engines read ResumeData directly.
  return {
    tokens: {
      pageSize: 'A4',
      pageMargins: { top: 30, right: 30, bottom: 30, left: 30 },
      fontFamily: 'Inter',
      fontSize: 10,
      lineHeight: 1.24,
      colors: { text: '#1a1a2e', muted: '#6c6c8a', accent: '#6c5ce7', background: '#ffffff', border: '#d0d0e0' },
    },
    pages: [{ blocks: [] }],
  };
}

export type { ResumeData };
