# Sharp Quality Bar Implementation Plan (Phases 2-5)

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-12-31-sharp-quality-bar-implementation.md` to implement task-by-task.

**Goal:** Complete Phases 2-5 of sharp quality bar adoption: LICENSE, package.json polish, CI hardening, release automation, and issue templates.

**Architecture:** Incremental improvements to repository infrastructure. Phase 1 (file cleanup, biome, docs, lib split) is already complete.

**Tech Stack:** GitHub Actions, npm, node-gyp, Biome

---

## Completed (Phase 1) ✅

- [x] Delete orphaned files (Makefile, TODO.md, etc.)
- [x] Migrate to Biome from eslint/prettier
- [x] Add README.md and CONTRIBUTING.md
- [x] Split lib/index.ts into separate modules
- [x] Add lint-first job to CI
- [x] Add basic npm-smoke.yml workflow
- [x] Add basic issue templates

---

## Remaining Tasks (Phases 2-5)

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1, 2 | LICENSE and package.json - independent files |
| Group 2 | 3 | install/build.js - new file |
| Group 3 | 4, 5 | CI workflows - can be done in parallel |
| Group 4 | 6 | Issue templates enhancement |
| Group 5 | 7 | Code Review |

---

### Task 1: Add LICENSE File

**Files:**
- Create: `LICENSE`

**Step 1: Create MIT LICENSE file**

Create `LICENSE` in repository root with the following content:

```text
MIT License

Copyright (c) 2024 Pedro Proença

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

**Step 2: Verify file exists**

```bash
cat LICENSE | head -5
```

Expected: Shows "MIT License" and copyright line.

**Step 3: Commit**

```bash
git add LICENSE
git commit -m "chore: add MIT LICENSE file"
```

---

### Task 2: Polish package.json

**Files:**
- Modify: `package.json`

**Step 1: Add metadata fields**

Add the following fields to `package.json` after `"license": "MIT"`:

```json
  "homepage": "https://github.com/pproenca/node-webcodecs",
  "repository": {
    "type": "git",
    "url": "git://github.com/pproenca/node-webcodecs.git"
  },
  "bugs": {
    "url": "https://github.com/pproenca/node-webcodecs/issues"
  },
  "author": "Pedro Proença",
  "files": [
    "dist",
    "install",
    "src/*.cc",
    "src/*.h",
    "binding.gyp",
    "build/Release/*.node"
  ],
```

**Step 2: Remove unused devDependencies**

Remove `gts` from devDependencies (replaced by biome).

**Step 3: Remove unused scripts**

Remove `bench` and `bench:gc` scripts (bench/ directory was deleted).

**Step 4: Verify package.json is valid JSON**

```bash
node -e "require('./package.json')" && echo "Valid JSON"
```

Expected: "Valid JSON"

**Step 5: Test npm pack**

```bash
npm pack --dry-run 2>&1 | head -20
```

Expected: Shows list of files that would be included in package.

**Step 6: Commit**

```bash
git add package.json
git commit -m "chore: polish package.json with metadata and files array"
```

---

### Task 3: Add install/build.js

**Files:**
- Create: `install/build.js`
- Modify: `package.json` (install script)

**Step 1: Create install/build.js**

Create `install/build.js`:

```javascript
#!/usr/bin/env node
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Build native addon from source.

'use strict';

const { spawnSync } = require('child_process');

console.log('node-webcodecs: Building from source...');

// Verify node-addon-api is available
try {
  require.resolve('node-addon-api');
  console.log('✓ node-addon-api found');
} catch {
  console.error('✗ node-addon-api not found');
  console.error('  Run: npm install node-addon-api');
  process.exit(1);
}

// Verify node-gyp is available
try {
  require.resolve('node-gyp');
  console.log('✓ node-gyp found');
} catch {
  console.error('✗ node-gyp not found');
  console.error('  Run: npm install node-gyp');
  process.exit(1);
}

// Run node-gyp rebuild
console.log('\nRunning node-gyp rebuild...\n');

const result = spawnSync('npx', ['node-gyp', 'rebuild'], {
  stdio: 'inherit',
  shell: true,
});

if (result.status !== 0) {
  console.error('\n✗ Build failed');
  console.error('  Check the output above for errors.');
  console.error('  Common issues:');
  console.error('    - FFmpeg development libraries not installed');
  console.error('    - C++ compiler not found');
  console.error('    - pkg-config not found');
  process.exit(result.status || 1);
}

console.log('\n✓ Build successful');
```

**Step 2: Update package.json install script**

Change the install script from:
```json
"install": "node install/check.js && (node-gyp-build || npm run build:native)"
```

To:
```json
"install": "node install/check.js || node install/build.js"
```

**Step 3: Test build script exists**

```bash
node -c install/build.js && echo "Syntax OK"
```

Expected: "Syntax OK"

**Step 4: Commit**

```bash
git add install/build.js package.json
git commit -m "feat(install): add build.js for source builds"
```

---

### Task 4: Harden CI with Permissions and Expand Matrix

**Files:**
- Modify: `.github/workflows/ci.yml`

**Step 1: Add global permissions block**

Add at the top of ci.yml, after `on:` block:

```yaml
permissions: {}
```

**Step 2: Add per-job permissions to each job**

Add `permissions: contents: read` to each job. Example:

```yaml
  lint:
    permissions:
      contents: read
    runs-on: ubuntu-latest
```

**Step 3: Expand matrix to include darwin-arm64**

Update the build-and-test matrix to use specific macOS runners:

```yaml
    strategy:
      fail-fast: false
      matrix:
        include:
          - os: ubuntu-latest
            node-version: 18
          - os: ubuntu-latest
            node-version: 20
          - os: ubuntu-latest
            node-version: 22
          - os: macos-13
            node-version: 18
          - os: macos-13
            node-version: 20
          - os: macos-13
            node-version: 22
          - os: macos-latest
            node-version: 18
          - os: macos-latest
            node-version: 20
          - os: macos-latest
            node-version: 22
```

Note: `macos-13` is Intel (x64), `macos-latest` is ARM64 (Apple Silicon).

**Step 4: Verify YAML is valid**

```bash
head -30 .github/workflows/ci.yml
```

**Step 5: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add explicit permissions and darwin-arm64 to matrix"
```

---

### Task 5: Add Release Workflow

**Files:**
- Create: `.github/workflows/release.yml`

**Step 1: Create release workflow**

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags:
      - "v**"

permissions: {}

jobs:
  build-and-test:
    permissions:
      contents: read
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        include:
          - os: ubuntu-latest
            node-version: 22
          - os: macos-13
            node-version: 22
          - os: macos-latest
            node-version: 22

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v5
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install FFmpeg (Ubuntu)
        if: runner.os == 'Linux'
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            libavcodec-dev \
            libavformat-dev \
            libavutil-dev \
            libswscale-dev \
            libswresample-dev \
            libavfilter-dev \
            pkg-config

      - name: Install FFmpeg (macOS)
        if: runner.os == 'macOS'
        run: brew install ffmpeg pkg-config

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Test
        run: npm test

  publish:
    needs: build-and-test
    runs-on: ubuntu-latest
    permissions:
      contents: write
      id-token: write
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v5
        with:
          node-version: "22"
          registry-url: "https://registry.npmjs.org"
          cache: 'npm'

      - name: Install FFmpeg
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            libavcodec-dev \
            libavformat-dev \
            libavutil-dev \
            libswscale-dev \
            libswresample-dev \
            libavfilter-dev \
            pkg-config

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Test
        run: npm test

      - name: Publish to npm
        run: npm publish --tag=${{ contains(github.ref, '-rc') && 'next' || 'latest' }}
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Step 2: Verify YAML syntax**

```bash
head -30 .github/workflows/release.yml
```

**Step 3: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: add release workflow for npm publishing on tags"
```

---

### Task 6: Enhance Issue Templates

**Files:**
- Create: `.github/ISSUE_TEMPLATE/installation.yml`
- Modify: `.github/ISSUE_TEMPLATE/bug_report.yml`
- Modify: `.github/ISSUE_TEMPLATE/config.yml`

**Step 1: Create installation issue template**

Create `.github/ISSUE_TEMPLATE/installation.yml`:

```yaml
name: Installation problem
description: Installation or build failed
labels: ["installation", "triage"]
body:
  - type: markdown
    attributes:
      value: |
        Before opening an issue, please try:
        1. `npm cache clean --force`
        2. Delete `node_modules` and `package-lock.json`
        3. Run `npm install` again

  - type: checkboxes
    id: prereqs
    attributes:
      label: Prerequisites
      options:
        - label: I have read the [installation guide](https://github.com/pproenca/node-webcodecs#installation)
          required: true
        - label: I have searched for existing issues
          required: true

  - type: textarea
    id: error
    attributes:
      label: Error message
      description: Full error output from `npm install`
      render: shell
    validations:
      required: true

  - type: textarea
    id: ffmpeg
    attributes:
      label: FFmpeg version
      description: |
        Run: `pkg-config --modversion libavcodec` (Linux/macOS)
        Or: `ffmpeg -version` (Windows)
      render: shell
    validations:
      required: true

  - type: textarea
    id: envinfo
    attributes:
      label: Environment info
      description: |
        Run: `npx envinfo --system --binaries --npmPackages=node-webcodecs`
      render: shell
    validations:
      required: true

  - type: dropdown
    id: os
    attributes:
      label: Operating system
      options:
        - macOS (Intel)
        - macOS (Apple Silicon)
        - Ubuntu/Debian
        - Fedora/RHEL
        - Alpine Linux
        - Windows
        - Other
    validations:
      required: true
```

**Step 2: Update bug_report.yml with environment info**

Add this section to `.github/ISSUE_TEMPLATE/bug_report.yml` after the "Additional context" field:

```yaml
  - type: textarea
    id: envinfo
    attributes:
      label: Environment info
      description: |
        Run: `npx envinfo --system --binaries --npmPackages=node-webcodecs`
      render: shell
```

**Step 3: Update config.yml to disable blank issues**

Replace `.github/ISSUE_TEMPLATE/config.yml` content with:

```yaml
blank_issues_enabled: false
contact_links:
  - name: Documentation
    url: https://github.com/pproenca/node-webcodecs#readme
    about: Please read the documentation before opening an issue
  - name: Stack Overflow
    url: https://stackoverflow.com/questions/tagged/webcodecs
    about: Ask questions on Stack Overflow
```

**Step 4: Commit**

```bash
git add .github/ISSUE_TEMPLATE/
git commit -m "docs: enhance issue templates with installation template and diagnostic commands"
```

---

### Task 7: Code Review

Run code review on all changes.

**Step 1: Review commits**

```bash
git log --oneline -10
```

**Step 2: Verify all expected files exist**

```bash
ls LICENSE package.json .github/workflows/release.yml install/build.js .github/ISSUE_TEMPLATE/installation.yml
```

Expected: All files exist.

**Step 3: Run tests**

```bash
npm run build && npm test
```

Expected: All tests pass.

**Step 4: Run lint**

```bash
npm run lint
```

Expected: No lint errors.

**Step 5: Verify npm pack includes expected files**

```bash
npm pack --dry-run 2>&1 | grep -E "^npm notice.*dist|install|src|binding"
```

Expected: Shows dist/, install/, src/*.cc, src/*.h, binding.gyp files.

---

## Post-Completion

After all tasks complete:

1. **Push to remote:**
   ```bash
   git push origin master
   ```

2. **Set up NPM_TOKEN secret (manual step):**
   - Go to GitHub repo → Settings → Secrets → Actions
   - Add `NPM_TOKEN` with npm access token that has publish permissions

3. **Test release workflow (optional):**
   ```bash
   git tag v0.1.1-test
   git push origin v0.1.1-test
   # Check Actions tab for release workflow run
   # Delete test tag after verification:
   git tag -d v0.1.1-test
   git push origin :refs/tags/v0.1.1-test
   ```
