import fs from 'fs';

let content = fs.readFileSync('src/components/ResumeBuilder.tsx', 'utf-8');

const replacements = [
  [/bg-white dark:bg-gray-950/g, 'bg-[#171A21]'],
  [/border-gray-150 dark:border-gray-800/g, 'border-[#2A2E37]'],
  [/border-gray-200 dark:border-gray-850/g, 'border-[#2A2E37]'],
  [/border-gray-100 dark:border-gray-900\/50/g, 'border-[#2A2E37]'],
  [/border-gray-100 dark:border-gray-900/g, 'border-[#2A2E37]'],
  [/bg-gray-50\/50 dark:bg-gray-900\/10/g, 'bg-[#0F1115]'],
  [/bg-gray-50\/50 dark:bg-gray-900\/20/g, 'bg-[#0F1115]'],
  [/bg-gray-50 dark:bg-gray-900/g, 'bg-[#0F1115]'],
  [/bg-gray-100 dark:bg-gray-800/g, 'bg-zinc-800'],
  [/text-gray-900 dark:text-white/g, 'text-white'],
  [/bg-white dark:bg-gray-905/g, 'bg-[#0F1115]'],
  [/border-gray-255 dark:border-gray-800/g, 'border-[#2A2E37]'],
  [/bg-white dark:text-white/g, 'bg-[#0F1115] text-white'],
  [/text-gray-800 dark:text-gray-200/g, 'text-white'],
  [/bg-white dark:focus:bg-gray-950 dark:text-white/g, 'focus:border-indigo-500 focus:bg-[#171A21] text-white'],
  [/hover:bg-indigo-50/g, 'hover:bg-[#1f232c]'],
  [/border-indigo-200/g, 'border-indigo-500/20'],
  [/text-indigo-600/g, 'text-indigo-400'],
  [/bg-slate-55/g, 'bg-zinc-800'],
  [/border-slate-200/g, 'border-zinc-700'],
  [/text-slate-600/g, 'text-zinc-400'],
  [/text-slate-605/g, 'text-zinc-400'],
  [/bg-indigo-50\/30/g, 'bg-indigo-500/10'],
  [/border-indigo-100\/30/g, 'border-indigo-500/20'],
  [/bg-indigo-50\/50/g, 'bg-indigo-500/10'],
  [/border-indigo-100\/50/g, 'border-indigo-500/20'],
  [/bg-gray-50/g, 'bg-[#0F1115]'],
  [/border-red-200/g, 'border-rose-500/30'],
  [new RegExp('dark:', 'g'), ''],
  [/text-gray-400/g, 'text-zinc-400'],
  [/border-gray-200/g, 'border-[#2A2E37]'],
  [/border-gray-250/g, 'border-[#2A2E37]'],
  [/text-gray-600/g, 'text-zinc-400'],
  [/text-gray-500/g, 'text-zinc-500'],
  [/border-gray-100/g, 'border-[#2A2E37]'],
  [/bg-white/g, 'bg-[#171A21]'],
  [/bg-gray-100/g, 'bg-[#171A21]'],
];

replacements.forEach(([pattern, replacement]) => {
  content = content.replace(pattern, replacement as string);
});

fs.writeFileSync('src/components/ResumeBuilder.tsx', content, 'utf-8');
console.log('ResumeBuilder.tsx updated for dark mode.');
