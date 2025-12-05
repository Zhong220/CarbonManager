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
CHAIN_SVC?=chain-service
CHAIN_URL=http://127.0.0.1:3001

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
db-up: ## Start MySQL (db service) and wait until healthy
	@echo "✅ Starting MySQL..."
	docker compose up -d $(DB_SVC)
	@echo "⏳ Waiting for MySQL healthcheck..."
	@for i in $$(seq 1 30); do \
	  docker compose ps $(DB_SVC) | grep -q "healthy" && echo "✅ MySQL is healthy" && break; \
	  sleep 2; \
	  if [ $$i -eq 30 ]; then echo "❌ MySQL not healthy in time"; exit 1; fi; \
	done
	@echo "MySQL started on port: $${MYSQL_PORT:-3306}"

db-down: ## Stop MySQL only
	@echo "🧹Stopping MySQL..."
	docker compose stop $(DB_SVC)

db-reset: ## ⚠️ Reset DB (destroys all data), recreates and waits healthy
	@echo "⚠️ Resetting DB (dropping volumes) ..."
	docker compose down -v $(DB_SVC)
	docker compose up -d $(DB_SVC)
	@echo "⏳ Waiting for MySQL healthcheck..."
	@for i in $$(seq 1 30); do \
	  docker compose ps $(DB_SVC) | grep -q "healthy" && echo "✅ MySQL is healthy" && break; \
	  sleep 2; \
	  if [ $$i -eq 30 ]; then echo "❌ MySQL not healthy in time"; exit 1; fi; \
	done

db-shell: ## Open MySQL shell as app user
	docker exec -it $(DB_CONTAINER) mysql -u $${MYSQL_USER} -p$${MYSQL_PASSWORD} $${MYSQL_DATABASE}

db-show-tables: ## List tables
	docker compose exec $(DB_SVC) \
	  mysql -u $$MYSQL_USER -p$$MYSQL_PASSWORD -D $$MYSQL_DATABASE \
	  -e "SHOW TABLES;"

db-show-create-%: ## Show full DDL of table (Replace % with table name)
	docker compose exec $(DB_SVC) \
	  mysql -u $$MYSQL_USER -p$$MYSQL_PASSWORD -D $$MYSQL_DATABASE \
	  -e "SHOW CREATE TABLE $*;"

db-desc-%: ## Show schema of table (Replace % with table name)
	docker compose exec $(DB_SVC) \
	  mysql -u $$MYSQL_USER -p$$MYSQL_PASSWORD -D $$MYSQL_DATABASE \
	  -e "DESC $*;"

# ========== Migrator ==========
migrate: ## Apply all pending migrations
	bash scripts/deploy.sh migrate

migrations: ## Show applied migrations in schema_migrations table
	docker compose exec $(DB_SVC) \
	  mysql -u $$MYSQL_USER -p$$MYSQL_PASSWORD -D $$MYSQL_DATABASE \
	  -e "SELECT id, filename, applied_at FROM schema_migrations ORDER BY id;"

# ========== Backend ==========
backend-rebuild: ## Rebuild backend image without cache
	docker compose build --no-cache $(BACKEND_SVC)

# backend-wait: ## Wait until backend responds 200 OK
# 	@echo "⏳ Waiting for backend at $(URL)..."
# 	@for i in $$(seq 1 30); do \
# 	  code=$$(curl -s -o /dev/null -w "%{http_code}" "$(URL)/health" || true); \
# 	  if [ "$$code" = "200" ]; then echo "✅ Backend is ready"; exit 0; fi; \
# 	  sleep 1; \
# 	done; \
# 	echo "❌ Backend did not become ready in time"; exit 1

backend-up: ## Start Flask backend
	docker compose up -d $(BACKEND_SVC)
	@echo "Backend at $(URL)"
	# $(MAKE) backend-wait
	$(MAKE) open-site
	
backend-logs: ## Tail backend logs
	docker compose logs -f $(BACKEND_SVC) &
	$(MAKE) open-site
	
backend-ls: ## List backend files (recursive)
	docker compose exec backend ls -R

# ========== One-shot flows ==========
up: down db-up migrate backend-up up-chain ## Start clean: fix networks -> DB -> migrations -> backend -> chain
	@echo "🚀 All services are up"
	$(MAKE) open-site

down: ## Stop all services
	docker compose down
	@echo "🛑 All services are stopped"

# ========== Seeding ==========

seed-dev: ## Apply minimal seed file into DB
	docker compose exec -T $(DB_SVC) \
	  mysql -u $$MYSQL_USER -p$$MYSQL_PASSWORD -D $$MYSQL_DATABASE \
	  < database/seeds/dev_seed.sql

seed-factors:
	@echo "🌱 Seeding emission factors into DB..."
	docker compose exec backend sh -c "cd /app && python -m store_factors.seed_factors"

seed-tags: ## Seed tags into DB
	@echo "🌱 Seeding tags..."
	docker compose exec backend sh -c "cd /app && python -m store_tags.seed_tags"

seed: ## Seed dev data into DB
	$(MAKE) seed-dev
	$(MAKE) seed-factors
	$(MAKE) seed-tags

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

# ========== Chain Service ==========

up-chain: ## Start chain-service container
	@echo "🚀 Starting Chain Service..."
	docker compose up -d $(CHAIN_SVC)
	@echo "⏳ Waiting for chain-service to be ready on $(CHAIN_URL)/health..."
	@ok=0; \
	for i in $$(seq 1 30); do \
	  code=$$(curl -s -m 2 --connect-timeout 1 -o /dev/null -w "%{http_code}" "$(CHAIN_URL)/health" || true); \
	  echo "probe $$i: HTTP $$code"; \
	  if [ "$$code" = "200" ]; then \
	    echo "✅ Chain-service is ready"; ok=1; break; \
	  fi; \
	  sleep 1; \
	done; \
	if [ "$$ok" -ne 1 ]; then \
	  echo "❌ Chain-service did not respond in time"; \
	  echo "📜 Last 120 lines of logs:"; \
	  docker compose logs --tail=120 $(CHAIN_SVC) || true; \
	  exit 1; \
	fi

rebuild-chain: ## Rebuild chain-service image without cache
	@echo "🔧 Rebuilding chain-service image..."
	docker compose build --no-cache $(CHAIN_SVC)

logs-chain: ## Tail chain-service logs
	@echo "📜 Showing chain-service logs..."
	docker compose logs -f $(CHAIN_SVC)


# ========== Deployment wrappers ==========
deploy-prod: ## Deploy to production using scripts/deploy.sh (full flow)
	bash scripts/deploy.sh full

deploy-prod-app: ## Deploy only app containers (no migrations)
	bash scripts/deploy.sh app
