import React, { useState } from 'react';
import { ResumeData, TemplateId, CustomSection } from '../types';
import { Printer, Eye, FileDown, AlertTriangle, X } from 'lucide-react';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

interface ResumePreviewProps {
  resume: ResumeData;
  selectedTemplate: TemplateId;
  profilePhoto?: string;
  onTemplateChange: (templateId: TemplateId) => void;
  onProfilePhotoUsageChange: (useProfilePhoto: boolean) => void;
  showToasts: (msg: string, type: 'success' | 'error' | 'info') => void;
}

interface PdfProtectedRange {
  top: number;
  bottom: number;
}

const getElementCanvasRange = (
  target: HTMLElement,
  rootRect: DOMRect,
  canvasScaleY: number
): PdfProtectedRange => {
  const rect = target.getBoundingClientRect();
  return {
    top: (rect.top - rootRect.top) * canvasScaleY,
    bottom: (rect.bottom - rootRect.top) * canvasScaleY,
  };
};

const collectPdfProtectedRanges = (
  element: HTMLElement,
  rootRect: DOMRect,
  canvasScaleY: number,
  sourcePageHeight: number
): PdfProtectedRange[] => {
  const maximumProtectedHeight = sourcePageHeight * 0.92;
  const ranges = Array.from(
    element.querySelectorAll<HTMLElement>('.resume-section-item, .avoid-break, article')
  )
    .map(target => getElementCanvasRange(target, rootRect, canvasScaleY))
    .filter(range => range.bottom > range.top && range.bottom - range.top <= maximumProtectedHeight);

  Array.from(
    element.querySelectorAll<HTMLElement>('.resume-section-heading, h2, h3')
  ).forEach(heading => {
    const section = heading.closest<HTMLElement>('.resume-section, section');
    const explicitFirstItem = section?.querySelector<HTMLElement>('.resume-section-item, article, .avoid-break');
    const nextSibling = heading.nextElementSibling as HTMLElement | null;
    const nestedFirstItem = nextSibling?.querySelector<HTMLElement>('.resume-section-item, article, .avoid-break');
    const firstContent = explicitFirstItem || nestedFirstItem || nextSibling;
    if (!firstContent) return;

    const headingRange = getElementCanvasRange(heading, rootRect, canvasScaleY);
    const contentRange = getElementCanvasRange(firstContent, rootRect, canvasScaleY);
    const range = {
      top: headingRange.top,
      bottom: Math.max(headingRange.bottom, contentRange.bottom),
    };
    if (range.bottom - range.top <= maximumProtectedHeight) ranges.push(range);
  });

  return ranges;
};

const findSafePdfSliceEnd = (
  sourceY: number,
  targetEnd: number,
  protectedRanges: PdfProtectedRange[]
) => {
  let sliceEnd = targetEnd;

  for (let pass = 0; pass < protectedRanges.length; pass += 1) {
    const crossingRanges = protectedRanges.filter(range =>
      range.top > sourceY + 0.5 &&
      range.top < sliceEnd &&
      range.bottom > sliceEnd
    );
    if (crossingRanges.length === 0) break;
    sliceEnd = Math.min(...crossingRanges.map(range => range.top));
  }

  return sliceEnd > sourceY + 1 ? sliceEnd : targetEnd;
};

export default function ResumePreview({
  resume,
  selectedTemplate,
  profilePhoto,
  onTemplateChange,
  onProfilePhotoUsageChange,
  showToasts,
}: ResumePreviewProps) {
  const [exportError, setExportError] = useState<{ message: string; stack?: string } | null>(null);
  const [exportMode, setExportMode] = useState<'single' | 'multi'>('single');
  const [isExporting, setIsExporting] = useState(false);

  const personalDetails = resume?.personalDetails || { fullName: '', professionalTitle: '', email: '', phone: '', location: '', linkedin: '', github: '', website: '', profilePhoto: '' };
  const summary = resume?.summary || '';
  const education = resume?.education || [];
  const experience = resume?.experience || [];
  const projects = resume?.projects || [];
  const skills = resume?.skills || { programmingLanguages: [], frameworks: [], tools: [], databases: [], softSkills: [] };
  const certifications = resume?.certifications || [];
  const achievements = resume?.achievements || [];
  const volunteering = resume?.volunteering || [];
  const languages = resume?.languages || [];
  const customSections = resume?.customSections || [];
  const sectionOrder = resume.sectionOrder;
  const hiddenSections = resume?.hiddenSections || [];
  const hasSkills = Object.values(skills).some(s => Array.isArray(s) && s.length > 0);
  const profilePhotoSource = personalDetails.profilePhoto?.trim() || profilePhoto?.trim() || '';
  const shouldUseProfilePhoto = resume.useProfilePhoto !== false && Boolean(profilePhotoSource);

  const renderProfilePhoto = (className: string, alt = 'Profile photo') => {
    if (!shouldUseProfilePhoto) return null;

    return (
      <img
        src={profilePhotoSource}
        alt={alt}
        className={`object-cover object-center shrink-0 ${className}`}
        referrerPolicy="no-referrer"
        crossOrigin={/^https?:\/\//i.test(profilePhotoSource) ? 'anonymous' : undefined}
        loading="eager"
        decoding="sync"
        draggable={false}
        onError={event => {
          event.currentTarget.style.display = 'none';
        }}
      />
    );
  };

  const handlePrint = () => {
    // Show a helpful print instruction toast
    showToasts('Launching Print to PDF. Pro-Tip: Enable "Background Graphics" in the print settings for maximum quality.', 'success');
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (isExporting) return;
    setExportError(null);
    const element = document.getElementById('resume-live-print-view');
    if (!element) {
      const msg = 'Element #resume-live-print-view not found in DOM.';
      console.error(msg);
      setExportError({ message: msg });
      showToasts(msg, 'error');
      return;
    }
    
    showToasts('Generating PDF...', 'info');
    setIsExporting(true);

    try {
      const images = Array.from(element.querySelectorAll<HTMLImageElement>('img'));
      await Promise.all(images.map(image => {
        if (image.complete) {
          return image.decode?.().catch(() => undefined) ?? Promise.resolve();
        }

        return new Promise<void>(resolve => {
          image.addEventListener('load', () => resolve(), { once: true });
          image.addEventListener('error', () => resolve(), { once: true });
        });
      }));

      const rootRect = element.getBoundingClientRect();
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: element.scrollWidth,
      });

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imageData = canvas.toDataURL('image/jpeg', 0.98);
      const canvasScaleX = canvas.width / element.scrollWidth;
      const canvasScaleY = canvas.height / element.scrollHeight;
      const links = Array.from(element.querySelectorAll<HTMLAnchorElement>('a[href]'))
        .map(anchor => {
          const rect = anchor.getBoundingClientRect();
          return {
            url: anchor.href,
            x: (rect.left - rootRect.left) * canvasScaleX,
            y: (rect.top - rootRect.top) * canvasScaleY,
            width: rect.width * canvasScaleX,
            height: rect.height * canvasScaleY,
          };
        })
        .filter(link => link.url && link.width > 0 && link.height > 0);

      if (exportMode === 'single') {
        const margin = 18;
        const availableWidth = pageWidth - margin * 2;
        const availableHeight = pageHeight - margin * 2;
        const scale = Math.min(availableWidth / canvas.width, availableHeight / canvas.height);
        const renderedWidth = canvas.width * scale;
        const renderedHeight = canvas.height * scale;
        const offsetX = (pageWidth - renderedWidth) / 2;
        const offsetY = margin;
        pdf.addImage(imageData, 'JPEG', offsetX, offsetY, renderedWidth, renderedHeight);
        links.forEach(link => {
          pdf.link(
            offsetX + link.x * scale,
            offsetY + link.y * scale,
            link.width * scale,
            link.height * scale,
            { url: link.url }
          );
        });
      } else {
        const horizontalMargin = 24;
        const verticalMargin = 28;
        const availableWidth = pageWidth - horizontalMargin * 2;
        const availableHeight = pageHeight - verticalMargin * 2;
        const pageScale = availableWidth / canvas.width;
        const sourcePageHeight = Math.floor(availableHeight / pageScale);
        const protectedRanges = collectPdfProtectedRanges(
          element,
          rootRect,
          canvasScaleY,
          sourcePageHeight
        );
        let sourceY = 0;
        let pageIndex = 0;

        while (sourceY < canvas.height) {
          const targetEnd = Math.min(sourceY + sourcePageHeight, canvas.height);
          const sliceEnd = findSafePdfSliceEnd(
            sourceY,
            targetEnd,
            protectedRanges
          );
          const sliceHeight = Math.max(1, Math.floor(sliceEnd - sourceY));
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = canvas.width;
          pageCanvas.height = sliceHeight;

          const context = pageCanvas.getContext('2d');
          if (!context) {
            throw new Error('Unable to prepare the PDF page canvas.');
          }

          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          context.drawImage(
            canvas,
            0,
            sourceY,
            canvas.width,
            sliceHeight,
            0,
            0,
            canvas.width,
            sliceHeight
          );

          if (pageIndex > 0) pdf.addPage();
          const renderedHeight = sliceHeight * pageScale;
          pdf.addImage(
            pageCanvas.toDataURL('image/jpeg', 0.98),
            'JPEG',
            horizontalMargin,
            verticalMargin,
            availableWidth,
            renderedHeight
          );
          links
            .filter(link => link.y < sourceY + sliceHeight && link.y + link.height > sourceY)
            .forEach(link => {
              pdf.link(
                horizontalMargin + link.x * pageScale,
                verticalMargin + Math.max(0, link.y - sourceY) * pageScale,
                link.width * pageScale,
                link.height * pageScale,
                { url: link.url }
              );
            });

          sourceY += sliceHeight;
          pageIndex += 1;
        }
      }

      const safeName = personalDetails.fullName
        ? personalDetails.fullName.replace(/[^a-z0-9]/gi, '_')
        : 'Resume';
      pdf.save(`${safeName}_${exportMode === 'single' ? 'Single_Page' : 'Multi_Page'}.pdf`);
      showToasts('PDF downloaded successfully!', 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'PDF generation failed.';
      const stack = err instanceof Error ? err.stack : undefined;
      console.error('PDF export failed:', err);
      setExportError({ message, stack });
      showToasts(`PDF generation failed: ${message}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Switch template templates instantly (12 layouts)
  const templatesList: { id: TemplateId; name: string; description: string }[] = [
    { id: 'modern', name: 'Modern Professional', description: 'Clean slate layout with subtle indigo accents' },
    { id: 'minimal', name: 'Minimal Elegant', description: 'Ultra clean presentation with rich white spaces' },
    { id: 'corporate', name: 'Corporate Standard', description: 'Deep steel blue tones for serious corporate impact' },
    { id: 'executive', name: 'Executive Boardroom', description: 'Refined serif look tailored for management profiles' },
    { id: 'creative', name: 'Creative Dynamic', description: 'Energetic geometric headings with colored labels' },
    { id: 'atsFriendly', name: 'ATS Friendly', description: 'Strict stacked text layout to avoid systems truncation' },
    { id: 'softwareEngineer', name: 'Software Developer', description: 'Technical design with GitHub hooks and monospaced accents' },
    { id: 'student', name: 'Academic Student', description: 'Highlights education first to elevate coursework and honors' },
    { id: 'startup', name: 'Startup Growth', description: 'Modern, high-velocity layout centering key stack highlights' },
    { id: 'designer', name: 'Designer Portfolio', description: 'Artistic multi-level visual frame highlighting design badges' },
    { id: 'dataAnalyst', name: 'Data & Metrics', description: 'Tailored for data professionals, prioritizing quantitative outcomes' },
    { id: 'classic', name: 'Classic Editorial', description: 'Traditional Italian-serif editorial with centered headers' },
  ];

  // Structural Template Style Resolvers
  const getTemplateTheme = (id: TemplateId) => {
    switch (id) {
      case 'modern':
        return {
          font: 'font-sans',
          headerBg: 'border-b-4 border-indigo-500',
          headingColor: 'text-indigo-600 ',
          titleColor: 'text-gray-900',
          bodyBg: 'bg-white text-gray-800',
        };
      case 'minimal':
        return {
          font: 'font-sans tracking-wide',
          headerBg: 'border-none',
          headingColor: 'text-gray-950 font-semibold tracking-wider uppercase',
          titleColor: 'text-gray-950',
          bodyBg: 'bg-white text-gray-800',
        };
      case 'corporate':
        return {
          font: 'font-sans',
          headerBg: 'border-l-4 border-slate-700 pl-4',
          headingColor: 'text-slate-750 font-bold border-b border-slate-205 pb-1',
          titleColor: 'text-slate-900',
          bodyBg: 'bg-white text-slate-800',
        };
      case 'executive':
        return {
          font: 'font-serif',
          headerBg: 'border-b-2 border-emerald-805 pb-3',
          headingColor: 'text-emerald-900 italic font-semibold border-b border-emerald-100',
          titleColor: 'text-emerald-955',
          bodyBg: 'bg-white text-gray-800',
        };
      case 'creative':
        return {
          font: 'font-sans',
          headerBg: 'bg-slate-900 text-white p-6 rounded-xl',
          headingColor: 'text-emerald-700 font-extrabold uppercase tracking-widest',
          titleColor: 'text-slate-950',
          bodyBg: 'bg-white text-gray-800',
        };
      case 'atsFriendly':
        return {
          font: 'font-sans',
          headerBg: 'border-b border-black pb-1',
          headingColor: 'text-black font-bold uppercase tracking-wider',
          titleColor: 'text-black',
          bodyBg: 'bg-white text-black',
        };
      case 'softwareEngineer':
        return {
          font: 'font-mono',
          headerBg: 'border-b-2 border-gray-900 pb-2',
          headingColor: 'text-indigo-650 font-mono font-bold',
          titleColor: 'text-gray-900',
          bodyBg: 'bg-white text-gray-800',
        };
      case 'student':
        return {
          font: 'font-sans',
          headerBg: 'border-b border-violet-100 pb-2',
          headingColor: 'text-violet-700 font-bold',
          titleColor: 'text-violet-955',
          bodyBg: 'bg-white text-gray-800',
        };
      case 'startup':
        return {
          font: 'font-sans',
          headerBg: 'border-b-2 border-slate-900 pb-2',
          headingColor: 'text-slate-900 font-extrabold',
          titleColor: 'text-slate-950',
          bodyBg: 'bg-white text-slate-800',
        };
      case 'designer':
        return {
          font: 'font-sans',
          headerBg: 'pb-4 border-b-2 border-violet-500',
          headingColor: 'text-violet-600 font-bold uppercase tracking-wider',
          titleColor: 'text-violet-950',
          bodyBg: 'bg-white text-gray-800',
        };
      case 'dataAnalyst':
        return {
          font: 'font-sans',
          headerBg: 'border-l-4 border-teal-700 pl-3',
          headingColor: 'text-teal-700 font-bold',
          titleColor: 'text-teal-950',
          bodyBg: 'bg-white text-gray-850',
        };
      case 'classic':
      default:
        return {
          font: 'font-serif',
          headerBg: 'border-b border-gray-300 pb-2 text-center',
          headingColor: 'text-gray-900 font-semibold border-b border-gray-200 pb-0.5 text-center',
          titleColor: 'text-gray-900',
          bodyBg: 'bg-white text-gray-900',
        }
    }
  };

  const themeConfig = getTemplateTheme(selectedTemplate);

  const getTemplateButtonClass = (id: TemplateId, selected: boolean) => {
    const base = 'px-2 py-2 rounded-lg text-[10px] font-bold border transition text-center cursor-pointer';
    const palette: Record<TemplateId, string> = {
      modern: 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:border-indigo-400',
      minimal: 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-400',
      corporate: 'border-slate-300 bg-slate-100 text-slate-800 hover:border-slate-500',
      executive: 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-400',
      creative: 'border-emerald-200 bg-slate-900 text-emerald-300 hover:border-emerald-400',
      atsFriendly: 'border-zinc-300 bg-white text-zinc-900 hover:border-zinc-500',
      softwareEngineer: 'border-cyan-200 bg-slate-900 text-cyan-300 hover:border-cyan-400',
      student: 'border-violet-200 bg-violet-50 text-violet-700 hover:border-violet-400',
      startup: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-400',
      designer: 'border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-400',
      dataAnalyst: 'border-teal-200 bg-teal-50 text-teal-700 hover:border-teal-400',
      classic: 'border-stone-300 bg-stone-50 text-stone-700 hover:border-stone-500',
    };

    if (selected) {
      return `${base} ring-2 ring-offset-1 shadow-sm ${palette[id]}`;
    }

    return `${base} border-gray-200/80 bg-white text-gray-600 hover:border-gray-300`;
  };

  // Render Skill Badges beautifully based on templates
  const renderSkillBadges = (skillList: string[], type: TemplateId = selectedTemplate) => {
    if (!skillList || skillList.length === 0) return null;
    
    if (type === 'atsFriendly') {
      return <span className="text-xs text-black leading-relaxed">{skillList.join(', ')}</span>;
    }

    let badgeStyle = 'bg-gray-50  text-gray-650  text-[10px] font-medium rounded-full px-2.5 py-0.5 border border-gray-100';
    if (type === 'creative') {
      badgeStyle = 'bg-emerald-50 text-emerald-900 font-bold text-[9.5px] rounded-md px-2 py-0.5 border border-emerald-100';
    } else if (type === 'softwareEngineer') {
      badgeStyle = 'bg-slate-100 text-slate-800 font-mono text-[9px] rounded px-2 py-0.5 border border-slate-200/50';
    } else if (type === 'modern') {
      badgeStyle = 'bg-indigo-50 text-indigo-700 font-bold text-[10px] rounded px-2.5 py-0.5 border border-indigo-100/30';
    } else if (type === 'student') {
      badgeStyle = 'bg-violet-50 text-violet-750 font-semibold text-[10px] rounded-md px-2 py-0.5 border border-violet-100/40';
    } else if (type === 'startup') {
      badgeStyle = 'bg-emerald-50 text-emerald-800 font-bold text-[10px] rounded px-2.5 py-0.5 border border-emerald-100/55';
    } else if (type === 'designer') {
      badgeStyle = 'bg-slate-800 text-slate-200 font-medium text-[9px] rounded px-2 py-1';
    } else if (type === 'corporate') {
      badgeStyle = 'bg-slate-100 text-slate-700 font-medium text-[10px] rounded px-2.5 py-0.5 border border-slate-200';
    } else if (type === 'dataAnalyst') {
      badgeStyle = 'bg-teal-50 text-teal-900 font-mono text-[10px] rounded px-2 py-0.5 border border-teal-100';
    }

    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {skillList.map((s, i) => (
          <span key={i} className={badgeStyle}>{s}</span>
        ))}
      </div>
    );
  };

  const isSectionVisible = (secId: string) => {
    return !hiddenSections.includes(secId);
  };

  const normalizeUrl = (url: string) =>
    /^https?:\/\//i.test(url) ? url : `https://${url}`;

  const ResumeLink = ({
    url,
    label,
    className = '',
  }: {
    url?: string;
    label: string;
    className?: string;
  }) => {
    if (!url?.trim()) return null;
    return (
      <a
        href={normalizeUrl(url.trim())}
        target="_blank"
        rel="noreferrer"
        className={`underline decoration-current underline-offset-2 ${className}`}
      >
        {label}
      </a>
    );
  };

  const renderContactLinks = (className = '') => {
    const links = [
      { url: personalDetails.website, label: 'Portfolio' },
      { url: personalDetails.linkedin, label: 'LinkedIn' },
      { url: personalDetails.github, label: 'GitHub' },
    ].filter(link => link.url?.trim());

    if (links.length === 0) return null;
    return (
      <div className={`flex flex-wrap gap-x-2 gap-y-1 ${className}`}>
        {links.map(link => (
          <React.Fragment key={link.label}>
            <ResumeLink url={link.url} label={link.label} />
          </React.Fragment>
        ))}
      </div>
    );
  };

  const renderCustomSection = (templateId: TemplateId, section: CustomSection) => {
    if (!section.items || section.items.length === 0) return null;

    const theme = getTemplateTheme(templateId);

    return (
      <section key={section.id} className="resume-section resume-section-custom space-y-3 pb-2 text-left">
        <h3 className={`resume-section-heading text-xs font-bold uppercase tracking-wider ${theme.headingColor} border-b border-gray-100 pb-1`}>
          {section.title}
        </h3>
        <div className="space-y-3">
          {section.items.map(item => (
            <article key={item.id} className="resume-section-item avoid-break text-left">
              <div className="flex justify-between items-baseline flex-wrap">
                <h4 className="text-xs font-bold text-gray-900">{item.title}</h4>
                {item.date && <span className="text-[10px] text-gray-500 font-medium">{item.date}</span>}
              </div>
              {item.subtitle && <p className="text-[10px] text-gray-500 italic mt-0.5">{item.subtitle}</p>}
              <p className="text-[10.5px] text-gray-600 mt-1.5 whitespace-pre-line leading-relaxed">{item.description}</p>
            </article>
          ))}
        </div>
      </section>
    );
  };

  const renderInternships = (templateId: TemplateId, list: any[]) => {
    switch (templateId) {
      case 'modern':
        return (
          <div className="space-y-3 pb-2 text-left">
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-650 border-b border-indigo-100 pb-1">Internship History</h3>
            <div className="space-y-3">
              {list.map(i => (
                <div key={i.id} className="avoid-break bg-slate-50/70 border border-slate-100 p-4 rounded-xl relative hover:shadow-sm transition-all pl-6">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-l-xl"></div>
                  <div className="flex justify-between items-baseline flex-wrap">
                    <h4 className="text-xs font-bold text-gray-955">{i.role} / <span className="text-indigo-650 font-semibold">{i.company}</span></h4>
                    <span className="text-[9.5px] font-bold text-indigo-650 whitespace-nowrap bg-indigo-50/60 px-2 py-0.5 rounded-full">{i.startDate} - {i.endDate}</span>
                  </div>
                  <div className="flex justify-between items-baseline text-[10px] text-gray-400 font-bold mb-2">
                    <span>{i.location}</span>
                    {i.technologiesUsed && <span className="text-indigo-620">Tools: {i.technologiesUsed}</span>}
                  </div>
                  <p className="text-[10.5px] text-gray-655 whitespace-pre-line leading-relaxed">{i.description}</p>
                </div>
              ))}
            </div>
          </div>
        );
      case 'minimal':
        return (
          <div className="space-y-3 pb-2 text-left">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-955 text-center font-sans">INTERNSHIPS</h3>
            <div className="space-y-4">
              {list.map(i => (
                <div key={i.id} className="avoid-break">
                  <div className="flex justify-between items-baseline font-sans">
                    <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">{i.company} — <span className="font-light text-slate-500">{i.role}</span></h4>
                    <span className="text-[9.5px] font-light text-slate-400 whitespace-nowrap">{i.startDate} – {i.endDate}</span>
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-400 mt-0.5 uppercase tracking-wide">
                    <span>{i.location}</span>
                    {i.technologiesUsed && <span>Stack: {i.technologiesUsed}</span>}
                  </div>
                  <p className="text-[10.5px] text-slate-605 mt-1 whitespace-pre-line leading-relaxed font-light">{i.description}</p>
                </div>
              ))}
            </div>
          </div>
        );
      case 'corporate':
        return (
          <div className="space-y-3 pb-2 text-left">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">Internship Placements</h3>
            <div className="space-y-3">
              {list.map(i => (
                <div key={i.id} className="avoid-break border-l-2 border-slate-500 pl-4 py-1">
                  <div className="flex justify-between items-baseline">
                    <h4 className="text-xs font-bold text-slate-900">{i.role} at <span className="text-slate-700">{i.company}</span></h4>
                    <span className="text-[10px] text-slate-500 font-medium">{i.startDate} - {i.endDate}</span>
                  </div>
                  <div className="flex justify-between text-[9.5px] text-slate-400 mt-0.5">
                    <span>{i.location}</span>
                    {i.technologiesUsed && <span className="font-medium text-slate-600">Stack: {i.technologiesUsed}</span>}
                  </div>
                  <p className="text-[10.5px] text-slate-600 mt-2 whitespace-pre-line leading-relaxed">{i.description}</p>
                </div>
              ))}
            </div>
          </div>
        );
      case 'executive':
        return (
          <div className="space-y-3 font-serif pb-2 text-left">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-900 border-b border-emerald-100 pb-1 italic">Internship Records</h3>
            <div className="space-y-4">
              {list.map(i => (
                <div key={i.id} className="avoid-break">
                  <div className="flex justify-between items-baseline">
                    <h4 className="text-xs font-bold text-emerald-950">{i.role} — <span className="italic font-normal">{i.company}</span></h4>
                    <span className="text-[10px] text-emerald-800 font-medium italic">{i.startDate} - {i.endDate}</span>
                  </div>
                  <div className="flex justify-between text-[9.5px] text-gray-500 italic mt-0.5 pb-1">
                    <span>{i.location}</span>
                    {i.technologiesUsed && <span>Stack: {i.technologiesUsed}</span>}
                  </div>
                  <p className="text-[10.5px] text-gray-700 whitespace-pre-line leading-relaxed">{i.description}</p>
                </div>
              ))}
            </div>
          </div>
        );
      case 'creative':
        return (
          <div className="space-y-3 pb-2 text-left">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-violet-600 border-l-4 border-violet-500 pl-2">Internships & Co-ops</h3>
            <div className="space-y-4">
              {list.map(i => (
                <div key={i.id} className="avoid-break bg-violet-50/20 border border-violet-100/50 p-4 rounded-xl">
                  <div className="flex justify-between items-baseline flex-wrap gap-1">
                    <h4 className="text-xs font-bold text-violet-955">{i.role} / <span className="text-violet-600">{i.company}</span></h4>
                    <span className="text-[9px] font-bold text-violet-600 bg-violet-100/60 px-2 py-0.5 rounded">{i.startDate} - {i.endDate}</span>
                  </div>
                  <div className="flex justify-between text-[9.5px] text-gray-400 font-bold mt-1">
                    <span>{i.location}</span>
                    {i.technologiesUsed && <span className="text-violet-600">Tags: {i.technologiesUsed}</span>}
                  </div>
                  <p className="text-[10.5px] text-gray-600 mt-2 whitespace-pre-line leading-relaxed">{i.description}</p>
                </div>
              ))}
            </div>
          </div>
        );
      case 'atsFriendly':
        return (
          <div className="space-y-2 pb-2 text-left">
            <h3 className="text-xs font-bold uppercase tracking-wider text-black border-b border-black pb-0.5 font-sans">INTERNSHIPS</h3>
            <div className="space-y-3">
              {list.map(i => (
                <div key={i.id} className="avoid-break">
                  <div className="flex justify-between items-baseline font-sans">
                    <h4 className="text-xs font-bold text-black">{i.company} — <span className="font-normal">{i.role}</span></h4>
                    <span className="text-xs text-black font-medium">{i.startDate} – {i.endDate}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-black italic">
                    <span>{i.location}</span>
                    {i.technologiesUsed && <span>Stack: {i.technologiesUsed}</span>}
                  </div>
                  <p className="text-[11px] text-black mt-1 whitespace-pre-line leading-relaxed">{i.description}</p>
                </div>
              ))}
            </div>
          </div>
        );
      case 'softwareEngineer':
        return (
          <div className="space-y-3 font-mono pb-2 text-left">
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-650 border-b-2 border-indigo-200 pb-1">&lt;Internships /&gt;</h3>
            <div className="space-y-4">
              {list.map(i => (
                <div key={i.id} className="avoid-break border border-slate-100 p-3.5 rounded-lg bg-slate-50/30 font-mono">
                  <div className="flex justify-between items-baseline">
                    <h4 className="text-xs font-bold text-slate-900">{i.role} @ <span className="text-indigo-650">{i.company}</span></h4>
                    <span className="text-[9.5px] text-zinc-500">{i.startDate} - {i.endDate}</span>
                  </div>
                  <div className="flex justify-between text-[9.5px] text-gray-400 mt-1">
                    <span>{i.location}</span>
                    {i.technologiesUsed && <span className="text-emerald-600">env: [{i.technologiesUsed}]</span>}
                  </div>
                  <p className="text-[10.5px] text-slate-650 mt-2 whitespace-pre-line leading-relaxed font-mono">{i.description}</p>
                </div>
              ))}
            </div>
          </div>
        );
      case 'student':
        return (
          <div className="space-y-3 pb-2 text-left">
            <h3 className="text-xs font-bold uppercase tracking-wider text-violet-700 border-b border-violet-100 pb-1">Internships & Co-op Placement</h3>
            <div className="space-y-3">
              {list.map(i => (
                <div key={i.id} className="avoid-break border border-slate-50 p-3.5 rounded-xl bg-slate-50/40">
                  <div className="flex justify-between items-baseline">
                    <h4 className="text-xs font-bold text-violet-955">{i.role}</h4>
                    <span className="text-[9.5px] font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full">{i.startDate} - {i.endDate}</span>
                  </div>
                  <p className="text-[10.5px] text-gray-500 font-medium">{i.company}, {i.location}</p>
                  {i.technologiesUsed && <p className="text-[10px] text-violet-600 mt-1 font-semibold">Core: {i.technologiesUsed}</p>}
                  <p className="text-[10.5px] text-gray-600 mt-2 whitespace-pre-line leading-relaxed">{i.description}</p>
                </div>
              ))}
            </div>
          </div>
        );
      case 'startup':
        return (
          <div className="space-y-3 pb-2 text-left">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">Internships</h3>
            <div className="space-y-4">
              {list.map(i => (
                <div key={i.id} className="avoid-break">
                  <div className="flex justify-between items-baseline">
                    <h4 className="text-xs font-extrabold text-slate-900">{i.role} / <span className="text-slate-500 font-semibold">{i.company}</span></h4>
                    <span className="text-[10px] text-zinc-500 font-bold">{i.startDate} - {i.endDate}</span>
                  </div>
                  <p className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wide">{i.location} {i.technologiesUsed ? `| [${i.technologiesUsed}]` : ''}</p>
                  <p className="text-[10.5px] text-slate-650 mt-1.5 whitespace-pre-line leading-relaxed pr-4">{i.description}</p>
                </div>
              ))}
            </div>
          </div>
        );
      case 'designer':
        return (
          <div className="space-y-3 pb-2 text-left">
            <h3 className="text-xs font-bold uppercase tracking-wider text-violet-650 border-b border-violet-100 pb-1">Internship Placements</h3>
            <div className="space-y-4">
              {list.map(i => (
                <div key={i.id} className="avoid-break bg-violet-50/10 border border-violet-100/20 p-4 rounded-xl">
                  <div className="flex justify-between items-baseline">
                    <h4 className="text-xs font-extrabold text-violet-955">{i.role} with <span className="text-violet-600">{i.company}</span></h4>
                    <span className="text-[9.5px] font-bold text-violet-650 bg-violet-50 px-2 py-0.5 rounded">{i.startDate} – {i.endDate}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400 font-bold mt-1">
                    <span>{i.location}</span>
                    {i.technologiesUsed && <span className="text-violet-600 bg-violet-100/20 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase">Tech: {i.technologiesUsed}</span>}
                  </div>
                  <p className="text-[10.5px] text-gray-655 mt-2.5 whitespace-pre-line leading-relaxed">{i.description}</p>
                </div>
              ))}
            </div>
          </div>
        );
      case 'dataAnalyst':
        return (
          <div className="space-y-3 pb-2 text-left">
            <h3 className="text-xs font-bold uppercase tracking-wider text-teal-700 border-l-4 border-teal-700 pl-3 pb-0.5">Internships & Co-ops</h3>
            <div className="space-y-3">
              {list.map(i => (
                <div key={i.id} className="avoid-break bg-teal-50/20 border border-teal-100/40 p-4 rounded-xl">
                  <div className="flex justify-between items-baseline">
                    <h4 className="text-xs font-bold text-teal-950">{i.role} / <span className="text-teal-700">{i.company}</span></h4>
                    <span className="text-[9.5px] font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full">{i.startDate} - {i.endDate}</span>
                  </div>
                  <p className="text-[10px] text-gray-500 font-medium tracking-wide mt-1">{i.location} {i.technologiesUsed ? `| Tools: ${i.technologiesUsed}` : ''}</p>
                  <p className="text-[10.5px] text-gray-655 mt-2 whitespace-pre-line leading-relaxed">{i.description}</p>
                </div>
              ))}
            </div>
          </div>
        );
      case 'classic':
      default:
        return (
          <div className="space-y-3 pb-2 text-left">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900 border-b border-gray-300 pb-0.5 text-center font-serif italic">Internships</h3>
            <div className="space-y-4">
              {list.map(i => (
                <div key={i.id} className="avoid-break font-serif">
                  <div className="flex justify-between items-baseline">
                    <h4 className="text-xs font-bold text-gray-955">{i.role} — <span className="font-normal italic">{i.company}</span></h4>
                    <span className="text-[10.5px] text-gray-600 font-medium italic">{i.startDate} - {i.endDate}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400 italic mt-0.5 pb-1">
                    <span>{i.location}</span>
                    {i.technologiesUsed && <span className="font-sans text-[9px] bg-gray-100 text-gray-700 px-1 py-0.5 rounded font-bold">Stack: {i.technologiesUsed}</span>}
                  </div>
                  <p className="text-[11px] text-gray-800 whitespace-pre-line leading-relaxed">{i.description}</p>
                </div>
              ))}
            </div>
          </div>
        );
    }
  };

  const renderSupplementalSections = (handledSections: Set<string>) => {
    const theme = getTemplateTheme(selectedTemplate);
    const sectionIds = sectionOrder;
    const headingClass = `text-xs font-bold uppercase tracking-wider ${theme.headingColor} border-b border-gray-200 pb-1`;

    return sectionIds.map(sectionId => {
      if (handledSections.has(sectionId) || !isSectionVisible(sectionId)) return null;

      const customSection = customSections.find(section => section.id === sectionId);
      if (customSection) return renderCustomSection(selectedTemplate, customSection);

      if (sectionId === 'summary' && summary) {
        return (
          <section key={sectionId} className="avoid-break space-y-2 text-left">
            <h3 className={headingClass}>Professional Summary</h3>
            <p className="whitespace-pre-wrap text-[10.5px] leading-relaxed text-gray-700">{summary}</p>
          </section>
        );
      }

      if (sectionId === 'internships' && (resume.internships || []).length > 0) {
        return <React.Fragment key={sectionId}>{renderInternships(selectedTemplate, resume.internships || [])}</React.Fragment>;
      }

      if (sectionId === 'experience' && experience.length > 0) {
        return (
          <section key={sectionId} className="resume-section resume-section-experience space-y-3 text-left">
            <h3 className={`resume-section-heading ${headingClass}`}>Professional Experience</h3>
            {experience.map(entry => (
              <article key={entry.id} className="resume-section-item avoid-break">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h4 className="text-xs font-bold text-gray-900">{entry.title} | {entry.company}</h4>
                  <span className="text-[9.5px] font-semibold text-gray-500">{entry.startDate} - {entry.endDate}</span>
                </div>
                {entry.location && <p className="text-[9.5px] text-gray-500">{entry.location}</p>}
                {entry.description && <p className="mt-1 whitespace-pre-line text-[10.5px] leading-relaxed text-gray-700">{entry.description}</p>}
              </article>
            ))}
          </section>
        );
      }

      if (sectionId === 'education' && education.length > 0) {
        return (
          <section key={sectionId} className="resume-section resume-section-education space-y-3 text-left">
            <h3 className={`resume-section-heading ${headingClass}`}>Education</h3>
            {education.map(entry => (
              <article key={entry.id} className="resume-section-item avoid-break">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h4 className="text-xs font-bold text-gray-900">{entry.degree}</h4>
                  <span className="text-[9.5px] font-semibold text-gray-500">{entry.startDate} - {entry.endDate}</span>
                </div>
                <p className="text-[10px] text-gray-600">{[entry.institution, entry.location].filter(Boolean).join(', ')}</p>
                {entry.gpa && <p className="text-[9.5px] font-semibold text-gray-600">GPA: {entry.gpa}</p>}
                {entry.description && <p className="mt-1 whitespace-pre-line text-[10.5px] text-gray-700">{entry.description}</p>}
              </article>
            ))}
          </section>
        );
      }

      if (sectionId === 'skills' && hasSkills) {
        const skillRows = [
          ['Programming Languages', skills.programmingLanguages],
          ['Frameworks', skills.frameworks],
          ['Tools', skills.tools],
          ['Databases', skills.databases],
          ['Soft Skills', skills.softSkills],
        ] as const;
        return (
          <section key={sectionId} className="avoid-break space-y-2 text-left">
            <h3 className={headingClass}>Skills</h3>
            {skillRows.map(([label, values]) => values.length > 0 && (
              <p key={label} className="text-[10.5px] text-gray-700">
                <strong>{label}:</strong> {values.join(', ')}
              </p>
            ))}
          </section>
        );
      }

      if (sectionId === 'projects' && projects.length > 0) {
        return (
          <section key={sectionId} className="resume-section resume-section-projects space-y-3 text-left">
            <h3 className={`resume-section-heading ${headingClass}`}>Projects</h3>
            {projects.map(project => (
              <article key={project.id} className="resume-section-item avoid-break">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h4 className="text-xs font-bold text-gray-900">{project.name}</h4>
                  <div className="flex gap-2 text-[9.5px] font-semibold">
                    <ResumeLink url={project.github} label="GitHub" className="text-blue-700" />
                    <ResumeLink url={project.live} label="Live Project" className="text-blue-700" />
                  </div>
                </div>
                {project.technologies && <p className="text-[9.5px] font-semibold text-gray-600">Technologies: {project.technologies}</p>}
                {project.description && <p className="mt-1 whitespace-pre-line text-[10.5px] leading-relaxed text-gray-700">{project.description}</p>}
              </article>
            ))}
          </section>
        );
      }

      if (sectionId === 'certifications' && certifications.length > 0) {
        return (
          <section key={sectionId} className="resume-section resume-section-certifications space-y-2 text-left">
            <h3 className={`resume-section-heading ${headingClass}`}>Certifications</h3>
            {certifications.map(certification => (
              <div key={certification.id} className="resume-section-item avoid-break text-[10.5px] text-gray-700">
                <strong>{certification.name}</strong>
                {certification.issuer && ` | ${certification.issuer}`}
                {certification.date && ` | ${certification.date}`}
                {certification.url && <> | <ResumeLink url={certification.url} label="Credential" className="text-blue-700" /></>}
              </div>
            ))}
          </section>
        );
      }

      if (sectionId === 'achievements' && achievements.length > 0) {
        return (
          <section key={sectionId} className="avoid-break space-y-2 text-left">
            <h3 className={headingClass}>Achievements</h3>
            <ul className="list-disc space-y-1 pl-4 text-[10.5px] text-gray-700">
              {achievements.map((achievement, index) => <li key={index}>{achievement}</li>)}
            </ul>
          </section>
        );
      }

      if (sectionId === 'volunteering' && volunteering.length > 0) {
        return (
          <section key={sectionId} className="space-y-3 text-left">
            <h3 className={headingClass}>Volunteering</h3>
            {volunteering.map(entry => (
              <article key={entry.id} className="avoid-break">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h4 className="text-xs font-bold text-gray-900">{entry.title} | {entry.company}</h4>
                  <span className="text-[9.5px] font-semibold text-gray-500">{entry.startDate} - {entry.endDate}</span>
                </div>
                {entry.location && <p className="text-[9.5px] text-gray-500">{entry.location}</p>}
                {entry.description && <p className="mt-1 whitespace-pre-line text-[10.5px] text-gray-700">{entry.description}</p>}
              </article>
            ))}
          </section>
        );
      }

      if (sectionId === 'languages' && languages.length > 0) {
        return (
          <section key={sectionId} className="avoid-break space-y-2 text-left">
            <h3 className={headingClass}>Languages</h3>
            <p className="text-[10.5px] text-gray-700">{languages.join(', ')}</p>
          </section>
        );
      }

      return null;
    });
  };

  // ==========================================
  // TEMPLATE 1: MODERN
  // ==========================================
  const renderModernLayout = () => {
    return (
      <div className="space-y-6 text-gray-850">
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b-2 border-indigo-500 avoid-break text-left">
          <div className="flex items-center gap-4">
            {renderProfilePhoto('h-16 w-16 rounded-xl border-2 border-indigo-100')}
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-gray-950 uppercase leading-none">
                {personalDetails.fullName || 'JANE SMITH'}
              </h1>
              <p className="text-sm font-bold tracking-wide uppercase mt-1.5 text-indigo-655">
                {personalDetails.professionalTitle || 'Software Architect'}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-start sm:items-end text-[10.5px] text-gray-500 space-y-0.5 text-left sm:text-right">
            {personalDetails.email && <span>{personalDetails.email}</span>}
            {personalDetails.phone && <span>{personalDetails.phone}</span>}
            {personalDetails.location && <span>{personalDetails.location}</span>}
            {renderContactLinks('justify-start sm:justify-end')}
          </div>
        </div>

        {/* Callout Summary */}
        {summary && isSectionVisible('summary') && (
          <div className="avoid-break bg-indigo-50/45 p-4 rounded-xl border border-indigo-100/50 text-left">
            <h3 className="text-[11px] font-bold tracking-widest text-indigo-650 uppercase mb-1">PROFESSIONAL SUMMARY</h3>
            <p className="text-[11px] text-gray-755 leading-relaxed whitespace-pre-wrap">{summary}</p>
          </div>
        )}

        {/* Content Body Grid */}
        <div className="space-y-6">
          {sectionOrder.map(secId => {
            if (!isSectionVisible(secId)) return null;

            // Handle Custom Sections
            const customSec = customSections.find(cs => cs.id === secId);
            if (customSec) {
              return renderCustomSection(selectedTemplate, customSec);
            }

            if (secId === 'internships' && (resume.internships || []).length > 0) {
              return renderInternships(selectedTemplate, resume.internships || []);
            }

            if (secId === 'experience' && experience.length > 0) {
              return (
                <div key={secId} className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-655 border-b border-indigo-100 pb-1 text-left">Professional Experience</h3>
                  <div className="space-y-3">
                    {experience.map(e => (
                      <div key={e.id} className="avoid-break bg-slate-50/70 border border-slate-100 p-4 rounded-xl relative hover:shadow-sm transition-all pl-6 text-left">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-l-xl"></div>
                        <div className="flex justify-between items-baseline flex-wrap">
                          <h4 className="text-xs font-bold text-gray-955">{e.title} / <span className="text-indigo-650 font-semibold">{e.company}</span></h4>
                          <span className="text-[9.5px] font-bold text-indigo-650 whitespace-nowrap bg-indigo-50/60 px-2 py-0.5 rounded-full">{e.startDate} - {e.endDate}</span>
                        </div>
                        <p className="text-[10px] text-gray-400 font-bold mb-2">{e.location}</p>
                        <p className="text-[10.5px] text-gray-650 whitespace-pre-line leading-relaxed">{e.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            if (secId === 'education' && education.length > 0) {
              return (
                <div key={secId} className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-655 border-b border-indigo-100 pb-1 text-left">Education & Study</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                    {education.map(edu => (
                      <div key={edu.id} className="avoid-break border border-slate-100 p-3.5 rounded-xl bg-white hover:border-indigo-100 transition-all text-left">
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="text-xs font-bold text-slate-900">{edu.degree}</h4>
                          <span className="text-[9px] text-gray-405 font-semibold whitespace-nowrap">{edu.startDate} - {edu.endDate}</span>
                        </div>
                        <p className="text-[10.5px] text-slate-705 mt-0.5">{edu.institution}, {edu.location}</p>
                        {edu.gpa && <p className="text-[10px] font-bold text-indigo-600 mt-1">GPA: {edu.gpa}</p>}
                        {edu.description && <p className="text-[10px] text-gray-500 mt-1 italic">{edu.description}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            if (secId === 'projects' && projects.length > 0) {
              return (
                <div key={secId} className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-655 border-b border-indigo-105 pb-1 text-left">Engineering Projects</h3>
                  <div className="grid grid-cols-1 gap-3 text-left">
                    {projects.map(p => (
                      <div key={p.id} className="avoid-break bg-slate-50/40 border border-slate-100 p-4 rounded-xl text-left">
                        <div className="flex justify-between items-baseline flex-wrap gap-2">
                          <h4 className="text-xs font-bold text-slate-900">{p.name}</h4>
                          <div className="flex space-x-2 text-[9.5px]">
                            <ResumeLink url={p.github} label="GitHub" className="text-indigo-650 font-semibold" />
                            <ResumeLink url={p.live} label="Live Project" className="text-indigo-650 font-semibold" />
                          </div>
                        </div>
                        {p.technologies && <span className="text-[9px] font-semibold text-indigo-600 block mt-1 bg-indigo-50/40 px-1.5 py-0.5 rounded w-max">Stack: {p.technologies}</span>}
                        <p className="text-[10.5px] text-gray-655 mt-1.5 leading-relaxed">{p.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            if (secId === 'skills') {
              const hasSkills = Object.values(skills).some(s => s.length > 0);
              if (!hasSkills) return null;
              return (
                <div key={secId} className="avoid-break space-y-2 text-left">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-655 border-b border-indigo-100 pb-1">Skills & Stack</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {skills.programmingLanguages.length > 0 && (
                      <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                        <h4 className="text-[9.5px] font-bold uppercase text-slate-400">Languages</h4>
                        {renderSkillBadges(skills.programmingLanguages, 'modern')}
                      </div>
                    )}
                    {skills.frameworks.length > 0 && (
                      <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                        <h4 className="text-[9.5px] font-bold uppercase text-slate-400">Frameworks / APIs</h4>
                        {renderSkillBadges(skills.frameworks, 'modern')}
                      </div>
                    )}
                    {skills.databases.length > 0 && (
                      <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                        <h4 className="text-[9.5px] font-bold uppercase text-slate-400">Databases</h4>
                        {renderSkillBadges(skills.databases, 'modern')}
                      </div>
                    )}
                    {skills.tools.length > 0 && (
                      <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                        <h4 className="text-[9.5px] font-bold uppercase text-slate-400">Infrastructure / Tools</h4>
                        {renderSkillBadges(skills.tools, 'modern')}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            if (secId === 'certifications' && certifications.length > 0) {
              return (
                <div key={secId} className="avoid-break space-y-2 text-left">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-655 border-b border-indigo-100 pb-1">Certifications</h3>
                  <div className="flex flex-wrap gap-2">
                    {certifications.map(c => (
                      <div key={c.id} className="text-[10px] bg-slate-50 p-2.5 rounded-lg border border-slate-100 shrink-0">
                        <span className="font-bold text-slate-900 block">{c.name}</span>
                        <span className="text-indigo-650 text-[8.5px] block font-bold mt-0.5">{c.issuer} • {c.date}</span>
                        <ResumeLink url={c.url} label="Credential" className="mt-1 inline-block text-[9px] text-indigo-700" />
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            if (secId === 'achievements' && achievements.length > 0) {
              return (
                <div key={secId} className="avoid-break space-y-2 text-left">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-655 border-b border-indigo-100 pb-1">Achievements</h3>
                  <ul className="list-disc pl-4 text-[11px] text-gray-600 space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-100 font-sans">
                    {achievements.map((a, idx) => <li key={idx} className="marker:text-indigo-500">{a}</li>)}
                  </ul>
                </div>
              );
            }

            if (secId === 'languages' && languages.length > 0) {
              return (
                <div key={secId} className="avoid-break space-y-1 text-left">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-655 border-b border-indigo-100 pb-1">Languages</h3>
                  <span className="text-[11.5px] text-gray-750 italic block mt-1 font-semibold">{languages.join(' • ')}</span>
                </div>
              );
            }

            return null;
          })}
        </div>
      </div>
    );
  };

  // ==========================================
  // TEMPLATE 2: MINIMAL
  // ==========================================
  const renderMinimalLayout = () => {
    return (
      <div className="space-y-6 max-w-[650px] mx-auto text-gray-800 leading-normal font-sans">
        {/* Minimal Centered Header */}
        <div className="text-center py-4 border-none avoid-break">
          {renderProfilePhoto('mx-auto mb-4 h-20 w-20 rounded-full border border-slate-200 shadow-sm')}
          <h1 className="text-3xl font-light tracking-widest text-slate-900 uppercase">
            {personalDetails.fullName || 'JANE SMITH'}
          </h1>
          <p className="text-xs tracking-widest text-slate-400 uppercase mt-1 font-sans">
            {personalDetails.professionalTitle || 'Software Architect'}
          </p>
          <div className="mt-4 flex flex-wrap justify-center items-center gap-x-3 gap-y-1 text-[10px] text-slate-500 tracking-wider font-light uppercase">
            {personalDetails.email && <span>{personalDetails.email}</span>}
            {personalDetails.phone && <span>/ {personalDetails.phone}</span>}
            {personalDetails.location && <span>/ {personalDetails.location}</span>}
            {renderContactLinks('justify-center')}
          </div>
        </div>

        {/* Minimal Summary */}
        {summary && isSectionVisible('summary') && (
          <div className="avoid-break text-center py-2 px-6">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-700 mb-2">
              PROFESSIONAL SUMMARY
            </h3>
            <p className="text-[11px] text-slate-500 font-light tracking-wide leading-relaxed italic pr-4 whitespace-pre-wrap">{summary}</p>
          </div>
        )}

        {/* Dense Stacked Sections */}
        <div className="space-y-6">
          {sectionOrder.map(secId => {
            if (!isSectionVisible(secId)) return null;

            // Handle Custom Sections
            const customSec = customSections.find(cs => cs.id === secId);
            if (customSec) {
              return renderCustomSection(selectedTemplate, customSec);
            }

            if (secId === 'internships' && (resume.internships || []).length > 0) {
              return renderInternships(selectedTemplate, resume.internships || []);
            }

            if (secId === 'experience' && experience.length > 0) {
              return (
                <div key={secId} className="space-y-3">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-955 border-none pb-0 text-center font-sans">EXPERIENCE</h3>
                  <div className="space-y-4">
                    {experience.map(e => (
                      <div key={e.id} className="avoid-break text-left">
                        <div className="flex justify-between items-baseline font-sans">
                          <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">{e.company} — <span className="font-light text-slate-500">{e.title}</span></h4>
                          <span className="text-[9.5px] font-light text-slate-400 whitespace-nowrap">{e.startDate} – {e.endDate}</span>
                        </div>
                        <p className="text-[9px] text-slate-400 tracking-wide uppercase mt-0.5">{e.location}</p>
                        <p className="text-[10.5px] text-slate-605 mt-1 whitespace-pre-line leading-relaxed font-light">{e.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            if (secId === 'education' && education.length > 0) {
              return (
                <div key={secId} className="space-y-3">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-955 text-center font-sans">EDUCATION</h3>
                  <div className="space-y-3 text-left">
                    {education.map(edu => (
                      <div key={edu.id} className="avoid-break">
                        <div className="flex justify-between items-baseline font-sans">
                          <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">{edu.degree}</h4>
                          <span className="text-[9.5px] font-light text-slate-400">{edu.startDate} – {edu.endDate}</span>
                        </div>
                        <p className="text-[10px] text-slate-505 font-medium">{edu.institution} {edu.gpa && `/ GPA ${edu.gpa}`}</p>
                        {edu.description && <p className="text-[10px] text-gray-400 italic font-light mt-0.5">{edu.description}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            if (secId === 'projects' && projects.length > 0) {
              return (
                <div key={secId} className="space-y-3">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-955 text-center font-sans">PROJECTS</h3>
                  <div className="space-y-3 text-left">
                    {projects.map(p => (
                      <div key={p.id} className="avoid-break font-sans">
                        <div className="flex justify-between items-baseline font-sans">
                          <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-widest">{p.name}</h4>
                          <div className="flex space-x-2 text-[9px] text-slate-400">
                            <ResumeLink url={p.github} label="GitHub" />
                            <ResumeLink url={p.live} label="Live Project" />
                          </div>
                        </div>
                        {p.technologies && <span className="text-[9px] italic text-slate-400 block font-light select-all">Tools: {p.technologies}</span>}
                        <p className="text-[10.5px] text-slate-605 mt-1 font-light leading-relaxed whitespace-pre-wrap">{p.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            if (secId === 'skills') {
              const hasSkills = Object.values(skills).some(s => s.length > 0);
              if (!hasSkills) return null;
              return (
                <div key={secId} className="avoid-break space-y-2">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-955 text-center font-sans">SKILLS</h3>
                  <div className="text-[10.5px] text-slate-600 font-light space-y-1 shadow-none text-left">
                    {skills.programmingLanguages.length > 0 && (
                      <p><strong>Languages:</strong> {skills.programmingLanguages.join(', ')}</p>
                    )}
                    {skills.frameworks.length > 0 && (
                      <p><strong>Libraries / Web:</strong> {skills.frameworks.join(', ')}</p>
                    )}
                    {skills.databases.length > 0 && (
                      <p><strong>Storage Systems:</strong> {skills.databases.join(', ')}</p>
                    )}
                  </div>
                </div>
              );
            }

            return null;
          })}
        </div>
      </div>
    );
  };

  // ==========================================
  // TEMPLATE 3: CORPORATE
  // ==========================================
  const renderCorporateLayout = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 leading-relaxed font-sans text-left">
        {/* LEFT COLUMN: 1/3 SIDEBAR */}
        <div className="md:col-span-1 bg-slate-50 border border-slate-200 p-5 rounded-xl space-y-5 flex flex-col justify-start text-left">
          {/* Picture if exists */}
          {renderProfilePhoto('h-24 w-24 rounded-full border-4 border-white shadow-sm mx-auto mb-2')}

          {/* Contact Details Block */}
          <div className="space-y-2 avoid-break text-left">
            <h3 className="text-xs font-bold border-b border-slate-200 tracking-wider text-slate-800 pb-1">CONTACT INFO</h3>
            <div className="text-[10px] space-y-1.5 text-gray-600 font-sans break-all text-left">
              {personalDetails.email && <div className="font-semibold">{personalDetails.email}</div>}
              {personalDetails.phone && <div>{personalDetails.phone}</div>}
              {personalDetails.location && <div>{personalDetails.location}</div>}
              {renderContactLinks('flex-col items-start')}
            </div>
          </div>

          {/* Skills categorised */}
          {hasSkills && isSectionVisible('skills') && (
            <div className="space-y-3 avoid-break text-left">
              <h3 className="text-xs font-bold border-b border-slate-205 tracking-wider text-slate-850 pb-1">COMPETENCIES</h3>
              {skills.programmingLanguages.length > 0 && (
                <div>
                  <h4 className="text-[9px] uppercase font-bold text-slate-400">Languages</h4>
                  {renderSkillBadges(skills.programmingLanguages, 'corporate')}
                </div>
              )}
              {skills.frameworks.length > 0 && (
                <div>
                  <h4 className="text-[9px] uppercase font-bold text-slate-400 mt-2">Frameworks</h4>
                  {renderSkillBadges(skills.frameworks, 'corporate')}
                </div>
              )}
              {skills.databases.length > 0 && (
                <div>
                  <h4 className="text-[9px] uppercase font-bold text-slate-400 mt-2">Databases</h4>
                  {renderSkillBadges(skills.databases, 'corporate')}
                </div>
              )}
            </div>
          )}

          {/* Languages */}
          {languages.length > 0 && isSectionVisible('languages') && (
            <div className="space-y-1.5 avoid-break">
              <h3 className="text-xs font-bold border-b border-slate-205 tracking-wider text-slate-855 pb-1">LANGUAGES</h3>
              <ul className="text-[11px] text-gray-655 mt-1 list-disc pl-3.5">
                {languages.map((l, i) => <li key={i}>{l}</li>)}
              </ul>
            </div>
          )}

          {/* Certifications inside Sidebar */}
          {certifications.length > 0 && isSectionVisible('certifications') && (
            <div className="space-y-2 avoid-break font-sans">
              <h3 className="text-xs font-bold border-b border-slate-205 tracking-wider text-slate-850 pb-1">CERTIFICATIONS</h3>
              <div className="space-y-2 text-[10px] text-gray-655">
                {certifications.map(c => (
                  <div key={c.id}>
                    <p className="font-bold text-slate-900">{c.name}</p>
                    <p className="italic text-[9.5px] mt-0.5">{c.issuer} ({c.date})</p>
                    <ResumeLink url={c.url} label="Credential" className="text-[9px] text-slate-700" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: 2/3 MAIN BODY */}
        <div className="md:col-span-2 space-y-5 text-left font-sans animate-none">
          {/* Grand Header Panel */}
          <div className="avoid-break pb-1 border-b-2 border-slate-700">
            <h1 className="text-3xl font-extrabold text-slate-900 uppercase tracking-tight font-sans">
              {personalDetails.fullName || 'JANE SMITH'}
            </h1>
            <p className="text-sm font-semibold tracking-wider text-slate-650 uppercase mt-0.5 font-sans">
              {personalDetails.professionalTitle || 'Software Architect'}
            </p>
          </div>

          {/* Executive Summary */}
          {summary && isSectionVisible('summary') && (
            <div className="avoid-break text-left">
              <h3 className="text-[10px] font-bold text-slate-800 uppercase tracking-widest border-b border-slate-200 pb-1 mb-2">
                PROFESSIONAL SUMMARY
              </h3>
              <p className="text-[11px] text-slate-700 leading-relaxed whitespace-pre-wrap">{summary}</p>
            </div>
          )}

          {/* Stacked remaining options */}
          <div className="space-y-5">
            {sectionOrder.map(secId => {
              if (!isSectionVisible(secId)) return null;

              if (secId === 'internships' && (resume.internships || []).length > 0) {
                return renderInternships(selectedTemplate, resume.internships || []);
              }

              if (secId === 'experience' && experience.length > 0) {
                return (
                  <div key={secId} className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-850 uppercase tracking-widest border-b border-slate-200 pb-1 text-left font-sans">Professional Experience</h3>
                    <div className="space-y-3">
                      {experience.map(e => (
                        <div key={e.id} className="avoid-break text-left font-sans">
                          <div className="flex justify-between items-baseline flex-wrap">
                            <h4 className="text-xs font-bold text-slate-955 uppercase">{e.title} / <span className="font-semibold text-slate-650">{e.company}</span></h4>
                            <span className="text-[9.5px] font-bold text-slate-505 whitespace-nowrap">{e.startDate} - {e.endDate}</span>
                          </div>
                          <p className="text-[9.5px] text-slate-400 italic mb-1 font-semibold">{e.location}</p>
                          <p className="text-[11px] text-slate-650 whitespace-pre-line leading-relaxed font-sans">{e.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              if (secId === 'projects' && projects.length > 0) {
                return (
                  <div key={secId} className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-855 uppercase tracking-widest border-b border-slate-200 pb-1 text-left font-sans">Engineering Projects</h3>
                    <div className="space-y-3">
                      {projects.map(p => (
                        <div key={p.id} className="avoid-break text-left">
                          <div className="flex justify-between items-baseline flex-wrap font-sans">
                            <h4 className="text-xs font-bold text-slate-955 uppercase">{p.name}</h4>
                            <div className="flex space-x-2 text-[9px] text-slate-400 font-semibold select-all">
                              <ResumeLink url={p.github} label="GitHub" />
                              <ResumeLink url={p.live} label="Live Project" />
                            </div>
                          </div>
                          {p.technologies && <span className="text-[9px] font-semibold text-indigo-700 font-mono">Tech: {p.technologies}</span>}
                          <p className="text-[11px] text-slate-605 mt-1 whitespace-pre-wrap leading-relaxed pr-1">{p.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              if (secId === 'education' && education.length > 0) {
                return (
                  <div key={secId} className="space-y-3 animate-none">
                    <h3 className="text-xs font-bold text-slate-855 uppercase tracking-widest border-b border-slate-200 pb-1 text-left font-sans">Academic Foundation</h3>
                    <div className="space-y-2">
                      {education.map(edu => (
                        <div key={edu.id} className="avoid-break text-left font-sans">
                          <div className="flex justify-between items-baseline font-sans">
                            <h4 className="text-xs font-bold text-slate-950 uppercase">{edu.degree}</h4>
                            <span className="text-[9.5px] font-bold text-slate-500">{edu.startDate} - {edu.endDate}</span>
                          </div>
                          <p className="text-[10px] text-gray-500 font-bold">{edu.institution}, {edu.location} {edu.gpa && `- GPA: ${edu.gpa}`}</p>
                          {edu.description && <p className="text-[10px] text-gray-400 mt-0.5 italic pr-1">{edu.description}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              return null;
            })}
          </div>
        </div>
      </div>
    );
  };

  // ==========================================
  // TEMPLATE 4: EXECUTIVE (Executive Boardroom)
  // ==========================================
  const renderExecutiveLayout = () => {
    return (
      <div className="space-y-6 text-gray-800">
        {/* Centered Traditional Boardroom Letterhead */}
        <div className="text-center pb-3 border-b-2 border-double border-emerald-800 avoid-break font-serif">
          {renderProfilePhoto('mx-auto mb-3 h-20 w-20 rounded-full border-2 border-emerald-100 shadow-sm')}
          <h1 className="text-3xl font-bold tracking-widest text-emerald-955 italic font-serif">
            {personalDetails.fullName || 'JANE SMITH'}
          </h1>
          <p className="text-xs font-semibold tracking-widest text-emerald-805 uppercase mt-1 font-serif">
            {personalDetails.professionalTitle || 'Executive Software Architect'}
          </p>
          <div className="mt-3 flex flex-wrap justify-center items-center gap-x-4 gap-y-1 text-[10px] text-emerald-900 font-sans tracking-wide uppercase">
            {personalDetails.email && <span>{personalDetails.email}</span>}
            {personalDetails.phone && <span>• {personalDetails.phone}</span>}
            {personalDetails.location && <span>• {personalDetails.location}</span>}
            {renderContactLinks('justify-center')}
          </div>
        </div>

        {/* Boardroom Summary Blockquote */}
        {summary && isSectionVisible('summary') && (
          <div className="avoid-break border-l-4 border-emerald-850 pl-4 py-1 italic text-left">
            <h3 className="text-[10px] font-bold tracking-widest text-emerald-850 uppercase mb-0.5 font-sans justify-start text-left">PROFESSIONAL SUMMARY</h3>
            <p className="text-[11.5px] text-gray-755 leading-relaxed font-serif whitespace-pre-wrap">{summary}</p>
          </div>
        )}

        {/* Double column tabular / grid layout */}
        <div className="space-y-6 text-left font-serif">
          {sectionOrder.map(secId => {
            if (!isSectionVisible(secId)) return null;

            if (secId === 'internships' && (resume.internships || []).length > 0) {
              return renderInternships(selectedTemplate, resume.internships || []);
            }

            if (secId === 'experience' && experience.length > 0) {
              return (
                <div key={secId} className="space-y-4">
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-emerald-955 border-b border-emerald-100 pb-1 font-serif text-left">Chronological Work Record</h3>
                  <div className="space-y-4">
                    {experience.map(e => (
                      <div key={e.id} className="avoid-break space-y-1 text-left font-serif leading-relaxed">
                        <div className="flex justify-between items-baseline flex-wrap font-serif">
                          <h4 className="text-xs font-bold text-emerald-955">{e.title} / <span className="text-emerald-900 italic font-bold">{e.company}</span></h4>
                          <span className="text-[10px] font-bold text-gray-500 font-sans">{e.startDate} – {e.endDate}</span>
                        </div>
                        <p className="text-[9.5px] text-gray-400 font-sans font-bold tracking-wide italic">{e.location}</p>
                        <p className="text-[11px] text-gray-700 leading-relaxed pr-3 whitespace-pre-line">{e.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            if (secId === 'skills') {
              const hasSkills = Object.values(skills).some(s => s.length > 0);
              if (!hasSkills) return null;
              return (
                <div key={secId} className="avoid-break space-y-3 font-sans">
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-emerald-955 border-b border-emerald-100 pb-1 text-left">Key Expertise</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[10.5px]">
                    {skills.programmingLanguages.length > 0 && (
                      <p><strong>Core Languages:</strong> {skills.programmingLanguages.join(', ')}</p>
                    )}
                    {skills.frameworks.length > 0 && (
                      <p><strong>Methodologies:</strong> {skills.frameworks.join(', ')}</p>
                    )}
                    {skills.databases.length > 0 && (
                      <p><strong>Database Tech:</strong> {skills.databases.join(', ')}</p>
                    )}
                  </div>
                </div>
              );
            }

            if (secId === 'education' && education.length > 0) {
              return (
                <div key={secId} className="space-y-3 font-serif">
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-emerald-955 border-b border-emerald-100 pb-1 font-serif text-left">Credentials & Academics</h3>
                  <div className="space-y-3 mt-1">
                    {education.map(edu => (
                      <div key={edu.id} className="avoid-break flex justify-between items-start flex-wrap gap-2 text-left">
                        <div className="text-left text-[11px] font-serif text-emerald-955 leading-relaxed">
                          <strong>{edu.degree}</strong> — <span className="text-slate-600">{edu.institution}, {edu.location}</span>
                          {edu.gpa && <span className="text-[10px] block font-bold text-emerald-900 font-sans mt-0.5">GPA: {edu.gpa}</span>}
                        </div>
                        <span className="text-[10px] font-bold text-gray-500 font-sans">{edu.startDate} – {edu.endDate}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            return null;
          })}
        </div>
      </div>
    );
  };

  // ==========================================
  // TEMPLATE 5: CREATIVE (Creative Layout)
  // ==========================================
  const renderCreativeLayout = () => {
    return (
      <div className="space-y-6 font-sans">
        {/* Creative Headline Block */}
        <div className="bg-gradient-to-r from-violet-600 via-indigo-600 to-indigo-700 text-white p-6 rounded-2xl flex flex-col justify-between items-start gap-4 avoid-break shadow-md text-left font-sans">
          {shouldUseProfilePhoto ? (
            <div className="flex w-full items-center justify-between gap-5">
              <div className="min-w-0">
                <h1 className="text-3xl font-extrabold tracking-tight text-white uppercase leading-none">
                  {personalDetails.fullName || 'JANE SMITH'}
                </h1>
                <p className="text-sm font-bold text-yellow-300 tracking-wider uppercase mt-1.5 font-sans">
                  {personalDetails.professionalTitle || 'Creative Technologist'}
                </p>
              </div>
              {renderProfilePhoto('h-20 w-20 rounded-2xl border-2 border-white/70 shadow-md')}
            </div>
          ) : (
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white uppercase leading-none">
                {personalDetails.fullName || 'JANE SMITH'}
              </h1>
              <p className="text-sm font-bold text-yellow-300 tracking-wider uppercase mt-1.5 font-sans">
                {personalDetails.professionalTitle || 'Creative Technologist'}
              </p>
            </div>
          )}
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-indigo-100 uppercase font-bold tracking-wide">
            {personalDetails.email && <span>{personalDetails.email}</span>}
            {personalDetails.phone && <span>/ {personalDetails.phone}</span>}
            {personalDetails.location && <span>/ {personalDetails.location}</span>}
            {renderContactLinks('text-yellow-200')}
          </div>
        </div>

        {/* Dynamic Split block */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 leading-relaxed font-sans text-left">
          {/* Main content body in creative */}
          <div className="md:col-span-2 space-y-5 text-left font-sans">
            {summary && isSectionVisible('summary') && (
              <div className="avoid-break bg-violet-100/25 p-4 rounded-xl border border-violet-100/50 text-left">
                <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-violet-700 mb-1">
                  PROFESSIONAL SUMMARY
                </h3>
                <p className="text-[11.5px] text-indigo-950 font-medium whitespace-pre-wrap leading-relaxed pr-2">{summary}</p>
              </div>
            )}

            {sectionOrder.map(secId => {
              if (!isSectionVisible(secId)) return null;

              if (secId === 'internships' && (resume.internships || []).length > 0) {
                return renderInternships(selectedTemplate, resume.internships || []);
              }

              if (secId === 'experience' && experience.length > 0) {
                return (
                  <div key={secId} className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-violet-600 border-b-2 border-violet-100 pb-1 text-left">Where I've Been</h3>
                    <div className="space-y-4">
                      {experience.map(e => (
                        <div key={e.id} className="avoid-break relative pl-5 text-left font-sans">
                          {/* Left bullet dot */}
                          <div className="absolute left-0 top-1.5 h-2.5 w-2.5 bg-violet-500 rounded-full"></div>
                          <div className="flex justify-between items-baseline flex-wrap font-sans">
                            <h4 className="text-xs font-extrabold text-indigo-955 uppercase">{e.title} at <span className="text-violet-600 font-bold">{e.company}</span></h4>
                            <span className="text-[9.5px] font-bold text-indigo-550 bg-indigo-50 px-2 py-0.5 rounded-md">{e.startDate} – {e.endDate}</span>
                          </div>
                          <p className="text-[9.5px] text-slate-400 italic mb-1 font-semibold">{e.location}</p>
                          <p className="text-[11px] text-slate-655 whitespace-pre-line leading-relaxed">{e.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              if (secId === 'projects' && projects.length > 0) {
                return (
                  <div key={secId} className="space-y-4 font-sans">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-violet-600 border-b-2 border-violet-100 pb-1 text-left">Creative Experiments</h3>
                    <div className="grid grid-cols-1 gap-3 font-sans">
                      {projects.map(p => (
                        <div key={p.id} className="avoid-break border border-slate-100 p-3.5 rounded-xl bg-slate-50/50 text-left font-sans">
                          <div className="flex justify-between items-baseline gap-2 font-sans">
                            <h4 className="text-xs font-bold text-slate-900 font-sans">{p.name}</h4>
                            <div className="flex space-x-2 text-[9px] text-violet-605 font-bold font-sans">
                              <ResumeLink url={p.github} label="GitHub" />
                              <ResumeLink url={p.live} label="Live Project" />
                            </div>
                          </div>
                          {p.technologies && <span className="text-[9px] font-bold text-indigo-500 font-mono block select-all mt-0.5">Stack: {p.technologies}</span>}
                          <p className="text-[11px] text-gray-655 mt-1 leading-relaxed whitespace-pre-wrap font-sans">{p.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              return null;
            })}
          </div>

          {/* Sidebar right side for Creative */}
          <div className="md:col-span-1 space-y-5 text-left font-sans text-left">
            {/* Skills categorised */}
            {hasSkills && isSectionVisible('skills') && (
              <div className="space-y-3 avoid-break">
                <h3 className="text-xs font-bold uppercase tracking-widest text-violet-600 border-b-2 border-violet-100 pb-1 font-sans">Tech Matrix</h3>
                {skills.programmingLanguages.length > 0 && (
                  <div>
                    <h4 className="text-[9.5px] font-bold uppercase text-indigo-950">Languages</h4>
                    {renderSkillBadges(skills.programmingLanguages, 'creative')}
                  </div>
                )}
                {skills.frameworks.length > 0 && (
                  <div>
                    <h4 className="text-[9.5px] font-bold uppercase text-indigo-955 mt-2">Frameworks</h4>
                    {renderSkillBadges(skills.frameworks, 'creative')}
                  </div>
                )}
              </div>
            )}

            {/* Academic details */}
            {education.length > 0 && isSectionVisible('education') && (
              <div className="space-y-3 avoid-break">
                <h3 className="text-xs font-bold uppercase tracking-widest text-violet-603 border-b-2 border-violet-100 pb-1">Schooling</h3>
                {education.map(edu => (
                  <div key={edu.id} className="text-[10.5px]">
                    <span className="font-bold text-indigo-950 block">{edu.degree}</span>
                    <span className="text-gray-500 block">{edu.institution}, {edu.location}</span>
                    <span className="text-[9px] font-bold text-violet-600 block mt-0.5">{edu.startDate} — {edu.endDate} {edu.gpa && `| GPA: ${edu.gpa}`}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ==========================================
  // TEMPLATE 6: ATS FRIENDLY
  // ==========================================
  const renderAtsFriendlyLayout = () => {
    return (
      <div className="space-y-4 max-w-[750px] mx-auto text-black font-sans leading-normal">
        {/* Strictly Standard Left Aligned Plain Text Header */}
        <div className="pb-1 border-b-2 border-black avoid-break text-left">
          {shouldUseProfilePhoto ? (
            <div className="flex items-start justify-between gap-5">
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-bold tracking-tight text-black uppercase leading-none select-all font-sans">
                  {personalDetails.fullName || 'JANE SMITH'}
                </h1>
                <p className="text-xs font-bold text-black uppercase tracking-wider mt-1.5 font-sans">
                  {personalDetails.professionalTitle || 'Software Architect'}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-gray-800 tracking-wide font-sans select-all font-semibold uppercase">
                  {personalDetails.email && <span>Email: {personalDetails.email}</span>}
                  {personalDetails.phone && <span>| Phone: {personalDetails.phone}</span>}
                  {personalDetails.location && <span>| Location: {personalDetails.location}</span>}
                  {renderContactLinks()}
                </div>
              </div>
              {renderProfilePhoto('h-16 w-16 rounded-sm border border-black')}
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold tracking-tight text-black uppercase leading-none select-all font-sans">
                {personalDetails.fullName || 'JANE SMITH'}
              </h1>
              <p className="text-xs font-bold text-black uppercase tracking-wider mt-1.5 font-sans">
                {personalDetails.professionalTitle || 'Software Architect'}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-gray-800 tracking-wide font-sans select-all font-semibold uppercase">
                {personalDetails.email && <span>Email: {personalDetails.email}</span>}
                {personalDetails.phone && <span>| Phone: {personalDetails.phone}</span>}
                {personalDetails.location && <span>| Location: {personalDetails.location}</span>}
                {renderContactLinks()}
              </div>
            </>
          )}
        </div>

        {/* ATS-friendly Summary */}
        {summary && isSectionVisible('summary') && (
          <div className="avoid-break pt-1 text-left font-sans">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-black border-b border-black pb-0.5 mb-1 select-all font-sans">PROFESSIONAL SUMMARY</h3>
            <p className="text-[10.5px] text-black pr-2 select-all leading-normal whitespace-pre-wrap font-sans">{summary}</p>
          </div>
        )}

        {/* Dense Stack of sections */}
        <div className="space-y-4 font-sans">
          {sectionOrder.map(secId => {
            if (!isSectionVisible(secId)) return null;

            // Handle Custom Sections
            const customSec = customSections.find(cs => cs.id === secId);
            if (customSec) {
              return renderCustomSection(selectedTemplate, customSec);
            }

            if (secId === 'internships' && (resume.internships || []).length > 0) {
              return renderInternships(selectedTemplate, resume.internships || []);
            }

            if (secId === 'experience' && experience.length > 0) {
              return (
                <div key={secId} className="space-y-2">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-black border-b border-black pb-0.5 select-all text-left font-sans">PROFESSIONAL EXPERIENCE</h3>
                  <div className="space-y-3">
                    {experience.map(e => (
                      <div key={e.id} className="avoid-break whitespace-pre-line text-[10.5px] select-all leading-normal text-left font-sans">
                        <div className="flex justify-between items-baseline font-bold font-sans">
                          <span>{e.company} — {e.title}</span>
                          <span className="whitespace-nowrap font-semibold">{e.startDate} - {e.endDate}</span>
                        </div>
                        <div className="text-[9.5px] text-black italic font-semibold">{e.location}</div>
                        <p className="text-[10.5px] text-black mt-1 font-sans font-medium whitespace-pre-line pr-2">{e.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            if (secId === 'projects' && projects.length > 0) {
              return (
                <div key={secId} className="space-y-2 font-sans">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-black border-b border-black pb-0.5 select-all text-left font-sans font-sans">TECHNICAL PROJECTS</h3>
                  <div className="space-y-2 text-left font-sans">
                    {projects.map(p => (
                      <div key={p.id} className="avoid-break text-[10.5px] select-all leading-normal text-left font-sans font-sans">
                        <div className="flex justify-between items-baseline font-bold gap-2">
                          <span>{p.name} {p.technologies && `(Stack: ${p.technologies})`}</span>
                        </div>
                        <p className="text-[10.5px] text-black mt-0.5 pr-2 whitespace-pre-wrap">{p.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            if (secId === 'education' && education.length > 0) {
              return (
                <div key={secId} className="space-y-2">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-black border-b border-black pb-0.5 select-all text-left font-sans">EDUCATION</h3>
                  <div className="space-y-2 text-left">
                    {education.map(edu => (
                      <div key={edu.id} className="avoid-break text-[10.5px] select-all leading-normal text-left font-sans">
                        <div className="flex justify-between items-baseline font-bold font-sans">
                          <span>{edu.degree} — {edu.institution}</span>
                          <span className="font-semibold whitespace-nowrap">{edu.startDate} - {edu.endDate}</span>
                        </div>
                        <p className="text-[10px] text-black mt-0.5 font-semibold">Location: {edu.location} {edu.gpa && `| GPA: ${edu.gpa}`}</p>
                        {edu.description && <p className="text-[10px] text-black mt-0.5 font-medium pr-2">{edu.description}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            if (secId === 'skills') {
              const hasSkills = Object.values(skills).some(s => s.length > 0);
              if (!hasSkills) return null;
              return (
                <div key={secId} className="avoid-break space-y-1 text-left font-sans text-left">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-black border-b border-black pb-0.5 select-all font-sans font-sans">SKILLS</h3>
                  <div className="text-[10px] text-black font-semibold space-y-0.5 text-left font-sans">
                    {skills.programmingLanguages.length > 0 && <p className="select-all">Languages & Runtimes: {skills.programmingLanguages.join(', ')}</p>}
                    {skills.frameworks.length > 0 && <p className="select-all">Frameworks & Libraries: {skills.frameworks.join(', ')}</p>}
                    {skills.databases.length > 0 && <p className="select-all">Databases: {skills.databases.join(', ')}</p>}
                  </div>
                </div>
              );
            }

            return null;
          })}
        </div>
      </div>
    );
  };

  // ==========================================
  // TEMPLATE 7: SOFTWARE ENGINEER (Technical Mono Split)
  // ==========================================
  const renderSoftwareEngineerLayout = () => {
    return (
      <div className="space-y-5 leading-normal font-mono">
        {/* Core Code Terminal Head */}
        <div className="pb-3 border border-slate-700 bg-slate-900 text-slate-100 p-5 rounded-xl flex flex-col sm:flex-row justify-between items-start gap-4 avoid-break font-mono select-none text-left">
          {shouldUseProfilePhoto ? (
            <div className="flex min-w-0 items-center gap-4">
              {renderProfilePhoto('h-20 w-20 rounded-lg border border-cyan-400/60')}
              <div>
                <span className="text-yellow-400 text-xs">const devCandidate = {'{'}</span>
                <h1 className="text-2xl font-bold tracking-tight text-white uppercase mt-1 pl-4">
                  fullName: "{personalDetails.fullName || 'JANE SMITH'}",
                </h1>
                <p className="text-xs font-bold text-indigo-305 mt-1 pl-4">
                  role: "{personalDetails.professionalTitle || 'Software Architect'}",
                </p>
                <span className="text-yellow-400 text-xs">{'}'}</span>
              </div>
            </div>
          ) : (
            <div>
              <span className="text-yellow-400 text-xs">const devCandidate = {'{'}</span>
              <h1 className="text-2xl font-bold tracking-tight text-white uppercase mt-1 pl-4">
                fullName: "{personalDetails.fullName || 'JANE SMITH'}",
              </h1>
              <p className="text-xs font-bold text-indigo-305 mt-1 pl-4">
                role: "{personalDetails.professionalTitle || 'Software Architect'}",
              </p>
              <span className="text-yellow-400 text-xs">{'}'}</span>
            </div>
          )}
          <div className="text-[9.5px] font-mono text-cyan-400 mt-2 pl-0 sm:pl-4 flex flex-col items-start gap-0.5">
            {personalDetails.email && <span>email: "{personalDetails.email}",</span>}
            {personalDetails.phone && <span>phone: "{personalDetails.phone}",</span>}
            {personalDetails.location && <span>location: "{personalDetails.location}",</span>}
            {renderContactLinks('text-cyan-400')}
          </div>
        </div>

        {/* Technical Double Stack */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-left">
          {/* Main Column */}
          <div className="md:col-span-2 space-y-5 font-mono text-left">
            {summary && isSectionVisible('summary') && (
              <div className="avoid-break border border-slate-200 font-mono p-4 rounded-xl bg-slate-50 text-[10.5px] text-left">
                <span className="text-indigo-650 font-bold block mb-1 font-mono">// PROFESSIONAL SUMMARY</span>
                <p className="text-slate-700 whitespace-pre-wrap leading-relaxed pr-1">{summary}</p>
              </div>
            )}

            {sectionOrder.map(secId => {
              if (!isSectionVisible(secId)) return null;

              if (secId === 'internships' && (resume.internships || []).length > 0) {
                return renderInternships(selectedTemplate, resume.internships || []);
              }

              if (secId === 'experience' && experience.length > 0) {
                return (
                  <div key={secId} className="space-y-3 font-mono">
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-655 border-b border-gray-200 pb-1 flex items-center gap-1.5 text-left font-mono">
                      <span className="text-violet-650 font-bold">class</span> WorkExperience {'{'}
                    </h3>
                    <div className="space-y-4 font-mono">
                      {experience.map(e => (
                        <div key={e.id} className="avoid-break pl-4 relative text-left font-mono">
                          <div className="absolute left-0 top-1 h-2 w-2 rounded bg-indigo-505"></div>
                          <div className="flex justify-between items-baseline flex-wrap gap-1 font-mono">
                            <h4 className="text-xs font-bold text-gray-950 font-mono">{e.title} at <span className="text-indigo-650 font-bold">{e.company}</span></h4>
                            <span className="text-[9px] font-mono font-semibold text-gray-400 whitespace-nowrap">{e.startDate} - {e.endDate}</span>
                          </div>
                          <p className="text-[10.5px] text-gray-600 mt-1 whitespace-pre-line leading-relaxed pr-1 font-mono">{e.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              if (secId === 'projects' && projects.length > 0) {
                return (
                  <div key={secId} className="space-y-3 font-mono">
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-655 border-b border-gray-200 pb-1 text-left font-mono animate-none">
                      <span className="text-violet-605 font-bold">const</span> personalProjects = [
                    </h3>
                    <div className="space-y-3 pl-4">
                      {projects.map(p => (
                        <div key={p.id} className="avoid-break border-l border-indigo-200 pl-3 text-left">
                          <div className="flex justify-between items-baseline flex-wrap font-mono">
                            <h4 className="text-xs font-bold text-slate-900 select-all font-mono">project: "{p.name}"</h4>
                          </div>
                          {p.technologies && <span className="text-[9px] font-bold text-gray-400 block mt-0.5 select-all font-mono">tech: [{p.technologies}]</span>}
                          <p className="text-[10.5px] text-gray-650 mt-1 pr-1">{p.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              return null;
            })}
          </div>

          {/* Right Column (Tech Skills and Credentials) */}
          <div className="md:col-span-1 space-y-4 font-mono text-left">
            {/* Categorized high density Skills listing */}
            {hasSkills && isSectionVisible('skills') && (
              <div className="space-y-3 avoid-break">
                <h3 className="text-[10px] font-bold text-indigo-655 border-b border-gray-200 pb-1 uppercase font-mono">// TECH MATRIX</h3>
                {skills.programmingLanguages.length > 0 && (
                  <div>
                    <h4 className="text-[9px] font-bold text-gray-400 font-mono">LANGUAGES</h4>
                    {renderSkillBadges(skills.programmingLanguages, 'softwareEngineer')}
                  </div>
                )}
                {skills.frameworks.length > 0 && (
                  <div>
                    <h4 className="text-[9px] font-bold text-gray-400 mt-2 font-mono">FRAMEWORKS</h4>
                    {renderSkillBadges(skills.frameworks, 'softwareEngineer')}
                  </div>
                )}
                {skills.databases.length > 0 && (
                  <div>
                    <h4 className="text-[9px] font-bold text-gray-400 mt-2 font-mono">DATABASES</h4>
                    {renderSkillBadges(skills.databases, 'softwareEngineer')}
                  </div>
                )}
              </div>
            )}

            {/* Academic details */}
            {education.length > 0 && isSectionVisible('education') && (
              <div className="space-y-3 avoid-break">
                <h3 className="text-[10px] font-bold text-indigo-655 border-b border-gray-200 pb-1 uppercase font-mono">// EDUCATION</h3>
                {education.map(edu => (
                  <div key={edu.id} className="text-[10px] space-y-0.5 font-mono">
                    <span className="font-bold text-gray-900 block">{edu.degree}</span>
                    <span className="text-gray-500 block">{edu.institution}</span>
                    <span className="text-[9px] font-bold text-indigo-500 block">{edu.startDate} - {edu.endDate} {edu.gpa && `• GPA: ${edu.gpa}`}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ==========================================
  // TEMPLATE 8: STUDENT (Academic Coursework First)
  // ==========================================
  const renderStudentLayout = () => {
    return (
      <div className="space-y-6 font-sans">
        {/* Clean student-friendly header block */}
        <div className="flex flex-col sm:flex-row justify-between items-center text-center sm:text-left gap-4 pb-4 border-b border-violet-205 avoid-break">
          {shouldUseProfilePhoto ? (
            <div className="flex items-center gap-4 text-left font-sans">
              {renderProfilePhoto('h-16 w-16 rounded-full border-2 border-violet-100')}
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-violet-950 uppercase leading-none">
                  {personalDetails.fullName || 'JANE SMITH'}
                </h1>
                <p className="text-sm font-semibold tracking-wider text-violet-605 uppercase mt-1.5">
                  Student / Candidate
                </p>
              </div>
            </div>
          ) : (
            <div className="text-left font-sans">
              <h1 className="text-3xl font-extrabold tracking-tight text-violet-950 uppercase leading-none">
                {personalDetails.fullName || 'JANE SMITH'}
              </h1>
              <p className="text-sm font-semibold tracking-wider text-violet-605 uppercase mt-1.5">
                Student / Candidate
              </p>
            </div>
          )}
          <div className="flex flex-col items-center sm:items-end text-[10px] text-gray-500 font-medium space-y-0.5 text-right font-sans">
            <span>{personalDetails.email}</span>
            <span>{personalDetails.phone}</span>
            <span>{personalDetails.location}</span>
          </div>
        </div>

        {summary && isSectionVisible('summary') && (
          <div className="avoid-break bg-violet-50/15 p-4 rounded-xl border border-violet-100 text-left">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-violet-600 mb-1 font-sans">PROFESSIONAL SUMMARY</h3>
            <p className="text-[11px] text-gray-600 leading-relaxed whitespace-pre-wrap pr-1 font-sans">{summary}</p>
          </div>
        )}

        {/* Academic priority list */}
        <div className="space-y-6 text-left font-sans">
          {/* 1. Placement of Education FIRST */}
          {education.length > 0 && isSectionVisible('education') && (
            <div className="space-y-3 font-sans">
              <h3 className="text-xs font-bold uppercase tracking-widest text-violet-605 border-b border-violet-100 pb-1 text-left font-sans">Education & Credentials</h3>
              <div className="space-y-3 font-sans">
                {education.map(edu => (
                  <div key={edu.id} className="avoid-break bg-white border border-violet-105 p-4 rounded-xl shadow-xs text-left font-sans">
                    <div className="flex justify-between items-baseline font-bold select-all gap-2 flex-wrap">
                      <span className="text-xs text-violet-950">{edu.degree} — <span className="text-gray-500 font-normal">{edu.institution}, {edu.location}</span></span>
                      <span className="text-[9.5px] font-medium text-gray-400 whitespace-nowrap">{edu.startDate} - {edu.endDate}</span>
                    </div>
                    {edu.gpa && <p className="text-[10px] font-bold text-violet-700 mt-1 select-all font-sans">Cumulative GPA: {edu.gpa}</p>}
                    <p className="text-[10.5px] text-gray-500 select-all mt-1 pr-1">{edu.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. Projects and Academic achievements */}
          {projects.length > 0 && isSectionVisible('projects') && (
            <div className="space-y-3 font-sans">
              <h3 className="text-xs font-bold uppercase tracking-widest text-violet-650 border-b border-violet-100 pb-1 text-left">Academic & Technical Projects</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                {projects.map(p => (
                  <div key={p.id} className="avoid-break bg-slate-50 border border-slate-100 p-3 rounded-lg text-left">
                    <h4 className="text-xs font-bold text-slate-900 select-all">{p.name}</h4>
                    {p.technologies && <span className="text-[9.5px] font-semibold text-violet-600 font-mono block mt-0.5 select-all">Tech Stack: {p.technologies}</span>}
                    <p className="text-[10.5px] text-slate-600 mt-1.5 leading-normal pr-1 whitespace-pre-wrap">{p.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Experiences and Internships */}
          {experience.length > 0 && isSectionVisible('experience') && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-violet-650 border-b border-violet-100 pb-1 text-left">Work History / Internships</h3>
              <div className="space-y-3">
                {experience.map(e => (
                  <div key={e.id} className="avoid-break select-all text-left">
                    <div className="flex justify-between items-baseline font-bold text-[11px] font-sans gap-2 flex-wrap">
                      <span>{e.company} — {e.title}</span>
                      <span className="text-[9.5px] font-medium text-gray-400">{e.startDate} - {e.endDate}</span>
                    </div>
                    <p className="text-[9.5px] text-gray-400 italic mb-1 font-semibold">{e.location}</p>
                    <p className="text-[10.5px] text-gray-600 mt-1 pr-1 font-sans leading-normal">{e.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ==========================================
  // TEMPLATE 9: STARTUP (Startup Growth Pitch)
  // ==========================================
  const renderStartupLayout = () => {
    return (
      <div className="space-y-5 flex flex-col items-stretch leading-relaxed font-sans text-left">
        {/* Startup Direct pitch header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b-2 border-emerald-500 avoid-break text-left font-sans">
          {shouldUseProfilePhoto ? (
            <div className="flex items-center gap-4">
              {renderProfilePhoto('h-16 w-16 rounded-xl border-2 border-emerald-100 shadow-sm')}
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 uppercase leading-none">
                  {personalDetails.fullName || 'JANE SMITH'}
                </h1>
                <p className="text-sm font-bold tracking-widest text-emerald-600 uppercase mt-1.5 font-sans">
                  {personalDetails.professionalTitle || 'Software Architect'}
                </p>
              </div>
            </div>
          ) : (
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 uppercase leading-none">
                {personalDetails.fullName || 'JANE SMITH'}
              </h1>
              <p className="text-sm font-bold tracking-widest text-emerald-600 uppercase mt-1.5 font-sans">
                {personalDetails.professionalTitle || 'Software Architect'}
              </p>
            </div>
          )}
          <div className="flex flex-col items-start sm:items-end text-[10px] text-slate-500 font-bold space-y-0.5 select-all font-sans text-left sm:text-right">
            {personalDetails.email && <span>{personalDetails.email}</span>}
            {personalDetails.phone && <span>{personalDetails.phone}</span>}
            {personalDetails.location && <span>{personalDetails.location}</span>}
          </div>
        </div>

        {/* Highlighted Elevator Summary */}
        {summary && isSectionVisible('summary') && (
          <div className="avoid-break text-center border-y border-slate-100 py-4 px-6 my-1 font-sans">
            <h4 className="text-[10.5px] font-extrabold uppercase text-emerald-700 tracking-wider">PROFESSIONAL SUMMARY</h4>
            <p className="text-[11.5px] text-slate-705 font-semibold italic max-w-xl mx-auto mt-1 leading-relaxed select-all">
              "{summary}"
            </p>
          </div>
        )}

        <div className="space-y-5 text-left font-sans">
          {sectionOrder.map(secId => {
            if (!isSectionVisible(secId)) return null;

            if (secId === 'internships' && (resume.internships || []).length > 0) {
              return renderInternships(selectedTemplate, resume.internships || []);
            }

            if (secId === 'experience' && experience.length > 0) {
              return (
                <div key={secId} className="space-y-3 font-sans">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-900 border-b border-emerald-100 pb-1 flex items-center gap-1.5 text-left">Traction / Achievements</h3>
                  <div className="space-y-3">
                    {experience.map(e => (
                      <div key={e.id} className="avoid-break bg-white hover:border-emerald-100 border border-slate-100 p-4 rounded-xl flex flex-col justify-between text-left font-sans">
                        <div className="flex justify-between items-baseline gap-2 flex-wrap font-sans">
                          <h4 className="text-xs font-bold text-slate-900">{e.title} @ <span className="text-emerald-700 font-bold">{e.company}</span></h4>
                          <span className="text-[9.5px] font-bold text-gray-400 whitespace-nowrap">{e.startDate} - {e.endDate}</span>
                        </div>
                        <p className="text-[9.5px] text-gray-400 font-bold tracking-wide italic mb-1">{e.location}</p>
                        <p className="text-[11px] text-slate-655 whitespace-pre-line leading-relaxed pr-1">{e.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            if (secId === 'projects' && projects.length > 0) {
              return (
                <div key={secId} className="space-y-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-900 border-b border-emerald-100 pb-1 text-left">Shipping Record</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                    {projects.map(p => (
                      <div key={p.id} className="avoid-break bg-emerald-50/10 border border-emerald-50 p-3.5 rounded-xl font-sans text-left">
                        <h4 className="text-xs font-bold text-slate-900">{p.name}</h4>
                        {p.technologies && <span className="text-[9px] font-bold text-emerald-600 font-mono block select-all">Stack: {p.technologies}</span>}
                        <p className="text-[10.5px] text-slate-600 mt-1 pr-1 whitespace-pre-wrap">{p.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            return null;
          })}
        </div>
      </div>
    );
  };

  // ==========================================
  // TEMPLATE 10: DESIGNER (Artistic Sidebar Layout)
  // ==========================================
  const renderDesignerLayout = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 leading-relaxed text-left font-sans">
        {/* LEFT COLUMN: CHARCOAL SIDEBAR */}
        <div className="md:col-span-1 bg-slate-900 text-slate-100 p-6 rounded-2xl space-y-6 flex flex-col shrink-0 text-left">
          <div className="text-center space-y-3 avoid-break">
            {renderProfilePhoto('h-24 w-24 rounded-2xl border-4 border-slate-800 mx-auto')}
            <div className="text-left font-sans">
              <h1 className="text-xl font-bold tracking-widest uppercase text-white font-sans">
                {personalDetails.fullName || 'JANE SMITH'}
              </h1>
              <p className="text-[10px] font-extrabold tracking-widest text-violet-400 uppercase mt-1.5 font-sans">
                {personalDetails.professionalTitle || 'Visual Stylist'}
              </p>
            </div>
          </div>

          {/* Social connections */}
          <div className="space-y-2 avoid-break text-[10px] text-slate-305 text-left font-sans">
            <h3 className="text-xs font-bold text-violet-405 uppercase tracking-widest border-b border-slate-800 pb-1 font-sans">INQUIRY</h3>
            {personalDetails.email && <p className="select-all block truncate font-sans">email: {personalDetails.email}</p>}
            {personalDetails.phone && <p className="select-all block font-sans">tel: {personalDetails.phone}</p>}
            {personalDetails.location && <p className="select-all block font-sans">hub: {personalDetails.location}</p>}
          </div>

          {/* Creative specs */}
          {skills.programmingLanguages.length > 0 && isSectionVisible('skills') && (
            <div className="space-y-3 avoid-break">
              <h3 className="text-xs font-bold text-violet-400 uppercase tracking-widest border-b border-slate-805 pb-1">SPECS</h3>
              <div className="space-y-0.5">
                <span className="text-[9.5px] font-bold text-slate-400 uppercase block mb-1">Interactive</span>
                {renderSkillBadges(skills.programmingLanguages, 'designer')}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: HIGH-CONTRAST PORTFOLIO CONTENT */}
        <div className="md:col-span-2 space-y-6 text-left font-sans text-left animate-none">
          {summary && isSectionVisible('summary') && (
            <div className="avoid-break border-r-4 border-violet-500 bg-slate-50 p-4 rounded-xl text-left">
              <h4 className="text-[9px] font-extrabold uppercase text-violet-600 tracking-wider mb-1">PROFESSIONAL SUMMARY</h4>
              <p className="text-[11.5px] text-slate-700 leading-relaxed italic pr-2 whitespace-pre-wrap">{summary}</p>
            </div>
          )}

          <div className="space-y-6 font-sans">
            {sectionOrder.map(secId => {
              if (!isSectionVisible(secId)) return null;

              if (secId === 'internships' && (resume.internships || []).length > 0) {
                return renderInternships(selectedTemplate, resume.internships || []);
              }

              if (secId === 'experience' && experience.length > 0) {
                return (
                  <div key={secId} className="space-y-4">
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-900 border-b-2 border-slate-100 pb-1">Creative Experience</h3>
                    <div className="space-y-4 relative pl-4 border-l-2 border-violet-100 font-sans">
                      {experience.map(e => (
                        <div key={e.id} className="avoid-break relative text-left font-sans">
                          <div className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-violet-500 ring-4 ring-white"></div>
                          <div className="flex justify-between items-baseline font-bold gap-2 flex-wrap font-sans">
                            <h4 className="text-xs text-slate-950 uppercase">{e.title} / <span className="text-violet-605 font-bold">{e.company}</span></h4>
                            <span className="text-[9px] text-slate-400 font-bold whitespace-nowrap">{e.startDate} - {e.endDate}</span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-1 whitespace-pre-line font-medium leading-relaxed pr-2 font-sans">{e.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              return null;
            })}
          </div>
        </div>
      </div>
    );
  };

  // ==========================================
  // TEMPLATE 11: DATA ANALYST (Metrics Dashboard Layout)
  // ==========================================
  const renderDataAnalystLayout = () => {
    return (
      <div className="space-y-5 flex flex-col items-stretch leading-relaxed font-sans text-left">
        {/* Technical metrics header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b-4 border-teal-700 avoid-break font-mono text-left">
          {shouldUseProfilePhoto ? (
            <div className="flex items-center gap-4">
              {renderProfilePhoto('h-16 w-16 rounded-full border-2 border-teal-100')}
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-950 uppercase leading-none select-all font-sans">
                  {personalDetails.fullName || 'JANE SMITH'}
                </h1>
                <p className="text-xs font-bold text-teal-700 tracking-wider uppercase mt-1.5">
                  {personalDetails.professionalTitle || 'Senior Analyst'}
                </p>
              </div>
            </div>
          ) : (
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-950 uppercase leading-none select-all font-sans">
                {personalDetails.fullName || 'JANE SMITH'}
              </h1>
              <p className="text-xs font-bold text-teal-700 tracking-wider uppercase mt-1.5">
                {personalDetails.professionalTitle || 'Senior Analyst'}
              </p>
            </div>
          )}
          <div className="flex flex-col items-start sm:items-end text-[10px] text-gray-500 font-bold space-y-0.5 select-all font-sans text-left sm:text-right font-sans">
            {personalDetails.email && <span>{personalDetails.email}</span>}
            {personalDetails.phone && <span>{personalDetails.phone}</span>}
            {personalDetails.location && <span>{personalDetails.location}</span>}
          </div>
        </div>

        {summary && isSectionVisible('summary') && (
          <div className="avoid-break bg-teal-50/20 p-4 border border-teal-100 rounded-xl text-left font-sans">
            <h4 className="text-[10px] font-bold text-teal-800 uppercase tracking-widest font-mono mb-1">// PROFESSIONAL SUMMARY</h4>
            <p className="text-[11px] text-gray-700 whitespace-pre-wrap select-all leading-relaxed font-sans pr-2">{summary}</p>
          </div>
        )}

        <div className="space-y-5 text-left font-sans">
          {sectionOrder.map(secId => {
            if (!isSectionVisible(secId)) return null;

            if (secId === 'internships' && (resume.internships || []).length > 0) {
              return renderInternships(selectedTemplate, resume.internships || []);
            }

            if (secId === 'experience' && experience.length > 0) {
              return (
                <div key={secId} className="space-y-3 font-sans">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-teal-700 border-b border-teal-100 pb-1 font-mono text-left">// DELIVERABLES & OUTCOMES</h3>
                  <div className="space-y-3 font-sans">
                    {experience.map(e => (
                      <div key={e.id} className="avoid-break bg-white border border-slate-100 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start gap-4 hover:border-teal-100 transition-all font-sans shadow-2xs text-left font-sans">
                        <div className="flex-1 text-left text-[11px] font-sans">
                          <h4 className="text-xs font-bold text-slate-900 font-sans">{e.title} @ <span className="text-teal-700 font-bold">{e.company}</span></h4>
                          <p className="text-[10px] text-slate-400 italic font-semibold">{e.location}</p>
                          <p className="text-[11.5px] text-slate-655 mt-1 pr-1 whitespace-pre-line leading-relaxed font-sans pr-2">{e.description}</p>
                        </div>
                        <div className="sm:text-right shrink-0 font-sans">
                          <span className="inline-block bg-teal-50 text-teal-850 text-[9px] font-mono font-bold px-2 py-1 rounded border border-teal-100">{e.startDate} - {e.endDate}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            return null;
          })}
        </div>
      </div>
    );
  };

  // ==========================================
  // TEMPLATE 12: CLASSIC (Classic Editorial Centered)
  // ==========================================
  const renderClassicLayout = () => {
    return (
      <div className="space-y-6 max-w-[700px] mx-auto text-gray-905 leading-normal font-serif">
        {/* Standard Editorial Letterhead */}
        <div className="text-center pb-2 border-b border-gray-300 avoid-break">
          {renderProfilePhoto('mx-auto mb-3 h-20 w-20 rounded-full border border-gray-300 shadow-sm')}
          <h1 className="text-3xl font-extrabold tracking-tight mt-1 text-black select-all uppercase font-serif">
            {personalDetails.fullName || 'JANE SMITH'}
          </h1>
          <p className="text-sm font-semibold tracking-wide italic text-gray-600 uppercase mt-1 inline-block font-serif">
            — {personalDetails.professionalTitle || 'Software Architect'} —
          </p>
          <div className="mt-3 flex flex-wrap justify-center items-center gap-x-3 gap-y-1.5 text-[11px] text-gray-500 font-sans select-all font-semibold uppercase">
            {personalDetails.email && <span>{personalDetails.email}</span>}
            {personalDetails.phone && <span>• {personalDetails.phone}</span>}
            {personalDetails.location && <span>• {personalDetails.location}</span>}
            {renderContactLinks('justify-center')}
          </div>
        </div>

        {summary && isSectionVisible('summary') && (
          <div className="avoid-break text-center py-2 italic font-serif text-[11.5px] text-gray-700 leading-relaxed max-w-2xl mx-auto whitespace-pre-wrap">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-900 not-italic mb-2 border-b border-gray-200 pb-1">
              PROFESSIONAL SUMMARY
            </h3>
            "{summary}"
          </div>
        )}

        <div className="space-y-6 font-serif">
          {sectionOrder.map(secId => {
            if (!isSectionVisible(secId)) return null;

            if (secId === 'internships' && (resume.internships || []).length > 0) {
              return renderInternships(selectedTemplate, resume.internships || []);
            }

            if (secId === 'experience' && experience.length > 0) {
              return (
                <div key={secId} className="space-y-3 font-serif animate-none">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-center text-gray-950 border-b border-gray-200 pb-1 font-serif select-none">
                    — PROFESSIONAL HISTORY —
                  </h3>
                  <div className="space-y-4">
                    {experience.map(e => (
                      <div key={e.id} className="avoid-break text-left font-serif leading-relaxed text-[11px] select-all">
                        <div className="flex justify-between items-baseline font-bold text-gray-955 uppercase text-[11px] gap-2 flex-wrap font-serif">
                          <span>{e.title} — {e.company}</span>
                          <span className="font-semibold text-gray-500 font-sans">{e.startDate} – {e.endDate}</span>
                        </div>
                        <p className="text-[9.5px] text-gray-400 font-sans font-bold tracking-wide uppercase">{e.location}</p>
                        <p className="text-[11px] text-gray-750 mt-1 pr-1 leading-normal whitespace-pre-line">{e.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            if (secId === 'education' && education.length > 0) {
              return (
                <div key={secId} className="space-y-3 font-serif">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-center text-gray-905 border-b border-gray-200 pb-1 select-none font-serif">
                    — ACADEMIC STUDIES —
                  </h3>
                  <div className="space-y-3">
                    {education.map(edu => (
                      <div key={edu.id} className="avoid-break text-left text-[11px] font-serif leading-relaxed">
                        <div className="flex justify-between items-baseline font-bold select-all text-gray-955 gap-2 flex-wrap font-serif">
                          <span>{edu.degree}</span>
                          <span className="font-semibold text-gray-500 font-sans">{edu.startDate} – {edu.endDate}</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-550 font-sans uppercase">
                          <span>{edu.institution}, {edu.location}</span>
                          {edu.gpa && <span className="font-bold">GPA {edu.gpa}</span>}
                        </div>
                        {edu.description && <p className="text-[10px] text-gray-500 italic mt-1 leading-normal pr-1">{edu.description}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            if (secId === 'projects' && projects.length > 0) {
              return (
                <div key={secId} className="space-y-3 font-serif">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-center text-gray-905 border-b border-gray-200 pb-1 select-none font-serif font-serif">
                    — PROJECT DOSSIER —
                  </h3>
                  <div className="space-y-3">
                    {projects.map(p => (
                      <div key={p.id} className="avoid-break text-left text-[11px] font-serif leading-relaxed">
                        <div className="flex justify-between items-baseline font-bold select-all gap-2 flex-wrap font-serif">
                          <span className="uppercase text-gray-950 font-serif font-bold">{p.name} {p.technologies && `[${p.technologies}]`}</span>
                        </div>
                        <p className="text-[11px] text-gray-655 mt-1 block pr-1 leading-normal whitespace-pre-wrap">{p.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            if (secId === 'skills') {
              const hasSkills = Object.values(skills).some(s => s.length > 0);
              if (!hasSkills) return null;
              return (
                <div key={secId} className="avoid-break space-y-2 text-left font-serif font-serif">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-center text-gray-905 border-b border-gray-200 pb-1 select-none font-serif">
                    — KNOWLEDGE DOMAINS —
                  </h3>
                  <div className="text-[11px] font-serif text-gray-700 leading-normal space-y-1 text-left font-serif">
                    {skills.programmingLanguages.length > 0 && <p className="select-all"><strong>Programming:</strong> {skills.programmingLanguages.join(' • ')}</p>}
                    {skills.frameworks.length > 0 && <p className="select-all"><strong>Tools APIs:</strong> {skills.frameworks.join(' • ')}</p>}
                    {skills.databases.length > 0 && <p className="select-all"><strong>Databases:</strong> {skills.databases.join(' • ')}</p>}
                  </div>
                </div>
              );
            }

            return null;
          })}
        </div>
      </div>
    );
  };

  // Master Layout Router
  const renderTemplateContent = (id: TemplateId) => {
    let layout: React.ReactNode;
    switch (id) {
      case 'modern':
        layout = renderModernLayout();
        break;
      case 'minimal':
        layout = renderMinimalLayout();
        break;
      case 'corporate':
        layout = renderCorporateLayout();
        break;
      case 'executive':
        layout = renderExecutiveLayout();
        break;
      case 'creative':
        layout = renderCreativeLayout();
        break;
      case 'atsFriendly':
        layout = renderAtsFriendlyLayout();
        break;
      case 'softwareEngineer':
        layout = renderSoftwareEngineerLayout();
        break;
      case 'student':
        layout = renderStudentLayout();
        break;
      case 'startup':
        layout = renderStartupLayout();
        break;
      case 'designer':
        layout = renderDesignerLayout();
        break;
      case 'dataAnalyst':
        layout = renderDataAnalystLayout();
        break;
      case 'classic':
      default:
        layout = renderClassicLayout();
        break;
    }

    const customIds = customSections.map(section => section.id);
    const nativeCustomIds = customIds.filter(id => sectionOrder.includes(id));
    const handledByTemplate: Record<TemplateId, string[]> = {
      modern: ['summary', 'experience', 'internships', 'education', 'skills', 'projects', 'certifications', 'achievements', 'languages', ...nativeCustomIds],
      minimal: ['summary', 'experience', 'internships', 'education', 'skills', 'projects', ...nativeCustomIds],
      corporate: ['summary', 'experience', 'internships', 'education', 'skills', 'projects', 'certifications', 'languages'],
      executive: ['summary', 'experience', 'internships', 'education', 'skills'],
      creative: ['summary', 'experience', 'internships', 'education', 'skills', 'projects'],
      atsFriendly: ['summary', 'experience', 'internships', 'education', 'skills', 'projects', ...nativeCustomIds],
      softwareEngineer: ['summary', 'experience', 'internships', 'education', 'skills', 'projects'],
      student: ['summary', 'experience', 'education', 'projects'],
      startup: ['summary', 'experience', 'internships', 'projects'],
      designer: ['summary', 'experience', 'internships', 'skills'],
      dataAnalyst: ['summary', 'experience', 'internships'],
      classic: ['summary', 'experience', 'internships', 'education', 'skills', 'projects'],
    };

    return (
      <div className="space-y-6">
        {layout}
        {(personalDetails.website || personalDetails.linkedin || personalDetails.github) && (
          <section className="avoid-break border-t border-gray-200 pt-3 text-left">
            <h3 className="mb-1 text-[9.5px] font-bold uppercase tracking-widest text-gray-500">Online Links</h3>
            {renderContactLinks('text-[10.5px] font-semibold text-blue-700')}
          </section>
        )}
        {projects.some(project => project.github || project.live) && (
          <section className="avoid-break border-t border-gray-200 pt-3 text-left">
            <h3 className="mb-1 text-[9.5px] font-bold uppercase tracking-widest text-gray-500">Project Links</h3>
            <div className="space-y-1 text-[10.5px]">
              {projects.map(project => (project.github || project.live) && (
                <div key={project.id} className="flex flex-wrap gap-x-2">
                  <strong className="text-gray-700">{project.name}:</strong>
                  <ResumeLink url={project.github} label="GitHub" className="font-semibold text-blue-700" />
                  <ResumeLink url={project.live} label="Live Project" className="font-semibold text-blue-700" />
                </div>
              ))}
            </div>
          </section>
        )}
        {certifications.some(certification => certification.url) && (
          <section className="avoid-break border-t border-gray-200 pt-3 text-left">
            <h3 className="mb-1 text-[9.5px] font-bold uppercase tracking-widest text-gray-500">Credential Links</h3>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10.5px]">
              {certifications.map(certification => certification.url && (
                <React.Fragment key={certification.id}>
                  <ResumeLink
                    url={certification.url}
                    label={certification.name || 'Credential'}
                    className="font-semibold text-blue-700"
                  />
                </React.Fragment>
              ))}
            </div>
          </section>
        )}
        <div className="space-y-6">
          {renderSupplementalSections(new Set(handledByTemplate[id]))}
        </div>
      </div>
    );
  };

  const renderCreativePortfolioSection = (sectionId: string, sidebar = false) => {
    if (!isSectionVisible(sectionId)) return null;

    const sidebarHeading = 'mb-2 border-b border-slate-700 pb-1.5 text-[9.5px] font-extrabold uppercase tracking-[0.18em] text-emerald-300';
    const mainHeading = 'mb-3 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-900 before:h-3 before:w-1 before:rounded-full before:bg-emerald-500';

    if (sectionId === 'skills' && hasSkills) {
      const skillGroups = [
        ['Languages', skills.programmingLanguages],
        ['Frameworks', skills.frameworks],
        ['Tools', skills.tools],
        ['Databases', skills.databases],
        ['Strengths', skills.softSkills],
      ] as const;
      return (
        <section key={sectionId} className="avoid-break">
          <h3 className={sidebarHeading}>Technical Toolkit</h3>
          <div className="space-y-3">
            {skillGroups.map(([label, values]) => values.length > 0 && (
              <div key={label}>
                <h4 className="text-[8.5px] font-bold uppercase tracking-wider text-slate-400">{label}</h4>
                {renderSkillBadges(values, 'creative')}
              </div>
            ))}
          </div>
        </section>
      );
    }

    if (sectionId === 'languages' && languages.length > 0) {
      return (
        <section key={sectionId} className="avoid-break">
          <h3 className={sidebarHeading}>Languages</h3>
          <div className="space-y-1.5">
            {languages.map(language => (
              <p key={language} className="border-l-2 border-emerald-500 pl-2 text-[10px] font-semibold text-slate-200">
                {language}
              </p>
            ))}
          </div>
        </section>
      );
    }

    if (sectionId === 'certifications' && certifications.length > 0) {
      return (
        <section key={sectionId} className="avoid-break">
          <h3 className={sidebarHeading}>Certifications</h3>
          <div className="space-y-3">
            {certifications.map(certification => (
              <article key={certification.id}>
                <h4 className="text-[10px] font-bold leading-snug text-white">{certification.name}</h4>
                <p className="mt-0.5 text-[9px] text-slate-400">
                  {[certification.issuer, certification.date].filter(Boolean).join(' · ')}
                </p>
                <ResumeLink
                  url={certification.url}
                  label="View credential"
                  className="mt-1 inline-block text-[9px] font-bold text-emerald-300"
                />
              </article>
            ))}
          </div>
        </section>
      );
    }

    if (sidebar) return null;

    const customSection = customSections.find(section => section.id === sectionId);
    if (customSection) {
      return (
        <section key={sectionId} className="space-y-3 text-left">
          <h3 className={mainHeading}>{customSection.title}</h3>
          {customSection.items.map(item => (
            <article key={item.id} className="avoid-break border-l-2 border-slate-200 pl-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="text-[11px] font-bold text-slate-900">{item.title}</h4>
                {item.date && <span className="text-[9px] font-bold text-emerald-700">{item.date}</span>}
              </div>
              {item.subtitle && <p className="text-[9.5px] font-semibold text-slate-500">{item.subtitle}</p>}
              <p className="mt-1 whitespace-pre-line text-[10.5px] leading-relaxed text-slate-700">{item.description}</p>
            </article>
          ))}
        </section>
      );
    }

    if (sectionId === 'summary' && summary) {
      return (
        <section key={sectionId} className="avoid-break rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 text-left">
          <h3 className={mainHeading}>Profile</h3>
          <p className="whitespace-pre-wrap text-[11px] font-medium leading-relaxed text-slate-700">{summary}</p>
        </section>
      );
    }

    if (sectionId === 'experience' && experience.length > 0) {
      return (
        <section key={sectionId} className="space-y-4 text-left">
          <h3 className={mainHeading}>Experience</h3>
          {experience.map(entry => (
            <article key={entry.id} className="avoid-break border-l-2 border-slate-200 pl-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h4 className="text-[12px] font-extrabold text-slate-950">{entry.title}</h4>
                  <p className="text-[10.5px] font-bold text-emerald-700">{entry.company}</p>
                </div>
                <div className="text-right text-[9px] font-bold uppercase tracking-wide text-slate-500">
                  <p>{entry.startDate} - {entry.endDate}</p>
                  {entry.location && <p className="mt-0.5 font-medium normal-case text-slate-400">{entry.location}</p>}
                </div>
              </div>
              <p className="mt-2 whitespace-pre-line text-[10.5px] leading-relaxed text-slate-700">{entry.description}</p>
            </article>
          ))}
        </section>
      );
    }

    if (sectionId === 'internships' && (resume.internships || []).length > 0) {
      return (
        <section key={sectionId} className="space-y-4 text-left">
          <h3 className={mainHeading}>Internships</h3>
          {(resume.internships || []).map(entry => (
            <article key={entry.id} className="avoid-break border-l-2 border-emerald-200 pl-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h4 className="text-[11.5px] font-extrabold text-slate-950">{entry.role}</h4>
                  <p className="text-[10px] font-bold text-emerald-700">{entry.company}</p>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{entry.startDate} - {entry.endDate}</span>
              </div>
              {entry.technologiesUsed && (
                <p className="mt-1 text-[9px] font-bold text-slate-500">Stack: {entry.technologiesUsed}</p>
              )}
              <p className="mt-1 whitespace-pre-line text-[10.5px] leading-relaxed text-slate-700">{entry.description}</p>
            </article>
          ))}
        </section>
      );
    }

    if (sectionId === 'projects' && projects.length > 0) {
      return (
        <section key={sectionId} className="space-y-3 text-left">
          <div className="flex items-end justify-between gap-3 border-b-2 border-slate-900 pb-2">
            <h3 className="text-[12px] font-black uppercase tracking-[0.16em] text-slate-950">Selected Projects</h3>
            <span className="text-[8.5px] font-bold uppercase tracking-wider text-emerald-700">Portfolio focus</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {projects.map(project => (
              <article key={project.id} className="avoid-break rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <h4 className="text-[12px] font-extrabold leading-tight text-slate-950">{project.name}</h4>
                  <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                </div>
                {project.technologies && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {project.technologies.split(',').map(technology => technology.trim()).filter(Boolean).map(technology => (
                      <span key={technology} className="rounded border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 text-[8.5px] font-bold text-emerald-800">
                        {technology}
                      </span>
                    ))}
                  </div>
                )}
                <p className="mt-2 whitespace-pre-line text-[10px] leading-relaxed text-slate-700">{project.description}</p>
                {(project.github || project.live) && (
                  <div className="mt-3 flex flex-wrap gap-3 border-t border-slate-100 pt-2 text-[9px] font-bold">
                    <ResumeLink url={project.github} label="GitHub" className="text-slate-700" />
                    <ResumeLink url={project.live} label="Live Demo" className="text-emerald-700" />
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      );
    }

    if (sectionId === 'education' && education.length > 0) {
      return (
        <section key={sectionId} className="space-y-3 text-left">
          <h3 className={mainHeading}>Education</h3>
          {education.map(entry => (
            <article key={entry.id} className="avoid-break flex flex-wrap items-start justify-between gap-3 border-t border-slate-100 pt-3 first:border-0 first:pt-0">
              <div>
                <h4 className="text-[11px] font-extrabold text-slate-950">{entry.degree}</h4>
                <p className="text-[10px] font-semibold text-slate-600">{entry.institution}</p>
                {entry.description && <p className="mt-1 text-[10px] text-slate-600">{entry.description}</p>}
              </div>
              <div className="text-right text-[9px] font-bold text-slate-500">
                <p>{entry.startDate} - {entry.endDate}</p>
                {entry.gpa && <p className="mt-0.5 text-emerald-700">GPA {entry.gpa}</p>}
              </div>
            </article>
          ))}
        </section>
      );
    }

    if (sectionId === 'achievements' && achievements.length > 0) {
      return (
        <section key={sectionId} className="avoid-break text-left">
          <h3 className={mainHeading}>Achievements</h3>
          <ul className="space-y-1.5 pl-4 text-[10.5px] leading-relaxed text-slate-700">
            {achievements.map(achievement => <li key={achievement} className="list-disc marker:text-emerald-500">{achievement}</li>)}
          </ul>
        </section>
      );
    }

    if (sectionId === 'volunteering' && volunteering.length > 0) {
      return (
        <section key={sectionId} className="space-y-3 text-left">
          <h3 className={mainHeading}>Community Work</h3>
          {volunteering.map(entry => (
            <article key={entry.id} className="avoid-break border-l-2 border-slate-200 pl-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="text-[11px] font-bold text-slate-950">{entry.title} · {entry.company}</h4>
                <span className="text-[9px] font-bold text-slate-500">{entry.startDate} - {entry.endDate}</span>
              </div>
              <p className="mt-1 whitespace-pre-line text-[10px] leading-relaxed text-slate-700">{entry.description}</p>
            </article>
          ))}
        </section>
      );
    }

    return null;
  };

  const renderCreativePortfolioContent = () => {
    const sidebarIds = sectionOrder.filter(sectionId =>
      ['skills', 'languages', 'certifications'].includes(sectionId)
    );
    const mainIds = sectionOrder.filter(sectionId =>
      !['skills', 'languages', 'certifications'].includes(sectionId)
    );
    const hasSidebarContent =
      (sidebarIds.includes('skills') && hasSkills && isSectionVisible('skills')) ||
      (sidebarIds.includes('languages') && languages.length > 0 && isSectionVisible('languages')) ||
      (sidebarIds.includes('certifications') && certifications.length > 0 && isSectionVisible('certifications'));

    return (
      <div className="space-y-5 font-sans text-slate-800">
        <header className="avoid-break overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 text-white">
          <div className="h-1.5 bg-emerald-400" />
          <div className={`p-6 ${shouldUseProfilePhoto ? 'flex items-center gap-6' : ''}`}>
            {shouldUseProfilePhoto && (
              <div className="shrink-0">
                {renderProfilePhoto('h-24 w-24 rounded-2xl border-2 border-emerald-300 shadow-lg')}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.24em] text-emerald-300">Portfolio Resume</p>
              <h1 className="text-3xl font-black uppercase leading-none tracking-tight text-white sm:text-4xl">
                {personalDetails.fullName || 'JANE SMITH'}
              </h1>
              <p className="mt-2 text-[12px] font-bold uppercase tracking-[0.14em] text-emerald-300">
                {personalDetails.professionalTitle || 'Creative Software Engineer'}
              </p>
              <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5 text-[9.5px] font-medium text-slate-300">
                {personalDetails.email && <span>{personalDetails.email}</span>}
                {personalDetails.phone && <span>{personalDetails.phone}</span>}
                {personalDetails.location && <span>{personalDetails.location}</span>}
              </div>
              <div className="mt-2">
                {renderContactLinks('text-[9.5px] font-bold text-emerald-300')}
              </div>
            </div>
          </div>
        </header>

        <div className={`grid grid-cols-1 gap-5 ${hasSidebarContent ? 'md:grid-cols-[0.82fr_2.18fr]' : ''}`}>
          {hasSidebarContent && (
            <aside className="space-y-6 rounded-2xl bg-slate-900 p-5 text-slate-200">
              {sidebarIds.map(sectionId => renderCreativePortfolioSection(sectionId, true))}
            </aside>
          )}
          <main className="min-w-0 space-y-6">
            {mainIds.map(sectionId => renderCreativePortfolioSection(sectionId))}
          </main>
        </div>
      </div>
    );
  };

  const renderOrderedTemplateContent = (id: TemplateId) => {
    if (id === 'creative') return renderCreativePortfolioContent();

    const theme = getTemplateTheme(id);
    const centeredHeader = id === 'minimal' || id === 'executive' || id === 'classic';
    const photoClassByTemplate: Record<TemplateId, string> = {
      modern: 'h-16 w-16 rounded-xl border-2 border-indigo-100',
      minimal: 'h-20 w-20 rounded-full border border-slate-200 shadow-sm',
      corporate: 'h-20 w-20 rounded-full border-4 border-white shadow-sm',
      executive: 'h-20 w-20 rounded-full border-2 border-emerald-100 shadow-sm',
      creative: 'h-20 w-20 rounded-2xl border-2 border-white/70 shadow-md',
      atsFriendly: 'h-16 w-16 rounded-sm border border-black',
      softwareEngineer: 'h-20 w-20 rounded-lg border border-cyan-400/60',
      student: 'h-16 w-16 rounded-full border-2 border-violet-100',
      startup: 'h-16 w-16 rounded-xl border-2 border-emerald-100 shadow-sm',
      designer: 'h-20 w-20 rounded-2xl border-2 border-violet-200',
      dataAnalyst: 'h-16 w-16 rounded-full border-2 border-teal-100',
      classic: 'h-20 w-20 rounded-full border border-gray-300 shadow-sm',
    };

    return (
      <div className={`space-y-6 ${theme.font}`}>
        <header
          className={`avoid-break ${theme.headerBg} ${
            centeredHeader ? 'text-center' : 'text-left'
          }`}
        >
          <div
            className={`gap-4 ${
              shouldUseProfilePhoto
                ? centeredHeader
                  ? 'flex flex-col items-center'
                  : 'flex items-center justify-between'
                : ''
            }`}
          >
            <div className="min-w-0 flex-1">
              <h1
                className={`text-3xl font-extrabold uppercase leading-none tracking-tight ${theme.titleColor}`}
              >
                {personalDetails.fullName || 'JANE SMITH'}
              </h1>
              <p
                className={`mt-1.5 text-xs font-bold uppercase tracking-wider ${theme.headingColor}`}
              >
                {personalDetails.professionalTitle || 'Software Architect'}
              </p>
              <div
                className={`mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] ${
                  centeredHeader ? 'justify-center' : ''
                } text-gray-600`}
              >
                {personalDetails.email && <span>{personalDetails.email}</span>}
                {personalDetails.phone && <span>{personalDetails.phone}</span>}
                {personalDetails.location && <span>{personalDetails.location}</span>}
                {renderContactLinks(centeredHeader ? 'justify-center' : '')}
              </div>
            </div>
            {renderProfilePhoto(photoClassByTemplate[id])}
          </div>
        </header>

        <main className="space-y-6">
          {renderSupplementalSections(new Set())}
        </main>
      </div>
    );
  };

  return (
    <div className="forge-preview-workspace flex flex-col h-full bg-gray-50/50 rounded-2xl border border-gray-150 p-4" id="resume-preview-panel">
      {/* Template Selector Horizontal Bar */}
      <div className="no-print mb-4 flex flex-col gap-3 pb-4 border-b border-gray-150 ">
        
        {/* Error Diagnostics UI */}
        {exportError && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <AlertTriangle className="h-4 w-4" />
                <span>PDF export failed</span>
              </div>
              <button 
                onClick={() => setExportError(null)}
                className="p-1 hover:bg-rose-100 rounded-full transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <p>{exportError.message}</p>
              <p className="text-[10px] text-rose-600">Try again after checking that profile images and external links are available.</p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
            <Eye className="h-4 w-4 text-indigo-500" />
            <span>Resume template ({templatesList.length})</span>
          </span>
          <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setExportMode('single')}
                className={`rounded-md px-3 py-1 text-[10px] font-bold uppercase tracking-wide transition ${
                  exportMode === 'single'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                Single Page
              </button>
              <button
                type="button"
                onClick={() => setExportMode('multi')}
                className={`rounded-md px-3 py-1 text-[10px] font-bold uppercase tracking-wide transition ${
                  exportMode === 'multi'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                Multi Page
              </button>
            </div>
            <div
              className="grid grid-cols-1 gap-1 rounded-lg border border-gray-200 bg-white p-1 sm:grid-cols-2"
              role="group"
              aria-label="Profile photo usage"
            >
              <button
                type="button"
                onClick={() => onProfilePhotoUsageChange(true)}
                aria-pressed={resume.useProfilePhoto !== false}
                className={`rounded-md px-3 py-1 text-[10px] font-bold uppercase tracking-wide transition ${
                  resume.useProfilePhoto !== false
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                Use Profile Photo
              </button>
              <button
                type="button"
                onClick={() => onProfilePhotoUsageChange(false)}
                aria-pressed={resume.useProfilePhoto === false}
                className={`rounded-md px-3 py-1 text-[10px] font-bold uppercase tracking-wide transition ${
                  resume.useProfilePhoto === false
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                Do Not Use Profile Photo
              </button>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleDownloadPDF}
                disabled={isExporting}
                className="flex items-center space-x-1 border border-indigo-200 bg-indigo-50 px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition shadow-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                id="btn-trigger-download"
              >
                <FileDown className="h-3.5 w-3.5" />
                <span>{isExporting ? 'Generating...' : `Download ${exportMode === 'single' ? 'Single' : 'Multi'} PDF`}</span>
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center space-x-1 border border-gray-200 bg-white px-3 py-1.5 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50 transition shadow-sm cursor-pointer"
                id="btn-trigger-print"
              >
                <Printer className="h-3.5 w-3.5 text-gray-500 " />
                <span>Print</span>
              </button>
            </div>
          </div>
        </div>

        {/* Templates Quick Grid */}
        <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {templatesList.map(t => (
            <button
              key={t.id}
              onClick={() => {
                onTemplateChange(t.id);
                showToasts(`Switched style format to "${t.name}".`, 'info');
              }}
              className={getTemplateButtonClass(t.id, selectedTemplate === t.id)}
              title={t.description}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* PDF WRITING CANVAS - Standard document ratios (A4 / Letter layout) */}
      <div className="resume-canvas flex-1 overflow-auto p-3 sm:p-4 flex justify-center bg-gray-100 rounded-xl max-h-[85vh]">
        <div 
          className={`print-page transition-all transform origin-top w-full min-w-0 sm:min-w-[750px] sm:max-w-[800px] bg-white text-black shadow-lg rounded-sm ${
            exportMode === 'single'
              ? 'resume-export-single min-h-[970px] p-6 sm:p-8'
              : 'resume-export-multi min-h-[1060px] p-8 sm:p-12'
          } ${themeConfig.font}`}
          id="resume-live-print-view"
          style={{ height: 'fit-content' }}
        >
          {renderOrderedTemplateContent(selectedTemplate)}
        </div>
      </div>
    </div>
  );
}
