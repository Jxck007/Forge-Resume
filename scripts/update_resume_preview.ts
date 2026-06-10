import fs from 'fs';

let content = fs.readFileSync('src/components/ResumePreview.tsx', 'utf-8');

// Strip all dark: prefixes entirely since the preview paper must be pure light mode
content = content.replace(/dark:[^\s"']+/g, '');

// Also clean up the preview tools at the top (which are part of the UI, not the paper)
// Actually we only need them inside the resume paper, but removing all dark modes from preview
// might be fine, but wait, the preview container needs to be dark!
// Let's just remove dark mode text colors in the paper templates.
// It's easier:
content = content.replace(/dark:text-indigo-400/g, '');
content = content.replace(/dark:text-gray-400/g, '');
content = content.replace(/dark:text-gray-300/g, '');
content = content.replace(/dark:text-gray-800/g, '');

fs.writeFileSync('src/components/ResumePreview.tsx', content, 'utf-8');
console.log('Update done.');
