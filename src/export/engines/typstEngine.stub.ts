/**
 * Typst Engine Stub
 *
 * Placeholder for future Typst-based PDF rendering.
 *
 * When ready:
 * 1. Add `@typst-community/typst` dependency (or use Typst CLI)
 * 2. Build ExportDocument from resumeDocumentSchema.ts
 * 3. Map template tokens → Typst template files
 * 4. Call typstRender(exportDoc) → returns PDF Blob
 * 5. Replace pdfReactEngine.ts internals with this engine
 *
 * Template tokens to map:
 *   - pageSize: A4
 *   - pageMargins: { top, right, bottom, left }
 *   - fontFamily: Inter, Merriweather, etc.
 *   - fontSize: body text size
 *   - lineHeight: spacing
 *   - colors: { text, muted, accent, background, border }
 *
 * Section blocks to render:
 *   - heading: section headers with styling
 *   - text: body text (summary, descriptions)
 *   - entry: experience/education/project entries with title, subtitle, date, description
 *   - skill-row: grouped skills with category labels
 *   - bullet-list: achievements/bullet points
 *   - link: clickable URLs
 *   - divider: section separators
 *
 * Two-column layout support:
 *   - sidebar (31% width) for contact, skills, education, languages
 *   - main (69% width) for summary, experience, projects, achievements
 *
 * Page-break behavior:
 *   - respect `wrap`/`avoid-break` per section block
 *   - orphans: 3, widows: 3
 */

import type { ResumeData } from '../../types';
import type { DocumentTokens, ExportDocument, SectionBlock } from '../resumeDocumentSchema';

/**
 * Builds an ExportDocument from resume data.
 * This is the bridge between Forge templates and Typst.
 * Currently returns a placeholder — implement when Typst is enabled.
 */
export function buildExportDocument(_resume: ResumeData): ExportDocument {
  const tokens: DocumentTokens = {
    pageSize: 'A4',
    pageMargins: { top: 30, right: 30, bottom: 30, left: 30 },
    fontFamily: 'Inter',
    fontSize: 10,
    lineHeight: 1.24,
    colors: {
      text: '#1a1a2e',
      muted: '#6c6c8a',
      accent: '#6c5ce7',
      background: '#ffffff',
      border: '#d0d0e0',
    },
  };

  return {
    tokens,
    pages: [{ blocks: [] }],
  };
}

/**
 * Future Typst render call.
 * @throws Error when called — implement when Typst integration is ready.
 */
export async function typstRender(_doc: ExportDocument): Promise<Blob> {
  throw new Error(
    'Typst engine is not yet integrated. ' +
    'See docs/ROADMAP.md for migration plan. ' +
    'Current PDF export uses React-PDF via pdfReactEngine.ts.'
  );
}

/**
 * Template token definitions for Typst.
 * Each template maps its visual properties through these tokens.
 */
type DeepPartial<T> = T extends object ? { [P in keyof T]?: DeepPartial<T[P]> } : T;

export const TYPST_TEMPLATE_TOKENS: Record<string, DeepPartial<DocumentTokens>> = {
  modern: { colors: { accent: '#0f766e', text: '#172126' } },
  designer: { fontFamily: 'Inter', colors: { accent: '#6c5ce7', text: '#1a1a2e' } },
  corporate: { fontFamily: 'Carlito', colors: { accent: '#17436b' } },
  atsFriendly: { fontFamily: 'Arial', colors: { accent: '#111111' } },
};

export type { DocumentTokens, ExportDocument, SectionBlock, DeepPartial };
