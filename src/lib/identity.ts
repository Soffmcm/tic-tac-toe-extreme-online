/**
 * Per-browser anonymous seat token + nickname helpers.
 * Stored in localStorage so guests keep the same identity across reloads.
 */

const TOKEN_KEY = "uttt:seat-token";
const NICK_KEY = "uttt:nickname";

function genToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getSeatToken(): string {
  if (typeof window === "undefined") return "";
  let t = window.localStorage.getItem(TOKEN_KEY);
  if (!t) {
    t = genToken();
    window.localStorage.setItem(TOKEN_KEY, t);
  }
  return t;
}

export function getStoredNickname(fallback = "Player"): string {
  if (typeof window === "undefined") return fallback;
  return window.localStorage.getItem(NICK_KEY) || fallback;
}

export function setStoredNickname(name: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NICK_KEY, name);
}

const ADJ = ["Brave","Sneaky","Lucky","Wild","Sunny","Cosmic","Jolly","Mighty","Swift","Cheery"];
const NOUN = ["Fox","Tiger","Panda","Otter","Hawk","Wolf","Koala","Lion","Llama","Cat"];

export function generateRoomCode(): string {
  const a = ADJ[Math.floor(Math.random() * ADJ.length)];
  const n = NOUN[Math.floor(Math.random() * NOUN.length)];
  const num = Math.floor(10 + Math.random() * 90);
  return `${a}-${n}-${num}`.toUpperCase();
}
