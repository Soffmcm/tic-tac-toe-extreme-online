/**
 * Lightweight sound effects using the Web Audio API.
 * No external assets — synthesized blips/chimes on the fly.
 * Respects a global mute toggle persisted in localStorage.
 */

const MUTE_KEY = "uttt:muted";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return ctx;
}

export function isMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MUTE_KEY) === "1";
}

export function setMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
}

function tone(freq: number, duration: number, type: OscillatorType = "sine", gain = 0.15): void {
  if (isMuted()) return;
  const ac = getCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = 0;
  g.gain.linearRampToValueAtTime(gain, ac.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);
  osc.connect(g).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + duration);
}

export const sfx = {
  pop: () => tone(520, 0.08, "triangle", 0.18),
  miniWin: () => {
    tone(660, 0.12, "sine", 0.18);
    setTimeout(() => tone(880, 0.18, "sine", 0.18), 90);
  },
  gameWin: () => {
    tone(523, 0.16, "triangle", 0.2);
    setTimeout(() => tone(659, 0.16, "triangle", 0.2), 130);
    setTimeout(() => tone(784, 0.28, "triangle", 0.2), 260);
  },
};
