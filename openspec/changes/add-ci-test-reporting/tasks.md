# Tasks: Add CI Test Reporting

## Phase 1: Node.js Test Reporting

1. [x] Install `node-test-github-reporter` as dev dependency
2. [x] Add `test:ci` npm script that uses both `spec` (for console) and `node-test-github-reporter` (for annotations)
3. [x] Verify Node.js test annotations work locally with `GITHUB_ACTIONS=true` environment variable

## Phase 2: C++ Test Reporting

4. [x] Add `test:native:ci` npm script that builds and runs tests with JUnit output
5. [x] Verify GoogleTest produces valid JUnit XML output

## Phase 3: CI Workflow Updates

6. [x] Add `checks: write` and `pull-requests: write` permissions to workflow
7. [x] Update build jobs to use `npm run test:ci` instead of `npm test`
8. [x] Add step to run native C++ tests with JUnit output (macOS only)
9. [x] Add `EnricoMi/publish-unit-test-result-action@v2` step to publish test results

## Phase 4: Verification

10. [ ] Run CI workflow on a test PR to verify annotations appear
11. [ ] Verify PR comment shows test summary
12. [ ] Verify job summary displays test counts
13. [ ] Test failure case: ensure failing tests produce visible annotations
