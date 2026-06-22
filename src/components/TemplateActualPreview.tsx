import { useEffect, useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { Loader2 } from 'lucide-react';
import { ResumeData, TemplateId } from '../types';
import ResumePdfDocument from './ResumePdfDocument';

interface TemplateActualPreviewProps {
  resume: ResumeData;
  templateId: TemplateId;
  templateName: string;
}

export default function TemplateActualPreview({ resume, templateId, templateName }: TemplateActualPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let url = '';
    setFailed(false);
    setPreviewUrl('');
    pdf(<ResumePdfDocument resume={resume} templateId={templateId} mode="multi" />).toBlob()
      .then(blob => {
        if (!active) return;
        url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [resume, templateId]);

  return (
    <div className="flex min-h-[620px] flex-col overflow-hidden rounded-2xl border border-[#2A3644] bg-[#11151B]">
        <div className="border-b border-[#2A3644] px-4 py-3 sm:px-5">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300">Original renderer preview</span><h3 className="mt-1 text-base font-bold text-white">{templateName}</h3>
        </div>
        <div className="min-h-[560px] flex-1 bg-[#070A0C] p-2 sm:p-4">
          {previewUrl ? (
            <iframe src={`${previewUrl}#toolbar=0&navpanes=0&view=FitH`} title={`${templateName} John Doe preview`} className="h-full w-full rounded-lg bg-white" />
          ) : failed ? (
            <div className="flex h-full items-center justify-center text-sm text-rose-200">The template preview could not be rendered. Please try again.</div>
          ) : (
            <div className="flex h-full items-center justify-center gap-3 text-sm text-zinc-300" role="status"><Loader2 className="h-5 w-5 animate-spin text-emerald-300" /> Rendering the original template…</div>
          )}
        </div>
    </div>
  );
}
