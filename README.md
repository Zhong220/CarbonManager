# CarbonManager

CarbonManager is a full-stack web app for tracking and reporting product carbon footprints.
It uses:

* **Backend**: Flask + Gunicorn (Python 3.11/3.13)
* **Database**: MySQL 8.0 (managed with SQL migrations)
* **Frontend**: React (Vite, TypeScript)
* **Migrations**: pure SQL files in `database/migrations`, applied by `database/migrate.py`
* **Containerization**: Docker Compose


## 📂 Project Structure

```
.
├── backend/           # Flask backend (API, models, routes)
│   ├── run.py
│   └── ...
├── database/          # Schema + migrations
│   ├── migrate.py
│   └── migrations/
│       └── 001_init.sql
├── docker-compose.yml # Compose file for db, backend, migrator
├── Makefile           # Dev commands
```

---
### 1. Requirements

* Docker & Docker Compose v2+
* Make (optional, but recommended)



### 2. Start services

Using Make:

```bash
make dev         # db -> migrations -> backend
make logs        # follow backend logs
make reset-db    # nuke db volume and recreate
```


Or raw Docker Compose:

```bash
docker compose up -d db
docker compose up migrator
docker compose up -d backend
```


---


## 🗂️ Migrations

Migrations are stored in `database/migrations` as ordered `.sql` files:

* `001_init.sql` → initial schema
* `00x_new_change.sql` → future changes for migrations

To apply new migrations:

```bash
docker compose up migrator
```

The script will skip already-applied files (tracked in `schema_migrations`).

---

## Notes

* Always use **service name `db`** as `DB_HOST` inside containers.
* Use `docker compose down -v --remove-orphans` to wipe DB + volumes if you need a clean reset.
* Backend serves on [http://localhost:5001](http://localhost:5001) by default.
