import React, {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { pdf } from '@react-pdf/renderer';
import { AlertTriangle, ChevronDown, Eye, FileDown, FileText, Image, Loader2, X } from 'lucide-react';
import { ResumeData, TemplateId } from '../types';
import { VISIBLE_TEMPLATE_IDS } from './TemplateShowcase';
import ResumePdfDocument, {
  FORCE_SINGLE_PAGE_PROFILE,
  SINGLE_PAGE_MAX_COMPACT_LEVEL,
} from './ResumePdfDocument';
import ActionMenu from './ActionMenu';
import { createResumeDocx, createResumePng, downloadBlob } from '../utils/resumeExport';

interface ResumePreviewProps {
  resume: ResumeData;
  selectedTemplate: TemplateId;
  profilePhoto?: string;
  onTemplateChange: (templateId: TemplateId) => void;
  onProfilePhotoUsageChange: (useProfilePhoto: boolean) => void;
  showToasts: (msg: string, type: 'success' | 'error' | 'info') => void;
}

type PdfRenderResult = { blob: Blob; pageCount: number };
type FitMode = 'single' | 'multi';
type TemplatePageExpectation = 'checking' | 'single' | 'multi';
type FitResult = PdfRenderResult & {
  compactLevel: number;
  fitCategory: 'single-page safe' | 'near limit' | 'multi-page likely';
  overflowRisk: 'low' | 'medium' | 'high';
};
type PreviewSlot = { url: string; sequence: number } | null;
type PdfRenderInput = {
  resume: ResumeData;
  resumeJson: string;
  selectedTemplate: TemplateId;
  profilePhoto: string;
};

const TEMPLATES: { id: TemplateId; name: string; description: string }[] = [
  { id: 'modern', name: 'Modern Professional', description: 'Inter typography, mint rail, and Linear-inspired SaaS hierarchy.' },
  { id: 'minimal', name: 'Minimal Elegant', description: 'Luxury whitespace, restrained monochrome typography, and inline sections.' },
  { id: 'corporate', name: 'Corporate Standard', description: 'Carlito enterprise typography, full-width header, and formal section blocks.' },
  { id: 'executive', name: 'Executive Boardroom', description: 'Merriweather executive summary, leadership emphasis, and generous whitespace.' },
  { id: 'creative', name: 'Creative Dynamic', description: 'Expressive rail header, profile photo support, and portfolio project cards.' },
  { id: 'atsFriendly', name: 'Clean Single Column', description: 'Dense single-column structure with minimal decoration.' },
  { id: 'softwareEngineer', name: 'Software Developer', description: 'GitHub-inspired technology matrix with projects and stack first.' },
  { id: 'student', name: 'Academic Student', description: 'Merriweather and Inter combination with education-first ordering.' },
  { id: 'startup', name: 'Startup Growth', description: 'Compact achievement cards and projects-first ordering.' },
  { id: 'dataAnalyst', name: 'Data & Metrics', description: 'Capability indicators, project emphasis, and analytics hierarchy.' },
  { id: 'classic', name: 'Classical Editorial', description: 'Merriweather magazine typography with elegant double separators.' },
];

const TEMPLATE_BY_ID = new Map(TEMPLATES.map(template => [template.id, template]));
const PDF_CACHE_LIMIT = 24;
const pdfRenderCache = new Map<string, Promise<PdfRenderResult>>();

const getCachedPdf = (cacheKey: string, render: () => Promise<PdfRenderResult>) => {
  const cached = pdfRenderCache.get(cacheKey);
  if (cached) {
    pdfRenderCache.delete(cacheKey);
    pdfRenderCache.set(cacheKey, cached);
    return cached;
  }

  const job = render().catch(error => {
    pdfRenderCache.delete(cacheKey);
    throw error;
  });
  pdfRenderCache.set(cacheKey, job);
  while (pdfRenderCache.size > PDF_CACHE_LIMIT) {
    const oldestKey = pdfRenderCache.keys().next().value;
    if (oldestKey) pdfRenderCache.delete(oldestKey);
  }
  return job;
};

const getSemanticTemplateRecommendations = (resume: ResumeData): TemplateId[] => {
  const baseline: TemplateId[] = ['atsFriendly', 'modern', 'corporate'];
  if (resume.education.length > 0 && resume.experience.length <= 1) return [...baseline, 'student'];
  if (resume.projects.length >= Math.max(2, resume.experience.length)) {
    return [...baseline, 'startup', 'softwareEngineer'];
  }
  if (resume.experience.length >= 4) return [...baseline, 'executive'];
  return baseline;
};

function ResumePreview({
  resume,
  selectedTemplate,
  profilePhoto,
  onTemplateChange,
  onProfilePhotoUsageChange,
  showToasts,
}: ResumePreviewProps) {
  const [exportError, setExportError] = useState<{ message: string } | null>(null);
  const [exporting, setExporting] = useState<'pdf' | 'image' | 'docx' | null>(null);
  const isExporting = exporting !== null;
  const [isPreviewRendering, setIsPreviewRendering] = useState(false);
  const [fitMode, setFitMode] = useState<FitMode>('single');
  const [fitResult, setFitResult] = useState<FitResult | null>(null);
  const [templatePageExpectations, setTemplatePageExpectations] = useState<
    Partial<Record<TemplateId, TemplatePageExpectation>>
  >({});
  const [previewSlots, setPreviewSlots] = useState<[PreviewSlot, PreviewSlot]>([null, null]);
  const [activePreviewSlot, setActivePreviewSlot] = useState(0);
  const previewSlotsRef = useRef<[PreviewSlot, PreviewSlot]>([null, null]);
  const activePreviewSlotRef = useRef(0);
  const renderSequenceRef = useRef(0);
  const expectationSequenceRef = useRef(0);
  const resumeSnapshotRef = useRef({ json: '', resume });

  const resumeJson = useMemo(() => JSON.stringify(resume), [resume]);
  if (resumeSnapshotRef.current.json !== resumeJson) {
    resumeSnapshotRef.current = { json: resumeJson, resume };
  }
  const stableResume = resumeSnapshotRef.current.resume;
  const renderInput = useMemo<PdfRenderInput>(() => ({
    resume: stableResume,
    resumeJson,
    selectedTemplate,
    profilePhoto: profilePhoto?.trim() || '',
  }), [profilePhoto, resumeJson, selectedTemplate, stableResume]);
  const deferredRenderInput = useDeferredValue(renderInput);
  const selectedTemplateConfig = TEMPLATE_BY_ID.get(selectedTemplate) || TEMPLATES[0];
  const templateAllowsPhoto = selectedTemplate !== 'atsFriendly';
  const visibleTemplates = useMemo(
    () => TEMPLATES.filter(template => VISIBLE_TEMPLATE_IDS.includes(template.id) || template.id === selectedTemplate),
    [selectedTemplate]
  );
  const semanticRecommendationIds = useMemo(
    () => getSemanticTemplateRecommendations(stableResume),
    [stableResume]
  );
  const orderedTemplates = useMemo(() => {
    const recommended = semanticRecommendationIds.map(
      id => TEMPLATE_BY_ID.get(id) || TEMPLATES[0]
    );
    const ids = new Set(recommended.map(template => template.id));
    return [...recommended, ...visibleTemplates.filter(template => !ids.has(template.id))];
  }, [semanticRecommendationIds, visibleTemplates]);

  const renderDocumentBlob = useCallback(async (
    input: PdfRenderInput,
    mode: 'single' | 'multi',
    compactLevel: number
  ) => {
    const cacheKey = [
      input.resumeJson,
      input.selectedTemplate,
      input.profilePhoto,
      mode,
      compactLevel,
    ].join('\u001f');
    return getCachedPdf(cacheKey, async () => {
      let pageCount = 1;
      const blob = await pdf(
        <ResumePdfDocument
          resume={input.resume}
          templateId={input.selectedTemplate}
          mode={mode}
          profilePhoto={input.profilePhoto}
          compactLevel={compactLevel}
          onRender={result => {
            pageCount = result.pageCount;
          }}
        />
      ).toBlob();
      return { blob, pageCount };
    });
  }, []);

  const resolveFit = useCallback(async (input: PdfRenderInput, selectedMode: FitMode): Promise<FitResult> => {
    let result: PdfRenderResult;
    let compactLevel = 0;

    if (selectedMode === 'multi') {
      result = await renderDocumentBlob(input, 'multi', 0);
    } else {
      result = await renderDocumentBlob(input, 'single', compactLevel);
      while (result.pageCount > 1 && compactLevel < SINGLE_PAGE_MAX_COMPACT_LEVEL) {
        compactLevel += 1;
        result = await renderDocumentBlob(input, 'single', compactLevel);
      }
      if (result.pageCount > 1) {
        compactLevel = FORCE_SINGLE_PAGE_PROFILE;
        result = await renderDocumentBlob(input, 'single', compactLevel);
      }
    }

    const fitCategory = result.pageCount === 1
      ? 'single-page safe' as const
      : selectedMode === 'multi' && result.pageCount === 2
        ? 'near limit' as const
        : 'multi-page likely' as const;
    const overflowRisk = result.pageCount === 1
      ? 'low' as const
      : selectedMode === 'multi' && result.pageCount === 2
        ? 'medium' as const
        : 'high' as const;
    return { ...result, compactLevel, fitCategory, overflowRisk };
  }, [renderDocumentBlob]);

  useEffect(() => {
    const sequence = ++expectationSequenceRef.current;
    let cancelled = false;
    setTemplatePageExpectations(Object.fromEntries(
      visibleTemplates.map(template => [template.id, 'checking'])
    ) as Partial<Record<TemplateId, TemplatePageExpectation>>);

    const timer = window.setTimeout(async () => {
      const expectations: Partial<Record<TemplateId, TemplatePageExpectation>> = {};
      for (const template of visibleTemplates) {
        if (cancelled || sequence !== expectationSequenceRef.current) return;
        try {
          let compactLevel = 0;
          let result = await renderDocumentBlob({
            ...deferredRenderInput,
            selectedTemplate: template.id,
          }, 'single', compactLevel);
          while (result.pageCount > 1 && compactLevel < SINGLE_PAGE_MAX_COMPACT_LEVEL) {
            compactLevel += 1;
            result = await renderDocumentBlob({
              ...deferredRenderInput,
              selectedTemplate: template.id,
            }, 'single', compactLevel);
          }
          if (result.pageCount > 1) {
            result = await renderDocumentBlob({
              ...deferredRenderInput,
              selectedTemplate: template.id,
            }, 'single', FORCE_SINGLE_PAGE_PROFILE);
          }
          expectations[template.id] = result.pageCount === 1 ? 'single' : 'multi';
        } catch {
          expectations[template.id] = 'multi';
        }
      }
      if (!cancelled && sequence === expectationSequenceRef.current) {
        setTemplatePageExpectations(expectations);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [deferredRenderInput, renderDocumentBlob]);

  const createPdfBlob = useCallback(async () => {
    const result = await resolveFit(renderInput, fitMode);
    if (fitMode === 'single' && result.pageCount > 1) {
      throw new Error(
        'This resume still requires multiple pages after all Single Page fitting steps. Select Multi Page.'
      );
    }
    return result.blob;
  }, [fitMode, renderInput, resolveFit]);

  useEffect(() => {
    const sequence = ++renderSequenceRef.current;
    let cancelled = false;
    setIsPreviewRendering(true);
    setExportError(null);

    const timer = window.setTimeout(async () => {
      try {
        const result = await resolveFit(deferredRenderInput, fitMode);
        if (cancelled || sequence !== renderSequenceRef.current) return;
        const nextUrl = URL.createObjectURL(result.blob);
        const nextSlot = activePreviewSlotRef.current === 0 ? 1 : 0;
        const replacedSlot = previewSlotsRef.current[nextSlot];
        const nextSlots: [PreviewSlot, PreviewSlot] = [...previewSlotsRef.current] as [
          PreviewSlot,
          PreviewSlot,
        ];
        nextSlots[nextSlot] = { url: nextUrl, sequence };
        previewSlotsRef.current = nextSlots;
        setPreviewSlots(nextSlots);
        setFitResult(result);
        if (replacedSlot) {
          window.setTimeout(() => URL.revokeObjectURL(replacedSlot.url), 1_000);
        }
      } catch (error: unknown) {
        if (cancelled || sequence !== renderSequenceRef.current) return;
        const message = error instanceof Error ? error.message : 'Unable to render PDF preview.';
        setExportError({ message });
        setIsPreviewRendering(false);
      }
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [deferredRenderInput, fitMode, resolveFit]);

  useEffect(() => () => {
    previewSlotsRef.current.forEach(slot => {
      if (slot) URL.revokeObjectURL(slot.url);
    });
  }, []);

  const promotePreviewSlot = (slot: number, sequence: number) => {
    const candidate = previewSlotsRef.current[slot];
    if (
      !candidate ||
      candidate.sequence !== sequence ||
      sequence !== renderSequenceRef.current ||
      slot === activePreviewSlotRef.current
    ) return;
    activePreviewSlotRef.current = slot;
    setActivePreviewSlot(slot);
    setIsPreviewRendering(false);
  };

  const hasPreview = Boolean(previewSlots[activePreviewSlot]);
  const singlePageBlocked = fitMode === 'single' && Boolean(fitResult && fitResult.pageCount > 1);

  const handleDownloadPDF = async () => {
    if (isExporting) return;
    setExportError(null);
    setExporting('pdf');
    showToasts('Generating text-based PDF...', 'info');
    try {
      const blob = await createPdfBlob();
      const safeName = resume.personalDetails.fullName
        ? resume.personalDetails.fullName.replace(/[^a-z0-9]/gi, '_')
        : 'Resume';
      const modeLabel = fitMode === 'single' ? 'Single_Page' : 'Multi_Page';
      downloadBlob(blob, `${safeName}_${modeLabel}.pdf`);
      showToasts('PDF downloaded successfully.', 'success');
    } catch {
      const message = 'Forge could not generate the PDF safely. Please try again.';
      setExportError({ message });
      showToasts(message, 'error');
    } finally {
      setExporting(null);
    }
  };

  const handleDownloadDocx = async () => {
    if (isExporting) return;
    setExportError(null);
    setExporting('docx');
    showToasts('Generating DOCX document...', 'info');
    try {
      const blob = await createResumeDocx(resume);
      const safeName = resume.personalDetails.fullName?.replace(/[^a-z0-9]/gi, '_') || 'Resume';
      downloadBlob(blob, `${safeName}.docx`);
      showToasts('DOCX downloaded successfully.', 'success');
    } catch {
      const message = 'Forge could not generate the DOCX safely. Please try again.';
      setExportError({ message });
      showToasts(message, 'error');
    } finally {
      setExporting(null);
    }
  };

  const handleDownloadImage = async () => {
    if (isExporting) return;
    setExportError(null);
    setExporting('image');
    try {
      const blob = await createResumePng(await createPdfBlob());
      const safeName = resume.personalDetails.fullName?.replace(/[^a-z0-9]/gi, '_') || 'Resume';
      downloadBlob(blob, `${safeName}.png`);
      showToasts('Resume image downloaded successfully.', 'success');
    } catch {
      const message = 'Forge could not generate the image safely. Please try again.';
      setExportError({ message });
      showToasts(message, 'error');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="forge-preview-workspace flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-[#263241] bg-[#0B0F14] p-3 text-zinc-100 sm:p-4" id="resume-preview-panel" data-tour="builder-preview">
      <div className="no-print mb-3 flex min-w-0 flex-col gap-3 border-b border-[#263241] pb-3 sm:mb-4 sm:pb-4">
        {exportError && (
          <div className="rounded-xl border border-rose-400/40 bg-rose-950/40 p-3 text-rose-100">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-bold">
                <AlertTriangle className="h-4 w-4" />
                <span>Export failed</span>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setExportError(null)} className="rounded-full p-1 transition hover:bg-rose-900/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300" aria-label="Dismiss PDF error">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <p className="mt-2 text-xs">{exportError.message}</p>
          </div>
        )}

        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#72DFCA]">
              <Eye className="h-4 w-4" />
              Live A4 preview
            </span>
            <div className="mt-1 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
              <h2 className="truncate text-sm font-semibold text-white sm:text-base">{selectedTemplateConfig.name}</h2>
              <span className="text-[11px] capitalize text-zinc-400">{fitMode} fit mode</span>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-2 sm:items-end">
            <div className="grid w-full grid-cols-2 gap-1 rounded-lg border border-[#2A3644] bg-[#111827] p-1 sm:w-auto">
              {([
                ['single', 'Single Page'],
                ['multi', 'Multi Page'],
              ] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setFitMode(mode)}
                  aria-pressed={fitMode === mode}
                  className={`min-h-9 rounded-md px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72DFCA] ${
                    fitMode === mode
                      ? 'bg-[#72DFCA] text-[#08110F]'
                      : 'text-zinc-300 hover:bg-[#1B2532] hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {fitResult && (
              <div className="flex flex-wrap justify-end gap-x-3 gap-y-1 text-[10px] font-semibold text-zinc-400">
                <span>Estimated pages: {fitResult.pageCount}</span>
                <span className="capitalize">Preview-based: {fitResult.fitCategory}</span>
                <span className="capitalize">Estimated overflow risk: {fitResult.overflowRisk}</span>
              </div>
            )}
            {fitMode === 'single' && fitResult && fitResult.pageCount > 1 && (
              <div className="max-w-sm rounded-lg border border-amber-400/40 bg-amber-950/30 px-3 py-2 text-[11px] leading-4 text-amber-100">
                This preview estimate suggests the current resume may exceed one page. Select Multi Page or choose a template marked Single Page.
              </div>
            )}

            <div className="grid w-full grid-cols-2 gap-1 rounded-lg border border-[#2A3644] bg-[#111827] p-1 sm:w-auto">
              <button type="button" onClick={() => onProfilePhotoUsageChange(true)} disabled={!templateAllowsPhoto} aria-pressed={resume.useProfilePhoto !== false} className={`min-h-9 rounded-md px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72DFCA] ${templateAllowsPhoto && resume.useProfilePhoto !== false ? 'bg-[#72DFCA] text-[#08110F]' : 'text-zinc-300 hover:bg-[#1B2532] disabled:cursor-not-allowed disabled:text-zinc-600'}`}>
                {templateAllowsPhoto ? 'Use Photo' : 'Photo hidden for this template'}
              </button>
              <button type="button" onClick={() => onProfilePhotoUsageChange(false)} disabled={!templateAllowsPhoto} aria-pressed={resume.useProfilePhoto === false} className={`min-h-9 rounded-md px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72DFCA] ${templateAllowsPhoto && resume.useProfilePhoto === false ? 'bg-[#72DFCA] text-[#08110F]' : 'text-zinc-300 hover:bg-[#1B2532] disabled:cursor-not-allowed disabled:text-zinc-600'}`}>
                No Photo
              </button>
            </div>
            <div className="flex w-full justify-end sm:w-auto" data-tour="download-pdf">
              <ActionMenu
                triggerLabel="Open export options"
                triggerClassName="flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-[#72DFCA] px-4 py-2 text-xs font-bold text-[#08110F] transition hover:bg-[#91E8D7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5F5E8] sm:w-auto"
                triggerContent={<>{isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}<span>{exporting ? `Exporting ${exporting.toUpperCase()}…` : 'Export'}</span><ChevronDown className="h-3.5 w-3.5" /></>}
                items={[
                  { label: 'Export PDF', icon: <FileDown className="h-4 w-4" />, onSelect: handleDownloadPDF, disabled: isExporting || !hasPreview || singlePageBlocked },
                  { label: 'Export DOCX', icon: <FileText className="h-4 w-4" />, onSelect: handleDownloadDocx, disabled: isExporting },
                  { label: 'Export Image', icon: <Image className="h-4 w-4" />, onSelect: handleDownloadImage, disabled: isExporting || !hasPreview || singlePageBlocked },
                ]}
              />
            </div>
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-1.5 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6" data-tour="template-controls">
          {orderedTemplates.map(template => {
            const recommended = semanticRecommendationIds.includes(template.id);
            const pageExpectation = templatePageExpectations[template.id] || 'checking';
            const pageLabel = pageExpectation === 'single'
              ? 'Single Page'
              : pageExpectation === 'multi'
                ? 'Multi Page'
                : 'Checking fit';
            return (
              <button key={template.id} type="button" onClick={() => {
                if (template.id === selectedTemplate) return;
                onTemplateChange(template.id);
                showToasts(`Switched to ${template.name}.`, 'info');
              }} aria-pressed={selectedTemplate === template.id} aria-label={`Switch template to ${template.name}. ${pageLabel}.`} className={`min-h-16 min-w-0 rounded-lg border px-2 py-2 text-[10px] font-bold leading-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72DFCA] ${selectedTemplate === template.id ? 'border-[#72DFCA] bg-[#15332F] text-[#B5F5E8]' : 'border-[#293544] bg-[#111827] text-zinc-300 hover:border-[#4A5B6E] hover:bg-[#182231] hover:text-white'}`} title={`${template.description} ${recommended ? 'Recommended for this resume.' : 'General template option.'} Expected behavior: ${pageLabel}.`}>
                <span className="block">{template.name}</span>
                <span className={`mt-1 block text-[8px] uppercase tracking-[0.1em] ${recommended ? 'text-[#72DFCA]' : 'text-zinc-500'}`}>
                  {recommended ? 'Recommended' : 'General Option'}
                </span>
                <span className={`mt-0.5 block text-[8px] font-semibold ${
                  pageExpectation === 'single'
                    ? 'text-emerald-300'
                    : pageExpectation === 'multi'
                      ? 'text-amber-300'
                      : 'text-zinc-500'
                }`}>
                  {pageLabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="resume-canvas relative flex min-h-[420px] min-w-0 flex-1 justify-center overflow-x-hidden overflow-y-auto rounded-xl border border-[#263241] bg-[#070A0C] p-2 sm:min-h-[560px] sm:p-4 lg:max-h-[85vh]">
        <div className="forge-pdf-preview-frame relative isolate w-full max-w-[794px]">
          {previewSlots.map((preview, slot) => preview ? (
            <iframe key={preview.url} src={`${preview.url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`} title={`${resume.title || 'Resume'} PDF preview${slot + 1}`} onLoad={() => promotePreviewSlot(slot, preview.sequence)} className={`forge-pdf-viewer absolute inset-0 min-h-[420px] sm:min-h-[560px] transition-opacity duration-200 ease-out ${activePreviewSlot === slot ? 'z-10 opacity-100' : 'z-0 opacity-0'}`} />
          ) : null)}
          {!hasPreview && (
            <div className="flex h-full flex-col bg-white p-[8%] text-slate-800" role="status" aria-live="polite">
              <div className="h-3 w-20 animate-pulse rounded-full bg-teal-500/80" />
              <div className="mt-[8%] h-6 w-2/3 animate-pulse rounded bg-slate-800/85" />
              <div className="mt-3 h-2.5 w-1/3 animate-pulse rounded bg-slate-300" />
              <span className="mt-auto text-center text-xs font-semibold text-slate-500">Preparing your template preview...</span>
            </div>
          )}
          {isPreviewRendering && hasPreview && (
            <div className="pointer-events-none absolute right-2 top-2 z-20 flex items-center gap-2 rounded-full border border-[#3A4A59] bg-[#0B0F14]/95 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-100 shadow-xl" role="status" aria-live="polite">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#72DFCA]" />
              Updating Preview...
            </div>
          )}
        </div>
      </div>
      <span className="sr-only">
        Current fit mode: {fitMode}. Preview and exported PDF use the same rendered document.
        {fitResult ? ` ${fitResult.pageCount} pages with ${fitResult.overflowRisk} overflow risk.` : ''}
      </span>
    </div>
  );
}

export default memo(ResumePreview, (previous, next) => (
  previous.resume === next.resume &&
  previous.selectedTemplate === next.selectedTemplate &&
  previous.profilePhoto === next.profilePhoto
));
