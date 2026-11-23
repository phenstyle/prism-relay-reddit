# Prism Relay — Daily Optical Laser-Mix Puzzle for Reddit (Devvit Web)

**Built for Reddit's Game of the Day Hackathon 2026 (`$35,000` cash pool) using Devvit Web (`@devvit/web@0.15.4`), React 19, Tailwind CSS 4, Hono, and Redis.**

## What Is Prism Relay?
Prism Relay is a bite-sized, tactile **6×6 optical light-mixing daily puzzle** built natively for Reddit Interactive Posts:
- **Zero-text onboarding:** Tap mirrors (`/` `\`) and two-way beam splitters to route and blend colored laser beams (`Red + Blue = Violet`, `Red + Yellow = Solar`, `Yellow + Blue = Emerald`, `Red + Yellow + Blue = Prism White`) into every crystal receptor.
- **Solver-Verified Daily Boards:** Every UTC day unlocks a brand-new calibrated puzzle proven solvable in exact **Par** moves by an embedded exact optical solver (`src/shared/puzzleEngine.ts`), plus an **Archive** mode for replayability.
- **Reddit-Native Social Loop (`src/server/routes/api.ts`):**
  - Redis-backed **Daily Subreddit Leaderboard** (ranked by fewest moves + fastest time tie-breaker).
  - Persistent **Personal Daily Streaks** & **Community Move Distribution Histogram** with percentile rank (`Top X% today`).
  - **1-Tap Spoiler-Free Comment Share Card** copying a clean emoji optical grid straight to clipboard for sharing in the post thread.
- **Accessible Visual Craft:** Color-blind-friendly geometric crystal glyphs (`●`, `▲`, `■`, `★`, `◆`, `✦`, `❖`), smooth 140ms SVG mirror animations, Web Audio harmonic chimes (with mute toggle), and single-viewport zero-scroll layout.

## Quick Start & Upload to Reddit (2 Minutes)

```bash
npm install
npm run test:types   # Strict TypeScript build check
npm run lint         # ESLint across client, server & shared
npm run test:unit    # Proves 30 consecutive daily puzzles solve in exact Par
npm run build        # Builds dist/client (splash + game) & dist/server/index.cjs

# Upload to your Reddit developer account & test in a private subreddit (do NOT publish yet per hackathon rules!):
npx devvit login
npx devvit upload
npx devvit install r/<YOUR_TEST_SUBREDDIT>
```

Then open `r/<YOUR_TEST_SUBREDDIT>`, use the moderator menu **Post Daily Prism Relay**, and submit your `developers.reddit.com` app link + demo post link on Devpost before **Dec 8, 2026 @ 6:00 PM PST**!
