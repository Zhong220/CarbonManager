# CarbonManager

CarbonManager is a full-stack web app for tracking and reporting product carbon footprints.
It uses:

* **Backend**: Flask + Gunicorn (Python 3.11/3.13)
* **Database**: MySQL 8.0 (managed with SQL migrations)
* **Frontend**: React (Vite, TypeScript)
* **Migrations**: pure SQL files in `database/migrations`, applied by `database/migrate.py`
* **Containerization**: Docker Compose


## 📂 Project Structure
### Backend/ Database/ Tools

```
.
├── backend
│   ├── __pycache__
│   ├── app.py              # Entry point of the program. 
│   ├── db_connection.py    # Connection to db.
│   ├── models/             # Direct interaction with db. 
│   ├── routes/             # Implementation of APIs.               
│   ├── report/             # Generated report json files. 
│   ├── config.py
│   ├── Dockerfile
│   ├── openapi.yaml        # API testing for frontend. 
│   ├── requirements.txt
│   ├── store_factors       # (Can be refactor) Seeding for factors from government. 
│   └── store_tags          # (Can be refactor) Seeding for tags from government. 
├── database
│   ├── Dockerfile
│   ├── migrate.py          # Control the flow of migration. 
│   ├── migrations/         # Records of modified schemas. 
│   └── seeds/              # Sql statments to manually add the seed to db for testing. 
├── chain-service
│   ├── Dockerfile
│   ├── contracts/          # Smart contract source files and ABIs.
│   └── src/                # API implementation for blockchain interaction (Web3/Ethers).
├── docker-compose.yml
├── Makefile                 # (Can refactor to scripts) Frequently used commands in Makefile. 
└── scripts                 # Frequently used commands in scripts. 
    └── deploy.sh
```

---
### 1. Requirements

* Docker & Docker Compose v2+


### 2. Start backend services

```bash
make backend-build         # only the first time
make up                    # up all the services
```



---


## 🗂️ Migrations

Migrations are stored in `database/migrations` as ordered `.sql` files:

* `001_init.sql` → initial schema
* `00x_new_change.sql` → future changes for migrations

To apply new migrations:

```bash
make migrate
```

The script will skip already-applied files (tracked in `schema_migrations`).

---

## Notes

* Always use **service name `db`** as `DB_HOST` inside containers.
* Use `docker compose down -v --remove-orphans` to wipe DB + volumes if you need a clean reset.
* Backend serves on [http://localhost:5001](http://localhost:5001) by default.
