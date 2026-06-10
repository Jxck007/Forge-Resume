import React, { useState } from 'react';
import { ProfileData, PersonalDetails, SkillCategory } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import ImageCropperModal from './ImageCropperModal';
import { 
  User, 
  MapPin, 
  Mail, 
  Phone, 
  Linkedin, 
  Github, 
  Globe, 
  Briefcase, 
  GraduationCap, 
  Trophy, 
  Type,
  Layout,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Sparkles,
  Award,
  Zap
} from 'lucide-react';

interface ProfileSetupProps {
  onComplete: (profile: ProfileData) => void;
  userEmail: string;
  dbConnected: boolean;
}

type SetupStep = 'personal' | 'professional' | 'skills' | 'finish';

export default function ProfileSetup({ onComplete, userEmail, dbConnected }: ProfileSetupProps) {
  const [step, setStep] = useState<SetupStep>('personal');
  
  const [personalDetails, setPersonalDetails] = useState<PersonalDetails>({
    fullName: '',
    professionalTitle: '',
    email: userEmail,
    phone: '',
    location: '',
    linkedin: '',
    github: '',
    website: '',
  });

  const [summary, setSummary] = useState('');
  
  const [skills, setSkills] = useState<SkillCategory>({
    programmingLanguages: [],
    frameworks: [],
    tools: [],
    databases: [],
    softSkills: [],
  });

  const steps: { id: SetupStep; label: string; icon: any }[] = [
    { id: 'personal', label: 'Personal Details', icon: User },
    { id: 'professional', label: 'Professional Summary', icon: Briefcase },
    { id: 'skills', label: 'Core Skills', icon: Zap },
    { id: 'finish', label: 'Finish Account', icon: CheckCircle2 },
  ];

  const handleNext = () => {
    if (step === 'personal') setStep('professional');
    else if (step === 'professional') setStep('skills');
    else if (step === 'skills') setStep('finish');
  };

  const handleBack = () => {
    if (step === 'professional') setStep('personal');
    else if (step === 'skills') setStep('professional');
    else if (step === 'finish') setStep('skills');
  };

  const handleSubmit = () => {
    const profile: ProfileData = {
      uid: '', // filled by service
      personalDetails,
      summary,
      education: [],
      experience: [],
      projects: [],
      skills,
      certifications: [],
      achievements: [],
      volunteering: [],
      languages: [],
      updatedAt: new Date().toISOString(),
    };
    onComplete(profile);
  };

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [cropModalSrc, setCropModalSrc] = useState<string | null>(null);

  const handlePhotoUploadOnboard = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    setPersonalDetails(prev => ({ ...prev, profilePhoto: croppedBase64 }));
    setCropModalSrc(null);
  };

  const renderPersonal = () => (
    <div className="space-y-6">
      {/* Photo Loader Container */}
      <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-150 dark:border-zinc-800">
        <div className="h-16 w-16 rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shrink-0 relative group">
          {personalDetails.profilePhoto ? (
            <img src={personalDetails.profilePhoto} alt="Upload-Preview" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-zinc-400 dark:text-zinc-500 font-bold text-xs uppercase text-center bg-zinc-50 dark:bg-zinc-900">
              Face
            </div>
          )}
        </div>
        <div className="flex-1 text-center sm:text-left space-y-2">
          <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Set Profile Avatar / Photo</p>
          <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
            <label className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-105 px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-700 dark:text-white cursor-pointer transition shadow-xs">
              <span>Upload Image File</span>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUploadOnboard} />
            </label>
            {personalDetails.profilePhoto && (
              <button
                type="button"
                onClick={() => setPersonalDetails(prev => ({ ...prev, profilePhoto: '' }))}
                className="text-xs font-bold text-rose-500 border border-rose-500/10 hover:bg-rose-500/5 px-3 py-1.5 rounded-lg transition"
              >
                Remove
              </button>
            )}
          </div>
          {uploadError && <p className="text-[10px] text-rose-500 font-semibold">{uploadError}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Full Name *</label>
          <div className="relative group">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
            <input
              type="text"
              value={personalDetails.fullName}
              onChange={e => setPersonalDetails({ ...personalDetails, fullName: e.target.value })}
              placeholder="Elon Musk"
              className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all dark:text-white"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Professional Title</label>
          <div className="relative group">
            <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
            <input
              type="text"
              value={personalDetails.professionalTitle}
              onChange={e => setPersonalDetails({ ...personalDetails, professionalTitle: e.target.value })}
              placeholder="Senior Software Engineer"
              className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all dark:text-white"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Email *</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="email"
              disabled
              value={personalDetails.email}
              className="w-full pl-11 pr-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-150 dark:border-gray-700 rounded-xl outline-none dark:text-gray-400 cursor-not-allowed"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Phone Number</label>
          <div className="relative group">
            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
            <input
              type="tel"
              value={personalDetails.phone}
              onChange={e => setPersonalDetails({ ...personalDetails, phone: e.target.value })}
              placeholder="+1 (555) 000-0000"
              className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all dark:text-white"
            />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Location</label>
        <div className="relative group">
          <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
          <input
            type="text"
            value={personalDetails.location}
            onChange={e => setPersonalDetails({ ...personalDetails, location: e.target.value })}
            placeholder="San Francisco, CA"
            className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all dark:text-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative group">
          <Linkedin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
          <input
            type="text"
            value={personalDetails.linkedin}
            onChange={e => setPersonalDetails({ ...personalDetails, linkedin: e.target.value })}
            placeholder="linkedin.com/in/username"
            className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-xl focus:border-indigo-500 outline-none transition-all dark:text-white"
          />
        </div>
        <div className="relative group">
          <Github className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
          <input
            type="text"
            value={personalDetails.github}
            onChange={e => setPersonalDetails({ ...personalDetails, github: e.target.value })}
            placeholder="github.com/username"
            className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-xl focus:border-indigo-500 outline-none transition-all dark:text-white"
          />
        </div>
      </div>
    </div>
  );

  const renderProfessional = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Professional Summary</label>
        <p className="text-sm text-gray-400 ml-1">A short overview of your professional career and aspirations.</p>
        <textarea
          value={summary}
          onChange={e => setSummary(e.target.value)}
          placeholder="I am a highly motivated software engineer with 5+ years of experience in building scalable web applications..."
          rows={8}
          className="w-full p-5 bg-gray-50 dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all dark:text-white font-serif leading-relaxed text-lg"
        />
      </div>
    </div>
  );

  const handleAddField = (category: keyof SkillCategory, value: string) => {
    if (!value) return;
    setSkills(prev => ({
      ...prev,
      [category]: [...new Set([...prev[category], value])]
    }));
  };

  const removeField = (category: keyof SkillCategory, value: string) => {
    setSkills(prev => ({
      ...prev,
      [category]: prev[category].filter(v => v !== value)
    }));
  };

  const renderSkills = () => (
    <div className="space-y-8">
      {[
        { key: 'programmingLanguages', label: 'Languages', placeholder: 'TypeScript, Python, C++' },
        { key: 'frameworks', label: 'Frameworks', placeholder: 'React, Node.js, Django' },
        { key: 'softSkills', label: 'Soft Skills', placeholder: 'Leadership, Communication' }
      ].map(cat => (
        <div key={cat.key} className="space-y-3">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">{cat.label}</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {(skills[cat.key as keyof SkillCategory] as string[]).map(s => (
              <span key={s} className="px-3 py-1 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 rounded-lg text-sm border border-indigo-100 dark:border-indigo-900 flex items-center gap-2">
                {s}
                <button onClick={() => removeField(cat.key as keyof SkillCategory, s)} className="hover:text-indigo-900 text-indigo-400">×</button>
              </span>
            ))}
          </div>
          <input
            type="text"
            onKeyDown={e => {
              if (e.key === 'Enter') {
                handleAddField(cat.key as keyof SkillCategory, e.currentTarget.value);
                e.currentTarget.value = '';
              }
            }}
            placeholder={`Add ${cat.label.toLowerCase()}... (Press Enter)`}
            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-xl focus:border-indigo-500 outline-none transition-all dark:text-white text-sm"
          />
        </div>
      ))}
    </div>
  );

  const renderFinish = () => (
    <div className="text-center py-12 space-y-6">
      <div className="inline-flex items-center justify-center h-24 w-24 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border-8 border-emerald-100 dark:border-emerald-900/50 text-emerald-500 mb-4 animate-bounce">
        <CheckCircle2 className="h-10 w-10" />
      </div>
      <div className="space-y-2">
        <h3 className="text-2xl font-black dark:text-white">Profile Ready!</h3>
        <p className="max-w-xs mx-auto text-gray-500 dark:text-gray-400">
          Your base information is saved. We'll use this to pre-fill all future resumes you create.
        </p>
      </div>
      <div className="pt-4">
        <button
          onClick={handleSubmit}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-10 rounded-2xl shadow-xl shadow-indigo-500/25 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <span>Get Started</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 sm:p-12 relative overflow-hidden">
      {cropModalSrc && (
        <ImageCropperModal
          imageSrc={cropModalSrc}
          onClose={() => setCropModalSrc(null)}
          onCropComplete={handleCropComplete}
        />
      )}
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 blur-[120px] rounded-full -mr-48 -mt-48" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/5 blur-[120px] rounded-full -ml-48 -mb-48" />

      <div className="w-full max-w-2xl relative z-10">
        <div className="text-center mb-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest border border-indigo-100 dark:border-indigo-900 mb-2">
            <Sparkles className="h-3 w-3" />
            <span>Smart Onboarding</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white">Complete Your Profile</h1>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">Set up your professional identity once, build unlimited resumes in seconds.</p>
        </div>

        {/* Multi-step progress indicator */}
        <div className="mb-10 flex items-center justify-between px-2">
          {steps.map((s, idx) => {
            const Icon = s.icon;
            const isActive = step === s.id;
            const isCompleted = steps.findIndex(x => x.id === step) > idx;

            return (
              <React.Fragment key={s.id}>
                <div className="flex flex-col items-center gap-2 group cursor-pointer" onClick={() => (isCompleted ? setStep(s.id) : null)}>
                  <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-2xl flex items-center justify-center transition-all border-2 ${
                    isActive ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/30' :
                    isCompleted ? 'bg-emerald-500 border-emerald-500 text-white' :
                    'bg-white dark:bg-gray-900 border-gray-150 dark:border-gray-800 text-gray-400'
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-indigo-600' : isCompleted ? 'text-emerald-500' : 'text-gray-400'}`}>
                    {s.label.split(' ')[0]}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div className={`flex-1 h-[2px] mx-2 -mt-7 rounded-full ${
                    steps.findIndex(x => x.id === step) > idx ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-gray-800'
                  }`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* STEP CONTENT CONTAINER */}
        <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 sm:p-10 shadow-2xl shadow-gray-200/50 dark:shadow-none border border-gray-150 dark:border-gray-800 min-h-[500px] flex flex-col">
          <div className="flex-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {step === 'personal' && renderPersonal()}
                {step === 'professional' && renderProfessional()}
                {step === 'skills' && renderSkills()}
                {step === 'finish' && renderFinish()}
              </motion.div>
            </AnimatePresence>
          </div>

          {step !== 'finish' && (
            <div className="pt-10 flex items-center justify-between border-t border-gray-100 dark:border-gray-800 mt-10">
              <button
                disabled={step === 'personal'}
                onClick={handleBack}
                className="flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-0 transition-all px-4 py-2"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Back</span>
              </button>
              <button
                onClick={handleNext}
                disabled={step === 'personal' && !personalDetails.fullName}
                className="flex items-center gap-2 bg-gray-900 dark:bg-white dark:text-gray-900 text-white font-bold py-3 px-8 rounded-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 shadow-lg shadow-gray-900/20"
              >
                <span>Continue</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
        
        <p className="text-center mt-8 text-xs text-gray-400 font-medium">
          Secure and private. Powered by <span className="text-indigo-500 font-bold">ResumeForge AI</span>
        </p>
      </div>
    </div>
  );
}
