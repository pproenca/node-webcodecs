# Plan: Ralph Wiggum Loop for All 52 TODOs

## Execution

### Step 1: Create destination directory

```bash
mkdir -p docs/artifacts/done
```

### Step 2: Run the Ralph Wiggum loop

```
/ralph-wiggum:ralph-loop "
1. List files in .claude/artifacts/TODO*.md
2. If NO TODO files remain → output: <promise>DONE</promise>
3. Read the FIRST TODO file (alphabetically)
4. Implement using TDD per task packet:
   - Read context files listed in task
   - Write failing tests (RED)
   - Implement minimal code (GREEN)
   - Run npm run check
5. Complete all checkboxes in Completion Checklist
6. Move file: mv .claude/artifacts/TODO-X.md docs/artifacts/done/
7. Commit: git add -A && git commit -m 'feat(spec): TODO-X.X - [description]'
" --completion-promise DONE --max-iterations 60
```

### Loop Behavior

- **Each iteration**: Processes ONE TODO file completely
- **Max iterations**: 60 (52 TODOs + buffer for retries)
- **Self-discovering**: Finds next TODO dynamically
- **Exit condition**: No TODOs left in `.claude/artifacts/`

## Monitoring

```bash
# Progress
ls .claude/artifacts/TODO*.md | wc -l     # remaining
ls docs/artifacts/done/TODO*.md | wc -l   # completed

# Current iteration
grep '^iteration:' .claude/ralph-loop.local.md
```

## Cancel

```
/ralph-wiggum:cancel-ralph
```
