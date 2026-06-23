/**
 * PDF Export Engine — React-PDF adapter
 *
 * Currently delegates to the existing ResumePdfDocument component.
 * Future Typst migration will replace this engine's internals without
 * changing the export interface.
 *
 * @see ../resumeDocumentSchema.ts for the Typst-ready schema
 */
import type { ResumeData, TemplateId } from '../../types';

// Re-export the existing PDF document as the current engine implementation.
// When Typst is ready, swap this import.
export { default as ResumePdfDocument } from '../../components/ResumePdfDocument';
export type { ResumePdfMode } from '../../components/ResumePdfDocument';

export interface PdfExportInput {
  resume: ResumeData;
  templateId: TemplateId;
  mode?: 'single' | 'multi';
  profilePhoto?: string;
}

/**
 * Renders a PDF Blob from resume data.
 * Current implementation: React-PDF.
 * Future: delegates to Typst CLI via the normalized ExportDocument schema.
 */
export async function renderPdf(input: PdfExportInput): Promise<Blob> {
  const { pdf } = await import('@react-pdf/renderer');
  const { default: ResumePdfDocument, FORCE_SINGLE_PAGE_PROFILE, SINGLE_PAGE_MAX_COMPACT_LEVEL } =
    await import('../../components/ResumePdfDocument');

  let compactLevel = 0;
  const mode = input.mode || 'multi';
  const render = async (level: number) => {
    let pageCount = 1;
    const blob = await pdf(
      <ResumePdfDocument
        resume={input.resume}
        templateId={input.templateId}
        mode={mode}
        profilePhoto={input.profilePhoto}
        compactLevel={level}
        onRender={(result) => { pageCount = result.pageCount; }}
      />
    ).toBlob();
    return { blob, pageCount };
  };

  let result = await render(compactLevel);
  if (mode === 'single') {
    while (result.pageCount > 1 && compactLevel < SINGLE_PAGE_MAX_COMPACT_LEVEL) {
      compactLevel += 1;
      result = await render(compactLevel);
    }
    if (result.pageCount > 1) {
      result = await render(FORCE_SINGLE_PAGE_PROFILE);
    }
  }

  return result.blob;
}
