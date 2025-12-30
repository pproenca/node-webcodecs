# Development Commands

## Build Commands
```bash
# Full build (native addon + TypeScript)
npm run build

# Build only native C++ addon
npm run build:native

# Build only TypeScript
npm run build:ts

# Build with coverage instrumentation
npm run build:coverage

# Clean all build artifacts
npm run clean
```

## Testing Commands
```bash
# Run main test suite (sequential tests)
npm test

# Run API contract tests
npm run test:contracts

# Run guardrail tests (memory, event loop, fuzzing, benchmark)
npm run test:guardrails

# Run all tests (suite + contracts + guardrails)
npm run test:all

# Run a single test file
node test/01_smoke.js

# Run tests with JS coverage
npm run test:coverage:js

# Run tests with C++ coverage
npm run test:coverage:cpp

# Generate coverage report
npm run coverage
```

## Code Quality Commands
```bash
# Lint C++ code (cpplint)
cpplint --recursive src/

# Auto-format C++ code (clang-format)
clang-format -i -style=file src/*.cc src/*.h
```

## System Commands (macOS/Darwin)
```bash
# Standard unix commands work as expected
git, ls, cd, grep, find, cat, head, tail

# Check FFmpeg installation
pkg-config --modversion libavcodec

# View native addon
file build/Release/node_webcodecs.node
```
