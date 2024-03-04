.ONESHELL:
.DEFAULT_GOAL := help

RINHA_GATLING_VERSION := 3.10.4
RINHA_DIR := rinha-de-backend-2024-q1

# allow user specific optional overrides
-include Makefile.overrides

export

.PHONY: help
help:
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: up
up: ## runs everything
	@docker-compose up --build --force-recreate

.PHONY: down
down: ## stop all systems
	@docker-compose down --remove-orphans

.PHONY: rm
rm: ## remove everything
	@docker-compose down --volumes --remove-orphans

.PHONY: prepare
prepare:
	@git clone --depth 1 --single-branch -b main https://github.com/zanfranceschi/rinha-de-backend-2024-q1.git
	@wget -P $$RINHA_DIR https://repo1.maven.org/maven2/io/gatling/highcharts/gatling-charts-highcharts-bundle/$$RINHA_GATLING_VERSION/gatling-charts-highcharts-bundle-$$RINHA_GATLING_VERSION-bundle.zip
	@unzip -d $$RINHA_DIR $$RINHA_DIR/gatling-charts-highcharts-bundle-$$RINHA_GATLING_VERSION-bundle.zip

.PHONY: test
test:
	./bin/executar-teste-local

.PHONY: up-dev
up-dev: ## run dev env
	@docker-compose -f ./docker-compose-db-only.yml up --force-recreate --build

.PHONY: down-dev
down-dev: ## stop dev env
	@docker-compose -f ./docker-compose-db-only.yml down --volumes --remove-orphans
