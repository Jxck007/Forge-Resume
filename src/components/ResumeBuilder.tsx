import React, { useState } from 'react';
import { ResumeData, ExperienceEntry, EducationEntry, ProjectEntry, CertificationEntry, CustomSection, CustomSectionItem, UserSettings } from '../types';
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
  HelpCircle,
  Wand2,
  Star,
} from 'lucide-react';
import { aiImproveSummary, aiImproveExperience, aiImproveProject } from '../services/groq';
import ConfirmationDialog from './ConfirmationDialog';

interface ResumeBuilderProps {
  resume: ResumeData;
  onChange: (updatedResume: ResumeData) => void;
  settings: UserSettings;
  saving: boolean;
  showToasts: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function ResumeBuilder({
  resume,
  onChange,
  settings,
  saving,
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

  const isAiConfigured = 
    (settings?.aiProvider === 'Gemini' && settings?.geminiApiKey) ||
    (settings?.aiProvider === 'OpenAI' && settings?.openaiApiKey) ||
    (settings?.aiProvider === 'OpenRouter' && settings?.openRouterApiKey) ||
    ((settings?.aiProvider === 'Groq' || !settings?.aiProvider) && settings?.groqApiKey);

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

  const toggleSection = (sec: string) => {
    setOpenSections(prev => ({ ...prev, [sec]: !prev[sec] }));
  };

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

  // Section Order Shifts
  const moveSection = (index: number, direction: 'up' | 'down') => {
    const order = [...resume.sectionOrder];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= order.length) return;

    const temp = order[index];
    order[index] = order[targetIndex];
    order[targetIndex] = temp;

    onChange({ ...resume, sectionOrder: order });
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

  const triggerAiInternship = async (id: string, action: 'improve' | 'professional' | 'metrics' | 'ats') => {
    if (!isAiConfigured) {
      showToasts('Please configure an AI Provider API Key in Settings.', 'error');
      return;
    }
    const intern = (resume.internships || []).find(i => i.id === id);
    if (!intern || !intern.description.trim()) {
      showToasts('Please enter current description bullets first.', 'info');
      return;
    }
    setAiLoading(prev => ({ ...prev, [`intern_${id}_${action}`]: true }));
    try {
      const output = await aiImproveExperience(settings, intern.description, action);
      updateInternship(id, 'description', output);
      showToasts('Internship points improved!', 'success');
    } catch (err: any) {
      showToasts(err?.message || 'AI request failed.', 'error');
    } finally {
      setAiLoading(prev => ({ ...prev, [`intern_${id}_${action}`]: false }));
    }
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
  const triggerAiSummary = async (action: 'improve' | 'shorten' | 'expand' | 'ats') => {
    if (!isAiConfigured) {
      showToasts('Please configure an AI Provider API Key in Settings to execute AI commands.', 'error');
      return;
    }
    if (!resume.summary.trim()) {
      showToasts('Please write a base summary first so the AI has context.', 'info');
      return;
    }
    setAiLoading(prev => ({ ...prev, [`summary_${action}`]: true }));
    try {
      const output = await aiImproveSummary(settings, resume.summary, action, resume.personalDetails.professionalTitle);
      if (action === 'ats') {
        try {
          const parsed = JSON.parse(output);
          setAtsSummaryDetails({
            original: parsed.original || resume.summary,
            optimized: parsed.optimized || '',
            whatChanged: Array.isArray(parsed.whatChanged) ? parsed.whatChanged : ['Readability improvements', 'Word count optimization']
          });
          showToasts('ATS summary evaluation done! Please review the optimization report.', 'success');
        } catch {
          // fallback
          setAtsSummaryDetails({
            original: resume.summary,
            optimized: output,
            whatChanged: ['Polished formatting', 'Word count alignment']
          });
          showToasts('ATS summary evaluation completed.', 'success');
        }
      } else {
        updateSummary(output);
        showToasts('Summary polished through Groq AI!', 'success');
      }
    } catch (err: any) {
      showToasts(err?.message || 'AI request failed.', 'error');
    } finally {
      setAiLoading(prev => ({ ...prev, [`summary_${action}`]: false }));
    }
  };

  const triggerAiExperience = async (id: string, action: 'improve' | 'professional' | 'metrics' | 'ats') => {
    if (!isAiConfigured) {
      showToasts('Please configure an AI Provider API Key in Settings.', 'error');
      return;
    }
    const exp = resume.experience.find(e => e.id === id);
    if (!exp || !exp.description.trim()) {
      showToasts('Please enter current description bullets first.', 'info');
      return;
    }
    setAiLoading(prev => ({ ...prev, [`exp_${id}_${action}`]: true }));
    try {
      const output = await aiImproveExperience(settings, exp.description, action);
      updateExperience(id, 'description', output);
      showToasts('Experience points improved!', 'success');
    } catch (err: any) {
      showToasts(err?.message || 'AI request failed.', 'error');
    } finally {
      setAiLoading(prev => ({ ...prev, [`exp_${id}_${action}`]: false }));
    }
  };

  const triggerAiProject = async (id: string, action: 'rewrite' | 'ats') => {
    if (!isAiConfigured) {
      showToasts('Please configure an AI Provider API Key in Settings.', 'error');
      return;
    }
    const proj = resume.projects.find(p => p.id === id);
    if (!proj || !proj.description.trim()) {
      showToasts('Please enter a short project description first.', 'info');
      return;
    }
    setAiLoading(prev => ({ ...prev, [`proj_${id}_${action}`]: true }));
    try {
      const output = await aiImproveProject(settings, proj.description, action);
      updateProject(id, 'description', output);
      showToasts('Project text rewritten!', 'success');
    } catch (err: any) {
      showToasts(err?.message || 'AI request failed.', 'error');
    } finally {
      setAiLoading(prev => ({ ...prev, [`proj_${id}_${action}`]: false }));
    }
  };

  return (
    <div className="space-y-6" id="resume-builder-form-panel">
      {/* Auto save banner info */}
      <div className="flex items-center justify-between bg-[#0F1115] border border-[#2A2E37] p-3.5 rounded-xl">
        <div>
          <h4 className="text-xs font-bold text-white">Writing Mode</h4>
          <span className="text-[10px] text-zinc-400">All alterations persist inside Firestore</span>
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

      {/* RENDER SECTIONS DYNAMICALLY ACCORDING TO REORDER SEQUENCE */}

      {/* PERSONAL INFO (Always visible at starting point) */}
      <div className="rounded-2xl border border-[#2A2E37] bg-[#171A21] shadow-xs overflow-hidden">
        <button
          onClick={() => toggleSection('personal')}
          className="flex w-full items-center justify-between p-4 bg-[#0F1115] text-left outline-none cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
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
                className={`w-full px-3 py-2 rounded-lg border bg-[#0F1115] text-xs focus:focus:border-indigo-500 focus:bg-[#171A21] text-white transition outline-none ${
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
                className={`w-full px-3 py-2 rounded-lg border bg-[#0F1115] text-xs focus:focus:border-indigo-500 focus:bg-[#171A21] text-white transition outline-none ${
                  !resume.personalDetails.email ? 'border-rose-200 border-rose-900/50' : 'border-[#2A2E37]'
                }`}
                id="personal-email"
              />
              {!resume.personalDetails.email && (
                <p className="text-[9px] text-rose-500 font-bold mt-1 tracking-wide">Required for contact</p>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Professional Title</label>
              <input
                type="text"
                value={resume.personalDetails.professionalTitle}
                onChange={e => updatePersonal('professionalTitle', e.target.value)}
                placeholder="e.g., Lead Solutions Architect"
                className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-xs focus:focus:border-indigo-500 focus:bg-[#171A21] text-white transition outline-none"
                id="personal-title"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Phone Number</label>
              <input
                type="text"
                value={resume.personalDetails.phone}
                onChange={e => updatePersonal('phone', e.target.value)}
                placeholder="+1 (555) 0192-283"
                className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-xs focus:focus:border-indigo-500 focus:bg-[#171A21] text-white transition outline-none"
                id="personal-phone"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Location</label>
              <input
                type="text"
                value={resume.personalDetails.location}
                onChange={e => updatePersonal('location', e.target.value)}
                placeholder="SF Bay Area, CA"
                className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-xs focus:focus:border-indigo-500 focus:bg-[#171A21] text-white transition outline-none"
                id="personal-location"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">LinkedIn Profile</label>
              <input
                type="text"
                value={resume.personalDetails.linkedin}
                onChange={e => updatePersonal('linkedin', e.target.value)}
                placeholder="linkedin.com/in/janesmith"
                className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-xs focus:focus:border-indigo-500 focus:bg-[#171A21] text-white transition outline-none"
                id="personal-linkedin"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">GitHub Link</label>
              <input
                type="text"
                value={resume.personalDetails.github}
                onChange={e => updatePersonal('github', e.target.value)}
                placeholder="github.com/janesmith"
                className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-xs focus:focus:border-indigo-500 focus:bg-[#171A21] text-white transition outline-none"
                id="personal-github"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Portfolio or Website</label>
              <input
                type="text"
                value={resume.personalDetails.website}
                onChange={e => updatePersonal('website', e.target.value)}
                placeholder="janesmith.dev"
                className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-xs focus:focus:border-indigo-500 focus:bg-[#171A21] text-white transition outline-none"
                id="personal-website"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Profile Photo (Base64 / Data URL)</label>
              <input
                type="text"
                value={resume.personalDetails.profilePhoto || ''}
                onChange={e => updatePersonal('profilePhoto', e.target.value)}
                placeholder="data:image/png;base64,... or enter public URL"
                className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-xs focus:focus:border-indigo-500 focus:bg-[#171A21] text-white transition outline-none font-mono"
                id="personal-profilePhoto"
              />
            </div>
          </div>
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
              <div className="flex items-center justify-between p-4 bg-[#0F1115]">
                <div className="flex items-center gap-2.5">
                  <UserCheck className="h-4.5 w-4.5 text-indigo-500" />
                  <h3 className="text-sm font-bold text-white">Professional Summary</h3>
                  {isHidden && <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">Hidden</span>}
                </div>
                {/* Control Tools */}
                <div className="flex items-center space-x-1.5">
                  <button onClick={() => moveSection(idx, 'up')} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button onClick={() => moveSection(idx, 'down')} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer"><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button onClick={() => toggleSectionVisibility(sectionId)} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer">
                    {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => toggleSection(sectionId)} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer"><ChevronDown className="h-4 w-4" /></button>
                </div>
              </div>

              {isOpen && (
                <div className="p-4 border-t border-[#2A2E37] space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Executive Summary Text</label>
                    <textarea
                      value={resume.summary}
                      onChange={e => updateSummary(e.target.value)}
                      rows={5}
                      placeholder="Results-focused Software Architect with over 8 years of engineering accomplishments..."
                      className="w-full px-3 py-2.5 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-xs focus:focus:border-indigo-500 focus:bg-[#171A21] text-white transition outline-none font-sans"
                    />
                  </div>

                  {/* Groq AI Tools Row */}
                  <div className="flex flex-wrap items-center gap-1.5 bg-indigo-500/10 bg-indigo-950/25 border border-indigo-500/20 border-indigo-900/40 p-2 rounded-xl">
                    <span className="text-[9px] uppercase tracking-wider font-bold text-indigo-500 flex items-center gap-1 pl-1">
                      <Sparkles className="h-3 w-3 fill-current" />
                      <span>Groq AI Actions:</span>
                    </span>
                    <button
                      onClick={() => triggerAiSummary('improve')}
                      disabled={aiLoading.summary_improve}
                      className="px-2 py-1 rounded bg-[#171A21] hover:bg-[#1f232c] border border-indigo-500/20 border-indigo-900 bg-indigo-950 text-[10px] font-semibold text-indigo-400 text-indigo-300 transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      {aiLoading.summary_improve ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Wand2 className="h-2.5 w-2.5" />}
                      <span>Polished Smart</span>
                    </button>
                    <button
                      onClick={() => triggerAiSummary('shorten')}
                      disabled={aiLoading.summary_shorten}
                      className="px-2 py-1 rounded bg-[#171A21] hover:bg-zinc-800 shadow-xs text-[10px] border border-[#2A2E37] text-zinc-400 bg-gray-900 border-gray-800 text-gray-300 transition cursor-pointer flex items-center gap-1 disabled:opacity-50"
                    >
                      {aiLoading.summary_shorten && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                      <span>Shorten</span>
                    </button>
                    <button
                      onClick={() => triggerAiSummary('expand')}
                      disabled={aiLoading.summary_expand}
                      className="px-2 py-1 rounded bg-[#171A21] hover:bg-zinc-800 shadow-xs text-[10px] border border-[#2A2E37] text-zinc-400 bg-gray-900 border-gray-800 text-gray-300 transition cursor-pointer flex items-center gap-1 disabled:opacity-50"
                    >
                      {aiLoading.summary_expand && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                      <span>Expand</span>
                    </button>
                    <button
                      onClick={() => triggerAiSummary('ats')}
                      disabled={aiLoading.summary_ats}
                      className="px-2 py-1 rounded bg-gradient-to-r from-violet-500 to-indigo-600 hover:opacity-90 text-[10px] font-bold text-white transition cursor-pointer flex items-center gap-1 disabled:opacity-50"
                    >
                      {aiLoading.summary_ats ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Sparkles className="h-2.5 w-2.5" />}
                      <span>ATS Optimize</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        }

        if (sectionId === 'experience') {
          return (
            <div key={sectionId} className={`rounded-2xl border ${isHidden ? 'opacity-50 border-dashed border-[#2A2E37]' : 'border-[#2A2E37]'} bg-[#171A21] overflow-hidden`}>
              <div className="flex items-center justify-between p-4 bg-[#0F1115]">
                <div className="flex items-center gap-2.5">
                  <Briefcase className="h-4.5 w-4.5 text-indigo-500" />
                  <h3 className="text-sm font-bold text-white">Professional Experience</h3>
                  <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold text-zinc-500">{resume.experience.length}</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <button onClick={() => moveSection(idx, 'up')} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button onClick={() => moveSection(idx, 'down')} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer"><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button onClick={() => toggleSectionVisibility(sectionId)} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer">
                    {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => toggleSection(sectionId)} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer"><ChevronDown className="h-4 w-4" /></button>
                </div>
              </div>

              {isOpen && (
                <div className="p-4 border-t border-[#2A2E37] space-y-4">
                  {resume.experience.map((e, eIdx) => (
                    <div key={e.id} className="p-4.5 rounded-xl border border-[#2A2E37] bg-[#0F1115] space-y-3 relative group/card">
                      <div className="absolute top-3 right-3 flex items-center space-x-1 opacity-0 group-hover/card:opacity-100 transition">
                        <button
                          onClick={() => duplicateExperience(e)}
                          className="p-1 hover:bg-[#171A21] hover:bg-gray-950 rounded text-zinc-400 hover:text-zinc-400 transition"
                          title="Duplicate Job Entry"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => deleteExperience(e.id)}
                          className="p-1 hover:bg-rose-50 hover:bg-rose-950/20 rounded text-zinc-400 hover:text-rose-600 transition"
                          title="Remove Job Entry"
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
                            <button
                              type="button"
                              onClick={() => triggerAiExperience(e.id, 'improve')}
                              disabled={aiLoading[`exp_${e.id}_improve`]}
                              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-xs"
                            >
                              {aiLoading[`exp_${e.id}_improve`] ? (
                                <Loader2 className="h-3 w-3 animate-spin text-white" />
                              ) : (
                                <Sparkles className="h-3 w-3 text-indigo-200 fill-current" />
                              )}
                              <span>Improve with AI</span>
                            </button>
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

                      {/* Groq experience points enhancements */}
                      <div className="flex flex-wrap items-center gap-1 bg-indigo-500/10 bg-indigo-950/20 border border-indigo-500/20 border-indigo-900/30 p-2 rounded-xl">
                        <span className="text-[9px] uppercase tracking-wider font-bold text-indigo-500 mr-2 flex items-center gap-1">
                          <Sparkles className="h-2.5 w-2.5 text-indigo-500" />
                          <span>Enhance Job Points:</span>
                        </span>
                        <button
                          onClick={() => triggerAiExperience(e.id, 'improve')}
                          disabled={aiLoading[`exp_${e.id}_improve`]}
                          className="px-2 py-0.5 rounded bg-[#171A21] hover:bg-[#1f232c] border border-indigo-500/20 border-indigo-900 bg-indigo-950 text-[10px] font-semibold text-indigo-400 text-indigo-300 transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          {aiLoading[`exp_${e.id}_improve`] && <Loader2 className="h-2 w-2 animate-spin" />}
                          <span>STAR bullets</span>
                        </button>
                        <button
                          onClick={() => triggerAiExperience(e.id, 'professional')}
                          disabled={aiLoading[`exp_${e.id}_professional`]}
                          className="px-2 py-0.5 rounded bg-[#171A21] hover:bg-zinc-800 border border-zinc-700 text-zinc-400 bg-gray-900 border-gray-850 text-gray-300 text-[10px] cursor-pointer flex items-center gap-1"
                        >
                          {aiLoading[`exp_${e.id}_professional`] && <Loader2 className="h-2 w-2 animate-spin" />}
                          <span>Professional Tone</span>
                        </button>
                        <button
                          onClick={() => triggerAiExperience(e.id, 'metrics')}
                          disabled={aiLoading[`exp_${e.id}_metrics`]}
                          className="px-2 py-0.5 rounded bg-[#171A21] hover:bg-zinc-800 border border-zinc-700 text-zinc-400 bg-gray-900 border-gray-850 text-gray-300 text-[10px] cursor-pointer flex items-center gap-1"
                        >
                          {aiLoading[`exp_${e.id}_metrics`] && <Loader2 className="h-2 w-2 animate-spin" />}
                          <span>Inject Metrics</span>
                        </button>
                        <button
                          onClick={() => triggerAiExperience(e.id, 'ats')}
                          disabled={aiLoading[`exp_${e.id}_ats`]}
                          className="px-2 py-0.5 rounded bg-gradient-to-r from-violet-500 to-indigo-600 text-[10px] font-bold text-white transition flex items-center gap-1 cursor-pointer"
                        >
                          {aiLoading[`exp_${e.id}_ats`] && <Loader2 className="h-2 w-2 animate-spin" />}
                          <span>ATS Matches</span>
                        </button>
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
              <div className="flex items-center justify-between p-4 bg-[#0F1115]">
                <div className="flex items-center gap-2.5">
                  <Star className="h-4.5 w-4.5 text-indigo-400" />
                  <h3 className="text-sm font-bold text-white">Internships</h3>
                  <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold text-zinc-500">{list.length}</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <button onClick={() => moveSection(idx, 'up')} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button onClick={() => moveSection(idx, 'down')} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer"><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button onClick={() => toggleSectionVisibility(sectionId)} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer">
                    {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => toggleSection(sectionId)} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer"><ChevronDown className="h-4 w-4" /></button>
                </div>
              </div>

              {isOpen && (
                <div className="p-4 border-t border-[#2A2E37] space-y-4">
                  {list.map((i, iIdx) => (
                    <div key={i.id} className="p-4.5 rounded-xl border border-[#2A2E37] bg-[#0F1115] space-y-3 relative group/card">
                      <div className="absolute top-3 right-3 flex items-center space-x-1 opacity-0 group-hover/card:opacity-100 transition">
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
                            <button
                              type="button"
                              onClick={() => triggerAiInternship(i.id, 'improve')}
                              disabled={aiLoading[`intern_${i.id}_improve`]}
                              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              {aiLoading[`intern_${i.id}_improve`] ? (
                                <Loader2 className="h-3 w-3 animate-spin text-white" />
                              ) : (
                                <Sparkles className="h-3 w-3 text-indigo-200 fill-current" />
                              )}
                              <span>Improve with AI</span>
                            </button>
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

                      {/* Internship bullet enhancers */}
                      {isAiConfigured && (
                        <div className="flex flex-wrap items-center gap-1 bg-indigo-500/10 bg-indigo-950/20 border border-indigo-500/20 border-indigo-900/30 p-2 rounded-xl">
                          <span className="text-[9px] uppercase tracking-wider font-bold text-indigo-400 mr-2 flex items-center gap-1">
                            <Sparkles className="h-2.5 w-2.5 text-indigo-400" />
                            <span>Enhance Bullet Points:</span>
                          </span>
                          <button
                            onClick={() => triggerAiInternship(i.id, 'improve')}
                            disabled={aiLoading[`intern_${i.id}_improve`]}
                            className="px-2 py-0.5 rounded bg-[#171A21] hover:bg-[#1f232c] border border-indigo-500/20 text-[10px] font-semibold text-indigo-400 transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            {aiLoading[`intern_${i.id}_improve`] && <Loader2 className="h-2 w-2 animate-spin" />}
                            <span>STAR format</span>
                          </button>
                          <button
                            onClick={() => triggerAiInternship(i.id, 'professional')}
                            disabled={aiLoading[`intern_${i.id}_professional`]}
                            className="px-2 py-0.5 rounded bg-[#171A21] hover:bg-zinc-800 border border-zinc-700 text-zinc-400 text-[10px] cursor-pointer flex items-center gap-1"
                          >
                            {aiLoading[`intern_${i.id}_professional`] && <Loader2 className="h-2 w-2 animate-spin" />}
                            <span>Corporate Tone</span>
                          </button>
                          <button
                            onClick={() => triggerAiInternship(i.id, 'metrics')}
                            disabled={aiLoading[`intern_${i.id}_metrics`]}
                            className="px-2 py-0.5 rounded bg-[#171A21] hover:bg-zinc-800 border border-zinc-700 text-zinc-400 text-[10px] cursor-pointer flex items-center gap-1"
                          >
                            {aiLoading[`intern_${i.id}_metrics`] && <Loader2 className="h-2 w-2 animate-spin" />}
                            <span>Quantify Impact</span>
                          </button>
                          <button
                            onClick={() => triggerAiInternship(i.id, 'ats')}
                            disabled={aiLoading[`intern_${i.id}_ats`]}
                            className="px-2 py-0.5 rounded bg-gradient-to-r from-violet-500 to-indigo-600 text-[10px] font-bold text-white transition flex items-center gap-1 cursor-pointer"
                          >
                            {aiLoading[`intern_${i.id}_ats`] && <Loader2 className="h-2 w-2 animate-spin" />}
                            <span>ATS Friendly</span>
                          </button>
                        </div>
                      )}
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
              <div className="flex items-center justify-between p-4 bg-[#0F1115]">
                <div className="flex items-center gap-2.5">
                  <GraduationCap className="h-4.5 w-4.5 text-indigo-500" />
                  <h3 className="text-sm font-bold text-white">Education & Certification</h3>
                  <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold text-zinc-500">{resume.education.length}</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <button onClick={() => moveSection(idx, 'up')} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button onClick={() => moveSection(idx, 'down')} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer"><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button onClick={() => toggleSectionVisibility(sectionId)} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer">
                    {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => toggleSection(sectionId)} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer"><ChevronDown className="h-4 w-4" /></button>
                </div>
              </div>

              {isOpen && (
                <div className="p-4 border-t border-[#2A2E37] space-y-4">
                  {resume.education.map((edu, eduIdx) => (
                    <div key={edu.id} className="p-4.5 rounded-xl border border-[#2A2E37] bg-[#0F1115] space-y-3 relative group/card">
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
                          <label className="block text-[10px] font-bold text-zinc-400 mb-1">GPA / CGPA (Optional)</label>
                          <input
                            type="text"
                            value={edu.gpa}
                            onChange={v => updateEducation(edu.id, 'gpa', v.target.value)}
                            placeholder="e.g., 3.84/4.0"
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
              <div className="flex items-center justify-between p-4 bg-[#0F1115]">
                <div className="flex items-center gap-2.5">
                  <Compass className="h-4.5 w-4.5 text-indigo-500" />
                  <h3 className="text-sm font-bold text-white">Technical Core Skills</h3>
                </div>
                <div className="flex items-center space-x-1.5">
                  <button onClick={() => moveSection(idx, 'up')} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button onClick={() => moveSection(idx, 'down')} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer"><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button onClick={() => toggleSectionVisibility(sectionId)} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer">
                    {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => toggleSection(sectionId)} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer"><ChevronDown className="h-4 w-4" /></button>
                </div>
              </div>

              {isOpen && (
                <div className="p-4 border-t border-[#2A2E37] space-y-4">
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
              <div className="flex items-center justify-between p-4 bg-[#0F1115]">
                <div className="flex items-center gap-2.5">
                  <FolderLock className="h-4.5 w-4.5 text-indigo-500" />
                  <h3 className="text-sm font-bold text-white">Engineering Projects</h3>
                  <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold text-zinc-500">{resume.projects.length}</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <button onClick={() => moveSection(idx, 'up')} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button onClick={() => moveSection(idx, 'down')} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer"><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button onClick={() => toggleSectionVisibility(sectionId)} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer">
                    {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => toggleSection(sectionId)} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer"><ChevronDown className="h-4 w-4" /></button>
                </div>
              </div>

              {isOpen && (
                <div className="p-4 border-t border-[#2A2E37] space-y-4">
                  {resume.projects.map((proj, pIdx) => (
                    <div key={proj.id} className="p-4.5 rounded-xl border border-[#2A2E37] bg-[#0F1115] space-y-3 relative group/card">
                      <button
                        onClick={() => deleteProject(proj.id)}
                        className="absolute top-3 right-3 p-1 hover:bg-rose-50 hover:bg-rose-950/20 rounded text-zinc-400 hover:text-rose-600 transition opacity-0 group-hover/card:opacity-100 cursor-pointer"
                        title="Remove Project Card"
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
                          <label className="block text-[10px] font-bold text-zinc-400 mb-1">GitHub Link</label>
                          <input
                            type="text"
                            value={proj.github}
                            onChange={v => updateProject(proj.id, 'github', v.target.value)}
                            placeholder="github.com/project"
                            className="w-full px-3 py-2 rounded-lg border border-[#2A2E37] bg-[#0F1115] text-white text-xs outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 mb-1">Live Demo link</label>
                          <input
                            type="text"
                            value={proj.live}
                            onChange={v => updateProject(proj.id, 'live', v.target.value)}
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
                      <div className="flex gap-1.5 pt-1">
                        <button
                          onClick={() => triggerAiProject(proj.id, 'rewrite')}
                          disabled={aiLoading[`proj_${proj.id}_rewrite`]}
                          className="px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100 border border-indigo-500/20 text-indigo-400 bg-indigo-950 border-indigo-900 text-indigo-300 text-[10px] cursor-pointer inline-flex items-center gap-1 font-semibold disabled:opacity-50"
                        >
                          {aiLoading[`proj_${proj.id}_rewrite`] && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                          <Wand2 className="h-2.5 w-2.5" />
                          <span>AI Description Rewrite</span>
                        </button>
                        <button
                          onClick={() => triggerAiProject(proj.id, 'ats')}
                          disabled={aiLoading[`proj_${proj.id}_ats`]}
                          className="px-2.5 py-1 rounded bg-violet-600 text-white hover:bg-violet-700 text-[10px] font-bold cursor-pointer inline-flex items-center gap-1 disabled:opacity-50"
                        >
                          {aiLoading[`proj_${proj.id}_ats`] && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                          <Sparkles className="h-2.5 w-2.5 fill-current text-yellow-300" />
                          <span>ATS Align</span>
                        </button>
                      </div>
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
              <div className="flex items-center justify-between p-4 bg-[#0F1115]">
                <div className="flex items-center gap-2.5">
                  <Award className="h-4.5 w-4.5 text-indigo-500" />
                  <h3 className="text-sm font-bold text-white">Certifications & Licensure</h3>
                  <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold text-zinc-500">{resume.certifications.length}</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <button onClick={() => moveSection(idx, 'up')} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button onClick={() => moveSection(idx, 'down')} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer"><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button onClick={() => toggleSectionVisibility(sectionId)} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer">
                    {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => toggleSection(sectionId)} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer"><ChevronDown className="h-4 w-4" /></button>
                </div>
              </div>

              {isOpen && (
                <div className="p-4 border-t border-[#2A2E37] space-y-4">
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
                            type="text"
                            value={c.url}
                            onChange={v => updateCertification(c.id, 'url', v.target.value)}
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
              <div className="flex items-center justify-between p-4 bg-[#0F1115]">
                <div className="flex items-center gap-2.5">
                  <Star className="h-4.5 w-4.5 text-indigo-500" />
                  <h3 className="text-sm font-bold text-white">Honors & Achievements</h3>
                </div>
                <div className="flex items-center space-x-1.5">
                  <button onClick={() => moveSection(idx, 'up')} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button onClick={() => moveSection(idx, 'down')} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer"><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button onClick={() => toggleSectionVisibility(sectionId)} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer">
                    {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => toggleSection(sectionId)} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer"><ChevronDown className="h-4 w-4" /></button>
                </div>
              </div>

              {isOpen && (
                <div className="p-4 border-t border-[#2A2E37] space-y-3">
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
              <div className="flex items-center justify-between p-4 bg-[#0F1115]">
                <div className="flex items-center gap-2.5">
                  <Globe className="h-4.5 w-4.5 text-indigo-500" />
                  <h3 className="text-sm font-bold text-white">Volunteer & Community work</h3>
                </div>
                <div className="flex items-center space-x-1.5">
                  <button onClick={() => moveSection(idx, 'up')} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button onClick={() => moveSection(idx, 'down')} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer"><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button onClick={() => toggleSectionVisibility(sectionId)} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer">
                    {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => toggleSection(sectionId)} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer"><ChevronDown className="h-4 w-4" /></button>
                </div>
              </div>

              {isOpen && (
                <div className="p-4 border-t border-[#2A2E37] space-y-4">
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
              <div className="flex items-center justify-between p-4 bg-[#0F1115]">
                <div className="flex items-center gap-2.5">
                  <Globe className="h-4.5 w-4.5 text-indigo-500" />
                  <h3 className="text-sm font-bold text-white">Languages Spoken</h3>
                </div>
                <div className="flex items-center space-x-1.5">
                  <button onClick={() => moveSection(idx, 'up')} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button onClick={() => moveSection(idx, 'down')} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer"><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button onClick={() => toggleSectionVisibility(sectionId)} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer">
                    {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => toggleSection(sectionId)} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer"><ChevronDown className="h-4 w-4" /></button>
                </div>
              </div>

              {isOpen && (
                <div className="p-4 border-t border-[#2A2E37] space-y-3">
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
              <div className="flex items-center justify-between p-4 bg-[#0F1115]">
                <div className="flex items-center gap-2.5">
                  <PlusCircle className="h-4.5 w-4.5 text-indigo-500" />
                  <input
                    type="text"
                    value={cSec.title}
                    onChange={e => updateCustomSectionTitle(cSec.id, e.target.value)}
                    className="text-sm font-bold text-white bg-transparent border-b border-dashed border-gray-300 focus:border-indigo-500 outline-none w-48 font-sans"
                  />
                  <span className="text-[9px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded font-semibold">Custom Section</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <button onClick={() => moveSection(idx, 'up')} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button onClick={() => moveSection(idx, 'down')} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer"><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button onClick={() => deleteCustomSection(cSec.id)} className="p-1 text-zinc-400 hover:text-rose-500 cursor-pointer" title="Delete entire custom section"><Trash2 className="h-3.5 w-3.5" /></button>
                  <button onClick={() => toggleSectionVisibility(sectionId)} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer">
                    {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => toggleSection(sectionId)} className="p-1 text-zinc-400 hover:text-indigo-500 cursor-pointer"><ChevronDown className="h-4 w-4" /></button>
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

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 f-sans">
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
                          <label className="block text-[10px] font-bold text-zinc-400 mb-1">Subtitle / Organization</label>
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

      {/* ATS SUMMARY OPTIMIZATION DIALOG */}
      {atsSummaryDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#171A21] border border-[#2A2E37] w-full max-w-2xl rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 bg-[#0F1115] border-b border-[#2A2E37] flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-500/10">
                <Sparkles className="h-5 w-5 text-indigo-400 fill-current" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">ATS Summary Optimization Review</h3>
                <p className="text-[10px] text-zinc-400">Strictly focused on readability and compliance without inventing details</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 border-b border-[#2A2E37] bg-zinc-950/20">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Original Version</span>
                  <span className="text-[9px] font-semibold text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
                    {atsSummaryDetails.original ? atsSummaryDetails.original.split(/\s+/).filter(Boolean).length : 0} words
                  </span>
                </div>
                <div className="p-3 bg-[#0F1115] border border-[#2A2E37] rounded-xl text-xs text-zinc-300 h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                  {atsSummaryDetails.original}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">ATS Optimized Version</span>
                  <span className="text-[9px] font-semibold text-indigo-400 bg-indigo-950 px-2 py-0.5 rounded-full">
                    {atsSummaryDetails.optimized ? atsSummaryDetails.optimized.split(/\s+/).filter(Boolean).length : 0} words (Max 100)
                  </span>
                </div>
                <div className="p-3 bg-[#0F1115] border border-indigo-500/20 rounded-xl text-xs text-white h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                  {atsSummaryDetails.optimized}
                </div>
              </div>
            </div>

            <div className="p-5 bg-zinc-900/10 border-b border-[#2A2E37] space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">What Changed</span>
              <ul className="space-y-1.5">
                {atsSummaryDetails.whatChanged.map((change, cIdx) => (
                  <li key={cIdx} className="text-xs text-zinc-300 flex items-start gap-2">
                    <span className="text-indigo-400 mt-1 font-bold">•</span>
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 bg-[#0F1115] flex justify-end gap-3">
              <button
                onClick={() => setAtsSummaryDetails(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  updateSummary(atsSummaryDetails.optimized);
                  setAtsSummaryDetails(null);
                  showToasts('ATS Optimized Summary applied!', 'success');
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white transition"
              >
                Apply ATS Summary
              </button>
            </div>
          </div>
        </div>
      )}

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
