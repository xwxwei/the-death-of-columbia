# The Death of Columbia

A Cloudflare Worker + Vite narrative workbench for testing DeepSeek-generated
drafts, rewrites, scene expansions, and critique loops.

## Stack

- React 19 and Vite for the browser UI.
- Cloudflare Workers with static assets for deployment.
- DeepSeek chat completions through the Worker route `/api/deepseek`.

## Local setup

```bash
pnpm install
cp .dev.vars.example .dev.vars
```

Add your DeepSeek key to `.dev.vars`, then run:

```bash
pnpm cf:dev
```

For frontend-only iteration:

```bash
pnpm dev
```

The frontend-only server does not call the Worker API. Use `pnpm cf:dev` when
testing DeepSeek requests.

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
