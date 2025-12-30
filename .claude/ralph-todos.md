# WebCodecs Full Implementation Loop

  ## Your Mission
  Implement ALL unchecked items in TODO.md using strict TDD methodology.

  ## On Each Iteration

  ### 1. Check Progress
  - Read TODO.md
  - Find the FIRST unchecked [ ] item
  - If ALL items are [x] checked, output <promise>WEBCODECS COMPLETE</promise>

  ### 2. TDD Cycle for Current Item
  RED:    Write failing test in test/XX_.js
  RUN:    node test/XX_.js (confirm failure)
  GREEN:  Implement minimum code to pass
  RUN:    node test/XX_.js (confirm pass)
  REFACTOR: Clean up if needed, keep tests green

  ### 3. Update Progress
  - Edit TODO.md: change [ ] to [x] for completed item
  - Commit: git add -A && git commit -m 'feat(<scope>): <item description>'

  ### 4. Continue
  - Move to next unchecked item
  - Repeat until interrupted or blocked

  ## File Locations
  - TypeScript: lib/index.ts
  - Native C++: src/*.cc, src/*.h
  - Tests: test/XX_*.js (numbered sequentially after existing)
  - Bindings: src/addon.cc

  ## Rules
  - ONE item per iteration
  - NEVER skip the test
  - NEVER mark [x] without passing test
  - If blocked, document why and try next item
  - Run 'npm test' periodically to ensure no regressions

  ## Completion Signal
  When TODO.md has NO unchecked [ ] items remaining:
  <promise>WEBCODECS COMPLETE</promise>