export async function createResumePng(pdfBlob: Blob): Promise<Blob> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
  const document = await pdfjs.getDocument({ data: new Uint8Array(await pdfBlob.arrayBuffer()) }).promise;
  const rendered: HTMLCanvasElement[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = window.document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('image_export_failed');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    rendered.push(canvas);
  }
  const gap = document.numPages > 1 ? 24 : 0;
  const output = window.document.createElement('canvas');
  output.width = Math.max(...rendered.map(canvas => canvas.width));
  output.height = rendered.reduce((sum, canvas) => sum + canvas.height, 0) + gap * Math.max(0, rendered.length - 1);
  const context = output.getContext('2d');
  if (!context) throw new Error('image_export_failed');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, output.width, output.height);
  let y = 0;
  rendered.forEach(canvas => {
    context.drawImage(canvas, Math.round((output.width - canvas.width) / 2), y);
    y += canvas.height + gap;
  });
  const blob = await new Promise<Blob | null>(resolve => output.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('image_export_failed');
  return blob;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
