# Task Completion Checklist

When completing a task in this project, follow these steps:

## 1. Build
```bash
npm run build
```
This compiles both native C++ and TypeScript. Fix any build errors before proceeding.

## 2. Code Quality (for C++ changes)
```bash
# Format code
clang-format -i -style=file src/*.cc src/*.h

# Lint code
cpplint --recursive src/
```
Fix any linting issues.

## 3. Run Tests
```bash
# Run main test suite
npm test

# For API changes, also run contract tests
npm run test:contracts

# For performance/stability changes, run guardrails
npm run test:guardrails

# Or run everything
npm run test:all
```
All tests must pass.

## 4. Verify Specific Feature
If the task involves a specific feature, manually verify it works:
```bash
node test/XX_relevant_test.js
# or
node examples/basic-encode.js
```

## 5. Commit
Use conventional commit format:
```bash
git add -A
git commit -m "type(scope): description"
```
Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
Scopes: `video`, `audio`, `encoder`, `decoder`, `frame`, `build`, `test`

## Quick Verification Command
For quick verification during development:
```bash
npm run build && npm test
```
