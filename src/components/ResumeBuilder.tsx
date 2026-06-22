import React, { useEffect, useRef, useState } from 'react';
import {
  ResumeData,
  ExperienceEntry,
  EducationEntry,
  ProjectEntry,
  CertificationEntry,
  CustomSection,
  CustomSectionItem,
  UserSettings,
  StandardSectionKey,
  LinkDisplayMode,
} from '../types';
import {
  User,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  Loader2,
  Copy,
  ChevronDown,
  ChevronUp,
  FileText,
  UserCheck,
  Briefcase,
  GraduationCap,
  FolderLock,
  Compass,
  Award,
  Globe,
  PlusCircle,
  Wand2,
  Star,
  Pencil,
} from 'lucide-react';
import ConfirmationDialog from './ConfirmationDialog';
import AiSuggestionReview from './ai/AiSuggestionReview';
import {
  EDUCATION_SCORE_TYPES,
  getEducationScoreFieldLabel,
  getEducationScorePlaceholder,
  getEducationScoreType,
} from '../utils/educationScore';
import {
  applyLanguageSuggestion,
  issuesForSection,
} from '../utils/languageQuality';
import {
  DEFAULT_SECTION_HEADINGS,
  resolveSectionHeading,
} from '../utils/resolveSectionHeading';
import { AiRewriteStyle, AiSuggestion } from '../ai/types';
import { useAiSession } from '../contexts/AiSessionContext';

interface ResumeBuilderProps {
  resume: ResumeData;
  onChange: (updatedResume: ResumeData) => void;
  settings: UserSettings;
  saving: boolean;
  aiEnabled: boolean;
  onOpenAiAssist?: () => void;
  showToasts: (msg: string, type: 'success' | 'error' | 'info') => void;
}

function ResumeBuilder({
  resume,
  onChange,
  settings,
  saving,
  aiEnabled,
  onOpenAiAssist,
  showToasts,
}: ResumeBuilderProps) {
  // Collapsible sections state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    personal: true,
    summary: true,
    experience: false,
    education: false,
    skills: false,
    projects: false,
    certifications: false,
    achievements: false,
    volunteering: false,
    languages: false,
  });

  // AI loading flags
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});
  const [atsSummaryDetails, setAtsSummaryDetails] = useState<{
    original: string;
    optimized: string;
    whatChanged: string[];
  } | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);
  const [summaryRewriteStyle, setSummaryRewriteStyle] = useState<AiRewriteStyle>('professional');
  const [bulletRewriteStyle, setBulletRewriteStyle] = useState<AiRewriteStyle>('stronger_verbs');
  const aiApplyRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);
  const { state: aiState, generate, isGenerating } = useAiSession();
  const isAiConfigured = aiEnabled && (
    (aiState.mode === 'free' && aiState.freeBetaAvailable === true) ||
    (aiState.mode === 'byok' && aiState.isConnected)
  );
  const isAiBusy = isGenerating || Object.values(aiLoading).some(Boolean);
  const connectedProviderLabel = aiState.mode === 'free'
    ? 'Forge Free Beta'
    : aiState.provider === 'openrouter'
    ? 'OpenRouter'
    : aiState.provider
      ? `${aiState.provider.charAt(0).toUpperCase()}${aiState.provider.slice(1)}`
      : '';

  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    type: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    type: 'warning',
    onConfirm: () => {}
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const toggleSection = (sec: string) => {
    setOpenSections(prev => ({ ...prev, [sec]: !prev[sec] }));
  };

  const getSectionHeading = (sectionKey: StandardSectionKey, fallback?: string) =>
    resolveSectionHeading(sectionKey, resume.sectionConfig, fallback || DEFAULT_SECTION_HEADINGS[sectionKey]);

  const getSectionIssues = (sectionKey: string) => issuesForSection(resume, sectionKey);
  const emailInvalid = Boolean(resume.personalDetails.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resume.personalDetails.email);
  const phoneInvalid = Boolean(resume.personalDetails.phone) && !/^[+()\-\s0-9]{7,20}$/.test(resume.personalDetails.phone);
  const isValidUrlLike = (value: string) => !value.trim() || /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/[^\s]*)?$/i.test(value.trim());
  const linkedInInvalid = Boolean(resume.personalDetails.linkedin) && !isValidUrlLike(resume.personalDetails.linkedin);
  const githubInvalid = Boolean(resume.personalDetails.github) && !isValidUrlLike(resume.personalDetails.github);
  const websiteInvalid = Boolean(resume.personalDetails.website) && !isValidUrlLike(resume.personalDetails.website);
  const normalizeExternalUrl = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || /^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  };

  const updateSectionHeadingConfig = (
    sectionKey: StandardSectionKey,
    mode: 'default' | 'custom',
    customTitle?: string
  ) => {
    onChange({
      ...resume,
      sectionConfig: {
        ...resume.sectionConfig,
        [sectionKey]: {
          mode: mode === 'custom' && customTitle?.trim() ? 'custom' : mode,
          customTitle: customTitle ?? resume.sectionConfig[sectionKey]?.customTitle ?? '',
          linkDisplayMode: resume.sectionConfig[sectionKey]?.linkDisplayMode,
        },
      },
    });
  };

  const updateSectionLinkMode = (
    sectionKey: StandardSectionKey,
    linkDisplayMode: LinkDisplayMode
  ) => {
    onChange({
      ...resume,
      sectionConfig: {
        ...resume.sectionConfig,
        [sectionKey]: {
          ...resume.sectionConfig[sectionKey],
          linkDisplayMode,
        },
      },
    });
  };

  const applySuggestion = (issueId: string, suggestionId: string) => {
    onChange(applyLanguageSuggestion(resume, issueId, suggestionId));
    showToasts('Language suggestion applied.', 'success');
  };

  const renderHeadingControls = (sectionKey: StandardSectionKey) => {
    const config = resume.sectionConfig[sectionKey];
    const headingIssues = getSectionIssues(sectionKey).filter(issue => issue.path.startsWith(`sectionConfig.${sectionKey}`));

    return (
      <div className="rounded-xl border border-[#2A2E37] bg-[#0F1115] p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">Section heading</span>
          <span className="rounded-full bg-[#171A21] px-2 py-0.5 text-[10px] font-semibold text-[#72DFCA]">
            Live title: {getSectionHeading(sectionKey)}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => updateSectionHeadingConfig(sectionKey, 'custom', config?.customTitle || getSectionHeading(sectionKey))}
            className={headingButtonCls}
          >
            <Pencil className="h-3 w-3" /> Edit heading
          </button>
          {config?.mode === 'custom' && (
            <button type="button" onClick={() => updateSectionHeadingConfig(sectionKey, 'default', '')} className="inline-flex min-h-8 items-center rounded-lg px-2.5 py-1.5 text-[10px] font-semibold text-zinc-400 transition hover:bg-[#171A21] hover:text-white">
              Return to default
            </button>
          )}
        </div>
        {config?.mode === 'custom' && (
          <input
            type="text"
            value={config?.customTitle || ''}
            onChange={event => updateSectionHeadingConfig(sectionKey, 'custom', event.target.value)}
            placeholder={DEFAULT_SECTION_HEADINGS[sectionKey]}
            className="w-full rounded-lg border border-[#2A2E37] bg-[#171A21] px-3 py-2 text-xs text-white outline-none focus:border-[#72DFCA]"
          />
        )}
        {['projects', 'certifications'].includes(sectionKey) && (
          <div className="space-y-2 rounded-lg border border-[#2A2E37] bg-[#171A21] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">Section link style</span>
              <span className="text-[10px] text-zinc-400">
                {resume.sectionConfig[sectionKey]?.linkDisplayMode || 'inherit'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {([
                ['inherit', 'Inherit'],
                ['embedded', 'Embedded'],
                ['raw', 'Raw'],
              ] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => updateSectionLinkMode(sectionKey, mode)}
                  className={`rounded-md px-2 py-2 text-[10px] font-semibold transition ${
                    (resume.sectionConfig[sectionKey]?.linkDisplayMode || 'inherit') === mode
                      ? 'bg-[#72DFCA] text-[#08110F]'
                      : 'text-zinc-300 hover:bg-[#0F1115]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        {headingIssues.length > 0 && (
          <div className="space-y-2 rounded-lg border border-amber-400/20 bg-amber-950/20 p-3">
            {headingIssues.map(issue => (
              <div key={issue.id} className="space-y-2 text-[11px] text-amber-100">
                <div className="flex items-start justify-between gap-3">
                  <span>{issue.message}</span>
                  <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-300">
                    {issue.category}
                  </span>
                </div>
                {issue.suggestions.slice(0, 1).map(suggestion => (
                  <button
                    key={suggestion.id}
                    type="button"
                    onClick={() => applySuggestion(issue.id, suggestion.id)}
                    className="rounded-md border border-amber-300/30 bg-amber-50/10 px-2 py-1 text-[10px] font-semibold text-amber-100 transition hover:bg-amber-50/20"
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const headingButtonCls = 'inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[#2A2E37] bg-[#171A21] px-2.5 py-1.5 text-[10px] font-semibold text-zinc-200 transition hover:border-[#4B5D72] hover:bg-[#1A212A]';

  // Language analysis is paused until it is backed by a validated provider result.
  const renderSectionQualityPanel = (_sectionKey: string) => null;

  const updatePersonal = (field: string, val: string) => {
    // Basic validation check
    if (field === 'fullName' && !val.trim()) {
      // We don't toast on every keystroke, but we should handle it in UI
    }

    const updated = {
      ...resume,
      personalDetails: {
        ...resume.personalDetails,
        [field]: val,
      },
    };
    onChange(updated);
  };

  const updateSummary = (val: string) => {
    onChange({ ...resume, summary: val });
  };

  const openAiSuggestion = (suggestion: AiSuggestion, onApply: () => void) => {
    aiApplyRef.current = onApply;
    setAiSuggestion(suggestion);
  };

  const closeAiSuggestion = () => {
    aiApplyRef.current = null;
    setAiSuggestion(null);
  };

  const handleApplyAiSuggestion = () => {
    aiApplyRef.current?.();
    closeAiSuggestion();
    showToasts('AI suggestion applied.', 'success');
  };

  const runAiRewrite = async ({
    loadingKey,
    task,
    input,
    tone,
    rewriteStyle,
    targetLabel,
    getCurrentText,
    onApply,
  }: {
    loadingKey: string;
    task: 'improve_summary' | 'rewrite_bullet' | 'suggest_wording' | 'grammar_fix';
    input: string;
    tone: 'professional' | 'simple' | 'student' | 'impactful';
    rewriteStyle?: AiRewriteStyle;
    targetLabel: string;
    getCurrentText: () => string;
    onApply: (value: string) => void;
  }) => {
    const originalText = input.trim();
    if (!originalText) {
      showToasts('Add some text before using AI writing help.', 'info');
      return;
    }

    setAiLoading(current => ({ ...current, [loadingKey]: true }));
    try {
      const result = await generate({
        task,
        input: originalText,
        tone,
        rewriteStyle,
        maxOutputTokens: 1200,
      });
      if (!mountedRef.current) return;
      if (getCurrentText().trim() !== originalText) {
        showToasts('This field changed while AI was responding. Run the action again on the latest text.', 'info');
        return;
      }
      openAiSuggestion({
        id: `${loadingKey}_${Date.now()}`,
        task,
        originalText,
        suggestedText: result.text.trim(),
        targetLabel,
      }, () => onApply(result.text.trim()));
    } catch (error) {
      showToasts(error instanceof Error ? error.message : 'AI request failed. Check your key, provider, or model and try again.', 'error');
    } finally {
      if (mountedRef.current) {
        setAiLoading(current => ({ ...current, [loadingKey]: false }));
      }
    }
  };

  // Section Order Shifts
  const moveSection = (index: number, direction: 'up' | 'down') => {
    const order = [...resume.sectionOrder];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= order.length) return;

    const temp = order[index];
    order[index] = order[targetIndex];
    order[targetIndex] = temp;

    onChange({ ...resume, sectionOrder: order, sectionOrderMode: 'custom' });
    showToasts('Section sequence updated.', 'info');
  };

  // Hide or Show Sections
  const toggleSectionVisibility = (secId: string) => {
    const hidden = [...resume.hiddenSections];
    const index = hidden.indexOf(secId);
    if (index >= 0) {
      hidden.splice(index, 1);
      showToasts(`Section "${secId}" is now visible.`, 'info');
    } else {
      hidden.push(secId);
      showToasts(`Section "${secId}" is now hidden.`, 'info');
    }
    onChange({ ...resume, hiddenSections: hidden });
  };

  // Multiple Entry handlers (Experience)
  const addExperience = () => {
    const newEntry: ExperienceEntry = {
      id: 'exp_' + Math.random().toString(36).substring(2, 9),
      title: '',
      company: '',
      location: '',
      startDate: '',
      endDate: '',
      description: '',
    };
    onChange({
      ...resume,
      experience: [...resume.experience, newEntry],
    });
    // Open section
    setOpenSections(prev => ({ ...prev, experience: true }));
  };

  const updateExperience = (id: string, field: keyof ExperienceEntry, val: string) => {
    const updated = resume.experience.map(e => {
      if (e.id === id) {
        return { ...e, [field]: val };
      }
      return e;
    });
    onChange({ ...resume, experience: updated });
  };

  const deleteExperience = (id: string) => {
    setConfirmConfig({
      isOpen: true,
      title: "Delete Experience Entry?",
      message: "Are you sure you want to delete this professional experience entry? This cannot be undone.",
      confirmText: "Delete Entry",
      type: "danger",
      onConfirm: () => {
        onChange({
          ...resume,
          experience: resume.experience.filter(e => e.id !== id),
        });
        showToasts("Experience entry deleted.", "success");
      }
    });
  };

  // Multiple Entry handlers (Internship)
  const addInternship = () => {
    const newEntry = {
      id: 'intern_' + Math.random().toString(36).substring(2, 9),
      role: '',
      company: '',
      location: '',
      startDate: '',
      endDate: '',
      description: '',
      technologiesUsed: '',
    };
    onChange({
      ...resume,
      internships: [...(resume.internships || []), newEntry],
    });
    setOpenSections(prev => ({ ...prev, internships: true }));
  };

  const updateInternship = (id: string, field: string, val: string) => {
    const updated = (resume.internships || []).map(i => {
      if (i.id === id) {
        return { ...i, [field]: val };
      }
      return i;
    });
    onChange({ ...resume, internships: updated });
  };

  const deleteInternship = (id: string) => {
    setConfirmConfig({
      isOpen: true,
      title: "Delete Internship Entry?",
      message: "Are you sure you want to delete this internship entry? This action is permanent and cannot be undone.",
      confirmText: "Delete Internship",
      type: "danger",
      onConfirm: () => {
        onChange({
          ...resume,
          internships: (resume.internships || []).filter(i => i.id !== id),
        });
        showToasts("Internship entry deleted.", "success");
      }
    });
  };

  const moveInternship = (index: number, direction: 'up' | 'down') => {
    const arr = [...(resume.internships || [])];
    if (direction === 'up' && index > 0) {
      const temp = arr[index];
      arr[index] = arr[index - 1];
      arr[index - 1] = temp;
    } else if (direction === 'down' && index < arr.length - 1) {
      const temp = arr[index];
      arr[index] = arr[index + 1];
      arr[index + 1] = temp;
    }
    onChange({ ...resume, internships: arr });
  };

  const triggerAiInternship = async (id: string, rewriteStyle: AiRewriteStyle = bulletRewriteStyle) => {
    if (!isAiConfigured) {
      showToasts('Choose Forge Free Beta AI or connect BYOK to use writing help.', 'info');
      return;
    }
    const entry = (resume.internships || []).find(item => item.id === id);
    if (!entry) return;
    await runAiRewrite({
      loadingKey: `intern_${id}_rewrite`,
      task: rewriteStyle === 'grammar_fix' ? 'grammar_fix' : 'rewrite_bullet',
      input: entry.description,
      tone: 'student',
      rewriteStyle,
      targetLabel: `${getSectionHeading('internships')} bullet`,
      getCurrentText: () => (resume.internships || []).find(item => item.id === id)?.description || '',
      onApply: value => updateInternship(id, 'description', value),
    });
  };

  const duplicateExperience = (entry: ExperienceEntry) => {
    const duplicated: ExperienceEntry = {
      ...entry,
      id: 'exp_' + Math.random().toString(36).substring(2, 9),
      title: `${entry.title} (Copy)`,
    };
    onChange({
      ...resume,
      experience: [...resume.experience, duplicated],
    });
    showToasts('Experience card duplicated.', 'success');
  };

  // Education Helpers
  const addEducation = () => {
    const newEntry: EducationEntry = {
      id: 'edu_' + Math.random().toString(36).substring(2, 9),
      degree: '',
      institution: '',
      location: '',
      startDate: '',
      endDate: '',
      gpa: '',
      scoreType: undefined,
      description: '',
    };
    onChange({
      ...resume,
      education: [...resume.education, newEntry],
    });
    setOpenSections(prev => ({ ...prev, education: true }));
  };

  const updateEducation = (id: string, field: keyof EducationEntry, val: string) => {
    const updated = resume.education.map(e => {
      if (e.id === id) {
        return { ...e, [field]: val };
      }
      return e;
    });
    onChange({ ...resume, education: updated });
  };

  const deleteEducation = (id: string) => {
    onChange({
      ...resume,
      education: resume.education.filter(e => e.id !== id),
    });
  };

  // Projects Helpers
  const addProject = () => {
    const newEntry: ProjectEntry = {
      id: 'proj_' + Math.random().toString(36).substring(2, 9),
      name: '',
      description: '',
      technologies: '',
      startDate: '',
      endDate: '',
      github: '',
      live: '',
    };
    onChange({
      ...resume,
      projects: [...resume.projects, newEntry],
    });
    setOpenSections(prev => ({ ...prev, projects: true }));
  };

  const updateProject = (id: string, field: keyof ProjectEntry, val: string) => {
    const updated = resume.projects.map(p => {
      if (p.id === id) {
        return { ...p, [field]: val };
      }
      return p;
    });
    onChange({ ...resume, projects: updated });
  };

  const deleteProject = (id: string) => {
    onChange({
      ...resume,
      projects: resume.projects.filter(p => p.id !== id),
    });
  };

  // Skills input helper (comma & layout split)
  const updateSkillsTags = (category: keyof ResumeData['skills'], val: string) => {
    const list = val.split(',').map(s => s.trim()).filter(Boolean);
    onChange({
      ...resume,
      skills: {
        ...resume.skills,
        [category]: list,
      },
    });
  };

  // Certifications Helpers
  const addCertification = () => {
    const newEntry: CertificationEntry = {
      id: 'cert_' + Math.random().toString(36).substring(2, 9),
      name: '',
      issuer: '',
      date: '',
      url: '',
    };
    onChange({
      ...resume,
      certifications: [...resume.certifications, newEntry],
    });
    setOpenSections(prev => ({ ...prev, certifications: true }));
  };

  const updateCertification = (id: string, field: keyof CertificationEntry, val: string) => {
    const updated = resume.certifications.map(c => {
      if (c.id === id) {
        return { ...c, [field]: val };
      }
      return c;
    });
    onChange({ ...resume, certifications: updated });
  };

  const deleteCertification = (id: string) => {
    onChange({
      ...resume,
      certifications: resume.certifications.filter(c => c.id !== id),
    });
  };

  // Custom sections helper
  const addCustomSection = () => {
    const secId = 'custom_' + Math.random().toString(36).substring(2, 9);
    const newSection: CustomSection = {
      id: secId,
      title: 'Additional Section',
      items: [
        {
          id: 'item_' + Math.random().toString(36).substring(2, 9),
          title: 'Section Entry Title',
          description: '',
        },
      ],
    };

    onChange({
      ...resume,
      customSections: [...resume.customSections, newSection],
      sectionOrder: [...resume.sectionOrder, secId],
    });
    showToasts('New custom section established.', 'success');
  };

  const updateCustomSectionTitle = (id: string, title: string) => {
    const updated = resume.customSections.map(s => {
      if (s.id === id) {
        return { ...s, title };
      }
      return s;
    });
    onChange({ ...resume, customSections: updated });
  };

  const addCustomSectionItem = (secId: string) => {
    const newItem: CustomSectionItem = {
      id: 'item_' + Math.random().toString(36).substring(2, 9),
      title: '',
      description: '',
    };
    const updated = resume.customSections.map(s => {
      if (s.id === secId) {
        return { ...s, items: [...s.items, newItem] };
      }
      return s;
    });
    onChange({ ...resume, customSections: updated });
  };

  const updateCustomSectionItem = (secId: string, itemId: string, field: keyof CustomSectionItem, val: string) => {
    const updated = resume.customSections.map(s => {
      if (s.id === secId) {
        const items = s.items.map(item => {
          if (item.id === itemId) {
            return { ...item, [field]: val };
          }
          return item;
        });
        return { ...s, items };
      }
      return s;
    });
    onChange({ ...resume, customSections: updated });
  };

  const deleteCustomSectionItem = (secId: string, itemId: string) => {
    setConfirmConfig({
      isOpen: true,
      title: "Delete Custom Section Entry?",
      message: "Are you sure you want to delete this custom section entry? This action is permanent and cannot be undone.",
      confirmText: "Delete Entry",
      type: "danger",
      onConfirm: () => {
        const updated = resume.customSections.map(s => {
          if (s.id === secId) {
            return { ...s, items: s.items.filter(item => item.id !== itemId) };
          }
          return s;
        });
        onChange({ ...resume, customSections: updated });
        showToasts("Custom section entry deleted.", "success");
      }
    });
  };

  const deleteCustomSection = (secId: string) => {
    const targetSec = resume.customSections.find(s => s.id === secId);
    const secName = targetSec?.title || 'Custom Section';
    setConfirmConfig({
      isOpen: true,
      title: `Delete entire "${secName}"?`,
      message: "Are you sure you want to permanently delete this entire custom section along with all its entries? This will delete the section, remove it from Firestore, and purge local cache saved drafts instantly.",
      confirmText: "Delete Entire Section",
      type: "danger",
      onConfirm: () => {
        const updatedSections = resume.customSections.filter(s => s.id !== secId);
        const updatedOrder = resume.sectionOrder.filter(id => id !== secId);
        onChange({
          ...resume,
          customSections: updatedSections,
          sectionOrder: updatedOrder
        });
        showToasts('Custom section deleted successfully.', 'success');
      }
    });
  };

  // AI Actions Triggering
  const triggerAiSummary = async (rewriteStyle: AiRewriteStyle = summaryRewriteStyle) => {
    if (!isAiConfigured) {
      showToasts('Choose Forge Free Beta AI or connect BYOK to use writing help.', 'info');
      return;
    }
    await runAiRewrite({
      loadingKey: 'summary_rewrite',
      task: 'improve_summary',
      input: resume.summary,
      tone: 'professional',
      rewriteStyle,
      targetLabel: getSectionHeading('summary'),
      getCurrentText: () => resume.summary,
      onApply: updateSummary,
    });
  };

  const triggerAiExperience = async (id: string, rewriteStyle: AiRewriteStyle = bulletRewriteStyle) => {
    if (!isAiConfigured) {
      showToasts('Choose Forge Free Beta AI or connect BYOK to use writing help.', 'info');
      return;
    }
    const entry = resume.experience.find(item => item.id === id);
    if (!entry) return;
    await runAiRewrite({
      loadingKey: `exp_${id}_rewrite`,
      task: rewriteStyle === 'grammar_fix' ? 'grammar_fix' : 'rewrite_bullet',
      input: entry.description,
      tone: 'impactful',
      rewriteStyle,
      targetLabel: `${getSectionHeading('experience')} bullet`,
      getCurrentText: () => resume.experience.find(item => item.id === id)?.description || '',
      onApply: value => updateExperience(id, 'description', value),
    });
  };

  const triggerAiProject = async (id: string, rewriteStyle: AiRewriteStyle = bulletRewriteStyle) => {
    if (!isAiConfigured) {
      showToasts('Choose Forge Free Beta AI or connect BYOK to use writing help.', 'info');
      return;
    }
    const entry = resume.projects.find(item => item.id === id);
    if (!entry) return;
    await runAiRewrite({
      loadingKey: `proj_${id}_rewrite`,
      task: rewriteStyle === 'grammar_fix' ? 'grammar_fix' : 'suggest_wording',
      input: entry.description,
      tone: 'impactful',
      rewriteStyle,
      targetLabel: `${getSectionHeading('projects')} description`,
      getCurrentText: () => resume.projects.find(item => item.id === id)?.description || '',
      onApply: value => updateProject(id, 'description', value),
    });
  };

  return (
    <div className="forge-editor-panel space-y-6" id="resume-builder-form-panel" data-tour="builder-editor">
      {/* Auto save banner info */}
      <div className="flex items-center justify-between bg-[#0F1115] border border-[#2A2E37] p-3.5 rounded-xl">
        <div>
          <h4 className="text-xs font-bold text-white">Autosave</h4>
          <span className="text-[10px] text-zinc-400">Changes are saved as you work</span>
        </div>
        <div className="flex items-center gap-1.5">
          {saving ? (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-indigo-500 animate-pulse">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Saving Changes...</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-500">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Auto-saved</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-[#2A2E37] bg-[#171A21] p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h4 className="flex items-center gap-2 text-xs font-semibold text-white">
            <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
            Forge Free Beta AI
          </h4>
          <p className="mt-1 text-[11px] text-zinc-400">
            Use AI to improve summaries, rewrite bullets, fix grammar, and import resumes. Every suggestion is reviewed before applying.
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-zinc-500">
            <span>25 writing actions per 12 hours</span>
            <span>3 resume imports per 12 hours</span>
            <span>Using your own key does not use Forge Free AI quota</span>
          </div>
          <p className="mt-2 text-[11px] text-zinc-400">
            {!aiEnabled
              ? 'Sign in to use Free AI'
              : isAiConfigured
                ? aiState.mode === 'free' && aiState.freeActionsRemaining !== null
                  ? `${aiState.freeActionsRemaining} actions left${typeof aiState.freeImportsRemaining === 'number' ? ` · ${aiState.freeImportsRemaining} imports left` : ''}${aiState.freeResetAt ? ` · resets at ${new Date(aiState.freeResetAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}`
                  : `BYOK connected · ${connectedProviderLabel}`
                : aiState.freeStatusLoading
                  ? 'Checking Free AI…'
                  : aiState.freeStatusReason === 'quota_store_missing'
                    ? 'Free AI quota store not configured'
                    : aiState.freeStatusReason === 'missing_provider_keys'
                      ? 'Free AI provider keys missing'
                      : 'Free AI paused'}
          </p>
        </div>
        {aiEnabled && !isAiConfigured && onOpenAiAssist && (
          <button type="button" onClick={onOpenAiAssist} className="inline-flex min-h-8 shrink-0 items-center justify-center rounded-lg border border-[#344354] px-3 text-[11px] font-semibold text-zinc-200 transition hover:border-emerald-500/40 hover:text-white">
            Open AI Assist
          </button>
        )}
      </div>

      {/* RENDER SECTIONS DYNAMICALLY ACCORDING TO REORDER SEQUENCE */}

      {/* PERSONAL INFO (Always visible at starting point) */}
      <div className="rounded-2xl border border-[#2A2E37] bg-[#171A21] shadow-xs overflow-hidden">
        <button
          onClick={() => toggleSection('personal')}
          className="flex w-full items-center justify-between p-4 bg-[#0F1115] text-left outline-none cursor-pointer"
        >
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <User className="h-4.5 w-4.5 text-indigo-500" />
            <h3 className="text-sm font-bold text-white">Personal Contact Details</h3>
          </div>
          {openSections.personal ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
        </button>

        {openSections.personal && (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-[#2A2E37]">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1 flex items-center gap-1">
                <span>Full Name</span>
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={resume.personalDetails.fullName}
                onChange={e => updatePersonal('fullName', e.target.value)}
                placeholder="e.g., Jane Smith"
                className={`w-full px-3 py-2 rounded-lg border bg-[#0F1115] text-xs focus:border-indigo-500 focus:bg-[#171A21] text-white transition outline-none ${
                  !resume.personalDetails.fullName ? 'border-rose-200 border-rose-900/50' : 'border-[#2A2E37]'
                }`}
                id="personal-fullName"
              />
              {!resume.personalDetails.fullName && (
                <p className="text-[9px] text-rose-500 font-bold mt-1 tracking-wide">Required for resume identification</p>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1 flex items-center gap-1">
                <span>Email Address</span>
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                value={resume.personalDetails.email}
                onChange={e => updatePersonal('email', e.target.value)}
                placeholder="jane.smith@email.com"
                className={`w-full px-3 py-2 rounded-lg border bg-[#0F1115] text-xs focus:border-indigo-500 focus:bg-[#171A21] text-white transition outline-none ${
                  !resume.personalDetails.email ? 'border-rose-200 border-rose-900/50' : emailInvalid ? 'border-amber-400/60' : 'border-[#2A2E37]'
                }`}
                id="personal-email"
              />
              {!resume.personalDetails.email && (
                <p className="text-[9px] text-rose-500 font-bold mt-1 tracking-wide">Required for contact</p>
              )}
              {resume.personalDetails.email && emailInvalid && (
                <p className="text-[10px] text-amber-300 mt-1">Enter a valid email address.</p>
              )}
            </div>
            <div>
              <label className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400"><Pencil className="h-2.5 w-2.5" /> Professional Title</label>
              <input
                type="text"
                value={resume.personalDetails.professionalTitle}
                onChange={e => updatePersonal('professionalTitle', e.target.value)}
                placeholder="e.g., Lead Solutions Architect"
                className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-xs focus:border-indigo-500 focus:bg-[#171A21] text-white transition outline-none"
                id="personal-title"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Phone Number</label>
              <input
                type="tel"
                inputMode="tel"
                value={resume.personalDetails.phone}
                onChange={e => updatePersonal('phone', e.target.value)}
                placeholder="+1 (555) 0192-283"
                className={`w-full px-3 py-2 rounded-lg border bg-[#0F1115] text-xs focus:border-indigo-500 focus:bg-[#171A21] text-white transition outline-none ${phoneInvalid ? 'border-amber-400/60' : 'border-[#2A2E37]'}`}
                id="personal-phone"
              />
              {phoneInvalid && <p className="mt-1 text-[10px] text-amber-300">Use a valid phone number format.</p>}
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Location</label>
              <input
                type="text"
                value={resume.personalDetails.location}
                onChange={e => updatePersonal('location', e.target.value)}
                placeholder="SF Bay Area, CA"
                className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-xs focus:border-indigo-500 focus:bg-[#171A21] text-white transition outline-none"
                id="personal-location"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">LinkedIn Profile</label>
              <input
                type="url"
                inputMode="url"
                value={resume.personalDetails.linkedin}
                onChange={e => updatePersonal('linkedin', e.target.value)}
                onBlur={e => updatePersonal('linkedin', normalizeExternalUrl(e.target.value))}
                placeholder="linkedin.com/in/janesmith"
                className={`w-full px-3 py-2 rounded-lg border bg-[#0F1115] text-xs focus:border-indigo-500 focus:bg-[#171A21] text-white transition outline-none ${linkedInInvalid ? 'border-amber-400/60' : 'border-[#2A2E37]'}`}
                id="personal-linkedin"
              />
              {linkedInInvalid && <p className="mt-1 text-[10px] text-amber-300">Enter a valid URL or domain.</p>}
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">GitHub Link</label>
              <input
                type="url"
                inputMode="url"
                value={resume.personalDetails.github}
                onChange={e => updatePersonal('github', e.target.value)}
                onBlur={e => updatePersonal('github', normalizeExternalUrl(e.target.value))}
                placeholder="github.com/janesmith"
                className={`w-full px-3 py-2 rounded-lg border bg-[#0F1115] text-xs focus:border-indigo-500 focus:bg-[#171A21] text-white transition outline-none ${githubInvalid ? 'border-amber-400/60' : 'border-[#2A2E37]'}`}
                id="personal-github"
              />
              {githubInvalid && <p className="mt-1 text-[10px] text-amber-300">Enter a valid URL or domain.</p>}
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Portfolio or Website</label>
              <input
                type="url"
                inputMode="url"
                value={resume.personalDetails.website}
                onChange={e => updatePersonal('website', e.target.value)}
                onBlur={e => updatePersonal('website', normalizeExternalUrl(e.target.value))}
                placeholder="janesmith.dev"
                className={`w-full px-3 py-2 rounded-lg border bg-[#0F1115] text-xs focus:border-indigo-500 focus:bg-[#171A21] text-white transition outline-none ${websiteInvalid ? 'border-amber-400/60' : 'border-[#2A2E37]'}`}
                id="personal-website"
              />
              {websiteInvalid && <p className="mt-1 text-[10px] text-amber-300">Enter a valid URL or domain.</p>}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Link Display Mode</label>
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] p-1">
                {([
                  ['embedded', 'Embedded'],
                  ['raw', 'Raw URL'],
                ] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => onChange({
                      ...resume,
                      linkDisplayMode: mode,
                      linkSettings: { defaultDisplayMode: mode },
                    })}
                    className={`rounded-md px-3 py-2 text-[11px] font-semibold transition ${
                      resume.linkDisplayMode === mode
                        ? 'bg-[#72DFCA] text-[#08110F]'
                        : 'text-zinc-300 hover:bg-[#171A21]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[10px] text-zinc-500">
                Embedded renders labeled clickable links. Raw URL prints the full address exactly as stored.
              </p>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Profile Photo (Base64 / Data URL)</label>
              <input
                type="text"
                value={resume.personalDetails.profilePhoto || ''}
                onChange={e => updatePersonal('profilePhoto', e.target.value)}
                placeholder="data:image/png;base64,... or enter public URL"
                className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-xs focus:border-indigo-500 focus:bg-[#171A21] text-white transition outline-none font-mono"
                id="personal-profilePhoto"
              />
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-[#2A2E37] bg-[#171A21] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Section Ordering</h3>
            <p className="mt-1 text-[11px] leading-4 text-zinc-400">
              Template order follows the selected design. Custom order follows the section arrows below.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-[#2A2E37] bg-[#0F1115] p-1">
            {([
              ['template', 'Template Default'],
              ['custom', 'Custom Order'],
            ] as const).map(([mode, label]) => {
              const activeMode = resume.sectionOrderMode || 'custom';
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onChange({ ...resume, sectionOrderMode: mode })}
                  aria-pressed={activeMode === mode}
                  className={`min-h-9 rounded-md px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition ${
                    activeMode === mode
                      ? 'bg-[#72DFCA] text-[#08110F]'
                      : 'text-zinc-300 hover:bg-[#1B2028] hover:text-white'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        {(resume.sectionOrderMode || 'custom') === 'template' && (
          <p className="mt-3 rounded-lg border border-[#31413F] bg-[#10201E] px-3 py-2 text-[11px] text-[#A7E9DC]">
            Move any section to switch automatically to Custom Order.
          </p>
        )}
      </div>

      {/* RENDER ORDERED SECTIONS */}
      {resume.sectionOrder.map((sectionId, idx) => {
        const isHidden = resume.hiddenSections.includes(sectionId);
        const isOpen = openSections[sectionId] || false;

        // Render matching UI section
        if (sectionId === 'summary') {
          return (
            <div key={sectionId} className={`rounded-2xl border ${isHidden ? 'opacity-50 border-dashed border-[#2A2E37]' : 'border-[#2A2E37]'} bg-[#171A21] overflow-hidden`}>
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#0F1115]">
                <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                  <UserCheck className="h-4.5 w-4.5 text-indigo-500" />
                  <h3 className="text-sm font-bold text-white">{getSectionHeading('summary')}</h3>
                  {isHidden && <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">Hidden</span>}
                </div>
                {/* Control Tools */}
                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                  <button type="button" onClick={() => moveSection(idx, 'up')} aria-label={`Move ${sectionId} section up`} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => moveSection(idx, 'down')} aria-label={`Move ${sectionId} section down`} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer"><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => toggleSectionVisibility(sectionId)} aria-label={`${isHidden ? 'Show' : 'Hide'} ${sectionId} section`} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer">
                    {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button type="button" onClick={() => toggleSection(sectionId)} aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${sectionId} section`} aria-expanded={isOpen} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer"><ChevronDown className="h-4 w-4" /></button>
                </div>
              </div>

              {isOpen && (
                <div className="p-4 border-t border-[#2A2E37] space-y-3">
                  {renderHeadingControls('summary')}
                  {renderSectionQualityPanel('summary')}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Executive Summary Text</label>
                    <textarea
                      value={resume.summary}
                      onChange={e => updateSummary(e.target.value)}
                      rows={5}
                      placeholder="Results-focused Software Architect with over 8 years of engineering accomplishments..."
                      className="w-full px-3 py-2.5 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-xs focus:border-indigo-500 focus:bg-[#171A21] text-white transition outline-none font-sans"
                    />
                  </div>

                  {/* AI Assist Beta */}
                  {isAiConfigured && <div className="flex flex-wrap items-center gap-1.5 bg-indigo-500/10 bg-indigo-950/25 border border-indigo-500/20 border-indigo-900/40 p-2 rounded-xl">
                    <span className="text-[9px] uppercase tracking-wider font-bold text-indigo-500 flex items-center gap-1 pl-1">
                      <Sparkles className="h-3 w-3 fill-current" />
                      <span>AI Assist:</span>
                    </span>
                    <select
                      value={summaryRewriteStyle}
                      onChange={event => setSummaryRewriteStyle(event.target.value as AiRewriteStyle)}
                      disabled={isAiBusy}
                      aria-label="Summary rewrite style"
                      className="min-h-7 max-w-full rounded border border-indigo-500/20 bg-[#171A21] px-2 text-[10px] font-semibold text-zinc-200 outline-none"
                    >
                      <option value="professional">Professional</option>
                      <option value="ats_friendly">ATS-friendly wording</option>
                      <option value="shorter">Shorter</option>
                      <option value="longer">Longer</option>
                      <option value="student_friendly">Student-friendly</option>
                      <option value="impactful">Impactful</option>
                    </select>
                    <button
                      onClick={() => triggerAiSummary()}
                      disabled={isAiBusy}
                      className="px-2 py-1 rounded bg-[#171A21] hover:bg-[#1f232c] border border-indigo-500/20 border-indigo-900 bg-indigo-950 text-[10px] font-semibold text-indigo-400 text-indigo-300 transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      {aiLoading.summary_rewrite ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Wand2 className="h-2.5 w-2.5" />}
                      <span>Improve Summary</span>
                    </button>
                  </div>}
                </div>
              )}
            </div>
          );
        }

        if (sectionId === 'experience') {
          return (
            <div key={sectionId} className={`rounded-2xl border ${isHidden ? 'opacity-50 border-dashed border-[#2A2E37]' : 'border-[#2A2E37]'} bg-[#171A21] overflow-hidden`}>
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#0F1115]">
                <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                  <Briefcase className="h-4.5 w-4.5 text-indigo-500" />
                  <h3 className="text-sm font-bold text-white">{getSectionHeading('experience')}</h3>
                  <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold text-zinc-500">{resume.experience.length}</span>
                </div>
                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                  <button type="button" onClick={() => moveSection(idx, 'up')} aria-label={`Move ${sectionId} section up`} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => moveSection(idx, 'down')} aria-label={`Move ${sectionId} section down`} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer"><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => toggleSectionVisibility(sectionId)} aria-label={`${isHidden ? 'Show' : 'Hide'} ${sectionId} section`} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer">
                    {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button type="button" onClick={() => toggleSection(sectionId)} aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${sectionId} section`} aria-expanded={isOpen} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer"><ChevronDown className="h-4 w-4" /></button>
                </div>
              </div>

              {isOpen && (
                <div className="p-4 border-t border-[#2A2E37] space-y-4">
                  {renderHeadingControls('experience')}
                  {renderSectionQualityPanel('experience')}
                  {resume.experience.map((e, eIdx) => (
                    <div key={e.id} className="p-4 rounded-xl border border-[#2A2E37] bg-[#0F1115] space-y-3 relative group/card">
                      <div className="absolute right-3 top-3 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover/card:opacity-100 transition">
                        <button
                          type="button"
                          onClick={() => duplicateExperience(e)}
                          className="rounded p-1 text-zinc-400 transition hover:bg-[#171A21] hover:bg-gray-950 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                          title="Duplicate Job Entry"
                          aria-label={`Duplicate experience entry ${eIdx + 1}`}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteExperience(e.id)}
                          className="rounded p-1 text-zinc-400 transition hover:bg-rose-50 hover:bg-rose-950/20 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                          title="Remove Job Entry"
                          aria-label={`Remove experience entry ${eIdx + 1}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <span className="text-[10px] font-bold text-indigo-500">EXPERIENCE CARD {eIdx + 1}</span>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 mb-1">Job Title</label>
                          <input
                            type="text"
                            value={e.title}
                            onChange={val => updateExperience(e.id, 'title', val.target.value)}
                            placeholder="e.g., Software Dev"
                            className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] border-gray-800 bg-[#0F1115] text-xs focus:bg-[#0F1115] text-white transition outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 mb-1">Company / Organization</label>
                          <input
                            type="text"
                            value={e.company}
                            onChange={val => updateExperience(e.id, 'company', val.target.value)}
                            placeholder="e.g., Acme Corp"
                            className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-xs focus:bg-[#0F1115] text-white transition outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 mb-1">Dates (Start Date / End Date)</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={e.startDate}
                              onChange={val => updateExperience(e.id, 'startDate', val.target.value)}
                              placeholder="Oct 2024"
                              className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-white text-xs outline-none"
                            />
                            <input
                              type="text"
                              value={e.endDate}
                              onChange={val => updateExperience(e.id, 'endDate', val.target.value)}
                              placeholder="Present"
                              className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-white text-xs outline-none"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 mb-1">Location</label>
                          <input
                            type="text"
                            value={e.location}
                            onChange={val => updateExperience(e.id, 'location', val.target.value)}
                            placeholder="Boston, MA"
                            className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-xs focus:bg-[#0F1115] text-white transition outline-none"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-[10px] font-bold text-zinc-400">Job Responsibilities & Accomplishments</label>
                            {isAiConfigured && <div className="flex flex-wrap items-center justify-end gap-1.5">
                              <select value={bulletRewriteStyle} onChange={event => setBulletRewriteStyle(event.target.value as AiRewriteStyle)} disabled={isAiBusy} aria-label="Experience rewrite style" className="min-h-7 rounded-lg border border-[#2A2E37] bg-[#0F1115] px-2 text-[10px] font-semibold text-zinc-300 outline-none">
                                <option value="star_format">STAR format</option>
                                <option value="stronger_verbs">Stronger action verbs</option>
                                <option value="shorter">Shorter</option>
                                <option value="professional">More professional</option>
                                <option value="grammar_fix">Grammar fix</option>
                                <option value="explain_impact">Explain impact clearly</option>
                              </select>
                              <button type="button" onClick={() => triggerAiExperience(e.id)} disabled={isAiBusy} className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50">
                                {aiLoading[`exp_${e.id}_rewrite`] ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                <span>Rewrite</span>
                              </button>
                            </div>}
                          </div>
                          <textarea
                            value={e.description}
                            onChange={val => updateExperience(e.id, 'description', val.target.value)}
                            rows={4}
                            placeholder="- Built and optimized web performance by 24% using Vite and Preact.&#10;- Handled database shards on cloud PostgreSQL clusters."
                            className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-xs focus:bg-[#0F1115] text-white transition outline-none font-mono"
                          />
                        </div>
                      </div>

                    </div>
                  ))}

                  <button
                    onClick={addExperience}
                    className="w-full py-2 border border-dashed border-[#2A2E37] hover:border-indigo-500 border-gray-800 rounded-xl text-xs font-bold text-zinc-500 hover:text-indigo-500 transition flex items-center justify-center gap-1.5 cursor-pointer bg-[#0F1115]/20 bg-gray-950/20"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add experience record</span>
                  </button>
                </div>
              )}
            </div>
          );
        }

        if (sectionId === 'internships') {
          const list = resume.internships || [];
          return (
            <div key={sectionId} className={`rounded-2xl border ${isHidden ? 'opacity-50 border-dashed border-[#2A2E37]' : 'border-[#2A2E37]'} bg-[#171A21] overflow-hidden`}>
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#0F1115]">
                <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                  <Star className="h-4.5 w-4.5 text-indigo-400" />
                  <h3 className="text-sm font-bold text-white">{getSectionHeading('internships')}</h3>
                  <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold text-zinc-500">{list.length}</span>
                </div>
                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                  <button type="button" onClick={() => moveSection(idx, 'up')} aria-label={`Move ${sectionId} section up`} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => moveSection(idx, 'down')} aria-label={`Move ${sectionId} section down`} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer"><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => toggleSectionVisibility(sectionId)} aria-label={`${isHidden ? 'Show' : 'Hide'} ${sectionId} section`} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer">
                    {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button type="button" onClick={() => toggleSection(sectionId)} aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${sectionId} section`} aria-expanded={isOpen} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer"><ChevronDown className="h-4 w-4" /></button>
                </div>
              </div>

              {isOpen && (
                <div className="p-4 border-t border-[#2A2E37] space-y-4">
                  {renderHeadingControls('internships')}
                  {renderSectionQualityPanel('internships')}
                  {list.map((i, iIdx) => (
                    <div key={i.id} className="p-4 rounded-xl border border-[#2A2E37] bg-[#0F1115] space-y-3 relative group/card">
                      <div className="absolute right-3 top-3 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover/card:opacity-100 transition">
                        <div className="flex items-center space-x-1 border border-[#2A2E37] rounded-lg p-0.5 bg-[#171A21]">
                          <button
                            onClick={() => moveInternship(iIdx, 'up')}
                            disabled={iIdx === 0}
                            className="p-1 hover:bg-[#0F1115] rounded text-zinc-400 hover:text-indigo-400 disabled:opacity-30"
                            title="Move Up"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => moveInternship(iIdx, 'down')}
                            disabled={iIdx === list.length - 1}
                            className="p-1 hover:bg-[#0F1115] rounded text-zinc-400 hover:text-indigo-400 disabled:opacity-30"
                            title="Move Down"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                        </div>
                        <button
                          onClick={() => deleteInternship(i.id)}
                          className="p-1 hover:bg-rose-950/20 rounded text-zinc-400 hover:text-rose-600 transition"
                          title="Remove Internship"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <span className="text-[10px] font-bold text-indigo-400">INTERNSHIP CARD {iIdx + 1}</span>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 mb-1">Role / Job Title</label>
                          <input
                            type="text"
                            value={i.role}
                            onChange={v => updateInternship(i.id, 'role', v.target.value)}
                            placeholder="e.g., Frontend Engineering Intern"
                            className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-xs focus:bg-[#0F1115] text-white transition outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 mb-1">Company</label>
                          <input
                            type="text"
                            value={i.company}
                            onChange={v => updateInternship(i.id, 'company', v.target.value)}
                            placeholder="e.g., Google"
                            className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-xs focus:bg-[#0F1115] text-white transition outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 mb-1">Dates (Start Date / End Date)</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={i.startDate}
                              onChange={v => updateInternship(i.id, 'startDate', v.target.value)}
                              placeholder="June 2024"
                              className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-white text-xs outline-none"
                            />
                            <input
                              type="text"
                              value={i.endDate}
                              onChange={v => updateInternship(i.id, 'endDate', v.target.value)}
                              placeholder="August 2024"
                              className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-white text-xs outline-none"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 mb-1">Location</label>
                          <input
                            type="text"
                            value={i.location}
                            onChange={v => updateInternship(i.id, 'location', v.target.value)}
                            placeholder="Mountain View, CA"
                            className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-xs focus:bg-[#0F1115] text-white transition outline-none"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-zinc-400 mb-1">Technologies Used</label>
                          <input
                            type="text"
                            value={i.technologiesUsed}
                            onChange={v => updateInternship(i.id, 'technologiesUsed', v.target.value)}
                            placeholder="e.g., React, TypeScript, TailwindCSS"
                            className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-xs focus:bg-[#0F1115] text-white transition outline-none"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-[10px] font-bold text-zinc-400">Description & Accomplishments</label>
                            {isAiConfigured && <div className="flex flex-wrap items-center justify-end gap-1.5">
                              <select value={bulletRewriteStyle} onChange={event => setBulletRewriteStyle(event.target.value as AiRewriteStyle)} disabled={isAiBusy} aria-label="Internship rewrite style" className="min-h-7 rounded-lg border border-[#2A2E37] bg-[#0F1115] px-2 text-[10px] font-semibold text-zinc-300 outline-none">
                                <option value="star_format">STAR format</option>
                                <option value="stronger_verbs">Stronger action verbs</option>
                                <option value="shorter">Shorter</option>
                                <option value="professional">More professional</option>
                                <option value="grammar_fix">Grammar fix</option>
                                <option value="explain_impact">Explain impact clearly</option>
                              </select>
                              <button type="button" onClick={() => triggerAiInternship(i.id)} disabled={isAiBusy} className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50">
                                {aiLoading[`intern_${i.id}_rewrite`] ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                <span>Rewrite</span>
                              </button>
                            </div>}
                          </div>
                          <textarea
                            value={i.description}
                            onChange={v => updateInternship(i.id, 'description', v.target.value)}
                            rows={4}
                            placeholder="- Built complex react UI modules with Framer Motion.&#10;- Resolved 15 latency blocking bugs."
                            className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-xs focus:bg-[#0F1115] text-white transition outline-none font-mono"
                          />
                        </div>
                      </div>

                    </div>
                  ))}

                  <button
                    onClick={addInternship}
                    className="w-full py-2 border border-dashed border-[#2A2E37] hover:border-indigo-500 rounded-xl text-xs font-bold text-zinc-500 hover:text-indigo-500 transition flex items-center justify-center gap-1.5 cursor-pointer bg-[#0F1115]/20"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add internship record</span>
                  </button>
                </div>
              )}
            </div>
          );
        }

        if (sectionId === 'education') {
          return (
            <div key={sectionId} className={`rounded-2xl border ${isHidden ? 'opacity-50 border-dashed border-[#2A2E37]' : 'border-[#2A2E37]'} bg-[#171A21] overflow-hidden`}>
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#0F1115]">
                <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                  <GraduationCap className="h-4.5 w-4.5 text-indigo-500" />
                  <h3 className="text-sm font-bold text-white">{getSectionHeading('education')}</h3>
                  <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold text-zinc-500">{resume.education.length}</span>
                </div>
                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                  <button type="button" onClick={() => moveSection(idx, 'up')} aria-label={`Move ${sectionId} section up`} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => moveSection(idx, 'down')} aria-label={`Move ${sectionId} section down`} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer"><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => toggleSectionVisibility(sectionId)} aria-label={`${isHidden ? 'Show' : 'Hide'} ${sectionId} section`} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer">
                    {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button type="button" onClick={() => toggleSection(sectionId)} aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${sectionId} section`} aria-expanded={isOpen} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer"><ChevronDown className="h-4 w-4" /></button>
                </div>
              </div>

              {isOpen && (
                <div className="p-4 border-t border-[#2A2E37] space-y-4">
                  {renderHeadingControls('education')}
                  {renderSectionQualityPanel('education')}
                  {resume.education.map((edu, eduIdx) => (
                    <div key={edu.id} className="p-4 rounded-xl border border-[#2A2E37] bg-[#0F1115] space-y-3 relative group/card">
                      <button
                        onClick={() => deleteEducation(edu.id)}
                        className="absolute top-3 right-3 p-1 hover:bg-rose-50 hover:bg-rose-950/20 rounded text-zinc-400 hover:text-rose-600 transition opacity-0 group-hover/card:opacity-100 cursor-pointer"
                        title="Remove Card"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>

                      <span className="text-[10px] font-bold text-indigo-500 font-mono">EDUCATION ACCORD {eduIdx + 1}</span>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 mb-1">Degree / Certify Name</label>
                          <input
                            type="text"
                            value={edu.degree}
                            onChange={v => updateEducation(edu.id, 'degree', v.target.value)}
                            placeholder="e.g., M.S. in Computer Science"
                            className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-xs outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 mb-1">Institution University</label>
                          <input
                            type="text"
                            value={edu.institution}
                            onChange={v => updateEducation(edu.id, 'institution', v.target.value)}
                            placeholder="e.g., Northeastern University"
                            className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-white text-xs outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 mb-1">Dates span</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={edu.startDate}
                              onChange={v => updateEducation(edu.id, 'startDate', v.target.value)}
                              placeholder="2020"
                              className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-white text-xs outline-none"
                            />
                            <input
                              type="text"
                              value={edu.endDate}
                              onChange={v => updateEducation(edu.id, 'endDate', v.target.value)}
                              placeholder="2022"
                              className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-white text-xs outline-none"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 mb-1">Score Type</label>
                          <select
                            value={getEducationScoreType(edu)}
                            onChange={v => updateEducation(edu.id, 'scoreType', v.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-white text-xs outline-none"
                          >
                            {EDUCATION_SCORE_TYPES.map(option => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 mb-1">{getEducationScoreFieldLabel(edu)}</label>
                          <input
                            type="text"
                            value={edu.gpa}
                            onChange={v => updateEducation(edu.id, 'gpa', v.target.value)}
                            placeholder={getEducationScorePlaceholder(edu)}
                            className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-white text-xs outline-none"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-semibold text-zinc-400 mb-1">Courses or honors</label>
                          <input
                            type="text"
                            value={edu.description}
                            onChange={v => updateEducation(edu.id, 'description', v.target.value)}
                            placeholder="Algorithms, Databases, Special honors, etc."
                            className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-white text-xs outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={addEducation}
                    className="w-full py-2 border border-dashed border-[#2A2E37] hover:border-indigo-500 border-gray-800 rounded-xl text-xs font-bold text-zinc-500 hover:text-indigo-500 transition flex items-center justify-center gap-1.5 cursor-pointer bg-[#0F1115]/20 bg-gray-950/20"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add education record</span>
                  </button>
                </div>
              )}
            </div>
          );
        }

        if (sectionId === 'skills') {
          return (
            <div key={sectionId} className={`rounded-2xl border ${isHidden ? 'opacity-50 border-dashed border-[#2A2E37]' : 'border-[#2A2E37]'} bg-[#171A21] overflow-hidden`}>
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#0F1115]">
                <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                  <Compass className="h-4.5 w-4.5 text-indigo-500" />
                  <h3 className="text-sm font-bold text-white">{getSectionHeading('skills')}</h3>
                </div>
                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                  <button type="button" onClick={() => moveSection(idx, 'up')} aria-label={`Move ${sectionId} section up`} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => moveSection(idx, 'down')} aria-label={`Move ${sectionId} section down`} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer"><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => toggleSectionVisibility(sectionId)} aria-label={`${isHidden ? 'Show' : 'Hide'} ${sectionId} section`} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer">
                    {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button type="button" onClick={() => toggleSection(sectionId)} aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${sectionId} section`} aria-expanded={isOpen} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer"><ChevronDown className="h-4 w-4" /></button>
                </div>
              </div>

              {isOpen && (
                <div className="p-4 border-t border-[#2A2E37] space-y-4">
                  {renderHeadingControls('skills')}
                  {renderSectionQualityPanel('skills')}
                  <div className="bg-amber-50/50 bg-amber-950/10 p-2.5 rounded-xl border border-amber-200/20 text-[10px] text-amber-700 text-amber-400 font-medium leading-relaxed">
                    Enter items as a comma-separated list. (e.g. JavaScript, Python, C++). Commas instantly break items into beautiful visual badge elements on the live layout preview.
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Programming Languages</label>
                    <input
                      type="text"
                      defaultValue={resume.skills.programmingLanguages.join(', ')}
                      onBlur={e => updateSkillsTags('programmingLanguages', e.target.value)}
                      placeholder="JavaScript, Python, TypeScript, Java"
                      className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-xs text-white outline-none focus:bg-[#171A21]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Frameworks & Libraries</label>
                    <input
                      type="text"
                      defaultValue={resume.skills.frameworks.join(', ')}
                      onBlur={e => updateSkillsTags('frameworks', e.target.value)}
                      placeholder="React, Next.js, Express, Spring Boot"
                      className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-xs text-white outline-none focus:bg-[#171A21]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Databases</label>
                    <input
                      type="text"
                      defaultValue={resume.skills.databases.join(', ')}
                      onBlur={e => updateSkillsTags('databases', e.target.value)}
                      placeholder="PostgreSQL, MongoDB, DynamoDB, Redis"
                      className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-xs text-white outline-none focus:bg-[#171A21]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Tools & Platforms</label>
                    <input
                      type="text"
                      defaultValue={resume.skills.tools.join(', ')}
                      onBlur={e => updateSkillsTags('tools', e.target.value)}
                      placeholder="Git, Docker, Kubernetes, AWS, Figma"
                      className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-xs text-white outline-none focus:bg-[#171A21]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Soft & Leadership Skills</label>
                    <input
                      type="text"
                      defaultValue={resume.skills.softSkills.join(', ')}
                      onBlur={e => updateSkillsTags('softSkills', e.target.value)}
                      placeholder="System Design, Agile Scrum, Communication, Mentor"
                      className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-xs text-white outline-none focus:bg-[#171A21]"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        }

        if (sectionId === 'projects') {
          return (
            <div key={sectionId} className={`rounded-2xl border ${isHidden ? 'opacity-50 border-dashed border-[#2A2E37]' : 'border-[#2A2E37]'} bg-[#171A21] overflow-hidden`}>
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#0F1115]">
                <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                  <FolderLock className="h-4.5 w-4.5 text-indigo-500" />
                  <h3 className="text-sm font-bold text-white">{getSectionHeading('projects')}</h3>
                  <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold text-zinc-500">{resume.projects.length}</span>
                </div>
                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                  <button type="button" onClick={() => moveSection(idx, 'up')} aria-label={`Move ${sectionId} section up`} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => moveSection(idx, 'down')} aria-label={`Move ${sectionId} section down`} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer"><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => toggleSectionVisibility(sectionId)} aria-label={`${isHidden ? 'Show' : 'Hide'} ${sectionId} section`} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer">
                    {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button type="button" onClick={() => toggleSection(sectionId)} aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${sectionId} section`} aria-expanded={isOpen} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer"><ChevronDown className="h-4 w-4" /></button>
                </div>
              </div>

              {isOpen && (
                <div className="p-4 border-t border-[#2A2E37] space-y-4">
                  {renderHeadingControls('projects')}
                  {renderSectionQualityPanel('projects')}
                  {resume.projects.map((proj, pIdx) => (
                    <div key={proj.id} className="p-4 rounded-xl border border-[#2A2E37] bg-[#0F1115] space-y-3 relative group/card">
                      <button
                        type="button"
                        onClick={() => deleteProject(proj.id)}
                        className="absolute right-3 top-3 rounded p-1 text-zinc-400 transition opacity-100 hover:bg-rose-50 hover:bg-rose-950/20 hover:text-rose-600 cursor-pointer sm:opacity-0 sm:group-hover/card:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                        title="Remove Project Card"
                        aria-label={`Remove project ${pIdx + 1}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>

                      <span className="text-[10px] font-bold text-indigo-500">PROJECT {pIdx + 1}</span>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-zinc-400 mb-1">Project Name</label>
                          <input
                            type="text"
                            value={proj.name}
                            onChange={v => updateProject(proj.id, 'name', v.target.value)}
                            placeholder="e.g., Real-time Chat Workspace"
                            className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-white text-xs outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 mb-1">Start Date</label>
                          <input
                            type="text"
                            value={proj.startDate || ''}
                            onChange={v => updateProject(proj.id, 'startDate', v.target.value)}
                            placeholder="Jan 2025"
                            className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-white text-xs outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 mb-1">End Date</label>
                          <input
                            type="text"
                            value={proj.endDate || ''}
                            onChange={v => updateProject(proj.id, 'endDate', v.target.value)}
                            placeholder="Present"
                            className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-white text-xs outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 mb-1">GitHub Link</label>
                          <input
                            type="url"
                            inputMode="url"
                            value={proj.github}
                            onChange={v => updateProject(proj.id, 'github', v.target.value)}
                            onBlur={v => updateProject(proj.id, 'github', normalizeExternalUrl(v.target.value))}
                            placeholder="github.com/project"
                            className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-white text-xs outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 mb-1">Live Demo link</label>
                          <input
                            type="url"
                            inputMode="url"
                            value={proj.live}
                            onChange={v => updateProject(proj.id, 'live', v.target.value)}
                            onBlur={v => updateProject(proj.id, 'live', normalizeExternalUrl(v.target.value))}
                            placeholder="my-project.vercel.app"
                            className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-white text-xs outline-none"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-zinc-400 mb-1">Technologies Used (Commas)</label>
                          <input
                            type="text"
                            value={proj.technologies}
                            onChange={v => updateProject(proj.id, 'technologies', v.target.value)}
                            placeholder="React, Socket.io, Firebase, Express"
                            className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-white text-xs outline-none"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-zinc-400 mb-1">Scope & Engineering Highlights</label>
                          <textarea
                            value={proj.description}
                            onChange={v => updateProject(proj.id, 'description', v.target.value)}
                            rows={3}
                            placeholder="- Managed state using Redux toolkit decreasing memory leaks by v4%...&#10;- Bound real-time WebSocket listeners."
                            className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-white text-xs outline-none font-mono"
                          />
                        </div>
                      </div>

                      {/* AI project tools */}
                      {isAiConfigured && <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <select value={bulletRewriteStyle} onChange={event => setBulletRewriteStyle(event.target.value as AiRewriteStyle)} disabled={isAiBusy} aria-label="Project rewrite style" className="min-h-8 max-w-full rounded-lg border border-[#2A2E37] bg-[#0F1115] px-2 text-[10px] font-semibold text-zinc-300 outline-none">
                          <option value="star_format">STAR format</option>
                          <option value="stronger_verbs">Stronger action verbs</option>
                          <option value="shorter">Shorter</option>
                          <option value="professional">More professional</option>
                          <option value="grammar_fix">Grammar fix</option>
                          <option value="explain_impact">Explain impact clearly</option>
                        </select>
                        <button onClick={() => triggerAiProject(proj.id)} disabled={isAiBusy} className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-indigo-500/20 bg-indigo-950 px-2.5 text-[10px] font-semibold text-indigo-300 transition hover:bg-indigo-900 disabled:opacity-50">
                          {aiLoading[`proj_${proj.id}_rewrite`] ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Wand2 className="h-2.5 w-2.5" />}
                          <span>Rewrite project</span>
                        </button>
                      </div>}
                    </div>
                  ))}

                  <button
                    onClick={addProject}
                    className="w-full py-2 border border-dashed border-[#2A2E37] hover:border-indigo-500 border-gray-800 rounded-xl text-xs font-bold text-zinc-500 hover:text-indigo-500 transition flex items-center justify-center gap-1.5 cursor-pointer bg-[#0F1115]/20 bg-gray-950/20"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add structural project</span>
                  </button>
                </div>
              )}
            </div>
          );
        }

        if (sectionId === 'certifications') {
          return (
            <div key={sectionId} className={`rounded-2xl border ${isHidden ? 'opacity-50 border-dashed border-[#2A2E37]' : 'border-[#2A2E37]'} bg-[#171A21] overflow-hidden`}>
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#0F1115]">
                <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                  <Award className="h-4.5 w-4.5 text-indigo-500" />
                  <h3 className="text-sm font-bold text-white">{getSectionHeading('certifications')}</h3>
                  <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold text-zinc-500">{resume.certifications.length}</span>
                </div>
                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                  <button type="button" onClick={() => moveSection(idx, 'up')} aria-label={`Move ${sectionId} section up`} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => moveSection(idx, 'down')} aria-label={`Move ${sectionId} section down`} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer"><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => toggleSectionVisibility(sectionId)} aria-label={`${isHidden ? 'Show' : 'Hide'} ${sectionId} section`} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer">
                    {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button type="button" onClick={() => toggleSection(sectionId)} aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${sectionId} section`} aria-expanded={isOpen} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer"><ChevronDown className="h-4 w-4" /></button>
                </div>
              </div>

              {isOpen && (
                <div className="p-4 border-t border-[#2A2E37] space-y-4">
                  {renderHeadingControls('certifications')}
                  {renderSectionQualityPanel('certifications')}
                  {resume.certifications.map(c => (
                    <div key={c.id} className="p-3.5 rounded-xl border border-[#2A2E37] bg-[#0F1115] space-y-3 relative group/card">
                      <button
                        onClick={() => deleteCertification(c.id)}
                        className="absolute top-3 right-3 p-1 hover:bg-rose-50 rounded text-zinc-400 hover:text-rose-600 transition opacity-0 group-hover/card:opacity-100 cursor-pointer"
                        title="Remove Card"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 mb-1">Certification Name</label>
                          <input
                            type="text"
                            value={c.name}
                            onChange={v => updateCertification(c.id, 'name', v.target.value)}
                            placeholder="e.g., AWS Solutions Architect"
                            className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-white text-xs outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 mb-1">Issuer / Company</label>
                          <input
                            type="text"
                            value={c.issuer}
                            onChange={v => updateCertification(c.id, 'issuer', v.target.value)}
                            placeholder="e.g., Amazon Web Services"
                            className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-white text-xs outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 mb-1">Completion Date</label>
                          <input
                            type="text"
                            value={c.date}
                            onChange={v => updateCertification(c.id, 'date', v.target.value)}
                            placeholder="Jan 2024"
                            className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-white text-xs outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 mb-1">Verification URL Link</label>
                          <input
                            type="url"
                            inputMode="url"
                            value={c.url}
                            onChange={v => updateCertification(c.id, 'url', v.target.value)}
                            onBlur={v => updateCertification(c.id, 'url', normalizeExternalUrl(v.target.value))}
                            placeholder="credential.net/aws-0x"
                            className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-white text-xs outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={addCertification}
                    className="w-full py-2 border border-dashed border-[#2A2E37] hover:border-indigo-500 border-gray-800 rounded-xl text-xs font-bold text-zinc-500 hover:text-indigo-500 transition flex items-center justify-center gap-1.5 cursor-pointer bg-[#0F1115]/20 bg-gray-950/20"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add certification badge</span>
                  </button>
                </div>
              )}
            </div>
          );
        }

        // Achievements Section
        if (sectionId === 'achievements') {
          return (
            <div key={sectionId} className={`rounded-2xl border ${isHidden ? 'opacity-50 border-dashed border-[#2A2E37]' : 'border-[#2A2E37]'} bg-[#171A21] overflow-hidden`}>
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#0F1115]">
                <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                  <Star className="h-4.5 w-4.5 text-indigo-500" />
                  <h3 className="text-sm font-bold text-white">{getSectionHeading('achievements')}</h3>
                </div>
                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                  <button type="button" onClick={() => moveSection(idx, 'up')} aria-label={`Move ${sectionId} section up`} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => moveSection(idx, 'down')} aria-label={`Move ${sectionId} section down`} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer"><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => toggleSectionVisibility(sectionId)} aria-label={`${isHidden ? 'Show' : 'Hide'} ${sectionId} section`} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer">
                    {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button type="button" onClick={() => toggleSection(sectionId)} aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${sectionId} section`} aria-expanded={isOpen} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer"><ChevronDown className="h-4 w-4" /></button>
                </div>
              </div>

              {isOpen && (
                <div className="p-4 border-t border-[#2A2E37] space-y-3">
                  {renderHeadingControls('achievements')}
                  {renderSectionQualityPanel('achievements')}
                  <label className="block text-[10px] font-bold text-zinc-400">Achievements (One per line)</label>
                  <textarea
                    value={resume.achievements.join('\n')}
                    onChange={e => onChange({ ...resume, achievements: e.target.value.split('\n').filter(Boolean) })}
                    rows={4}
                    placeholder="1st Place at National Hackathon (2024)&#10;Keynote Presenter at JSConf&#10;Patent issued for decentralized scaling metrics"
                    className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-white text-xs outline-none font-sans"
                  />
                </div>
              )}
            </div>
          );
        }

        // Volunteering Section
        if (sectionId === 'volunteering') {
          return (
            <div key={sectionId} className={`rounded-2xl border ${isHidden ? 'opacity-50 border-dashed border-[#2A2E37]' : 'border-[#2A2E37]'} bg-[#171A21] overflow-hidden`}>
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#0F1115]">
                <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                  <Globe className="h-4.5 w-4.5 text-indigo-500" />
                  <h3 className="text-sm font-bold text-white">{getSectionHeading('volunteering')}</h3>
                </div>
                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                  <button type="button" onClick={() => moveSection(idx, 'up')} aria-label={`Move ${sectionId} section up`} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => moveSection(idx, 'down')} aria-label={`Move ${sectionId} section down`} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer"><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => toggleSectionVisibility(sectionId)} aria-label={`${isHidden ? 'Show' : 'Hide'} ${sectionId} section`} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer">
                    {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button type="button" onClick={() => toggleSection(sectionId)} aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${sectionId} section`} aria-expanded={isOpen} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer"><ChevronDown className="h-4 w-4" /></button>
                </div>
              </div>

              {isOpen && (
                <div className="p-4 border-t border-[#2A2E37] space-y-4">
                  {renderHeadingControls('volunteering')}
                  {renderSectionQualityPanel('volunteering')}
                  {resume.volunteering.map(v => (
                    <div key={v.id} className="p-3.5 rounded-xl border border-[#2A2E37] bg-[#0F1115] space-y-3 relative group/card">
                      <button
                        onClick={() => onChange({ ...resume, volunteering: resume.volunteering.filter(vol => vol.id !== v.id) })}
                        className="absolute top-3 right-3 p-1 hover:bg-rose-50 rounded text-zinc-400 hover:text-rose-600 transition opacity-0 group-hover/card:opacity-100 cursor-pointer"
                        title="Remove Card"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-sans">
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 mb-1">Role Title</label>
                          <input
                            type="text"
                            value={v.title}
                            onChange={val => onChange({
                              ...resume,
                              volunteering: resume.volunteering.map(vol => vol.id === v.id ? { ...vol, title: val.target.value } : vol)
                            })}
                            placeholder="e.g., Code Instructor"
                            className="w-full px-3 py-2 rounded-lg border bg-[#0F1115] text-white text-xs outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 mb-1">Organization Name</label>
                          <input
                            type="text"
                            value={v.company}
                            onChange={val => onChange({
                              ...resume,
                              volunteering: resume.volunteering.map(vol => vol.id === v.id ? { ...vol, company: val.target.value } : vol)
                            })}
                            placeholder="e.g., Girls Who Code"
                            className="w-full px-3 py-2 rounded-lg border bg-[#0F1115] text-white text-xs outline-none"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-zinc-400 mb-1">Volunteer brief duties</label>
                          <input
                            type="text"
                            value={v.description}
                            onChange={val => onChange({
                              ...resume,
                              volunteering: resume.volunteering.map(vol => vol.id === v.id ? { ...vol, description: val.target.value } : vol)
                            })}
                            placeholder="Teaching algorithms and front end components to high school teams..."
                            className="w-full px-3 py-2 rounded-lg border bg-[#0F1115] text-white text-xs outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={() => {
                      const newVol: ExperienceEntry = {
                        id: 'v_' + Math.random().toString(36).substring(2, 9),
                        title: '',
                        company: '',
                        location: '',
                        startDate: '',
                        endDate: '',
                        description: '',
                      };
                      onChange({ ...resume, volunteering: [...resume.volunteering, newVol] });
                    }}
                    className="w-full py-2 border border-dashed border-[#2A2E37] hover:border-indigo-500 rounded-xl text-xs font-bold text-zinc-500 hover:text-indigo-500 transition flex items-center justify-center gap-1.5 cursor-pointer bg-[#0F1115]/25"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add community volunteer card</span>
                  </button>
                </div>
              )}
            </div>
          );
        }

        // Languages Section
        if (sectionId === 'languages') {
          return (
            <div key={sectionId} className={`rounded-2xl border ${isHidden ? 'opacity-50 border-dashed border-[#2A2E37]' : 'border-[#2A2E37]'} bg-[#171A21] overflow-hidden`}>
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#0F1115]">
                <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                  <Globe className="h-4.5 w-4.5 text-indigo-500" />
                  <h3 className="text-sm font-bold text-white">{getSectionHeading('languages')}</h3>
                </div>
                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                  <button type="button" onClick={() => moveSection(idx, 'up')} aria-label={`Move ${sectionId} section up`} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => moveSection(idx, 'down')} aria-label={`Move ${sectionId} section down`} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer"><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => toggleSectionVisibility(sectionId)} aria-label={`${isHidden ? 'Show' : 'Hide'} ${sectionId} section`} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer">
                    {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button type="button" onClick={() => toggleSection(sectionId)} aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${sectionId} section`} aria-expanded={isOpen} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer"><ChevronDown className="h-4 w-4" /></button>
                </div>
              </div>

              {isOpen && (
                <div className="p-4 border-t border-[#2A2E37] space-y-3">
                  {renderHeadingControls('languages')}
                  {renderSectionQualityPanel('languages')}
                  <label className="block text-[10px] font-bold text-zinc-400">Languages & fluency (Lines or commas separated)</label>
                  <input
                    type="text"
                    value={resume.languages.join(', ')}
                    onChange={e => onChange({ ...resume, languages: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                    placeholder="English (Native), Spanish (C2 Fluent), German (Elementary)"
                    className="w-full px-3 py-2 rounded-lg border bg-[#0F1115] text-white text-xs outline-none"
                  />
                </div>
              )}
            </div>
          );
        }

        // CUSTOM CHUNKS SECTIONS
        if (sectionId.startsWith('custom_')) {
          const cSec = resume.customSections.find(s => s.id === sectionId);
          if (!cSec) return null;

          return (
            <div key={sectionId} className={`rounded-2xl border ${isHidden ? 'opacity-50 border-dashed border-[#2A2E37]' : 'border-[#2A2E37]'} bg-[#171A21] overflow-hidden`}>
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#0F1115]">
                <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                  <PlusCircle className="h-4.5 w-4.5 text-indigo-500" />
                  <Pencil className="h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />
                  <input
                    type="text"
                    value={cSec.title}
                    onChange={e => updateCustomSectionTitle(cSec.id, e.target.value)}
                    aria-label="Edit section title"
                    className="text-sm font-bold text-white bg-transparent border-b border-dashed border-gray-300 focus:border-indigo-500 outline-none w-48 font-sans"
                  />
                </div>
                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                  <button type="button" onClick={() => moveSection(idx, 'up')} aria-label={`Move ${sectionId} section up`} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => moveSection(idx, 'down')} aria-label={`Move ${sectionId} section down`} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer"><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => deleteCustomSection(cSec.id)} aria-label={`Delete custom section ${cSec.title}`} className="rounded p-1 text-zinc-400 hover:text-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 cursor-pointer" title="Delete entire custom section"><Trash2 className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => toggleSectionVisibility(sectionId)} aria-label={`${isHidden ? 'Show' : 'Hide'} ${sectionId} section`} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer">
                    {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button type="button" onClick={() => toggleSection(sectionId)} aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${sectionId} section`} aria-expanded={isOpen} className="rounded p-1 text-zinc-400 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer"><ChevronDown className="h-4 w-4" /></button>
                </div>
              </div>

              {isOpen && (
                <div className="p-4 border-t border-[#2A2E37] space-y-4">
                  {cSec.items.map(item => (
                    <div key={item.id} className="p-3.5 rounded-xl border border-[#2A2E37] bg-[#0F1115] space-y-3 relative group/card">
                      <button
                        onClick={() => deleteCustomSectionItem(cSec.id, item.id)}
                        className="absolute top-3 right-3 p-1 hover:bg-rose-50 rounded text-zinc-400 hover:text-rose-600 transition opacity-0 group-hover/card:opacity-100 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-sans">
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 mb-1">Item Title</label>
                          <input
                            type="text"
                            value={item.title}
                            onChange={v => updateCustomSectionItem(cSec.id, item.id, 'title', v.target.value)}
                            placeholder="e.g., Publications or Research Patents"
                            className="w-full px-3 py-2 rounded-lg border bg-[#0F1115] text-white text-xs outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-1 flex items-center gap-1 text-[10px] font-bold text-zinc-400"><Pencil className="h-2.5 w-2.5" /> Subtitle / Organization</label>
                          <input
                            type="text"
                            value={item.subtitle || ''}
                            onChange={v => updateCustomSectionItem(cSec.id, item.id, 'subtitle', v.target.value)}
                            placeholder="e.g., IEEE Journal 2025"
                            className="w-full px-3 py-2 rounded-lg border bg-[#0F1115] text-white text-xs outline-none"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-zinc-400 mb-1">Detailed Description</label>
                          <textarea
                            value={item.description}
                            onChange={v => updateCustomSectionItem(cSec.id, item.id, 'description', v.target.value)}
                            rows={3}
                            placeholder="Write outstanding achievements here..."
                            className="w-full px-3 py-2 rounded-lg border bg-[#0F1115] text-white text-xs outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={() => addCustomSectionItem(cSec.id)}
                    className="w-full py-2 border border-dashed border-[#2A2E37] hover:border-indigo-500 rounded-xl text-xs font-bold text-zinc-500 hover:text-indigo-500 transition flex items-center justify-center gap-1.5 cursor-pointer bg-[#0F1115]/25"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add structural item element</span>
                  </button>
                </div>
              )}
            </div>
          );
        }

        return null;
      })}

      {/* ADD BRAND NEW CUSTOM SECTIONS BUTTON */}
      <button
        onClick={addCustomSection}
        className="w-full py-3.5 border-2 border-dashed border-indigo-900/40 rounded-2xl text-xs font-bold text-indigo-400 hover:bg-[#1f232c]/20 transition flex items-center justify-center gap-2 cursor-pointer"
        id="btn-add-custom-section"
      >
        <Plus className="h-4.5 w-4.5" />
        <span>Establish custom extra section</span>
      </button>
      <AiSuggestionReview
        suggestion={aiSuggestion}
        onApply={handleApplyAiSuggestion}
        onClose={closeAiSuggestion}
        showToasts={showToasts}
      />
      <ConfirmationDialog
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        cancelText="Cancel"
        type={confirmConfig.type}
      />
    </div>
  );
}

const hasSameEditorData = (previous: ResumeData, next: ResumeData) =>
  previous === next || (
    previous.id === next.id &&
    previous.title === next.title &&
    previous.linkDisplayMode === next.linkDisplayMode &&
    previous.personalDetails === next.personalDetails &&
    previous.summary === next.summary &&
    previous.education === next.education &&
    previous.experience === next.experience &&
    previous.internships === next.internships &&
    previous.projects === next.projects &&
    previous.skills === next.skills &&
    previous.certifications === next.certifications &&
    previous.achievements === next.achievements &&
    previous.volunteering === next.volunteering &&
    previous.languages === next.languages &&
    previous.customSections === next.customSections &&
    previous.sectionConfig === next.sectionConfig &&
    previous.languageQuality === next.languageQuality &&
    previous.sectionOrder === next.sectionOrder &&
    previous.sectionOrderMode === next.sectionOrderMode &&
    previous.hiddenSections === next.hiddenSections &&
    previous.isArchived === next.isArchived
  );

export default React.memo(ResumeBuilder, (previous, next) =>
  hasSameEditorData(previous.resume, next.resume) &&
  previous.settings === next.settings &&
  previous.saving === next.saving &&
  previous.aiEnabled === next.aiEnabled &&
  previous.onOpenAiAssist === next.onOpenAiAssist
);
