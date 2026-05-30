# Paperclip Dev Container

Local development environment using Docker: Ubuntu 22.04, Python 3.11, Node.js 20 LTS, and PostgreSQL 16.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Docker Compose v2)
- One of: Cursor, VS Code, or PyCharm Professional

## First-run setup

```bash
cd devcontainer
cp .env.example .env
# Edit .env if you need custom credentials
```

## Cursor (recommended)

1. Install the **Dev Containers** extension (`ms-vscode-remote.remote-containers`).
2. Open the repo root in Cursor.
3. Press **Ctrl+Shift+P** → **Dev Containers: Reopen in Container**.
4. Cursor builds the image and drops you into a shell inside `/workspace` with Python and Node.js available.

PostgreSQL is reachable from inside the container at `postgres:5432` (service hostname) or `localhost:5432` from your host machine.

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
- **`dev`** — your development container (Python + Node.js + dev tools), workspace mounted at `/workspace`
- **`postgres`** — PostgreSQL 16, data persisted in the `pgdata` Docker volume

## Verifying the environment

From inside the dev container:

```bash
python --version    # Python 3.11.x
node --version      # v20.x.x
npm --version
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

| Variable          | Default        | Description                      |
|-------------------|----------------|----------------------------------|
| `POSTGRES_USER`   | `devuser`      | PostgreSQL superuser name        |
| `POSTGRES_PASSWORD` | `devpassword` | PostgreSQL superuser password   |
| `POSTGRES_DB`     | `devdb`        | Default database name            |
| `USER_UID`        | `1000`         | Host user UID (avoid permission issues on Linux) |
| `USER_GID`        | `1000`         | Host user GID                    |

On Linux, set `USER_UID` and `USER_GID` to match your host user (`id -u` / `id -g`) to avoid file permission issues with the mounted workspace.
