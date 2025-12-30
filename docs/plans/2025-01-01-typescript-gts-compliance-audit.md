# TypeScript GTS Compliance Audit - Auto-Fixable Issues

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-01-01-typescript-gts-compliance-audit.md` to implement task-by-task.

**Goal:** Ensure all TypeScript files pass GTS (Google TypeScript Style) linting by fixing auto-fixable issues.

**Architecture:** The project uses GTS v7.0.0 which wraps ESLint with Google's TypeScript Style rules. The linting pipeline is `npm run lint` (check) and `npm run fix` (auto-fix). Currently 20 lint issues exist across 3 files.

**Tech Stack:** GTS 7.0.0, ESLint, Prettier, TypeScript 5.6.3

---

## Current Issues Summary

| File | Issue Type | Count | Auto-fixable |
|------|------------|-------|--------------|
| `bench/index.ts` | Not in tsconfig project | 1 | No (config fix) |
| `lib/binding.ts` | Prettier formatting, single quotes | 9 | Yes |
| `lib/errors.ts` | Missing trailing commas | 9 | Yes |

---

### Task 1: Create tsconfig for bench directory

**Files:**
- Create: `bench/tsconfig.json`

**Why:** The `bench/index.ts` file is not included in any TypeScript project configuration. ESLint's typescript-eslint parser requires files to be part of a tsconfig project for type-aware linting. Without this, `npm run fix` fails with a parsing error before it can fix any issues.

**Step 1: Create bench tsconfig** (2 min)

Create `bench/tsconfig.json` with appropriate settings:

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "types": ["node"]
  },
  "include": ["./**/*.ts"]
}
```

**Step 2: Verify tsconfig is valid** (30 sec)

```bash
npx tsc -p bench/tsconfig.json --noEmit
```

Expected: No errors (or type errors unrelated to linting).

**Step 3: Commit** (30 sec)

```bash
git add bench/tsconfig.json && git commit -m "chore(bench): add tsconfig for ESLint parsing"
```

---

### Task 2: Run GTS auto-fix on all TypeScript files

**Files:**
- Modify: `lib/binding.ts`
- Modify: `lib/errors.ts`

**Why:** GTS provides automatic fixing for most style violations. Running `npm run fix` will apply Prettier formatting and ESLint auto-fixes.

**Step 1: Run GTS fix** (1 min)

```bash
npm run fix
```

Expected: Command completes successfully with no errors (may show 0 problems or no output).

**Step 2: Verify no lint errors remain** (30 sec)

```bash
npm run lint
```

Expected: Clean output with no errors or warnings.

**Step 3: Verify TypeScript compiles** (30 sec)

```bash
npm run typecheck
```

Expected: No type errors.

**Step 4: Commit auto-fixed changes** (30 sec)

```bash
git add lib/binding.ts lib/errors.ts && git commit -m "style: apply GTS auto-fixes (trailing commas, quotes, formatting)"
```

---

### Task 3: Verify tests still pass

**Files:**
- None (verification only)

**Why:** Style changes should not affect runtime behavior, but we must verify tests pass after modifications.

**Step 1: Run test suite** (2 min)

```bash
npm test
```

Expected: All tests pass.

**Step 2: Commit verification (no file changes)** (30 sec)

If tests pass, no commit needed. If tests fail, investigate and fix.

---

### Task 4: Code Review

**Files:**
- Review all changes from Tasks 1-3

**Step 1: Review changes**

```bash
git diff main..HEAD
```

Verify:
- [ ] `bench/tsconfig.json` is minimal and appropriate
- [ ] Auto-fixes in `lib/binding.ts` are only formatting (single quotes)
- [ ] Auto-fixes in `lib/errors.ts` are only trailing commas
- [ ] No logic changes were introduced

**Step 2: Final lint verification**

```bash
npm run lint && npm run typecheck && npm test
```

Expected: All clean, all tests pass.

---

## Parallel Groups

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1 | Config must exist before fix can run |
| Group 2 | 2, 3 | Fix runs first, then tests verify |
| Group 3 | 4 | Code review is always final |

---

## Expected Changes Summary

### lib/binding.ts (lines ~34, ~38, ~132, ~137, ~141, ~148, ~154-156)
- Prettier formatting for multiline path.join
- Double quotes → single quotes
- Remove unused eslint-disable directive

### lib/errors.ts (lines ~64, ~108, ~125, ~145, ~150, ~168, ~185, ~201, ~216)
- Add trailing commas to object properties in error definitions

### bench/tsconfig.json (new file)
- Minimal tsconfig to enable ESLint parsing
