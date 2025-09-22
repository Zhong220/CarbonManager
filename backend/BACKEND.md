# CarbonManager – Backend


## Overview

* **Stack**: Flask (Gunicorn) + MySQL + SQL migrations (SQL-first).
* **Goal**: Store emissions in MySQL and provide an API that prepares an **on-chain job** for a teammate’s blockchain service to submit; track **status** & **tx hash**.

---

## Services (docker-compose)

* **db**: MySQL 8.0 with healthcheck, holds all app data.
* **migrator**: Lightweight Python container that applies SQL migrations from `database/migrations/*.sql` and records them in `schema_migrations`.
* **backend**: Flask API (Gunicorn) exposing `/health`, `/debug/db-ping`, and on-chain endpoints under `/onchain/*`.

> All services share the same Docker network; backend reaches DB via `DB_HOST=db`.

---

## Environment

Create a `.env` at repo root
## Start/Stop & Logs

```bash
# Start clean: DB → migrate → backend
make up

# Health checks
make test        # /health + /debug/db-ping

# Tail backend logs
make logs

# Seeding for local tests
make seed
make show-seed-emission   # note the emission_id (usually 1)


# Stop everything (remove orphans)
make down

# Show all the make commands
make help
```

---

## API Docs

**Open Swagger**: [http://localhost:5001/docs](http://localhost:5001/docs)

### On-chain Endpoints

* `POST /onchain/emissions/{emission_id}`
  Prepare a **pending** on-chain job for the given emission. Stores a JSON payload in DB.

* `GET /onchain/emissions/{emission_id}`
  Read the on-chain status: `pending | submitted | confirmed | failed`, plus `tx_hash` and payload.

* `PUT /onchain/callback`
  **Called by the chain service** to update status (and `tx_hash`).
  Requires header: `X-Chain-Secret: <value from .env>`.


