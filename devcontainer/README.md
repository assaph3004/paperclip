# Paperclip Dev Container

Local development environment using Docker: Ubuntu 22.04, Python 3.11, Node.js 20 LTS, PostgreSQL 17, Claude Code CLI, and OpenAI SDK.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Docker Compose v2)
- One of: Cursor, VS Code, or PyCharm Professional

## First-run setup

```bash
cd devcontainer
cp .env.example .env
# Fill in ANTHROPIC_API_KEY, OPENAI_API_KEY, and PAPERCLIP_API_KEY
```

**API keys** are loaded from `.env` into the container at startup. `.env` is gitignored; never commit it.

## Cursor (recommended)

1. Install the **Dev Containers** extension (`ms-vscode-remote.remote-containers`).
2. Open the repo root in Cursor.
3. Press **Ctrl+Shift+P** → **Dev Containers: Reopen in Container**.
4. Cursor builds the image and drops you into a shell inside `/workspace`.

PostgreSQL is reachable from inside the container at `postgres:5432` (service hostname) or `localhost:5432` from your host.

## VS Code

Same steps as Cursor above — the Dev Containers extension and `devcontainer.json` are identical.

## PyCharm Professional

1. Open **Settings → Project → Python Interpreter → Add Interpreter → On Docker Compose**.
2. Set **Configuration files** to `devcontainer/docker-compose.yml`.
3. Select service **`dev`**.
4. PyCharm starts the stack and discovers the Python interpreter automatically.

For the database: **Database** tool window → **+** → **PostgreSQL** → host `localhost`, port `5432`, credentials from your `.env`.

## Starting the stack manually

```bash
cd devcontainer
docker compose --env-file .env up -d
```

This starts:
- **`dev`** — your development container (Python + Node.js + CLI tools), workspace mounted at `/workspace`
- **`postgres`** — PostgreSQL 17, data persisted in the `pgdata` Docker volume

## Claude Code (Anthropic)

The `claude` CLI is pre-installed in the container. It reads `ANTHROPIC_API_KEY` from the environment:

```bash
claude --version
claude "explain this codebase"
```

Set `ANTHROPIC_API_KEY` in `.env` before starting the container.

## Codex / OpenAI

The `openai` Python SDK is pre-installed. `OPENAI_API_KEY` is forwarded automatically:

```bash
python -c "import openai; print(openai.__version__)"
```

## Paperclip harness

Two modes:

**Host-only** (default): The Paperclip harness runs on your local machine; the container connects to it via Docker's host gateway:

```
PAPERCLIP_API_URL=http://host.docker.internal:3100
```

This is the default in `.env.example`. No changes needed if the harness is already running locally.

**Fully remote**: The harness runs inside or alongside the container (e.g., on a cloud VM). Set `PAPERCLIP_API_URL` to the remote endpoint:

```
PAPERCLIP_API_URL=https://your-remote-paperclip-host:3100
```

In both modes, set `PAPERCLIP_API_KEY` if the harness requires authentication.

## Verifying the environment

From inside the dev container:

```bash
python --version            # Python 3.11.x
node --version              # v20.x.x
pnpm --version
claude --version            # Claude Code CLI
python -c "import openai; print(openai.__version__)"
psql -h postgres -U $POSTGRES_USER -d $POSTGRES_DB -c '\l'
```

## Stopping and cleaning up

```bash
# Stop services (data persisted)
docker compose down

# Stop and remove persistent volume (destructive)
docker compose down -v
```

## Environment variables

| Variable            | Default                               | Description                                      |
|---------------------|---------------------------------------|--------------------------------------------------|
| `POSTGRES_USER`     | `devuser`                             | PostgreSQL superuser name                        |
| `POSTGRES_PASSWORD` | `devpassword`                         | PostgreSQL superuser password                    |
| `POSTGRES_DB`       | `devdb`                               | Default database name                            |
| `ANTHROPIC_API_KEY` | *(required)*                          | Anthropic API key for Claude Code CLI            |
| `OPENAI_API_KEY`    | *(required)*                          | OpenAI API key for Codex / OpenAI SDK            |
| `PAPERCLIP_API_URL` | `http://host.docker.internal:3100`    | Paperclip harness endpoint                       |
| `PAPERCLIP_API_KEY` | *(optional)*                          | Paperclip API key if harness requires auth       |
| `USER_UID`          | `1000`                                | Host user UID (Linux: avoids permission issues)  |
| `USER_GID`          | `1000`                                | Host user GID                                    |

On Linux, set `USER_UID` and `USER_GID` to match your host user (`id -u` / `id -g`) to avoid file permission issues with the mounted workspace.
