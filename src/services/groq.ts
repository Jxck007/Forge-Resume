import { ResumeData, UserSettings, ProfileData } from '../types';
import { callAIUnified, cleanJsonOutput } from './ai';

// 1. IMPROVE SUMMARY
export async function aiImproveSummary(
  settings: UserSettings,
  currentSummary: string,
  action: 'improve' | 'shorten' | 'expand' | 'ats',
  jobTitle?: string
): Promise<string> {
  const systemPrompt = `You are an expert executive resume writer and ATS systems engineer.
  Your task is to ${action === 'ats' ? 'optimize' : action} the candidate's professional resume summary.
  
  STRICT COMPLIANCE RULES:
  1. WORD LIMIT: The optimized summary MUST be a maximum of 100 words.
  2. ABSOLUTELY NO INVENTION: Never invent any achievements, technologies, or experience.
  3. PRESERVATION: Only preserve and format the user's actual skills based strictly on the provided summary.
  4. NO placeholders: Use "No significant ATS improvement needed" if it's already perfect.
  
  ${action === 'ats' ? `Response MUST be a single JSON object (no markdown):
  {
    "original": "${currentSummary.substring(0, 50)}...",
    "optimized": "Improved version",
    "whatChanged": ["specific detail"]
  }` : ''}`;

  const userPrompt = `Content: "${currentSummary}"${jobTitle ? `\nTarget Position: "${jobTitle}"` : ''}\nAction: ${action}`;
  return await callAIUnified(settings, systemPrompt, userPrompt, action === 'ats');
}

// 2. IMPROVE EXPERIENCE
export async function aiImproveExperience(
  settings: UserSettings,
  description: string,
  action: 'improve' | 'professional' | 'metrics' | 'ats'
): Promise<string> {
  const isAts = action === 'ats';
  const systemPrompt = `You are a professional resume consultant. Use the STAR method or Google's X-Y-Z formula. 
  Focus ONLY on the text provided. Do not add generic experience.
  If no improvement is needed, specify "No significant ATS improvement needed."
  
  ${isAts ? `Required JSON format (no markdown):
  {
    "original": "${description.substring(0, 50)}...",
    "optimized": "The improved bullet point",
    "explanation": "Why this is better for ATS"
  }` : 'Return ONLY the improved string, no preamble.'}`;

  const userPrompt = `Bullet Point: "${description}"\nOptimization Goal: ${action}`;
  const res = await callAIUnified(settings, systemPrompt, userPrompt, isAts);
  return isAts ? cleanJsonOutput(res) : res;
}

// 3. IMPROVE PROJECTS
export async function aiImproveProject(
  settings: UserSettings, 
  description: string, 
  action: 'rewrite' | 'ats'
): Promise<string> {
  const isAts = action === 'ats';
  const systemPrompt = `You are an elite tech recruiter. Optimize the technical project description.
  ${isAts ? `Required JSON format (no markdown):
  {
    "original": "${description.substring(0, 50)}...",
    "optimized": "Improved project description",
    "explanation": "Rationale"
  }` : 'Return ONLY the improved string, no preamble.'}`;
  
  const userPrompt = `Project: "${description}"\nAction: ${action}`;
  const res = await callAIUnified(settings, systemPrompt, userPrompt, isAts);
  return isAts ? cleanJsonOutput(res) : res;
}

// 4. DEEP ATS EVALUATION
export interface GroqDeepAtsResponse {
  strengths: string[];
  weaknesses: string[];
  missingKeywords: string[];
  missingSkills: string[];
  recommendations: string[];
  atsOptimizationAdvice: string;
  rewriteRecommendations: Array<{
    original: string;
    optimized: string;
    explanation: string;
  }>;
}

export async function aiDeepAnalyzeAtsWithGroq(
  settings: UserSettings,
  parsedResume: ProfileData,
  jobDescription: string,
  localMetrics: any
): Promise<GroqDeepAtsResponse> {
  const systemPrompt = `You are an ATS recruitment expert. Analyze the resume vs JD.
  Focus on alignment and compliance.
  
  Required JSON format (no markdown):
  {
    "strengths": ["list"],
    "weaknesses": ["list"],
    "missingKeywords": ["list"],
    "missingSkills": ["list"],
    "recommendations": ["list"],
    "atsOptimizationAdvice": "summary",
    "rewriteRecommendations": [
      {
        "original": "text",
        "optimized": "improved text",
        "explanation": "detail"
      }
    ]
  }`;
  
  // Token optimization: Send only essential structure
  const summaryContext = {
    title: parsedResume.personalDetails.professionalTitle,
    summary: parsedResume.summary,
    skills: parsedResume.skills,
    experience: parsedResume.experience.map(e => ({ title: e.title, desc: e.description })),
  };

  const userPrompt = `
  JD: ${jobDescription.substring(0, 2000)}
  RESUME: ${JSON.stringify(summaryContext)}
  METRICS: ${JSON.stringify(localMetrics)}
  `;

  const rawJson = await callAIUnified(settings, systemPrompt, userPrompt, true);
  try {
    const cleaned = cleanJsonOutput(rawJson);
    return JSON.parse(cleaned) as GroqDeepAtsResponse;
  } catch (err) {
    console.error('Failed parsing Deep ATS JSON response:', err);
    return {
      strengths: ['Profile identified'],
      weaknesses: ['Enhancement recommended'],
      missingKeywords: localMetrics.missingKeywords || [],
      missingSkills: localMetrics.missingSkills || [],
      recommendations: ['Optimize keywords'],
      atsOptimizationAdvice: 'Review alignment scoring.',
      rewriteRecommendations: []
    };
  }
}

// 5. RESUME PARSE
export async function aiParseResume(settings: UserSettings, rawText: string): Promise<Partial<ResumeData>> {
  const systemPrompt = `Extract resume content into structured JSON.
  RAW TEXT: ${rawText.substring(0, 5000)}
  `;
  const userPrompt = `Parse into JSON. Ensure all sections match the schema.`;
  const rawJson = await callAIUnified(settings, systemPrompt, userPrompt, true);
  return JSON.parse(cleanJsonOutput(rawJson)) as Partial<ResumeData>;
}

export async function testGroqConnection(settings: UserSettings): Promise<boolean> {
  try {
    await callAIUnified(settings, 'test', 'hi');
    return true;
  } catch {
    return false;
  }
}
