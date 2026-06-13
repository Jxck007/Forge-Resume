import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { saveUserProfile, saveUserSettings, getUserSettings } from '../services/firebase';
import { aiParseProfileImport } from '../services/groq';
import { motion, AnimatePresence } from 'motion/react';
import {
  ProfileData,
  EducationEntry,
  ExperienceEntry,
  InternshipEntry,
  ProjectEntry,
  CertificationEntry,
  SkillCategory,
  CustomSection,
  CustomSectionItem,
  UserSettings,
} from '../types';
import ImageCropperModal from './ImageCropperModal';
import {
  EDUCATION_SCORE_TYPES,
  formatEducationScore,
  getEducationScoreFieldLabel,
  getEducationScorePlaceholder,
  getEducationScoreType,
  normalizeEducationScore,
} from '../utils/educationScore';
import {
  assessProfileImport,
  ReviewedImport,
  runAiImportSingleFlight,
} from '../utils/aiImportQuality';
import {
  User as UserIcon,
  Mail,
  Phone,
  MapPin,
  Linkedin,
  Github,
  Globe,
  Briefcase,
  GraduationCap,
  Award,
  Plus,
  Trash2,
  Sparkles,
  CheckCircle2,
  Save,
  Loader2,
  Star,
  FileImage,
  AlertCircle,
  Activity,
  FileDown,
  Target,
  Code2,
  FolderOpen,
  Trophy,
  Upload,
  FileText,
  Image as ImageIcon,
  ClipboardList,
  X,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Layers,
  Edit3,
} from 'lucide-react';

interface MyProfileProps {
  user: User;
  showToasts: (msg: string, type: 'success' | 'error' | 'info') => void;
  profile: ProfileData | null;
  onProfileUpdate: (profile: ProfileData) => void;
  dbConnected: boolean;
}

type ActiveSectionTab =
  | 'personal'
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'projects'
  | 'achievements';

const EMPTY_PROFILE = (uid: string, email: string): ProfileData => ({
  uid,
  personalDetails: {
    fullName: '',
    professionalTitle: '',
    email,
    phone: '',
    location: '',
    linkedin: '',
    github: '',
    website: '',
    profilePhoto: '',
  },
  summary: '',
  careerObjective: '',
  education: [],
  experience: [],
  internships: [],
  projects: [],
  skills: {
    programmingLanguages: [],
    frameworks: [],
    tools: [],
    databases: [],
    softSkills: [],
  },
  certifications: [],
  achievements: [],
  volunteering: [],
  languages: [],
  customSections: [],
  updatedAt: new Date().toISOString(),
});

// ─────────────────── REVIEW MODAL ───────────────────
interface ReviewModalProps {
  review: ReviewedImport<ProfileData>;
  onConfirm: (data: Partial<ProfileData>) => void;
  onCancel: () => void;
}

function ReviewModal({ review, onConfirm, onCancel }: ReviewModalProps) {
  const parsed = review.data;
  const sections = [
    {
      label: 'Personal Details',
      hasData: !!parsed.personalDetails?.fullName,
      preview: parsed.personalDetails?.fullName
        ? `${parsed.personalDetails.fullName} · ${parsed.personalDetails.professionalTitle || 'No title'}`
        : 'No personal details found',
    },
    {
      label: 'Professional Summary',
      hasData: !!parsed.summary?.trim(),
      preview: parsed.summary ? parsed.summary.substring(0, 120) + '...' : 'Not found',
    },
    {
      label: 'Career Objective',
      hasData: !!parsed.careerObjective?.trim(),
      preview: parsed.careerObjective ? parsed.careerObjective.substring(0, 100) + '...' : 'Not found',
    },
    {
      label: `Experience (${parsed.experience?.length || 0} entries)`,
      hasData: (parsed.experience?.length || 0) > 0,
      preview: parsed.experience?.[0]
        ? `${parsed.experience[0].title} @ ${parsed.experience[0].company}`
        : 'Not found',
    },
    {
      label: `Internships (${parsed.internships?.length || 0} entries)`,
      hasData: (parsed.internships?.length || 0) > 0,
      preview: parsed.internships?.[0]
        ? `${parsed.internships[0].role} @ ${parsed.internships[0].company}`
        : 'Not found',
    },
    {
      label: `Education (${parsed.education?.length || 0} entries)`,
      hasData: (parsed.education?.length || 0) > 0,
      preview: parsed.education?.[0]
        ? `${parsed.education[0].degree} · ${parsed.education[0].institution}`
        : 'Not found',
    },
    {
      label: `Projects (${parsed.projects?.length || 0} entries)`,
      hasData: (parsed.projects?.length || 0) > 0,
      preview: parsed.projects?.[0]?.name || 'Not found',
    },
    {
      label: `Skills`,
      hasData: Object.values(parsed.skills || {}).some(arr => Array.isArray(arr) && arr.length > 0),
      preview: [
        ...(parsed.skills?.programmingLanguages || []),
        ...(parsed.skills?.frameworks || []),
        ...(parsed.skills?.tools || []),
      ].slice(0, 5).join(', ') || 'Not found',
    },
    {
      label: `Certifications (${parsed.certifications?.length || 0})`,
      hasData: (parsed.certifications?.length || 0) > 0,
      preview: parsed.certifications?.[0]?.name || 'Not found',
    },
    {
      label: `Achievements (${parsed.achievements?.length || 0})`,
      hasData: (parsed.achievements?.length || 0) > 0,
      preview: parsed.achievements?.[0]?.substring(0, 80) || 'Not found',
    },
    {
      label: `Languages (${parsed.languages?.length || 0})`,
      hasData: (parsed.languages?.length || 0) > 0,
      preview: parsed.languages?.join(', ') || 'Not found',
    },
  ];
  const sectionConfidenceKey = (label: string) => {
    if (label.startsWith('Personal')) return 'personalDetails';
    if (label.startsWith('Professional')) return 'summary';
    if (label.startsWith('Career')) return 'careerObjective';
    if (label.startsWith('Experience')) return 'experience';
    if (label.startsWith('Internships')) return 'internships';
    if (label.startsWith('Education')) return 'education';
    if (label.startsWith('Projects')) return 'projects';
    if (label.startsWith('Skills')) return 'skills';
    if (label.startsWith('Certifications')) return 'certifications';
    if (label.startsWith('Achievements')) return 'achievements';
    return 'languages';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 16 }}
        className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-[#111318] shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex items-start justify-between">
          <div>
            <h3 className="text-xl font-black text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-400" />
              Review AI Import
            </h3>
            <p className="text-sm text-zinc-400 mt-1 font-medium">
              Review what the AI extracted. Confirm to merge into your profile — nothing is saved until you click "Sync Profile".
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Extracted sections list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-2">
          <div className="mb-4 flex items-center justify-between rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">Import confidence</p>
              <p className="mt-0.5 text-xs text-zinc-500">{review.confidence.rejectedFields} unsupported fields excluded</p>
            </div>
            <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-sm font-black text-emerald-300">
              {review.confidence.overall}%
            </span>
          </div>
          {sections.map((s, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 p-3.5 rounded-xl border transition ${
                s.hasData
                  ? 'border-emerald-900/50 bg-emerald-950/15'
                  : 'border-zinc-800/60 bg-zinc-900/20 opacity-60'
              }`}
            >
              <div className={`mt-0.5 shrink-0 ${s.hasData ? 'text-emerald-400' : 'text-zinc-600'}`}>
                {s.hasData ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <p className={`text-xs font-bold uppercase tracking-wider ${s.hasData ? 'text-emerald-300' : 'text-zinc-500'}`}>
                    {s.label}
                  </p>
                  {review.confidence.sections[sectionConfidenceKey(s.label)] && (
                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                      {review.confidence.sections[sectionConfidenceKey(s.label)].score}% {review.confidence.sections[sectionConfidenceKey(s.label)].level}
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 mt-0.5 truncate leading-relaxed">{s.preview}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer actions */}
        <div className="p-6 border-t border-zinc-800 flex items-center justify-between gap-4">
          <p className="text-xs text-zinc-500 font-medium">
            {sections.filter(s => s.hasData).length} of {sections.length} sections detected
          </p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(parsed)}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition shadow-lg shadow-indigo-900/30 cursor-pointer flex items-center gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              Confirm & Apply
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────── MAIN COMPONENT ───────────────────
export default function MyProfile({ user, showToasts, profile, onProfileUpdate, dbConnected }: MyProfileProps) {
  const [loading, setLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveSectionTab>('personal');
  const [cropModalSrc, setCropModalSrc] = useState<string | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);

  // AI Import states
  const [importMode, setImportMode] = useState<'pdf' | 'docx' | 'image' | 'text' | null>(null);
  const [importText, setImportText] = useState('');
  const [importParsing, setImportParsing] = useState(false);
  const [reviewData, setReviewData] = useState<ReviewedImport<ProfileData> | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState('');
  const importInProgressRef = useRef(false);

  // Local profile state
  const [localProfile, setLocalProfile] = useState<ProfileData>(
    EMPTY_PROFILE(user.uid, user.email || '')
  );

  // Temp form fields
  const [tempEdu, setTempEdu] = useState<Partial<EducationEntry>>({});
  const [tempExp, setTempExp] = useState<Partial<ExperienceEntry>>({});
  const [tempIntern, setTempIntern] = useState<Partial<InternshipEntry>>({});
  const [tempProj, setTempProj] = useState<Partial<ProjectEntry>>({});
  const [tempCert, setTempCert] = useState<Partial<CertificationEntry>>({});
  const [tempAchievement, setTempAchievement] = useState('');
  const [newSkillTag, setNewSkillTag] = useState('');
  const [selectedSkillCat, setSelectedSkillCat] = useState<keyof SkillCategory>('programmingLanguages');
  const [newLang, setNewLang] = useState('');
  const [expandedExpId, setExpandedExpId] = useState<string | null>(null);
  const [expandedInternId, setExpandedInternId] = useState<string | null>(null);

  // Custom sections temp
  const [newCustomSectionTitle, setNewCustomSectionTitle] = useState('');
  const [tempCustomItem, setTempCustomItem] = useState<{ [sectionId: string]: Partial<CustomSectionItem> }>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch initial profile and settings
  useEffect(() => {
    if (profile) {
      setLocalProfile({ ...EMPTY_PROFILE(user.uid, user.email || ''), ...profile });
    } else {
      try {
        const cached = localStorage.getItem(`forge_profile_${user.uid}`);
        if (cached) {
          setLocalProfile({ ...EMPTY_PROFILE(user.uid, user.email || ''), ...JSON.parse(cached) });
        }
      } catch (err) {
        console.error('Failed reading profile cache', err);
      }
    }
    // Load settings for AI provider check
    getUserSettings(user.uid).then(s => {
      if (s) setUserSettings(s);
    }).catch(() => {
      try {
        const cs = localStorage.getItem(`forge_settings_${user.uid}`);
        if (cs) setUserSettings(JSON.parse(cs));
      } catch {}
    });
  }, [profile, user.uid]);

  // ── SAVE ──
  const handleSaveProfile = async () => {
    if (!dbConnected) { showToasts('Cannot save profile while offline.', 'error'); return; }
    if (!localProfile.personalDetails.fullName.trim()) {
      showToasts('Full Name is required.', 'error');
      setActiveTab('personal');
      return;
    }
    setLoading(true);
    showToasts('Saving profile...', 'info');
    try {
      const toSave: ProfileData = { ...localProfile, updatedAt: new Date().toISOString() };
      localStorage.setItem(`forge_profile_${user.uid}`, JSON.stringify(toSave));
      await saveUserProfile(user.uid, toSave);
      onProfileUpdate(toSave);
      await saveUserSettings(user.uid, { hasCompletedProfile: true });
      showToasts('Profile saved successfully!', 'success');
    } catch (err) {
      console.error(err);
      showToasts('Saved locally (cloud sync failed — offline mode).', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── PHOTO ──
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    const supportedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!supportedImageTypes.includes(file.type)) {
      setUploadError('Use a JPG, JPEG, PNG, or WEBP image.');
      return;
    }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => setCropModalSrc(reader.result as string);
  };

  const handleCropComplete = (croppedBase64: string) => {
    updatePersonalField('profilePhoto', croppedBase64);
    setCropModalSrc(null);
    showToasts('Profile photo updated.', 'success');
  };

  // ── COMPLETION METER (15 checks) ──
  const getCompletionStats = () => {
    const { personalDetails, summary, careerObjective, skills, experience, internships, education, certifications, languages, projects, achievements } = localProfile;
    const checks = [
      { label: 'Full Name',           pass: !!personalDetails?.fullName?.trim() },
      { label: 'Professional Title',  pass: !!personalDetails?.professionalTitle?.trim() },
      { label: 'Phone Number',        pass: !!personalDetails?.phone?.trim() },
      { label: 'Location',            pass: !!personalDetails?.location?.trim() },
      { label: 'Social Links',        pass: !!(personalDetails?.linkedin?.trim() || personalDetails?.github?.trim()) },
      { label: 'Profile Photo',       pass: !!personalDetails?.profilePhoto },
      { label: 'Professional Summary',pass: !!summary?.trim() && summary.trim().length > 20 },
      { label: 'Career Objective',    pass: !!careerObjective?.trim() },
      { label: 'Skills',              pass: Object.values(skills || {}).some(arr => Array.isArray(arr) && arr.length > 0) },
      { label: 'Languages',           pass: Array.isArray(languages) && languages.length > 0 },
      { label: 'Experience / Internship', pass: (experience?.length || 0) > 0 || (internships?.length || 0) > 0 },
      { label: 'Education',           pass: (education?.length || 0) > 0 },
      { label: 'Projects',            pass: (projects?.length || 0) > 0 },
      { label: 'Certifications',      pass: (certifications?.length || 0) > 0 },
      { label: 'Achievements',        pass: (achievements?.length || 0) > 0 },
    ];
    const passed = checks.filter(c => c.pass).length;
    const percent = Math.round((passed / checks.length) * 100);
    const missing = checks.filter(c => !c.pass).map(c => c.label);

    let level = 'Beginner'; let levelColor = 'text-gray-400 border-gray-700 bg-gray-900/20';
    if (percent >= 90) { level = 'Profile ready'; levelColor = 'text-emerald-400 border-emerald-900/50 bg-emerald-950/20'; }
    else if (percent >= 60) { level = 'Intermediate'; levelColor = 'text-indigo-400 border-indigo-900/50 bg-indigo-950/20'; }
    else if (percent >= 30) { level = 'Getting Started'; levelColor = 'text-amber-400 border-amber-900/50 bg-amber-950/20'; }

    return { percent, missing, level, levelColor, passed, total: checks.length };
  };

  const { percent: completionProgress, missing: missingFields, level: careerLevel, levelColor: levelBadgeStyle, passed, total } = getCompletionStats();

  // ── FIELD HELPERS ──
  const updatePersonalField = (field: string, value: string) =>
    setLocalProfile(current => {
      const nextProfile = {
        ...current,
        personalDetails: { ...current.personalDetails, [field]: value },
      };
      if (field === 'profilePhoto') {
        onProfileUpdate(nextProfile);
      }
      return nextProfile;
    });

  // Skills
  const addSkillTag = () => {
    if (!newSkillTag.trim()) return;
    setLocalProfile(p => ({ ...p, skills: { ...p.skills, [selectedSkillCat]: [...new Set([...p.skills[selectedSkillCat], newSkillTag.trim()])] } }));
    setNewSkillTag('');
  };
  const removeSkillTag = (cat: keyof SkillCategory, tag: string) =>
    setLocalProfile(p => ({ ...p, skills: { ...p.skills, [cat]: p.skills[cat].filter(t => t !== tag) } }));

  // Languages
  const addLangTag = () => {
    if (!newLang.trim()) return;
    setLocalProfile(p => ({ ...p, languages: [...new Set([...p.languages, newLang.trim()])] }));
    setNewLang('');
  };
  const removeLangTag = (lang: string) =>
    setLocalProfile(p => ({ ...p, languages: p.languages.filter(l => l !== lang) }));

  // Education
  const addEducation = () => {
    if (!tempEdu.degree || !tempEdu.institution) { showToasts('Degree and Institution are required.', 'info'); return; }
    const e: EducationEntry = { id: 'edu_' + Math.random().toString(36).substring(2, 9), degree: tempEdu.degree || '', institution: tempEdu.institution || '', location: tempEdu.location || '', startDate: tempEdu.startDate || '', endDate: tempEdu.endDate || '', gpa: tempEdu.gpa || '', scoreType: getEducationScoreType({ degree: tempEdu.degree || '', gpa: tempEdu.gpa || '', scoreType: tempEdu.scoreType }), description: tempEdu.description || '' };
    setLocalProfile(p => ({ ...p, education: [...p.education, e] }));
    setTempEdu({});
    showToasts('Education entry added.', 'success');
  };
  const removeEducation = (id: string) => setLocalProfile(p => ({ ...p, education: p.education.filter(e => e.id !== id) }));
  const updateEducationScoreType = (id: string, scoreType: EducationEntry['scoreType']) =>
    setLocalProfile(p => ({
      ...p,
      education: p.education.map(entry => entry.id === id ? { ...entry, scoreType } : entry),
    }));

  // Experience
  const addExperience = () => {
    if (!tempExp.title || !tempExp.company) { showToasts('Job title and Company are required.', 'info'); return; }
    const e: ExperienceEntry = { id: 'exp_' + Math.random().toString(36).substring(2, 9), title: tempExp.title || '', company: tempExp.company || '', location: tempExp.location || '', startDate: tempExp.startDate || '', endDate: tempExp.endDate || '', description: tempExp.description || '' };
    setLocalProfile(p => ({ ...p, experience: [...p.experience, e] }));
    setTempExp({});
    showToasts('Experience entry added.', 'success');
  };
  const removeExperience = (id: string) => setLocalProfile(p => ({ ...p, experience: p.experience.filter(e => e.id !== id) }));

  // Internships
  const addInternship = () => {
    if (!tempIntern.role || !tempIntern.company) { showToasts('Role and Company are required.', 'info'); return; }
    const e: InternshipEntry = { id: 'int_' + Math.random().toString(36).substring(2, 9), role: tempIntern.role || '', company: tempIntern.company || '', location: tempIntern.location || '', startDate: tempIntern.startDate || '', endDate: tempIntern.endDate || '', description: tempIntern.description || '', technologiesUsed: tempIntern.technologiesUsed || '' };
    setLocalProfile(p => ({ ...p, internships: [...(p.internships || []), e] }));
    setTempIntern({});
    showToasts('Internship entry added.', 'success');
  };
  const removeInternship = (id: string) => setLocalProfile(p => ({ ...p, internships: (p.internships || []).filter(e => e.id !== id) }));

  // Projects
  const addProject = () => {
    if (!tempProj.name) { showToasts('Project name is required.', 'info'); return; }
    const e: ProjectEntry = { id: 'proj_' + Math.random().toString(36).substring(2, 9), name: tempProj.name || '', description: tempProj.description || '', technologies: tempProj.technologies || '', github: tempProj.github || '', live: tempProj.live || '' };
    setLocalProfile(p => ({ ...p, projects: [...p.projects, e] }));
    setTempProj({});
    showToasts('Project added.', 'success');
  };
  const removeProject = (id: string) => setLocalProfile(p => ({ ...p, projects: p.projects.filter(e => e.id !== id) }));

  // Certifications
  const addCert = () => {
    if (!tempCert.name || !tempCert.issuer) { showToasts('Name and Issuer are required.', 'info'); return; }
    const e: CertificationEntry = { id: 'cert_' + Math.random().toString(36).substring(2, 9), name: tempCert.name || '', issuer: tempCert.issuer || '', date: tempCert.date || '', url: tempCert.url || '' };
    setLocalProfile(p => ({ ...p, certifications: [...p.certifications, e] }));
    setTempCert({});
    showToasts('Certification added.', 'success');
  };
  const removeCert = (id: string) => setLocalProfile(p => ({ ...p, certifications: p.certifications.filter(c => c.id !== id) }));

  // Achievements
  const addAchievement = () => {
    if (!tempAchievement.trim()) return;
    setLocalProfile(p => ({ ...p, achievements: [...p.achievements, tempAchievement.trim()] }));
    setTempAchievement('');
  };
  const removeAchievement = (idx: number) => setLocalProfile(p => ({ ...p, achievements: p.achievements.filter((_, i) => i !== idx) }));

  // Custom sections
  const addCustomSection = () => {
    if (!newCustomSectionTitle.trim()) { showToasts('Section title is required.', 'info'); return; }
    const s: CustomSection = { id: 'cs_' + Math.random().toString(36).substring(2, 9), title: newCustomSectionTitle.trim(), items: [] };
    setLocalProfile(p => ({ ...p, customSections: [...(p.customSections || []), s] }));
    setNewCustomSectionTitle('');
  };
  const removeCustomSection = (id: string) => setLocalProfile(p => ({ ...p, customSections: (p.customSections || []).filter(s => s.id !== id) }));
  const addCustomItem = (sectionId: string) => {
    const item = tempCustomItem[sectionId];
    if (!item?.title) { showToasts('Item title is required.', 'info'); return; }
    const newItem: CustomSectionItem = { id: 'ci_' + Math.random().toString(36).substring(2, 9), title: item.title || '', subtitle: item.subtitle || '', date: item.date || '', description: item.description || '' };
    setLocalProfile(p => ({ ...p, customSections: (p.customSections || []).map(s => s.id === sectionId ? { ...s, items: [...s.items, newItem] } : s) }));
    setTempCustomItem(prev => ({ ...prev, [sectionId]: {} }));
  };
  const removeCustomItem = (sectionId: string, itemId: string) => setLocalProfile(p => ({ ...p, customSections: (p.customSections || []).map(s => s.id === sectionId ? { ...s, items: s.items.filter(i => i.id !== itemId) } : s) }));

  // ── AI IMPORT ──
  const isAiConfigured = userSettings && (
    (userSettings.aiProvider === 'Groq' && !!userSettings.groqApiKey) ||
    (userSettings.aiProvider === 'Gemini' && !!userSettings.geminiApiKey) ||
    (userSettings.aiProvider === 'OpenAI' && !!userSettings.openaiApiKey) ||
    (userSettings.aiProvider === 'OpenRouter' && !!userSettings.openRouterApiKey)
  );

  const extractTextFromPdf = async (file: File): Promise<string> => {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).href;
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item: any) => item.str).join(' ') + '\n';
    }
    return text;
  };

  const extractTextFromDocx = async (file: File): Promise<string> => {
    const mammoth = (await import('mammoth')).default;
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  };

  const extractTextFromImage = async (file: File): Promise<string> => {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng');
    const { data: { text } } = await worker.recognize(file);
    await worker.terminate();
    return text;
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !importMode || importMode === 'text') return;
    if (fileInputRef.current) fileInputRef.current.value = '';

    if (importInProgressRef.current) {
      showToasts('Import already in progress.', 'info');
      return;
    }
    if (!isAiConfigured) {
      showToasts('Please configure an AI provider in Settings first.', 'error');
      return;
    }

    importInProgressRef.current = true;
    setImportParsing(true);
    setImportProgress(20);
    setImportStatus('Extracting resume text...');
    showToasts('Extracting text from file...', 'info');
    try {
      let rawText = '';
      if (importMode === 'pdf') rawText = await extractTextFromPdf(file);
      else if (importMode === 'docx') rawText = await extractTextFromDocx(file);
      else if (importMode === 'image') rawText = await extractTextFromImage(file);

      if (!rawText.trim()) {
        showToasts('Could not extract text from the file. Try pasting manually.', 'error');
        return;
      }

      showToasts('Parsing with AI...', 'info');
      setImportProgress(60);
      setImportStatus('Verifying extracted information...');
      const review = await runAiImportSingleFlight(async () => {
        const parsed = await aiParseProfileImport(userSettings!, rawText);
        return assessProfileImport(parsed, rawText);
      });
      setReviewData(review);
      setImportProgress(100);
      setImportStatus('Ready for review');
    } catch (err: any) {
      console.error(err);
      showToasts(err?.message || 'Import failed. Check file format and AI settings.', 'error');
    } finally {
      importInProgressRef.current = false;
      setImportParsing(false);
    }
  };

  const handleTextImport = async () => {
    if (importInProgressRef.current) {
      showToasts('Import already in progress.', 'info');
      return;
    }
    if (!importText.trim()) { showToasts('Please paste some resume text first.', 'info'); return; }
    if (!isAiConfigured) { showToasts('Please configure an AI provider in Settings first.', 'error'); return; }

    importInProgressRef.current = true;
    setImportParsing(true);
    setImportProgress(35);
    setImportStatus('Verifying extracted information...');
    showToasts('Parsing with AI...', 'info');
    try {
      const review = await runAiImportSingleFlight(async () => {
        const parsed = await aiParseProfileImport(userSettings!, importText);
        return assessProfileImport(parsed, importText);
      });
      setReviewData(review);
      setImportProgress(100);
      setImportStatus('Ready for review');
    } catch (err: any) {
      showToasts(err?.message || 'AI parsing failed.', 'error');
    } finally {
      importInProgressRef.current = false;
      setImportParsing(false);
    }
  };

  const handleConfirmImport = (parsed: Partial<ProfileData>) => {
    setLocalProfile(prev => {
      const merged: ProfileData = {
        ...prev,
        personalDetails: {
          ...prev.personalDetails,
          ...(parsed.personalDetails || {}),
          email: prev.personalDetails.email, // preserve auth email
          profilePhoto: prev.personalDetails.profilePhoto, // preserve existing photo
        },
        summary: parsed.summary?.trim() || prev.summary,
        careerObjective: parsed.careerObjective?.trim() || prev.careerObjective,
        education: parsed.education?.length ? parsed.education.map(e => ({ ...e, ...normalizeEducationScore(e as unknown as Record<string, unknown>), id: e.id || 'edu_' + Math.random().toString(36).substring(2, 9) })) : prev.education,
        experience: parsed.experience?.length ? parsed.experience.map(e => ({ ...e, id: e.id || 'exp_' + Math.random().toString(36).substring(2, 9) })) : prev.experience,
        internships: parsed.internships?.length ? parsed.internships.map(e => ({ ...e, id: e.id || 'int_' + Math.random().toString(36).substring(2, 9) })) : (prev.internships || []),
        projects: parsed.projects?.length ? parsed.projects.map(e => ({ ...e, id: e.id || 'proj_' + Math.random().toString(36).substring(2, 9) })) : prev.projects,
        skills: {
          programmingLanguages: [...new Set([...prev.skills.programmingLanguages, ...(parsed.skills?.programmingLanguages || [])])],
          frameworks: [...new Set([...prev.skills.frameworks, ...(parsed.skills?.frameworks || [])])],
          tools: [...new Set([...prev.skills.tools, ...(parsed.skills?.tools || [])])],
          databases: [...new Set([...prev.skills.databases, ...(parsed.skills?.databases || [])])],
          softSkills: [...new Set([...prev.skills.softSkills, ...(parsed.skills?.softSkills || [])])],
        },
        certifications: parsed.certifications?.length ? parsed.certifications.map(e => ({ ...e, id: e.id || 'cert_' + Math.random().toString(36).substring(2, 9) })) : prev.certifications,
        achievements: parsed.achievements?.length ? [...new Set([...prev.achievements, ...parsed.achievements])] : prev.achievements,
        languages: parsed.languages?.length ? [...new Set([...prev.languages, ...parsed.languages])] : prev.languages,
        volunteering: parsed.volunteering?.length ? parsed.volunteering.map(e => ({ ...e, id: e.id || 'vol_' + Math.random().toString(36).substring(2, 9) })) : prev.volunteering,
      };
      return merged;
    });
    setReviewData(null);
    setImportMode(null);
    setImportText('');
    showToasts('AI data merged into profile! Review and click "Sync Profile" to save.', 'success');
  };

  // ── INPUT STYLE HELPER ──
  const inputCls = 'w-full px-4 py-2.5 bg-zinc-900/50 border border-zinc-800 rounded-xl focus:border-indigo-500 outline-none transition text-sm text-white placeholder:text-zinc-600';
  const miniInputCls = 'px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 outline-none transition w-full';

  const tabs: { id: ActiveSectionTab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'personal', label: 'Personal', icon: UserIcon },
    { id: 'summary', label: 'Summary', icon: ClipboardList },
    { id: 'experience', label: 'Experience', icon: Briefcase, badge: (localProfile.experience?.length || 0) + (localProfile.internships?.length || 0) },
    { id: 'education', label: 'Education', icon: GraduationCap, badge: localProfile.education?.length || 0 },
    { id: 'skills', label: 'Skills', icon: Code2 },
    { id: 'projects', label: 'Projects', icon: FolderOpen, badge: localProfile.projects?.length || 0 },
    { id: 'achievements', label: 'Achievements', icon: Trophy, badge: (localProfile.certifications?.length || 0) + (localProfile.achievements?.length || 0) },
  ];

  return (
    <div className="forge-product-page forge-profile-page mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Crop Modal */}
      {cropModalSrc && (
        <ImageCropperModal imageSrc={cropModalSrc} onClose={() => setCropModalSrc(null)} onCropComplete={handleCropComplete} />
      )}

      {/* Review Modal */}
      <AnimatePresence>
        {reviewData && (
          <ReviewModal
            review={reviewData}
            onConfirm={handleConfirmImport}
            onCancel={() => setReviewData(null)}
          />
        )}
      </AnimatePresence>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={importMode === 'pdf' ? '.pdf' : importMode === 'docx' ? '.docx,.doc' : 'image/*'}
        onChange={handleFileImport}
      />

      {/* ── COVER HEADER ── */}
      <div className="forge-profile-hero relative mb-8 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/40 shadow-xl">
        <div className="h-36 bg-gradient-to-r from-[#0c0e14] via-indigo-950/60 to-[#0c0e14] relative">
          <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:20px_20px]" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-zinc-900/40" />
          <div className="absolute bottom-4 right-5">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest border shadow-sm ${levelBadgeStyle}`}>
              <Star className="h-3 w-3" />
              {careerLevel}
            </span>
          </div>
        </div>
        <div className="px-6 pb-6 pt-0 sm:px-8 flex flex-col md:flex-row md:items-end gap-6 relative">
          {/* Avatar */}
          <div className="relative -mt-14 h-28 w-28 rounded-2xl bg-zinc-900 p-1.5 shadow-xl border border-zinc-800 shrink-0">
            {localProfile.personalDetails?.profilePhoto ? (
              <img
                src={localProfile.personalDetails.profilePhoto}
                alt="Profile"
                className="h-full w-full object-cover rounded-xl"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-xl bg-[#0b1315] text-3xl font-bold text-emerald-300">
                {(localProfile.personalDetails?.fullName || user.email || 'F').charAt(0).toUpperCase()}
              </div>
            )}
            <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl opacity-0 hover:opacity-100 transition cursor-pointer">
              <Edit3 className="h-5 w-5 text-white" />
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoUpload} />
            </label>
          </div>
          {/* Name/Title */}
          <div className="flex-1 space-y-1.5 mt-2">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-black text-white">
                  {localProfile.personalDetails?.fullName || 'Your Name'}
                </h1>
                <p className="text-sm font-bold text-indigo-400 mt-0.5">
                  {localProfile.personalDetails?.professionalTitle || 'Add your professional title →'}
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-500 font-medium mt-1.5">
                  {localProfile.personalDetails?.email && (
                    <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{localProfile.personalDetails.email}</span>
                  )}
                  {localProfile.personalDetails?.location && (
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{localProfile.personalDetails.location}</span>
                  )}
                </div>
              </div>
              <button
                onClick={handleSaveProfile}
                disabled={loading}
                id="btn-profile-sync"
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-5 rounded-xl shadow-lg shadow-indigo-900/30 transition hover:scale-[1.02] active:scale-99 cursor-pointer self-start sm:self-auto shrink-0 text-sm"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /><span>Sync Profile</span></>}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="forge-profile-grid grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* ── LEFT COLUMN ── */}
        <div className="forge-profile-sidebar lg:col-span-4 space-y-6">

          {/* Completion Meter */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-5 shadow-sm">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2 mb-4">
              <Activity className="h-3.5 w-3.5 text-indigo-400" />
              Profile Completion
            </h3>
            <div className="flex items-center gap-4 mb-4">
              <div className="relative h-16 w-16 shrink-0 flex items-center justify-center">
                <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="6" className="text-zinc-800" />
                  <circle
                    cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="6"
                    strokeDasharray={`${(completionProgress / 100) * 175.9} 175.9`}
                    strokeLinecap="round"
                    className={completionProgress >= 90 ? 'text-emerald-500' : completionProgress >= 60 ? 'text-indigo-500' : completionProgress >= 30 ? 'text-amber-500' : 'text-zinc-600'}
                    style={{ transition: 'stroke-dasharray 0.5s ease' }}
                  />
                </svg>
                <span className="text-sm font-black text-white">{completionProgress}%</span>
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-xs text-zinc-300 font-bold">{passed}/{total} checks passed</p>
                <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${completionProgress >= 90 ? 'bg-emerald-500' : completionProgress >= 60 ? 'bg-indigo-500' : 'bg-amber-500'}`}
                    style={{ width: `${completionProgress}%` }}
                  />
                </div>
                <p className="text-[10px] text-zinc-500">{missingFields.length} fields missing</p>
              </div>
            </div>
            {missingFields.length > 0 && (
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {missingFields.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px] font-semibold text-rose-400 bg-rose-950/15 border border-rose-900/30 px-2.5 py-1.5 rounded-lg">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            )}
            {missingFields.length === 0 && (
              <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-400 bg-emerald-950/15 border border-emerald-900/30 px-3 py-2 rounded-lg">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Profile complete and ready to reuse</span>
              </div>
            )}
          </div>

          {/* Photo card */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-5 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              <FileImage className="h-3.5 w-3.5 text-violet-400" />
              Profile Photo
            </h4>
            <label className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 cursor-pointer hover:bg-zinc-800/40 transition">
              <FileDown className="h-5 w-5 text-indigo-400" />
              <span className="text-xs font-bold text-zinc-300">Upload Image</span>
              <span className="text-[10px] text-zinc-500">PNG / JPG up to 5MB</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoUpload} />
            </label>
            {uploadError && <p className="text-xs text-rose-400 bg-rose-950/15 border border-rose-900/30 p-2 rounded-lg">{uploadError}</p>}
            {localProfile.personalDetails?.profilePhoto && (
              <div className="flex items-center justify-between bg-zinc-800/40 border border-zinc-700/50 p-2.5 rounded-xl">
                <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />Custom photo active</span>
                <button onClick={() => updatePersonalField('profilePhoto', '')} className="text-[10px] font-bold text-rose-400 hover:underline cursor-pointer">Remove</button>
              </div>
            )}
          </div>

          {/* AI Import Card */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-5 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              Resume Import
            </h4>

            {!isAiConfigured && (
              <div className="flex items-start gap-2 text-[11px] text-amber-400 bg-amber-950/15 border border-amber-900/30 p-3 rounded-xl font-medium leading-relaxed">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>Configure an AI provider in <span className="font-bold underline">Settings</span> to enable AI import.</span>
              </div>
            )}

            <p className="text-[11px] text-zinc-500 leading-relaxed">Import an existing resume and review the structured profile details before saving.</p>

            {/* Import method selector */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'pdf', label: 'PDF', icon: FileText, accept: '.pdf' },
                { id: 'docx', label: 'DOCX', icon: FileDown, accept: '.docx,.doc' },
                { id: 'image', label: 'Image', icon: ImageIcon, accept: 'image/*' },
                { id: 'text', label: 'Paste Text', icon: ClipboardList, accept: '' },
              ].map(method => (
                <button
                  key={method.id}
                  onClick={() => {
                    setImportMode(method.id as any);
                    if (method.id !== 'text' && fileInputRef.current) {
                      fileInputRef.current.accept = method.accept;
                      fileInputRef.current.click();
                    }
                  }}
                  disabled={importParsing || !isAiConfigured}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-[11px] font-bold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    importMode === method.id
                      ? 'border-indigo-600 bg-indigo-950/30 text-indigo-300'
                      : 'border-zinc-700 bg-zinc-800/30 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
                  }`}
                >
                  <method.icon className="h-4 w-4" />
                  {method.label}
                </button>
              ))}
            </div>

            {/* Paste text mode */}
            <AnimatePresence>
              {importMode === 'text' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 overflow-hidden"
                >
                  <textarea
                    value={importText}
                    onChange={e => setImportText(e.target.value)}
                    disabled={importParsing}
                    rows={6}
                    placeholder="Paste your resume text here..."
                    className="w-full p-3 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-zinc-300 font-mono focus:border-indigo-500 outline-none resize-none leading-relaxed placeholder:text-zinc-600"
                  />
                  <div className="flex gap-2">
                    <button disabled={importParsing} onClick={() => { setImportMode(null); setImportText(''); }} className="flex-1 py-2 text-xs font-bold text-zinc-400 border border-zinc-700 rounded-xl hover:bg-zinc-800 transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-40">Cancel</button>
                    <button
                      onClick={handleTextImport}
                      disabled={importParsing || !importText.trim()}
                      className="flex-1 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1"
                    >
                      {importParsing ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />{importStatus}</> : <><Sparkles className="h-3.5 w-3.5" />Review import</>}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {importParsing && (
              <div className="space-y-2 text-xs text-indigo-400 font-semibold bg-indigo-950/20 border border-indigo-900/30 p-3 rounded-xl">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin shrink-0" />{importStatus}</span>
                  <span>{importProgress}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                  <motion.div
                    className="h-full rounded-full bg-indigo-400"
                    animate={{ width: `${importProgress}%` }}
                    transition={{ duration: 0.25 }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN: TABS ── */}
        <div className="forge-profile-editor lg:col-span-8 space-y-4">
          {/* Tab bar */}
          <div className="forge-profile-tabs flex border-b border-zinc-800 overflow-x-auto no-scrollbar gap-0.5">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-[11px] font-bold uppercase tracking-wider border-b-2 transition whitespace-nowrap cursor-pointer shrink-0 ${
                    isActive ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${isActive ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}>{tab.badge}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="forge-profile-content bg-zinc-900/25 p-6 border border-zinc-800/80 rounded-2xl min-h-[480px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >

                {/* ═══ PERSONAL TAB ═══ */}
                {activeTab === 'personal' && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">Full Name *</label>
                        <input type="text" value={localProfile.personalDetails?.fullName || ''} onChange={e => updatePersonalField('fullName', e.target.value)} placeholder="Elizabeth Holmes" className={inputCls} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">Professional Title</label>
                        <input type="text" value={localProfile.personalDetails?.professionalTitle || ''} onChange={e => updatePersonalField('professionalTitle', e.target.value)} placeholder="Lead DevOps Architect" className={inputCls} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">Email</label>
                        <input type="email" disabled value={localProfile.personalDetails?.email || ''} className={`${inputCls} opacity-50 cursor-not-allowed`} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">Phone</label>
                        <input type="tel" value={localProfile.personalDetails?.phone || ''} onChange={e => updatePersonalField('phone', e.target.value)} placeholder="+1 (555) 000-0000" className={inputCls} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">Location</label>
                      <input type="text" value={localProfile.personalDetails?.location || ''} onChange={e => updatePersonalField('location', e.target.value)} placeholder="New York, USA" className={inputCls} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-zinc-800/50">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1 flex items-center gap-1"><Linkedin className="h-3 w-3 text-indigo-400" />LinkedIn</label>
                        <input type="url" value={localProfile.personalDetails?.linkedin || ''} onChange={e => updatePersonalField('linkedin', e.target.value)} placeholder="linkedin.com/in/username" className={inputCls} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1 flex items-center gap-1"><Github className="h-3 w-3" />GitHub</label>
                        <input type="url" value={localProfile.personalDetails?.github || ''} onChange={e => updatePersonalField('github', e.target.value)} placeholder="github.com/username" className={inputCls} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1 flex items-center gap-1"><Globe className="h-3 w-3 text-indigo-400" />Website</label>
                        <input type="url" value={localProfile.personalDetails?.website || ''} onChange={e => updatePersonalField('website', e.target.value)} placeholder="yoursite.dev" className={inputCls} />
                      </div>
                    </div>
                  </div>
                )}

                {/* ═══ SUMMARY TAB ═══ */}
                {activeTab === 'summary' && (
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-white">Professional Summary</h4>
                          <p className="text-xs text-zinc-500 mt-0.5">A compelling overview — used across all resumes.</p>
                        </div>
                        <span className="text-[10px] font-bold text-zinc-600 bg-zinc-800 px-2 py-1 rounded-md">{localProfile.summary?.length || 0} chars</span>
                      </div>
                      <textarea
                        value={localProfile.summary || ''}
                        onChange={e => setLocalProfile(p => ({ ...p, summary: e.target.value }))}
                        placeholder="e.g. Senior cloud architect with 8+ years designing scalable infrastructure..."
                        rows={7}
                        className="w-full p-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl focus:border-indigo-500 outline-none transition leading-relaxed text-sm text-white placeholder:text-zinc-600 font-serif resize-none"
                      />
                    </div>
                    <div className="space-y-3 border-t border-zinc-800/60 pt-6">
                      <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-2"><Target className="h-4 w-4 text-amber-400" />Career Objective</h4>
                        <p className="text-xs text-zinc-500 mt-0.5">A short-term goal statement — optional but powerful for junior profiles.</p>
                      </div>
                      <textarea
                        value={localProfile.careerObjective || ''}
                        onChange={e => setLocalProfile(p => ({ ...p, careerObjective: e.target.value }))}
                        placeholder="e.g. Seeking a senior DevOps role at a growth-stage startup where I can lead infrastructure modernization..."
                        rows={5}
                        className="w-full p-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl focus:border-indigo-500 outline-none transition leading-relaxed text-sm text-white placeholder:text-zinc-600 font-serif resize-none"
                      />
                    </div>
                  </div>
                )}

                {/* ═══ EXPERIENCE TAB ═══ */}
                {activeTab === 'experience' && (
                  <div className="space-y-8">

                    {/* Work Experience */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-indigo-400" />
                        Work Experience ({localProfile.experience?.length || 0})
                      </h4>

                      {localProfile.experience?.map(exp => (
                        <div key={exp.id} className="rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
                          <div className="flex items-start justify-between gap-3 p-4">
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-white text-sm truncate">{exp.title}</p>
                              <p className="text-zinc-400 text-xs mt-0.5 truncate">{exp.company} {exp.location ? `· ${exp.location}` : ''}</p>
                              <p className="text-[10px] text-zinc-600 font-semibold mt-1">{exp.startDate}{exp.endDate ? ` – ${exp.endDate}` : ''}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button onClick={() => setExpandedExpId(expandedExpId === exp.id ? null : exp.id)} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition cursor-pointer">
                                {expandedExpId === exp.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                              </button>
                              <button onClick={() => removeExperience(exp.id)} className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/20 transition cursor-pointer">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                          {expandedExpId === exp.id && exp.description && (
                            <div className="px-4 pb-4 border-t border-zinc-800/60 pt-3">
                              <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-line">{exp.description}</p>
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Add Experience Form */}
                      <div className="p-4 rounded-2xl border border-zinc-800/60 bg-zinc-900/20 space-y-3">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Add Experience</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <input type="text" placeholder="Job Title *" value={tempExp.title || ''} onChange={e => setTempExp({ ...tempExp, title: e.target.value })} className={miniInputCls} />
                          <input type="text" placeholder="Company *" value={tempExp.company || ''} onChange={e => setTempExp({ ...tempExp, company: e.target.value })} className={miniInputCls} />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <input type="text" placeholder="Location" value={tempExp.location || ''} onChange={e => setTempExp({ ...tempExp, location: e.target.value })} className={miniInputCls} />
                          <input type="text" placeholder="Start Date" value={tempExp.startDate || ''} onChange={e => setTempExp({ ...tempExp, startDate: e.target.value })} className={miniInputCls} />
                          <input type="text" placeholder="End Date" value={tempExp.endDate || ''} onChange={e => setTempExp({ ...tempExp, endDate: e.target.value })} className={miniInputCls} />
                        </div>
                        <textarea placeholder="Key responsibilities & achievements..." value={tempExp.description || ''} onChange={e => setTempExp({ ...tempExp, description: e.target.value })} rows={3} className={`${miniInputCls} resize-none leading-relaxed`} />
                        <button onClick={addExperience} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2 rounded-xl text-xs transition cursor-pointer">Add Experience</button>
                      </div>
                    </div>

                    {/* Internships */}
                    <div className="space-y-4 border-t border-zinc-800/60 pt-6">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Layers className="h-4 w-4 text-violet-400" />
                        Internships ({localProfile.internships?.length || 0})
                      </h4>

                      {localProfile.internships?.map(intern => (
                        <div key={intern.id} className="rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
                          <div className="flex items-start justify-between gap-3 p-4">
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-white text-sm truncate">{intern.role}</p>
                              <p className="text-zinc-400 text-xs mt-0.5 truncate">{intern.company} {intern.location ? `· ${intern.location}` : ''}</p>
                              <p className="text-[10px] text-zinc-600 font-semibold mt-1">{intern.startDate}{intern.endDate ? ` – ${intern.endDate}` : ''}</p>
                              {intern.technologiesUsed && <p className="text-[10px] text-indigo-400 mt-1 font-mono truncate">{intern.technologiesUsed}</p>}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <button onClick={() => setExpandedInternId(expandedInternId === intern.id ? null : intern.id)} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition cursor-pointer">
                                {expandedInternId === intern.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                              </button>
                              <button onClick={() => removeInternship(intern.id)} className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/20 transition cursor-pointer">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                          {expandedInternId === intern.id && intern.description && (
                            <div className="px-4 pb-4 border-t border-zinc-800/60 pt-3">
                              <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-line">{intern.description}</p>
                            </div>
                          )}
                        </div>
                      ))}

                      <div className="p-4 rounded-2xl border border-zinc-800/60 bg-zinc-900/20 space-y-3">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Add Internship</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <input type="text" placeholder="Role / Position *" value={tempIntern.role || ''} onChange={e => setTempIntern({ ...tempIntern, role: e.target.value })} className={miniInputCls} />
                          <input type="text" placeholder="Company *" value={tempIntern.company || ''} onChange={e => setTempIntern({ ...tempIntern, company: e.target.value })} className={miniInputCls} />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <input type="text" placeholder="Location" value={tempIntern.location || ''} onChange={e => setTempIntern({ ...tempIntern, location: e.target.value })} className={miniInputCls} />
                          <input type="text" placeholder="Start Date" value={tempIntern.startDate || ''} onChange={e => setTempIntern({ ...tempIntern, startDate: e.target.value })} className={miniInputCls} />
                          <input type="text" placeholder="End Date" value={tempIntern.endDate || ''} onChange={e => setTempIntern({ ...tempIntern, endDate: e.target.value })} className={miniInputCls} />
                        </div>
                        <input type="text" placeholder="Technologies Used (e.g. React, Python, AWS)" value={tempIntern.technologiesUsed || ''} onChange={e => setTempIntern({ ...tempIntern, technologiesUsed: e.target.value })} className={miniInputCls} />
                        <textarea placeholder="What you built/learned..." value={tempIntern.description || ''} onChange={e => setTempIntern({ ...tempIntern, description: e.target.value })} rows={3} className={`${miniInputCls} resize-none leading-relaxed`} />
                        <button onClick={addInternship} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2 rounded-xl text-xs transition cursor-pointer">Add Internship</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ═══ EDUCATION TAB ═══ */}
                {activeTab === 'education' && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 text-indigo-400" />
                      Education ({localProfile.education?.length || 0})
                    </h4>

                    {localProfile.education?.map(edu => (
                      <div key={edu.id} className="flex items-start justify-between gap-3 p-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-white text-sm">{edu.degree}</p>
                          <p className="text-zinc-400 text-xs mt-0.5">{edu.institution}{edu.location ? ` · ${edu.location}` : ''}</p>
                          <p className="text-[10px] text-zinc-600 font-semibold mt-1">{edu.startDate}{edu.endDate ? ` – ${edu.endDate}` : ''}{edu.gpa ? ` · ${formatEducationScore(edu)}` : ''}</p>
                          <label className="mt-2 flex max-w-48 items-center gap-2">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">Score Type</span>
                            <select
                              value={getEducationScoreType(edu)}
                              onChange={event => updateEducationScoreType(edu.id, event.target.value as EducationEntry['scoreType'])}
                              className="min-w-0 flex-1 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-[10px] font-semibold text-zinc-300 outline-none focus:border-indigo-500"
                            >
                              {EDUCATION_SCORE_TYPES.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <button onClick={() => removeEducation(edu.id)} className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/20 transition cursor-pointer shrink-0">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}

                    <div className="p-4 rounded-2xl border border-zinc-800/60 bg-zinc-900/20 space-y-3">
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Add Education</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input type="text" placeholder="Degree (e.g. B.S. Computer Science) *" value={tempEdu.degree || ''} onChange={e => setTempEdu({ ...tempEdu, degree: e.target.value })} className={miniInputCls} />
                        <input type="text" placeholder="Institution *" value={tempEdu.institution || ''} onChange={e => setTempEdu({ ...tempEdu, institution: e.target.value })} className={miniInputCls} />
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <input type="text" placeholder="Location" value={tempEdu.location || ''} onChange={e => setTempEdu({ ...tempEdu, location: e.target.value })} className={miniInputCls} />
                        <input type="text" placeholder="Start" value={tempEdu.startDate || ''} onChange={e => setTempEdu({ ...tempEdu, startDate: e.target.value })} className={miniInputCls} />
                        <input type="text" placeholder="End" value={tempEdu.endDate || ''} onChange={e => setTempEdu({ ...tempEdu, endDate: e.target.value })} className={miniInputCls} />
                        <label className="space-y-1">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Score Type</span>
                          <select
                            value={getEducationScoreType({ degree: tempEdu.degree || '', gpa: tempEdu.gpa || '', scoreType: tempEdu.scoreType })}
                            onChange={e => setTempEdu({ ...tempEdu, scoreType: e.target.value as EducationEntry['scoreType'] })}
                            className={miniInputCls}
                          >
                            {EDUCATION_SCORE_TYPES.map(option => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="space-y-1 md:col-span-2">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                            {getEducationScoreFieldLabel({ degree: tempEdu.degree || '', gpa: tempEdu.gpa || '', scoreType: tempEdu.scoreType })}
                          </span>
                          <input
                            type="text"
                            placeholder={getEducationScorePlaceholder({ degree: tempEdu.degree || '', gpa: tempEdu.gpa || '', scoreType: tempEdu.scoreType })}
                            value={tempEdu.gpa || ''}
                            onChange={e => setTempEdu({ ...tempEdu, gpa: e.target.value })}
                            className={miniInputCls}
                          />
                        </label>
                      </div>
                      <button onClick={addEducation} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2 rounded-xl text-xs transition cursor-pointer">Add Education</button>
                    </div>
                  </div>
                )}

                {/* ═══ SKILLS TAB ═══ */}
                {activeTab === 'skills' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Input side */}
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Category</label>
                          <select value={selectedSkillCat} onChange={e => setSelectedSkillCat(e.target.value as keyof SkillCategory)} className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-300 font-bold focus:border-indigo-500 outline-none cursor-pointer">
                            <option value="programmingLanguages">Programming Languages</option>
                            <option value="frameworks">Frameworks & Libraries</option>
                            <option value="tools">Tools, DevOps & Platforms</option>
                            <option value="databases">Databases & Query Engines</option>
                            <option value="softSkills">Soft Skills & Methodologies</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Skill Tag</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newSkillTag}
                              onChange={e => setNewSkillTag(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && addSkillTag()}
                              placeholder="e.g. Kubernetes"
                              className="flex-1 px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white focus:border-indigo-500 outline-none transition placeholder:text-zinc-600"
                            />
                            <button onClick={addSkillTag} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 rounded-xl cursor-pointer transition">
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* Languages */}
                        <div className="space-y-2 pt-4 border-t border-zinc-800/60">
                          <h5 className="text-xs font-bold text-zinc-400">Languages Spoken</h5>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newLang}
                              onChange={e => setNewLang(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && addLangTag()}
                              placeholder="e.g. Spanish (Fluent)"
                              className="flex-1 px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white focus:border-indigo-500 outline-none transition placeholder:text-zinc-600"
                            />
                            <button onClick={addLangTag} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 rounded-xl cursor-pointer transition">
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {localProfile.languages?.map(l => (
                              <span key={l} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-violet-950/30 text-violet-300 rounded-full border border-violet-900/40">
                                {l}
                                <button onClick={() => removeLangTag(l)} className="text-violet-500 hover:text-violet-200 cursor-pointer">×</button>
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Skills display */}
                      <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
                        {[
                          { key: 'programmingLanguages', label: 'Programming Languages', color: 'text-blue-400 bg-blue-950/20 border-blue-900/30' },
                          { key: 'frameworks', label: 'Frameworks & Libraries', color: 'text-emerald-400 bg-emerald-950/20 border-emerald-900/30' },
                          { key: 'tools', label: 'Tools & Platforms', color: 'text-orange-400 bg-orange-950/20 border-orange-900/30' },
                          { key: 'databases', label: 'Databases', color: 'text-cyan-400 bg-cyan-950/20 border-cyan-900/30' },
                          { key: 'softSkills', label: 'Soft Skills', color: 'text-pink-400 bg-pink-950/20 border-pink-900/30' },
                        ].map(cat => {
                          const list = localProfile.skills?.[cat.key as keyof SkillCategory] || [];
                          return (
                            <div key={cat.key} className="space-y-1.5">
                              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 block">{cat.label} ({list.length})</span>
                              {list.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {list.map(tag => (
                                    <span key={tag} className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-lg border ${cat.color}`}>
                                      {tag}
                                      <button onClick={() => removeSkillTag(cat.key as keyof SkillCategory, tag)} className="opacity-60 hover:opacity-100 cursor-pointer font-bold">×</button>
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[11px] text-zinc-600 italic">No skills in this category</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* ═══ PROJECTS TAB ═══ */}
                {activeTab === 'projects' && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-indigo-400" />
                      Projects ({localProfile.projects?.length || 0})
                    </h4>

                    {localProfile.projects?.map(proj => (
                      <div key={proj.id} className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30 flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-white text-sm">{proj.name}</p>
                          {proj.description && <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed line-clamp-2">{proj.description}</p>}
                          {proj.technologies && <p className="text-[10px] text-indigo-400 font-mono mt-1.5 truncate">{proj.technologies}</p>}
                          <div className="flex gap-3 mt-2">
                            {proj.github && <a href={proj.github} target="_blank" rel="noopener noreferrer" className="text-[10px] text-zinc-500 hover:text-white flex items-center gap-1 transition"><Github className="h-3 w-3" />GitHub</a>}
                            {proj.live && <a href={proj.live} target="_blank" rel="noopener noreferrer" className="text-[10px] text-zinc-500 hover:text-white flex items-center gap-1 transition"><ExternalLink className="h-3 w-3" />Live</a>}
                          </div>
                        </div>
                        <button onClick={() => removeProject(proj.id)} className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/20 transition cursor-pointer shrink-0">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}

                    <div className="p-4 rounded-2xl border border-zinc-800/60 bg-zinc-900/20 space-y-3">
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Add Project</p>
                      <input type="text" placeholder="Project Name *" value={tempProj.name || ''} onChange={e => setTempProj({ ...tempProj, name: e.target.value })} className={miniInputCls} />
                      <textarea placeholder="Brief description of what you built and its impact..." value={tempProj.description || ''} onChange={e => setTempProj({ ...tempProj, description: e.target.value })} rows={3} className={`${miniInputCls} resize-none leading-relaxed`} />
                      <input type="text" placeholder="Technologies (e.g. React, Node.js, PostgreSQL)" value={tempProj.technologies || ''} onChange={e => setTempProj({ ...tempProj, technologies: e.target.value })} className={miniInputCls} />
                      <div className="grid grid-cols-2 gap-3">
                        <input type="url" placeholder="GitHub URL" value={tempProj.github || ''} onChange={e => setTempProj({ ...tempProj, github: e.target.value })} className={miniInputCls} />
                        <input type="url" placeholder="Live URL" value={tempProj.live || ''} onChange={e => setTempProj({ ...tempProj, live: e.target.value })} className={miniInputCls} />
                      </div>
                      <button onClick={addProject} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2 rounded-xl text-xs transition cursor-pointer">Add Project</button>
                    </div>
                  </div>
                )}

                {/* ═══ ACHIEVEMENTS TAB ═══ */}
                {activeTab === 'achievements' && (
                  <div className="space-y-8">

                    {/* Certifications */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2"><Award className="h-4 w-4 text-amber-400" />Certifications ({localProfile.certifications?.length || 0})</h4>
                      {localProfile.certifications?.map(cert => (
                        <div key={cert.id} className="flex items-start justify-between gap-3 p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/30">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-white text-sm truncate">{cert.name}</p>
                            <p className="text-xs text-zinc-400 mt-0.5">{cert.issuer}{cert.date ? ` · ${cert.date}` : ''}</p>
                            {cert.url && <a href={cert.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1 mt-1"><ExternalLink className="h-3 w-3" />Verify</a>}
                          </div>
                          <button onClick={() => removeCert(cert.id)} className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/20 transition cursor-pointer shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      ))}
                      <div className="p-4 rounded-2xl border border-zinc-800/60 bg-zinc-900/20 space-y-3">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Add Certification</p>
                        <div className="grid grid-cols-2 gap-3">
                          <input type="text" placeholder="Certification Name *" value={tempCert.name || ''} onChange={e => setTempCert({ ...tempCert, name: e.target.value })} className={`${miniInputCls} col-span-2 md:col-span-1`} />
                          <input type="text" placeholder="Issuer *" value={tempCert.issuer || ''} onChange={e => setTempCert({ ...tempCert, issuer: e.target.value })} className={miniInputCls} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <input type="text" placeholder="Issue Date" value={tempCert.date || ''} onChange={e => setTempCert({ ...tempCert, date: e.target.value })} className={miniInputCls} />
                          <input type="url" placeholder="Verification URL" value={tempCert.url || ''} onChange={e => setTempCert({ ...tempCert, url: e.target.value })} className={miniInputCls} />
                        </div>
                        <button onClick={addCert} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2 rounded-xl text-xs transition cursor-pointer">Add Certification</button>
                      </div>
                    </div>

                    {/* Achievements */}
                    <div className="space-y-4 border-t border-zinc-800/60 pt-6">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2"><Trophy className="h-4 w-4 text-yellow-400" />Achievements ({localProfile.achievements?.length || 0})</h4>
                      {localProfile.achievements?.map((ach, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-3 rounded-xl border border-zinc-800 bg-zinc-900/30">
                          <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                          <p className="flex-1 text-sm text-zinc-300 leading-relaxed">{ach}</p>
                          <button onClick={() => removeAchievement(idx)} className="p-1.5 rounded-lg text-zinc-600 hover:text-rose-400 hover:bg-rose-950/20 transition cursor-pointer shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <input type="text" placeholder="e.g. Winner of Hack-the-North 2024..." value={tempAchievement} onChange={e => setTempAchievement(e.target.value)} onKeyDown={e => e.key === 'Enter' && addAchievement()} className="flex-1 px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white focus:border-indigo-500 outline-none transition placeholder:text-zinc-600" />
                        <button onClick={addAchievement} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 rounded-xl cursor-pointer transition"><Plus className="h-4 w-4" /></button>
                      </div>
                    </div>

                    {/* Custom Sections */}
                    <div className="space-y-4 border-t border-zinc-800/60 pt-6">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2"><Sparkles className="h-4 w-4 text-violet-400" />Custom Sections ({localProfile.customSections?.length || 0})</h4>

                      {localProfile.customSections?.map(section => (
                        <div key={section.id} className="rounded-xl border border-zinc-800 bg-zinc-900/20 overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-3 bg-zinc-800/30">
                            <span className="text-xs font-black uppercase tracking-wider text-violet-300">{section.title}</span>
                            <button onClick={() => removeCustomSection(section.id)} className="p-1 rounded text-zinc-600 hover:text-rose-400 transition cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                          <div className="p-4 space-y-2">
                            {section.items.map(item => (
                              <div key={item.id} className="flex items-start gap-2 text-xs">
                                <div className="flex-1">
                                  <span className="font-bold text-white">{item.title}</span>
                                  {item.subtitle && <span className="text-zinc-400"> · {item.subtitle}</span>}
                                  {item.date && <span className="text-zinc-600"> ({item.date})</span>}
                                  {item.description && <p className="text-zinc-500 mt-0.5 leading-relaxed">{item.description}</p>}
                                </div>
                                <button onClick={() => removeCustomItem(section.id, item.id)} className="text-zinc-600 hover:text-rose-400 transition cursor-pointer shrink-0"><Trash2 className="h-3 w-3" /></button>
                              </div>
                            ))}
                            {/* Add item form */}
                            <div className="space-y-2 pt-2 border-t border-zinc-800/40">
                              <input type="text" placeholder="Item Title *" value={tempCustomItem[section.id]?.title || ''} onChange={e => setTempCustomItem(prev => ({ ...prev, [section.id]: { ...prev[section.id], title: e.target.value } }))} className={miniInputCls} />
                              <div className="grid grid-cols-2 gap-2">
                                <input type="text" placeholder="Subtitle" value={tempCustomItem[section.id]?.subtitle || ''} onChange={e => setTempCustomItem(prev => ({ ...prev, [section.id]: { ...prev[section.id], subtitle: e.target.value } }))} className={miniInputCls} />
                                <input type="text" placeholder="Date" value={tempCustomItem[section.id]?.date || ''} onChange={e => setTempCustomItem(prev => ({ ...prev, [section.id]: { ...prev[section.id], date: e.target.value } }))} className={miniInputCls} />
                              </div>
                              <input type="text" placeholder="Description" value={tempCustomItem[section.id]?.description || ''} onChange={e => setTempCustomItem(prev => ({ ...prev, [section.id]: { ...prev[section.id], description: e.target.value } }))} className={miniInputCls} />
                              <button onClick={() => addCustomItem(section.id)} className="w-full py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white font-bold text-xs rounded-lg transition cursor-pointer">Add Item</button>
                            </div>
                          </div>
                        </div>
                      ))}

                      <div className="flex gap-2">
                        <input type="text" placeholder="New section title (e.g. Publications, Awards...)" value={newCustomSectionTitle} onChange={e => setNewCustomSectionTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCustomSection()} className="flex-1 px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white focus:border-indigo-500 outline-none transition placeholder:text-zinc-600" />
                        <button onClick={addCustomSection} className="bg-violet-700 hover:bg-violet-600 text-white font-bold px-4 rounded-xl cursor-pointer transition"><Plus className="h-4 w-4" /></button>
                      </div>
                    </div>
                  </div>
                )}

              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
