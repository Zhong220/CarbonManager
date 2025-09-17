# ---- Config ----
PROJECT?=carbonmanager
DB_SVC?=db
MIGRATOR_SVC?=migrator
BACKEND_SVC?=backend

# ---- Docker Compose wrappers ----
ps:
	docker compose ps

logs:
	docker compose logs -f $(BACKEND_SVC)

up-db:
	docker compose up -d $(DB_SVC)

up-migrator:
	docker compose up $(MIGRATOR_SVC)

up-backend:
	docker compose up -d $(BACKEND_SVC)

up: up-db up-migrator up-backend

down:
	docker compose down

down-all:
	docker compose down --remove-orphans

reset-db:
	# ⚠️ nukes DB volume for a fresh init
	docker compose down -v --remove-orphans
	docker compose up -d $(DB_SVC)
	# wait a bit for mysql init to finish
	@sleep 5
	docker compose ps

rebuild:
	docker compose build --no-cache $(BACKEND_SVC)

# ---- DB utilities ----
db-shell-root:
	docker exec -it carbon-mysql mysql -u root -p$${MYSQL_ROOT_PASSWORD}

db-shell:
	docker exec -it carbon-mysql mysql -u $${MYSQL_USER} -p$${MYSQL_PASSWORD} $${MYSQL_DATABASE}

dump-schema:
	# structure-only snapshot to database/schema_dump.sql
	docker exec carbon-mysql sh -c "mysqldump -u $$MYSQL_USER -p$$MYSQL_PASSWORD --no-data $$MYSQL_DATABASE" > database/schema_dump.sql

# ---- One-liners for daily use ----
dev: up          # start db -> migrate -> backend
clean: down-all  # stop everything & remove orphans
