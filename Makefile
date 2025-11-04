# =======================
#  Makefile for CarbonManager
# =======================

# --- Load .env into Make ---
ifneq (,$(wildcard .env))
    include .env
    export $(shell sed 's/=.*//' .env)
endif

# --- Config ---
PROJECT?=carbonmanager
DB_SVC?=db
MIGRATOR_SVC?=migrator
BACKEND_SVC?=backend
DB_CONTAINER?=carbon-mysql         # container_name (matches docker-compose.yml)
DB_ROOT?=root
DB_HOST_IN_CONTAINER?=127.0.0.1    # for mysqladmin ping inside container
URL=http://127.0.0.1:5001

# --- Utility ---
help: ## Show available make commands
	@echo "Usage: make <target>\n"
	@grep -E '^[a-zA-Z0-9_.%/-]+:.*?## ' $(MAKEFILE_LIST) --no-filename | \
	awk 'BEGIN {FS=":.*?## " } {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

open-site:
	@if [ "$$(uname)" = "Darwin" ]; then \
		open $(URL); \
	elif [ "$$(uname)" = "Linux" ]; then \
		xdg-open $(URL); \
	else \
		start $(URL); \
	fi

# ========== DB lifecycle ==========
up-db: ## Start MySQL (db service) and wait until healthy
	@echo "✅ Starting MySQL..."
	docker compose up -d $(DB_SVC)
	@echo "⏳ Waiting for MySQL healthcheck..."
	@for i in $$(seq 1 30); do \
	  docker compose ps $(DB_SVC) | grep -q "healthy" && echo "✅ MySQL is healthy" && break; \
	  sleep 2; \
	  if [ $$i -eq 30 ]; then echo "❌ MySQL not healthy in time"; exit 1; fi; \
	done
	@echo "MySQL started on port: $${MYSQL_PORT:-3306}"

down-db: ## Stop MySQL only
	@echo "🧹Stopping MySQL..."
	docker compose stop $(DB_SVC)

reset-db: ## ⚠️ Reset DB (destroys all data), recreates and waits healthy
	@echo "⚠️ Resetting DB (dropping volumes) ..."
	docker compose down -v $(DB_SVC)
	docker compose up -d $(DB_SVC)
	@echo "⏳ Waiting for MySQL healthcheck..."
	@for i in $$(seq 1 30); do \
	  docker compose ps $(DB_SVC) | grep -q "healthy" && echo "✅ MySQL is healthy" && break; \
	  sleep 2; \
	  if [ $$i -eq 30 ]; then echo "❌ MySQL not healthy in time"; exit 1; fi; \
	done

# ========== Migrator ==========
migrate: ## Apply all pending migrations
	@echo "🔧 Applying migrations..."
	docker compose up $(MIGRATOR_SVC)

migrations-status: ## Show applied migrations in schema_migrations table
	@echo "✅ Migrations status displayed."
	docker compose exec $(DB_SVC) \
	  mysql -u $$MYSQL_USER -p$$MYSQL_PASSWORD -D $$MYSQL_DATABASE \
	  -e "SELECT id, filename, applied_at FROM schema_migrations ORDER BY id;"

seed-factors: ## Seed emission factors into DB
	@echo "🌱 Seeding emission factors into DB..."
	docker compose exec backend sh -c "cd /app && python -m store_factors.seed_factors"

# ========== Backend ==========

rebuild: ## Rebuild backend image without cache
	docker compose build --no-cache $(BACKEND_SVC)


wait-backend: ## Wait until backend responds 200 OK
	@echo "⏳ Waiting for backend at $(URL)..."
	@for i in $$(seq 1 30); do \
	  code=$$(curl -s -o /dev/null -w "%{http_code}" "$(URL)/health" || true); \
	  if [ "$$code" = "200" ]; then echo "✅ Backend is ready"; exit 0; fi; \
	  sleep 1; \
	done; \
	echo "❌ Backend did not become ready in time"; exit 1

up-backend: ## Start Flask backend
	docker compose up -d $(BACKEND_SVC)
	@echo "Backend at $(URL)"
	$(MAKE) wait-backend
	$(MAKE) open-site
	
logs: ## Tail backend logs
	docker compose logs -f $(BACKEND_SVC) &
	$(MAKE) open-site
	
ls-backend: ## List backend files (recursive)
	docker compose exec backend ls -R
# ========== One-shot flows ==========
up: down up-db migrate up-backend ## Start clean: fix networks -> DB -> migrations -> backend
	@echo "🚀 All services are up"
	$(MAKE) open-site

down: ## Stop all services
	docker compose down

init-db: reset-db migrate schema ## Reset DB, run migrations, then show schema summary

# ========== DB utilities ==========
db-shell-root: ## Open MySQL shell as root
	docker exec -it $(DB_CONTAINER) mysql -u $(DB_ROOT) -p$${MYSQL_ROOT_PASSWORD}

db-shell: ## Open MySQL shell as app user
	docker exec -it $(DB_CONTAINER) mysql -u $${MYSQL_USER} -p$${MYSQL_PASSWORD} $${MYSQL_DATABASE}

dump-schema: ## Export schema only to database/schema_dump.sql (no tablespaces noise)
	@echo "# structure-only snapshot to database/schema_dump.sql"
	docker exec $(DB_CONTAINER) sh -c \
	"mysqldump -u $$MYSQL_USER -p$$MYSQL_PASSWORD --no-data --no-tablespaces $$MYSQL_DATABASE" \
	> database/schema_dump.sql
	@echo "✅ Wrote database/schema_dump.sql"

show-tables: ## List tables
	docker compose exec $(DB_SVC) \
	  mysql -u $$MYSQL_USER -p$$MYSQL_PASSWORD -D $$MYSQL_DATABASE \
	  -e "SHOW TABLES;"

desc-%: ## Show schema of table (Replace % with table name: make desc-table)
	docker compose exec $(DB_SVC) \
	  mysql -u $$MYSQL_USER -p$$MYSQL_PASSWORD -D $$MYSQL_DATABASE \
	  -e "DESC $*;"



# ========== Health / Tests ==========
test: ## Test backend endpoints (/health)
	@curl -s http://localhost:5001/health | jq .



seed: ## Apply minimal seed file into DB
	docker compose exec -T $(DB_SVC) \
	  mysql -u $$MYSQL_USER -p$$MYSQL_PASSWORD -D $$MYSQL_DATABASE \
	  < database/seeds/dev_seed.sql

show-seed-emission: ## Show seed emission(s)
	docker compose exec $(DB_SVC) \
	  mysql -N -u $$MYSQL_USER -p$$MYSQL_PASSWORD -D $$MYSQL_DATABASE \
	  -e "SELECT id, name, product_id, stage_id FROM emissions ORDER BY id DESC LIMIT 5;"

# # ========== CI Backend ==========

# be-format: ## Auto-format (ruff imports + black)
# 	cd backend && ruff check . --fix
# 	cd backend && python -m black .

# be-lint: ## Lint (ruff + black check)
# 	cd backend && ruff check .
# 	cd backend && python -m black --check .

# be-test:
# 	cd backend && pytest -q

# be-fix: ## Auto-fix
# 	cd backend && ruff check . --fix
# 	cd backend && python -m black .
# 	$(MAKE) be-lint

# be-setup: ## Install backend dev deps
# 	cd backend && pip install -r requirements.txt -r requirements-dev.txt
