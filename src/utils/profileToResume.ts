import { ProfileData, ResumeData } from '../types';

export function profileToResume(profile: ProfileData): Partial<ResumeData> {
  const summary = profile.summary?.trim() || profile.careerObjective?.trim() || '';

  return {
    personalDetails: {
      ...profile.personalDetails,
    },
    summary,
    education: profile.education || [],
    experience: profile.experience || [],
    internships: profile.internships || [],
    projects: profile.projects || [],
    skills: profile.skills || {
      programmingLanguages: [],
      frameworks: [],
      tools: [],
      databases: [],
      softSkills: [],
    },
    certifications: profile.certifications || [],
    achievements: profile.achievements || [],
    volunteering: profile.volunteering || [],
    languages: profile.languages || [],
    customSections: profile.customSections || [],
    linkDisplayMode: profile.linkDisplayMode === 'raw' ? 'raw' : 'embedded',
    linkSettings: {
      defaultDisplayMode: profile.linkSettings?.defaultDisplayMode === 'raw' ? 'raw' : 'embedded',
    },
    useProfilePhoto: Boolean(profile.personalDetails?.profilePhoto),
  };
}
