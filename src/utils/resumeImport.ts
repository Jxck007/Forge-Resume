export type ResumeImportMode = 'pdf' | 'docx' | 'image' | 'text';

const FILE_LIMITS = {
  pdf: 5 * 1024 * 1024,
  docx: 5 * 1024 * 1024,
  image: 4 * 1024 * 1024,
} as const;

type PdfPageRender = {
  canvas: HTMLCanvasElement;
  text: string;
  links: string[];
};

export type PreparedImportPayload =
  | {
      sourceType: 'pdf_text' | 'docx_text';
      text: string;
      warnings: string[];
      extractionMethod: 'text';
    }
  | {
      sourceType: 'pdf_hybrid';
      text: string;
      imageBase64: string;
      mimeType: string;
      warnings: string[];
      extractionMethod: 'hybrid';
    }
  | {
      sourceType: 'image';
      imageBase64: string;
      mimeType: string;
      warnings: string[];
      extractionMethod: 'vision';
    };

export class ResumeImportError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'ResumeImportError';
  }
}

const isPdfTextWeak = (text: string) => {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length < 240) return true;
  const alphaChars = cleaned.replace(/[^a-zA-Z]/g, '').length;
  const replacementChars = (cleaned.match(/[�□]/g) || []).length;
  const alphaRatio = alphaChars / Math.max(cleaned.length, 1);
  return replacementChars > 6 || alphaRatio < 0.45;
};

const isPdfContentIncomplete = (text: string) => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const projectIndex = normalized.search(/\bprojects?\b/i);
  if (projectIndex < 0) return false;
  const projectTail = normalized.slice(projectIndex, projectIndex + 500);
  return projectTail.length < 120 || projectTail.split(/[.!?]/).filter(Boolean).length < 2;
};

const getPdfLib = async () => {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).href;
  return pdfjsLib;
};

const getPdfDocument = async (file: File) => {
  try {
    const pdfjsLib = await getPdfLib();
    return await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('password')) {
      throw new ResumeImportError('This PDF is password protected. Unlock it and try again.', 'pdf_password');
    }
    throw new ResumeImportError('This PDF could not be read. Try another file or paste text instead.', 'pdf_unreadable');
  }
};

const renderPdfPages = async (file: File): Promise<PdfPageRender[]> => {
  const pdf = await getPdfDocument(file);
  const pages: PdfPageRender[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const textItems = content.items
      .filter((item: any) => typeof item.str === 'string' && item.str.trim())
      .map((item: any) => ({ text: item.str.trim(), x: Number(item.transform?.[4] || 0), y: Number(item.transform?.[5] || 0) }))
      .sort((a, b) => Math.abs(b.y - a.y) > 4 ? b.y - a.y : a.x - b.x);
    const lines: string[] = [];
    let previousY: number | null = null;
    textItems.forEach(item => {
      if (previousY !== null && Math.abs(previousY - item.y) > 4) lines.push('\n');
      lines.push(item.text);
      previousY = item.y;
    });
    const annotations = await page.getAnnotations();
    const links = annotations
      .map((annotation: any) => String(annotation.url || annotation.unsafeUrl || '').trim())
      .filter(Boolean);
    const text = lines.join(' ').replace(/ *\n */g, '\n').replace(/[ \t]+/g, ' ').trim();
    const viewport = page.getViewport({ scale: 1.45 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new ResumeImportError('Unable to prepare this PDF for import.', 'pdf_render_failed');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    pages.push({ canvas, text, links });
  }

  return pages;
};

const canvasToJpegBase64 = async (canvas: HTMLCanvasElement, quality: number) => {
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new ResumeImportError('Unable to prepare this image for import.', 'image_prepare_failed');
  return await fileToBase64(new File([blob], 'resume-import.jpg', { type: 'image/jpeg' }));
};

const mergeCanvases = async (canvases: HTMLCanvasElement[]) => {
  const maxWidth = Math.max(...canvases.map(canvas => canvas.width));
  const gap = 24;
  const totalHeight = canvases.reduce((sum, canvas) => sum + canvas.height, 0) + gap * Math.max(0, canvases.length - 1);
  const canvas = document.createElement('canvas');
  canvas.width = maxWidth;
  canvas.height = totalHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new ResumeImportError('Unable to prepare this PDF for import.', 'pdf_render_failed');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  let y = 0;
  for (const pageCanvas of canvases) {
    const x = Math.round((maxWidth - pageCanvas.width) / 2);
    context.drawImage(pageCanvas, x, y);
    y += pageCanvas.height + gap;
  }
  return canvas;
};

const scaleCanvas = (source: HTMLCanvasElement, scale: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new ResumeImportError('Unable to prepare this image for import.', 'image_prepare_failed');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
};

export async function extractResumeText(file: File, mode: Exclude<ResumeImportMode, 'text'>): Promise<string> {
  if (mode === 'pdf') {
    const pages = await renderPdfPages(file);
    const links = Array.from(new Set(pages.flatMap(page => page.links)));
    return [pages.map(page => page.text).filter(Boolean).join('\n'), links.length ? `Embedded links:\n${links.join('\n')}` : ''].filter(Boolean).join('\n');
  }

  if (mode === 'docx') {
    try {
      const mammoth = (await import('mammoth')).default;
      const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
      const document = new DOMParser().parseFromString(result.value, 'text/html');
      document.querySelectorAll('br').forEach(node => node.replaceWith('\n'));
      document.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li').forEach(node => node.append('\n'));
      const links = Array.from(document.querySelectorAll('a[href]'))
        .map(anchor => `${anchor.textContent?.trim() || 'Link'}: ${anchor.getAttribute('href') || ''}`)
        .filter(value => !value.endsWith(': '));
      return [document.body.textContent || '', links.length ? `Embedded links:\n${links.join('\n')}` : '']
        .filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n').trim();
    } catch {
      throw new ResumeImportError('This DOCX file could not be read. Try another file.', 'docx_unreadable');
    }
  }

  throw new ResumeImportError('Image import uses AI vision and does not extract text locally.', 'image_requires_vision');
}

export async function preparePdfImportPayload(file: File): Promise<PreparedImportPayload> {
  const pages = await renderPdfPages(file);
  const links = Array.from(new Set(pages.flatMap(page => page.links)));
  const text = [
    pages.map(page => page.text).filter(Boolean).join('\n'),
    links.length ? `Embedded links:\n${links.join('\n')}` : '',
  ].filter(Boolean).join('\n');
  const warnings: string[] = [];

  if (!isPdfTextWeak(text) && !isPdfContentIncomplete(text)) {
    return {
      sourceType: 'pdf_text',
      text,
      warnings,
      extractionMethod: 'text',
    };
  }

  warnings.push('Forge combined selectable PDF text with page images because local extraction looked incomplete.');

  const merged = await mergeCanvases(pages.map(page => page.canvas));
  let candidate = merged;
  let quality = 0.82;
  let base64 = await canvasToJpegBase64(candidate, quality);
  while (atob(base64).length > FILE_LIMITS.image && (candidate.width > 1000 || quality > 0.55)) {
    if (atob(base64).length > FILE_LIMITS.image && candidate.width > 1000) {
      candidate = scaleCanvas(candidate, 0.82);
    } else {
      quality = Math.max(0.55, quality - 0.08);
    }
    base64 = await canvasToJpegBase64(candidate, quality);
  }

  if (atob(base64).length > FILE_LIMITS.image) {
    if (!text.trim()) {
      throw new ResumeImportError('This PDF has little selectable text and could not be prepared for fallback import.', 'pdf_fallback_too_large');
    }
    warnings.push('Image fallback was too large, so Forge used the weaker selectable text instead.');
    return {
      sourceType: 'pdf_text',
      text,
      warnings,
      extractionMethod: 'text',
    };
  }

  return {
    sourceType: 'pdf_hybrid',
    text,
    imageBase64: base64,
    mimeType: 'image/jpeg',
    warnings,
    extractionMethod: 'hybrid',
  };
}

export async function prepareDocxImportPayload(file: File): Promise<PreparedImportPayload> {
  const text = await extractResumeText(file, 'docx');
  if (!text.trim()) throw new ResumeImportError('No readable text was extracted from this DOCX file.', 'docx_empty');
  return {
    sourceType: 'docx_text',
    text,
    warnings: [],
    extractionMethod: 'text',
  };
}

export function getImportAccept(mode: Exclude<ResumeImportMode, 'text'>): string {
  if (mode === 'pdf') return '.pdf,application/pdf';
  if (mode === 'docx') {
    return '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  return 'image/jpeg,image/png,image/webp';
}

export const ALL_IMPORT_ACCEPT = '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp';

/** User-facing upload accept list — excludes DOCX per product direction. */
export const USER_IMPORT_ACCEPT = '.pdf,image/jpeg,image/png,image/webp';

export function inferImportMode(file: File): Exclude<ResumeImportMode, 'text'> | null {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'pdf') return 'pdf';
  if (extension === 'docx') return 'docx';
  if (['jpg', 'jpeg', 'png', 'webp'].includes(extension || '')) return 'image';
  return null;
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
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  if (!blob) throw new ResumeImportError('Unable to prepare this image for import.', 'image_prepare_failed');

  const resized = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
  if (resized.size > FILE_LIMITS.image) {
    throw new ResumeImportError('This image is too large for beta import. Try a smaller image.', 'image_too_large');
  }

  return { base64: await fileToBase64(resized), mimeType: 'image/jpeg' };
}
