import { lazy, Suspense, useEffect, useMemo } from 'react';
import { ArrowRight, Check, Loader2, X } from 'lucide-react';
import { ResumeData, TemplateId } from '../types';
import { normalizeResume } from '../utils';

const TemplateActualPreview = lazy(() => import('./TemplateActualPreview'));

export const TEMPLATE_LABELS: Record<TemplateId, string> = {
  modern: 'Modern Professional', minimal: 'Minimal Elegant', corporate: 'Corporate Standard',
  executive: 'Executive Boardroom', creative: 'Creative Dynamic', atsFriendly: 'Clean Single Column',
  softwareEngineer: 'Software Engineer Special', student: 'Student / Academic', startup: 'Startup Growth',
  designer: 'Designer Portfolio', dataAnalyst: 'Metrics & Data Analyst', classic: 'Classic Editorial',
};

export const TEMPLATE_IDS = Object.keys(TEMPLATE_LABELS) as TemplateId[];
export const VISIBLE_TEMPLATE_IDS: TemplateId[] = [
  'modern', 'minimal', 'corporate', 'executive', 'creative', 'atsFriendly',
  'softwareEngineer', 'student', 'startup', 'dataAnalyst', 'classic',
];

export function TemplateSample({ templateId }: { templateId: TemplateId }) {
  const accent = templateId === 'corporate' || templateId === 'classic' || templateId === 'atsFriendly'
    ? 'bg-zinc-700' : templateId === 'creative'
      ? 'bg-sky-500' : templateId === 'executive' ? 'bg-amber-700' : 'bg-emerald-500';
  const hasRail = ['modern', 'creative', 'dataAnalyst'].includes(templateId);

  return (
    <div className="aspect-[1/1.28] overflow-hidden rounded-md bg-white p-3 text-left text-slate-800 shadow-sm" aria-hidden="true">
      <div className={`h-2 rounded-sm ${accent}`} />
      <div className="mt-3 text-[9px] font-black leading-none">JOHN DOE</div>
      <div className="mt-1 text-[5px] text-slate-500">Software Engineer · john@example.com · Austin, TX</div>
      <div className={`mt-3 grid gap-2 ${hasRail ? 'grid-cols-[28%_1fr]' : 'grid-cols-1'}`}>
        {hasRail && <div className="rounded-sm bg-slate-100 p-1.5 text-[4px] leading-tight"><b>SKILLS</b><p className="mt-1">TypeScript<br />React<br />Node.js<br />PostgreSQL</p></div>}
        <div className="text-[4px] leading-tight">
          <b className="block text-[5px] uppercase">Experience</b><p className="mt-1 font-semibold">Senior Software Engineer</p><p>Built reliable products for 50K+ users.</p>
          <b className="mt-2 block text-[5px] uppercase">Projects</b><p className="mt-1 font-semibold">Developer Analytics Platform</p><p>React · TypeScript · Firebase</p>
          <b className="mt-2 block text-[5px] uppercase">Education</b><p className="mt-1">B.S. Computer Science</p>
        </div>
      </div>
    </div>
  );
}

interface TemplateShowcaseProps {
  selectedTemplate: TemplateId;
  onSelect: (templateId: TemplateId) => void;
  onStart: () => void;
  onClose: () => void;
}

export const createJohnDoeResume = (templateId: TemplateId): ResumeData => normalizeResume({
  id: `template-preview-${templateId}`, ownerId: 'preview', userId: 'preview', title: `${TEMPLATE_LABELS[templateId]} Preview`, templateId,
  linkDisplayMode: 'embedded', useProfilePhoto: false, sectionOrderMode: 'template',
  personalDetails: { fullName: 'John Doe', professionalTitle: 'Senior Software Engineer', email: 'john.doe@example.com', phone: '+1 512 555 0142', location: 'Austin, Texas', linkedin: 'linkedin.com/in/johndoe', github: 'github.com/johndoe', website: 'johndoe.dev' },
  summary: 'Product-focused software engineer with five years of experience building reliable web applications, improving platform performance, and collaborating with cross-functional teams to deliver measurable customer outcomes.',
  experience: [
    { id: 'exp-1', title: 'Senior Software Engineer', company: 'Northstar Labs', location: 'Austin, TX', startDate: 'Jan 2023', endDate: 'Present', description: 'Led development of a customer analytics platform used by 50,000+ users. Reduced dashboard load time by 38% through query optimization and frontend caching. Mentored four engineers and introduced automated release checks.' },
    { id: 'exp-2', title: 'Software Engineer', company: 'Cedar Systems', location: 'Remote', startDate: 'Jun 2020', endDate: 'Dec 2022', description: 'Built accessible React workflows and Node.js services for enterprise customers. Increased test coverage from 62% to 88% and shortened release verification from two hours to twenty minutes.' },
  ],
  education: [{ id: 'edu-1', degree: 'Bachelor of Science in Computer Science', institution: 'University of Texas', location: 'Austin, TX', startDate: '2016', endDate: '2020', gpa: '3.8', scoreType: 'gpa', description: 'Coursework in distributed systems, databases, algorithms, and human-computer interaction.' }],
  projects: [
    { id: 'project-1', name: 'Developer Analytics Platform', startDate: '2024', endDate: 'Present', technologies: 'React, TypeScript, Node.js, PostgreSQL, Docker', github: 'github.com/johndoe/dev-analytics', live: 'analytics.johndoe.dev', description: 'Designed a privacy-focused dashboard that consolidates deployment and application health metrics. Implemented role-based access, background processing, and responsive data visualization.' },
    { id: 'project-2', name: 'Community Mentorship Portal', startDate: '2023', endDate: '2024', technologies: 'Next.js, Firebase, Tailwind CSS', github: 'github.com/johndoe/mentor-portal', live: 'mentor.johndoe.dev', description: 'Created a scheduling and resource platform connecting early-career developers with volunteer mentors.' },
  ],
  skills: { programmingLanguages: ['TypeScript', 'JavaScript', 'Python', 'SQL'], frameworks: ['React', 'Next.js', 'Node.js', 'Express'], tools: ['Git', 'Docker', 'GitHub Actions', 'Figma'], databases: ['PostgreSQL', 'Firebase', 'Redis'], softSkills: ['Technical leadership', 'Mentoring', 'Cross-functional collaboration'] },
  certifications: [{ id: 'cert-1', name: 'Professional Cloud Developer', issuer: 'Google Cloud', date: '2024', url: 'cloud.google.com/certification' }],
  achievements: ['Reduced production incident recovery time by 45% through observability improvements.', 'Presented frontend performance practices to an engineering organization of 80+ people.'],
  volunteering: [], languages: ['English — Native', 'Spanish — Conversational'], customSections: [], hiddenSections: [], isArchived: false,
  createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z',
});

export default function TemplateShowcase({ selectedTemplate, onSelect, onStart, onClose }: TemplateShowcaseProps) {
  const previewResume = useMemo(() => createJohnDoeResume(selectedTemplate), [selectedTemplate]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-2 sm:p-6" role="presentation" onMouseDown={onClose}>
    <section role="dialog" aria-modal="true" aria-labelledby="template-showcase-title" className="flex h-[calc(100dvh-1rem)] max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-[#2A2E37] bg-[#171A21] p-3 shadow-2xl sm:h-auto sm:p-6" onMouseDown={event => event.stopPropagation()}>
      <div className="mb-4 flex shrink-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
        <span className="forge-eyebrow">Template gallery</span>
        <h2 id="template-showcase-title" className="mt-2 text-2xl font-bold text-white">Choose a template</h2>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">Select a style to load its complete John Doe resume through the real PDF renderer.</p>
        <p className="mt-1 text-xs font-semibold text-emerald-300">Selected: {TEMPLATE_LABELS[selectedTemplate]}</p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:w-auto">
          <button type="button" onClick={onClose} className="forge-secondary-button min-w-0"><X /> Close</button>
          <button type="button" onClick={onStart} className="forge-primary-button min-w-0"><Check /> <span className="truncate">Use {TEMPLATE_LABELS[selectedTemplate]}</span></button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto xl:grid xl:grid-cols-[280px_minmax(0,1fr)] xl:gap-5 xl:overflow-hidden">
        <div className="flex shrink-0 gap-2 overflow-x-auto pb-2 xl:grid xl:grid-cols-1 xl:overflow-y-auto xl:overflow-x-hidden xl:pr-1" aria-label="Available resume templates">
          {VISIBLE_TEMPLATE_IDS.map(templateId => (
            <button key={templateId} type="button" onClick={() => onSelect(templateId)} aria-pressed={selectedTemplate === templateId} className={`flex min-w-[160px] max-w-[190px] items-center gap-3 rounded-xl border p-2 text-left transition xl:min-w-0 xl:max-w-none ${selectedTemplate === templateId ? 'border-emerald-400 bg-emerald-400/10' : 'border-[#2A2E37] bg-[#0F1115] hover:border-zinc-600'}`}>
              <div className="w-16 shrink-0"><TemplateSample templateId={templateId} /></div>
              <div className="min-w-0"><strong className="block truncate text-xs text-white">{TEMPLATE_LABELS[templateId]}</strong><span className="mt-1 flex items-center gap-1 text-[10px] text-zinc-500">Preview <ArrowRight className="h-3 w-3" /></span></div>
            </button>
          ))}
        </div>
        <Suspense fallback={<div className="flex min-h-[620px] items-center justify-center gap-3 rounded-2xl border border-[#2A3644] bg-[#0B0F14] text-sm text-zinc-200"><Loader2 className="h-5 w-5 animate-spin text-emerald-300" /> Loading the original template…</div>}>
          <TemplateActualPreview resume={previewResume} templateId={selectedTemplate} templateName={TEMPLATE_LABELS[selectedTemplate]} />
        </Suspense>
      </div>
    </section>
    </div>
  );
}
