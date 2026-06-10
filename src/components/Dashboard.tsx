import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ResumeData, UserSettings } from '../types';
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
} from 'lucide-react';
import ConfirmationDialog from './ConfirmationDialog';

interface DashboardProps {
  resumes: ResumeData[];
  settings: UserSettings | null;
  onCreateNew: (title: string, templateId: string) => Promise<void>;
  onDuplicate: (resume: ResumeData) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggleArchive: (id: string, state: boolean) => Promise<void>;
  onSelectResume: (id: string) => void;
  onImportResume: (rawText: string) => Promise<void>;
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
  onImportResume,
  setActiveTab,
  showToasts,
}: DashboardProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTemplate, setNewTemplate] = useState('modern');
  const [pastedText, setPastedText] = useState('');
  const [loadingAction, setLoadingAction] = useState(false);
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
  const lastModified = [...resumes].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )[0];

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

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pastedText.trim()) {
      showToasts('Please paste some resume text so the AI can extract sections.', 'info');
      return;
    }
    if (!settings?.groqApiKey) {
      showToasts('Please configure your Groq API Key in Settings to parse via AI.', 'error');
      return;
    }
    setLoadingAction(true);
    try {
      await onImportResume(pastedText.trim());
      setImportOpen(false);
      setPastedText('');
      showToasts('Resume parsed and pre-filled with dynamic sections!', 'success');
    } catch (err: any) {
      showToasts(err?.message || 'AI parsing unsuccessful.', 'error');
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 font-sans">
      {/* Top: Welcome & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white mb-2">
            Dashboard
          </h2>
          <p className="text-sm font-medium text-zinc-400">
            Manage your resumes, analyze against ATS, and prepare for your next role.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center space-x-2 rounded-xl bg-[#171A21] border border-[#2A2E37] hover:bg-[#1f232c] hover:border-zinc-700 px-4 py-2.5 text-sm font-semibold text-zinc-300 shadow-sm transition-all cursor-pointer"
          >
            <Upload className="h-4 w-4" />
            <span>AI Import</span>
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
            <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Recent Update</span>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Award className="h-4 w-4" />
            </div>
          </div>
          <div className="flex flex-col justify-end h-full">
            {lastModified ? (
              <>
                <p className="text-sm font-bold text-white truncate mb-1">
                  {lastModified.title}
                </p>
                <p className="text-xs font-medium text-zinc-500 truncate">
                  {new Date(lastModified.updatedAt).toLocaleDateString()}
                </p>
              </>
            ) : (
              <p className="text-sm font-semibold text-zinc-500">No recent updates</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[#2A2E37] bg-[#171A21] p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Global Sync</span>
            <div className={`p-2 rounded-lg ${settings?.hasCompletedProfile ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
              <Star className="h-4 w-4" />
            </div>
          </div>
          <div className="flex flex-col justify-end h-full">
            <span className={`text-xl font-bold tracking-tight mb-1 ${settings?.hasCompletedProfile ? 'text-emerald-400' : 'text-amber-400'}`}>
              {settings?.hasCompletedProfile ? 'Ready' : 'Incomplete'}
            </span>
            <p className="text-xs text-zinc-500 font-medium">
              {settings?.hasCompletedProfile ? 'Profile auto-inject active' : 'Complete profile to enable'}
            </p>
          </div>
        </div>
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
                      onClick={() => onDuplicate(r)}
                      className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                      title="Duplicate"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onToggleArchive(r.id, true)}
                      className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                      title="Archive"
                    >
                      <Archive className="h-4 w-4" />
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
                      onClick={() => onToggleArchive(r.id, false)}
                      className="px-3 py-1.5 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                    >
                      Restore
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
                    onChange={e => setNewTemplate(e.target.value)}
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
              className="w-full max-w-lg rounded-2xl border border-[#2A2E37] bg-[#171A21] p-6 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-2">
                <Sparkles className="h-5 w-5 text-indigo-400" />
                <span>AI Parsing Extractor</span>
              </h3>
              <p className="text-sm text-zinc-400 mb-6 font-medium leading-relaxed">
                Paste your current resume content, LinkedIn Markdown, or unstructured text. Our AI will automatically extract and categorize your experience, education, skills, and certifications into a new document.
              </p>

              {!settings?.groqApiKey && (
                <div className="mb-6 rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 text-sm text-amber-400 font-medium leading-normal">
                  You must have a Groq API Key set up to parse via AI. Configure this in Settings.
                </div>
              )}

              <form onSubmit={handleImportSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex justify-between">
                    <span>Unstructured Resume Content</span>
                    <span className="text-zinc-500 font-medium">Auto-formats to Modern Template</span>
                  </label>
                  <textarea
                    value={pastedText}
                    onChange={e => setPastedText(e.target.value)}
                    rows={8}
                    placeholder="John Doe&#10;Email: john@example.com&#10;&#10;EXPERIENCE&#10;Software Engineer at Acme Corp (2020 - Present)&#10;- Built reliable React applications..."
                    className="w-full p-4 rounded-xl border border-[#2A2E37] bg-[#0F1115] text-sm text-zinc-300 placeholder:text-zinc-600 focus:border-indigo-500 outline-none font-mono resize-none focus:ring-2 focus:ring-indigo-500/20 transition-all custom-scrollbar flex-1"
                    required
                  />
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-[#2A2E37]">
                  <span className="text-xs text-zinc-500 font-medium">
                    Max 10,000 characters
                  </span>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setImportOpen(false)}
                      className="px-4 py-2 rounded-xl text-sm font-semibold text-zinc-400 hover:text-white hover:bg-[#2A2E37] transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loadingAction || !settings?.groqApiKey}
                      className="flex items-center space-x-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-2 text-sm font-semibold text-white shadow-md transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                    >
                      {loadingAction ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          <span>Extract Data</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmationDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, resumeId: '', resumeTitle: '' })}
        onConfirm={async () => {
          await onDelete(deleteDialog.resumeId);
        }}
        title="Delete Resume Document?"
        message={`Are you sure you want to delete "${deleteDialog.resumeTitle}"? This will permanently delete the selected resume, historical records, and customized layout contents.`}
        confirmText="Delete Document"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
}
