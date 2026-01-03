# Ralph-Loop: WebCodecs Spec-Compliant Implementation

## Usage

```bash
/ralph-wiggum:ralph-loop "$(cat .claude/commands/ralph-loop-webcodecs.md)" --completion-promise DONE --max-iterations 60
```

## Loop Definition

```
1. List files in .claude/artifacts/TODO*.md
2. If NO TODO files remain → output: <promise>DONE</promise>
3. Read the FIRST TODO file (alphabetically)
4. Extract TASK_ID from filename (e.g., TODO-9.2.md → 9.2)

## PHASE 0: LOAD SKILLS

5. Read development skills BEFORE any implementation:
   - TypeScript work use dev-ts
   - C++ work use dev-cpp

## PHASE 1: SPEC COMPREHENSION (No Code Yet)

6. Read ALL files in 'Required Reading' section
7. Read the W3C WebCodecs spec sections referenced in the task
8. Create .claude/scratch/TASK_ID-spec-analysis.md with:

   ```markdown
   # Spec Analysis: TASK_ID

   ## Algorithms to Implement

   ### [Method/Constructor Name]
   **Spec Section:** [X.X.X]
   **Algorithm Steps:**
   1. [Step from spec]
   2. [Step from spec]
   ...

   **Error Conditions (spec-mandated):**
   - [Condition] → [Error Type]: "[Message from spec]"

   **Edge Cases (from spec):**
   - [Edge case and expected behavior]

   ## Inputs NOT in Test Requirements (Must Still Work)
   - [Input variation not explicitly tested]
   ```

9. Do NOT proceed until spec analysis is complete

## PHASE 2: TEST-FIRST DEVELOPMENT

10. For EACH algorithm in spec analysis:
   a. Write test that verifies EACH algorithm step
   b. Test MUST check behavior, not just return type
   c. Include comment: // Spec X.X.X step N
   d. Run test → Confirm RED (fails)

11. For EACH error condition in spec analysis:
    a. Write test that triggers the exact condition
    b. Assert error TYPE matches spec (TypeError, RangeError, DOMException)
    c. Assert error MESSAGE matches spec wording
    d. Run test → Confirm RED

12. For EACH edge case in spec analysis:
    a. Write test derived from spec behavior
    b. Run test → Confirm RED

13. Commit tests: git add -A && git commit -m "test(webcodecs): TASK_ID - spec compliance tests"

## PHASE 3: IMPLEMENTATION

14. Implement to pass tests (GREEN):
    - Follow spec algorithm STEP BY STEP
    - Add inline comments mapping to spec:
      ```typescript
      // Spec 9.2.4 step 3: If planeIndex >= number of planes, throw RangeError
      if (options.planeIndex >= this.numberOfPlanes) {
        throw new RangeError('planeIndex exceeds number of planes');
      }
      ```
    - For C++ code:
      ```cpp
      // Spec 9.2.4 step 7: Let copyElementCount be ...
      size_t copyElementCount = ComputeCopyElementCount(options);
      ```

15. Run: npm run check
16. If C++ modified:
    - npm run build:native 2>&1 | grep -i warning → Must be empty
    - Run memory stress test if available

17. Commit implementation: git add -A && git commit -m "feat(webcodecs): TASK_ID - implement [description]"

## PHASE 4: ANTI-GAMING VERIFICATION

18. Create verification checklist in .claude/scratch/TASK_ID-verification.md:

    ```markdown
    # Verification: TASK_ID

    ## Algorithm Compliance

    | Spec Step | Implementation Line | Test Case | Hardcoded? |
    |-----------|---------------------|-----------|------------|
    | 9.2.4.1   | audio-data.ts:142   | test_close_throws | NO |
    | 9.2.4.2   | audio-data.ts:145   | test_validate_plane | NO |

    ## Generalization Check

    For each test input, answer: "Would a DIFFERENT valid input also work?"

    | Test Input | Would 2x value work? | Would edge value work? |
    |------------|----------------------|------------------------|
    | sampleRate: 48000 | YES: 96000 works | YES: 8000 works |
    | channels: 2 | YES: 8 works | YES: 1 works |

    ## Error Message Compliance

    | Spec Error | Spec Message | Implementation Message | MATCH? |
    |------------|--------------|------------------------|--------|
    | RangeError | "planeIndex out of range" | "planeIndex out of range" | YES |

    ## C++ Safety (if applicable)

    - [ ] No raw new/delete (RAII only)
    - [ ] All buffer access bounds-checked
    - [ ] No warnings on build
    - [ ] Resources released in destructor
    ```

19. If ANY verification fails → Fix before proceeding

## PHASE 5: COMPLETION

20. Complete ALL checkboxes in task packet 'Completion Checklist'

21. Create handoff artifact at .claude/artifacts/TASK_ID-handoff.md:

    ```markdown
    # TASK_ID Handoff: [Title]

    ## Status: COMPLETE

    ## Spec Compliance Mapping

    | Spec Section | Requirement | File:Line | Test |
    |--------------|-------------|-----------|------|
    | 9.2.4.1 | Throw if closed | audio-data.ts:142 | copyTo_after_close |

    ## Test Coverage

    | Category | Count | All Pass? |
    |----------|-------|-----------|
    | Algorithm steps | X | YES |
    | Error conditions | X | YES |
    | Edge cases | X | YES |

    ## Untested But Verified Working

    These inputs are NOT in tests but implementation handles correctly:
    - [Input]: [Why it works per spec]

    ## Files Modified
    - [file]: [changes]

    ## Downstream Unblocked
    - [TASK_ID]: [what this enables]
    ```

22. Move: mv .claude/artifacts/TODO-TASK_ID.md docs/artifacts/done/
23. Commit: git add -A && git commit -m "feat(webcodecs): TASK_ID complete - [description]"
24. Delete scratch files: rm .claude/scratch/TASK_ID-*.md

## LOOP TERMINATION

25. Return to step 1
```

## Critical Rules

### NEVER DO
- Skip spec analysis phase
- Write implementation before tests
- Hardcode values that only satisfy test cases
- Use `any` type in TypeScript
- Use raw pointers in C++ (RAII only)
- Proceed with failing verification checklist

### ALWAYS DO
- Read dev-ts skill before TypeScript work
- Read dev-cpp skill before C++ work
- Comment spec section for non-obvious code
- Test error TYPE and MESSAGE, not just "throws"
- Verify implementation works for inputs NOT in tests
- Check C++ for warnings before completing
- Create full handoff with spec mapping
