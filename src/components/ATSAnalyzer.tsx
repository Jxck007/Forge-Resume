import React, { useState, useEffect, useRef } from 'react';
import { ResumeData, AtsReport, ProfileData, UserSettings } from '../types';
import { saveAtsReport, fetchUserAtsReports } from '../services/firebase';
import {
  validateResumeText,
  parseResumeTextLocally,
  analyzeAtsLocally,
  profileFromResumeData,
  LocalAtsResult,
  AtsSourceKind,
} from '../utils/advancedAtsEngine';
import { serializeResumeBySectionOrder } from '../utils/sectionOrder';
import { extractResumeText } from '../utils/resumeImport';
import { motion, AnimatePresence } from 'motion/react';

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

interface ATSAnalyzerProps {
  resumes: ResumeData[];
  userUid: string;
  settings: UserSettings;
  showToasts: (msg: string, type: 'success' | 'error' | 'info') => void;
  activeResumeId?: string | null;
}

type Mode = 'upload' | 'preset';
type ScanType = 'general' | 'targeted';
type ProgressStep =
  | 'idle'
  | 'reading'
  | 'ocr'
  | 'validating'
  | 'extraction'
  | 'structure'
  | 'evidence'
  | 'roleMatch'
  | 'pageFit'
  | 'synthesis'
  | 'completed';

const hydrateHistoricMetrics = (report: AtsReport): LocalAtsResult => ({
  atsScore: report.atsScore,
  matchScore: report.matchScore,
  breakdown: report.breakdown,
  pageFitDetails: report.pageFitDetails,
  keywordGaps: report.keywordGaps,
  skillAnalysis: report.skillAnalysis,
  projectAnalysis: report.projectAnalysis,
  targetComparison: report.targetComparison ? {
    roleFamily: report.targetComparison.roleFamily || 'general-other',
    roleFamilyLabel: report.targetComparison.roleFamilyLabel || 'General / Other',
    keywordOverlap: report.targetComparison.keywordOverlap,
    roleRelevance: report.targetComparison.roleRelevance,
    skillAlignment: report.targetComparison.skillAlignment,
    projectEvidence: report.targetComparison.projectEvidence,
    experienceEvidence: report.targetComparison.experienceEvidence,
    missingCriticalSkills: report.targetComparison.missingCriticalSkills,
    positionalKeywords: report.targetComparison.positionalKeywords,
    strongEvidence: report.targetComparison.strongEvidence || [],
    weakEvidence: report.targetComparison.weakEvidence || [],
  } : null,
  analysisModules: report.analysisModules || [],
  strengths: report.strengths,
  missingItems: report.missingItems,
  warnings: report.warnings,
  recommendations: report.recommendations,
  diagnosticCategories: report.diagnosticCategories || [],
  diagnosticIssues: report.diagnosticIssues || [],
  languageAnalysis: report.languageAnalysis || {
    spellingAccuracy: report.breakdown.readability,
    grammarCorrectness: report.breakdown.readability,
    readability: report.breakdown.readability,
    clarity: report.breakdown.readability,
  },
  layoutAnalysis: report.layoutAnalysis || {
    estimatedLineDensity: 0,
    sectionSizeWeight: 0,
    templateScalingFactor: 1,
    expectedColumns: 'single',
    detectedColumns: 'single',
  },
  responsivenessAnalysis: report.responsivenessAnalysis || {
    score: 100,
    mobileScore: 100,
    tabletScore: 100,
    textOverflowRisk: 'low',
    columnCollapseRisk: 'low',
    notes: [],
  },
});

const normalizeLocalMetrics = (metrics: Partial<LocalAtsResult>): LocalAtsResult => ({
  atsScore: Number.isFinite(metrics.atsScore) ? Number(metrics.atsScore) : 0,
  matchScore: typeof metrics.matchScore === 'number' ? metrics.matchScore : null,
  breakdown: metrics.breakdown || {
    parsing: 0,
    contact: 0,
    completeness: 0,
    skills: 0,
    experience: 0,
    projects: 0,
    readability: 0,
  },
  pageFitDetails: metrics.pageFitDetails || {
    score: 0,
    estimatedPages: 1,
    fitCategory: 'single-page safe',
    overflowRisk: 'low',
  },
  keywordGaps: metrics.keywordGaps || {
    missing: [],
    weakCoverage: [],
    strongCoverage: [],
  },
  skillAnalysis: metrics.skillAnalysis || {
    coveragePercent: 0,
    diversityScore: 0,
    visible: true,
    placement: 'main',
    templateFamily: 'unknown',
  },
  projectAnalysis: metrics.projectAnalysis || {
    hasLinks: 0,
    hasMetrics: 0,
    qualityScore: 0,
  },
  targetComparison: metrics.targetComparison ? {
    ...metrics.targetComparison,
    roleFamily: metrics.targetComparison.roleFamily || 'general-other',
    roleFamilyLabel: metrics.targetComparison.roleFamilyLabel || 'General / Other',
    strongEvidence: metrics.targetComparison.strongEvidence || [],
    weakEvidence: metrics.targetComparison.weakEvidence || [],
  } : null,
  analysisModules: metrics.analysisModules || [],
  strengths: metrics.strengths || [],
  missingItems: metrics.missingItems || [],
  warnings: metrics.warnings || [],
  recommendations: metrics.recommendations || [],
  diagnosticCategories: metrics.diagnosticCategories || [],
  diagnosticIssues: metrics.diagnosticIssues || [],
  languageAnalysis: metrics.languageAnalysis || {
    spellingAccuracy: metrics.breakdown?.readability || 0,
    grammarCorrectness: metrics.breakdown?.readability || 0,
    readability: metrics.breakdown?.readability || 0,
    clarity: metrics.breakdown?.readability || 0,
  },
  layoutAnalysis: metrics.layoutAnalysis || {
    estimatedLineDensity: 0,
    sectionSizeWeight: 0,
    templateScalingFactor: 1,
    expectedColumns: 'single',
    detectedColumns: 'single',
  },
  responsivenessAnalysis: metrics.responsivenessAnalysis || {
    score: 100,
    mobileScore: 100,
    tabletScore: 100,
    textOverflowRisk: 'low',
    columnCollapseRisk: 'low',
    notes: [],
  },
});

const analysisPause = (milliseconds: number) =>
  new Promise(resolve => window.setTimeout(resolve, milliseconds));

// ============================================================
// JOB DESCRIPTION LIBRARY — 17 professional categories
// ============================================================
const JD_LIBRARY: Record<string, { title: string; description: string }> = {
  softwareEngineer: {
    title: 'Software Engineer',
    description:
      `Job Title: Software Engineer\n\n` +
      `We are looking for a Software Engineer to design, develop, and maintain high-quality software systems.\n\n` +
      `Requirements:\n` +
      `- 3+ years of experience in software development using languages such as Python, Java, C++, or Go.\n` +
      `- Solid understanding of data structures, algorithms, and system design principles.\n` +
      `- Experience with REST APIs, microservices architecture, and cloud platforms (AWS/GCP/Azure).\n` +
      `- Familiarity with CI/CD pipelines, Docker, Kubernetes, and Git-based version control.\n` +
      `- Strong problem-solving skills and ability to write clean, testable, and maintainable code.\n` +
      `- Bachelor's degree in Computer Science or equivalent practical experience.`,
  },
  frontendDeveloper: {
    title: 'Frontend Developer',
    description:
      `Job Title: Frontend Developer\n\n` +
      `We are seeking a skilled Frontend Developer to build exceptional user interfaces for our web products.\n\n` +
      `Requirements:\n` +
      `- 3+ years of experience with React, Vue, or Angular frameworks.\n` +
      `- Proficient in HTML5, CSS3, TypeScript, and modern JavaScript (ES6+).\n` +
      `- Experience with responsive design, CSS-in-JS solutions (Styled Components, Tailwind CSS).\n` +
      `- Familiarity with RESTful APIs, GraphQL, and browser performance optimization.\n` +
      `- Understanding of accessibility standards (WCAG) and cross-browser compatibility.\n` +
      `- Experience with testing frameworks such as Jest, Cypress, or React Testing Library.`,
  },
  backendDeveloper: {
    title: 'Backend Developer',
    description:
      `Job Title: Backend Developer\n\n` +
      `We are hiring a Backend Developer to build scalable server-side applications and APIs.\n\n` +
      `Requirements:\n` +
      `- 3+ years of backend development experience using Node.js, Python (Django/FastAPI), Java (Spring Boot), or Go.\n` +
      `- Deep knowledge of relational (PostgreSQL, MySQL) and NoSQL (MongoDB, Redis) databases.\n` +
      `- Experience designing and implementing RESTful APIs and GraphQL endpoints.\n` +
      `- Familiarity with authentication protocols: OAuth2, JWT, session management.\n` +
      `- Proficiency with Docker, Kubernetes, and cloud deployments (AWS Lambda, GCP Cloud Run).\n` +
      `- Strong understanding of software architecture, SOLID principles, and test-driven development.`,
  },
  fullStackDeveloper: {
    title: 'Full Stack Developer',
    description:
      `Job Title: Full Stack Developer\n\n` +
      `We are looking for a Full Stack Developer comfortable across the entire web development stack.\n\n` +
      `Requirements:\n` +
      `- 4+ years of experience in full-stack development using React/Next.js and Node.js or Python.\n` +
      `- Hands-on experience with both SQL (PostgreSQL, MySQL) and NoSQL (MongoDB, Firebase) databases.\n` +
      `- Proficient in building and consuming REST APIs and microservices.\n` +
      `- Experience with cloud services: AWS, Firebase, or GCP — including storage, auth, and deployment.\n` +
      `- Familiarity with DevOps basics: CI/CD, Docker, environment configurations.\n` +
      `- Excellent communication skills and experience working in Agile/Scrum environments.`,
  },
  flutterDeveloper: {
    title: 'Flutter Developer',
    description:
      `Job Title: Flutter Developer\n\n` +
      `We are seeking an experienced Flutter Developer to build cross-platform mobile applications.\n\n` +
      `Requirements:\n` +
      `- 2+ years of commercial experience building mobile apps with Flutter and Dart.\n` +
      `- Published apps on the Google Play Store or Apple App Store.\n` +
      `- Proficiency with Flutter state management solutions: Provider, Riverpod, BLoC, or GetX.\n` +
      `- Experience integrating REST APIs, Firebase services (Firestore, Auth, Cloud Messaging).\n` +
      `- Understanding of native platform differences (iOS/Android), adaptive UI patterns.\n` +
      `- Familiarity with CI/CD for mobile apps using Fastlane, Codemagic, or GitHub Actions.`,
  },
  pythonDeveloper: {
    title: 'Python Developer',
    description:
      `Job Title: Python Developer\n\n` +
      `We are looking for a Python Developer to build scalable applications and automation systems.\n\n` +
      `Requirements:\n` +
      `- 3+ years of Python development experience (Django, Flask, FastAPI, or scripting).\n` +
      `- Experience with data handling libraries: Pandas, NumPy, SQLAlchemy, or Celery.\n` +
      `- Proficient in working with relational databases: PostgreSQL or MySQL via ORM (SQLAlchemy/Django ORM).\n` +
      `- Knowledge of async programming, multithreading, and performance optimization.\n` +
      `- Familiar with cloud services (AWS S3, Lambda, GCP) and containerization (Docker).\n` +
      `- Strong knowledge of unit testing with Pytest and code quality tools.`,
  },
  dataAnalyst: {
    title: 'Data Analyst',
    description:
      `Job Title: Data Analyst\n\n` +
      `We are hiring a Data Analyst to extract actionable insights from complex datasets.\n\n` +
      `Requirements:\n` +
      `- 2+ years of experience in data analysis using Python (Pandas, NumPy) or R.\n` +
      `- Advanced SQL skills for querying large datasets across BigQuery, PostgreSQL, or Redshift.\n` +
      `- Proficiency in BI tools: Tableau, Power BI, Looker, or Google Data Studio.\n` +
      `- Strong understanding of statistical analysis, A/B testing, and hypothesis testing.\n` +
      `- Experience cleaning, transforming, and modeling raw data into structured reports.\n` +
      `- Excellent communication skills to present findings to both technical and business stakeholders.`,
  },
  dataScientist: {
    title: 'Data Scientist',
    description:
      `Job Title: Data Scientist\n\n` +
      `We are looking for a Data Scientist to build predictive models and drive data-driven strategies.\n\n` +
      `Requirements:\n` +
      `- 3+ years of experience in data science using Python (scikit-learn, TensorFlow, PyTorch) or R.\n` +
      `- Strong background in machine learning, statistical modeling, and feature engineering.\n` +
      `- Experience with large-scale data pipelines using Spark, Airflow, or Kafka.\n` +
      `- Proficiency in SQL and NoSQL databases for data extraction and exploration.\n` +
      `- Familiarity with model deployment using MLflow, Docker, or cloud ML services.\n` +
      `- PhD or Master's degree in Statistics, Mathematics, or Computer Science preferred.`,
  },
  mlEngineer: {
    title: 'Machine Learning Engineer',
    description:
      `Job Title: Machine Learning Engineer\n\n` +
      `We are seeking a Machine Learning Engineer to productionize ML models at scale.\n\n` +
      `Requirements:\n` +
      `- 3+ years of experience building and deploying machine learning systems in production.\n` +
      `- Proficiency in Python, TensorFlow, PyTorch, and the broader ML ecosystem (Hugging Face, XGBoost).\n` +
      `- Strong experience with ML pipelines: data ingestion, training, evaluation, and inference.\n` +
      `- Knowledge of MLOps: experiment tracking (MLflow/W&B), model versioning, CI/CD for ML.\n` +
      `- Experience with cloud ML platforms: AWS SageMaker, GCP Vertex AI, or Azure ML.\n` +
      `- Solid software engineering skills including system design, testing, and code reviews.`,
  },
  devopsEngineer: {
    title: 'DevOps Engineer',
    description:
      `Job Title: DevOps Engineer\n\n` +
      `We are hiring a DevOps Engineer to build and maintain our infrastructure and deployment pipelines.\n\n` +
      `Requirements:\n` +
      `- 3+ years of experience in DevOps, Site Reliability Engineering, or infrastructure automation.\n` +
      `- Proficiency with containerization (Docker) and orchestration (Kubernetes, Helm).\n` +
      `- Experience with CI/CD tools: GitHub Actions, Jenkins, GitLab CI, or CircleCI.\n` +
      `- Infrastructure as Code (IaC) expertise with Terraform, Ansible, or Pulumi.\n` +
      `- Deep knowledge of Linux systems, shell scripting, and cloud platforms (AWS/GCP/Azure).\n` +
      `- Monitoring and observability experience with Prometheus, Grafana, Datadog, or ELK Stack.`,
  },
  cloudEngineer: {
    title: 'Cloud Engineer',
    description:
      `Job Title: Cloud Engineer\n\n` +
      `We are looking for a Cloud Engineer to architect and manage scalable cloud infrastructure.\n\n` +
      `Requirements:\n` +
      `- 3+ years of cloud engineering experience on AWS, Google Cloud Platform, or Azure.\n` +
      `- AWS/GCP/Azure certifications (Solutions Architect, Cloud Engineer, or DevOps Engineer).\n` +
      `- Expertise in cloud networking: VPC, subnets, load balancers, CDN, and DNS management.\n` +
      `- Experience with serverless architectures: AWS Lambda, Cloud Functions, or Azure Functions.\n` +
      `- Infrastructure as Code using Terraform, CloudFormation, or Deployment Manager.\n` +
      `- Strong security practices: IAM, encryption, compliance standards (SOC 2, GDPR).`,
  },
  cybersecurity: {
    title: 'Cybersecurity Analyst',
    description:
      `Job Title: Cybersecurity Analyst\n\n` +
      `We are seeking a Cybersecurity Analyst to protect our systems, networks, and data assets.\n\n` +
      `Requirements:\n` +
      `- 3+ years of experience in information security, threat analysis, or SOC operations.\n` +
      `- Proficiency with SIEM platforms: Splunk, Microsoft Sentinel, or IBM QRadar.\n` +
      `- Experience in vulnerability assessment, penetration testing, and incident response.\n` +
      `- Knowledge of security frameworks: NIST, ISO 27001, CIS Controls, or MITRE ATT&CK.\n` +
      `- Relevant certifications: CISSP, CEH, CompTIA Security+, or CISM preferred.\n` +
      `- Strong understanding of networking protocols, firewalls, VPNs, and endpoint protection.`,
  },
  uiuxDesigner: {
    title: 'UI/UX Designer',
    description:
      `Job Title: UI/UX Designer\n\n` +
      `We are hiring a UI/UX Designer to create intuitive, beautiful digital experiences for our users.\n\n` +
      `Requirements:\n` +
      `- 3+ years of UI/UX design experience for web and/or mobile applications.\n` +
      `- Proficiency with design tools: Figma, Sketch, Adobe XD, or InVision.\n` +
      `- Strong portfolio demonstrating user-centered design processes, wireframes, and prototypes.\n` +
      `- Experience conducting user research, usability testing, and translating insights into designs.\n` +
      `- Knowledge of design systems, component libraries, and accessibility standards (WCAG 2.1).\n` +
      `- Ability to collaborate closely with product managers and engineers in Agile workflows.`,
  },
  qaEngineer: {
    title: 'QA Engineer',
    description:
      `Job Title: QA Engineer\n\n` +
      `We are looking for a QA Engineer to ensure the quality and reliability of our software products.\n\n` +
      `Requirements:\n` +
      `- 3+ years of software quality assurance experience in manual and automated testing.\n` +
      `- Proficiency with test automation frameworks: Selenium, Cypress, Playwright, or Appium.\n` +
      `- Experience writing and maintaining comprehensive test plans, test cases, and bug reports.\n` +
      `- Familiarity with API testing using Postman, RestAssured, or similar tools.\n` +
      `- Knowledge of CI/CD integration for automated test pipelines (GitHub Actions, Jenkins).\n` +
      `- Strong analytical skills to identify root causes and collaborate with engineering teams.`,
  },
  productManager: {
    title: 'Product Manager',
    description:
      `Job Title: Product Manager\n\n` +
      `We are hiring a Product Manager to define product vision and drive delivery across cross-functional teams.\n\n` +
      `Requirements:\n` +
      `- 4+ years of product management experience in SaaS, mobile, or platform products.\n` +
      `- Proven ability to define product roadmaps, write user stories, and prioritize backlogs.\n` +
      `- Experience with data-driven decision-making using tools like Mixpanel, Amplitude, or Google Analytics.\n` +
      `- Strong stakeholder management and communication skills across engineering, design, and business.\n` +
      `- Familiarity with Agile/Scrum methodologies, sprint planning, and OKR frameworks.\n` +
      `- MBA or Bachelor's degree in Business, Computer Science, or equivalent experience.`,
  },
  businessAnalyst: {
    title: 'Business Analyst',
    description:
      `Job Title: Business Analyst\n\n` +
      `We are seeking a Business Analyst to bridge business needs and technology solutions.\n\n` +
      `Requirements:\n` +
      `- 3+ years of experience in business analysis, requirements gathering, or process improvement.\n` +
      `- Proficiency in business process modeling (BPMN) and requirements documentation (BRD, FRD).\n` +
      `- Experience with Agile/Scrum and familiarity with project management tools (Jira, Confluence).\n` +
      `- Ability to perform gap analysis, stakeholder interviews, and workflow optimization.\n` +
      `- Strong SQL skills for data querying and validation in enterprise systems.\n` +
      `- Excellent written and verbal communication for presenting findings to senior leadership.`,
  },
  sysAdmin: {
    title: 'System Administrator',
    description:
      `Job Title: System Administrator\n\n` +
      `We are hiring a System Administrator to manage and maintain IT infrastructure and systems.\n\n` +
      `Requirements:\n` +
      `- 3+ years of experience in Linux and Windows Server administration.\n` +
      `- Strong skills in network configuration: DNS, DHCP, TCP/IP, VPN, and firewall management.\n` +
      `- Experience with virtualization technologies: VMware, Hyper-V, or KVM.\n` +
      `- Proficiency in scripting for automation: Bash, PowerShell, or Python.\n` +
      `- Familiarity with Active Directory, LDAP, and enterprise identity management.\n` +
      `- Experience with backup strategies, disaster recovery planning, and security hardening.`,
  },
};

export default function ATSAnalyzer({
  resumes,
  userUid,
  showToasts,
  activeResumeId,
}: ATSAnalyzerProps) {
  // Input states
  const [activeMode, setActiveMode] = useState<Mode>('upload');
  const [scanType, setScanType] = useState<ScanType>('general');
  const [jdCategory, setJdCategory] = useState<string>('softwareEngineer');
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
  const [historicReports, setHistoricReports] = useState<AtsReport[]>([]);
  const [savingReport, setSavingReport] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [issueFilter, setIssueFilter] = useState<'all' | 'critical'>('all');
  const [sectionIssueFilter, setSectionIssueFilter] = useState<'all' | string>('all');
  const [expandedIssueIds, setExpandedIssueIds] = useState<string[]>([]);
  const presentationReport = localMetrics ? {
    strengths: localMetrics.strengths,
    weaknesses: localMetrics.warnings,
    recommendations: localMetrics.recommendations,
    atsOptimizationAdvice: 'Recommendations are informational and never change parsing, match, or page-fit scores.',
  } : null;
  const selectedPresetResume = resumes.find(resume => resume.id === selectedResumeId);
  const filteredDiagnosticIssues = localMetrics
    ? localMetrics.diagnosticIssues.filter(issue => (
        (issueFilter === 'all' || issue.severity === 'high') &&
        (sectionIssueFilter === 'all' || issue.affectedSection === sectionIssueFilter)
      ))
    : [];
  const groupedDiagnosticIssues = filteredDiagnosticIssues.reduce<Record<string, typeof filteredDiagnosticIssues>>((groups, issue) => {
    const key = issue.category;
    if (!groups[key]) groups[key] = [];
    groups[key].push(issue);
    return groups;
  }, {});

  // Cancellation tokens
  const isCancelledRef = useRef<boolean>(false);

  // Load sample JD from the library by selected category
  const loadSampleJD = () => {
    const entry = JD_LIBRARY[jdCategory];
    if (!entry) return;
    setScanType('targeted');
    setJobDescription(entry.description);
    showToasts(`Loaded "${entry.title}" sample job description!`, 'success');
  };

  const toggleIssueExpanded = (issueId: string) => {
    setExpandedIssueIds(current => (
      current.includes(issueId)
        ? current.filter(id => id !== issueId)
        : [...current, issueId]
    ));
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
        list
          .filter(report => Number.isFinite(report.atsScore))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
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
        if (
          Number.isFinite(data.localMetrics?.atsScore) &&
          data.localMetrics?.breakdown &&
          data.localMetrics?.pageFitDetails &&
          data.localMetrics?.keywordGaps &&
          data.parsedResume
        ) {
          setLocalMetrics(normalizeLocalMetrics(data.localMetrics));
          setParsedCandidateJson(data.parsedResume);
          setScanType(data.scanType === 'general' ? 'general' : 'targeted');
          setProgressStep('completed');
        } else {
          localStorage.removeItem(`ats_cache_${userUid}`);
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
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).href;
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
      const positionedItems = textContent.items
        .filter((item: any) => item.str?.trim())
        .map((item: any) => ({
          text: item.str.trim(),
          x: item.transform?.[4] || 0,
          y: item.transform?.[5] || 0,
        }))
        .sort((a, b) => Math.abs(b.y - a.y) > 2 ? b.y - a.y : a.x - b.x);
      const lines: Array<{ y: number; items: Array<{ text: string; x: number }> }> = [];
      positionedItems.forEach(item => {
        const line = lines.find(candidate => Math.abs(candidate.y - item.y) <= 2);
        if (line) line.items.push({ text: item.text, x: item.x });
        else lines.push({ y: item.y, items: [{ text: item.text, x: item.x }] });
      });
      const pageText = lines
        .sort((a, b) => b.y - a.y)
        .map(line => line.items.sort((a, b) => a.x - b.x).map(item => item.text).join(' '))
        .join('\n');
      resultText += pageText + '\n';
    }
    return resultText;
  };

  // Extract from DOCX Helper
  const extractDocxText = async (targetFile: File): Promise<string> => {
    setProgressStatusMsg('Reading Word DOCX with Mammoth...');
    const mammoth = (await import('mammoth')).default;
    const arrayBuffer = await targetFile.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value || '';
  };

  // Extract from Image Helper using Tesseract
  const extractImageTextOCR = async (targetFile: File): Promise<string> => {
    setProgressStatusMsg('Initializing OCR worker engine...');
    const Tesseract = (await import('tesseract.js')).default;
    
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

    if (scanType === 'targeted' && (!jobDescription.trim() || jobDescription.trim().length < 50)) {
      showToasts('Please paste a substantial target Job Description (minimum 50 characters).', 'error');
      return;
    }

    let extractedRawText = '';
    let structuredPreset: ProfileData | null = null;
    let analysisSource: AtsSourceKind = activeMode === 'preset' ? 'structured' : 'text-pdf';

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
          analysisSource = 'text-pdf';
          setProgressStatusMsg('Extracting PDF text components...');
          extractedRawText = await extractPdfText(file);
          if (extractedRawText.trim().split(/\s+/).length < 80) {
            setProgressStep('ocr');
            setProgressStatusMsg('Selectable text is limited. Running OCR on scanned PDF pages...');
            const ocrText = await extractResumeText(file, 'pdf');
            if (ocrText.trim().length > extractedRawText.trim().length) {
              extractedRawText = ocrText;
              analysisSource = 'image-ocr';
            }
          }
        } else if (fileExt === 'docx') {
          analysisSource = 'docx';
          setProgressStatusMsg('Extracting DOCX text structures...');
          extractedRawText = await extractDocxText(file);
        } else if (['png', 'jpg', 'jpeg'].includes(fileExt || '')) {
          analysisSource = 'image-ocr';
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

        setProgressStep('extraction');
        setProgressStatusMsg('Compiling preset database profile content...');
        extractedRawText = serializeResumeBySectionOrder(selectedResume);
        structuredPreset = profileFromResumeData(selectedResume, userUid);
      }

      if (isCancelledRef.current) return;

      // 1. FILE VALIDATION SECTOR
      setProgressStep('validating');
      setProgressStatusMsg('Validating document coordinates...');
      if (!structuredPreset) {
        const validation = validateResumeText(extractedRawText);
        if (!validation.isValid) {
          showToasts(validation.error || 'Validation failure', 'error');
          setProgressStep('idle');
          return;
        }
      }

      // 2. RESUME STRUCTURE PARSING LOCALLY
      setProgressStep('structure');
      setProgressStatusMsg('Parsing sections into structured indices...');
      const parsedResume = structuredPreset || parseResumeTextLocally(extractedRawText, userUid);

      if (isCancelledRef.current) return;

      // 3. SECURE LOCAL ATS ENGINE SCORING MATCH CALCULATIONS
      setProgressStep('evidence');
      setProgressStatusMsg('Normalizing skill categories and validating evidence...');
      const effectiveJobDescription = scanType === 'targeted' ? jobDescription : '';
      const localResult = analyzeAtsLocally(
        parsedResume,
        effectiveJobDescription,
        extractedRawText,
        {
          sourceKind: analysisSource,
          templateId: activeMode === 'preset'
            ? resumes.find(candidate => candidate.id === selectedResumeId)?.templateId
            : undefined,
          hiddenSections: activeMode === 'preset'
            ? resumes.find(candidate => candidate.id === selectedResumeId)?.hiddenSections
            : undefined,
          languageQuality: activeMode === 'preset'
            ? resumes.find(candidate => candidate.id === selectedResumeId)?.languageQuality
            : undefined,
          sectionOrder: activeMode === 'preset'
            ? resumes.find(candidate => candidate.id === selectedResumeId)?.sectionOrder
            : undefined,
        }
      );

      if (isCancelledRef.current) return;
      const consolidationStages: Array<{
        step: Exclude<
          ProgressStep,
          'idle' | 'reading' | 'ocr' | 'validating' | 'extraction' | 'structure' | 'completed'
        >;
        message: string;
      }> = [
        { step: 'evidence', message: `Resume evidence validated across skills, experience, and projects.` },
        {
          step: 'roleMatch',
          message: localResult.targetComparison
            ? `${localResult.targetComparison.roleFamilyLabel} role evidence weighted by section.`
            : 'General ATS evidence indexed without a target role.',
        },
        { step: 'pageFit', message: `Page-fit module estimates ${localResult.pageFitDetails.estimatedPages} pages.` },
        { step: 'synthesis', message: 'Consolidating module evidence into the final score...' },
      ];
      for (const stage of consolidationStages) {
        setProgressStep(stage.step);
        setProgressStatusMsg(stage.message);
        await analysisPause(180);
        if (isCancelledRef.current) return;
      }

      // Save references in states
      setParsedCandidateJson(parsedResume);
      setLocalMetrics(localResult);
      setProgressStep('completed');
      showToasts(scanType === 'general' ? 'General ATS scan completed!' : 'ATS match diagnostics completed!', 'success');

      // Cache report locally in localStorage to avoid re-calls
      localStorage.setItem(`ats_cache_${userUid}`, JSON.stringify({
        localMetrics: localResult,
        parsedResume,
        scanType,
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
    if (!localMetrics || !parsedCandidateJson) return;

    setSavingReport(true);
    try {
      const dbReport: AtsReport = {
        id: 'rep_' + Math.random().toString(36).substring(2, 11),
        resumeId: selectedResumeId || 'uploaded_document',
        userId: userUid,
        jobDescription: scanType === 'targeted' ? jobDescription : '',
        ...localMetrics,
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

  return (
    <div className="forge-product-page forge-ats-page mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 print:p-0" id="ats-root-analyzer">
      {/* HEADER ROW - Hidden in Print */}
      <div className="forge-product-heading mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4 print:hidden">
        <div>
          <span className="forge-eyebrow">Application intelligence</span>
          <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2.5">
            <TrendingUp className="h-5 w-5 text-indigo-500" />
            <span>ATS match analysis</span>
          </h2>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500 font-medium leading-normal animate-fade">
            Check general ATS readiness or compare a resume against a specific target role.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COMPONENT: ANALYZE CONTROLS - Hidden in Print & Completed results view */}
        <div className={`lg:col-span-12 xl:col-span-5 space-y-6 print:hidden ${progressStep === 'completed' ? 'xl:hidden' : ''}`}>
          
          {/* SCAN TYPE AND JOB DESCRIPTION CARD */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xs">
            <div className="mb-4">
              <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-50 uppercase tracking-widest flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-teal-500" />
                <span>1. Choose scan type</span>
              </h3>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                General scans measure ATS readiness. Targeted scans also measure fit against a job description.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label="ATS scan type">
              <button
                type="button"
                onClick={() => setScanType('general')}
                aria-pressed={scanType === 'general'}
                className={`forge-ats-mode-button ${scanType === 'general' ? 'is-active' : ''}`}
              >
                <CheckCircle className="h-4 w-4" />
                <span>
                  <strong>General ATS scan</strong>
                  <small>No job description needed</small>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setScanType('targeted')}
                aria-pressed={scanType === 'targeted'}
                className={`forge-ats-mode-button ${scanType === 'targeted' ? 'is-active' : ''}`}
              >
                <Search className="h-4 w-4" />
                <span>
                  <strong>Targeted match</strong>
                  <small>Compare against a role</small>
                </span>
              </button>
            </div>

            {scanType === 'targeted' && (
              <div className="mt-5">
                <label htmlFor="ats-jd-input" className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Target job description
                </label>
                <textarea
                  value={jobDescription}
                  onChange={e => setJobDescription(e.target.value)}
                  rows={8}
                  placeholder="Paste the job description, required skills, responsibilities, and qualifications..."
                  className="w-full px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-xs focus:bg-white dark:focus:bg-zinc-900 dark:text-white transition outline-none font-sans"
                  id="ats-jd-input"
                />
                <div className="mt-1 flex justify-between text-[10px] text-zinc-400 font-medium">
                  <span>Minimum 50 characters</span>
                  <span>{jobDescription.trim().length} chars</span>
                </div>
              </div>
            )}
          </div>

          {/* INPUT METHOD PREFERENCES CARD */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xs">
            <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-50 uppercase tracking-widest flex items-center gap-2 mb-4">
              <Upload className="h-5 w-5 text-indigo-500" />
              <span>2. Resume source</span>
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
                <span>Upload resume</span>
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
                <span>Saved resume</span>
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
                      Drop your resume here
                    </p>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 max-w-[210px] mb-3 leading-normal">
                      Files supported: PDF, DOCX, or images (includes OCR reader).
                    </p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-550 text-white text-[10px] font-bold rounded-lg shadow-sm transition cursor-pointer"
                    >
                      Choose file
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
                    Select a saved resume
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
                disabled={
                  (activeMode === 'upload' ? !file : !selectedResumeId) ||
                  (scanType === 'targeted' && jobDescription.trim().length < 50)
                }
                className="forge-ats-primary-button w-full"
              >
                <Sparkles className="h-4 w-4" />
                <span>{scanType === 'general' ? 'Run general ATS scan' : 'Run targeted ATS scan'}</span>
              </button>
            </div>
          </div>
          
          {/* HISTORY LOGS */}
          {historicReports.length > 0 && (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xs">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <BookMarked className="w-3.5 h-3.5 text-indigo-500" />
                <span>Recent scans</span>
              </h3>
              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                {historicReports.map(h => (
                  <div
                    key={h.id}
                    onClick={() => {
                      setLocalMetrics(hydrateHistoricMetrics(h));
                      setJobDescription(h.jobDescription);
                      setScanType(h.jobDescription.trim() ? 'targeted' : 'general');
                      setProgressStep('completed');
                      setIsSaved(true);
                      showToasts(`Opened saved ATS report (${h.atsScore}% ATS).`, 'info');
                    }}
                    className="p-3 rounded-xl border border-gray-100 dark:border-gray-901 hover:border-indigo-400 bg-gray-50/40 dark:bg-gray-900/10 flex items-center justify-between cursor-pointer transition text-xs"
                  >
                    <div>
                      <span className="font-bold text-gray-800 dark:text-gray-200">
                        ATS {h.atsScore}%{h.matchScore !== null ? ` · Match ${h.matchScore}%` : ''}
                      </span>
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
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Analyzing your resume</h3>
              
              <p className="text-xs font-mono text-indigo-500 tracking-wider mb-6 px-4 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-full font-bold">
                {progressStatusMsg || 'Reviewing resume content...'}
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
                        progressStep === 'extraction' ? '58%' :
                        progressStep === 'structure' ? '68%' :
                        progressStep === 'evidence' ? '78%' :
                        progressStep === 'roleMatch' ? '86%' :
                        progressStep === 'pageFit' ? '92%' :
                        progressStep === 'synthesis' ? '97%' :
                        '100%'
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
              <h3 className="font-bold text-base text-gray-900 dark:text-white">Measure ATS readiness</h3>
              <p className="text-xs text-gray-400 max-w-xs mt-1 mb-6">
                Run a general score without a job description, or load a sample role for targeted matching.
              </p>
              <div className="flex gap-2 flex-wrap justify-center">
                <button
                  type="button"
                  onClick={() => setScanType('general')}
                  className="forge-ats-secondary-button"
                >
                  General scan
                </button>
                <select
                  value={jdCategory}
                  onChange={e => setJdCategory(e.target.value)}
                  className="px-3 py-2 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 text-xs font-semibold rounded-xl outline-none cursor-pointer"
                >
                  {Object.entries(JD_LIBRARY).map(([key, val]) => (
                    <option key={key} value={key}>{val.title}</option>
                  ))}
                </select>
                <button
                  onClick={loadSampleJD}
                  type="button"
                  className="forge-ats-sample-button"
                >
                  Load Sample JD
                </button>
              </div>
            </div>
          )}

          {/* DETAILED RESULTS DASHBOARD (COMPLETED) */}
          {progressStep === 'completed' && localMetrics && presentationReport && (
            <div className="space-y-6" id="ats-diagnostic-report">
              
              {/* RESULTS WORKSPACE ACTION BAR - Hidden in Print */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/30 border border-gray-150 dark:border-gray-800 print:hidden">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleStartFresh}
                    className="px-4 py-2 hover:bg-gray-150 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-lg transition border border-gray-200 dark:border-gray-800 flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>New scan</span>
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

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-xl shadow-gray-100/10 dark:border-gray-800 dark:bg-gray-950">
                  <span className="text-xs font-bold uppercase tracking-widest text-teal-600">
                    {scanType === 'general' ? 'General scan' : 'Target role scan'}
                  </span>
                  <div className="mt-3 flex items-end justify-between gap-4">
                    <div>
                      <h3 className="text-2xl font-black text-gray-950 dark:text-white">
                        {scanType === 'general' ? 'ATS Score' : 'Match Score'}
                      </h3>
                      <p className="mt-1 max-w-xl text-sm text-gray-500 dark:text-gray-400">
                        {scanType === 'general'
                          ? 'Overall readiness for recruiter and ATS screening.'
                          : 'Resume alignment with the supplied target role.'}
                      </p>
                    </div>
                    <span className="text-5xl font-black text-gray-950 dark:text-white">
                      {scanType === 'general' ? localMetrics.atsScore : localMetrics.matchScore}
                    </span>
                  </div>
                  <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className={`h-full rounded-full ${getProgressColor(
                        scanType === 'general' ? localMetrics.atsScore : localMetrics.matchScore || 0
                      )}`}
                      style={{ width: `${scanType === 'general' ? localMetrics.atsScore : localMetrics.matchScore || 0}%` }}
                    />
                  </div>
                </div>

                <div className="rounded-3xl border border-gray-100 bg-white p-6 dark:border-gray-800 dark:bg-gray-950">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">
                    {scanType === 'general' ? 'Quick summary' : 'Resume vs target'}
                  </h3>
                  <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div><dt className="text-gray-400">General ATS</dt><dd className="font-black text-gray-900 dark:text-white">{localMetrics.atsScore}%</dd></div>
                    <div><dt className="text-gray-400">Skills</dt><dd className="font-black text-gray-900 dark:text-white">{localMetrics.skillAnalysis.coveragePercent}%</dd></div>
                    <div><dt className="text-gray-400">Projects</dt><dd className="font-black text-gray-900 dark:text-white">{localMetrics.projectAnalysis.qualityScore}%</dd></div>
                    <div><dt className="text-gray-400">Warnings</dt><dd className="font-black text-gray-900 dark:text-white">{localMetrics.warnings.length}</dd></div>
                    <div><dt className="text-gray-400">Mobile</dt><dd className="font-black text-gray-900 dark:text-white">{localMetrics.responsivenessAnalysis.mobileScore}%</dd></div>
                    <div><dt className="text-gray-400">Tablet</dt><dd className="font-black text-gray-900 dark:text-white">{localMetrics.responsivenessAnalysis.tabletScore}%</dd></div>
                  </dl>
                </div>
              </div>

              <div className="rounded-3xl border border-cyan-200 bg-cyan-50/40 p-6 dark:border-cyan-900/40 dark:bg-cyan-950/10">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 className="text-sm font-black text-gray-900 dark:text-white">Page fit</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Full-resume density is evaluated independently from ATS readiness and target matching.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-cyan-700 dark:text-cyan-300">
                    {localMetrics.pageFitDetails.fitCategory === 'multi-page likely'
                      ? 'Multi Page expected'
                      : localMetrics.pageFitDetails.fitCategory === 'near limit'
                        ? 'Single Page at risk'
                        : 'Single Page expected'}
                  </span>
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                  {[
                    ['Page-fit score', `${localMetrics.pageFitDetails.score}%`],
                    ['Estimated pages', localMetrics.pageFitDetails.estimatedPages],
                    ['Fit category', localMetrics.pageFitDetails.fitCategory],
                    ['Overflow risk', localMetrics.pageFitDetails.overflowRisk],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-xl border border-cyan-100 bg-white/80 p-3 dark:border-cyan-900/30 dark:bg-gray-950/70">
                      <dt className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</dt>
                      <dd className="mt-1 text-sm font-black capitalize text-gray-900 dark:text-white">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="rounded-3xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 p-6 shadow-xl shadow-gray-100/10 dark:shadow-black/20">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 className="text-sm font-black text-gray-900 dark:text-white">Explainable ATS categories</h3>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Each score is independently traceable to issues and section-level evidence.
                    </p>
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wide text-gray-400">
                    {localMetrics.diagnosticCategories.length} categories
                  </span>
                </div>
                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {localMetrics.diagnosticCategories.map(category => (
                    <div key={category.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-black text-gray-900 dark:text-white">{category.label}</h4>
                          <p className="mt-1 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">{category.explanation}</p>
                        </div>
                        <span className="rounded-lg bg-white px-2 py-1 text-xs font-black text-gray-900 shadow-sm dark:bg-gray-950 dark:text-white">
                          {category.score}%
                        </span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                        <div className={`h-full rounded-full ${getProgressColor(category.score)}`} style={{ width: `${category.score}%` }} />
                      </div>
                      <p className="mt-3 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                        {category.issues.length} linked issue{category.issues.length === 1 ? '' : 's'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-xl shadow-gray-100/10 dark:border-gray-800 dark:bg-gray-950">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h3 className="text-sm font-black text-gray-900 dark:text-white">Issue drilldown</h3>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Expand any issue to inspect section, exact location, suggested fix, and score impact.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setIssueFilter('all')}
                        className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${issueFilter === 'all' ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-300'}`}
                      >
                        All issues
                      </button>
                      <button
                        type="button"
                        onClick={() => setIssueFilter('critical')}
                        className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${issueFilter === 'critical' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-200'}`}
                      >
                        Critical only
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSectionIssueFilter('all')}
                      className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${sectionIssueFilter === 'all' ? 'border-cyan-300 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-200' : 'border-gray-200 text-gray-500 dark:border-gray-800 dark:text-gray-400'}`}
                    >
                      All sections
                    </button>
                    {Array.from(new Set((localMetrics.diagnosticIssues || []).map(issue => issue.affectedSection))).slice(0, 12).map(section => (
                      <button
                        key={section}
                        type="button"
                        onClick={() => setSectionIssueFilter(section)}
                        className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${sectionIssueFilter === section ? 'border-cyan-300 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-200' : 'border-gray-200 text-gray-500 dark:border-gray-800 dark:text-gray-400'}`}
                      >
                        {section}
                      </button>
                    ))}
                  </div>
                  <div className="mt-5 space-y-4">
                    {Object.entries(groupedDiagnosticIssues).length > 0 ? Object.entries(groupedDiagnosticIssues).map(([category, issues]) => (
                      <div key={category} className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <h4 className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">{category}</h4>
                          <span className="text-[10px] font-bold text-gray-400">{issues.length} issues</span>
                        </div>
                        <div className="space-y-2">
                          {issues.map(issue => {
                            const expanded = expandedIssueIds.includes(issue.id);
                            return (
                              <div key={issue.id} className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
                                <button
                                  type="button"
                                  onClick={() => toggleIssueExpanded(issue.id)}
                                  className="flex w-full items-start justify-between gap-3 p-3 text-left"
                                >
                                  <div>
                                    <div className="text-xs font-black text-gray-900 dark:text-white">{issue.title}</div>
                                    <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                                      {issue.affectedSection} · {issue.location}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                                      issue.severity === 'high'
                                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                                        : issue.severity === 'medium'
                                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                    }`}>
                                      {issue.severity}
                                    </span>
                                    <ChevronRight className={`h-4 w-4 text-gray-400 transition ${expanded ? 'rotate-90' : ''}`} />
                                  </div>
                                </button>
                                {expanded && (
                                  <div className="border-t border-gray-100 px-3 py-3 text-[11px] leading-relaxed text-gray-600 dark:border-gray-800 dark:text-gray-300">
                                    <p><span className="font-bold text-gray-900 dark:text-white">Problem:</span> {issue.explanation}</p>
                                    <p className="mt-2"><span className="font-bold text-gray-900 dark:text-white">Suggested fix:</span> {issue.suggestedFix}</p>
                                    <p className="mt-2"><span className="font-bold text-gray-900 dark:text-white">Impact on score:</span> -{issue.impact} points</p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )) : (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/10 dark:text-emerald-200">
                        No issues match the current filters.
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-xl shadow-gray-100/10 dark:border-gray-800 dark:bg-gray-950">
                    <h3 className="text-sm font-black text-gray-900 dark:text-white">Language quality signals</h3>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      {[
                        ['Spelling accuracy', localMetrics.languageAnalysis.spellingAccuracy],
                        ['Grammar correctness', localMetrics.languageAnalysis.grammarCorrectness],
                        ['Readability', localMetrics.languageAnalysis.readability],
                        ['Clarity', localMetrics.languageAnalysis.clarity],
                      ].map(([label, value]) => (
                        <div key={String(label)} className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900">
                          <span className="block text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</span>
                          <span className="mt-1 block text-lg font-black text-gray-900 dark:text-white">{value}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-xl shadow-gray-100/10 dark:border-gray-800 dark:bg-gray-950">
                    <h3 className="text-sm font-black text-gray-900 dark:text-white">Layout intelligence</h3>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      {[
                        ['Line density', localMetrics.layoutAnalysis.estimatedLineDensity],
                        ['Section weight', localMetrics.layoutAnalysis.sectionSizeWeight],
                        ['Scaling factor', localMetrics.layoutAnalysis.templateScalingFactor],
                        ['Columns', `${localMetrics.layoutAnalysis.detectedColumns} / ${localMetrics.layoutAnalysis.expectedColumns}`],
                      ].map(([label, value]) => (
                        <div key={String(label)} className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900">
                          <span className="block text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</span>
                          <span className="mt-1 block text-sm font-black capitalize text-gray-900 dark:text-white">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-xl shadow-gray-100/10 dark:border-gray-800 dark:bg-gray-950">
                    <h3 className="text-sm font-black text-gray-900 dark:text-white">Responsiveness</h3>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      {[
                        ['Overall', localMetrics.responsivenessAnalysis.score],
                        ['Mobile', localMetrics.responsivenessAnalysis.mobileScore],
                        ['Tablet', localMetrics.responsivenessAnalysis.tabletScore],
                        ['Overflow risk', localMetrics.responsivenessAnalysis.textOverflowRisk],
                        ['Column collapse', localMetrics.responsivenessAnalysis.columnCollapseRisk],
                      ].map(([label, value]) => (
                        <div key={String(label)} className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900">
                          <span className="block text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</span>
                          <span className="mt-1 block text-sm font-black capitalize text-gray-900 dark:text-white">{value}</span>
                        </div>
                      ))}
                    </div>
                    {localMetrics.responsivenessAnalysis.notes.length > 0 && (
                      <ul className="mt-4 space-y-1 text-[11px] text-gray-600 dark:text-gray-300">
                        {localMetrics.responsivenessAnalysis.notes.map(note => <li key={note}>{note}</li>)}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 p-6 shadow-xl shadow-gray-100/10 dark:shadow-black/20">
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">ATS readiness breakdown</h3>
                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ['Parsing / structure', localMetrics.breakdown.parsing],
                    ['Contact visibility', localMetrics.breakdown.contact],
                    ['Section completeness', localMetrics.breakdown.completeness],
                    ['Skills coverage', localMetrics.breakdown.skills],
                    ['Experience strength', localMetrics.breakdown.experience],
                    ['Project quality', localMetrics.breakdown.projects],
                    ['Readability', localMetrics.breakdown.readability],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900">
                      <span className="block text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</span>
                      <span className="mt-1 block text-xl font-black text-gray-900 dark:text-white">{value}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-xl shadow-gray-100/10 dark:border-gray-800 dark:bg-gray-950">
                <div>
                  <h3 className="text-sm font-black text-gray-900 dark:text-white">Analysis modules</h3>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Independent evidence modules are validated first, then consolidated into the headline score.
                  </p>
                </div>
                <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {localMetrics.analysisModules.map(module => (
                    <div key={module.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="text-xs font-black text-gray-900 dark:text-white">{module.label}</span>
                          <p className="mt-1 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">{module.evidence}</p>
                        </div>
                        <span className={`rounded px-2 py-1 text-[9px] font-bold uppercase tracking-wide ${
                          module.status === 'passed'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                        }`}>
                          {module.score}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {scanType === 'targeted' && localMetrics.targetComparison && (
                <div className="rounded-3xl border border-teal-200 bg-teal-50/40 p-6 dark:border-teal-900/40 dark:bg-teal-950/10">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h3 className="text-sm font-black text-gray-900 dark:text-white">Resume vs Target</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Live evidence comparison against the supplied job description.</p>
                      <p className="mt-1 text-[11px] font-semibold text-teal-700 dark:text-teal-300">
                        Detected role family: {localMetrics.targetComparison.roleFamilyLabel}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-teal-700 dark:text-teal-300">
                      {localMetrics.matchScore}% aligned
                    </span>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
                    {[
                      ['Keywords', localMetrics.targetComparison.keywordOverlap],
                      ['Skills', localMetrics.targetComparison.skillAlignment],
                      ['Role', localMetrics.targetComparison.roleRelevance],
                      ['Experience', localMetrics.targetComparison.experienceEvidence],
                      ['Projects', localMetrics.targetComparison.projectEvidence],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="rounded-xl border border-teal-100 bg-white/80 p-3 dark:border-teal-900/30 dark:bg-gray-950/70">
                        <span className="block text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</span>
                        <span className="mt-1 block text-lg font-black text-gray-900 dark:text-white">{value}%</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-emerald-200 bg-white/80 p-4 dark:border-emerald-900/40 dark:bg-gray-950/70">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                        Strongly supported
                      </span>
                      {localMetrics.targetComparison.strongEvidence.length > 0 ? (
                        <ul className="mt-2 space-y-1 text-[11px] text-gray-700 dark:text-gray-300">
                          {localMetrics.targetComparison.strongEvidence.slice(0, 5).map(evidence => (
                            <li key={evidence}>{evidence}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-[11px] text-gray-500">No target terms have strong experience or project evidence yet.</p>
                      )}
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-white/80 p-4 dark:border-amber-900/40 dark:bg-gray-950/70">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                        Weakly supported
                      </span>
                      {localMetrics.targetComparison.weakEvidence.length > 0 ? (
                        <ul className="mt-2 space-y-1 text-[11px] text-gray-700 dark:text-gray-300">
                          {localMetrics.targetComparison.weakEvidence.slice(0, 5).map(evidence => (
                            <li key={evidence}>{evidence}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-[11px] text-gray-500">No skills-only or low-context matches were detected.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="rounded-3xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 p-6">
                  <h3 className="text-xs font-extrabold text-cyan-600 uppercase tracking-widest">Skill analysis</h3>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div><dt className="text-gray-400">{scanType === 'targeted' ? 'JD coverage' : 'Coverage'}</dt><dd className="font-black text-gray-900 dark:text-white">{localMetrics.skillAnalysis.coveragePercent}%</dd></div>
                    <div><dt className="text-gray-400">Diversity</dt><dd className="font-black text-gray-900 dark:text-white">{localMetrics.skillAnalysis.diversityScore}%</dd></div>
                    <div><dt className="text-gray-400">Template placement</dt><dd className="font-black capitalize text-gray-900 dark:text-white">{localMetrics.skillAnalysis.placement}</dd></div>
                    <div><dt className="text-gray-400">Visible</dt><dd className="font-black text-gray-900 dark:text-white">{localMetrics.skillAnalysis.visible ? 'Yes' : 'No'}</dd></div>
                  </dl>
                </div>
                <div className="rounded-3xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 p-6">
                  <h3 className="text-xs font-extrabold text-emerald-600 uppercase tracking-widest">Project analysis</h3>
                  <dl className="mt-4 grid grid-cols-3 gap-3 text-xs">
                    <div><dt className="text-gray-400">With links</dt><dd className="font-black text-gray-900 dark:text-white">{localMetrics.projectAnalysis.hasLinks}</dd></div>
                    <div><dt className="text-gray-400">Metrics</dt><dd className="font-black text-gray-900 dark:text-white">{localMetrics.projectAnalysis.hasMetrics}</dd></div>
                    <div><dt className="text-gray-400">Quality</dt><dd className="font-black text-gray-900 dark:text-white">{localMetrics.projectAnalysis.qualityScore}%</dd></div>
                  </dl>
                </div>
                <div className="rounded-3xl border border-amber-200 bg-amber-50/40 p-6 dark:border-amber-900/40 dark:bg-amber-950/10">
                  <h3 className="text-xs font-extrabold text-amber-700 uppercase tracking-widest">Warnings</h3>
                  {localMetrics.warnings.length > 0 ? (
                    <ul className="mt-3 space-y-1.5 text-[11px] leading-4 text-amber-900 dark:text-amber-200">
                      {localMetrics.warnings.map(warning => <li key={warning}>{warning}</li>)}
                    </ul>
                  ) : (
                    <p className="mt-3 text-xs text-gray-500">No structural warnings detected.</p>
                  )}
                </div>
              </div>

              {activeMode === 'preset' && selectedPresetResume?.languageQuality && (
                <div className="rounded-3xl border border-teal-200 bg-teal-50/40 p-6 dark:border-teal-900/40 dark:bg-teal-950/10">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h3 className="text-sm font-black text-gray-900 dark:text-white">Language readiness</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Live spelling, grammar, and clarity signals synced from the resume editor.
                      </p>
                    </div>
                    <span className="text-sm font-black text-teal-700 dark:text-teal-300">
                      {selectedPresetResume.languageQuality.score}/100
                    </span>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
                    {[
                      ['Issues', selectedPresetResume.languageQuality.summary.total],
                      ['Spelling', selectedPresetResume.languageQuality.summary.spelling],
                      ['Grammar', selectedPresetResume.languageQuality.summary.grammar],
                      ['Clarity', selectedPresetResume.languageQuality.summary.clarity],
                      ['High severity', selectedPresetResume.languageQuality.summary.highSeverity],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="rounded-xl border border-teal-100 bg-white/80 p-3 dark:border-teal-900/30 dark:bg-gray-950/70">
                        <span className="block text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</span>
                        <span className="mt-1 block text-lg font-black text-gray-900 dark:text-white">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {localMetrics.missingItems.length > 0 && (
                <div className="rounded-3xl border border-amber-200 bg-amber-50/40 p-6 dark:border-amber-900/40 dark:bg-amber-950/10">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-amber-700">Missing items</h3>
                  <ul className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                    {localMetrics.missingItems.map(item => (
                      <li key={item} className="text-xs leading-relaxed text-amber-900 dark:text-amber-200">{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* LOCAL MATCH DETAIL PANELS (Skills & Keywords) */}
              {scanType === 'targeted' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* SKILLS PANEL */}
                <div className="rounded-3xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 p-6 shadow-xl">
                  <h3 className="text-xs font-extrabold text-indigo-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Award className="w-4 h-4" />
                    <span>{scanType === 'general' ? 'Skills Coverage & Evidence' : 'Technical Skills Coverage'}</span>
                  </h3>
                  <div className="mb-4 grid grid-cols-3 gap-2">
                    {[
                      ['JD coverage', localMetrics.skillAnalysis.coveragePercent],
                      ['Diversity', localMetrics.skillAnalysis.diversityScore],
                      ['Project quality', localMetrics.projectAnalysis.qualityScore],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="rounded-lg bg-gray-50 p-2 text-center dark:bg-gray-900">
                        <span className="block text-[9px] font-bold uppercase tracking-wide text-gray-400">{label}</span>
                        <span className="text-sm font-black text-gray-900 dark:text-white">{value}%</span>
                      </div>
                    ))}
                  </div>
                  
                  {localMetrics.targetComparison && localMetrics.targetComparison.missingCriticalSkills.length > 0 ? (
                    <div className="space-y-4">
                      <div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Missing Skills List</div>
                        <div className="flex flex-wrap gap-1.5">
                          {localMetrics.targetComparison.missingCriticalSkills.slice(0, 15).map((sk: string, idx: number) => (
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
                    <span>{scanType === 'general' ? 'Evidence Ledger' : 'Positional Keyword Gaps'}</span>
                  </h3>
                  {[...localMetrics.keywordGaps.strongCoverage, ...localMetrics.keywordGaps.weakCoverage].length > 0 && (
                    <div className="mb-4 space-y-1.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        {scanType === 'general' ? 'Detected evidence by section' : 'Highest-priority evidence'}
                      </div>
                      {[
                        ...localMetrics.keywordGaps.strongCoverage.map(keyword => ({ keyword, weight: 'Strong', matchType: 'coverage' })),
                        ...localMetrics.keywordGaps.weakCoverage.map(keyword => ({ keyword, weight: 'Weak', matchType: 'coverage' })),
                      ].slice(0, 6).map(keyword => (
                        <div key={keyword.keyword} className="flex items-center justify-between gap-3 text-[11px]">
                          <span className="font-semibold text-emerald-700">
                            {keyword.keyword}
                          </span>
                          <span className="text-gray-400">
                            Weight {keyword.weight} · {keyword.matchType}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {localMetrics.targetComparison && localMetrics.targetComparison.positionalKeywords.length > 0 && (
                    <div className="mb-4">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Positional keywords</div>
                      <ul className="mt-2 space-y-1 text-[11px] text-gray-600 dark:text-gray-400">
                        {localMetrics.targetComparison.positionalKeywords.slice(0, 8).map(keyword => (
                          <li key={keyword}>{keyword}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {localMetrics.keywordGaps.missing.length > 0 ? (
                    <div className="space-y-4">
                      <div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Missing POSITIONAL Keywords</div>
                        <div className="flex flex-wrap gap-1.5">
                          {localMetrics.keywordGaps.missing.slice(0, 15).map((kw: string, idx: number) => (
                            <span key={idx} className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/35 text-amber-600 dark:text-amber-450 text-[10px] font-extrabold px-2.5 py-1 rounded">
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">
                      {scanType === 'general'
                        ? 'No unsupported critical evidence gaps were detected.'
                        : 'Key terms have complete overlap with the resume evidence.'}
                    </p>
                  )}
                </div>
              </div>
              )}

              {/* INFORMATIONAL EXPLANATIONS OF THE DETERMINISTIC RESULT */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* STRENGTHS */}
                <div className="rounded-3xl border border-emerald-100 dark:border-emerald-950/20 bg-emerald-50/20 dark:bg-emerald-950/5 p-6 shadow-sm">
                  <h3 className="text-xs font-extrabold text-emerald-650 dark:text-emerald-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <CheckCircle className="w-4.5 h-4.5 text-emerald-550" />
                    <span>Strong keyword evidence</span>
                  </h3>
                  <ul className="space-y-3">
                    {presentationReport.strengths.map((str: string, idx: number) => (
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
                    <span>Warnings and gaps</span>
                  </h3>
                  <ul className="space-y-3">
                    {presentationReport.weaknesses.map((wk: string, idx: number) => (
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
                  {presentationReport.recommendations.map((rec: string, idx: number) => (
                    <li key={idx} className="flex gap-3 text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                      <span className="w-5 h-5 bg-indigo-50 dark:bg-indigo-950 text-indigo-650 dark:text-indigo-450 rounded flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>

                {/* EXPERT ADVICE STATEMENT */}
                {presentationReport.atsOptimizationAdvice && (
                  <div className="mt-6 p-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-150 dark:border-gray-850 text-xs text-gray-600 dark:text-gray-400 italic leading-relaxed">
                    <Quote className="w-4.5 h-4.5 text-indigo-400 shrink-0 mb-1 inline mr-1" />
                    {presentationReport.atsOptimizationAdvice}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
