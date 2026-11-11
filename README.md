# daily-wikipedia

One Wikipedia article a day at five "niche" levels, from 1 (very well known) to 5
(very obscure). Everyone sees the same five articles for a given day. The day
starts at **04:00 UTC+8** (20:00 UTC).

## Development

```bash
npm install
npm run dev
```

Other scripts:

| Command            | What it does                                |
| ------------------ | ------------------------------------------- |
| `npm run generate` | Pick articles for the current and next day  |
| `npm test`         | Run the tests (Vitest)                      |
| `npm run lint`     | Run ESLint                                  |
| `npm run format`   | Format everything with Prettier             |
| `npm run deploy`   | Build and push to GitHub Pages (`gh-pages`) |

## How articles are picked

`scripts/generate.js` writes `public/data/<YYYY-MM-DD>.json` (plus
`public/data/index.json` for the archive). The site only reads those files and
never calls Wikipedia itself.

- Every article gets a **niche score** from 0 (obscure) to 1 (mainstream),
  defined in `scripts/lib/niche.js`. 75% of the score is **relevance** and 25%
  is **total views since 2015**. Relevance means how many other English
  articles link to it, plus how many language editions of Wikipedia cover it.
  Each signal uses a log scale. The level comes from the score: level 1 is
  0.70 and up, level 2 is 0.55, level 3 is 0.40, level 4 is 0.25, and level 5
  is anything lower.
- Level 1 candidates come from Wikipedia's daily most-viewed list. Levels 2–5
  come from random page IDs. Both are shuffled with a seed made from the date.
- No article is ever featured twice, and existing days are never regenerated
  unless you pass `--force`.

`.github/workflows/daily.yml` runs the generator every day before the reset,
then commits the new files and deploys the site. You can also run it by hand
from the Actions tab.

```bash
node scripts/generate.js 2026-11-03          # a specific day
node scripts/generate.js --force 2026-11-03  # regenerate it
```
