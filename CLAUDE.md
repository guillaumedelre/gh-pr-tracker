# CLAUDE.md

## Project overview

Single-page GitHub PR dashboard. No framework, no build step, no dependencies beyond Docker.

Stack: `index.html` (HTML + CSS + vanilla JS) + nginx (reverse proxy + static server) + Docker Compose.

## File structure

```
index.html                  # Entire frontend (HTML, CSS, JS in one file)
nginx.conf.template         # nginx config template — envsubst replaces ${GH_TOKEN}
entrypoint.sh               # Runs before nginx: reads Docker secret, generates config.js
compose.yaml                # Single service: nginx:alpine
secrets/gh_token            # GitHub token (gitignored, never commit)
```

## Architecture constraints

### No build step
`index.html` is served as-is. Any change is immediately visible after a browser refresh (no recompile, no bundler).

### envsubst and the nginx template
`nginx.conf.template` is processed by `envsubst` via the official nginx Docker image entrypoint. Only `${GH_TOKEN}` should appear in it. Do not add `${}` JavaScript-style expressions to that file — envsubst will try to substitute them and corrupt the config.

### config.js generation
`entrypoint.sh` writes `/usr/share/nginx/html/config.js` at container startup. This file exposes runtime configuration to the browser:

```js
window.PR_TRACKER_CONFIG = {"hiddenNamespaces":["org1","org2"]};
```

`index.html` includes it via `<script src="/config.js">` before the main script block, so `window.PR_TRACKER_CONFIG` is always defined when the app runs.

### GitHub token
Stored as a Docker secret at `secrets/gh_token`. Loaded into the nginx process environment by `entrypoint.sh`. Injected as `Authorization: Bearer ...` by nginx on every proxied API request. The browser never sees the token.

## Common tasks

### Add a new environment variable

1. Add it to `environment:` in `compose.yaml` with a default value and a comment.
2. Read it in `entrypoint.sh` and add it to the generated `config.js` (extend the `window.PR_TRACKER_CONFIG` object).
3. Read it from `window.PR_TRACKER_CONFIG` in `index.html`.

### Change the UI

Edit `index.html` directly. The container does not need to restart — the file is bind-mounted. Hard-refresh the browser (`Ctrl+Shift+R`) to bypass cache.

### Change nginx config or entrypoint

```bash
docker compose down && docker compose up -d
```

### Change the GitHub API queries

The GraphQL queries are inline in `index.html` inside `fetchPRs()`, `fetchMergedPRs()`, and `fetchClosedPRs()`. The REST call is in `fetchUser()`. All use the proxy routes `/api/graphql` and `/api/rest/`.

## Key JS globals

| Name | Type | Description |
|---|---|---|
| `allPRs` | `PR[]` | Open PRs |
| `mergedPRs` | `PR[]` | Merged PRs for the current year |
| `closedPRs` | `PR[]` | Closed (unmerged) PRs for the current year |
| `currentUser` | `object` | GitHub REST `/user` response |
| `currentFilter` | `string` | `"open"` \| `"closed"` \| `"merged"` |
| `STATE_META` | `object` | Badge label/class for PR state (open/closed/merged) |
| `REVIEW_META` | `object` | Badge label/class for review decision |
| `window.PR_TRACKER_CONFIG` | `object` | Runtime config from `config.js` |

## What NOT to do

- Do not add `${VAR}` placeholders to `nginx.conf.template` for values other than `GH_TOKEN` without understanding that envsubst processes the entire file.
- Do not commit `secrets/gh_token` or any file containing the GitHub token.
- Do not add a build system or bundler — the single-file approach is intentional.
