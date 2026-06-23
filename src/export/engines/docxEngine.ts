/**
 * DOCX Export Engine
 *
 * Delegates to the existing docx builder in utils/resumeExport.ts.
 * Future Typst migration will share the same normalized schema.
 */
import type { ResumeData } from '../../types';

export async function renderDocx(resume: ResumeData): Promise<Blob> {
  const { createResumeDocx } = await import('../../utils/resumeExport');
  return createResumeDocx(resume);
}
