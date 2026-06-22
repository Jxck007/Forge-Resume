import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { isTemplateId, ResumeData, TemplateId, UserSettings } from '../types';
import {
  Plus,
  ArrowRight,
  FileText,
  Trash2,
  Copy,
  Archive,
  Activity,
  Loader2,
  Sparkles,
  Upload,
  FileDown,
  Image as ImageIcon,
  ClipboardList,
  X,
  CheckCircle2,
  AlertCircle,
  MoreHorizontal,
} from 'lucide-react';
import ConfirmationDialog from './ConfirmationDialog';
import {
  getImportAccept,
  prepareDocxImportPayload,
  prepareImageForImport,
  preparePdfImportPayload,
  ResumeImportError,
  ResumeImportMode,
  validateImportFile,
} from '../utils/resumeImport';
import { assessResumeImport, ReviewedImport } from '../utils/aiImportQuality';
import TemplateShowcase, { TEMPLATE_IDS, TEMPLATE_LABELS } from './TemplateShowcase';
import ActionMenu from './ActionMenu';
import { useAiSession } from '../contexts/AiSessionContext';

interface DashboardProps {
  resumes: ResumeData[];
  settings: UserSettings | null;
  hasProfileData: boolean;
  isGuestMode?: boolean;
  onCreateNew: (title: string, templateId: TemplateId, source: 'profile' | 'blank') => Promise<void>;
  onDuplicate: (resume: ResumeData) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggleArchive: (id: string, state: boolean) => Promise<void>;
  onSelectResume: (id: string) => void;
  onParseImport: (rawText: string) => Promise<ReviewedImport<ResumeData>>;
  onSaveImport: (parsedData: Partial<ResumeData>) => Promise<void>;
  onNavigate: (tab: 'dashboard' | 'builder' | 'settings') => void;
  onOpenAiAssist?: () => void;
  onRequestSignIn?: () => void;
  showToasts: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function Dashboard({
  resumes,
  settings,
  hasProfileData,
  isGuestMode = false,
  onCreateNew,
  onDuplicate,
  onDelete,
  onToggleArchive,
  onSelectResume,
  onParseImport,
  onSaveImport,
  onNavigate,
  onOpenAiAssist,
  onRequestSignIn,
  showToasts,
}: DashboardProps) {

  const [createOpen, setCreateOpen] = useState(false);
  const [templateGalleryOpen, setTemplateGalleryOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTemplate, setNewTemplate] = useState<TemplateId>(() => isTemplateId(settings?.defaultTemplate) ? settings.defaultTemplate : 'modern');
  const [createSource, setCreateSource] = useState<'profile' | 'blank' | 'import'>('profile');
  const [importMode, setImportMode] = useState<ResumeImportMode>('text');
  const [pastedText, setPastedText] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [reviewData, setReviewData] = useState<ReviewedImport<ResumeData> | null>(null);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [importTitle, setImportTitle] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInProgressRef = useRef(false);
  const importSourceRef = useRef('');
  const mountedRef = useRef(true);
  const [loadingAction, setLoadingAction] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    resumeId: string;
    resumeTitle: string;
  }>({
    isOpen: false,
    resumeId: '',
    resumeTitle: ''
  });
  const { state: aiState, generate, isGenerating } = useAiSession();

  useEffect(() => {
    importSourceRef.current = pastedText;
  }, [pastedText]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Computed metrics
  const activeResumes = resumes.filter(r => !r.isArchived);
  const latestResume = activeResumes[0] || null;
  const importAvailable = !isGuestMode;
  const openCreateDialog = () => {
    setCreateSource(hasProfileData ? 'profile' : 'blank');
    setCreateOpen(true);
  };
  const openBlankCreateDialog = () => {
    setCreateSource('blank');
    setCreateOpen(true);
  };
  const openLatestResume = () => {
    if (!latestResume) {
      showToasts('Create a resume first.', 'info');
      return;
    }
    onSelectResume(latestResume.id);
    onNavigate('builder');
  };


  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createSource === 'import') {
      setCreateOpen(false);
      setImportOpen(true);
      return;
    }
    if (!newTitle.trim()) {
      showToasts('Please name your resume.', 'info');
      return;
    }
    setLoadingAction(true);
    try {
      await onCreateNew(newTitle.trim(), newTemplate, createSource);
      setCreateOpen(false);
      setNewTitle('');
      setCreateSource('profile');
    } catch {
      showToasts('Failed to establish resume document.', 'error');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleDuplicateClick = async (resume: ResumeData) => {
    if (duplicatingId || loadingAction) return;
    setDuplicatingId(resume.id);
    try {
      await onDuplicate(resume);
    } catch {
      showToasts('Duplication request failed.', 'error');
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleArchiveClick = async (id: string, archived: boolean) => {
    if (archivingId || loadingAction) return;
    setArchivingId(id);
    try {
      await onToggleArchive(id, archived);
    } finally {
      setArchivingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    await onDelete(deleteDialog.resumeId);
    setDeleteDialog({ isOpen: false, resumeId: '', resumeTitle: '' });
  };

  const assistedImportAvailable = !isGuestMode && (
    (aiState.mode === 'free' && aiState.freeBetaAvailable === true) ||
    (aiState.mode === 'byok' && aiState.isConnected)
  );
  const aiStatusLabel = isGuestMode
    ? 'Sign in to use Free AI'
    : aiState.mode === 'byok' && aiState.isConnected
      ? 'BYOK connected'
      : aiState.freeStatusLoading
        ? 'Checking Free AI…'
        : aiState.mode === 'free' && aiState.freeBetaAvailable
          ? 'Free AI ready'
          : aiState.freeStatusReason === 'quota_store_missing'
            ? 'Free AI quota store not configured'
            : aiState.freeStatusReason === 'missing_provider_keys'
              ? 'Free AI provider keys missing'
              : aiState.freeStatusReason === 'guest'
                ? 'Sign in to use Free AI'
                : 'Free AI paused';
  const aiResetLabel = aiState.freeResetAt
    ? new Date(aiState.freeResetAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null;

  const resetImport = () => {
    setImportOpen(false);
    setImportMode('text');
    setPastedText('');
    setImportFile(null);
    setReviewData(null);
    setImportWarnings([]);
    setImportTitle('');
    setImportStatus('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const selectImportMode = (mode: ResumeImportMode) => {
    setImportMode(mode);
    setImportFile(null);
    setReviewData(null);
    setImportWarnings([]);
    setImportTitle('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImportParse = async () => {
    if (importInProgressRef.current) {
      showToasts('Import already in progress.', 'info');
      return;
    }
    if (!assistedImportAvailable) {
      showToasts('Choose Forge Free Beta AI or connect BYOK to use assisted import.', 'info');
      return;
    }

    importInProgressRef.current = true;
    setLoadingAction(true);
    setImportWarnings([]);
    setImportStatus('Reading file');
    try {
      let rawText = '';
      let sourceLabel = 'resume text';
      let requestBody: Record<string, unknown> | null = null;
      const collectedWarnings: string[] = [];

      if (importMode === 'text') {
        rawText = pastedText.trim();
        if (!rawText) {
          showToasts('Please paste the resume text before importing.', 'info');
          return;
        }
        requestBody = {
          sourceType: 'text',
          text: rawText,
          templateId: newTemplate,
        };
      } else {
        if (!importFile) {
          showToasts(`Please upload a ${importMode.toUpperCase()} file first.`, 'info');
          return;
        }
        const validationError = validateImportFile(importFile, importMode);
        if (validationError) {
          showToasts(validationError, 'error');
          return;
        }
        sourceLabel = `${importMode.toUpperCase()} file`;
        if (importMode === 'image') {
          setImportStatus('Reading file');
          const { base64: imageBase64, mimeType } = await prepareImageForImport(importFile);
          requestBody = { sourceType: 'image', imageBase64, mimeType, templateId: newTemplate };
          rawText = importFile.name;
        } else if (importMode === 'pdf') {
          setImportStatus('Extracting text');
          const prepared = await preparePdfImportPayload(importFile);
          collectedWarnings.push(...prepared.warnings);
          requestBody = prepared.sourceType === 'image'
            ? { sourceType: 'image', imageBase64: prepared.imageBase64, mimeType: prepared.mimeType, templateId: newTemplate }
            : { sourceType: 'pdf_text', text: prepared.text, templateId: newTemplate };
          rawText = prepared.sourceType === 'pdf_text' ? prepared.text : '';
        } else {
          setImportStatus('Extracting text');
          const prepared = await prepareDocxImportPayload(importFile);
          collectedWarnings.push(...prepared.warnings);
          if (!('text' in prepared)) {
            throw new ResumeImportError('DOCX import returned an invalid extraction payload.', 'docx_invalid_payload');
          }
          requestBody = { sourceType: prepared.sourceType, text: prepared.text, templateId: newTemplate };
          rawText = prepared.text;
        }
      }

      const titleFromFile = importFile?.name.replace(/\.[^.]+$/, '') || '';
      setImportTitle(prev => prev || titleFromFile || 'Imported Resume');
      showToasts(`Structuring ${sourceLabel} with AI...`, 'info');
      setImportStatus('Structuring content');

      const response = await fetch('/api/ai/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const payload = await response.json().catch(() => null) as null | { ok?: boolean; resume?: ResumeData; message?: string; warnings?: string[] };
      if (!mountedRef.current) return;
      if (!response.ok || !payload?.ok || !payload.resume) {
        showToasts(payload?.message || 'Resume import could not be completed.', 'error');
        return;
      }
      setImportStatus('Preparing review');
      setReviewData(assessResumeImport(payload.resume, rawText || JSON.stringify(payload.resume)));
      setImportWarnings([...collectedWarnings, ...(payload.warnings || [])]);
      setImportStatus('Ready for review');
      if (!importTitle) setImportTitle(titleFromFile || 'Imported Resume');
    } catch (error) {
      if (mountedRef.current) {
        const message = error instanceof ResumeImportError
          ? error.message
          : 'Resume import could not be completed. Check the source and AI connection, then try again.';
        showToasts(message, 'error');
      }
    } finally {
      importInProgressRef.current = false;
      if (mountedRef.current) setLoadingAction(false);
    }
  };

  const handleImportSave = async () => {
    if (!reviewData) return;
    if (!importTitle.trim()) {
      showToasts('Please name your imported resume.', 'info');
      return;
    }
    setLoadingAction(true);
    try {
      await onSaveImport({ ...reviewData.data, title: importTitle.trim(), templateId: newTemplate });
      resetImport();
      showToasts('Resume imported. Review before exporting.', 'success');
    } catch (error: unknown) {
      showToasts(error instanceof Error ? error.message : 'Unable to save imported resume.', 'error');
    } finally {
      setLoadingAction(false);
    }
  };

  const parsedReview = reviewData?.data;
  const previewCollection = <T,>(items: T[] | undefined, mapper: (item: T) => string, fallback = 'Not detected') => {
    const values = (items || []).map(mapper).map(value => value.trim()).filter(Boolean);
    return values.length ? values.slice(0, 3).join(' • ') : fallback;
  };
  const reviewSections = parsedReview ? [
    {
      label: 'Personal details',
      ready: Boolean(parsedReview.personalDetails?.fullName || parsedReview.personalDetails?.email),
      detail: [parsedReview.personalDetails?.fullName, parsedReview.personalDetails?.professionalTitle]
        .filter(Boolean).join(' · ') || 'Not detected',
    },
    {
      label: 'Professional summary',
      ready: Boolean(parsedReview.summary),
      detail: parsedReview.summary?.slice(0, 120) || 'Not detected',
    },
    {
      label: 'Experience',
      ready: Boolean(parsedReview.experience?.length),
      detail: previewCollection<NonNullable<typeof parsedReview.experience>[number]>(parsedReview.experience, item => `${item.title}${item.company ? ` — ${item.company}` : ''}`),
    },
    {
      label: 'Internships',
      ready: Boolean(parsedReview.internships?.length),
      detail: previewCollection<NonNullable<typeof parsedReview.internships>[number]>(parsedReview.internships, item => `${item.role}${item.company ? ` — ${item.company}` : ''}`),
    },
    {
      label: 'Education',
      ready: Boolean(parsedReview.education?.length),
      detail: previewCollection<NonNullable<typeof parsedReview.education>[number]>(parsedReview.education, item => `${item.degree}${item.institution ? ` — ${item.institution}` : ''}`),
    },
    {
      label: 'Projects',
      ready: Boolean(parsedReview.projects?.length),
      detail: previewCollection<NonNullable<typeof parsedReview.projects>[number]>(parsedReview.projects, item => item.name),
    },
    {
      label: 'Skills',
      ready: Object.values(parsedReview.skills || {}).some(values => Array.isArray(values) && values.length > 0),
      detail: Object.values(parsedReview.skills || {})
        .flatMap(values => Array.isArray(values) ? values : [])
        .slice(0, 6)
        .join(', ') || 'Not detected',
    },
    {
      label: 'Certifications and achievements',
      ready: Boolean(parsedReview.certifications?.length || parsedReview.achievements?.length),
      detail: [
        ...((parsedReview.certifications || []).slice(0, 2).map(item => item.name)),
        ...((parsedReview.achievements || []).slice(0, 2)),
      ].filter(Boolean).join(' • ') || 'Not detected',
    },
    {
      label: 'Languages',
      ready: Boolean(parsedReview.languages?.length),
      detail: parsedReview.languages?.join(', ') || 'Not detected',
    },
  ] : [];
  const reviewConfidenceKey: Record<string, string> = {
    'Personal details': 'personalDetails',
    'Professional summary': 'summary',
    Experience: 'experience',
    Internships: 'internships',
    Education: 'education',
    Projects: 'projects',
    Skills: 'skills',
    'Certifications and achievements': 'certifications',
    Languages: 'languages',
  };

  return (
    <div className="forge-product-page forge-dashboard-page mx-auto max-w-7xl px-4 py-6 font-sans sm:px-6 lg:px-8">
      <section className="mb-4 rounded-2xl bg-[#141A21] p-5 ring-1 ring-white/[0.06] sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <span className="forge-eyebrow">{isGuestMode ? 'Guest workspace' : 'Career workspace'}</span>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">Build your next resume</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
              Create, edit, preview, and export a polished resume from one clean workspace.
            </p>
            {isGuestMode && <p className="mt-2 text-xs text-zinc-500">Guest work is saved locally on this device.</p>}
          </div>
          <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-2">
            <button type="button" onClick={openCreateDialog} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#72DFCA] px-4 py-2.5 text-sm font-semibold text-[#08110F] hover:bg-[#91E8D7]">
              <Plus className="h-4 w-4" /> Create Resume
            </button>
            <button type="button" onClick={() => setImportOpen(true)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-zinc-200 ring-1 ring-white/10 hover:bg-white/[0.08]">
              <Upload className="h-4 w-4 text-zinc-400" /> Import Resume Beta
            </button>
          </div>
        </div>
      </section>

      <div className="mb-4 rounded-2xl border border-[#2A2E37] bg-[#111820] p-4 text-sm text-zinc-300">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-semibold text-white">Forge Free Beta AI</p>
            <p className="mt-1 text-zinc-400">Use AI to improve summaries, rewrite bullets, fix grammar, and import resumes. Every suggestion is reviewed before applying.</p>
          </div>
          <div className="text-xs text-zinc-400">{aiStatusLabel}</div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-medium text-zinc-400">
          <span className="rounded-full bg-white/[0.04] px-2.5 py-1">25 writing actions per 12 hours</span>
          <span className="rounded-full bg-white/[0.04] px-2.5 py-1">3 resume imports per 12 hours</span>
          <span className="rounded-full bg-white/[0.04] px-2.5 py-1">Limits protect the beta from abuse and cost spikes</span>
          <span className="rounded-full bg-white/[0.04] px-2.5 py-1">Using your own key does not use Forge Free AI quota</span>
        </div>
        {aiResetLabel && (
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-400">
            {typeof aiState.freeActionsRemaining === 'number' && <span>{aiState.freeActionsRemaining} actions left · resets at {aiResetLabel}</span>}
            {typeof aiState.freeImportsRemaining === 'number' && <span>{aiState.freeImportsRemaining} imports left · resets at {aiResetLabel}</span>}
          </div>
        )}
      </div>

      {isGuestMode && (
        <div className="mb-4 flex flex-col gap-2 rounded-xl bg-[#111820] px-4 py-3 text-xs text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
          <span>Build, preview, and export locally without an account.</span>
          <button type="button" onClick={onRequestSignIn} className="self-start font-semibold text-zinc-200 hover:text-white sm:self-auto">Sign in for cloud saving</button>
        </div>
      )}

      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-200">Quick actions</h2>
          {latestResume && <span className="truncate text-xs text-zinc-500">Latest: {latestResume.title}</span>}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { title: 'Create Resume', copy: 'Start a new document', icon: Plus, action: openCreateDialog, primary: true },
          { title: 'Import Resume Beta', copy: importAvailable ? 'Import pasted resume text' : 'Sign in to use import', icon: Upload, action: () => setImportOpen(true) },
          { title: 'Choose Template', copy: 'Preview resume layouts', icon: Activity, action: () => setTemplateGalleryOpen(true) },
          { title: 'Open Latest Resume', copy: latestResume ? 'Continue your latest draft' : 'No draft available yet', icon: FileText, action: openLatestResume, disabled: !latestResume },
        ].map(card => {
          const Icon = card.icon;
          return (
            <button
              key={card.title}
              type="button"
              data-tour={
                card.title === 'Create Resume' ? 'create-resume' :
                card.title === 'Import Resume Beta' ? 'import-resume' :
                card.title === 'Open Latest Resume' ? 'edit-resume' :
                'choose-template'
              }
              onClick={card.action}
              disabled={card.disabled}
              className={`group flex min-h-[72px] items-center gap-3 rounded-xl p-3 text-left disabled:cursor-not-allowed disabled:opacity-45 ${card.primary ? 'bg-[#18302D] ring-1 ring-[#72DFCA]/20 hover:bg-[#1C3935]' : 'bg-white/[0.035] ring-1 ring-white/[0.06] hover:bg-white/[0.06]'}`}
            >
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${card.primary ? 'bg-[#72DFCA] text-[#08110F]' : 'bg-white/[0.05] text-zinc-400'}`}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="min-w-0">
                <strong className="block truncate text-sm font-semibold text-white">{card.title}</strong>
                <span className="mt-0.5 block truncate text-xs text-zinc-500">{card.copy}</span>
              </span>
            </button>
          );
        })}
        </div>
      </div>

      {templateGalleryOpen && (
        <TemplateShowcase
          selectedTemplate={newTemplate}
          onSelect={setNewTemplate}
          onClose={() => setTemplateGalleryOpen(false)}
          onStart={() => {
            setTemplateGalleryOpen(false);
            setCreateSource(hasProfileData && !isGuestMode ? 'profile' : 'blank');
            setCreateOpen(true);
          }}
        />
      )}

      {/* Bottom: Recent Resumes */}
      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <span>Recent Resumes</span>
            <span className="flex items-center justify-center rounded-full bg-white/[0.05] px-2 py-0.5 text-xs font-semibold text-zinc-500">
              {activeResumes.length}
            </span>
          </h2>
        </div>

        {activeResumes.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl bg-white/[0.025] px-6 py-10 text-center ring-1 ring-white/[0.06]">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.05] text-zinc-500">
              <FileText className="h-6 w-6" />
            </div>
            <h3 className="mb-2 text-base font-semibold text-white">{isGuestMode ? 'Start your first resume' : 'Create your first resume'}</h3>
            <p className="mx-auto mb-5 max-w-md text-sm leading-relaxed text-zinc-400">
              {isGuestMode
                ? "You're using Forge as Guest. Your work is saved locally on this device."
                : "You haven't built any resumes yet. Start blank or import an existing resume."}
            </p>
            <div className="flex flex-col gap-4 sm:flex-row">
               <button
                onClick={openBlankCreateDialog}
                className="flex items-center space-x-2 rounded-xl bg-[#72DFCA] px-5 py-2.5 text-sm font-semibold text-[#08110F] transition hover:bg-[#91E8D7] cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Create Blank Resume</span>
              </button>
              <button
                onClick={() => setImportOpen(true)}
                className="flex items-center space-x-2 rounded-xl border border-[#2A2E37] bg-[#0F1115] px-5 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-zinc-600 hover:bg-[#131722] cursor-pointer"
              >
                <Upload className="h-4 w-4" />
                <span>Import Resume Beta</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activeResumes.map(r => (
              <motion.div
                key={r.id}
                layoutId={r.id}
                className="group relative flex min-h-[154px] cursor-pointer flex-col justify-between overflow-hidden rounded-2xl bg-[#161C23] p-5 ring-1 ring-white/[0.06] transition hover:bg-[#19212A] hover:ring-white/10"
                onClick={() => {
                  onSelectResume(r.id);
                  onNavigate('builder');
                }}
              >
                <div className="relative z-10">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.05] text-zinc-400">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div onClick={event => event.stopPropagation()}>
                      <ActionMenu
                        triggerLabel={`More actions for ${r.title}`}
                        triggerContent={<MoreHorizontal className="h-4 w-4" />}
                        triggerClassName="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.05] text-zinc-300 transition hover:bg-white/[0.09] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72DFCA]"
                        items={[
                          ...(!isGuestMode ? [{
                            label: duplicatingId === r.id ? 'Duplicating...' : 'Duplicate',
                            icon: duplicatingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />,
                            disabled: duplicatingId === r.id || !!duplicatingId,
                            onSelect: () => handleDuplicateClick(r),
                          }, {
                            label: archivingId === r.id ? 'Archiving...' : 'Archive',
                            icon: archivingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />,
                            disabled: archivingId === r.id || !!archivingId,
                            onSelect: () => handleArchiveClick(r.id, true),
                          }] : []),
                          {
                            label: 'Delete',
                            icon: <Trash2 className="h-4 w-4" />,
                            tone: 'danger',
                            onSelect: () => setDeleteDialog({ isOpen: true, resumeId: r.id, resumeTitle: r.title }),
                          },
                        ]}
                      />
                    </div>
                  </div>
                  <span className="mb-2 inline-flex max-w-full truncate rounded-md bg-white/[0.04] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    {TEMPLATE_LABELS[r.templateId] || r.templateId}
                  </span>
                  <h3 className="mb-1 break-words text-base font-semibold leading-snug text-white">
                    {r.title}
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Updated {new Date(r.updatedAt).toLocaleDateString()}
                  </p>
                </div>

                {/* Card Actions Footer */}
                <div
                  className="relative z-10 mt-4 flex items-center pt-3"
                  onClick={e => e.stopPropagation()} 
                >
                  <button
                    onClick={() => {
                      onSelectResume(r.id);
                      onNavigate('builder');
                    }}
                    className="flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-zinc-200 transition-colors hover:text-white"
                  >
                    <span>Open</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>

                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Archives Section */}
      {resumes.some(r => r.isArchived) && (
        <div className="border-t border-[#2A2E37] pt-10">
          <h3 className="text-lg font-bold text-zinc-400 mb-6 flex items-center gap-2">
            <span>Archived Documents</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {resumes
              .filter(r => r.isArchived)
              .map(r => (
                <div
                  key={r.id}
                  className="rounded-xl border border-[#2A2E37] bg-[#171A21]/50 p-5 flex items-center justify-between"
                >
                  <div className="truncate mr-4">
                    <h4 className="text-sm font-bold text-zinc-300 truncate mb-1">
                      {r.title}
                    </h4>
                    <p className="text-xs text-zinc-500 font-medium">
                      {new Date(r.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleArchiveClick(r.id, false)}
                      disabled={archivingId === r.id || !!archivingId}
                      className="px-3 py-1.5 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {archivingId === r.id ? 'Restoring...' : 'Restore'}
                    </button>
                    <button
                      onClick={() => {
                        setDeleteDialog({
                          isOpen: true,
                          resumeId: r.id,
                          resumeTitle: r.title
                        });
                      }}
                      className="p-2 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* CREATE DIALOG MODAL */}
      <AnimatePresence>
        {createOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="w-full max-w-5xl rounded-2xl border border-[#2A2E37] bg-[#171A21] p-5 shadow-2xl max-h-[92vh] overflow-y-auto sm:p-6"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-white mb-2">Create resume</h3>
              <p className="text-sm text-zinc-400 font-medium leading-relaxed mb-6">Choose what to start from, then select the template you want to build with.</p>

              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Starting Content
                  </label>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => setCreateSource('blank')}
                      className={`rounded-xl border p-3 text-left transition ${
                        createSource === 'blank'
                          ? 'border-emerald-400 bg-emerald-400/10 text-emerald-200'
                          : 'border-[#2A2E37] bg-[#0F1115] text-zinc-300 hover:border-zinc-600'
                      }`}
                    >
                      <div className="text-sm font-semibold">Start from scratch</div>
                      <div className="mt-1 text-xs text-zinc-400">Open a clean resume and enter details yourself.</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateSource('import')}
                      className={`rounded-xl border p-3 text-left transition ${
                        createSource === 'import'
                          ? 'border-emerald-400 bg-emerald-400/10 text-emerald-200'
                          : 'border-[#2A2E37] bg-[#0F1115] text-zinc-300 hover:border-zinc-600'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-sm font-semibold"><span>Import resume beta</span>{isGuestMode && <small className="text-amber-300">Sign in</small>}</div>
                      <div className="mt-1 text-xs text-zinc-400">Paste resume text and review the structured result before saving.</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => hasProfileData && !isGuestMode && setCreateSource('profile')}
                      disabled={!hasProfileData || isGuestMode}
                      className={`rounded-xl border p-3 text-left transition ${
                        createSource === 'profile'
                          ? 'border-emerald-400 bg-emerald-400/10 text-emerald-200'
                          : 'border-[#2A2E37] bg-[#0F1115] text-zinc-300 hover:border-zinc-600'
                      } disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      <div className="flex items-center justify-between gap-2 text-sm font-semibold"><span>Use saved profile</span>{isGuestMode && <small className="text-amber-300">Sign in</small>}</div>
                      <div className="mt-1 text-xs text-zinc-400">
                        Prefill summary, skills, education, projects, certifications, achievements, and contact details.
                      </div>
                    </button>
                  </div>
                  {!isGuestMode && !hasProfileData && (
                    <p className="mt-2 text-xs text-amber-300">
                      Add profile details first to enable Create Resume From Profile.
                    </p>
                  )}
                </div>

                {createSource !== 'import' && <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Resume Name
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder="e.g., Senior Full-Stack Engineer"
                    className="w-full px-4 py-2.5 rounded-xl border border-[#2A2E37] bg-[#0F1115] text-sm text-white placeholder:text-zinc-600 focus:border-indigo-500 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    required
                  />
                </div>}

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Template
                  </label>
                  <select
                    value={newTemplate}
                    onChange={event => setNewTemplate(event.target.value as TemplateId)}
                    className="w-full rounded-xl border border-[#2A2E37] bg-[#0F1115] px-4 py-2.5 text-sm text-white outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/10 transition-all"
                  >
                    {TEMPLATE_IDS.map(templateId => (
                      <option key={templateId} value={templateId}>{TEMPLATE_LABELS[templateId]}</option>
                    ))}
                  </select>
                </div>

                <div className="rounded-xl border border-[#2A2E37] bg-[#0F1115] p-3 text-sm text-zinc-300">
                  Selected template: <strong className="text-white">{TEMPLATE_LABELS[newTemplate]}</strong>
                </div>

                <div className="flex justify-end gap-3 pt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setCreateOpen(false);
                      setCreateSource(hasProfileData ? 'profile' : 'blank');
                    }}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-zinc-400 hover:text-white hover:bg-[#2A2E37] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loadingAction}
                    className="flex items-center space-x-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-2 text-sm font-semibold text-white shadow-md transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                  >
                    {loadingAction ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>{createSource === 'import' ? (isGuestMode ? 'Continue to sign in' : 'Continue to import') : 'Start building'}</span>}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* IMPORT DIALOG MODAL */}
      <AnimatePresence>
        {importOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#2A2E37] bg-[#171A21] shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between border-b border-[#2A2E37] p-6">
                <div>
                  <h3 className="flex items-center gap-2 text-xl font-bold text-white">
                    <Upload className="h-5 w-5 text-emerald-300" />
                    <span>{reviewData ? 'Review imported resume beta' : 'Import Resume Beta'}</span>
                  </h3>
                  <p className="mt-1 text-sm font-medium leading-relaxed text-zinc-400">
                    {reviewData
                      ? 'Verify the extracted sections before creating a new Forge resume.'
                      : 'Choose one source. Beta import reviews extracted text before creating a new Forge resume.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetImport}
                  disabled={loadingAction}
                  className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
                  aria-label="Close import"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
              {!reviewData ? (
                <div className="space-y-5 p-6">
                  <div className="flex flex-col gap-4 border-y border-[#2A2E37] px-6 py-5 sm:flex-row sm:items-end sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Import target</p>
                      <p className="mt-1 text-sm text-zinc-300">Select the template this imported resume should use.</p>
                    </div>
                    <div className="w-full sm:w-1/2">
                      <select
                        value={newTemplate}
                        onChange={event => setNewTemplate(event.target.value as TemplateId)}
                        className="w-full rounded-xl border border-[#2A2E37] bg-[#0F1115] px-4 py-2.5 text-sm text-white outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/10 transition-all"
                      >
                        {TEMPLATE_IDS.map(templateId => (
                          <option key={templateId} value={templateId}>{TEMPLATE_LABELS[templateId]}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {isGuestMode ? (
                    <div className="rounded-xl border border-[#2A2E37] bg-[#0F1115] p-5 text-sm text-zinc-300">
                      <p className="font-semibold text-white">Guest import stays manual.</p>
                      <p className="mt-2 text-zinc-400">Sign in to use Forge Free Beta AI or connect BYOK for pasted-text import.</p>
                      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => {
                            resetImport();
                            openBlankCreateDialog();
                          }}
                          className="rounded-xl bg-[#72DFCA] px-4 py-2 text-sm font-semibold text-[#08110F] transition hover:bg-[#91E8D7]"
                        >
                          Start Blank
                        </button>
                        <button
                          type="button"
                          onClick={onRequestSignIn}
                          className="rounded-xl border border-[#2A2E37] bg-[#171A21] px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-zinc-600 hover:bg-[#1A1F27]"
                        >
                          Sign In
                        </button>
                      </div>
                    </div>
                  ) : !assistedImportAvailable ? (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm font-medium text-amber-300">
                      <p>Assisted import needs Forge Free Beta AI or a connected BYOK provider.</p>
                      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => {
                            resetImport();
                            onOpenAiAssist?.();
                          }}
                          className="rounded-xl bg-[#72DFCA] px-4 py-2 text-sm font-semibold text-[#08110F] transition hover:bg-[#91E8D7]"
                        >
                          Open AI Assist
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            resetImport();
                            openBlankCreateDialog();
                          }}
                          className="rounded-xl border border-[#2A2E37] bg-[#171A21] px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-zinc-600 hover:bg-[#1A1F27]"
                        >
                          Create manually
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {[
                          { id: 'pdf' as const, label: 'PDF', icon: FileText, disabled: false },
                          { id: 'docx' as const, label: 'DOCX', icon: FileDown, disabled: false },
                          { id: 'image' as const, label: 'Image', icon: ImageIcon, disabled: aiState.mode === 'free' && aiState.freeStatusReason === 'missing_provider_keys' },
                          { id: 'text' as const, label: 'Paste Text', icon: ClipboardList, disabled: false },
                        ].map(option => (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => selectImportMode(option.id)}
                            disabled={loadingAction || option.disabled}
                            className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border p-3 text-xs font-bold transition ${
                              importMode === option.id
                                ? 'border-emerald-400 bg-emerald-400/10 text-emerald-200'
                                : option.disabled
                                  ? 'cursor-not-allowed border-zinc-800 bg-zinc-950/30 text-zinc-600'
                                  : 'border-zinc-700 bg-zinc-900/40 text-zinc-400 hover:border-zinc-600 hover:text-white'
                            }`}
                          >
                            <option.icon className="h-5 w-5" />
                            {option.label}
                            {option.id === 'image' && option.disabled && <span className="text-[10px] font-medium uppercase tracking-wide">Gemini required</span>}
                          </button>
                        ))}
                      </div>

                      {importMode === 'text' ? (
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-zinc-300">
                            Resume text for AI import
                          </label>
                          <textarea
                            value={pastedText}
                            onChange={event => setPastedText(event.target.value)}
                            rows={5}
                            maxLength={12000}
                            placeholder="Paste your resume text here…"
                            className="min-h-[160px] max-h-[260px] w-full resize-y rounded-xl border border-[#2A2E37] bg-[#0F1115] p-4 font-mono text-sm text-zinc-300 outline-none transition placeholder:text-zinc-600 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/10"
                          />
                          <p className="mt-1 text-right text-[10px] text-zinc-500">{pastedText.length}/12,000</p>
                        </div>
                      ) : (
                        <div>
                          {assistedImportAvailable ? (
                            <>
                              <label className="group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#344354] bg-[#0F1115] px-5 py-8 text-center transition hover:border-emerald-400/50 hover:bg-[#121821] focus-within:border-emerald-400/50 focus-within:ring-2 focus-within:ring-emerald-400/10">
                                <Upload className="h-6 w-6 text-zinc-400 transition group-hover:text-emerald-300" />
                                <div>
                                  <p className="text-sm font-semibold text-white">
                                    {importFile ? importFile.name : `Choose a ${importMode.toUpperCase()} file`}
                                  </p>
                                  <p className="mt-1 text-xs text-zinc-500">
                                    {importMode === 'pdf' && 'Allowed: PDF up to 5MB'}
                                    {importMode === 'docx' && 'Allowed: DOCX up to 5MB'}
                                    {importMode === 'image' && 'Allowed: PNG, JPG, JPEG, WEBP up to 4MB'}
                                  </p>
                                </div>
                                <input
                                  ref={fileInputRef}
                                  type="file"
                                  accept={getImportAccept(importMode)}
                                  onChange={event => setImportFile(event.target.files?.[0] || null)}
                                  className="sr-only"
                                />
                              </label>
                              <p className="mt-1 text-xs text-zinc-500">
                                {importMode === 'pdf' && 'PDF uses local text extraction first. Weak or scanned PDFs may need image import, DOCX, or pasted text.'}
                                {importMode === 'docx' && 'DOCX text is extracted in the browser.'}
                                {importMode === 'image' && 'Images are resized if needed, then sent to AI vision for structured extraction.'}
                              </p>
                            </>
                          ) : (
                            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
                              Assisted import is not available right now.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-5 p-6">
                  <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-emerald-200">Import confidence</p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {reviewData.confidence.rejectedFields} unsupported fields excluded
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-sm font-black text-emerald-300">
                      {reviewData.confidence.overall}%
                    </span>
                  </div>
                  {importWarnings.length > 0 && (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                      <p className="text-xs font-bold uppercase tracking-wider text-amber-300">Import warnings</p>
                      <ul className="mt-2 space-y-1 text-xs text-amber-100/90">
                        {importWarnings.map(warning => <li key={warning}>• {warning}</li>)}
                      </ul>
                    </div>
                  )}
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-zinc-300">Resume name</span>
                    <input
                      type="text"
                      value={importTitle}
                      onChange={event => setImportTitle(event.target.value)}
                      maxLength={100}
                      placeholder="e.g., Frontend Engineer — Acme"
                      className="w-full rounded-xl border border-[#2A2E37] bg-[#0F1115] px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/10"
                      autoFocus
                    />
                    <span className="mt-1.5 block text-xs text-zinc-500">Use any name that helps identify this version. AI does not choose it for you.</span>
                  </label>
                  <div className="space-y-2">
                    {reviewSections.map(section => {
                      const confidence = reviewData.confidence.sections[reviewConfidenceKey[section.label]];
                      return (
                        <div
                          key={section.label}
                          className={`flex items-start gap-3 rounded-xl border p-3.5 ${
                            section.ready
                              ? 'border-emerald-900/50 bg-emerald-950/15'
                              : 'border-zinc-800 bg-zinc-900/30'
                          }`}
                        >
                          {section.ready ? (
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                          ) : (
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-zinc-600" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-xs font-bold uppercase tracking-wider text-zinc-200">{section.label}</p>
                              {confidence && (
                                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                                  {confidence.score}% {confidence.level}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 whitespace-pre-wrap break-words text-xs leading-5 text-zinc-400">{section.detail}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              </div>

              <div className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-[#2A2E37] bg-[#171A21] p-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <span className="block text-xs text-zinc-500">
                    {reviewData ? `${reviewSections.filter(section => section.ready).length} sections detected` : 'Nothing is saved until review is confirmed.'}
                  </span>
                  {importStatus && <span className="block text-xs text-zinc-400">{importStatus}</span>}
                </div>
                <div className="flex gap-3">
                  {reviewData && (
                    <button
                      type="button"
                      onClick={() => setReviewData(null)}
                      disabled={loadingAction}
                      className="rounded-xl px-4 py-2 text-sm font-semibold text-zinc-400 transition hover:bg-[#2A2E37] hover:text-white"
                    >
                      Back
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={resetImport}
                    disabled={loadingAction}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-zinc-400 transition hover:bg-[#2A2E37] hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={reviewData ? handleImportSave : handleImportParse}
                    disabled={isGuestMode || loadingAction || isGenerating || !assistedImportAvailable || !newTemplate || (Boolean(reviewData) && !importTitle.trim()) || (!reviewData && importMode === 'text' && !pastedText.trim()) || (!reviewData && importMode !== 'text' && !importFile)}
                    className="flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {loadingAction ? <Loader2 className="h-4 w-4 animate-spin" /> : reviewData ? <CheckCircle2 className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                    <span>{loadingAction ? 'Importing…' : reviewData ? 'Save imported resume' : importMode === 'text' ? 'Import resume text' : importMode === 'pdf' ? 'Import PDF resume' : importMode === 'docx' ? 'Import DOCX resume' : 'Import image resume'}</span>
                  </button>
                </div>
              </div>
              {loadingAction && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#090C10]/80 p-6 backdrop-blur-sm">
                  <div className="w-full max-w-sm rounded-2xl border border-[#2A2E37] bg-[#111820] p-5 text-center shadow-2xl">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-300">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                    <h4 className="mt-4 text-base font-semibold text-white">{reviewData ? 'Saving resume…' : 'Extracting resume…'}</h4>
                    <p className="mt-1 text-sm text-zinc-400">{reviewData ? 'Creating your imported draft' : importStatus || 'Preparing review'}</p>
                    {!reviewData && (
                      <div className="mt-4 grid grid-cols-2 gap-2 text-left text-xs text-zinc-500">
                        {['Reading file', 'Extracting text', 'Structuring content', 'Preparing review'].map(step => (
                          <div
                            key={step}
                            className={`rounded-xl border px-3 py-2 ${
                              importStatus === step
                                ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
                                : 'border-[#2A2E37] bg-[#0F1115]'
                            }`}
                          >
                            {step}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmationDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, resumeId: '', resumeTitle: '' })}
        onConfirm={handleDeleteConfirm}
        title="Delete Resume Document?"
        message={`Are you sure you want to delete "${deleteDialog.resumeTitle}"? This will permanently delete the selected resume, historical records, and customized layout contents.`}
        confirmText="Delete Document"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
}
