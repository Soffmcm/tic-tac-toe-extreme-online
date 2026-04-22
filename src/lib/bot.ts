/**
 * Bot opponent for Ultimate Tic-Tac-Toe.
 *
 * Four difficulty levels:
 *  - "easy"      : pure random legal moves.
 *  - "medium"    : light heuristics — take obvious mini-board wins, block
 *                  obvious mini-board losses, otherwise random.
 *  - "hard"      : 1-ply heuristic search with positional scoring
 *                  (mini-board outcomes, meta-board threats, sending
 *                  opponent to "free choice" is bad).
 *  - "extra-hard": shallow alpha-beta minimax over the meta-board state
 *                  (depth 3) using the same heuristic at the leaves.
 *
 * The engine state is the source of truth — we only call `applyMove`
 * and `isLegalMove` from `game-engine.ts`, never duplicate rules here.
 */

import {
  applyMove,
  checkMetaWinner,
  checkWinner,
  type GameState,
  type MiniBoardResult,
  type Player,
} from "./game-engine";

export type BotDifficulty = "easy" | "medium" | "hard" | "extra-hard";

export interface BotMove {
  boardIndex: number;
  cellIndex: number;
}

const WIN_LINES: readonly [number, number, number][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

/** All legal (boardIndex, cellIndex) moves for the current player. */
function legalMoves(state: GameState): BotMove[] {
  const moves: BotMove[] = [];
  if (state.winner !== null) return moves;

  const boardsToConsider: number[] =
    state.activeBoard !== null
      ? [state.activeBoard]
      : Array.from({ length: 9 }, (_, i) => i);

  for (const b of boardsToConsider) {
    if (state.miniWinners[b] !== null) continue;
    const cells = state.boards[b];
    for (let c = 0; c < 9; c++) {
      if (cells[c] === null) moves.push({ boardIndex: b, cellIndex: c });
    }
  }
  return moves;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Find a winning cell for `player` on a 3x3 grid (or null). */
function findWinningCell(cells: readonly (Player | null)[], player: Player): number | null {
  for (const [a, b, c] of WIN_LINES) {
    const line = [cells[a], cells[b], cells[c]];
    const playerCount = line.filter((v) => v === player).length;
    const emptyCount = line.filter((v) => v === null).length;
    if (playerCount === 2 && emptyCount === 1) {
      if (cells[a] === null) return a;
      if (cells[b] === null) return b;
      if (cells[c] === null) return c;
    }
  }
  return null;
}

// ===== Heuristic scoring =====

/** Score a single mini-board grid for `me` from `me`'s perspective. */
function scoreMiniBoard(cells: readonly (Player | null)[], me: Player): number {
  const opp: Player = me === "X" ? "O" : "X";
  let score = 0;
  for (const [a, b, c] of WIN_LINES) {
    const line = [cells[a], cells[b], cells[c]];
    const myCount = line.filter((v) => v === me).length;
    const oppCount = line.filter((v) => v === opp).length;
    if (myCount > 0 && oppCount > 0) continue; // line is dead
    if (myCount === 2) score += 5;
    else if (myCount === 1) score += 1;
    if (oppCount === 2) score -= 5;
    else if (oppCount === 1) score -= 1;
  }
  // Center & corners bonus
  if (cells[4] === me) score += 2;
  else if (cells[4] === opp) score -= 2;
  for (const corner of [0, 2, 6, 8]) {
    if (cells[corner] === me) score += 1;
    else if (cells[corner] === opp) score -= 1;
  }
  return score;
}

/** Per-mini-board outcome value on the meta-board. */
function miniValue(result: MiniBoardResult, me: Player): number {
  if (result === me) return 25;
  if (result === null || result === "draw") return 0;
  return -25;
}

/** Score the full state from `me`'s perspective. */
function scoreState(state: GameState, me: Player): number {
  const opp: Player = me === "X" ? "O" : "X";

  if (state.winner === me) return 100000;
  if (state.winner === opp) return -100000;
  if (state.winner === "draw") return 0;

  let score = 0;

  // Meta-board: treat won mini-boards as "marks" and score the meta lines.
  const metaCells: (Player | null)[] = state.miniWinners.map((r) =>
    r === "X" || r === "O" ? r : null,
  );
  // Check for meta-threats.
  for (const [a, b, c] of WIN_LINES) {
    const line = [metaCells[a], metaCells[b], metaCells[c]];
    const myCount = line.filter((v) => v === me).length;
    const oppCount = line.filter((v) => v === opp).length;
    if (myCount > 0 && oppCount > 0) continue;
    if (myCount === 2) score += 40;
    else if (myCount === 1) score += 8;
    if (oppCount === 2) score -= 40;
    else if (oppCount === 1) score -= 8;
  }

  // Per-mini-board: outcome value + positional pressure within the unresolved ones.
  for (let b = 0; b < 9; b++) {
    score += miniValue(state.miniWinners[b], me);
    if (state.miniWinners[b] === null) {
      // Slightly downweight intra-mini score so meta dominates.
      score += scoreMiniBoard(state.boards[b], me) * 0.5;
    }
  }

  // The center mini-board is strategically valuable.
  if (state.miniWinners[4] === me) score += 6;
  else if (state.miniWinners[4] === opp) score -= 6;

  // It is now `state.currentPlayer`'s turn. Sending the opponent to a
  // mini-board where they have free choice is generally bad for whoever
  // just moved — but `currentPlayer` is the side ABOUT to play, so a
  // free-choice position favours them.
  if (state.activeBoard === null) {
    score += state.currentPlayer === me ? 5 : -5;
  }

  return score;
}

// ===== Difficulty implementations =====

function pickEasy(state: GameState): BotMove | null {
  const moves = legalMoves(state);
  if (moves.length === 0) return null;
  return pickRandom(moves);
}

function pickMedium(state: GameState, me: Player): BotMove | null {
  const opp: Player = me === "X" ? "O" : "X";
  const moves = legalMoves(state);
  if (moves.length === 0) return null;

  // 1) Take any immediate mini-board win.
  for (const m of moves) {
    const cells = state.boards[m.boardIndex];
    const winCell = findWinningCell(cells, me);
    if (winCell === m.cellIndex) return m;
  }

  // 2) Block any immediate mini-board loss.
  for (const m of moves) {
    const cells = state.boards[m.boardIndex];
    const blockCell = findWinningCell(cells, opp);
    if (blockCell === m.cellIndex) return m;
  }

  // 3) Prefer center-cell of any mini-board if available, then corners.
  const centerMoves = moves.filter((m) => m.cellIndex === 4);
  if (centerMoves.length > 0 && Math.random() < 0.6) return pickRandom(centerMoves);

  const cornerMoves = moves.filter((m) => [0, 2, 6, 8].includes(m.cellIndex));
  if (cornerMoves.length > 0 && Math.random() < 0.4) return pickRandom(cornerMoves);

  return pickRandom(moves);
}

function pickHard(state: GameState, me: Player): BotMove | null {
  const moves = legalMoves(state);
  if (moves.length === 0) return null;

  let bestScore = -Infinity;
  let best: BotMove[] = [];
  for (const m of moves) {
    const next = applyMove(state, m.boardIndex, m.cellIndex);
    if (!next) continue;

    let s = scoreState(next, me);

    // Tactical bonuses observable at depth 1:
    //  - Did I win a mini-board? (already in scoreState via miniValue)
    //  - Did I just give opponent free-choice? -> small penalty
    //  - Did I send opponent to a mini where they have an immediate win? big penalty
    if (next.activeBoard !== null && next.winner === null) {
      const tgt = next.activeBoard;
      const oppNext = next.currentPlayer; // opponent about to play
      const oppWin = findWinningCell(next.boards[tgt], oppNext);
      if (oppWin !== null) s -= 30;
    } else if (next.activeBoard === null && next.winner === null) {
      s -= 4; // small penalty for free-choice gift
    }

    // Tiny noise so it's not perfectly deterministic.
    s += Math.random() * 0.5;

    if (s > bestScore) {
      bestScore = s;
      best = [m];
    } else if (s === bestScore) {
      best.push(m);
    }
  }

  return best.length > 0 ? pickRandom(best) : pickRandom(moves);
}

// ===== Extra-hard: alpha-beta minimax =====

function minimax(
  state: GameState,
  me: Player,
  depth: number,
  alpha: number,
  beta: number,
): number {
  if (state.winner !== null || depth === 0) {
    return scoreState(state, me);
  }
  const moves = legalMoves(state);
  if (moves.length === 0) return scoreState(state, me);

  const maximizing = state.currentPlayer === me;

  if (maximizing) {
    let value = -Infinity;
    for (const m of moves) {
      const next = applyMove(state, m.boardIndex, m.cellIndex);
      if (!next) continue;
      value = Math.max(value, minimax(next, me, depth - 1, alpha, beta));
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break;
    }
    return value;
  } else {
    let value = Infinity;
    for (const m of moves) {
      const next = applyMove(state, m.boardIndex, m.cellIndex);
      if (!next) continue;
      value = Math.min(value, minimax(next, me, depth - 1, alpha, beta));
      beta = Math.min(beta, value);
      if (alpha >= beta) break;
    }
    return value;
  }
}

function pickExtraHard(state: GameState, me: Player): BotMove | null {
  const moves = legalMoves(state);
  if (moves.length === 0) return null;

  // Adaptive depth: when there are many legal moves (free-choice early game),
  // search shallower to keep latency reasonable.
  const branching = moves.length;
  let depth = 3;
  if (branching > 20) depth = 2;
  if (branching <= 6) depth = 4;

  let best: BotMove[] = [];
  let bestScore = -Infinity;

  for (const m of moves) {
    const next = applyMove(state, m.boardIndex, m.cellIndex);
    if (!next) continue;
    const s = minimax(next, me, depth - 1, -Infinity, Infinity);
    if (s > bestScore) {
      bestScore = s;
      best = [m];
    } else if (s === bestScore) {
      best.push(m);
    }
  }
  return best.length > 0 ? pickRandom(best) : pickRandom(moves);
}

// ===== Public entry =====

export function chooseBotMove(
  state: GameState,
  difficulty: BotDifficulty,
): BotMove | null {
  const me = state.currentPlayer;

  // Tiny safety check: don't recommend moves on a finished game.
  if (state.winner !== null) return null;

  switch (difficulty) {
    case "easy":
      return pickEasy(state);
    case "medium":
      return pickMedium(state, me);
    case "hard":
      return pickHard(state, me);
    case "extra-hard":
      return pickExtraHard(state, me);
  }
}

// Helpers exported for potential future use / tests.
export const __internals = {
  legalMoves,
  scoreState,
  scoreMiniBoard,
  findWinningCell,
  checkMetaWinner,
  checkWinner,
};
