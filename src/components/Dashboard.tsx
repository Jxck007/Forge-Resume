import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ResumeData, TemplateId, UserSettings } from '../types';
import {
  Plus,
  ArrowRight,
  FileText,
  Trash2,
  Copy,
  Archive,
  Star,
  Activity,
  Award,
  Loader2,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Upload,
  FileDown,
  Image as ImageIcon,
  ClipboardList,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import ConfirmationDialog from './ConfirmationDialog';
import { extractResumeText, getImportAccept, ResumeImportMode, validateImportFile } from '../utils/resumeImport';

interface DashboardProps {
  resumes: ResumeData[];
  settings: UserSettings | null;
  onCreateNew: (title: string, templateId: TemplateId) => Promise<void>;
  onDuplicate: (resume: ResumeData) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggleArchive: (id: string, state: boolean) => Promise<void>;
  onSelectResume: (id: string) => void;
  onParseImport: (rawText: string) => Promise<Partial<ResumeData>>;
  onSaveImport: (parsedData: Partial<ResumeData>) => Promise<void>;
  setActiveTab: (tab: 'dashboard' | 'builder' | 'ats' | 'settings') => void;
  showToasts: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function Dashboard({
  resumes,
  settings,
  onCreateNew,
  onDuplicate,
  onDelete,
  onToggleArchive,
  onSelectResume,
  onParseImport,
  onSaveImport,
  setActiveTab,
  showToasts,
}: DashboardProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTemplate, setNewTemplate] = useState<TemplateId>('modern');
  const [importMode, setImportMode] = useState<ResumeImportMode>('pdf');
  const [pastedText, setPastedText] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [reviewData, setReviewData] = useState<Partial<ResumeData> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  // Computed metrics
  const activeResumes = resumes.filter(r => !r.isArchived);
  const totalCount = resumes.length;
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      showToasts('Please name your resume.', 'info');
      return;
    }
    setLoadingAction(true);
    try {
      await onCreateNew(newTitle.trim(), newTemplate);
      setCreateOpen(false);
      setNewTitle('');
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

  const isAiConfigured = Boolean(
    (settings?.aiProvider === 'Gemini' && settings?.geminiApiKey) ||
    (settings?.aiProvider === 'OpenAI' && settings?.openaiApiKey) ||
    (settings?.aiProvider === 'OpenRouter' && settings?.openRouterApiKey) ||
    ((settings?.aiProvider === 'Groq' || !settings?.aiProvider) && settings?.groqApiKey)
  );

  const resetImport = () => {
    setImportOpen(false);
    setImportMode('pdf');
    setPastedText('');
    setImportFile(null);
    setReviewData(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const selectImportMode = (mode: ResumeImportMode) => {
    setImportMode(mode);
    setImportFile(null);
    setReviewData(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImportParse = async () => {
    if (!isAiConfigured) {
      showToasts(`Configure your ${settings?.aiProvider || 'Groq'} API key in Settings before importing.`, 'error');
      return;
    }

    setLoadingAction(true);
    try {
      let rawText = pastedText.trim();
      if (importMode !== 'text') {
        if (!importFile) {
          showToasts(`Choose a ${importMode.toUpperCase()} file first.`, 'info');
          return;
        }
        const fileError = validateImportFile(importFile, importMode);
        if (fileError) {
          showToasts(fileError, 'error');
          return;
        }
        showToasts('Extracting resume text...', 'info');
        rawText = (await extractResumeText(importFile, importMode)).trim();
      }

      if (!rawText) {
        showToasts('No readable resume text was found. Try another file or paste text.', 'error');
        return;
      }

      showToasts('Structuring resume data with AI...', 'info');
      setReviewData(await onParseImport(rawText));
    } catch (error: unknown) {
      showToasts(error instanceof Error ? error.message : 'Resume import failed.', 'error');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleImportSave = async () => {
    if (!reviewData) return;
    setLoadingAction(true);
    try {
      await onSaveImport(reviewData);
      resetImport();
      showToasts('Imported resume saved.', 'success');
    } catch (error: unknown) {
      showToasts(error instanceof Error ? error.message : 'Unable to save imported resume.', 'error');
    } finally {
      setLoadingAction(false);
    }
  };

  const reviewSections = reviewData ? [
    {
      label: 'Personal details',
      ready: Boolean(reviewData.personalDetails?.fullName || reviewData.personalDetails?.email),
      detail: [reviewData.personalDetails?.fullName, reviewData.personalDetails?.professionalTitle]
        .filter(Boolean).join(' · ') || 'Not detected',
    },
    {
      label: 'Professional summary',
      ready: Boolean(reviewData.summary),
      detail: reviewData.summary?.slice(0, 120) || 'Not detected',
    },
    {
      label: 'Experience',
      ready: Boolean(reviewData.experience?.length),
      detail: `${reviewData.experience?.length || 0} entries`,
    },
    {
      label: 'Education',
      ready: Boolean(reviewData.education?.length),
      detail: `${reviewData.education?.length || 0} entries`,
    },
    {
      label: 'Projects',
      ready: Boolean(reviewData.projects?.length),
      detail: `${reviewData.projects?.length || 0} entries`,
    },
    {
      label: 'Skills',
      ready: Object.values(reviewData.skills || {}).some(values => values?.length),
      detail: Object.values(reviewData.skills || {}).flat().slice(0, 6).join(', ') || 'Not detected',
    },
    {
      label: 'Certifications and achievements',
      ready: Boolean(reviewData.certifications?.length || reviewData.achievements?.length),
      detail: `${(reviewData.certifications?.length || 0) + (reviewData.achievements?.length || 0)} entries`,
    },
  ] : [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 font-sans">
      {/* Top: Welcome & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <span className="forge-eyebrow">Career workspace</span>
          <h2 className="text-3xl font-bold tracking-tight text-white mt-2 mb-2">
            Build your next application
          </h2>
          <p className="text-sm text-zinc-400">
            Keep every resume targeted, measurable, and ready for recruiters.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center space-x-2 rounded-xl bg-[#171A21] border border-[#2A2E37] hover:bg-[#1f232c] hover:border-zinc-700 px-4 py-2.5 text-sm font-semibold text-zinc-300 shadow-sm transition-all cursor-pointer"
          >
            <Upload className="h-4 w-4" />
            <span>Import resume</span>
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center space-x-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/20 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New Resume</span>
          </button>
        </div>
      </div>

      {/* Middle: Resume Statistics */}
      <div className="mb-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[#2A2E37] bg-[#171A21] p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Total Resumes</span>
            <div className="p-2 rounded-lg bg-zinc-800/50 text-zinc-400">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{totalCount}</span>
            <span className="text-xs text-zinc-400 font-medium">documents</span>
          </div>
        </div>

        <div className="rounded-2xl border border-[#2A2E37] bg-[#171A21] p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Active</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{activeResumes.length}</span>
            <span className="text-xs text-emerald-400 font-medium">in rotation</span>
          </div>
        </div>

        <div className="rounded-2xl border border-[#2A2E37] bg-[#171A21] p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">ATS Reports</span>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Award className="h-4 w-4" />
            </div>
          </div>
          <div className="flex flex-col justify-end h-full">
            <button onClick={() => setActiveTab('ats')} className="text-left group">
              <span className="text-xl font-bold text-white group-hover:text-emerald-300 transition">Analyze now</span>
              <p className="text-xs text-zinc-500 mt-1">Check match score and missing keywords</p>
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-[#2A2E37] bg-[#171A21] p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Profile Completion</span>
            <div className={`p-2 rounded-lg ${settings?.hasCompletedProfile ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
              <Star className="h-4 w-4" />
            </div>
          </div>
          <div className="flex flex-col justify-end h-full">
            <span className={`text-xl font-bold tracking-tight mb-1 ${settings?.hasCompletedProfile ? 'text-emerald-400' : 'text-amber-400'}`}>
              {settings?.hasCompletedProfile ? 'Ready' : 'Incomplete'}
            </span>
            <p className="text-xs text-zinc-500 font-medium">
              {settings?.hasCompletedProfile ? 'Career details ready to reuse' : 'Add profile details to save time'}
            </p>
          </div>
        </div>
      </div>

      <div className="forge-quick-actions">
        <div>
          <span className="forge-eyebrow">Quick actions</span>
          <h3>Move your application forward</h3>
        </div>
        <button onClick={() => setCreateOpen(true)}><Plus /><span><strong>Create resume</strong><small>Start from a professional template</small></span></button>
        <button onClick={() => setActiveTab('ats')}><Activity /><span><strong>Run ATS analysis</strong><small>Compare a resume with a job description</small></span></button>
        <button onClick={() => setImportOpen(true)}><Upload /><span><strong>Import existing resume</strong><small>Bring your current content into Forge</small></span></button>
      </div>

      {/* Bottom: Recent Resumes */}
      <div className="mb-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-3">
            <span>Recent Resumes</span>
            <span className="flex items-center justify-center bg-[#171A21] border border-[#2A2E37] text-zinc-400 text-xs font-bold px-2 py-0.5 rounded-full">
              {activeResumes.length}
            </span>
          </h3>
        </div>

        {activeResumes.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#2A2E37] bg-[#171A21]/30 py-20 px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#171A21] border border-[#2A2E37] text-zinc-500 mb-6 shadow-sm">
              <FileText className="h-6 w-6" />
            </div>
            <h4 className="text-base font-bold text-white mb-2">No resumes found</h4>
            <p className="text-sm text-zinc-400 max-w-md mx-auto mb-8 leading-relaxed">
              You haven't built any resumes yet. Start fresh by creating a new document, or import an existing resume using AI.
            </p>
            <div className="flex gap-4">
               <button
                onClick={() => setCreateOpen(true)}
                className="flex items-center space-x-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white transition-all shadow-md shadow-indigo-900/20 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Create resume</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {activeResumes.map(r => (
              <motion.div
                key={r.id}
                layoutId={r.id}
                className="group relative rounded-2xl border border-[#2A2E37] bg-[#171A21] p-6 shadow-sm hover:border-zinc-600 transition-all cursor-pointer flex flex-col justify-between min-h-[200px] overflow-hidden"
                onClick={() => onSelectResume(r.id)}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0F1115] text-indigo-400 border border-[#2A2E37] shadow-sm">
                      <FileText className="h-5 w-5" />
                    </div>
                    <span className="rounded-md bg-[#0F1115] border border-[#2A2E37] px-2.5 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                      {r.templateId}
                    </span>
                  </div>
                  <h4 className="text-lg font-bold text-white mb-2 truncate">
                    {r.title}
                  </h4>
                  <p className="text-xs font-medium text-zinc-500">
                    Modified • {new Date(r.updatedAt).toLocaleDateString()}
                  </p>
                </div>

                {/* Card Actions Footer */}
                <div 
                  className="relative z-10 mt-6 flex items-center justify-between border-t border-[#2A2E37] pt-4"
                  onClick={e => e.stopPropagation()} 
                >
                  <button
                    onClick={() => onSelectResume(r.id)}
                    className="text-sm font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Open Editor</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleDuplicateClick(r)}
                      disabled={duplicatingId === r.id || !!duplicatingId}
                      className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Duplicate"
                    >
                      {duplicatingId === r.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleArchiveClick(r.id, true)}
                      disabled={archivingId === r.id || !!archivingId}
                      className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Archive"
                    >
                      {archivingId === r.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Archive className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setDeleteDialog({
                          isOpen: true,
                          resumeId: r.id,
                          resumeTitle: r.title
                        });
                      }}
                      className="p-2 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="w-full max-w-md rounded-2xl border border-[#2A2E37] bg-[#171A21] p-6 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-white mb-2">Create resume</h3>
              <p className="text-sm text-zinc-400 font-medium leading-relaxed mb-6">Choose a name and starting template for your new document.</p>

              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div>
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
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Starting Template
                  </label>
                  <select
                    value={newTemplate}
                    onChange={e => setNewTemplate(e.target.value as TemplateId)}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#2A2E37] bg-[#0F1115] text-sm text-white focus:border-indigo-500 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  >
                    <option value="modern">Modern Professional</option>
                    <option value="minimal">Minimal Elegant</option>
                    <option value="corporate">Corporate Standard</option>
                    <option value="executive">Executive Boardroom</option>
                    <option value="creative">Creative Dynamic</option>
                    <option value="atsFriendly">Strict ATS Friendly</option>
                    <option value="softwareEngineer">Software Engineer Special</option>
                    <option value="student">Student / Academic</option>
                    <option value="startup">Startup Growth</option>
                    <option value="designer">Designer Portfolio</option>
                    <option value="dataAnalyst">Metrics & Data Analyst</option>
                    <option value="classic">Classic Editorial</option>
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-6">
                  <button
                    type="button"
                    onClick={() => setCreateOpen(false)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-zinc-400 hover:text-white hover:bg-[#2A2E37] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loadingAction}
                    className="flex items-center space-x-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-2 text-sm font-semibold text-white shadow-md transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                  >
                    {loadingAction ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>Create Document</span>}
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#2A2E37] bg-[#171A21] shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between border-b border-[#2A2E37] p-6">
                <div>
                  <h3 className="flex items-center gap-2 text-xl font-bold text-white">
                    <Upload className="h-5 w-5 text-emerald-300" />
                    <span>{reviewData ? 'Review imported resume' : 'Import existing resume'}</span>
                  </h3>
                  <p className="mt-1 text-sm font-medium leading-relaxed text-zinc-400">
                    {reviewData
                      ? 'Verify the extracted sections before creating a new Forge resume.'
                      : 'Choose one source. Files are converted to text, then structured with your configured AI provider.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetImport}
                  className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
                  aria-label="Close import"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {!reviewData ? (
                  <div className="space-y-5">
                    {!isAiConfigured && (
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm font-medium text-amber-300">
                        Configure your {settings?.aiProvider || 'Groq'} API key in Settings before importing.
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {[
                        { id: 'pdf' as const, label: 'Upload PDF', icon: FileText },
                        { id: 'docx' as const, label: 'Upload DOCX', icon: FileDown },
                        { id: 'image' as const, label: 'Upload Image', icon: ImageIcon },
                        { id: 'text' as const, label: 'Paste Text', icon: ClipboardList },
                      ].map(option => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => selectImportMode(option.id)}
                          className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border p-3 text-xs font-bold transition ${
                            importMode === option.id
                              ? 'border-emerald-400 bg-emerald-400/10 text-emerald-200'
                              : 'border-zinc-700 bg-zinc-900/40 text-zinc-400 hover:border-zinc-600 hover:text-white'
                          }`}
                        >
                          <option.icon className="h-5 w-5" />
                          {option.label}
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
                          rows={10}
                          maxLength={10000}
                          placeholder="Paste resume content here..."
                          className="w-full resize-none rounded-xl border border-[#2A2E37] bg-[#0F1115] p-4 font-mono text-sm text-zinc-300 outline-none transition placeholder:text-zinc-600 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/10"
                        />
                        <p className="mt-1 text-right text-[10px] text-zinc-500">{pastedText.length}/10,000</p>
                      </div>
                    ) : (
                      <div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept={getImportAccept(importMode)}
                          onChange={event => setImportFile(event.target.files?.[0] || null)}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex min-h-40 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-700 bg-zinc-900/30 p-6 text-center transition hover:border-emerald-400/70"
                        >
                          <Upload className="mb-3 h-7 w-7 text-emerald-300" />
                          <strong className="text-sm text-white">
                            {importFile ? importFile.name : `Choose ${importMode.toUpperCase()} file`}
                          </strong>
                          <span className="mt-1 text-xs text-zinc-500">
                            {importMode === 'pdf' && 'Text extraction uses PDF.js'}
                            {importMode === 'docx' && 'Text extraction uses Mammoth.js'}
                            {importMode === 'image' && 'OCR uses Tesseract.js · JPG, PNG, or WEBP'}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {reviewSections.map(section => (
                      <div
                        key={section.label}
                        className={`flex items-start gap-3 rounded-xl border p-3.5 ${
                          section.ready
                            ? 'border-emerald-900/50 bg-emerald-950/15'
                            : 'border-zinc-800 bg-zinc-900/30'
                        }`}
                      >
                        {section.ready
                          ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                          : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-zinc-600" />}
                        <div className="min-w-0">
                          <p className="text-xs font-bold uppercase tracking-wider text-zinc-200">{section.label}</p>
                          <p className="mt-0.5 truncate text-xs text-zinc-500">{section.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-[#2A2E37] p-6 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs text-zinc-500">
                  {reviewData ? `${reviewSections.filter(section => section.ready).length} sections detected` : 'Nothing is saved until review is confirmed.'}
                </span>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => reviewData ? setReviewData(null) : resetImport()}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-zinc-400 transition hover:bg-[#2A2E37] hover:text-white"
                  >
                    {reviewData ? 'Back' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    onClick={reviewData ? handleImportSave : handleImportParse}
                    disabled={loadingAction || !isAiConfigured || (!reviewData && importMode === 'text' && !pastedText.trim()) || (!reviewData && importMode !== 'text' && !importFile)}
                    className="flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {loadingAction ? <Loader2 className="h-4 w-4 animate-spin" /> : reviewData ? <CheckCircle2 className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                    <span>{reviewData ? 'Save Imported Resume' : 'Extract and Review'}</span>
                  </button>
                </div>
              </div>
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
