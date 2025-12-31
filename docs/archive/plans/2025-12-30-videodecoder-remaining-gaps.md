# VideoDecoder W3C WebCodecs Compliance - Remaining Gaps

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-12-30-videodecoder-remaining-gaps.md` to implement task-by-task.

**Goal:** Close remaining W3C WebCodecs VideoDecoder compliance gaps identified after comprehensive audit.

**Architecture:** TypeScript layer (`lib/types.ts`, `lib/index.ts`) and C++ native layer (`src/video_decoder.cc`).

**Tech Stack:** TypeScript, C++17, node-addon-api (NAPI), FFmpeg, Vitest

---

## Compliance Status Summary

Based on analysis of [W3C WebCodecs Specification](https://www.w3.org/TR/webcodecs/#videodecoder-interface):

### Already Compliant (58/60 tests pass)

| Feature | Status |
|---------|--------|
| Constructor with VideoDecoderInit | COMPLIANT |
| state attribute | COMPLIANT |
| decodeQueueSize attribute | COMPLIANT |
| ondequeue EventHandler | COMPLIANT |
| configure() method | COMPLIANT |
| decode() method | COMPLIANT |
| flush() method | COMPLIANT |
| reset() method | COMPLIANT |
| close() method | COMPLIANT |
| isConfigSupported() static | COMPLIANT |
| EventTarget inheritance | COMPLIANT |
| CodecState enum | COMPLIANT |
| codedWidth/codedHeight (optional) | COMPLIANT |
| displayAspectWidth/displayAspectHeight | COMPLIANT |
| colorSpace config | COMPLIANT |
| optimizeForLatency | COMPLIANT |
| rotation/flip (non-standard documented) | COMPLIANT |
| Error handling (InvalidStateError, DataError) | COMPLIANT |
| Key frame requirement | COMPLIANT |

### Remaining Gaps

| Gap | Description | Severity |
|-----|-------------|----------|
| **HardwareAcceleration enum** | Uses old values `'allow' \| 'deny' \| 'prefer'` instead of W3C spec `'no-preference' \| 'prefer-hardware' \| 'prefer-software'` | HIGH |
| **isConfigSupported displayAspectWidth/Height** | Not echoed in returned config | MEDIUM |
| **isConfigSupported colorSpace** | Not echoed in returned config | MEDIUM |

---

## Implementation Tasks

### Task 1: Fix HardwareAcceleration enum values to match W3C spec

**Files:**
- Modify: `lib/types.ts:38-43`
- Modify: `src/video_decoder.cc:275,543-549`
- Modify: `test/golden/video-decoder.test.ts:596`

Per [W3C WebCodecs spec](https://www.w3.org/TR/webcodecs/) and [Chrome 94 changes](https://groups.google.com/a/chromium.org/g/blink-dev/c/6knQoJRpje4), the HardwareAcceleration enum values are:
- `"no-preference"` (default)
- `"prefer-hardware"`
- `"prefer-software"`

**Step 1: Write the failing test** (2-5 min)

Update test in `test/golden/video-decoder.test.ts` around line 595:

```typescript
it('should echo hardwareAcceleration W3C enum values', async () => {
  const values: Array<'no-preference' | 'prefer-hardware' | 'prefer-software'> = [
    'no-preference',
    'prefer-hardware',
    'prefer-software'
  ];
  for (const hw of values) {
    const result = await VideoDecoder.isConfigSupported({
      codec: 'avc1.42001e',
      hardwareAcceleration: hw,
    });
    expect(result.config.hardwareAcceleration).toBe(hw);
  }
});

it('should reject invalid hardwareAcceleration values', async () => {
  const decoder = new VideoDecoder({
    output: () => {},
    error: () => {},
  });

  expect(() => {
    decoder.configure({
      codec: 'avc1.42001e',
      hardwareAcceleration: 'invalid-value' as any,
    });
  }).toThrow(TypeError);

  decoder.close();
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run --config test/vitest.config.ts test/golden/video-decoder.test.ts -t "hardwareAcceleration"
```

Expected: FAIL (old enum values used, no validation)

**Step 3: Update TypeScript types** (2-5 min)

In `lib/types.ts:38-43`, change:

```typescript
/**
 * WebIDL:
 * enum HardwareAcceleration { "no-preference", "prefer-hardware", "prefer-software" };
 */
export type HardwareAcceleration = 'no-preference' | 'prefer-hardware' | 'prefer-software';
```

**Step 4: Update C++ validation** (2-5 min)

In `src/video_decoder.cc:273-280`, add validation:

```cpp
// Parse optional hardwareAcceleration (per W3C spec).
// Note: This is a stub - FFmpeg uses software decoding.
hardware_acceleration_ = "no-preference";
if (config.Has("hardwareAcceleration") &&
    config.Get("hardwareAcceleration").IsString()) {
  std::string hw = config.Get("hardwareAcceleration").As<Napi::String>().Utf8Value();
  if (hw != "no-preference" && hw != "prefer-hardware" && hw != "prefer-software") {
    Napi::TypeError err = Napi::TypeError::New(env,
        "hardwareAcceleration must be 'no-preference', 'prefer-hardware', or 'prefer-software'");
    throw err;
  }
  hardware_acceleration_ = hw;
}
```

**Step 5: Update isConfigSupported validation** (2-5 min)

In `src/video_decoder.cc:542-550`, update:

```cpp
// Handle hardwareAcceleration with default value per W3C spec.
if (config.Has("hardwareAcceleration") &&
    config.Get("hardwareAcceleration").IsString()) {
  std::string hw = config.Get("hardwareAcceleration").As<Napi::String>().Utf8Value();
  // Validate W3C enum values
  if (hw != "no-preference" && hw != "prefer-hardware" && hw != "prefer-software") {
    supported = false;
  }
  normalized_config.Set("hardwareAcceleration", hw);
} else {
  // Default to "no-preference" per W3C spec.
  normalized_config.Set("hardwareAcceleration", "no-preference");
}
```

**Step 6: Update tests using old values** (2-5 min)

In `test/golden/video-decoder.test.ts`, update any tests using old values:
- Line 334: Change `'prefer-software'` (already correct)
- Line 345: Change `'prefer-hardware'` (already correct)
- Line 546: Change `'prefer' as const` to `'prefer-hardware' as const`
- Line 596: Change test to use W3C values

**Step 7: Run test to verify it passes** (30 sec)

```bash
npx vitest run --config test/vitest.config.ts test/golden/video-decoder.test.ts -t "hardwareAcceleration"
```

Expected: PASS

**Step 8: Commit** (30 sec)

```bash
git add lib/types.ts src/video_decoder.cc test/golden/video-decoder.test.ts
git commit -m "fix(HardwareAcceleration): use W3C spec enum values

BREAKING CHANGE: HardwareAcceleration enum values changed from
'allow'|'deny'|'prefer' to 'no-preference'|'prefer-hardware'|'prefer-software'
per W3C WebCodecs specification."
```

---

### Task 2: Echo displayAspectWidth/displayAspectHeight in isConfigSupported

**Files:**
- Modify: `src/video_decoder.cc:516-536`
- Modify: `test/golden/video-decoder.test.ts:576`

**Step 1: Write the failing test** (2-5 min)

In `test/golden/video-decoder.test.ts`, replace the todo test around line 576:

```typescript
it('should echo displayAspectWidth and displayAspectHeight', async () => {
  const result = await VideoDecoder.isConfigSupported({
    codec: 'avc1.42001e',
    codedWidth: 1920,
    codedHeight: 1080,
    displayAspectWidth: 16,
    displayAspectHeight: 9,
  });

  expect(result.supported).toBe(true);
  expect(result.config.displayAspectWidth).toBe(16);
  expect(result.config.displayAspectHeight).toBe(9);
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run --config test/vitest.config.ts test/golden/video-decoder.test.ts -t "displayAspectWidth"
```

Expected: FAIL (properties not echoed)

**Step 3: Update isConfigSupported in C++** (2-5 min)

In `src/video_decoder.cc`, around line 536 (after codedHeight handling), add:

```cpp
// Copy displayAspectWidth if present.
if (config.Has("displayAspectWidth") && config.Get("displayAspectWidth").IsNumber()) {
  int display_aspect_width = config.Get("displayAspectWidth").As<Napi::Number>().Int32Value();
  if (display_aspect_width > 0) {
    normalized_config.Set("displayAspectWidth", display_aspect_width);
  }
}

// Copy displayAspectHeight if present.
if (config.Has("displayAspectHeight") && config.Get("displayAspectHeight").IsNumber()) {
  int display_aspect_height = config.Get("displayAspectHeight").As<Napi::Number>().Int32Value();
  if (display_aspect_height > 0) {
    normalized_config.Set("displayAspectHeight", display_aspect_height);
  }
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run --config test/vitest.config.ts test/golden/video-decoder.test.ts -t "displayAspectWidth"
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add src/video_decoder.cc test/golden/video-decoder.test.ts
git commit -m "feat(VideoDecoder): echo displayAspectWidth/Height in isConfigSupported"
```

---

### Task 3: Echo colorSpace in isConfigSupported

**Files:**
- Modify: `src/video_decoder.cc:537-557`
- Modify: `test/golden/video-decoder.test.ts:579`

**Step 1: Write the failing test** (2-5 min)

In `test/golden/video-decoder.test.ts`, replace the todo test around line 579:

```typescript
it('should echo colorSpace configuration', async () => {
  const colorSpace = {
    primaries: 'bt709' as const,
    transfer: 'bt709' as const,
    matrix: 'bt709' as const,
    fullRange: false,
  };

  const result = await VideoDecoder.isConfigSupported({
    codec: 'avc1.42001e',
    colorSpace,
  });

  expect(result.supported).toBe(true);
  expect(result.config.colorSpace).toBeDefined();
  expect(result.config.colorSpace?.primaries).toBe('bt709');
  expect(result.config.colorSpace?.transfer).toBe('bt709');
  expect(result.config.colorSpace?.matrix).toBe('bt709');
  expect(result.config.colorSpace?.fullRange).toBe(false);
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run --config test/vitest.config.ts test/golden/video-decoder.test.ts -t "colorSpace configuration"
```

Expected: FAIL (colorSpace not echoed)

**Step 3: Update isConfigSupported in C++** (2-5 min)

In `src/video_decoder.cc`, after displayAspectHeight handling, add:

```cpp
// Copy colorSpace if present.
if (config.Has("colorSpace") && config.Get("colorSpace").IsObject()) {
  Napi::Object cs = config.Get("colorSpace").As<Napi::Object>();
  Napi::Object normalized_cs = Napi::Object::New(env);

  if (cs.Has("primaries") && !cs.Get("primaries").IsNull()) {
    normalized_cs.Set("primaries", cs.Get("primaries"));
  }
  if (cs.Has("transfer") && !cs.Get("transfer").IsNull()) {
    normalized_cs.Set("transfer", cs.Get("transfer"));
  }
  if (cs.Has("matrix") && !cs.Get("matrix").IsNull()) {
    normalized_cs.Set("matrix", cs.Get("matrix"));
  }
  if (cs.Has("fullRange") && !cs.Get("fullRange").IsNull()) {
    normalized_cs.Set("fullRange", cs.Get("fullRange"));
  }

  normalized_config.Set("colorSpace", normalized_cs);
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
npx vitest run --config test/vitest.config.ts test/golden/video-decoder.test.ts -t "colorSpace configuration"
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add src/video_decoder.cc test/golden/video-decoder.test.ts
git commit -m "feat(VideoDecoder): echo colorSpace in isConfigSupported"
```

---

### Task 4: Code Review

**Files:** All modified files from Tasks 1-3

**Step 1: Run full test suite** (1-2 min)

```bash
npm test
```

Expected: All VideoDecoder tests PASS, 60/60 (0 todo)

**Step 2: Run linting** (30 sec)

```bash
npm run lint
```

Expected: No lint errors

**Step 3: Review W3C compliance checklist** (2-5 min)

Verify all items complete:
- [ ] HardwareAcceleration uses W3C enum values
- [ ] isConfigSupported echoes all config properties
- [ ] All 60 VideoDecoder tests pass
- [ ] No remaining todo tests

**Step 4: Final commit if cleanup needed** (30 sec)

```bash
git add -A
git commit -m "chore: final cleanup for VideoDecoder W3C compliance"
```

---

## Parallel Task Groups

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1, 2, 3 | All modify video_decoder.cc isConfigSupported - can be done in parallel carefully, but better serial for conflict avoidance |
| Group 2 | 4 | Code review after all tasks complete |

---

## Summary

After completing these 4 tasks, the VideoDecoder will have **full W3C WebCodecs compliance**:

1. **HardwareAcceleration** - Corrected to use W3C spec enum values (BREAKING CHANGE)
2. **displayAspectWidth/displayAspectHeight** - Now echoed in isConfigSupported
3. **colorSpace** - Now echoed in isConfigSupported
4. **All tests** - 60/60 passing, 0 todo

Sources:
- [W3C WebCodecs Specification](https://www.w3.org/TR/webcodecs/)
- [MDN VideoDecoder.configure()](https://developer.mozilla.org/en-US/docs/Web/API/VideoDecoder/configure)
- [Chrome 94 HardwareAcceleration changes](https://groups.google.com/a/chromium.org/g/blink-dev/c/6knQoJRpje4)
