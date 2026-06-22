import { AiGenerateInput } from './types';

export interface BuiltAiPrompt {
  system: string;
  user: string;
}

const baseTruthRules = [
  'Do not invent metrics, dates, employers, technologies, achievements, certifications, or responsibilities.',
  'Preserve the meaning of the original text.',
  'Use plain text only.',
  'Do not use markdown, bullets, code fences, or commentary unless the input itself requires line breaks.',
  'If the input is already strong, return a lightly improved version rather than rewriting aggressively.',
];

const rewriteStyleInstruction: Record<NonNullable<AiGenerateInput['rewriteStyle']>, string> = {
  professional: 'Use polished, professional resume language.',
  ats_friendly: 'Use clear conventional role wording and standard terminology already supported by the source. Do not claim an ATS score or add missing keywords.',
  shorter: 'Make the result meaningfully shorter while preserving the important facts.',
  longer: 'Add useful clarity using only facts already present in the source. Do not invent supporting detail.',
  student_friendly: 'Use confident student-friendly wording without overstating seniority or experience.',
  impactful: 'Make the wording more direct and impactful without inventing outcomes or metrics.',
  stronger_verbs: 'Start sentences or bullets with stronger accurate action verbs.',
  star_format: 'Rewrite using a concise Situation, Task, Action, Result flow using only facts present in the source. Do not invent a result or metric when none is provided.',
  explain_impact: 'Clarify the impact already supported by the source. If impact is not stated, improve clarity without inventing an outcome.',
  grammar_fix: 'Only fix grammar, spelling, punctuation, and awkward phrasing.',
};

export function buildAiPrompt(input: Pick<AiGenerateInput, 'task' | 'input' | 'tone' | 'rewriteStyle'>): BuiltAiPrompt {
  const tone = input.tone || 'student';
  const styleInstruction = input.rewriteStyle ? rewriteStyleInstruction[input.rewriteStyle] : '';

  if (input.task === 'improve_summary') {
    return {
      system: [
        'You are a professional resume writing assistant.',
        'Improve the candidate summary for clarity, professionalism, and ATS-safe readability.',
        'Keep the tone concise and truthful.',
        'Target tone: ' + tone + '.',
        styleInstruction,
        'Keep it under 100 words unless the original is shorter.',
        ...baseTruthRules,
      ].join(' '),
      user: `Rewrite this resume summary:\n\n${input.input.trim()}`,
    };
  }

  if (input.task === 'rewrite_bullet') {
    return {
      system: [
        'You are a resume writing assistant focused on strong accomplishment bullets.',
        'Rewrite the text into stronger, clearer resume bullet wording.',
        'Keep it concise and impactful, but do not fabricate measurable impact.',
        'If a metric is missing, improve structure without inventing one.',
        'Target tone: ' + tone + '.',
        styleInstruction,
        ...baseTruthRules,
      ].join(' '),
      user: `Rewrite this resume bullet or description:\n\n${input.input.trim()}`,
    };
  }

  if (input.task === 'grammar_fix') {
    return {
      system: [
        'You are a careful resume editor.',
        'Fix grammar, spelling, punctuation, and awkward wording while preserving meaning.',
        'Target tone: ' + tone + '.',
        styleInstruction,
        ...baseTruthRules,
      ].join(' '),
      user: `Fix this resume text:\n\n${input.input.trim()}`,
    };
  }

  if (input.task === 'suggest_wording') {
    return {
      system: [
        'You are a resume editor.',
        'Improve wording for clarity, readability, and professionalism without changing the facts.',
        'Target tone: ' + tone + '.',
        styleInstruction,
        ...baseTruthRules,
      ].join(' '),
      user: `Improve the wording of this resume text:\n\n${input.input.trim()}`,
    };
  }

  return {
    system: [
      'You are a strict resume parser.',
      'Extract only information explicitly present in the pasted resume text.',
      'Return valid JSON only. No markdown.',
      'Use empty strings or empty arrays when information is missing.',
      'Never infer or invent values.',
    ].join(' '),
    user: `Parse this pasted resume text into JSON with this exact shape:\n{
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
  "education": [{ "degree": "", "institution": "", "location": "", "startDate": "", "endDate": "", "scoreType": "", "gpa": "", "description": "" }],
  "experience": [{ "title": "", "company": "", "location": "", "startDate": "", "endDate": "", "description": "" }],
  "internships": [{ "role": "", "company": "", "location": "", "startDate": "", "endDate": "", "description": "", "technologiesUsed": "" }],
  "projects": [{ "name": "", "description": "", "technologies": "", "github": "", "live": "" }],
  "skills": {
    "programmingLanguages": [],
    "frameworks": [],
    "tools": [],
    "databases": [],
    "softSkills": []
  },
  "certifications": [{ "name": "", "issuer": "", "date": "", "url": "" }],
  "achievements": [],
  "volunteering": [],
  "languages": []
}\n\nResume text:\n${input.input.trim()}`,
  };
}
