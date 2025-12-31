# Scoped npm Publishing Workflow Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-12-31-scoped-npm-publishing.md` to implement task-by-task.

**Goal:** Configure the package for publishing as `@pproenca/node-webcodecs` on npm with proper public access settings.

**Architecture:** Update package.json with scoped name and publishConfig, modify release workflow to use `--access public` flag for scoped packages.

**Tech Stack:** npm, GitHub Actions

---

## Task Group 1: Package Configuration (Sequential)

### Task 1: Update package.json with scoped name and publishConfig

**Files:**
- Modify: `package.json`

**Step 1: Update package name to scoped format** (2 min)

Edit `package.json` line 2 to change the name from unscoped to scoped:

```json
"name": "@pproenca/node-webcodecs",
```

**Step 2: Add publishConfig for public access** (2 min)

Add `publishConfig` after the `engines` field (around line 68) in `package.json`:

```json
"engines": {
  "node": ">=18.0.0"
},
"publishConfig": {
  "access": "public",
  "registry": "https://registry.npmjs.org/"
}
```

**Step 3: Verify package.json is valid JSON** (30 sec)

```bash
node -e "require('./package.json')" && echo "Valid JSON"
```

Expected: `Valid JSON` (no errors)

**Step 4: Verify npm recognizes the scoped package** (30 sec)

```bash
npm pkg get name
```

Expected: `"@pproenca/node-webcodecs"`

**Step 5: Commit changes** (30 sec)

```bash
git add package.json
git commit -m "chore: rename package to @pproenca/node-webcodecs scope"
```

---

### Task 2: Update release workflow for scoped publishing

**Files:**
- Modify: `.github/workflows/release.yml`

**Step 1: Add --access public flag to npm publish command** (2 min)

Edit `.github/workflows/release.yml` line 99. Change:

```yaml
run: npm publish --tag=${{ contains(github.ref, '-rc') && 'next' || 'latest' }}
```

To:

```yaml
run: npm publish --access public --tag=${{ contains(github.ref, '-rc') && 'next' || 'latest' }}
```

The `--access public` flag is required for scoped packages to be publicly accessible (scoped packages default to private).

**Step 2: Verify YAML syntax** (30 sec)

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml'))" && echo "Valid YAML"
```

Expected: `Valid YAML` (no errors)

**Step 3: Commit changes** (30 sec)

```bash
git add .github/workflows/release.yml
git commit -m "ci: add --access public for scoped package publishing"
```

---

## Task Group 2: Local Verification (Sequential)

### Task 3: Test dry-run publish

**Files:**
- None (verification only)

**Step 1: Run npm pack to simulate publish** (1 min)

```bash
npm pack --dry-run
```

Expected output should show:
- Package name: `@pproenca/node-webcodecs`
- Files list matching the `files` array in package.json
- Total package size

**Step 2: Verify publishConfig is recognized** (30 sec)

```bash
npm pkg get publishConfig
```

Expected:
```json
{
  "access": "public",
  "registry": "https://registry.npmjs.org/"
}
```

**Step 3: Test actual pack (creates tarball)** (1 min)

```bash
npm pack
```

Expected: Creates file `pproenca-node-webcodecs-0.1.0.tgz`

**Step 4: Inspect tarball contents** (30 sec)

```bash
tar -tzf pproenca-node-webcodecs-0.1.0.tgz | head -20
```

Expected: Should list files under `package/` prefix (dist/, install/, src/, etc.)

**Step 5: Clean up tarball** (30 sec)

```bash
rm pproenca-node-webcodecs-0.1.0.tgz
```

---

### Task 4: Test publish dry-run with access flag

**Files:**
- None (verification only)

**Step 1: Run npm publish with dry-run** (1 min)

```bash
npm publish --access public --dry-run
```

Expected:
- Shows what would be published
- No errors about access or authentication
- Package name shows as `@pproenca/node-webcodecs`

**Note:** This will fail if not logged into npm, but the dry-run should still show the package metadata correctly before the auth check.

---

## Task Group 3: Documentation (Parallel with Task 4)

### Task 5: Update repository URLs for scoped package

**Files:**
- Modify: `package.json`

**Step 1: Verify homepage and repository URLs are correct** (1 min)

Check current URLs in package.json:

```json
"homepage": "https://github.com/pproenca/node-webcodecs",
"repository": {
  "type": "git",
  "url": "git://github.com/pproenca/node-webcodecs.git"
},
"bugs": {
  "url": "https://github.com/pproenca/node-webcodecs/issues"
}
```

These URLs remain correct - the GitHub repo name doesn't need to match the npm scope.

**Step 2: No changes needed if URLs are correct** (0 min)

Skip commit if no changes were made.

---

## Final Task: Code Review

### Task 6: Review all changes

**Files:**
- Review: All modified files

**Step 1: Review the diff** (2 min)

```bash
git diff HEAD~2..HEAD
```

Verify:
1. package.json has scoped name `@pproenca/node-webcodecs`
2. package.json has `publishConfig` with `access: public`
3. release.yml has `--access public` flag

**Step 2: Run full test suite** (2 min)

```bash
npm test
```

Expected: All tests pass

**Step 3: Final verification** (1 min)

```bash
npm pkg get name publishConfig
```

Expected:
```json
{
  "name": "@pproenca/node-webcodecs",
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  }
}
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `package.json` | Rename to `@pproenca/node-webcodecs`, add `publishConfig` |
| `.github/workflows/release.yml` | Add `--access public` flag |

## Publishing Workflow After Implementation

1. Create and push a version tag: `git tag v0.1.0 && git push origin v0.1.0`
2. GitHub Actions triggers release workflow
3. Tests run on Ubuntu and macOS
4. `npm publish --access public --tag=latest` publishes to npm
5. Package available at `npm install @pproenca/node-webcodecs`

## Prerequisites

- npm account with username `pproenca`
- `NPM_TOKEN` secret configured in GitHub repository settings
- Token must have publish permissions
