import { LocationItem } from '../types/location';

export interface CategoryStyleConfig {
  bg: string;
  glassBg: string;
  border: string;
  glow: string;
  iconColor: string;
  iconSvg: string;
}

export const CATEGORY_STYLES: Record<string, CategoryStyleConfig> = {
  Travel: {
    bg: '#2563eb',
    glassBg: 'rgba(37, 99, 235, 0.40)',
    border: '#60a5fa',
    glow: 'rgba(59, 130, 246, 0.55)',
    iconColor: '#93c5fd',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor"/></svg>`
  },
  Work: {
    bg: '#d97706',
    glassBg: 'rgba(217, 119, 6, 0.40)',
    border: '#fbbf24',
    glow: 'rgba(245, 158, 11, 0.55)',
    iconColor: '#fde047',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11 2 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z"/></svg>`
  },
  Home: {
    bg: '#7c3aed',
    glassBg: 'rgba(124, 58, 237, 0.40)',
    border: '#c084fc',
    glow: 'rgba(168, 85, 247, 0.55)',
    iconColor: '#e9d5ff',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>`
  },
  Food: {
    bg: '#e11d48',
    glassBg: 'rgba(225, 29, 72, 0.40)',
    border: '#fb7185',
    glow: 'rgba(244, 63, 94, 0.55)',
    iconColor: '#fecdd3',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/></svg>`
  },
  Nature: {
    bg: '#10b981',
    glassBg: 'rgba(16, 185, 129, 0.40)',
    border: '#34d399',
    glow: 'rgba(52, 211, 153, 0.55)',
    iconColor: '#a7f3d0',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L6 10h2.5L5 15h3.2L6.5 19h11l-1.7-4h3.2l-3.5-5H18L12 2z"/><rect x="10.5" y="19" width="3" height="3" fill="currentColor"/></svg>`
  },
  History: {
    bg: '#9333ea',
    glassBg: 'rgba(147, 51, 234, 0.40)',
    border: '#e879f9',
    glow: 'rgba(232, 121, 249, 0.55)',
    iconColor: '#f5d0fe',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zm0 9l2.5-1.25L12 8.5l-2.5 1.25L12 11zm0 3l-8-4v6l8 4 8-4v-6l-8 4z"/></svg>`
  },
  Other: {
    bg: '#0891b2',
    glassBg: 'rgba(8, 145, 178, 0.40)',
    border: '#22d3ee',
    glow: 'rgba(34, 211, 238, 0.55)',
    iconColor: '#a5f3fc',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>`
  }
};

export function getMarkerCategoryStyle(loc: Partial<LocationItem>): CategoryStyleConfig {
  const cat = (loc.category || '').trim();

  // 1. User Assigned Category
  if (cat) {
    const matchedKey = Object.keys(CATEGORY_STYLES).find(
      (k) => k.toLowerCase() === cat.toLowerCase()
    );
    if (matchedKey && CATEGORY_STYLES[matchedKey]) {
      return CATEGORY_STYLES[matchedKey];
    }
  }

  const normName = (loc.name || '').toLowerCase();
  const tagsStr = (loc.tags || []).join(' ').toLowerCase();

  // 2. Keyword fallback for landmarks
  const isLandmark =
    /\b(palace|temple|monument|fort|castle|museum|heritage|memorial|tomb|pyramid|cathedral|basilica|shrine|ruins|tower|colosseum)\b/i.test(
      normName
    ) || /\b(palace|temple|monument|heritage|history)\b/i.test(tagsStr);

  if (isLandmark) {
    return CATEGORY_STYLES.History;
  }

  // 3. Keyword fallback for nature
  const isNature =
    /\b(beach|lake|park|hill|hills|mountain|waterfall|falls|garden|valley|forest|canyon)\b/i.test(
      normName
    ) || /\b(nature|beach|lake|hills)\b/i.test(tagsStr);

  if (isNature) {
    return CATEGORY_STYLES.Nature;
  }

  return CATEGORY_STYLES.Travel;
}
