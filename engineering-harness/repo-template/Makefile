# The same targets run on laptops and in the PlatformNEX test build (cloudbuild-tests.yaml).
SHELL := /bin/bash
VENV ?= .venv
BIN := $(if $(wildcard $(VENV)/bin/python),$(VENV)/bin/,)
SERVICE ?= __SERVICE__
ENV ?= dit1

.DEFAULT_GOAL := help
.PHONY: help setup doctor dev dev-remote preview fmt lint test scan gates check build clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk -F ':.*## ' '{printf "  %-18s %s\n", $$1, $$2}'

setup: ## Create the venv, install dependencies and git hooks
	python3 -m venv $(VENV)
	$(VENV)/bin/pip install --quiet --upgrade pip
	$(VENV)/bin/pip install --quiet -e '.[dev]'
	$(VENV)/bin/pre-commit install
	@test -f .env || cp .env.example .env
	@echo "Ready. Try: make dev"

dev: ## Run the service locally with reload (Docker Compose)
	@test -f .env || cp .env.example .env
	docker compose up --build

doctor: ## Check the tools pnx needs (gcloud, kubectl, sign-in); add FIX=1 to install them
	pnx dev doctor $(if $(FIX),--fix,)

dev-remote: ## Run on this machine against a real non-production environment: make dev-remote ENV=dit1
	pnx dev run $(SERVICE) --env $(ENV)

preview: ## Preview the current pull request at its own URL: make preview ENV=dit1
	pnx dev preview $(SERVICE) --env $(ENV)

fmt: ## Format code
	$(BIN)ruff format .
	$(BIN)ruff check --fix .

lint: ## Lint and static security analysis
	$(BIN)ruff format --check .
	$(BIN)ruff check .
	$(BIN)bandit -q -r src

test: ## Run unit tests
	$(BIN)pytest

scan: ## Secret and dependency scans (CI always runs these; locally they run if installed)
	@if command -v gitleaks >/dev/null; then gitleaks dir --redact . ; else echo "gitleaks not installed locally: skipped (CI enforces it)"; fi
	$(BIN)pip-audit --local --skip-editable
	@if command -v trivy >/dev/null; then trivy config --exit-code 1 --severity HIGH,CRITICAL . ; else echo "trivy not installed locally: skipped (CI enforces it)"; fi

gates: ## A feat: change needs a PRD (docs/specs/) or a Skip-PRD reason
	@bash scripts/check-gates.sh

check: lint test scan gates ## Everything the test build checks
	@echo "check passed"

build: ## Build the container image locally (releases are built by PlatformNEX, never from a laptop)
	docker build -t $(SERVICE):local .

clean: ## Remove local build artefacts
	rm -rf $(VENV) .pytest_cache .ruff_cache build dist src/*.egg-info
