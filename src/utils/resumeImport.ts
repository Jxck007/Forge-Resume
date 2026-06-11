export type ResumeImportMode = 'pdf' | 'docx' | 'image' | 'text';

export async function extractResumeText(file: File, mode: Exclude<ResumeImportMode, 'text'>): Promise<string> {
  if (mode === 'pdf') {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).href;
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages: string[] = [];
    let ocrWorker: Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>> | null = null;

    try {
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const pageText = content.items.map((item: any) => item.str || '').join(' ').trim();

        if (pageText) {
          pages.push(pageText);
          continue;
        }

        if (!ocrWorker) {
          const { createWorker } = await import('tesseract.js');
          ocrWorker = await createWorker('eng');
        }

        const viewport = page.getViewport({ scale: 1.75 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Unable to prepare scanned PDF page for OCR.');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        const result = await ocrWorker.recognize(canvas);
        pages.push(result.data.text.trim());
      }
    } finally {
      await ocrWorker?.terminate();
    }

    return pages.filter(Boolean).join('\n');
  }

  if (mode === 'docx') {
    const mammoth = (await import('mammoth')).default;
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return result.value;
  }

  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');
  try {
    const result = await worker.recognize(file);
    return result.data.text;
  } finally {
    await worker.terminate();
  }
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
  return null;
}
