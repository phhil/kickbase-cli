// Kickbase API field decoders — reverse-engineered from app data

/** k[] array in performance: in-match events */
export const EVENT: Record<number, string> = {
  1: 'Goal',
  2: 'Red card',
  3: 'Assist',
  4: 'Yellow card',
  8: 'Subbed on',
  9: 'Subbed off',
};

export const EVENT_SHORT: Record<number, string> = {
  1: '⚽', 2: '🟥', 3: '🅰️', 4: '🟨', 8: '↑', 9: '↓',
};

/** st: player status */
export const STATUS: Record<number, string> = {
  0: 'Fit',
  1: 'Not in squad',
  2: 'Unknown',
  3: 'Bench',
  4: 'Injured/Rehab',
  5: 'Starter',
};

export const STATUS_SHORT: Record<number, string> = {
  0: '-', 1: 'OUT', 2: '?', 3: 'BCH', 4: 'INJ', 5: 'FIT',
};

/** prob: availability probability for next match */
export const PROB: Record<number, string> = {
  1: 'Certain',
  2: 'Expected',
  3: 'Uncertain',
  4: 'Unlikely',
  5: 'Ruled out',
};

export const PROB_SHORT: Record<number, string> = {
  1: '✓', 2: '○', 3: '?', 4: '△', 5: '✗',
};

/** pos: player position */
export const POSITION: Record<number, string> = {
  1: 'GK', 2: 'DEF', 3: 'MF', 4: 'FW',
};

/** Decode k[] events to readable string */
export function decodeEvents(k: number[]): string {
  if (!k || k.length === 0) return '';
  const goals = k.filter(e => e === 1).length;
  const assists = k.filter(e => e === 3).length;
  const parts: string[] = [];
  if (goals > 0) parts.push(goals > 1 ? `${goals}⚽` : '⚽');
  if (assists > 0) parts.push(assists > 1 ? `${assists}🅰️` : '🅰️');
  if (k.includes(4)) parts.push('🟨');
  if (k.includes(2)) parts.push('🟥');
  if (k.includes(8)) parts.push('↑');
  if (k.includes(9)) parts.push('↓');
  return parts.join(' ');
}

/** Decode k[] events to plain text (no emoji, for piped output) */
export function decodeEventsText(k: number[]): string {
  if (!k || k.length === 0) return '';
  const goals = k.filter(e => e === 1).length;
  const assists = k.filter(e => e === 3).length;
  const parts: string[] = [];
  if (goals > 0) parts.push(goals > 1 ? `${goals}G` : 'G');
  if (assists > 0) parts.push(assists > 1 ? `${assists}A` : 'A');
  if (k.includes(4)) parts.push('Y');
  if (k.includes(2)) parts.push('R');
  if (k.includes(8)) parts.push('ON');
  if (k.includes(9)) parts.push('OFF');
  return parts.join(',');
}

/** Format seconds as "Xh Ym" or "Xm" */
export function formatSeconds(sec: number): string {
  if (sec >= 3600) return `${Math.floor(sec / 3600)}h ${Math.round((sec % 3600) / 60)}m`;
  return `${Math.round(sec / 60)}m`;
}
