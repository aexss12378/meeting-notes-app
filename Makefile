COMPOSE=docker compose --project-name meeting_notes

.PHONY: up down logs ps rebuild reset smoke

up:
	$(COMPOSE) up -d --build

down:
	$(COMPOSE) down --remove-orphans

logs:
	$(COMPOSE) logs -f --tail=200

ps:
	$(COMPOSE) ps

rebuild:
	$(COMPOSE) build --no-cache

reset:
	$(COMPOSE) down -v --remove-orphans

smoke:
	curl -fsS http://localhost:8000/health/live
	curl -fsS http://localhost:8000/health/ready
