/**
 * Image Export Engine
 *
 * Renders PDF pages to PNG via pdfjs-dist canvas rendering.
 * Future Typst migration will use the same normalized schema.
 */
import type { ResumeData } from '../../types';

export async function renderImage(resume: ResumeData): Promise<Blob> {
  const { createResumePng } = await import('../../utils/resumeExport');
  const { renderPdf } = await import('./pdfReactEngine');
  const pdfBlob = await renderPdf({ resume, templateId: resume.templateId });
  return createResumePng(pdfBlob);
}
