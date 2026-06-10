import { ResumeData, AtsReport } from '../types';

interface GroqResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

// Low-level helper to invoke Groq API with user's provided API key
async function callGroqAPI(apiKey: string, systemPrompt: string, userPrompt: string, jsonMode = false): Promise<string> {
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('Please configure your Groq API Key in Settings to enable AI actions.');
  }

  let selectedModel = 'llama-3.3-70b-versatile';
  let customTemp = 0.3;
  try {
    const cachedSettings = localStorage.getItem('forge_user_settings');
    if (cachedSettings) {
      const parsed = JSON.parse(cachedSettings);
      if (parsed.modelId) {
        selectedModel = parsed.modelId;
      }
      if (parsed.temperature !== undefined) {
        customTemp = parsed.temperature;
      }
    }
  } catch (e) {
    // ignore
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: selectedModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: customTemp,
      response_format: jsonMode ? { type: 'json_object' } : undefined,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    let parsedErr;
    try {
      parsedErr = JSON.parse(errText);
    } catch {
      // ignore
    }
    const message = parsedErr?.error?.message || response.statusText || 'Unknown error';
    throw new Error(`Groq API Error: ${message}`);
  }

  const data = (await response.json()) as GroqResponse;
  return data.choices[0]?.message?.content || '';
}

// Clean markdown wrapper blocks from JSON strings if model outputs it
function cleanJsonOutput(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  return cleaned.trim();
}

// 1. IMPROVE SUMMARY
export async function aiImproveSummary(
  apiKey: string,
  currentSummary: string,
  action: 'improve' | 'shorten' | 'expand' | 'ats',
  jobTitle?: string
): Promise<string> {
  if (action === 'ats') {
    const systemPrompt = `You are an expert executive resume writer, hiring manager, and ATS systems engineer.
    Your task is to optimize the candidate's professional resume summary.
    
    STRICT COMPLIANCE RULES:
    1. WORD LIMIT: The optimized summary MUST be a maximum of 100 words.
    2. ABSOLUTELY NO INVENTION: Never invent any achievements, invent any technologies, invent any leadership experience, or invent any certifications.
    3. PRESERVATION: Only preserve and format the user's actual experience, projects, and skills based strictly on the provided summary.
    4. DESIGN: Improve readability and professional phrasing. It should improve readability, not create a completely new resume.
    
    You MUST respond with a single JSON object. Do not include markdown wraps or explanations.
    Required JSON format:
    {
      "original": "<the original summary text>",
      "optimized": "<the ATS-optimized summary text, maximum 100 words>",
      "whatChanged": ["<specific, honest bullet point of what was rephrased or pruned for readability and ATS alignment>"]
    }`;

    const userPrompt = `Optimize the following resume summary${jobTitle ? ` for a "${jobTitle}" position` : ''}: "${currentSummary}"`;
    const res = await callGroqAPI(apiKey, systemPrompt, userPrompt, true);
    return cleanJsonOutput(res);
  }

  const systemPrompt = `You are an expert executive resume writer and career branding specialist.`;
  let userPrompt = '';

  switch (action) {
    case 'improve':
      userPrompt = `Improve the following professional summary to make it highly engaging, impact-focused, and modern: "${currentSummary}"`;
      break;
    case 'shorten':
      userPrompt = `Shorten the following professional summary, making it punchy, concise (2 sentences max), while keeping its core value propositions: "${currentSummary}"`;
      break;
    case 'expand':
      userPrompt = `Expand the following professional resume summary, adding details about strategic leadership, cross-functional collaboration, and professional accomplishments: "${currentSummary}"`;
      break;
  }

  return await callGroqAPI(apiKey, systemPrompt, userPrompt);
}

// 2. IMPROVE EXPERIENCE BULLET POINT
export async function aiImproveExperience(
  apiKey: string,
  description: string,
  action: 'improve' | 'professional' | 'metrics' | 'ats'
): Promise<string> {
  const systemPrompt = `You are a professional resume resume consultant specializing in accomplishments over tasks. You write bullet points using the STAR method (Situation, Task, Action, Result) or Google's X-Y-Z formula ("Accomplished [X] as measured by [Y], by doing [Z]").`;
  let userPrompt = '';

  switch (action) {
    case 'improve':
      userPrompt = `Rewrite the following resume bullet points to be highly action-oriented and result-driven. Start each bullet point with a strong, diverse action verb and clearly structure it to highlight the business impact, achievement, or accomplishment: "${description}"`;
      break;
    case 'professional':
      userPrompt = `Make the following job outline sound highly executive, corporate, and professional: "${description}"`;
      break;
    case 'metrics':
      userPrompt = `Rewrite the following job bullet points to incorporate highly realistic industry-standard business metrics, percentage increases, times saved, or revenues generated: "${description}"`;
      break;
    case 'ats':
      userPrompt = `Optimize these job description bullets for Applicant Tracking Systems (ATS). Naturally integrate critical search keywords and industry skills while keeping the descriptions clear and readable: "${description}"`;
      break;
  }

  return await callGroqAPI(apiKey, systemPrompt, userPrompt);
}

// 3. IMPROVE PROJECTS
export async function aiImproveProject(apiKey: string, description: string, action: 'rewrite' | 'ats'): Promise<string> {
  const systemPrompt = `You are an elite developer and tech recruiter. You write project descriptions on resumes to reflect engineering excellence, problem-solving, architectural design, and modern technologies.`;
  
  const userPrompt = action === 'rewrite'
    ? `Rewrite the following project description to emphasize engineering challenges, scope, technologies, and achievements: "${description}"`
    : `ATS optimize the following tech project descriptions by naturally embedding modern tech stack terms, keywords, and practical metrics: "${description}"`;

  return await callGroqAPI(apiKey, systemPrompt, userPrompt);
}

// 4. ATS ANALYSIS
export async function aiAnalyzeAts(apiKey: string, jobDescription: string, resume: ResumeData): Promise<Omit<AtsReport, 'id' | 'resumeId' | 'userId' | 'createdAt'>> {
  const systemPrompt = `You are an advanced Applicant Tracking System (ATS) scanner and recruitment AI. Evaluate the candidate's resume against the target job description and return an in-depth validation report in strict JSON format.`;
  
  const resumeOverview = {
    title: resume.title,
    personalDetails: {
      name: resume.personalDetails.fullName,
      title: resume.personalDetails.professionalTitle,
    },
    summary: resume.summary,
    skills: resume.skills,
    experience: resume.experience.map(e => ({ title: e.title, company: e.company, desc: e.description })),
    education: resume.education.map(ed => ({ deg: ed.degree, inst: ed.institution })),
    projects: resume.projects.map(p => ({ n: p.name, desc: p.description, tech: p.technologies })),
  };

  const userPrompt = `
Analyze this resume data against the provided Job Description:
=== RESUME ===
${JSON.stringify(resumeOverview, null, 2)}

=== JOB DESCRIPTION ===
${jobDescription}

You MUST respond with a single JSON object. Do not include markdown wraps or explanations.
Required JSON format:
{
  "score": <number 0 to 100 representing overall ATS score>,
  "breakdown": {
    "formatting": <number 0 to 100, based on structural completeness and presentation logic>,
    "skills": <number 0 to 100, match of languages/tools>,
    "experience": <number 0 to 100, match of roles and bullet quality>,
    "keyword": <number 0 to 100, match of keywords>,
    "education": <number 0 to 100, educational requirements match>
  },
  "matchScore": <number 0 to 100 matching overall fit>,
  "keywordCoverage": <number 0 to 100 representing percentage of match keywords found>,
  "missingSkills": [<string list of skills requested in JD but not found in resume>],
  "missingKeywords": [<string list of important keywords requested in JD but missing from resume>],
  "suggestedImprovements": [<string list of specific, actionable tips to improve the resume>],
  "strengths": [<string list of accomplishments or sectors in resume matching JD perfectly>],
  "weaknesses": [<string list of items that could trigger rejection>]
}
`;

  const rawJson = await callGroqAPI(apiKey, systemPrompt, userPrompt, true);
  try {
    const cleaned = cleanJsonOutput(rawJson);
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('Failed to parse ATS report JSON:', err, rawJson);
    throw new Error('AI returned an invalid JSON report. Please try again.');
  }
}

// 4b. DEEP ATS EVALUATION BASED ON EXTRACTED TEXT AND METRICS
export interface GroqDeepAtsResponse {
  strengths: string[];
  weaknesses: string[];
  missingKeywords: string[];
  missingSkills: string[];
  recommendations: string[];
  atsOptimizationAdvice: string;
  rewriteRecommendations: string[];
}

export async function aiDeepAnalyzeAtsWithGroq(
  apiKey: string,
  parsedResume: any,
  jobDescription: string,
  localMetrics: any
): Promise<GroqDeepAtsResponse> {
  const systemPrompt = `You are a high-level ATS recruitment engineer and principal human resource architect. You analyze structured resume data against job positions, detect alignment flaws, and output highly actionable advice in strict JSON form.`;
  
  const userPrompt = `
Given the parsed resume, target job description, and locally generated ATS indices:

=== PARSED RESUME ===
${JSON.stringify(parsedResume, null, 2)}

=== JOB DESCRIPTION ===
${jobDescription}

=== LOCAL ATS METRICS ===
${JSON.stringify(localMetrics, null, 2)}

You MUST generate a high-fidelity diagnostic resume report. Deliver exactly this JSON structure, with no markdown delimiters, and no conversational prefaces.

JSON response schema:
{
  "strengths": ["Strong, specific evidence of achievements matching the JD"],
  "weaknesses": ["Explicit structural, vocabulary, or experience shortcomings for this position"],
  "missingKeywords": ["Highly specific target keywords found in JD but omitted in resume"],
  "missingSkills": ["Critical languages, tools, frameworks or soft skills requested but missing"],
  "recommendations": ["A list of actionable steps for optimizing bullet points or sections"],
  "atsOptimizationAdvice": "One concise paragraph explaining strategic compliance and formatting optimization.",
  "rewriteRecommendations": ["Specific examples of bullet points the candidate can rewrite right now, demonstrating before-and-after improvements"]
}
`;

  const rawJson = await callGroqAPI(apiKey, systemPrompt, userPrompt, true);
  try {
    const cleaned = cleanJsonOutput(rawJson);
    return JSON.parse(cleaned) as GroqDeepAtsResponse;
  } catch (err) {
    console.error('Failed parsing Deep ATS JSON response:', err, rawJson);
    // fallback
    return {
      strengths: ['Strong candidate core competencies'],
      weaknesses: ['Needs slightly more keyword enrichment'],
      missingKeywords: localMetrics.missingKeywords || [],
      missingSkills: localMetrics.missingSkills || [],
      recommendations: ['Integrate missing keywords in your Experience section'],
      atsOptimizationAdvice: 'Structure sections with standard headers like Experience and Education to maximize parsing scores.',
      rewriteRecommendations: ['Rephrase key responsibilities to lead with active verbs and quantified impacts.']
    };
  }
}

// 5. RESUME PARSE / IMPORT CONTENT
export async function aiParseResume(apiKey: string, rawText: string): Promise<Partial<ResumeData>> {
  const systemPrompt = `You are a world-class parser that extracts resume content from plain text and reformats it into high-fidelity structured JSON matching the database schema.`;
  
  const userPrompt = `
Parse the following unstructured resume text and construct a JSON response representing the resume sections.
=== RAW RESUME TEXT ===
${rawText}

Exceed expectations by matching this output format EXACTLY:
{
  "title": "<Suggested professional resume title based on their work>",
  "personalDetails": {
    "fullName": "<Applicant's Full Name or relative candidate query>",
    "professionalTitle": "<Professional Title>",
    "email": "<Email address found>",
    "phone": "<Phone number found>",
    "location": "<City, State/Country>",
    "linkedin": "<Linkedin Link if any>",
    "github": "<Github link if any>",
    "website": "<Portfolio URL if any>"
  },
  "summary": "<Crafted professional summary based on text>",
  "education": [
    {
      "degree": "<Degree Name>",
      "institution": "<College/University Name>",
      "location": "<Location of institution>",
      "startDate": "<Start date or year>",
      "endDate": "<End date/year or Present>",
      "gpa": "<GPA if found>",
      "description": "<Educational description or relevant details>"
    }
  ],
  "experience": [
    {
      "title": "<Job Title>",
      "company": "<Employer Name>",
      "location": "<Job Location>",
      "startDate": "<Start Date>",
      "endDate": "<End Date>",
      "description": "<Detailed job duties - formatted as clean, impact-filled bullet points with HTML dashes or simple separate sentences>"
    }
  ],
  "projects": [
    {
      "name": "<Project Name>",
      "description": "<Description of achievements>",
      "technologies": "<Comma-separated list of tools used>",
      "github": "",
      "live": ""
    }
  ],
  "skills": {
    "programmingLanguages": [<string languages like Python, JS, Java>],
    "frameworks": [<string frameworks like React, Django, Vue>],
    "tools": [<string tools like Git, Docker, Figma>],
    "databases": [<string databases like PostgreSQL, MongoDB>],
    "softSkills": [<string soft skills like Leadership, Scrum>]
  },
  "certifications": [
    {
      "name": "<Certification Title>",
      "issuer": "<Issuing body>",
      "date": "<Completion Date>",
      "url": ""
    }
  ],
  "achievements": [<string achievements list>]
}
`;

  const rawJson = await callGroqAPI(apiKey, systemPrompt, userPrompt, true);
  try {
    const cleaned = cleanJsonOutput(rawJson);
    return JSON.parse(cleaned) as Partial<ResumeData>;
  } catch (err) {
    console.error('Failed to parse parsed resume JSON:', err, rawJson);
    throw new Error('AI was unable to parse this text. Please verify the format or provide clear paste fields.');
  }
}

export async function testGroqConnection(apiKey: string, modelId: string): Promise<boolean> {
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('API key is not configured.');
  }
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: 'user', content: 'hello' }],
      max_tokens: 5,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  return true;
}
