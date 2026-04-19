# TrustLayer — Makefile
# Każde zadanie deleguje do scripts/dev żeby nie duplikować logiki.

.DEFAULT_GOAL := help
.PHONY: help up down logs restart shell reset test status prod rebuild watch check clean snapshot

help:  ## Pokaz dostepne komendy
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

up:            ## Odpala dev stack (hot reload)
	@./scripts/dev up

down:          ## Zatrzymuje dev stack
	@./scripts/dev down

logs:          ## Logi wszystkich serwisow (LOGS=<svc> dla konkretnego)
	@./scripts/dev logs $(LOGS)

restart:       ## Restart serwisu (SVC=backend|frontend)
	@./scripts/dev restart $(SVC)

shell-backend: ## Bash w kontenerze backendu
	@./scripts/dev shell backend

shell-frontend: ## Sh w kontenerze frontendu
	@./scripts/dev shell frontend

reset:         ## Reset demo data
	@./scripts/dev reset-db

test:          ## Testy backendu
	@./scripts/dev test

check:         ## Pelen smoke test systemu
	@./scripts/check

status:        ## Status kontenerow + healthchecki
	@./scripts/dev status

prod:          ## Build + uruchomienie prod
	@./scripts/dev prod

rebuild:       ## Force rebuild obrazow
	@./scripts/dev rebuild

watch:         ## Watcher zmian z auto-testami
	@./scripts/watch

snapshot:      ## Zip projektu (bez node_modules / .next / pycache)
	@./scripts/dev snapshot

clean:         ## Usuwa wszystko: kontenery, volumes, obrazy
	@./scripts/dev nuke
