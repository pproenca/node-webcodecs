# Guardrail Tests Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement 4 automated guardrail tests to validate memory safety, event loop responsiveness, input robustness, and throughput performance of the node-webcodecs library.

**Architecture:** Create a dedicated `test/guardrails/` directory with 4 standalone test scripts. Each guardrail tests a specific reliability/performance aspect. Add a runner script and integrate with the test suite. The guardrails serve as CI gates that must pass before shipping.

**Tech Stack:** Node.js, node-webcodecs native addon, `process.memoryUsage()` for RSS tracking, `perf_hooks` for timing, `--expose-gc` for explicit GC control.

---

## Task 1: Create Guardrails Directory Structure

**Files:**
- Create: `test/guardrails/` directory
- Create: `test/guardrails/run_all.js` (runner script)

**Step 1: Create directory and runner script**

Create file `test/guardrails/run_all.js`:

```javascript
const { execSync } = require('child_process');
const path = require('path');

const guardrails = [
    { name: 'Memory Sentinel', file: 'memory_sentinel.js', args: '--expose-gc' },
    { name: 'Event Loop Watchdog', file: 'event_loop_lag.js', args: '' },
    { name: 'Input Fuzzer', file: 'fuzzer.js', args: '' },
    { name: 'Throughput Benchmark', file: 'benchmark.js', args: '' },
];

console.log('Running Guardrail Tests\n');
console.log('='.repeat(50));

let passed = 0;
let failed = 0;

for (const g of guardrails) {
    const testPath = path.join(__dirname, g.file);
    console.log(`\n>>> ${g.name}...`);
    console.log('-'.repeat(50));

    try {
        execSync(`node ${g.args} "${testPath}"`, {
            stdio: 'inherit',
            cwd: path.join(__dirname, '../..'),
            timeout: 300000
        });
        passed++;
        console.log(`<<< ${g.name}: PASSED`);
    } catch (e) {
        failed++;
        console.log(`<<< ${g.name}: FAILED`);
    }
}

console.log('\n' + '='.repeat(50));
console.log(`Guardrails: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
```

**Step 2: Verify directory exists**

Run: `ls -la test/guardrails/`
Expected: Directory exists with `run_all.js`

**Step 3: Commit**

```bash
git add test/guardrails/run_all.js
git commit -m "feat(guardrails): add guardrail test runner infrastructure"
```

---

## Task 2: Memory Sentinel Guardrail

**Files:**
- Create: `test/guardrails/memory_sentinel.js`

**Context:** This test validates that C++ memory (AVFrame, AVPacket) is properly freed. Runs 10,000 frames and asserts RSS growth stays under 50MB. Must run with `--expose-gc`.

**Step 1: Write the memory sentinel test**

Create file `test/guardrails/memory_sentinel.js`:

```javascript
const { VideoEncoder, VideoFrame } = require('../../dist');

const LIMIT_MB = 50;
const FRAMES = 10000;

async function run() {
    console.log(`Memory Leak Check (${FRAMES} frames)`);

    // Baseline
    if (global.gc) global.gc();
    const startRSS = process.memoryUsage().rss;

    const encoder = new VideoEncoder({
        output: (chunk) => {
            // Release chunk data
        },
        error: (e) => { throw e; }
    });
    encoder.configure({ codec: 'avc1.42001E', width: 640, height: 480 });

    const buf = Buffer.alloc(640 * 480 * 4);

    for (let i = 0; i < FRAMES; i++) {
        const frame = new VideoFrame(buf, {
            codedWidth: 640,
            codedHeight: 480,
            timestamp: i * 33000
        });

        encoder.encode(frame);
        frame.close();

        // Periodic GC to isolate C++ leaks from JS wrappers
        if (i % 1000 === 0 && global.gc) {
            global.gc();
            const currentMB = (process.memoryUsage().rss - startRSS) / 1024 / 1024;
            console.log(`  Frame ${i}: +${currentMB.toFixed(1)} MB`);
        }
    }

    await encoder.flush();
    if (global.gc) global.gc();

    const endRSS = process.memoryUsage().rss;
    const growthMB = (endRSS - startRSS) / 1024 / 1024;

    console.log(`Total Growth: ${growthMB.toFixed(2)} MB (Limit: ${LIMIT_MB} MB)`);

    if (growthMB > LIMIT_MB) {
        console.error(`FAILURE: Memory grew by ${growthMB.toFixed(2)}MB. Likely leaking AVFrames.`);
        process.exit(1);
    }
    console.log("SUCCESS: Memory stable.");
}

run().catch(e => {
    console.error('FAILURE:', e.message);
    process.exit(1);
});
```

**Step 2: Run test to verify it works**

Run: `node --expose-gc test/guardrails/memory_sentinel.js`
Expected: Either SUCCESS (memory stable) or FAILURE (if there's a leak to fix)

**Step 3: Commit**

```bash
git add test/guardrails/memory_sentinel.js
git commit -m "feat(guardrails): add memory sentinel test (10k frames, 50MB limit)"
```

---

## Task 3: Event Loop Watchdog Guardrail

**Files:**
- Create: `test/guardrails/event_loop_lag.js`

**Context:** Validates that encoding doesn't block the Node.js event loop. Measures timer drift while encoding 1080p frames. Warning threshold is 20ms lag (blocking would cause 30ms+ spikes).

**Step 1: Write the event loop watchdog test**

Create file `test/guardrails/event_loop_lag.js`:

```javascript
const { VideoEncoder, VideoFrame } = require('../../dist');
const { performance } = require('perf_hooks');

const MAX_LAG_MS = 20;
const FRAMES = 50;

async function run() {
    console.log('Event Loop Latency Check');

    let maxLag = 0;
    let lastTime = performance.now();

    const timer = setInterval(() => {
        const now = performance.now();
        const delta = now - lastTime;
        const lag = delta - 10; // Expected 10ms interval
        if (lag > maxLag) maxLag = lag;
        lastTime = now;
    }, 10);

    const encoder = new VideoEncoder({
        output: () => {},
        error: (e) => { throw e; }
    });
    encoder.configure({ codec: 'avc1.42001E', width: 1920, height: 1080 });

    const buf = Buffer.alloc(1920 * 1080 * 4);

    console.log(`  Encoding ${FRAMES} frames at 1080p...`);
    for (let i = 0; i < FRAMES; i++) {
        const frame = new VideoFrame(buf, {
            codedWidth: 1920,
            codedHeight: 1080,
            timestamp: i * 33000
        });
        encoder.encode(frame);
        frame.close();
    }

    await encoder.flush();
    clearInterval(timer);

    console.log(`Max Event Loop Lag: ${maxLag.toFixed(2)}ms (Limit: ${MAX_LAG_MS}ms)`);

    if (maxLag > MAX_LAG_MS) {
        console.warn(`WARNING: Encoder blocking event loop. Lag: ${maxLag.toFixed(2)}ms.`);
        console.warn('Consider moving encode to AsyncWorker.');
        // For MVP, this is a warning not a failure
    } else {
        console.log('SUCCESS: Non-blocking execution.');
    }
}

run().catch(e => {
    console.error('FAILURE:', e.message);
    process.exit(1);
});
```

**Step 2: Run test to verify it works**

Run: `node test/guardrails/event_loop_lag.js`
Expected: Reports lag measurement, may warn if blocking

**Step 3: Commit**

```bash
git add test/guardrails/event_loop_lag.js
git commit -m "feat(guardrails): add event loop watchdog (20ms lag threshold)"
```

---

## Task 4: Input Fuzzer Guardrail

**Files:**
- Create: `test/guardrails/fuzzer.js`

**Context:** Validates that malformed inputs produce JS errors, not segfaults. Tests zero buffers, tiny buffers, huge dimensions, and edge cases.

**Step 1: Write the input fuzzer test**

Create file `test/guardrails/fuzzer.js`:

```javascript
const { VideoEncoder, VideoFrame } = require('../../dist');

console.log('Input Robustness Fuzzer');

const encoder = new VideoEncoder({
    output: () => {},
    error: () => {}
});
encoder.configure({ codec: 'avc1.42001E', width: 100, height: 100 });

const vectors = [
    { name: 'Zero Buffer', buf: Buffer.alloc(0), w: 100, h: 100, ts: 0 },
    { name: 'Tiny Buffer', buf: Buffer.alloc(10), w: 100, h: 100, ts: 0 },
    { name: 'Huge Dimensions', buf: Buffer.alloc(100), w: 10000, h: 10000, ts: 0 },
    { name: 'Negative Timestamp', buf: Buffer.alloc(40000), w: 100, h: 100, ts: -1 },
    { name: 'Zero Width', buf: Buffer.alloc(400), w: 0, h: 100, ts: 0 },
    { name: 'Zero Height', buf: Buffer.alloc(400), w: 100, h: 0, ts: 0 },
    { name: 'Negative Width', buf: Buffer.alloc(400), w: -10, h: 100, ts: 0 },
];

let failed = false;
let passed = 0;

vectors.forEach(v => {
    try {
        const frame = new VideoFrame(v.buf, {
            codedWidth: v.w,
            codedHeight: v.h,
            timestamp: v.ts
        });
        encoder.encode(frame);
        frame.close();

        // If we reach here, bad data was accepted
        console.error(`  FAIL: Accepted "${v.name}" without error!`);
        failed = true;
    } catch (e) {
        console.log(`  PASS: Caught error for "${v.name}": ${e.message.slice(0, 50)}`);
        passed++;
    }
});

console.log(`\nResults: ${passed}/${vectors.length} vectors caught errors`);

if (failed) {
    console.error('FAILURE: Some malformed inputs were accepted!');
    process.exit(1);
}

// Note: If we got here without segfault, that's also a pass
console.log('SUCCESS: All malformed inputs rejected safely.');
```

**Step 2: Run test to verify it works**

Run: `node test/guardrails/fuzzer.js`
Expected: Reports which vectors caught errors (or identifies gaps in validation)

**Step 3: Commit**

```bash
git add test/guardrails/fuzzer.js
git commit -m "feat(guardrails): add input fuzzer (malformed input validation)"
```

---

## Task 5: Throughput Benchmark Guardrail

**Files:**
- Create: `test/guardrails/benchmark.js`

**Context:** Ensures encoding meets minimum performance threshold. Target is 30 FPS at 720p. Encoding slower than this is unusable for real-time video processing.

**Step 1: Write the throughput benchmark test**

Create file `test/guardrails/benchmark.js`:

```javascript
const { VideoEncoder, VideoFrame } = require('../../dist');

const TARGET_FPS = 30;
const FRAMES = 100;

async function run() {
    console.log(`Performance Benchmark (Target: ${TARGET_FPS} FPS at 720p)`);

    const encoder = new VideoEncoder({
        output: () => {},
        error: (e) => { throw e; }
    });
    encoder.configure({ codec: 'avc1.42001E', width: 1280, height: 720 });

    const buf = Buffer.alloc(1280 * 720 * 4);

    console.log(`  Encoding ${FRAMES} frames...`);
    const start = Date.now();

    for (let i = 0; i < FRAMES; i++) {
        const frame = new VideoFrame(buf, {
            codedWidth: 1280,
            codedHeight: 720,
            timestamp: i * 33000
        });
        encoder.encode(frame);
        frame.close();
    }

    await encoder.flush();
    const durationSec = (Date.now() - start) / 1000;
    const fps = FRAMES / durationSec;

    console.log(`Result: ${fps.toFixed(2)} FPS (${durationSec.toFixed(2)}s for ${FRAMES} frames)`);

    if (fps < TARGET_FPS) {
        console.error(`FAILURE: Too slow (${fps.toFixed(2)} FPS < ${TARGET_FPS} FPS target)`);
        process.exit(1);
    }
    console.log('SUCCESS: Performance target met.');
}

run().catch(e => {
    console.error('FAILURE:', e.message);
    process.exit(1);
});
```

**Step 2: Run test to verify it works**

Run: `node test/guardrails/benchmark.js`
Expected: Reports FPS, passes if >= 30 FPS

**Step 3: Commit**

```bash
git add test/guardrails/benchmark.js
git commit -m "feat(guardrails): add throughput benchmark (30 FPS @ 720p target)"
```

---

## Task 6: Add npm Script for Guardrails

**Files:**
- Modify: `package.json`

**Step 1: Add guardrails script to package.json**

Add to the "scripts" section in `package.json`:

```json
"test:guardrails": "node test/guardrails/run_all.js"
```

The scripts section should look like:
```json
"scripts": {
    "build:native": "cmake-js compile",
    "build:ts": "tsc",
    "build": "npm run build:native && npm run build:ts",
    "test": "node test/suite.js",
    "test:guardrails": "node test/guardrails/run_all.js",
    "clean": "rm -rf build dist"
}
```

**Step 2: Verify script runs**

Run: `npm run test:guardrails`
Expected: Runs all 4 guardrail tests

**Step 3: Commit**

```bash
git add package.json
git commit -m "feat(guardrails): add npm run test:guardrails script"
```

---

## Task 7: Final Verification

**Step 1: Run full test suite**

Run: `npm test`
Expected: All existing tests pass

**Step 2: Run guardrails**

Run: `npm run test:guardrails`
Expected: All guardrails pass (or identify issues to fix)

**Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(guardrails): address issues found during verification"
```

---

## Summary

| Guardrail | Validates | Success Criteria | File |
|-----------|-----------|------------------|------|
| Memory Sentinel | Memory Safety | RSS growth < 50MB over 10k frames | `memory_sentinel.js` |
| Event Loop Watchdog | Responsiveness | Lag < 20ms (warning only for MVP) | `event_loop_lag.js` |
| Input Fuzzer | Input Validation | JS Exceptions thrown, NO Segfaults | `fuzzer.js` |
| Throughput Benchmark | Speed | > 30 FPS at 720p | `benchmark.js` |

**Critical:** If Memory Sentinel or Input Fuzzer fail, do not ship. Fix C++ memory management first.
