# Capability: CI Test Reporting

Provides visibility into test results directly in GitHub PRs and job summaries.

## ADDED Requirements

### Requirement: Node.js Test GitHub Annotations

The CI workflow SHALL produce GitHub annotations for Node.js test failures that appear inline in PR diffs.

#### Scenario: Test failure produces annotation

- **GIVEN** a pull request with a failing Node.js test
- **WHEN** the CI workflow runs `npm run test:ci`
- **THEN** the failing test produces a GitHub annotation visible in:
  - The "Checks" tab of the pull request
  - The "Files changed" tab inline with the relevant code

#### Scenario: All tests pass

- **GIVEN** a pull request with all Node.js tests passing
- **WHEN** the CI workflow runs `npm run test:ci`
- **THEN** no error annotations are produced
- **AND** the job completes successfully

---

### Requirement: C++ Test JUnit Output

The CI workflow SHALL run C++ tests with JUnit XML output format for integration with GitHub Actions test reporters.

#### Scenario: C++ tests produce JUnit XML

- **GIVEN** the native test suite is built
- **WHEN** the CI workflow runs C++ tests
- **THEN** a JUnit XML file is produced containing:
  - Test suite names
  - Individual test case results (pass/fail/skip)
  - Failure messages and stack traces for failing tests

---

### Requirement: Test Result Publication

The CI workflow SHALL publish combined Node.js and C++ test results using `EnricoMi/publish-unit-test-result-action`.

#### Scenario: Test results published on PR

- **GIVEN** a pull request triggers CI
- **WHEN** both Node.js and C++ tests complete
- **THEN** the action publishes test results including:
  - Annotations on failing test code locations
  - A PR comment summarizing pass/fail counts
  - A job summary with test statistics

#### Scenario: Test results on push to master

- **GIVEN** a push to the `master` branch
- **WHEN** tests complete
- **THEN** the action publishes test results to the job summary (no PR comment)

---

### Requirement: CI Test Scripts

The project SHALL provide CI-specific npm scripts that configure reporters for GitHub Actions integration.

#### Scenario: npm run test:ci

- **GIVEN** the `GITHUB_ACTIONS` environment variable is set
- **WHEN** `npm run test:ci` is executed
- **THEN** tests run with:
  - `spec` reporter output to stdout for human readability
  - `node-test-github-reporter` for GitHub annotations

#### Scenario: npm run test:native:ci

- **GIVEN** C++ tests are built
- **WHEN** `npm run test:native:ci` is executed
- **THEN** GoogleTest runs with `--gtest_output=xml:native-results.xml`
- **AND** the XML file is placed in a predictable location for collection

---

### Requirement: Workflow Permissions

The CI workflow SHALL request appropriate permissions for test result publication.

#### Scenario: Fork PR permissions

- **GIVEN** a pull request from a forked repository
- **WHEN** the CI workflow runs
- **THEN** the workflow has sufficient permissions to:
  - Create check runs with annotations
  - Post PR comments (if not from a fork, due to GitHub security model)

---

## Cross-References

- Extends: `ci-workflow` capability (from `introduce-ci-workflow` change)
