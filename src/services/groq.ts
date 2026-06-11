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
  const systemPrompt = `You are an expert ATS recruitment consultant and resume analyst.

CRITICAL INTEGRITY RULES — NEVER VIOLATE THESE:
1. NEVER invent, fabricate, or assume any achievements, certifications, technologies, or work experience that are NOT explicitly present in the provided resume content.
2. NEVER suggest adding skills, tools, or qualifications the candidate has not demonstrated in their resume.
3. ONLY suggest rewording or restructuring existing content to be more ATS-friendly — do NOT add new substance.
4. Keep all recommendations concise, specific, human-readable, and ATS-compliant.
5. Rewrite recommendations must be based solely on the candidate's actual existing bullet points — do NOT fabricate new metrics or accomplishments.
6. If no rewrite is genuinely needed, return an empty rewriteRecommendations array.

Your task: Compare the candidate's resume against the provided job description. Identify genuine strengths, real gaps, and actionable (non-fabricating) improvements.

Required JSON format (no markdown):
{
  "strengths": ["specific strength found in resume"],
  "weaknesses": ["genuine gap or missing element"],
  "missingKeywords": ["keywords from JD not found in resume"],
  "missingSkills": ["skills required by JD not present in resume"],
  "recommendations": ["actionable, non-fabricating improvement advice"],
  "atsOptimizationAdvice": "overall strategic advice based only on what exists",
  "rewriteRecommendations": [
    {
      "original": "exact text from resume",
      "optimized": "same content reworded for ATS clarity",
      "explanation": "why this phrasing improves ATS parsing"
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
  const systemPrompt = `You are a strict resume parser. Extract only information present in the source text.

Return one JSON object using this exact schema. Every collection field MUST be a JSON array, even when it has zero or one item:
{
  "title": "",
  "personalDetails": {
    "fullName": "",
    "professionalTitle": "",
    "email": "",
    "phone": "",
    "location": "",
    "linkedin": "",
    "github": "",
    "website": ""
  },
  "summary": "",
  "education": [
    { "degree": "", "institution": "", "location": "", "startDate": "", "endDate": "", "gpa": "", "description": "" }
  ],
  "experience": [
    { "title": "", "company": "", "location": "", "startDate": "", "endDate": "", "description": "" }
  ],
  "internships": [
    { "role": "", "company": "", "location": "", "startDate": "", "endDate": "", "description": "", "technologiesUsed": "" }
  ],
  "projects": [
    { "name": "", "description": "", "technologies": "", "github": "", "live": "" }
  ],
  "skills": {
    "programmingLanguages": [],
    "frameworks": [],
    "tools": [],
    "databases": [],
    "softSkills": []
  },
  "certifications": [
    { "name": "", "issuer": "", "date": "", "url": "" }
  ],
  "achievements": [],
  "volunteering": [],
  "languages": []
}`;
  const userPrompt = `Parse this resume text into the required JSON schema:\n\n${rawText.substring(0, 10000)}`;
  const rawJson = await callAIUnified(settings, systemPrompt, userPrompt, true);
  try {
    const parsed = JSON.parse(cleanJsonOutput(rawJson));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('The AI returned an invalid root value.');
    }
    return parsed as Partial<ResumeData>;
  } catch (err) {
    console.error('Failed to parse resume import JSON:', err);
    throw new Error('AI returned invalid resume data. No resume was created. Please try the import again.');
  }
}

// 6. PROFILE IMPORT PARSE
export async function aiParseProfileImport(
  settings: UserSettings,
  rawText: string
): Promise<Partial<ProfileData>> {
  const systemPrompt = `You are an expert resume parser. Extract ALL information from the resume text below into a structured JSON object.

STRICT COMPLIANCE RULES:
1. NEVER fabricate, invent, or assume any data not explicitly present in the text.
2. Extract ONLY what is actually written in the provided text.
3. If a section is not found, return an empty array or empty string for that field.
4. For bullet points in experience/internships/projects, join them with newlines into the description field.
5. For skills, categorize intelligently: programming languages vs frameworks vs tools vs databases vs softSkills.
6. Achievements should be a flat string array — each achievement one entry.
7. Languages spoken should be a flat string array (e.g., ["English (Fluent)", "French (Intermediate)"]).

Required JSON format (no markdown, strict JSON only):
{
  "personalDetails": {
    "fullName": "",
    "professionalTitle": "",
    "email": "",
    "phone": "",
    "location": "",
    "linkedin": "",
    "github": "",
    "website": ""
  },
  "summary": "",
  "careerObjective": "",
  "experience": [
    { "title": "", "company": "", "location": "", "startDate": "", "endDate": "", "description": "" }
  ],
  "internships": [
    { "role": "", "company": "", "location": "", "startDate": "", "endDate": "", "description": "", "technologiesUsed": "" }
  ],
  "education": [
    { "degree": "", "institution": "", "location": "", "startDate": "", "endDate": "", "gpa": "", "description": "" }
  ],
  "projects": [
    { "name": "", "description": "", "technologies": "", "github": "", "live": "" }
  ],
  "skills": {
    "programmingLanguages": [],
    "frameworks": [],
    "tools": [],
    "databases": [],
    "softSkills": []
  },
  "certifications": [
    { "name": "", "issuer": "", "date": "", "url": "" }
  ],
  "achievements": [],
  "languages": [],
  "volunteering": []
}`;

  const userPrompt = `Resume Text to Parse:\n\n${rawText.substring(0, 8000)}`;
  const rawJson = await callAIUnified(settings, systemPrompt, userPrompt, true);
  try {
    const cleaned = cleanJsonOutput(rawJson);
    return JSON.parse(cleaned) as Partial<ProfileData>;
  } catch (err) {
    console.error('Failed to parse profile import JSON:', err);
    throw new Error('AI could not parse the resume text into a structured format. Please check your AI provider settings.');
  }
}

export async function testGroqConnection(settings: UserSettings): Promise<boolean> {
  try {
    await callAIUnified(settings, 'test', 'hi');
    return true;
  } catch {
    return false;
  }
}
