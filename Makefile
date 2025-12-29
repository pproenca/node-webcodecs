# node-webcodecs Makefile
# Run 'make help' for available targets

.DELETE_ON_ERROR:
.DEFAULT_GOAL := all

# ============================================================================
# Configuration
# ============================================================================

# Override these via environment or command line: make build NPM=pnpm
NPM ?= npm
CMAKE_JS := $(NPM) exec cmake-js --
TSC := $(NPM) exec tsc --
CPPLINT := cpplint
CLANG_FORMAT := clang-format

# ============================================================================
# Targets
# ============================================================================

##@ Setup

.PHONY: all
all: install build  ## Default: bootstrap project for development

.PHONY: install
install:  ## Install all dependencies
	$(NPM) install

##@ Development

.PHONY: dev
dev: build  ## Build and prepare for development
	@echo "Ready for development"

##@ Testing

.PHONY: test
test:  ## Run all tests
	$(NPM) test

.PHONY: test-guardrails
test-guardrails:  ## Run guardrail tests
	$(NPM) run test:guardrails

.PHONY: check
check: lint test  ## Run all checks (lint + test)

##@ Code Quality

.PHONY: lint
lint:  ## Check code style and quality (no auto-fix)
	$(CPPLINT) --recursive src/

.PHONY: format
format:  ## Auto-format C++ code
	$(CLANG_FORMAT) -i -style=file src/*.cc src/*.h

##@ Build

.PHONY: build
build: build-native build-ts  ## Build everything (native + TypeScript)

.PHONY: build-native
build-native:  ## Build native addon
	$(CMAKE_JS) compile

.PHONY: build-ts
build-ts:  ## Build TypeScript
	$(TSC)

.PHONY: rebuild
rebuild: clean build  ## Clean and rebuild everything

##@ Cleanup

.PHONY: clean
clean:  ## Remove build artifacts and caches
	$(RM) -r build dist

##@ Help

.PHONY: help
help:  ## Show this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) }' $(MAKEFILE_LIST)
