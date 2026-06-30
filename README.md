# The Death of Columbia / 哥伦比亚之死

A Cloudflare Worker + Vite MVP for a fictional political-crisis narrative RPG.
The current build runs the first playable story engine: character selection,
three crisis rounds, player actions, mock NPC agency, event and clue unlocks,
ending resolution, and an ending dossier.

## Stack

- React 19 and Vite for the browser UI.
- TypeScript core engine under `src/core`.
- Mock NPC and GM adapters under `src/agents`.
- Data-driven characters, events, endings, and initial state under `src/data`.
- Cloudflare Workers with static assets for deployment.
- Optional DeepSeek chat completions through `/api/deepseek`.

## Local setup

```bash
pnpm install
cp .dev.vars.example .dev.vars
```

Add your DeepSeek key to `.dev.vars` if you want to test model calls, then run:

```bash
pnpm cf:dev
```

For frontend-only iteration:

```bash
pnpm dev
```

The MVP game engine runs locally in the browser with mock NPC logic. Use
`pnpm cf:dev` when testing Worker API requests.

## Tests

```bash
pnpm typecheck
pnpm test
pnpm build
```

The test suite covers the eight ending acceptance states, full three-round
runs for all six playable roles, NPC autonomy, promise breach behavior, and
fictionalization of real-world mapping requests.

## Cloudflare deployment

The Worker service name is configured in `wrangler.jsonc` as:

```text
the-death-of-columbia
```

Required GitHub Actions secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `DEEPSEEK_API_KEY`

Manual deploy:

```bash
pnpm deploy
```

## GitHub

After a GitHub repository exists, connect it with SSH:

```bash
git remote add origin git@github.com:xwxwei/the-death-of-columbia.git
git push -u origin main
```
