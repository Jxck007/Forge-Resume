import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { saveUserProfile, saveUserSettings } from '../services/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { ProfileData, EducationEntry, ExperienceEntry, CertificationEntry, SkillCategory } from '../types';
import ImageCropperModal from './ImageCropperModal';
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
  UserCheck,
  FileDown
} from 'lucide-react';

interface MyProfileProps {
  user: User;
  showToasts: (msg: string, type: 'success' | 'error' | 'info') => void;
  profile: ProfileData | null;
  onProfileUpdate: (profile: ProfileData) => void;
  dbConnected: boolean;
}

type ActiveSectionTab = 'personal' | 'professional' | 'skills' | 'history';

export default function MyProfile({ user, showToasts, profile, onProfileUpdate, dbConnected }: MyProfileProps) {
  const [loading, setLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<ActiveSectionTab>('personal');
  const [cropModalSrc, setCropModalSrc] = useState<string | null>(null);
  
  // Local profile states
  const [localProfile, setLocalProfile] = useState<ProfileData>({
    uid: user.uid,
    personalDetails: {
      fullName: '',
      professionalTitle: '',
      email: user.email || '',
      phone: '',
      location: '',
      linkedin: '',
      github: '',
      website: '',
      profilePhoto: '',
    },
    summary: '',
    education: [],
    experience: [],
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
    updatedAt: new Date().toISOString(),
  });

  // Avatar presets
  const avatarPresets = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80',
  ];

  // Temp form fields
  const [tempEdu, setTempEdu] = useState<Partial<EducationEntry>>({});
  const [tempExp, setTempExp] = useState<Partial<ExperienceEntry>>({});
  const [tempCert, setTempCert] = useState<Partial<CertificationEntry>>({});
  
  const [newSkillTag, setNewSkillTag] = useState('');
  const [selectedSkillCat, setSelectedSkillCat] = useState<keyof SkillCategory>('programmingLanguages');
  const [newLang, setNewLang] = useState('');

  // Fetch initial profile
  useEffect(() => {
    if (profile) {
      setLocalProfile(profile);
    } else {
      // Look up cached version on boot
      try {
        const cached = localStorage.getItem(`forge_profile_${user.uid}`);
        if (cached) {
          setLocalProfile(JSON.parse(cached));
        }
      } catch (err) {
        console.error('Failed reading profile cache on MyProfile boot', err);
      }
    }
  }, [profile, user.uid]);

  // Handle entire profile save
  const handleSaveProfile = async () => {
    if (!dbConnected) {
      showToasts('Cannot save profile while offline.', 'error');
      return;
    }
    if (!localProfile.personalDetails.fullName.trim() || !localProfile.personalDetails.fullName) {
      showToasts('Full Name is required for profile save and resume generation.', 'error');
      setActiveTab('personal');
      return;
    }
    setLoading(true);
    showToasts('Saving profile...', 'info');

    try {
      // Always cache locally first to protect from offline glitches
      localStorage.setItem(`forge_profile_${user.uid}`, JSON.stringify(localProfile));
      
      // Save profile to Firestore
      await saveUserProfile(user.uid, localProfile);
      onProfileUpdate(localProfile);

      // Save onboarding finished signpost in settings
      await saveUserSettings(user.uid, {
        hasCompletedProfile: true
      });
      
      showToasts('Profile saved successfully', 'success');
    } catch (err) {
      console.error('Firestore save connection failed, profile stored offline:', err);
      showToasts('Unable to save profile in Cloud, saved safely locally (Offline mode)!', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    if (!file.type.startsWith('image/')) {
      setUploadError("File is not a valid image.");
      return;
    }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      setCropModalSrc(reader.result as string);
    };
  };

  const handleCropComplete = (croppedBase64: string) => {
    updatePersonalField('profilePhoto', croppedBase64);
    setCropModalSrc(null);
    showToasts('Profile photo updated successfully.', 'success');
  };

  // Profile completion indicators
  const getCompletionStats = () => {
    let completedCount = 0;
    const totalChecks = 10;
    const missing: string[] = [];

    const { personalDetails, summary, skills, experience, education, certifications, languages } = localProfile;

    if (personalDetails?.fullName?.trim()) completedCount++; else missing.push('Full Name');
    if (personalDetails?.professionalTitle?.trim()) completedCount++; else missing.push('Professional Title');
    if (personalDetails?.phone?.trim()) completedCount++; else missing.push('Phone Number');
    if (personalDetails?.location?.trim()) completedCount++; else missing.push('Location / Address');
    if (personalDetails?.linkedin?.trim() || personalDetails?.github?.trim()) completedCount++; else missing.push('Social Links');
    if (personalDetails?.profilePhoto) completedCount++; else missing.push('Profile Photo');
    if (summary?.trim() && summary?.trim()?.length > 20) completedCount++; else missing.push('Professional Summary');
    
    const hasAnySkill = skills && Object.values(skills).some(arr => Array.isArray(arr) && arr.length > 0);
    if (hasAnySkill) completedCount++; else missing.push('At least one Skill tag');
    
    if (experience && experience.length > 0) completedCount++; else missing.push('Work Experience history');
    if (education && education.length > 0) completedCount++; else missing.push('Education history');

    const scorePercent = Math.round((completedCount / totalChecks) * 100);
    
    let level = 'Beginner';
    let levelColor = 'text-gray-400 border-gray-200 bg-gray-50';
    if (scorePercent >= 90) {
      level = 'ATS All-Star';
      levelColor = 'text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-950 bg-emerald-50 dark:bg-emerald-950/25';
    } else if (scorePercent >= 60) {
      level = 'Intermediate Professional';
      levelColor = 'text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/25';
    } else if (scorePercent >= 30) {
      level = 'Getting Started';
      levelColor = 'text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/25';
    }

    return { percent: scorePercent, missing, level, levelColor };
  };

  const { percent: completionProgress, missing: missingFields, level: careerLevel, levelColor: levelBadgeStyle } = getCompletionStats();

  // Action helpers to update states
  const updatePersonalField = (field: string, value: string) => {
    setLocalProfile(prev => ({
      ...prev,
      personalDetails: { ...prev.personalDetails, [field]: value }
    }));
  };

  const addSkillTag = () => {
    if (!newSkillTag.trim()) return;
    setLocalProfile(prev => ({
      ...prev,
      skills: {
        ...prev.skills,
        [selectedSkillCat]: [...new Set([...prev.skills[selectedSkillCat], newSkillTag.trim()])]
      }
    }));
    setNewSkillTag('');
  };

  const removeSkillTag = (cat: keyof SkillCategory, tag: string) => {
    setLocalProfile(prev => ({
      ...prev,
      skills: {
        ...prev.skills,
        [cat]: prev.skills[cat].filter(t => t !== tag)
      }
    }));
  };

  const addLangTag = () => {
    if (!newLang.trim()) return;
    setLocalProfile(prev => ({
      ...prev,
      languages: [...new Set([...prev.languages, newLang.trim()])]
    }));
    setNewLang('');
  };

  const removeLangTag = (lang: string) => {
    setLocalProfile(prev => ({
      ...prev,
      languages: prev.languages.filter(l => l !== lang)
    }));
  };

  const addEducation = () => {
    const { degree, institution, location, startDate, endDate, gpa, description } = tempEdu;
    if (!degree || !institution) {
      showToasts('Degree and Institution are required.', 'info');
      return;
    }
    const newEntry: EducationEntry = {
      id: Math.random().toString(36).substring(2, 9),
      degree: degree || '',
      institution: institution || '',
      location: location || '',
      startDate: startDate || '',
      endDate: endDate || '',
      gpa: gpa || '',
      description: description || ''
    };
    setLocalProfile(prev => ({
      ...prev,
      education: [...(prev.education || []), newEntry]
    }));
    setTempEdu({});
    showToasts('School record added to Profile card.', 'success');
  };

  const removeEducation = (id: string) => {
    setLocalProfile(prev => ({
      ...prev,
      education: prev.education.filter(e => e.id !== id)
    }));
  };

  const addExperience = () => {
    const { title, company, location, startDate, endDate, description } = tempExp;
    if (!title || !company) {
      showToasts('Job title and Company are required.', 'info');
      return;
    }
    const newEntry: ExperienceEntry = {
      id: Math.random().toString(36).substring(2, 9),
      title: title || '',
      company: company || '',
      location: location || '',
      startDate: startDate || '',
      endDate: endDate || '',
      description: description || ''
    };
    setLocalProfile(prev => ({
      ...prev,
      experience: [...(prev.experience || []), newEntry]
    }));
    setTempExp({});
    showToasts('Role experience added to Profile card.', 'success');
  };

  const removeExperience = (id: string) => {
    setLocalProfile(prev => ({
      ...prev,
      experience: prev.experience.filter(e => e.id !== id)
    }));
  };

  const addCert = () => {
    const { name, issuer, date, url } = tempCert;
    if (!name || !issuer) {
      showToasts('Certification Name and Issuer are required.', 'info');
      return;
    }
    const newEntry: CertificationEntry = {
      id: Math.random().toString(36).substring(2, 9),
      name: name || '',
      issuer: issuer || '',
      date: date || '',
      url: url || ''
    };
    setLocalProfile(prev => ({
      ...prev,
      certifications: [...(prev.certifications || []), newEntry]
    }));
    setTempCert({});
    showToasts('Credential registration added.', 'success');
  };

  const removeCert = (id: string) => {
    setLocalProfile(prev => ({
      ...prev,
      certifications: prev.certifications.filter(c => c.id !== id)
    }));
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {cropModalSrc && (
        <ImageCropperModal
          imageSrc={cropModalSrc}
          onClose={() => setCropModalSrc(null)}
          onCropComplete={handleCropComplete}
        />
      )}
      {/* cover header */}
      <div className="relative mb-8 overflow-hidden rounded-3xl border border-gray-205 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-xs leading-none">
        <div className="h-32 sm:h-44 bg-gradient-to-r from-zinc-900 to-indigo-950 relative">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
          <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider border shadow-xs ${levelBadgeStyle}`}>
              <Star className="h-3.5 w-3.5" />
              <span>{careerLevel}</span>
            </span>
          </div>
        </div>

        <div className="px-6 pb-6 pt-0 sm:px-8 sm:pb-8 flex flex-col md:flex-row md:items-end gap-6 relative">
          {/* Avatar frame */}
          <div className="relative -mt-16 sm:-mt-22 h-28 w-28 sm:h-36 sm:w-36 rounded-2xl bg-white dark:bg-zinc-90 w-full p-1.5 shadow-md border border-gray-200 dark:border-zinc-800 shrink-0 group">
            <img
              src={localProfile.personalDetails?.profilePhoto || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
              alt="Profile Face"
              className="h-full w-full object-cover rounded-xl"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Name Bio */}
          <div className="flex-1 space-y-2 mt-2 leading-normal">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-black text-gray-950 dark:text-zinc-50 leading-tight">
                  {localProfile.personalDetails?.fullName || 'Full Name'}
                </h1>
                <p className="text-sm font-bold text-indigo-500 dark:text-indigo-450 mt-1">
                  {localProfile.personalDetails?.professionalTitle || 'No professional title set'}
                </p>
                <div className="flex items-center gap-4 text-xs font-medium text-gray-400 mt-2">
                  <span className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" />
                    <span>{localProfile.personalDetails?.email}</span>
                  </span>
                  {localProfile.personalDetails?.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{localProfile.personalDetails?.location}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Sync controls */}
              <button
                onClick={handleSaveProfile}
                disabled={loading}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl shadow-xs transition hover:scale-[1.01] active:scale-99 cursor-pointer self-start sm:self-auto shrink-0"
                id="btn-profile-sync"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Sync Profile</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 leading-normal">
        {/* Left Column: checklist and direct upload */}
        <div className="lg:col-span-4 space-y-6">
          {/* Progress Ring Card */}
          <div className="rounded-3xl border border-zinc-200/80 dark:border-zinc-800/85 bg-white dark:bg-zinc-900/25 p-6 shadow-xs">
            <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-indigo-505" />
              <span>All-Star Completion Status</span>
            </h3>
            
            <div className="flex items-center gap-4 mb-6">
              <div className="relative h-16 w-16 flex items-center justify-center rounded-full border-4 border-indigo-100 dark:border-indigo-950 bg-indigo-50/10 dark:bg-indigo-950/5 shrink-0 font-extrabold text-indigo-600 dark:text-indigo-400 text-lg">
                <span>{completionProgress}%</span>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Completed Index</p>
                <div className="h-2 w-48 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-505 transition-all duration-500" style={{ width: `${completionProgress}%` }} />
                </div>
              </div>
            </div>

            {/* Completion hints */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide">Missing Core Fields ({missingFields.length})</p>
              {missingFields.length > 0 ? (
                <div className="space-y-1.5 max-h-[148px] overflow-y-auto pr-1">
                  {missingFields.map((field, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs font-semibold text-rose-500 dark:text-rose-451 bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100/50 dark:border-rose-950/20 px-3 py-1.5 rounded-xl">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>{field}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100/50 dark:border-emerald-900/50 px-3 py-1.5 rounded-xl">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Resume profile ready to score big!</span>
                </div>
              )}
            </div>
          </div>

          {/* Drag & Drop Photo Upload area */}
          <div className="rounded-3xl border border-zinc-200/80 dark:border-zinc-800/85 bg-white dark:bg-zinc-900/25 p-6 shadow-xs space-y-4">
            <h4 className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              <FileImage className="h-4 w-4 text-violet-500" />
              <span>Profile Image Loader</span>
            </h4>

            {/* Custom Photo Upload Area */}
            <div className="rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20 p-4 transition hover:bg-zinc-50 dark:hover:bg-zinc-950/50 relative">
              <label className="flex flex-col items-center justify-center gap-2 cursor-pointer py-2">
                <FileDown className="h-6 w-6 text-indigo-500" />
                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">File Image Upload</span>
                <span className="text-[10px] text-zinc-400">PNG / JPG up to 5MB</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handlePhotoUpload} 
                />
              </label>
              {localProfile.personalDetails?.profilePhoto && (
                <div className="mt-3 flex items-center justify-between bg-white dark:bg-[#121214] p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Active custom image</span>
                  </span>
                  <button 
                    onClick={() => updatePersonalField('profilePhoto', '')}
                    className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer"
                  >
                    Remove Photo
                  </button>
                </div>
              )}
            </div>

            {uploadError && (
              <p className="text-xs font-semibold text-rose-500 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg">
                {uploadError}
              </p>
            )}

            {/* Quick Photo presets */}
            <div className="space-y-2 pt-2 border-t border-zinc-200/50 dark:border-zinc-800/50">
              <span className="text-[10px] font-bold text-zinc-400 uppercase">Select Preset Avatar</span>
              <div className="flex items-center gap-2.5">
                {avatarPresets.map((preset, i) => (
                  <button
                    key={i}
                    onClick={() => updatePersonalField('profilePhoto', preset)}
                    className={`h-9 w-9 rounded-xl overflow-hidden hover:scale-110 active:scale-95 transition border-2 ${
                      localProfile.personalDetails?.profilePhoto === preset ? 'border-indigo-500 shadow-md ring-4 ring-indigo-500/15' : 'border-transparent'
                    }`}
                  >
                    <img src={preset} alt="preset" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Profile tabs */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto no-scrollbar gap-1" id="profile-subtabs">
            {[
              { id: 'personal', label: 'Primary Bio', icon: UserIcon },
              { id: 'professional', label: 'Summary', icon: Sparkles },
              { id: 'skills', label: 'Skills Grid', icon: Star },
              { id: 'history', label: 'Education & Career', icon: Briefcase },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as ActiveSectionTab)}
                  className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition whitespace-nowrap cursor-pointer ${
                    isActive ? 'border-indigo-505 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="bg-white dark:bg-zinc-900/25 p-6 border border-zinc-200/80 dark:border-zinc-800/85 rounded-3xl min-h-[400px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                {/* PERSONAL INFO TAB */}
                {activeTab === 'personal' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Full Name *</label>
                        <input
                          type="text"
                          value={localProfile.personalDetails?.fullName || ''}
                          onChange={e => updatePersonalField('fullName', e.target.value)}
                          placeholder="Elizabeth Holmes"
                          className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950/20 border border-zinc-200/80 dark:border-zinc-800 rounded-xl focus:border-indigo-500 outline-none transition text-sm dark:text-white"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Professional Target Title</label>
                        <input
                          type="text"
                          value={localProfile.personalDetails?.professionalTitle || ''}
                          onChange={e => updatePersonalField('professionalTitle', e.target.value)}
                          placeholder="e.g. Lead Devops Architect"
                          className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950/20 border border-zinc-200/80 dark:border-zinc-800 rounded-xl focus:border-indigo-500 outline-none transition text-sm dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Contact Email Address</label>
                        <input
                          type="email"
                          disabled
                          value={localProfile.personalDetails?.email || ''}
                          className="w-full px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-800 rounded-xl outline-none text-sm text-gray-400 dark:text-gray-500 cursor-not-allowed"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Phone Number</label>
                        <input
                          type="tel"
                          value={localProfile.personalDetails?.phone || ''}
                          onChange={e => updatePersonalField('phone', e.target.value)}
                          placeholder="+1 (555) 750-0192"
                          className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950/20 border border-zinc-200/80 dark:border-zinc-800 rounded-xl focus:border-indigo-500 outline-none transition text-sm dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Office / Base Location</label>
                      <input
                        type="text"
                        value={localProfile.personalDetails?.location || ''}
                        onChange={e => updatePersonalField('location', e.target.value)}
                        placeholder="Zurich, Switzerland"
                        className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950/20 border border-zinc-200/80 dark:border-zinc-800 rounded-xl focus:border-indigo-500 outline-none transition text-sm dark:text-white"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-zinc-200/50 dark:border-zinc-805/50 pt-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1 flex items-center gap-1">
                          <Linkedin className="h-3 w-3 text-indigo-400" />
                          <span>Linkedin URL</span>
                        </label>
                        <input
                          type="url"
                          value={localProfile.personalDetails?.linkedin || ''}
                          onChange={e => updatePersonalField('linkedin', e.target.value)}
                          placeholder="linkedin.com/in/username"
                          className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950/20 border border-zinc-200/80 dark:border-zinc-800 rounded-xl focus:border-indigo-500 outline-none transition text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1 flex items-center gap-1">
                          <Github className="h-3 w-3 text-gray-400" />
                          <span>Github Repository</span>
                        </label>
                        <input
                          type="url"
                          value={localProfile.personalDetails?.github || ''}
                          onChange={e => updatePersonalField('github', e.target.value)}
                          placeholder="github.com/username"
                          className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950/20 border border-zinc-200/80 dark:border-zinc-800 rounded-xl focus:border-indigo-500 outline-none transition text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1 flex items-center gap-1">
                          <Globe className="h-3 w-3 text-indigo-400" />
                          <span>Portfolio / Website</span>
                        </label>
                        <input
                          type="url"
                          value={localProfile.personalDetails?.website || ''}
                          onChange={e => updatePersonalField('website', e.target.value)}
                          placeholder="elizabethholmes.dev"
                          className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-955/20 border border-zinc-200/80 dark:border-zinc-800 rounded-xl focus:border-indigo-500 outline-none transition text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* PROFILE SUMMARY TAB */}
                {activeTab === 'professional' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white">Profile Summary</h4>
                        <p className="text-xs text-gray-400 mt-0.5">Write a compelling professional summary that grabs recruiter attention.</p>
                      </div>
                      <span className="text-[10px] font-bold text-gray-400 bg-zinc-50 dark:bg-zinc-950 px-2 py-1 rounded-md">
                        {localProfile.summary?.length || 0} characters
                      </span>
                    </div>

                    <textarea
                      value={localProfile.summary || ''}
                      onChange={e => setLocalProfile(p => ({ ...p, summary: e.target.value }))}
                      placeholder="e.g., Driven senior systems consultant in cloud operations with 8+ years executing high value infrastructure relocations..."
                      rows={10}
                      className="w-full p-4 bg-zinc-50 dark:bg-zinc-950/20 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl focus:border-indigo-505 outline-none transition leading-relaxed text-sm dark:text-white font-serif"
                    />
                  </div>
                )}

                {/* SKILLS MATRIX TAB */}
                {activeTab === 'skills' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 leading-none">
                      {/* Left: input tool */}
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Skill Category</label>
                          <select
                            value={selectedSkillCat}
                            onChange={e => setSelectedSkillCat(e.target.value as keyof SkillCategory)}
                            className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-805 rounded-xl focus:border-indigo-500 text-xs text-zinc-700 dark:text-zinc-300 font-bold"
                          >
                            <option value="programmingLanguages">Programming Languages / Syntax</option>
                            <option value="frameworks">Frameworks & Libraries</option>
                            <option value="tools">Tools, Devops & Platforms</option>
                            <option value="databases">Databases & Query engines</option>
                            <option value="softSkills">Soft Skills & Methodologies</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Skill Label Tag</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newSkillTag}
                              onChange={e => setNewSkillTag(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' ? addSkillTag() : null}
                              placeholder="e.g. Kubernetes"
                              className="flex-1 px-4 py-2 bg-zinc-50 dark:bg-zinc-955/20 border border-zinc-220 dark:border-zinc-800 rounded-xl focus:border-indigo-500 outline-none transition text-sm text-zinc-900 dark:text-zinc-100"
                            />
                            <button
                              onClick={addSkillTag}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 rounded-xl flex items-center justify-center shrink-0 cursor-pointer"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* Languages list panel too */}
                        <div className="border-t border-zinc-100 dark:border-zinc-800/60 pt-4 space-y-3 leading-normal">
                          <div>
                            <h4 className="text-xs font-black uppercase tracking-wider text-gray-400">Communication Languages</h4>
                            <p className="text-[11px] text-gray-400 mt-0.5">Languages we can speak or write fluently</p>
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newLang}
                              onChange={e => setNewLang(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' ? addLangTag() : null}
                              placeholder="e.g. French (Fluent)"
                              className="flex-1 px-4 py-2 bg-zinc-50 dark:bg-zinc-950/20 border border-zinc-210 dark:border-zinc-800 rounded-xl focus:border-indigo-500 outline-none transition text-sm text-zinc-900 dark:text-zinc-100"
                            />
                            <button
                              onClick={addLangTag}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 rounded-xl flex items-center justify-center shrink-0 cursor-pointer"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {Array.isArray(localProfile.languages) && localProfile.languages.map(l => (
                              <span key={l} className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-violet-50 dark:bg-violet-950/25 text-violet-700 dark:text-violet-300 rounded-full border border-violet-100/50 dark:border-violet-900/50">
                                <span>{l}</span>
                                <button onClick={() => removeLangTag(l)} className="text-violet-400 hover:text-violet-600">×</button>
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Right: Category list display */}
                      <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1 leading-normal">
                        {[
                          { key: 'programmingLanguages', label: 'Programming Languages' },
                          { key: 'frameworks', label: 'Frameworks & Libraries' },
                          { key: 'tools', label: 'Tools, Platforms & Devops' },
                          { key: 'databases', label: 'Data Management & Databases' },
                          { key: 'softSkills', label: 'Soft Skills' }
                        ].map(category => {
                          const list = localProfile.skills?.[category.key as keyof SkillCategory] || [];
                          return (
                            <div key={category.key} className="space-y-1.5">
                              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-500 font-mono block">
                                {category.label} ({list.length})
                              </span>
                              {list.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {list.map(tag => (
                                    <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-zinc-50 dark:bg-zinc-950 text-gray-700 dark:text-gray-300 rounded-lg border border-zinc-200 dark:border-zinc-805">
                                      <span>{tag}</span>
                                      <button onClick={() => removeSkillTag(category.key as keyof SkillCategory, tag)} className="text-gray-400 hover:text-rose-600 font-bold ml-0.5">×</button>
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[11px] text-gray-400 italic">No skills registered in this stack</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* HISTORY: EDUCATION & EXPERIENCE */}
                {activeTab === 'history' && (
                  <div className="space-y-8 leading-normal">
                    {/* Education Matrix */}
                    <div className="space-y-4 border-b border-zinc-200 dark:border-zinc-800/60 pb-6">
                      <div className="flex items-center gap-2">
                        <GraduationCap className="h-5 w-5 text-indigo-510" />
                        <h4 className="text-base font-bold text-zinc-900 dark:text-white">Academia & Education History ({localProfile.education?.length || 0})</h4>
                      </div>

                      {/* Existing */}
                      {Array.isArray(localProfile.education) && localProfile.education.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {localProfile.education.map(edu => (
                            <div key={edu.id} className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-950/20 flex items-start justify-between gap-3 text-xs leading-normal">
                              <div>
                                <p className="font-bold text-zinc-900 dark:text-zinc-50">{edu.degree}</p>
                                <p className="text-zinc-550 dark:text-zinc-400 font-medium">{edu.institution} • {edu.location}</p>
                                <p className="text-[10px] text-zinc-400 font-semibold mt-1">{edu.startDate} - {edu.endDate} {edu.gpa ? `| GPA: ${edu.gpa}` : ''}</p>
                              </div>
                              <button
                                onClick={() => removeEducation(edu.id)}
                                className="h-7 w-7 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 text-gray-400 hover:text-rose-500 transition flex items-center justify-center shrink-0 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add school form */}
                      <div className="p-4 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/20 dark:bg-zinc-950/10 space-y-4">
                        <p className="text-xs font-bold text-gray-455 uppercase tracking-widest">Register New Academic Entry</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <input
                            type="text"
                            placeholder="University Degree (e.g., M.S. Bioinformatics)"
                            value={tempEdu.degree || ''}
                            onChange={e => setTempEdu({ ...tempEdu, degree: e.target.value })}
                            className="px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-zinc-100"
                          />
                          <input
                            type="text"
                            placeholder="Institution / Academy (e.g., Stanford University)"
                            value={tempEdu.institution || ''}
                            onChange={e => setTempEdu({ ...tempEdu, institution: e.target.value })}
                            className="px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-zinc-100"
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          <input
                            type="text"
                            placeholder="Location (Zurich, SW)"
                            value={tempEdu.location || ''}
                            onChange={e => setTempEdu({ ...tempEdu, location: e.target.value })}
                            className="px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-zinc-100"
                          />
                          <input
                            type="text"
                            placeholder="Start Date"
                            value={tempEdu.startDate || ''}
                            onChange={e => setTempEdu({ ...tempEdu, startDate: e.target.value })}
                            className="px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-zinc-100"
                          />
                          <input
                            type="text"
                            placeholder="End Date"
                            value={tempEdu.endDate || ''}
                            onChange={e => setTempEdu({ ...tempEdu, endDate: e.target.value })}
                            className="px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-zinc-100"
                          />
                          <input
                            type="text"
                            placeholder="GPA (4.0 / 4.0)"
                            value={tempEdu.gpa || ''}
                            onChange={e => setTempEdu({ ...tempEdu, gpa: e.target.value })}
                            className="px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-zinc-100"
                          />
                        </div>
                        <button
                          onClick={addEducation}
                          className="w-full bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-950 text-white font-bold py-2 px-4 rounded-xl text-xs hover:bg-zinc-800 transition cursor-pointer"
                        >
                          Add Academic History Entry
                        </button>
                      </div>
                    </div>

                    {/* Professional Experience Matrix */}
                    <div className="space-y-4 border-b border-zinc-200 dark:border-zinc-800/60 pb-6">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-5 w-5 text-indigo-510" />
                        <h4 className="text-base font-bold text-zinc-900 dark:text-white">Professional Career History ({localProfile.experience?.length || 0})</h4>
                      </div>

                      {/* Existing */}
                      {Array.isArray(localProfile.experience) && localProfile.experience.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {localProfile.experience.map(exp => (
                            <div key={exp.id} className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-950/20 flex items-start justify-between gap-3 text-xs leading-normal">
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-zinc-900 dark:text-zinc-50 truncate">{exp.title}</p>
                                <p className="text-zinc-550 dark:text-zinc-400 font-medium truncate">{exp.company} • {exp.location}</p>
                                <p className="text-[10px] text-zinc-400 font-semibold mt-1">{exp.startDate} - {exp.endDate}</p>
                              </div>
                              <button
                                onClick={() => removeExperience(exp.id)}
                                className="h-7 w-7 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 text-gray-400 hover:text-rose-500 transition flex items-center justify-center shrink-0 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add experience form */}
                      <div className="p-4 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/20 dark:bg-zinc-955/10 space-y-4">
                        <p className="text-xs font-bold text-zinc-455 uppercase tracking-widest">Register Career Record</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <input
                            type="text"
                            placeholder="Target Role (e.g. Lead Engineer)"
                            value={tempExp.title || ''}
                            onChange={e => setTempExp({ ...tempExp, title: e.target.value })}
                            className="px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-zinc-100"
                          />
                          <input
                            type="text"
                            placeholder="Employer Company (e.g. Google Cloud)"
                            value={tempExp.company || ''}
                            onChange={e => setTempExp({ ...tempExp, company: e.target.value })}
                            className="px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-zinc-100"
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <input
                            type="text"
                            placeholder="Location (Zurich, SW)"
                            value={tempExp.location || ''}
                            onChange={e => setTempExp({ ...tempExp, location: e.target.value })}
                            className="px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-zinc-100"
                          />
                          <input
                            type="text"
                            placeholder="Start Date"
                            value={tempExp.startDate || ''}
                            onChange={e => setTempExp({ ...tempExp, startDate: e.target.value })}
                            className="px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-zinc-100"
                          />
                          <input
                            type="text"
                            placeholder="End Date (e.g., Present)"
                            value={tempExp.endDate || ''}
                            onChange={e => setTempExp({ ...tempExp, endDate: e.target.value })}
                            className="px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-zinc-100"
                          />
                        </div>
                        <input
                          type="text"
                          placeholder="Describe responsibilities and accomplishments in this role..."
                          value={tempExp.description || ''}
                          onChange={e => setTempExp({ ...tempExp, description: e.target.value })}
                          className="w-full px-3 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-zinc-100"
                        />
                        <button
                          onClick={addExperience}
                          className="w-full bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-950 text-white font-bold py-2 px-4 rounded-xl text-xs hover:bg-zinc-800 transition cursor-pointer"
                        >
                          Add Experience History Entry
                        </button>
                      </div>
                    </div>

                    {/* Certifications Matrix */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Award className="h-5 w-5 text-indigo-510" />
                        <h4 className="text-base font-bold text-zinc-900 dark:text-white">Professional Certifications ({localProfile.certifications?.length || 0})</h4>
                      </div>

                      {/* Existing */}
                      {Array.isArray(localProfile.certifications) && localProfile.certifications.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {localProfile.certifications.map(cert => (
                            <div key={cert.id} className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800/85 bg-zinc-50/50 dark:bg-zinc-950/20 flex items-start justify-between gap-3 text-xs leading-normal">
                              <div>
                                <p className="font-bold text-zinc-900 dark:text-zinc-50">{cert.name}</p>
                                <p className="text-zinc-500 dark:text-zinc-400 font-medium">{cert.issuer} • {cert.date}</p>
                              </div>
                              <button
                                onClick={() => removeCert(cert.id)}
                                className="h-7 w-7 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 text-gray-400 hover:text-rose-505 transition flex items-center justify-center shrink-0 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add certification form */}
                      <div className="p-4 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/20 dark:bg-zinc-955/10 space-y-4">
                        <p className="text-xs font-bold text-zinc-455 uppercase tracking-widest">Register Credential / Certification</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <input
                            type="text"
                            placeholder="Credential Designate (AWS Architect)"
                            value={tempCert.name || ''}
                            onChange={e => setTempCert({ ...tempCert, name: e.target.value })}
                            className="px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-zinc-100 col-span-2"
                          />
                          <input
                            type="text"
                            placeholder="Accredited Issuer (Amazon)"
                            value={tempCert.issuer || ''}
                            onChange={e => setTempCert({ ...tempCert, issuer: e.target.value })}
                            className="px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-905 dark:text-zinc-100"
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <input
                            type="text"
                            placeholder="Date of issue (June 2026)"
                            value={tempCert.date || ''}
                            onChange={e => setTempCert({ ...tempCert, date: e.target.value })}
                            className="px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-905 dark:text-zinc-100"
                          />
                          <input
                            type="url"
                            placeholder="Verification URL (Credential link)"
                            value={tempCert.url || ''}
                            onChange={e => setTempCert({ ...tempCert, url: e.target.value })}
                            className="px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-905 dark:text-zinc-100"
                          />
                        </div>
                        <button
                          onClick={addCert}
                          className="w-full bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-950 text-white font-bold py-2 px-4 rounded-xl text-xs hover:bg-zinc-800 transition cursor-pointer"
                        >
                          Add Certification History Entry
                        </button>
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
