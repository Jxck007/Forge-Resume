const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const clean = (value: unknown) =>
  String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const unique = (items: string[]) => Array.from(new Set(items.filter(Boolean)));

const joinParts = (...parts: Array<unknown>) =>
  unique(parts.map(clean).filter(Boolean)).join(' — ');

export const extractMeaningfulText = (value: unknown): string => {
  if (typeof value === 'string' || typeof value === 'number') return clean(value);
  if (Array.isArray(value)) return normalizeStringList(value).join(', ');
  if (!isRecord(value)) return '';

  return joinParts(
    value.title,
    value.name,
    value.label,
    value.text,
    value.description,
    value.summary,
    value.value,
    value.issuer,
    value.organization,
    value.company,
    value.degree,
    value.institution,
    value.url
  );
};

export const normalizeStringList = (value: unknown): string[] => {
  if (typeof value === 'string') {
    return unique(
      value
        .split(/\r?\n|,/)
        .map(clean)
        .filter(Boolean)
    );
  }

  if (Array.isArray(value)) {
    return unique(value.flatMap(item => normalizeStringList(item)));
  }

  if (isRecord(value)) {
    const text = extractMeaningfulText(value);
    return text ? [text] : [];
  }

  return [];
};

export const normalizeBulletList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return unique(value.flatMap(item => normalizeBulletList(item)));
  }

  if (typeof value === 'string') {
    return unique(
      value
        .split(/\r?\n|•|·/)
        .map(clean)
        .filter(Boolean)
    );
  }

  if (isRecord(value)) {
    const text = joinParts(
      value.title,
      value.name,
      value.label,
      value.role,
      value.description,
      value.summary,
      value.achievement,
      value.text
    );
    return text ? [text] : [];
  }

  return [];
};

export const normalizeLanguageList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return unique(value.flatMap(item => normalizeLanguageList(item)));
  }

  if (typeof value === 'string') {
    return unique(
      value
        .split(/\r?\n|,/)
        .map(clean)
        .filter(Boolean)
    );
  }

  if (isRecord(value)) {
    const label = clean(value.name || value.language || value.title || value.label);
    const level = clean(value.level || value.proficiency || value.fluency || value.description);
    const text = label && level ? `${label} — ${level}` : label || level || extractMeaningfulText(value);
    return text ? [text] : [];
  }

  return [];
};

export const normalizeSkillList = (value: unknown): string[] => {
  if (Array.isArray(value)) return unique(value.flatMap(item => normalizeSkillList(item)));
  if (typeof value === 'string') return normalizeStringList(value);
  if (isRecord(value)) {
    const text = joinParts(value.name, value.label, value.text, value.value, value.description);
    return text ? [text] : [];
  }
  return [];
};
