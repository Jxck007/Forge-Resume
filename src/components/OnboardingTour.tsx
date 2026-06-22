import { FileDown, FileText, LayoutTemplate, LifeBuoy, Plus, Upload } from 'lucide-react';
import GuidedSpotlightTour, { GuidedTourStep } from './GuidedSpotlightTour';

interface Props { context?: 'dashboard' | 'builder' | 'profile'; onComplete: () => void }

const dashboard: GuidedTourStep[] = [
  { target: '[data-tour="create-resume"]', title: 'Create Resume', copy: 'Start from scratch or prefill from your profile.', icon: Plus },
  { target: '[data-tour="import-resume"]', title: 'Import Resume Beta', copy: 'Review imported resume content before adding it to Forge.', icon: Upload },
  { target: '[data-tour="choose-template"]', title: 'Choose a template', copy: 'Open the template popup and compare real PDF previews.', icon: LayoutTemplate },
  { target: '[data-tour="edit-resume"]', title: 'Continue editing', copy: 'Open your latest draft and continue in the Builder.', icon: FileText },
  { target: '[data-tour="help"]', title: 'Contextual Help', copy: 'Help opens the guide for the page you are currently viewing.', icon: LifeBuoy },
];
const builder: GuidedTourStep[] = [
  { target: '[data-tour="builder-editor"]', title: 'Section editor', copy: 'Edit personal details and resume sections here.', icon: FileText },
  { target: '[data-tour="builder-preview"]', title: 'Live PDF preview', copy: 'This preview uses the same renderer as export.', icon: LayoutTemplate },
  { target: '[data-tour="template-controls"]', title: 'Template controls', copy: 'Switch templates and review page-fit information.', icon: LayoutTemplate },
  { target: '[data-tour="download-pdf"]', title: 'Export PDF', copy: 'Download the current text-based, clickable PDF.', icon: FileDown },
  { target: '[data-tour="help"]', title: 'Builder Help', copy: 'Use Help whenever you need this walkthrough.', icon: LifeBuoy },
];
const profile: GuidedTourStep[] = [
  { target: '[data-tour="profile-page"]', title: 'Reusable profile', copy: 'Keep reusable career content in one place.', icon: FileText },
  { target: '[data-tour="profile-tabs"]', title: 'Profile sections', copy: 'Move between personal details, experience, education, skills, and projects.', icon: LayoutTemplate },
  { target: '[data-tour="help"]', title: 'Profile Help', copy: 'Use Help to restart the current guide.', icon: LifeBuoy },
];

export default function OnboardingTour({ context = 'dashboard', onComplete }: Props) {
  const steps = context === 'builder' ? builder : context === 'profile' ? profile : dashboard;
  return <GuidedSpotlightTour label={`${context[0].toUpperCase()}${context.slice(1)} guide`} steps={steps} onComplete={onComplete} />;
}
