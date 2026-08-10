# DeCLA

DeCLA models a complete source-to-decision dataflow as immutable versions. The `current` and
`proposed` tags point to versions and keep assignment history. Every stage type, log type, custom
property schema, and measurable is database-driven. The comparison view joins current and proposed
values by measure definition and applies the configured improvement direction.

## Architecture

- **Web:** Next.js 16 and React 19, deployable to Vercel
- **API:** FastAPI with SQLAlchemy 2 and Alembic
- **Database:** Neon Postgres
- **Local runtime:** Docker Compose for web and API; the database remains hosted in Neon

## Neon setup

Create a Neon project and copy both connection strings from the Connect dialog:

- Use the pooled hostname (containing `-pooler`) as `DATABASE_URL` for API traffic.
- Use the direct hostname as `DATABASE_MIGRATION_URL` for Alembic migrations.

Copy `.env.example` to `.env` and replace the placeholders. Do not commit `.env`.

## Run with Docker

```bash
docker compose up --build
```

The API container applies the migration and idempotent sample seed before starting. Open:

- Web: http://localhost:3000
- API documentation: http://localhost:8000/docs
- Readiness: http://localhost:8000/health/ready

## Run without Docker

Frontend:

```bash
npm install
npm run dev
```

Backend (from `backend/`):

```bash
python -m venv .venv
# Activate .venv for your shell
pip install -e ".[dev]"
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload --port 8000
```

## Vercel deployment

Import the repository as a Vercel project and set:

```text
NEXT_PUBLIC_API_URL=https://your-fastapi-host.example.com
```

Add the resulting Vercel origin to the backend `CORS_ORIGINS` JSON array. The FastAPI service is a
separate deployment and must receive `DATABASE_URL`, `DATABASE_MIGRATION_URL`, and `CORS_ORIGINS`.

## Version workflow

1. The current version is published and immutable.
2. “Create proposed” clones current into a new draft and assigns the proposed tag.
3. Edit stages and dynamic properties in the proposed view.
4. Compare all enabled measures and direction-aware improvements.
5. Publish the proposal, then promote it to current.
6. Tag assignments are closed with `valid_to`; no history is overwritten.

## Useful commands

```bash
npm run lint
npm test
npm run build

cd backend
pytest
ruff check .
alembic check
```
