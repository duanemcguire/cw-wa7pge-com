# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Morse Code (CW) training and practice web application. Built on Flask with PostgreSQL, deployed via Docker Compose integrated with the [d.rymcg.tech](https://github.com/EnigmaCurry/d.rymcg.tech) deployment framework.

## Common Commands

All development commands run through `make`. The app lives inside `api/`.

### Local Development (Python virtualenv)

```bash
make local-install        # Create virtualenv and install dependencies
make local-activate       # Enter virtualenv subshell
make dev                  # Start Flask dev server with live reload
make local-test           # Run pytest
```

### Database

```bash
make migrate-db           # Run Alembic migrations
make migrate-info         # Show current migration status
make drop-db              # Drop and reinitialize DB (DEV mode only — requires CW_DEV_MODE=true)
make psql                 # Open psql shell in running DB container
make local-db             # SSH tunnel to remote DB for local access
```

### Docker / Production

```bash
make config               # Interactive .env configuration wizard
make install              # Deploy Docker containers
make test                 # Run tests in Docker
make shell                # Shell into API container
make open                 # Open app in browser
```

## Architecture

### SQL-First with aiosql

Database queries are **never inlined in Python**. All SQL lives in `.sql` files alongside the models:

```
api/app/models/hello/
    hello_model.py      # Python model logic
    hello.sql           # PostgreSQL queries (tagged with -- name: <query-name>)
    hello.sqlite.sql    # SQLite variants for local dev
```

`aiosql` loads these at startup; queries become callable methods on a query object.

### Flask Blueprints

Each feature is a self-contained blueprint under `api/app/routes/`:

- `main/` — Home page and user guide
- `phrases/` — Core CW phrase practice (copy, send, word flow, phrase flow); 7,700+ phrases in `text_files/` organized by category (Word, Saying, Song Title, Movie, Book Title, etc.)
- `books/` — Classic literature practice (Garden of Verses, Princess of Mars, Peter Pan, Aesop's Fables, Wisteria Lodge)
- `callsigns/` — Callsign trainer
- `hello/` — Reference blueprint showing DB + aiosql patterns with visitor log
- `upload/` — File upload example
- `utility/` — Version and utility endpoints

All blueprints are registered in `api/app/routes/__init__.py` via `setup_routes()`.

### Configuration

12-factor config via environment variables. `.env-dist` is the canonical reference for all variables. Instance configs live in `.env_{DOCKER_CONTEXT}_{INSTANCE}` files (e.g., `.env_cw-test_default`). Key vars:

- `CW_DEV_MODE` — enables destructive ops like `drop-db`
- `CW_API_LOG_LEVEL` — Python log level
- `CW_POSTGRES_*` — database credentials
- `CW_TRAEFIK_HOST` — public domain

### Multi-Instance Deployment

The d.rymcg.tech framework supports multiple named instances of the app per Docker context. `docker-compose.instance.yaml` is a ytt template that generates per-instance Traefik routing configs with optional OAuth2, mTLS, HTTP Basic Auth, and IP allowlisting — all configured in the per-instance `.env` file.

### OpenAPI

Flask-OpenAPI3 exposes Swagger UI at `/openapi`.

## Adding a New Feature

Follow the `hello` blueprint as the reference pattern:
1. Create `api/app/routes/<feature>/<feature>_controller.py` with a Flask Blueprint
2. Create `api/app/models/<feature>/<feature>_model.py` + `.sql` file(s) if DB access needed
3. Register blueprint in `api/app/routes/__init__.py`
4. Add templates to `api/app/templates/<feature>/`

## Testing

Tests live in `api/tests/`. The test database is a fresh ephemeral PostgreSQL instance — no persistent volume. Run with `make local-test` (virtualenv) or `make test` (Docker).
