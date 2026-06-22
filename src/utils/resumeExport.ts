import {
  Document,
  ExternalHyperlink,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import { ResumeData } from '../types';

const safeText = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const safeUrl = (value: unknown) => {
  const text = safeText(value);
  if (!text) return '';
  const candidate = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  try { return new URL(candidate).toString(); } catch { return ''; }
};

const heading = (text: string) => new Paragraph({
  text,
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 220, after: 80 },
});

const body = (text: string, bullet = false) => new Paragraph({
  children: [new TextRun(safeText(text))],
  ...(bullet ? { bullet: { level: 0 } } : {}),
  spacing: { after: 70 },
});

const linkedLine = (label: string, value: unknown) => {
  const url = safeUrl(value);
  if (!url) return null;
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true }),
      new ExternalHyperlink({
        link: url,
        children: [new TextRun({ text: safeText(value), style: 'Hyperlink' })],
      }),
    ],
    spacing: { after: 40 },
  });
};

const entry = (title: string, meta: string, description: string) => [
  new Paragraph({
    children: [
      new TextRun({ text: safeText(title), bold: true }),
      ...(safeText(meta) ? [new TextRun({ text: `  |  ${safeText(meta)}`, italics: true })] : []),
    ],
    spacing: { before: 80, after: 40 },
  }),
  ...safeText(description).split(/\r?\n|•/).map(value => safeText(value)).filter(Boolean).map(value => body(value, true)),
];

export async function createResumeDocx(resume: ResumeData): Promise<Blob> {
  const details = resume.personalDetails;
  const children: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: safeText(details.fullName) || 'Resume', bold: true, size: 34 })],
      spacing: { after: 60 },
    }),
    body(safeText(details.professionalTitle)),
    body([details.email, details.phone, details.location].map(safeText).filter(Boolean).join('  |  ')),
  ];

  [linkedLine('LinkedIn', details.linkedin), linkedLine('GitHub', details.github), linkedLine('Portfolio', details.website)]
    .forEach(line => { if (line) children.push(line); });

  if (safeText(resume.summary)) children.push(heading('Summary'), body(resume.summary));
  if (resume.experience.length) {
    children.push(heading('Experience'));
    resume.experience.forEach(item => children.push(...entry(
      [item.title, item.company].map(safeText).filter(Boolean).join(' — '),
      [item.location, [item.startDate, item.endDate].map(safeText).filter(Boolean).join(' – ')].filter(Boolean).join(' | '),
      item.description
    )));
  }
  if ((resume.internships || []).length) {
    children.push(heading('Internships'));
    (resume.internships || []).forEach(item => children.push(...entry(
      [item.role, item.company].map(safeText).filter(Boolean).join(' — '),
      [item.startDate, item.endDate].map(safeText).filter(Boolean).join(' – '),
      [item.description, item.technologiesUsed].map(safeText).filter(Boolean).join('\n')
    )));
  }
  if (resume.projects.length) {
    children.push(heading('Projects'));
    resume.projects.forEach(item => {
      children.push(...entry(item.name, item.technologies, item.description));
      [linkedLine('GitHub', item.github), linkedLine('Live', item.live)].forEach(line => { if (line) children.push(line); });
    });
  }
  if (resume.education.length) {
    children.push(heading('Education'));
    resume.education.forEach(item => children.push(...entry(
      item.degree,
      [item.institution, item.location, [item.startDate, item.endDate].map(safeText).filter(Boolean).join(' – ')].map(safeText).filter(Boolean).join(' | '),
      item.description
    )));
  }
  const skillGroups = Object.entries(resume.skills).filter(([, values]) => values.length);
  if (skillGroups.length) {
    children.push(heading('Skills'));
    skillGroups.forEach(([key, values]) => children.push(body(`${key.replace(/([A-Z])/g, ' $1')}: ${values.map(safeText).filter(Boolean).join(', ')}`)));
  }
  if (resume.certifications.length) {
    children.push(heading('Certifications'));
    resume.certifications.forEach(item => {
      children.push(...entry(item.name, [item.issuer, item.date].map(safeText).filter(Boolean).join(' | '), ''));
      const link = linkedLine('Credential', item.url);
      if (link) children.push(link);
    });
  }
  if (resume.achievements.length) children.push(heading('Achievements'), ...resume.achievements.map(value => body(value, true)));
  if (resume.volunteering.length) {
    children.push(heading('Volunteering'));
    resume.volunteering.forEach(item => children.push(...entry(
      [item.title, item.company].map(safeText).filter(Boolean).join(' — '),
      [item.startDate, item.endDate].map(safeText).filter(Boolean).join(' – '),
      item.description
    )));
  }
  if (resume.languages.length) children.push(heading('Languages'), body(resume.languages.map(safeText).filter(Boolean).join(', ')));
  resume.customSections.forEach(section => {
    if (!safeText(section.title) || !section.items.length) return;
    children.push(heading(section.title));
    section.items.forEach(item => children.push(...entry(item.title, [item.subtitle, item.date].map(safeText).filter(Boolean).join(' | '), item.description)));
  });

  const document = new Document({ sections: [{ properties: {}, children }] });
  return Packer.toBlob(document);
}

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
