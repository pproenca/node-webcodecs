# Proposal: Add CI Test Reporting

## Summary

Integrate test results from Node.js and C++ tests into GitHub Actions with inline annotations, PR comments, and job summaries.

## Problem

Currently, test failures in CI are only visible in raw console output. Developers must scroll through logs to find failures. GitHub provides native support for test result visualization via:
- Inline annotations on failing code in PR diffs
- Job summaries with pass/fail counts
- PR comments with test result summaries

## Solution

1. **Node.js tests**: Add `node-test-github-reporter` to emit GitHub workflow commands for inline annotations on test failures
2. **C++ tests**: Run GoogleTest with JUnit XML output, publish via `EnricoMi/publish-unit-test-result-action`
3. **Unified reporting**: Single action publishes both Node.js and C++ test results

## Scope

- Modify `.github/workflows/ci.yml` to:
  - Add workflow permissions for checks and pull-requests
  - Install and use `node-test-github-reporter` for Node.js tests
  - Run C++ tests with JUnit XML output via CTest
  - Publish combined test results with annotations

- Add npm script `test:ci` for CI-specific test reporter configuration

## Out of Scope

- Code coverage reporting (separate concern)
- Slack/Discord notifications
- Historical test analytics

## Dependencies

- `node-test-github-reporter` (dev dependency)
- `EnricoMi/publish-unit-test-result-action@v2` (GitHub Action)

## Risks

- **Low**: GitHub Action permissions may need adjustment for forked PR workflows
- **Low**: C++ test runner must be modified to output JUnit XML format
