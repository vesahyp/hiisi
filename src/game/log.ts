import type { SimState } from './state';

/** The message log, the roguelike part: the last few lines over the view. */
export function say(s: SimState, text: string, color = '#ece6d2'): void {
  const last = s.log[s.log.length - 1];
  if (last && last.text === text && s.time - last.at < 1.5) {
    last.at = s.time;
    return;
  }
  s.log.push({ text, color, at: s.time });
  if (s.log.length > 40) s.log.shift();
}
