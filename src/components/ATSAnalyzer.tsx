import React, { useState, useEffect, useRef } from 'react';
import { ResumeData, AtsReport, ProfileData } from '../types';
import { aiDeepAnalyzeAtsWithGroq } from '../services/groq';
import { saveAtsReport, fetchUserAtsReports } from '../services/firebase';
import { validateResumeText, parseResumeTextLocally, analyzeAtsLocally, LocalAtsResult } from '../utils/atsEngine';
import { motion, AnimatePresence } from 'motion/react';

// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import * as mammoth from 'mammoth';
import Tesseract from 'tesseract.js';

import {
  FileText,
  TrendingUp,
  Award,
  BookOpen,
  Briefcase,
  Layers,
  ChevronRight,
  Sparkles,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Loader2,
  Trash2,
  FolderOpen,
  Printer,
  Download,
  Save,
  RotateCcw,
  FileSpreadsheet,
  X,
  Upload,
  Calendar,
  Check,
  Smartphone,
  Quote,
  Flame,
  Search,
  BookMarked
} from 'lucide-react';

// Setup workers for PDF.js - pointing tocdnjs CDN (very robust for Vite)
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";

interface ATSAnalyzerProps {
  resumes: ResumeData[];
  userUid: string;
  groqKey?: string | null;
  showToasts: (msg: string, type: 'success' | 'error' | 'info') => void;
  activeResumeId?: string | null;
}

type Mode = 'upload' | 'preset';
type ProgressStep = 'idle' | 'reading' | 'ocr' | 'validating' | 'parsing' | 'scoring' | 'ai' | 'completed';

export default function ATSAnalyzer({
  resumes,
  userUid,
  groqKey,
  showToasts,
  activeResumeId,
}: ATSAnalyzerProps) {
  // Input states
  const [activeMode, setActiveMode] = useState<Mode>('upload');
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');
  const [jobDescription, setJobDescription] = useState('');
  
  // File Upload states
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Analysis Progress
  const [progressStep, setProgressStep] = useState<ProgressStep>('idle');
  const [progressStatusMsg, setProgressStatusMsg] = useState('');
  const [ocrProgress, setOcrProgress] = useState(0);

  // Results State
  const [localMetrics, setLocalMetrics] = useState<LocalAtsResult | null>(null);
  const [parsedCandidateJson, setParsedCandidateJson] = useState<ProfileData | null>(null);
  const [aiReport, setAiReport] = useState<any | null>(null);
  const [historicReports, setHistoricReports] = useState<AtsReport[]>([]);
  const [savingReport, setSavingReport] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Cancellation tokens
  const isCancelledRef = useRef<boolean>(false);

  // Auto-fill mock job description to help user start rapidly
  const fillSampleJobDescription = () => {
    setJobDescription(
      `Job Title: Senior React software engineer\n\n` +
      `Requirements:\n` +
      `- 5+ years of experience with React, TypeScript, and modern JS ecosystems.\n` +
      `- Hands-on skills in State management using Redux, Context API, or Zustand.\n` +
      `- Deep experience in building full-stack applications with Node.js, Express, and databases like PostgreSQL, Firebase FireStore, or Mysql.\n` +
      `- Familiarity with Docker containers, AWS, CI/CD pipelines, and cloud deployments like Cloud Run.\n` +
      `- Excellent soft skills such as Scrum, leadership, collaboration, and high-performance communication.\n` +
      `- Degree in computer science or equivalent certification.`
    );
    showToasts('Loaded React Developer Job Description!', 'success');
  };

  // Load parent resume options
  useEffect(() => {
    if (activeResumeId) {
      setSelectedResumeId(activeResumeId);
      setActiveMode('preset');
    } else if (resumes.length > 0) {
      setSelectedResumeId(resumes[0].id);
    }
  }, [activeResumeId, resumes]);

  // Load user's historic ATS reports
  const loadHistoryLogs = async () => {
    try {
      const list = await fetchUserAtsReports(userUid);
      setHistoricReports(
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      );
    } catch (err) {
      console.error('Error fetching historical ATS scores:', err);
    }
  };

  useEffect(() => {
    loadHistoryLogs();
  }, [userUid]);

  // Pre-load from localStorage cached report if exists (for extreme state resilience)
  useEffect(() => {
    const cached = localStorage.getItem(`ats_cache_${userUid}`);
    if (cached) {
      try {
        const data = JSON.parse(cached);
        if (data.localMetrics && data.parsedResume && data.aiReport) {
          setLocalMetrics(data.localMetrics);
          setParsedCandidateJson(data.parsedResume);
          setAiReport(data.aiReport);
          setProgressStep('completed');
        }
      } catch {
        // clear corrupted cache
        localStorage.removeItem(`ats_cache_${userUid}`);
      }
    }
  }, [userUid]);

  // Cancel ongoing workflow
  const handleCancelAnalysis = () => {
    isCancelledRef.current = true;
    setProgressStep('idle');
    setProgressStatusMsg('');
    showToasts('Analysis cancelled by user.', 'info');
  };

  // Extract from PDF Helper
  const extractPdfText = async (targetFile: File): Promise<string> => {
    const arrayBuffer = await targetFile.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    let resultText = '';
    const numPages = pdf.numPages;

    for (let i = 1; i <= numPages; i++) {
      if (isCancelledRef.current) throw new Error('Cancelled');
      setProgressStatusMsg(`Extracting PDF Text (Page ${i} of ${numPages})...`);
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      resultText += pageText + '\n';
    }
    return resultText;
  };

  // Extract from DOCX Helper
  const extractDocxText = async (targetFile: File): Promise<string> => {
    setProgressStatusMsg('Reading Word DOCX with Mammoth...');
    const arrayBuffer = await targetFile.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value || '';
  };

  // Extract from Image Helper using Tesseract
  const extractImageTextOCR = async (targetFile: File): Promise<string> => {
    setProgressStatusMsg('Initializing OCR worker engine...');
    
    return new Promise((resolve, reject) => {
      Tesseract.recognize(
        targetFile,
        'eng',
        {
          logger: m => {
            if (m.status === 'recognizing text') {
              setOcrProgress(Math.round(m.progress * 100));
              setProgressStatusMsg(`Running OCR Algorithm: ${Math.round(m.progress * 100)}%`);
            }
          }
        }
      ).then(({ data: { text } }) => {
        resolve(text);
      }).catch(err => {
        reject(err);
      });
    });
  };

  // Master Orchestration Handlers
  const triggerATSAnalysis = async () => {
    isCancelledRef.current = false;
    setIsSaved(false);

    if (!jobDescription.trim() || jobDescription.trim().length < 50) {
      showToasts('Please paste a substantial target Job Description (minimum 50 characters).', 'error');
      return;
    }

    let extractedRawText = '';

    try {
      if (activeMode === 'upload') {
        if (!file) {
          showToasts('Please upload a resume file (PDF, DOCX, PNG, JPG, or JPEG).', 'error');
          return;
        }

        setProgressStep('reading');
        setProgressStatusMsg('Reading uploaded document parameters...');

        const fileExt = file.name.split('.').pop()?.toLowerCase();

        if (fileExt === 'pdf') {
          setProgressStatusMsg('Extracting PDF text components...');
          extractedRawText = await extractPdfText(file);
        } else if (fileExt === 'docx') {
          setProgressStatusMsg('Extracting DOCX text structures...');
          extractedRawText = await extractDocxText(file);
        } else if (['png', 'jpg', 'jpeg'].includes(fileExt || '')) {
          setProgressStep('ocr');
          setProgressStatusMsg('Analyzing image vectors...');
          extractedRawText = await extractImageTextOCR(file);
        } else {
          showToasts('Unsupported file format. Please upload PDF, DOCX, or Image (PNG/JPG/JPEG).', 'error');
          setProgressStep('idle');
          return;
        }
      } else {
        // Preset option - load local database model
        const selectedResume = resumes.find(r => r.id === selectedResumeId);
        if (!selectedResume) {
          showToasts('Please select a valid cached resume profile.', 'error');
          return;
        }

        setProgressStep('parsing');
        setProgressStatusMsg('Compiling preset database profile content...');
        extractedRawText = `
          Full Name: ${selectedResume.personalDetails.fullName}
          Specialty: ${selectedResume.personalDetails.professionalTitle}
          Summary: ${selectedResume.summary}
          Email: ${selectedResume.personalDetails.email}
          Phone: ${selectedResume.personalDetails.phone}
          Education: ${selectedResume.education.map(e => `${e.degree} at ${e.institution}`).join(', ')}
          Experience: ${selectedResume.experience.map(e => `${e.title} at ${e.company}: ${e.description}`).join('; ')}
          Skills List: ${[
            selectedResume.skills.programmingLanguages,
            selectedResume.skills.frameworks,
            selectedResume.skills.tools,
            selectedResume.skills.databases,
            selectedResume.skills.softSkills
          ].flat().join(', ')}
        `;
      }

      if (isCancelledRef.current) return;

      // 1. FILE VALIDATION SECTOR
      setProgressStep('validating');
      setProgressStatusMsg('Validating document coordinates...');
      const validation = validateResumeText(extractedRawText);
      if (!validation.isValid) {
        showToasts(validation.error || 'Validation failure', 'error');
        setProgressStep('idle');
        return;
      }

      // 2. RESUME STRUCTURE PARSING LOCALLY
      setProgressStep('parsing');
      setProgressStatusMsg('Parsing sections into structured indices...');
      const parsedResume = parseResumeTextLocally(extractedRawText, userUid);

      if (isCancelledRef.current) return;

      // 3. SECURE LOCAL ATS ENGINE SCORING MATCH CALCULATIONS
      setProgressStep('scoring');
      setProgressStatusMsg('Calculating deterministic performance matrices...');
      const localResult = analyzeAtsLocally(parsedResume, jobDescription);

      if (isCancelledRef.current) return;

      // 4. GROQ DEEP AI ENRICHMENT
      setProgressStep('ai');
      setProgressStatusMsg('Generating deep recommendations via AI engine...');
      
      let aiResponse: any = null;
      if (groqKey) {
        try {
          aiResponse = await aiDeepAnalyzeAtsWithGroq(
            groqKey,
            parsedResume,
            jobDescription,
            {
              score: localResult.atsScore,
              matchScore: localResult.matchScore,
              keywordCoverage: localResult.keywordCoverage,
              missingSkills: localResult.missingSkills,
              missingKeywords: localResult.missingKeywords
            }
          );
        } catch (aiErr) {
          console.error('Groq connection error, preparing robust local mock response:', aiErr);
        }
      }

      // If groq API was skipped or failed, fallback to local metrics formatted cleanly
      if (!aiResponse) {
        aiResponse = {
          strengths: [
            parsedResume.experience.length > 0 ? 'Document contains a complete work profile' : 'Good fundamental base elements',
            parsedResume.education.length > 0 ? 'Verified academic timelines listed' : 'Essential skills section mapped',
            localResult.matchedSkills.length > 0 ? `Successfully aligned ${localResult.matchedSkills.length} key attributes` : 'Proper alignment index'
          ],
          weaknesses: [
            localResult.missingKeywords.length > 5 ? 'High omission of positional job descriptions keywords' : 'Needs slightly deeper metric highlights',
            parsedResume.personalDetails.linkedin ? 'Contact indices complete' : 'Lacks modern professional networking coordinates'
          ],
          missingKeywords: localResult.missingKeywords.slice(0, 10),
          missingSkills: localResult.missingSkills.slice(0, 10),
          recommendations: [
            'Integrate listed job skills inside active experience descriptors.',
            'Sprinkle quantitative achievements, demonstrating metrics over simple assignments.',
            'Clean structural blocks to highlight certifications above standard headers.'
          ],
          atsOptimizationAdvice: 'Review alignment scoring. Optimize the visual content hierarchy using a single column, highly-readable standard ATS template with specific titles.',
          rewriteRecommendations: [
            'BEFORE: "Responsible for coding frontend screens and handling UI requests."\nAFTER: "Pioneered interactive UI interfaces using React & TypeScript, boosting site interaction index by 24%."',
            'BEFORE: "Worked on Postgres storage optimizations."\nAFTER: "Refined database query pipelines using PostgreSQL, reducing load lags by 400ms across transaction charts."'
          ]
        };
      }

      // Save references in states
      setParsedCandidateJson(parsedResume);
      setLocalMetrics(localResult);
      setAiReport(aiResponse);
      setProgressStep('completed');
      showToasts('ATS Match Diagnostics Completed!', 'success');

      // Cache report locally in localStorage to avoid re-calls
      localStorage.setItem(`ats_cache_${userUid}`, JSON.stringify({
        localMetrics: localResult,
        parsedResume,
        aiReport: aiResponse
      }));

    } catch (err: any) {
      if (err.message === 'Cancelled') return;
      console.error(err);
      showToasts(err?.message || 'Unexpected parsing failure', 'error');
      setProgressStep('idle');
    }
  };

  // Save parsed diagnostics report to Firebase history (Explicitly on user choice)
  const handleSaveToCloud = async () => {
    if (!localMetrics || !parsedCandidateJson || !aiReport) return;

    setSavingReport(true);
    try {
      const dbReport: AtsReport = {
        id: 'rep_' + Math.random().toString(36).substring(2, 11),
        resumeId: selectedResumeId || 'uploaded_document',
        userId: userUid,
        jobDescription,
        score: localMetrics.atsScore,
        breakdown: localMetrics.breakdown,
        matchScore: localMetrics.matchScore,
        keywordCoverage: localMetrics.keywordCoverage,
        missingSkills: aiReport.missingSkills || localMetrics.missingSkills,
        missingKeywords: aiReport.missingKeywords || localMetrics.missingKeywords,
        suggestedImprovements: aiReport.recommendations || [],
        strengths: aiReport.strengths || [],
        weaknesses: aiReport.weaknesses || [],
        createdAt: new Date().toISOString()
      };

      await saveAtsReport(dbReport);
      setIsSaved(true);
      showToasts('ATS report archived safely in user history!', 'success');
      loadHistoryLogs();
    } catch (err: any) {
      showToasts(err?.message || 'Cloud backup failed.', 'error');
    } finally {
      setSavingReport(false);
    }
  };

  // Drag & drop file actions
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      setFile(droppedFile);
      showToasts(`Registered resume file: ${droppedFile.name}`, 'info');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      showToasts(`Registered resume file: ${selectedFile.name}`, 'info');
    }
  };

  // Clear loaded reports to start fresh
  const handleStartFresh = () => {
    localStorage.removeItem(`ats_cache_${userUid}`);
    setLocalMetrics(null);
    setParsedCandidateJson(null);
    setAiReport(null);
    setProgressStep('idle');
    setFile(null);
    setIsSaved(false);
  };

  // Quick print handler
  const handlePrint = () => {
    window.print();
  };

  // Get matching score style backgrounds
  const getProgressColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 60) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const getScoreGradeText = (score: number) => {
    if (score >= 80) return { title: 'Premium Match', text: 'Excellent, resume format matches JD filters beautifully.', border: 'border-emerald-200/50 dark:border-emerald-900/30' };
    if (score >= 60) return { title: 'Good Fit', text: 'Satisfactory. Missing specific keywords to hit target.', border: 'border-amber-200/50 dark:border-amber-900/30' };
    return { title: 'High Rejection Risk', text: 'Shortcomings found in core skillsets or section layout.', border: 'border-rose-200/50 dark:border-rose-900/30' };
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 print:p-0" id="ats-root-analyzer">
      {/* HEADER ROW - Hidden in Print */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2.5">
            <TrendingUp className="h-5 w-5 text-indigo-500" />
            <span>ATS Core Optimizer Engine</span>
          </h2>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500 font-medium leading-normal animate-fade">
            Compare and score resume credentials against automated parsing models and professional AI diagnostics.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COMPONENT: ANALYZE CONTROLS - Hidden in Print & Completed results view */}
        <div className={`lg:col-span-12 xl:col-span-5 space-y-6 print:hidden ${progressStep === 'completed' ? 'xl:hidden' : ''}`}>
          
          {/* JOB DESCRIPTION CARD */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-50 uppercase tracking-widest flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-500" />
                <span>1. Target Position parameters</span>
              </h3>
              <button 
                onClick={fillSampleJobDescription}
                className="text-[9px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/45 px-2.5 py-1 rounded transition hover:bg-indigo-100/60 cursor-pointer"
              >
                Insert Sample React JD
              </button>
            </div>

            <textarea
              value={jobDescription}
              onChange={e => setJobDescription(e.target.value)}
              rows={8}
              placeholder="Paste here the complete job details, required qualifications, frameworks, stack specifications, and goals..."
              className="w-full px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-xs focus:bg-white dark:focus:bg-zinc-900 dark:text-white transition outline-none font-sans"
              id="ats-jd-input"
            />
            <div className="mt-1 flex justify-between text-[10px] text-zinc-400 font-medium">
              <span>Required: Clean description keywords</span>
              <span>{jobDescription.trim().length} chars</span>
            </div>
          </div>

          {/* INPUT METHOD PREFERENCES CARD */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xs">
            <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-50 uppercase tracking-widest flex items-center gap-2 mb-4">
              <Upload className="h-5 w-5 text-indigo-500" />
              <span>2. Input Resume Material</span>
            </h3>

            {/* Selector tabs */}
            <div className="flex rounded-lg bg-zinc-100 dark:bg-zinc-950 p-1 mb-6">
              <button
                onClick={() => { setActiveMode('upload'); }}
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-[11px] font-bold rounded transition ${
                  activeMode === 'upload' 
                    ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs' 
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800'
                }`}
              >
                <Upload className="w-3.5 h-3.5 text-zinc-500" />
                <span>Upload File</span>
              </button>
              <button
                disabled={resumes.length === 0}
                onClick={() => { setActiveMode('preset'); }}
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-[11px] font-bold rounded transition disabled:opacity-30 ${
                  activeMode === 'preset' 
                    ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs' 
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-805'
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5 text-zinc-500" />
                <span>Choose Saved Profile</span>
              </button>
            </div>

             {/* TAB CONTENT: UPLOAD FILE */}
            {activeMode === 'upload' && (
              <div 
                className={`relative rounded-lg border-2 border-dashed transition flex flex-col items-center justify-center p-6 text-center ${
                  dragActive 
                    ? 'border-indigo-500 bg-indigo-50/10 dark:bg-indigo-950/5' 
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-indigo-500/60'
                }`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf,.docx,.png,.jpg,.jpeg"
                  className="hidden" 
                />

                {!file ? (
                  <>
                    <div className="w-10 h-10 bg-zinc-50 dark:bg-zinc-950 rounded-lg flex items-center justify-center text-zinc-500 mb-3 border border-zinc-250 dark:border-zinc-800">
                      <Upload className="w-4 h-4 text-indigo-505 text-indigo-500" />
                    </div>
                    <p className="text-xs font-bold text-zinc-900 dark:text-white mb-0.5">
                      Drag & Drop Resume Material
                    </p>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 max-w-[210px] mb-3 leading-normal">
                      Files supported: PDF, DOCX, or images (includes OCR reader).
                    </p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-550 text-white text-[10px] font-bold rounded-lg shadow-sm transition cursor-pointer"
                    >
                      Browse Documents
                    </button>
                  </>
                ) : (
                  <div className="w-full">
                    <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg flex items-center justify-center text-emerald-500 mx-auto mb-3 border border-emerald-100 dark:border-emerald-950/30">
                      <FileText className="w-4 h-4 text-emerald-600" />
                    </div>
                    <p className="text-xs font-bold text-zinc-900 dark:text-white truncate max-w-xs">{file.name}</p>
                    <p className="text-[10px] text-zinc-400 font-medium my-0.5">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                    <div className="flex gap-2 justify-center mt-3">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 text-[10px] font-bold rounded cursor-pointer"
                      >
                        Change
                      </button>
                      <button
                        onClick={() => setFile(null)}
                        className="px-2.5 py-1 bg-red-50 dark:bg-red-950/30 text-rose-500 text-[10px] font-bold rounded cursor-pointer transition"
                      >
                        Clear File
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: SELECT SAVED PRESETS */}
            {activeMode === 'preset' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Choose Selected Resume profile
                  </label>
                  <select
                    value={selectedResumeId}
                    onChange={e => setSelectedResumeId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-xs focus:bg-white dark:focus:bg-zinc-900 dark:text-white outline-none"
                  >
                    {resumes.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.title} ({r.templateId})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* LAUNCH ENGINE TRIGGER */}
            <div className="mt-6">
              <button
                onClick={triggerATSAnalysis}
                disabled={activeMode === 'upload' ? !file : !selectedResumeId}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-550 text-white px-4 py-2.5 text-xs font-bold shadow-xs active:scale-[0.99] transition disabled:opacity-40 cursor-pointer select-none"
              >
                <Sparkles className="h-4 w-4 text-yellow-300 fill-current" />
                <span>Compile ATS Diagnostic Match</span>
              </button>
            </div>
          </div>
          
          {/* HISTORY LOGS */}
          {historicReports.length > 0 && (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xs">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <BookMarked className="w-3.5 h-3.5 text-indigo-500" />
                <span>Historic Records</span>
              </h3>
              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                {historicReports.map(h => (
                  <div
                    key={h.id}
                    onClick={() => {
                      // Mock load cached report
                      setLocalMetrics({
                        atsScore: h.score,
                        matchScore: h.matchScore,
                        keywordCoverage: h.keywordCoverage,
                        breakdown: h.breakdown,
                        matchedKeywords: [], // simplified load
                        missingKeywords: h.missingKeywords,
                        matchedSkills: [],
                        missingSkills: h.missingSkills,
                        formattingFeedback: [],
                        experienceStats: {
                          yearsOfExperience: 5,
                          actionVerbsCount: 8,
                          verbsUsed: [],
                          quantifiedMetricsCount: 2,
                          relevanceScore: 85
                        }
                      });
                      setAiReport({
                        strengths: h.strengths,
                        weaknesses: h.weaknesses,
                        missingKeywords: h.missingKeywords,
                        missingSkills: h.missingSkills,
                        recommendations: h.suggestedImprovements,
                        atsOptimizationAdvice: 'Review historically collected metrics directly.',
                        rewriteRecommendations: []
                      });
                      setJobDescription(h.jobDescription);
                      setProgressStep('completed');
                      setIsSaved(true);
                      showToasts(`Fetched historical ATS diagnostic (${h.score}%)`, 'info');
                    }}
                    className="p-3 rounded-xl border border-gray-100 dark:border-gray-901 hover:border-indigo-400 bg-gray-50/40 dark:bg-gray-900/10 flex items-center justify-between cursor-pointer transition text-xs"
                  >
                    <div>
                      <span className="font-bold text-gray-800 dark:text-gray-200">ATS Score: {h.score}%</span>
                      <span className="text-[10px] text-gray-400 block mt-0.5">{new Date(h.createdAt).toLocaleDateString()}</span>
                    </div>
                    <span className="rounded bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 font-bold text-[9px] text-indigo-500">
                      Open
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* DETAILED RESULTS DASHBOARD AND PROCESSING STATUS */}
        <div className={`lg:col-span-12 ${progressStep === 'completed' ? 'xl:col-span-12' : 'xl:col-span-7'}`}>

          {/* LOADING WORKFLOW STEPS */}
          {progressStep !== 'idle' && progressStep !== 'completed' && (
            <div className="rounded-3xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 p-8 shadow-xl text-center flex flex-col items-center justify-center min-h-[460px] print:hidden">
              <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-6" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Automated Match Synthesis</h3>
              
              <p className="text-xs font-mono text-indigo-500 tracking-wider mb-6 px-4 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-full font-bold">
                {progressStatusMsg || 'Analyzing resume vectors...'}
              </p>

              {/* Progress Flow Blocks */}
              <div className="w-full max-w-sm space-y-3.5 mt-2">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="text-gray-500">Processing Stage</span>
                  <span className="text-indigo-500 uppercase tracking-widest">{progressStep}</span>
                </div>
                
                {/* Horizontal loader bars */}
                <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                    style={{ 
                      width: 
                        progressStep === 'reading' ? '20%' :
                        progressStep === 'ocr' ? `${Math.max(25, ocrProgress)}%` :
                        progressStep === 'validating' ? '45%' :
                        progressStep === 'parsing' ? '65%' :
                        progressStep === 'scoring' ? '80%' :
                        progressStep === 'ai' ? '95%' : '100%'
                    }}
                  />
                </div>

                <div className="pt-6">
                  <button
                    onClick={handleCancelAnalysis}
                    className="px-6 py-2 border border-rose-200/40 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-500 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Cancel Analysis File
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* EMPTY LANDING VIEW CONTROL */}
          {progressStep === 'idle' && (
            <div className="rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800 min-h-[460px] flex flex-col items-center justify-center p-8 text-center print:hidden">
              <TrendingUp className="w-12 h-12 text-gray-300 dark:text-gray-700 mb-4" />
              <h3 className="font-bold text-base text-gray-900 dark:text-white">Run your first ATS Scanner scan</h3>
              <p className="text-xs text-gray-400 max-w-xs mt-1 mb-6">
                Paste your target job specs on the left column, upload your resume PDF, Word, or Image, and compile diagnostic checks.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={fillSampleJobDescription}
                  className="px-4 py-2 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 text-gray-600 dark:text-gray-400 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Load Sample Job
                </button>
              </div>
            </div>
          )}

          {/* DETAILED RESULTS DASHBOARD (COMPLETED) */}
          {progressStep === 'completed' && localMetrics && aiReport && (
            <div className="space-y-6" id="ats-diagnostic-report">
              
              {/* RESULTS WORKSPACE ACTION BAR - Hidden in Print */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/30 border border-gray-150 dark:border-gray-800 print:hidden">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleStartFresh}
                    className="px-4 py-2 hover:bg-gray-150 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-lg transition border border-gray-200 dark:border-gray-800 flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Run Another File</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={handlePrint}
                    className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Print Report</span>
                  </button>

                  <button
                    onClick={handleSaveToCloud}
                    disabled={savingReport || isSaved}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow-sm cursor-pointer ${
                      isSaved 
                        ? 'bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50 text-emerald-600' 
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                    {savingReport ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : isSaved ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>{isSaved ? 'Archived to Cloud' : 'Save Report to History'}</span>
                  </button>
                </div>
              </div>

              {/* OVERALL ATS SCORE CARD */}
              <div className={`rounded-3xl border bg-white dark:bg-gray-950 p-6 shadow-xl shadow-gray-100/10 dark:shadow-black/20 flex flex-col md:flex-row items-center gap-8 ${getScoreGradeText(localMetrics.atsScore).border}`}>
                
                {/* Circular Score Gauge */}
                <div className="relative flex items-center justify-center shrink-0">
                  <svg className="w-36 h-36 transform -rotate-90">
                    <circle cx="72" cy="72" r="62" strokeWidth="10" stroke="#F3F4F6" className="dark:stroke-gray-850" fill="transparent" />
                    <circle
                      cx="72"
                      cy="72"
                      r="62"
                      strokeWidth="10"
                      stroke="url(#atsScoreGradient)"
                      strokeDasharray={`${2 * Math.PI * 62}`}
                      strokeDashoffset={`${2 * Math.PI * 62 * (1 - localMetrics.atsScore / 100)}`}
                      strokeLinecap="round"
                      fill="transparent"
                    />
                    <defs>
                      <linearGradient id="atsScoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#4f46e5" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute text-center">
                    <span className="text-4xl font-black text-gray-950 dark:text-white leading-none">
                      {localMetrics.atsScore}
                    </span>
                    <span className="text-[10px] text-gray-400 font-extrabold block tracking-wider uppercase mt-1">ATS Score</span>
                  </div>
                </div>

                {/* Score context */}
                <div className="flex-1 text-center md:text-left">
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 mb-2">
                    <span className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-extrabold px-3 py-1 rounded-full border border-indigo-100 dark:border-indigo-900/30">
                      Match Fit: {localMetrics.matchScore}%
                    </span>
                    <span className="bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 text-xs font-extrabold px-3 py-1 rounded-full border border-purple-100 dark:border-purple-900/30">
                      Keywords Sync: {localMetrics.keywordCoverage}%
                    </span>
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 dark:text-white">
                    {getScoreGradeText(localMetrics.atsScore).title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-lg leading-relaxed">
                    {getScoreGradeText(localMetrics.atsScore).text}
                  </p>
                  <div className="mt-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    Job Analysis Coordinate &bull; Compliant structure checklist
                  </div>
                </div>
              </div>

              {/* CLASSIFIED CATEGORY CRITERIAS BREAKDOWN */}
              <div className="rounded-3xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 p-6 shadow-xl shadow-gray-100/10 dark:shadow-black/20">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">Local ATS Criteria Breakdown</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Keywords (40%) */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-extrabold">
                      <span className="text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4 text-indigo-500" />
                        <span>Keyword Match Density (40%)</span>
                      </span>
                      <span className="text-gray-900 dark:text-white">{localMetrics.breakdown.keyword}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div className={`h-full ${getProgressColor(localMetrics.breakdown.keyword)} rounded-full`} style={{ width: `${localMetrics.breakdown.keyword}%` }} />
                    </div>
                  </div>

                  {/* Skills (25%) */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-extrabold">
                      <span className="text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-purple-500" />
                        <span>Technical Skills Overlap (25%)</span>
                      </span>
                      <span className="text-gray-900 dark:text-white">{localMetrics.breakdown.skills}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div className={`h-full ${getProgressColor(localMetrics.breakdown.skills)} rounded-full`} style={{ width: `${localMetrics.breakdown.skills}%` }} />
                    </div>
                  </div>

                  {/* Experience (20%) */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-extrabold">
                      <span className="text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                        <Briefcase className="w-4 h-4 text-emerald-500" />
                        <span>Experience, Verbs & Impact (20%)</span>
                      </span>
                      <span className="text-gray-900 dark:text-white">{localMetrics.breakdown.experience}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div className={`h-full ${getProgressColor(localMetrics.breakdown.experience)} rounded-full`} style={{ width: `${localMetrics.breakdown.experience}%` }} />
                    </div>
                  </div>

                  {/* Education (15%) */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-extrabold">
                      <span className="text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4 text-amber-500" />
                        <span>Educational Degree Fit (15%)</span>
                      </span>
                      <span className="text-gray-900 dark:text-white">{localMetrics.breakdown.education}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div className={`h-full ${getProgressColor(localMetrics.breakdown.education)} rounded-full`} style={{ width: `${localMetrics.breakdown.education}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* LOCAL MATCH DETAIL PANELS (Skills & Keywords) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* SKILLS PANEL */}
                <div className="rounded-3xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 p-6 shadow-xl">
                  <h3 className="text-xs font-extrabold text-indigo-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Award className="w-4 h-4" />
                    <span>Technical Skills Coverage</span>
                  </h3>
                  
                  {aiReport.missingSkills && aiReport.missingSkills.length > 0 ? (
                    <div className="space-y-4">
                      <div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Missing Skills List</div>
                        <div className="flex flex-wrap gap-1.5">
                          {aiReport.missingSkills.slice(0, 15).map((sk: string, idx: number) => (
                            <span key={idx} className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/35 text-rose-600 dark:text-rose-450 text-[10px] font-extrabold px-2.5 py-1 rounded">
                              {sk}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">No critical missing skillsets detected on the profile.</p>
                  )}
                </div>

                {/* KEYWORDS PANEL */}
                <div className="rounded-3xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 p-6 shadow-xl">
                  <h3 className="text-xs font-extrabold text-indigo-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    <span>Positional Keyword Gaps</span>
                  </h3>

                  {aiReport.missingKeywords && aiReport.missingKeywords.length > 0 ? (
                    <div className="space-y-4">
                      <div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Missing POSITIONAL Keywords</div>
                        <div className="flex flex-wrap gap-1.5">
                          {aiReport.missingKeywords.slice(0, 15).map((kw: string, idx: number) => (
                            <span key={idx} className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/35 text-amber-600 dark:text-amber-450 text-[10px] font-extrabold px-2.5 py-1 rounded">
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">Excellent! Key terms found complete overlap in resume texts.</p>
                  )}
                </div>
              </div>

              {/* DEEP AI DIAGNOSTIC INSIGHTS (Strengths, Weaknesses, Recommendations) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* STRENGTHS */}
                <div className="rounded-3xl border border-emerald-100 dark:border-emerald-950/20 bg-emerald-50/20 dark:bg-emerald-950/5 p-6 shadow-sm">
                  <h3 className="text-xs font-extrabold text-emerald-650 dark:text-emerald-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <CheckCircle className="w-4.5 h-4.5 text-emerald-550" />
                    <span>Resume Highlights & Strengths</span>
                  </h3>
                  <ul className="space-y-3">
                    {aiReport.strengths && aiReport.strengths.map((str: string, idx: number) => (
                      <li key={idx} className="flex gap-2 text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-semibold">
                        <span className="text-emerald-500 font-bold shrink-0">&bull;</span>
                        <span>{str}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* WEAKNESSES */}
                <div className="rounded-3xl border border-rose-100 dark:border-rose-950/20 bg-rose-50/20 dark:bg-rose-950/5 p-6 shadow-sm">
                  <h3 className="text-xs font-extrabold text-rose-650 dark:text-rose-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <AlertCircle className="w-4.5 h-4.5 text-rose-550" />
                    <span>Compliance Risks & Gaps</span>
                  </h3>
                  <ul className="space-y-3">
                    {aiReport.weaknesses && aiReport.weaknesses.map((wk: string, idx: number) => (
                      <li key={idx} className="flex gap-2 text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-semibold">
                        <span className="text-rose-500 font-bold shrink-0">&bull;</span>
                        <span>{wk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* ACTIONABLE IMPROVEMENT RECOMMENDATIONS */}
              <div className="rounded-3xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 p-6 shadow-xl">
                <h3 className="text-xs font-bold text-gray-450 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  <span>Strategic Improvement Recommendations</span>
                </h3>
                <ul className="space-y-3 pl-1.5">
                  {aiReport.recommendations && aiReport.recommendations.map((rec: string, idx: number) => (
                    <li key={idx} className="flex gap-3 text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                      <span className="w-5 h-5 bg-indigo-50 dark:bg-indigo-950 text-indigo-650 dark:text-indigo-450 rounded flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>

                {/* EXPERT ADVICE STATEMENT */}
                {aiReport.atsOptimizationAdvice && (
                  <div className="mt-6 p-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-150 dark:border-gray-850 text-xs text-gray-600 dark:text-gray-400 italic leading-relaxed">
                    <Quote className="w-4.5 h-4.5 text-indigo-400 shrink-0 mb-1 inline mr-1" />
                    {aiReport.atsOptimizationAdvice}
                  </div>
                )}
              </div>

              {/* REWRITE SUGGESTIONS - BEFORE & AFTER SCREEN */}
              {aiReport.rewriteRecommendations && aiReport.rewriteRecommendations.length > 0 && (
                <div className="rounded-3xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 p-6 shadow-xl">
                  <h3 className="text-xs font-bold text-gray-450 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-500" />
                    <span>Real-time Rewrite Recommendations</span>
                  </h3>
                  <div className="space-y-5">
                    {aiReport.rewriteRecommendations.map((rw: string, idx: number) => {
                      const parts = rw.split('\n');
                      const beforeText = parts.find(p => p.toLowerCase().includes('before:')) || 'Before edit description';
                      const afterText = parts.find(p => p.toLowerCase().includes('after:')) || 'Optimized rewrite';
                      
                      return (
                        <div key={idx} className="border border-gray-100 dark:border-gray-850 rounded-2xl overflow-hidden shadow-sm">
                          <div className="grid grid-cols-1 md:grid-cols-2 text-xs">
                            {/* Before panel */}
                            <div className="p-4 bg-gray-50/70 dark:bg-gray-900/30 border-r border-gray-100 dark:border-gray-850">
                              <span className="bg-rose-50 dark:bg-rose-950/20 text-rose-600 text-[9px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider block w-fit mb-2">Original phrasing</span>
                              <p className="text-gray-500 line-through leading-relaxed">{beforeText.replace(/before:\s*/i, '')}</p>
                            </div>
                            {/* After panel */}
                            <div className="p-4 bg-white dark:bg-gray-950">
                              <span className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 text-[9px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider block w-fit mb-2">ATS optimized wording</span>
                              <p className="text-gray-800 dark:text-gray-200 font-bold leading-relaxed">{afterText.replace(/after:\s*/i, '')}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
