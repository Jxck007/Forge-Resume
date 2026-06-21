import { NormalizedResume } from '../schema/resumeSchema';

export interface AiPromptBundle {
  system: string;
  user: string;
}

const compactResume = (resume: NormalizedResume) => ({
  title: resume.title,
  summary: resume.summary,
  contact: {
    name: resume.name,
    location: resume.location,
    linkedIn: resume.linkedIn,
    github: resume.github,
    portfolio: resume.portfolio,
  },
  experience: resume.experience.map(entry => ({
    role: entry.role,
    company: entry.company,
    date: entry.date,
    bullets: entry.bullets,
  })),
  education: resume.education.map(entry => ({
    degree: entry.degree,
    institution: entry.institution,
    date: entry.date,
  })),
  skills: resume.skills,
  projects: resume.projects.map(project => ({
    title: project.title,
    tech: project.tech,
    description: project.description,
    links: project.links,
  })),
  certifications: resume.certifications.map(certification => ({
    name: certification.name,
    issuer: certification.issuer,
    date: certification.date,
  })),
  achievements: resume.achievements.map(achievement => ({
    title: achievement.title,
    description: achievement.description,
  })),
  additionalDetails: resume.additionalDetails,
  learningTargets: resume.learningTargets,
  candidateMode: resume.candidateMode,
  resolvedCandidateMode: resume.resolvedCandidateMode,
});

export function buildAtsIntelligencePrompt(resume: NormalizedResume, jobDescription: string): AiPromptBundle {
  return {
    system: `You are Forge Resume's evidence-first ATS intelligence engine.
Return strict JSON only. Never invent experience, tools, achievements, seniority, or exact metrics.
Classify missing keywords using evidence from the resume and additional details. If evidence is absent, create an add_learning_target suggestion or require confirmation; never silently add it.
Student candidates may rely on education, projects, certifications, and achievements. Professional candidates require stronger experience, ownership, and impact evidence.
Analyze matched and missing keywords, partial matches, seniority fit, role fit, project relevance, summary strength, bullet quality, grammar, spelling, buzzwords, missing metrics, and keyword placement.
Every suggestion must include a stable id. A missing keyword with no evidence must not become an add_keyword suggestion.
Allowed suggestion fieldPath roots: summary, skills, projects, experience, additionalDetails, learningTargets, sectionSettings, linkSettings.
Use item ids in paths, for example projects.project-id.tech or experience.experience-id.bullets.
Expected JSON:
{
  "jobMatch": {"score": number, "matchedKeywords": [string], "missingKeywords": [string], "partialMatches": [{"keyword": string, "evidence": string, "reason": string}], "seniorityFit": string, "roleFitSummary": string},
  "contentUpgrade": {"summarySuggestions": [string], "bulletSuggestions": [string], "projectSuggestions": [string], "skillSuggestions": [string], "grammarIssues": [string], "spellingIssues": [string]},
  "suggestions": [{"id": string, "type": "add_keyword|rewrite_summary|rewrite_bullet|improve_project|add_metric_placeholder|fix_section_order|change_link_mode|add_learning_target", "target": {"sectionId": string, "itemId": string, "fieldPath": string}, "originalValue": string, "suggestedValue": string, "reason": string, "evidence": string, "confidence": number, "requiresUserConfirmation": boolean, "truthWarning": string}],
  "warnings": [string]
}`,
    user: `TARGET JOB DESCRIPTION:\n${jobDescription}\n\nNORMALIZED RESUME:\n${JSON.stringify(compactResume(resume))}`,
  };
}

export function buildKeywordsMatchPrompt(resume: NormalizedResume, jobDescription: string): AiPromptBundle {
  return {
    system: `You are an ATS keyword alignment analyst.
Return valid JSON only.
Semantic equivalence rules:
- GCP = Google Cloud Platform
- JS = JavaScript
- NodeJS = Node.js
- PostgreSQL = Postgres
- CI/CD = Continuous Integration and Deployment
- Firebase can count as backend/cloud experience depending on context
- Express.js can partially satisfy Node.js backend requirements
Do not invent candidate experience.
Expected JSON:
{
  "alignmentScore": number,
  "matchVelocityIndex": number,
  "matchedSkills": [string],
  "partialMatches": [
    {
      "requiredSkill": string,
      "candidateEvidence": string,
      "reason": string
    }
  ],
  "missingCriticalSkills": [string],
  "missingNiceToHaveSkills": [string],
  "recommendation": string,
  "issues": []
}`,
    user: `JOB DESCRIPTION:\n${jobDescription}\n\nRESUME:\n${JSON.stringify(compactResume(resume))}`,
  };
}

export function buildContentDiagnoserPrompt(resume: NormalizedResume): AiPromptBundle {
  return {
    system: `You are a resume content diagnostician.
Return valid JSON only.
Check content quality, bullet strength, impact, clarity, buzzwords, missing metrics, vague phrasing, recruiter appeal, grammar, spelling, and readability.
Do not auto-apply changes. Do not invent achievements or exact metrics.
Expected JSON:
{
  "contentScore": number,
  "weakVerbsDetected": [string],
  "buzzwordFlags": [
    {
      "word": string,
      "reason": string
    }
  ],
  "flaggedBullets": [
    {
      "section": string,
      "original": string,
      "reason": string,
      "suggestedRewrite": string,
      "placeholderUsed": boolean
    }
  ],
  "issues": []
}`,
    user: `RESUME:\n${JSON.stringify(compactResume(resume))}`,
  };
}

export function buildXyzRewritePrompt(bullet: string): AiPromptBundle {
  return {
    system: `Rewrite a resume bullet using the Google XYZ formula:
"Accomplished [X] as measured by [Y], by doing [Z]."
Rules:
- Keep one sentence.
- Start with a strong action verb.
- Preserve original meaning.
- Do not invent fake exact metrics.
- If metric is missing, use placeholders like [X]%, [N] users, [Y] seconds.
Return valid JSON only:
{
  "original": string,
  "rewrittenXYZ": string,
  "placeholderUsed": boolean,
  "notes": string
}`,
    user: `BULLET:\n${bullet}`,
  };
}

export function buildInterviewQuestionPrompt(resume: NormalizedResume): AiPromptBundle {
  return {
    system: `You are an interview simulator for resume evidence.
Use projects, technical claims, tools, architecture, impact, tradeoffs, debugging, scalability, teamwork, and ownership.
Return valid JSON only:
{
  "question": string,
  "basedOn": {
    "section": string,
    "evidence": string
  },
  "difficulty": "Easy" | "Medium" | "Hard",
  "whatGoodAnswerShouldMention": [string],
  "followUpQuestion": string
}`,
    user: `RESUME:\n${JSON.stringify(compactResume(resume))}`,
  };
}

export function buildInterviewAnswerFeedbackPrompt(question: string, answer: string): AiPromptBundle {
  return {
    system: `You are an interview answer reviewer.
Return valid JSON only:
{
  "answerScore": number,
  "strengths": [string],
  "weaknesses": [string],
  "improvedAnswer": string,
  "followUpQuestion": string
}`,
    user: `QUESTION:\n${question}\n\nANSWER:\n${answer}`,
  };
}
