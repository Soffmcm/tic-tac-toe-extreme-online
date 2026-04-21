
# Ultimate Tic-Tac-Toe (Tic-Tac-Toe Extreme) — Online 2-Player Game

A playful, colorful web game where two players battle on a 3×3 grid of mini tic-tac-toe boards. Play locally on one device, or create an online room and share a link.

## Pages

- **Home (`/`)** — Game logo, short rules teaser, two big CTAs: "Play Local" and "Play Online". Optional "Sign in" link in header. Footer link to "How to Play".
- **How to Play (`/rules`)** — Visual walkthrough of the rules with small animated examples (which board you get sent to, won boards, free-choice boards).
- **Local Game (`/play/local`)** — Two players on one device, alternating turns. Nickname inputs for X and O.
- **Online Lobby (`/play/online`)** — "Create Room" button (generates a shareable code/link) or "Join Room" with code input.
- **Online Game (`/play/$roomCode`)** — Live game synced between two browsers. Shows both players' names, whose turn it is, connection status, and a "Copy invite link" button when waiting for opponent.
- **Auth (`/auth`)** — Optional sign in / sign up (email + password). Guest play always available.
- **Profile (`/profile`)** — Signed-in users see their win/loss/draw record and recent games.

## Game UI

- Big 3×3 meta-board, each cell containing a 3×3 mini-board (81 clickable cells total).
- The **active mini-board** (where the current player must play) is highlighted with a colored glow. If free-choice, all open boards glow.
- Won mini-boards collapse into a giant X or O in their player's color, with a satisfying pop animation.
- Cells the current player can't play in are dimmed and unclickable.
- Top bar: player names, scores (won mini-boards), whose turn — no turn timer, players take as long as they want.
- Bottom: "New Game", "Resign", and (online) "Copy invite link" buttons.
- Win screen: confetti burst, winner announcement, "Play Again" / "Back to Home".
- Draw detection (full board, no 3-in-a-row of mini-boards).

## Multiplayer (Online Mode)

- Player A clicks "Create Room" → backend creates a room with a short code (e.g. `BLUE-FOX-42`) → A is assigned X → shareable link generated.
- Player B opens link → assigned O → game starts.
- Moves are written to the database; both clients subscribe to realtime updates so the board syncs instantly.
- Game state (board, current turn, active mini-board, winner) lives server-side as the source of truth — server validates each move against the rules before accepting it (prevents cheating via DevTools).
- Spectator-proof: only the two assigned players can submit moves; others opening the link see "Room full" or a read-only view.
- Disconnect handling: if a player leaves, the other sees "Opponent disconnected" with a 60s reconnect window before auto-forfeit.

## Accounts (Optional)

- Guests can play immediately with just a nickname — no signup required.
- Signing up unlocks: persistent nickname, win/loss history, and your past games list.
- Email + password auth via Lovable Cloud.

## Visual Style — Playful & Colorful

- **Vibe:** bright, cheerful, casual — think Duolingo / Kahoot energy, not enterprise.
- **Palette:** X gets a vivid coral/pink, O gets a vivid teal/cyan, board on a soft warm cream background, with sunny yellow and lavender accents for highlights and buttons.
- **Typography:** rounded, friendly sans-serif (e.g. Nunito or Fredoka) with a chunky display font for headings and the X/O marks themselves.
- **Motion:** bouncy spring animations on cell hover and placement, mini-board win triggers a scale + color burst, game win triggers confetti.
- **Sounds (optional, mute toggle):** soft pop on placement, cheerful chime on mini-board win, fanfare on game win.

## Data Model (Lovable Cloud)

- `profiles` — user_id, nickname, wins, losses, draws.
- `rooms` — code, status (waiting/playing/finished), player_x_id, player_o_id, created_at.
- `games` — room_id, board_state (JSON: 9 mini-boards × 9 cells), current_turn, active_board_index (or null for free-choice), mini_board_winners, overall_winner, updated_at.
- `moves` — game_id, player, board_index, cell_index, created_at (for history/replay).
- Realtime enabled on `games` so both clients update instantly.
- RLS: only the two assigned players can write moves to a game; anyone can read room status to join.

## Out of Scope (v1)

- Matchmaking / random opponents
- Leaderboards (can add later once we have user data)
- AI opponent
- Chat between players
- Mobile native app
- Turn timers / time pressure
