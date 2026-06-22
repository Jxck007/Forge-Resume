import type { NormalizedResume } from '../../schema/resumeSchema';
import type { UserSettings } from '../../types';
import { createAiProvider, hasAiProviderConfigured } from '../../services/aiProvider';
import { buildAtsIntelligencePrompt } from '../../utils/atsAiPrompts';
import { AtsIntelligencePayload, atsIntelligenceSchema } from '../../utils/atsAiValidators';
import type { AtsStageStatus } from '../core/types';

export interface AiJobMatchInput {
  resume: NormalizedResume;
  jobDescription: string;
  settings?: UserSettings | null;
}

export interface AiJobMatchExecution {
  status: Extract<AtsStageStatus, 'ready' | 'needs_ai' | 'needs_job_description' | 'error'>;
  message: string;
  payload: AtsIntelligencePayload | null;
}

export async function runAiJobMatch(input: AiJobMatchInput): Promise<AiJobMatchExecution> {
  if (!hasAiProviderConfigured(input.settings)) {
    return {
      status: 'needs_ai',
      message: 'Connect an AI provider to run semantic job matching.',
      payload: null,
    };
  }
  if (!input.jobDescription.trim()) {
    return {
      status: 'needs_job_description',
      message: 'Add a job description to compare your resume against this role.',
      payload: null,
    };
  }

  const provider = createAiProvider(input.settings);
  if (!provider) {
    return { status: 'needs_ai', message: 'Connect an AI provider to run semantic job matching.', payload: null };
  }

  try {
    const payload = await provider.generateJson(
      buildAtsIntelligencePrompt(input.resume, input.jobDescription),
      atsIntelligenceSchema
    );
    return { status: 'ready', message: payload.jobMatch.roleFitSummary, payload };
  } catch {
    return {
      status: 'error',
      message: 'AI analysis temporarily unavailable. Local readability checks are still available.',
      payload: null,
    };
  }
}
