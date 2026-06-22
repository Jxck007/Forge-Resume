export type ResumeImportMode = 'pdf' | 'docx' | 'image' | 'text';

const FILE_LIMITS = {
  pdf: 5 * 1024 * 1024,
  docx: 5 * 1024 * 1024,
  image: 4 * 1024 * 1024,
} as const;

export class ResumeImportError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'ResumeImportError';
  }
}

export async function extractResumeText(file: File, mode: Exclude<ResumeImportMode, 'text'>): Promise<string> {
  if (mode === 'pdf') {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).href;

    try {
      const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
      const pages: string[] = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const pageText = content.items.map((item: any) => item.str || '').join(' ').replace(/\s+/g, ' ').trim();
        if (pageText) pages.push(pageText);
      }
      return pages.join('\n');
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      if (message.includes('password')) {
        throw new ResumeImportError('This PDF is password protected. Unlock it and try again.', 'pdf_password');
      }
      throw new ResumeImportError('This PDF could not be read. Try another file or paste text instead.', 'pdf_unreadable');
    }
  }

  if (mode === 'docx') {
    try {
      const mammoth = (await import('mammoth')).default;
      const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      return result.value;
    } catch {
      throw new ResumeImportError('This DOCX file could not be read. Try another file.', 'docx_unreadable');
    }
  }

  throw new ResumeImportError('Image import uses AI vision and does not extract text locally.', 'image_requires_vision');
}

export function getImportAccept(mode: Exclude<ResumeImportMode, 'text'>): string {
  if (mode === 'pdf') return '.pdf,application/pdf';
  if (mode === 'docx') {
    return '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  return 'image/jpeg,image/png,image/webp';
}

export function validateImportFile(file: File, mode: Exclude<ResumeImportMode, 'text'>): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (mode === 'pdf' && extension !== 'pdf') return 'Select a PDF file.';
  if (mode === 'docx' && extension !== 'docx') return 'Select a DOCX file.';
  if (mode === 'image' && !['jpg', 'jpeg', 'png', 'webp'].includes(extension || '')) {
    return 'Select a JPG, JPEG, PNG, or WEBP image.';
  }
  if (file.size > FILE_LIMITS[mode]) {
    return mode === 'image'
      ? 'Image import is limited to 4MB for beta.'
      : `${mode.toUpperCase()} import is limited to 5MB for beta.`;
  }
  return null;
}

export async function fileToBase64(file: File): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.onerror = () => reject(new ResumeImportError('Unable to read the selected file.', 'file_read_failed'));
    reader.readAsDataURL(file);
  });
}

export async function prepareImageForImport(file: File): Promise<{ base64: string; mimeType: string }> {
  if (file.size <= FILE_LIMITS.image) {
    return { base64: await fileToBase64(file), mimeType: file.type || 'image/png' };
  }

  const bitmap = await createImageBitmap(file);
  const maxDimension = 1800;
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new ResumeImportError('Unable to prepare this image for import.', 'image_prepare_failed');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  if (!blob) throw new ResumeImportError('Unable to prepare this image for import.', 'image_prepare_failed');

  const resized = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
  if (resized.size > FILE_LIMITS.image) {
    throw new ResumeImportError('This image is too large for beta import. Try a smaller image.', 'image_too_large');
  }

  return { base64: await fileToBase64(resized), mimeType: 'image/jpeg' };
}
