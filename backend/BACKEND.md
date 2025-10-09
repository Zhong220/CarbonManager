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

### Auth Endpoints

* `POST /auth/register`
  Create a new user.

* `POST /auth/login`
  Authenticate an existing user.
  
* `GET /auth/me`
Get the current user info (JWT-protected, needs token).

* `PUT /auth/me`
Update the current user info, assigning organization to it. 

* `POST /auth/organization`
Create new organization. 

### Product Types
*`GET	/product_types`
Get all the product types belong to the organization which the user is under. 

*`POST	/product_types`
Add a new product type to this organization. 

*`GET	/product_types/{product_type_id}`	
Get the information of a certain product type in this organization. 

* `PUT	/product_types/{product_type_id}`	
Update the information of this product type. 

* `DELETE	/product_types/{product_type_id}`	
Delete the product type. 

