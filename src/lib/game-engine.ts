/**
 * Ultimate Tic-Tac-Toe (Tic-Tac-Toe Extreme) game engine.
 *
 * Board layout: 9 mini-boards arranged in a 3x3 meta-grid.
 * Each mini-board has 9 cells. Total = 81 cells.
 * Indices are 0..8, row-major (0,1,2 top row; 3,4,5 middle; 6,7,8 bottom).
 *
 * Rules:
 * - X goes first.
 * - On your turn, you place your mark in a cell.
 * - The cell-index of your move dictates which mini-board your opponent
 *   must play in next (e.g., playing in cell 4 of any mini-board sends
 *   opponent to mini-board 4).
 * - If you're sent to a mini-board that's already won or full, you may play
 *   in ANY open mini-board (free-choice).
 * - Win a mini-board with 3-in-a-row in it. Win the game with 3-in-a-row
 *   of won mini-boards on the meta-grid.
 * - Draw if the entire board is full with no winner, or if no legal moves
 *   can produce a meta-board win.
 */

export type Player = "X" | "O";
export type Cell = Player | null;
export type MiniBoardResult = Player | "draw" | null;

export interface GameState {
  /** 9 mini-boards, each an array of 9 cells. */
  boards: Cell[][];
  /** Result per mini-board: winner, draw, or null if still in play. */
  miniWinners: MiniBoardResult[];
  /** Whose turn it is. */
  currentPlayer: Player;
  /** Index 0..8 of the mini-board the current player MUST play in, or null = free-choice. */
  activeBoard: number | null;
  /** Overall winner, "draw", or null if game is still going. */
  winner: MiniBoardResult;
  /** Move history for replay/debugging. */
  history: Move[];
}

export interface Move {
  player: Player;
  boardIndex: number;
  cellIndex: number;
}

const WIN_LINES: readonly [number, number, number][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],            // diagonals
];

export function createInitialState(): GameState {
  return {
    boards: Array.from({ length: 9 }, () => Array<Cell>(9).fill(null)),
    miniWinners: Array<MiniBoardResult>(9).fill(null),
    currentPlayer: "X",
    activeBoard: null,
    winner: null,
    history: [],
  };
}

/** Check if 3-in-a-row exists for a player on a 9-length grid. */
export function checkWinner(cells: readonly Cell[]): Player | null {
  for (const [a, b, c] of WIN_LINES) {
    if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) {
      return cells[a] as Player;
    }
  }
  return null;
}

/** Check meta-board winner from miniWinners. Treat "draw" as null for line purposes. */
export function checkMetaWinner(miniWinners: readonly MiniBoardResult[]): Player | null {
  const cells: Cell[] = miniWinners.map((r) => (r === "X" || r === "O" ? r : null));
  return checkWinner(cells);
}

export function isBoardFull(cells: readonly Cell[]): boolean {
  return cells.every((c) => c !== null);
}

export function isMiniBoardOpen(result: MiniBoardResult, cells: readonly Cell[]): boolean {
  return result === null && !isBoardFull(cells);
}

/** Returns true if (boardIndex, cellIndex) is a legal move for the current player. */
export function isLegalMove(
  state: GameState,
  boardIndex: number,
  cellIndex: number,
): boolean {
  if (state.winner !== null) return false;
  if (boardIndex < 0 || boardIndex > 8 || cellIndex < 0 || cellIndex > 8) return false;
  if (state.boards[boardIndex][cellIndex] !== null) return false;
  if (state.miniWinners[boardIndex] !== null) return false;
  if (state.activeBoard !== null && state.activeBoard !== boardIndex) return false;
  return true;
}

/** Apply a move. Returns new state, or null if move is illegal. */
export function applyMove(
  state: GameState,
  boardIndex: number,
  cellIndex: number,
): GameState | null {
  if (!isLegalMove(state, boardIndex, cellIndex)) return null;

  const player = state.currentPlayer;

  // Clone boards (deep on touched mini-board, shallow on others).
  const boards = state.boards.map((b, i) => (i === boardIndex ? [...b] : b));
  boards[boardIndex][cellIndex] = player;

  // Recompute mini-winner for that mini-board.
  const miniWinners = [...state.miniWinners];
  const winner = checkWinner(boards[boardIndex]);
  if (winner) {
    miniWinners[boardIndex] = winner;
  } else if (isBoardFull(boards[boardIndex])) {
    miniWinners[boardIndex] = "draw";
  }

  // Determine the next active board: the mini-board matching cellIndex,
  // unless that board is finished/full, in which case free-choice.
  let nextActive: number | null = cellIndex;
  if (
    miniWinners[cellIndex] !== null ||
    isBoardFull(boards[cellIndex])
  ) {
    nextActive = null;
  }

  // Compute meta-winner.
  const metaWinner = checkMetaWinner(miniWinners);

  // Detect overall draw: every mini-board resolved (won or draw) and no meta winner.
  const allResolved = miniWinners.every((r) => r !== null);
  const overallWinner: MiniBoardResult = metaWinner ?? (allResolved ? "draw" : null);

  return {
    boards,
    miniWinners,
    currentPlayer: player === "X" ? "O" : "X",
    activeBoard: overallWinner !== null ? null : nextActive,
    winner: overallWinner,
    history: [...state.history, { player, boardIndex, cellIndex }],
  };
}

/** Count won mini-boards per player (for the score display in top bar). */
export function countMiniBoardWins(state: GameState): { X: number; O: number } {
  let X = 0;
  let O = 0;
  for (const r of state.miniWinners) {
    if (r === "X") X++;
    else if (r === "O") O++;
  }
  return { X, O };
}
