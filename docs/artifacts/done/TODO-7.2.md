# Task Packet: TODO-7.2

> **Feature:** WebCodecs Spec Compliance - Clone Configuration Algorithm
> **Assigned to:** Subagent 7.2
> **Priority:** 2
> **Estimated complexity:** LOW

## Objective
Verify that the Clone Configuration algorithm correctly creates deep copies of codec configs per W3C spec section 7.2.

## Scope

### Files In Scope
- `lib/types.ts` - Type definitions
- `lib/*.ts` - Codec implementations that clone configs
- `test/unit/config-clone.test.ts` - Clone tests (create if needed)

### Files Out of Scope (DO NOT MODIFY)
- `src/*.cc` - Native implementations

## Interface Contract

### Inputs You Will Receive
```typescript
// From W3C spec section 7.2:
// Clone Configuration algorithm:
// 1. Create new dictionary
// 2. Copy all recognized members
// 3. Deep copy BufferSource fields (description)
// 4. Return clone
```

### Outputs You Must Provide
```typescript
// Utility function or inline logic:
function cloneConfig<T>(config: T): T;

// Must handle:
// - Primitive fields (codec, width, height, etc.)
// - BufferSource fields (description) - deep copied
// - Optional fields (preserved if present)
```

## Constraints

### DO
- Follow TDD: Write failing tests first
- Deep copy ArrayBuffer/BufferSource fields
- Preserve all recognized dictionary members
- Ignore unrecognized members

### DO NOT
- Share ArrayBuffer references between original and clone
- Mutate original config

## Success Criteria
- [ ] All tests pass
- [ ] Primitive fields copied
- [ ] ArrayBuffer fields deep copied (independent memory)
- [ ] Unrecognized fields ignored
- [ ] Original config unchanged
- [ ] Artifact handoff document created

## Context Files

### Required Reading
- `docs/specs/7-configurations/7.2-clone-configuration-with-config.md` - Algorithm spec
- `lib/types.ts` - Config type definitions

### Reference Only (Don't modify)
- Structured clone algorithm reference

## Dependencies

### Waits For (Upstream)
- None

### Blocks (Downstream)
- TODO-7.1: isConfigSupported returns cloned config

### Can Run In Parallel With
- TODO-7.1

## Test Requirements

### Unit Tests Required
1. Primitive fields cloned correctly
2. ArrayBuffer description is deep copied
3. Modifying clone doesn't affect original
4. Modifying original doesn't affect clone
5. Unrecognized fields not included in clone

### Edge Cases to Test
1. Config with no optional fields
2. Config with empty description
3. Config with large description buffer

### Error Cases to Test
1. null config → TypeError
2. undefined config → TypeError

## Completion Checklist
- [ ] Tests written (RED)
- [ ] Tests fail as expected
- [ ] Implementation complete (GREEN)
- [ ] All tests pass
- [ ] Refactored if needed (BLUE)
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Artifact handoff created at `.claude/artifacts/TODO-7.2.md`

## On Completion
1. Write artifact to `.claude/artifacts/TODO-7.2.md`
2. Signal completion to orchestrator
3. DO NOT proceed to other tasks
