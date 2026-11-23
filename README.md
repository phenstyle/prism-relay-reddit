# Prism Relay — Daily Optical Laser-Mix Puzzle for Reddit (Devvit Web)

**Built for Reddit's Game of the Day Hackathon 2026 (`$35,000` cash pool) using Devvit Web (`@devvit/web@0.15.4`), React 19, Tailwind CSS 4, Hono, and Redis.**

## What Is Prism Relay?
Prism Relay is a bite-sized, tactile **6×6 optical light-mixing daily puzzle** built natively for Reddit Interactive Posts:
- **Zero-text onboarding:** Tap mirrors (`/` `\`) and two-way beam splitters inside a brushed-brass & obsidian optical tray to route and blend colored laser beams (`Red + Blue = Violet`, `Red + Yellow = Solar`, `Yellow + Blue = Emerald`, `Red + Yellow + Blue = Prism White`) into every crystal receptor.
- **Solver-Verified Daily Boards:** Every UTC day unlocks a brand-new calibrated puzzle proven solvable in exact **Par** moves by an embedded exact optical solver (`src/shared/puzzleEngine.ts`), plus an **Archive** mode for replayability.
- **Community Puzzle Creator (UGC):** Tap **+ Create** to design your own 6×6 optical puzzle right inside Reddit! The live exact solver verifies solvability, auto-scrambles to a crisp Par, and publishes your creation directly to the subreddit as a playable Interactive Post with its own Redis leaderboard and `by u/<author>` attribution.
- **Reddit-Native Social Loop (`src/server/routes/api.ts`):**
  - Redis-backed **Daily & Per-Post Subreddit Leaderboards** (ranked by fewest moves + fastest time tie-breaker).
  - Persistent **Personal Daily Streaks** & **Community Move Distribution Histogram** with percentile rank (`Top X%`).
  - **1-Tap Spoiler-Free Comment Share Card** copying a clean emoji optical grid straight to clipboard for sharing in the post thread.
- **Handcrafted Visual & Audio Craft:** Sunlit linen-and-brass Atelier theme (zero generic dark-mode SaaS templates), animated flowing photon rays, color-blind-friendly geometric crystal glyphs (`●`, `▲`, `■`, `★`, `◆`, `✦`, `❖`), Web Audio harmonic chimes (with mute toggle), and single-viewport zero-scroll layout.

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
