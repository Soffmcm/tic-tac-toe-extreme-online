/**
 * Player symbol customization.
 *
 * A "symbol" is either:
 *  - null  → use the default X/O SVG mark for that seat
 *  - a short string (1–2 visible chars, typically a single emoji)
 *
 * Symbols are chosen per-seat and replace the X / O glyph everywhere a
 * Mark is rendered. The colored backgrounds (red for X, blue for O) and
 * win overlays stay the same — only the glyph in the middle changes.
 */

import type { Player } from "@/lib/game-engine";

export type PlayerSymbol = string | null;

export interface SymbolMap {
  X: PlayerSymbol;
  O: PlayerSymbol;
}

export const DEFAULT_SYMBOLS: SymbolMap = { X: null, O: null };

/**
 * Curated list of emoji that players are realistically likely to pick.
 * Ordered loosely by category: faces → expressive → creatures → objects.
 */
export const POPULAR_EMOJI: ReadonlyArray<string> = [
  // Faces & expressions
  "😀", "😎", "🥹", "🥰", "😈", "🤡", "🥶", "🤖",
  // Iconic / fun
  "💩", "💀", "👻", "👽", "🧠", "👑", "🦄", "🧙",
  // Mythical / fantasy
  "🧚", "🧛", "🧜", "🐉", "👹", "👺",
  // Creatures
  "🐶", "🐱", "🦊", "🐼", "🐸", "🐢", "🐙", "🦋",
  // Nature & weather
  "🔥", "⚡", "🌟", "✨", "🌈", "🌙", "☀️", "❄️",
  // Hearts & shapes
  "❤️", "💙", "💚", "💛", "💜", "🖤",
  // Objects / power-ups
  "💣", "🎯", "🎲", "🏆", "🎮", "🚀", "⚽", "🏀",
  // Vehicles
  "🚗", "✈️",
  // Food (quick crowd-pleasers)
  "🍕", "🍔", "🍩", "🍦", "☕",
];

/** Maximum visible "characters" to keep the cell from overflowing. */
const MAX_LEN = 4;

/** Sanitize a user-typed symbol — trim + cap length. */
export function sanitizeSymbol(raw: string): PlayerSymbol {
  const s = raw.trim();
  if (!s) return null;
  // Use array spread to count code points so emoji aren't mid-cut.
  const chars = [...s];
  return chars.slice(0, MAX_LEN).join("");
}

/** localStorage key for a viewer's chosen symbols. */
const STORAGE_KEY = "u3t_symbols_v1";

interface StoredPrefs {
  X?: string | null;
  O?: string | null;
  bot?: string | null;
}

function safeRead(): StoredPrefs {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function safeWrite(prefs: StoredPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

export function getStoredSymbol(seat: Player | "bot"): PlayerSymbol {
  const prefs = safeRead();
  const v = prefs[seat];
  return typeof v === "string" && v.length > 0 ? v : null;
}

export function setStoredSymbol(seat: Player | "bot", value: PlayerSymbol): void {
  const prefs = safeRead();
  prefs[seat] = value;
  safeWrite(prefs);
}
