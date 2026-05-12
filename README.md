# 🔍 PR Tracker

> Single-page GitHub PR dashboard. No framework, no build step, no dependencies beyond Docker.

![Dashboard screenshot](screenshot.jpg)

---

## ⚙️ How it works

```
Browser  ──GET /──────────────────►  nginx (port 8080)
                                        │
Browser  ──POST /api/graphql ──────►  nginx  ──► api.github.com/graphql
                                        │           (Authorization header added by nginx)
Browser  ──GET  /api/rest/user ────►  nginx  ──► api.github.com/user
```

The [GitHub GraphQL API][gh-graphql] is used to fetch open, merged, and closed PRs in parallel. The [GitHub REST API][gh-rest] is used to resolve the authenticated user's login and avatar. All API calls are made from nginx, which injects the `Authorization: Bearer <token>` header from a Docker secret mounted at `/run/secrets/gh_token`.

A small `config.js` file is generated at container startup from environment variables and served as a static asset alongside `index.html`.

---

## 📋 Prerequisites

- **Docker** with the Compose plugin (`docker compose version`)
- A GitHub [Personal Access Token][gh-pat] with:
  - Classic token: `repo` scope
  - Fine-grained token: **Pull requests: read** + **Metadata: read**

---

## 🚀 Setup

### 1. Clone the repository

```bash
git clone <repo-url>
cd gh-pr-tracker
```

### 2. Create the token secret

```bash
mkdir -p secrets
echo -n "ghp_your_token_here" > secrets/gh_token
```

> ⚠️ The `secrets/` directory is gitignored. Never commit this file.

### 3. Configure namespaces to hide (optional)

Edit `compose.yaml` and set `HIDDEN_NAMESPACES` to a comma-separated list of GitHub usernames or organization names to exclude from the dashboard:

```yaml
environment:
  HIDDEN_NAMESPACES: "your-login,your-personal-org"
```

Leave it empty (`""`) to show all PRs.

### 4. Start the container

```bash
docker compose up -d
```

Open [http://localhost:8080](http://localhost:8080).

### 5. Stop

```bash
docker compose down
```

---

## 🛠️ Configuration reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `8080` | Host port exposed by the container |
| `HIDDEN_NAMESPACES` | No | `""` | Comma-separated GitHub namespaces (users/orgs) to exclude from the dashboard |

> The GitHub token is not an environment variable: it is read from the Docker secret at `secrets/gh_token` (see [Docker Compose secrets][compose-secrets]).

---

## ✨ Dashboard features

- 📊 **Stats bar**: total open PRs, draft count, in-review count (with changes-requested and approved sub-counts), closed and merged counts for the current year
- 🔎 **Filters**: Open / Closed (year) / Merged (year)
- 🃏 **PR cards**: review status badge, CI status dot, reviewer avatars with review-state color, diff stats, GitHub labels, relative timestamp
- 🔄 **Auto-refresh**: every 5 minutes (configurable via `REFRESH_INTERVAL`)
- 🔔 **Browser notifications**: click the 🔕 button in the header to enable. A notification fires when a PR's CI status or review decision changes between two refreshes (CI passed, CI failed, approved, changes requested). No notification is sent on the first load.

---

## 🔒 Security notes

- The GitHub token is stored as a Docker secret and loaded into the nginx process environment only. It is injected as an HTTP header by nginx and never sent to the browser.
- `secrets/` is gitignored. Do not add any token or credential file outside that directory.
- The dashboard is intended for local or internal network use. There is no authentication layer in front of it.

---

## 🔄 Updating

Pull the latest changes, then apply them depending on what changed:

```bash
git pull
```

| What changed | Action required |
|---|---|
| `index.html` only | Hard-refresh the browser (`Ctrl+Shift+R`) — no restart needed |
| `entrypoint.sh`, `compose.yaml`, `nginx.conf.template` | `docker compose down && docker compose up -d` |

Your token (`secrets/gh_token`) and your `HIDDEN_NAMESPACES` configuration are never touched by an update.

---

## 🧑‍💻 Development

The entire frontend is a single file: `index.html`. There is no build step. Edit it directly and refresh the browser. The container must be running for API calls to work.

To restart the container after changing `entrypoint.sh`, `compose.yaml`, or `nginx.conf.template`:

```bash
docker compose down && docker compose up -d
```

> Changes to `index.html` are picked up immediately without restarting (it is bind-mounted read-only).

---

[gh-graphql]: https://docs.github.com/en/graphql
[gh-rest]: https://docs.github.com/en/rest
[gh-pat]: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
[compose-secrets]: https://docs.docker.com/compose/how-tos/use-secrets/
