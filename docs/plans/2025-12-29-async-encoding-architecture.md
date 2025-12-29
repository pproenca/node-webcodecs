# Async Encoding Architecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement WebCodecs-compliant async encoding with dedicated thread, proper queue management, copyTo() methods, and ondequeue event.

**Architecture:** Following Chromium's VideoEncoder implementation pattern:
- Dedicated encoding thread per encoder instance
- Unbounded queue with backpressure via encodeQueueSize
- encodeQueueSize decrements when processing STARTS (not when complete)
- Multiple pending flush promises (reset rejects all)
- Dequeue event coalescing with scheduled flag

**Tech Stack:** Node-API (NAPI), FFmpeg, std::thread, ThreadSafeFunction, std::atomic

---

## Current State Analysis

| Feature | Status | Notes |
|---------|--------|-------|
| reset() | Done | Returns to unconfigured state |
| isConfigSupported() | Done | Static async method |
| copyTo() | Missing | For EncodedVideoChunk and VideoFrame |
| ondequeue event | Missing | Needs event coalescing |
| Async encoding | Missing | Currently synchronous |

---

### Task 1: Add copyTo() to EncodedVideoChunk

**Files:**
- Modify: `lib/index.ts:106-122`

**Step 1: Add copyTo method to EncodedVideoChunk class**

```typescript
copyTo(destination: ArrayBuffer | Uint8Array): void {
    if (destination instanceof ArrayBuffer) {
        const view = new Uint8Array(destination);
        if (view.byteLength < this.data.length) {
            throw new TypeError('Destination buffer too small');
        }
        view.set(this.data);
    } else if (destination instanceof Uint8Array) {
        if (destination.byteLength < this.data.length) {
            throw new TypeError('Destination buffer too small');
        }
        destination.set(this.data);
    } else {
        throw new TypeError('Destination must be ArrayBuffer or Uint8Array');
    }
}
```

**Step 2: Run TypeScript build**

Run: `npm run build:ts`
Expected: Successful compilation

**Step 3: Test manually**

```javascript
const chunk = new EncodedVideoChunk({ type: 'key', timestamp: 0, data: Buffer.from([1,2,3]) });
const dest = new Uint8Array(10);
chunk.copyTo(dest);
console.log(dest.slice(0, 3)); // [1, 2, 3]
```

**Step 4: Commit**

```bash
git add lib/index.ts
git commit -m "feat: add copyTo() method to EncodedVideoChunk"
```

---

### Task 2: Add copyTo() to VideoFrame (TypeScript wrapper)

**Files:**
- Modify: `lib/index.ts:11-46`
- Modify: `lib/types.ts`

**Step 1: Add PlaneLayout type to types.ts**

```typescript
export interface PlaneLayout {
    offset: number;
    stride: number;
}

export interface VideoFrameCopyToOptions {
    rect?: { x: number; y: number; width: number; height: number };
    layout?: PlaneLayout[];
}
```

**Step 2: Add copyTo method to VideoFrame class**

```typescript
async copyTo(destination: ArrayBuffer | Uint8Array, options?: VideoFrameCopyToOptions): Promise<PlaneLayout[]> {
    if (this._closed) {
        throw new DOMException('VideoFrame is closed', 'InvalidStateError');
    }

    // For RGBA format, single plane
    const bytesPerRow = this.codedWidth * 4;
    const totalBytes = bytesPerRow * this.codedHeight;

    if (destination instanceof ArrayBuffer) {
        if (destination.byteLength < totalBytes) {
            throw new TypeError('Destination buffer too small');
        }
        const view = new Uint8Array(destination);
        const data = this._native.getData();
        view.set(data);
    } else if (destination instanceof Uint8Array) {
        if (destination.byteLength < totalBytes) {
            throw new TypeError('Destination buffer too small');
        }
        const data = this._native.getData();
        destination.set(data);
    }

    return [{ offset: 0, stride: bytesPerRow }];
}

allocationSize(options?: VideoFrameCopyToOptions): number {
    if (this._closed) {
        throw new DOMException('VideoFrame is closed', 'InvalidStateError');
    }
    return this.codedWidth * this.codedHeight * 4; // RGBA
}
```

**Step 3: Add getData() to native VideoFrame**

Modify `src/video_frame.cpp` to expose data buffer.

**Step 4: Rebuild**

Run: `npm run build`
Expected: Successful compilation

**Step 5: Commit**

```bash
git add lib/index.ts lib/types.ts src/video_frame.cpp src/video_frame.h
git commit -m "feat: add copyTo() and allocationSize() to VideoFrame"
```

---

### Task 3: Add getData() to native VideoFrame

**Files:**
- Modify: `src/video_frame.h`
- Modify: `src/video_frame.cpp`

**Step 1: Add GetData accessor to header**

In `video_frame.h`, add to private section:
```cpp
Napi::Value GetData(const Napi::CallbackInfo& info);
```

**Step 2: Implement GetData in cpp**

```cpp
Napi::Value VideoFrame::GetData(const Napi::CallbackInfo& info) {
    if (closed_) {
        throw Napi::Error::New(info.Env(), "VideoFrame is closed");
    }
    return Napi::Buffer<uint8_t>::Copy(info.Env(), data_.data(), data_.size());
}
```

**Step 3: Register in Init**

Add to DefineClass:
```cpp
InstanceMethod("getData", &VideoFrame::GetData),
```

**Step 4: Rebuild native**

Run: `npm run build:native`
Expected: Successful compilation

**Step 5: Commit**

```bash
git add src/video_frame.h src/video_frame.cpp
git commit -m "feat: expose getData() method on native VideoFrame"
```

---

### Task 4: Add ondequeue Event Infrastructure

**Files:**
- Modify: `lib/index.ts:48-104`
- Modify: `lib/types.ts`

**Step 1: Add ondequeue to VideoEncoderInit type**

In `lib/types.ts`:
```typescript
export interface VideoEncoderInit {
    output: (chunk: EncodedVideoChunk, metadata?: EncodedVideoChunkMetadata) => void;
    error: (error: Error) => void;
}
```

**Step 2: Add ondequeue property to VideoEncoder class**

```typescript
export class VideoEncoder {
    private _native: any;
    private _ondequeue: (() => void) | null = null;

    get ondequeue(): (() => void) | null {
        return this._ondequeue;
    }

    set ondequeue(handler: (() => void) | null) {
        this._ondequeue = handler;
        // Native layer will call _triggerDequeue when queue decreases
    }

    // Called from native when encodeQueueSize decreases
    private _triggerDequeue(): void {
        if (this._ondequeue) {
            // Use queueMicrotask for proper event loop integration
            queueMicrotask(() => {
                if (this._ondequeue) {
                    this._ondequeue();
                }
            });
        }
    }
}
```

**Step 3: Rebuild TypeScript**

Run: `npm run build:ts`
Expected: Successful compilation

**Step 4: Commit**

```bash
git add lib/index.ts lib/types.ts
git commit -m "feat: add ondequeue event property to VideoEncoder"
```

---

### Task 5: Add Threading Infrastructure to C++

**Files:**
- Modify: `src/video_encoder.h`

**Step 1: Add thread-safe includes and members**

```cpp
#include <thread>
#include <mutex>
#include <condition_variable>
#include <queue>
#include <atomic>
#include <functional>

// In class private section:
// Threading
std::thread encoderThread_;
std::mutex queueMutex_;
std::condition_variable queueCondition_;
std::atomic<bool> threadRunning_{false};

// Queue management
struct EncodeRequest {
    std::vector<uint8_t> frameData;
    int width;
    int height;
    int64_t timestamp;
    bool forceKeyFrame;
};
std::queue<EncodeRequest> encodeQueue_;

// Thread-safe callbacks
Napi::ThreadSafeFunction outputTsfn_;
Napi::ThreadSafeFunction dequeueTsfn_;

// Dequeue event coalescing
std::atomic<bool> dequeueEventScheduled_{false};

// Flush promise tracking
std::vector<std::pair<uint32_t, Napi::Promise::Deferred>> pendingFlushPromises_;
std::atomic<uint32_t> resetCount_{0};
```

**Step 2: Commit header changes**

```bash
git add src/video_encoder.h
git commit -m "feat: add threading infrastructure to VideoEncoder header"
```

---

### Task 6: Implement Async Encoding Thread

**Files:**
- Modify: `src/video_encoder.cpp`

**Step 1: Add EncoderThreadFunc implementation**

```cpp
void VideoEncoder::EncoderThreadFunc() {
    while (threadRunning_.load()) {
        EncodeRequest request;

        {
            std::unique_lock<std::mutex> lock(queueMutex_);
            queueCondition_.wait(lock, [this] {
                return !encodeQueue_.empty() || !threadRunning_.load();
            });

            if (!threadRunning_.load() && encodeQueue_.empty()) {
                break;
            }

            request = std::move(encodeQueue_.front());
            encodeQueue_.pop();

            // Decrement queue size when processing STARTS (per W3C spec)
            encodeQueueSize_.fetch_sub(1);
        }

        // Schedule dequeue event (with coalescing)
        ScheduleDequeueEvent();

        // Perform encoding
        EncodeFrame(request);
    }
}
```

**Step 2: Add ScheduleDequeueEvent with coalescing**

```cpp
void VideoEncoder::ScheduleDequeueEvent() {
    bool expected = false;
    if (dequeueEventScheduled_.compare_exchange_strong(expected, true)) {
        dequeueTsfn_.NonBlockingCall([](Napi::Env env, Napi::Function callback) {
            callback.Call({});
        });
    }
}
```

**Step 3: Update Encode to queue work**

```cpp
Napi::Value VideoEncoder::Encode(const Napi::CallbackInfo& info) {
    // ... validation ...

    EncodeRequest request;
    request.frameData = std::vector<uint8_t>(data, data + size);
    request.width = videoFrame->GetWidth();
    request.height = videoFrame->GetHeight();
    request.timestamp = videoFrame->GetTimestamp();
    request.forceKeyFrame = forceKeyFrame;

    {
        std::lock_guard<std::mutex> lock(queueMutex_);
        encodeQueue_.push(std::move(request));
        encodeQueueSize_.fetch_add(1);
    }
    queueCondition_.notify_one();

    return env.Undefined();
}
```

**Step 4: Rebuild native**

Run: `npm run build:native`
Expected: Successful compilation

**Step 5: Commit**

```bash
git add src/video_encoder.cpp
git commit -m "feat: implement async encoding thread with queue management"
```

---

### Task 7: Implement Proper Flush with Promise

**Files:**
- Modify: `src/video_encoder.cpp`

**Step 1: Update Flush to return proper Promise**

```cpp
Napi::Value VideoEncoder::Flush(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (state_ != "configured") {
        Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
        deferred.Resolve(env.Undefined());
        return deferred.Promise();
    }

    Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
    uint32_t currentResetCount = resetCount_.load();

    {
        std::lock_guard<std::mutex> lock(queueMutex_);
        pendingFlushPromises_.push_back({currentResetCount, deferred});
    }

    // Queue a flush sentinel
    FlushRequest request;
    request.resetCount = currentResetCount;
    {
        std::lock_guard<std::mutex> lock(queueMutex_);
        flushQueue_.push(std::move(request));
    }
    queueCondition_.notify_one();

    return deferred.Promise();
}
```

**Step 2: Handle flush completion in thread**

The encoder thread checks for flush sentinels and resolves the corresponding promises.

**Step 3: Rebuild and test**

Run: `npm run build && npm test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/video_encoder.cpp
git commit -m "feat: implement proper flush() with Promise resolution"
```

---

### Task 8: Implement Reset with Promise Rejection

**Files:**
- Modify: `src/video_encoder.cpp`

**Step 1: Update Reset to reject all pending flush promises**

```cpp
Napi::Value VideoEncoder::Reset(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (state_ == "closed") {
        throw Napi::Error::New(env, "InvalidStateError: Cannot reset a closed encoder");
    }

    // Increment reset count to invalidate stale callbacks
    resetCount_.fetch_add(1);

    // Clear the queue
    {
        std::lock_guard<std::mutex> lock(queueMutex_);
        while (!encodeQueue_.empty()) {
            encodeQueue_.pop();
        }
        encodeQueueSize_.store(0);

        // Reject all pending flush promises
        for (auto& pair : pendingFlushPromises_) {
            pair.second.Reject(
                Napi::Error::New(env, "AbortError: Encoder was reset").Value()
            );
        }
        pendingFlushPromises_.clear();
    }

    // ... rest of cleanup ...
    state_ = "unconfigured";
    return env.Undefined();
}
```

**Step 2: Update Close to call Reset first**

```cpp
void VideoEncoder::Close(const Napi::CallbackInfo& info) {
    if (state_ != "closed") {
        Reset(info);  // Reset first per W3C spec
    }
    Cleanup();
    state_ = "closed";
}
```

**Step 3: Rebuild and test**

Run: `npm run build && npm test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/video_encoder.cpp
git commit -m "feat: reset() rejects pending flush promises per W3C spec"
```

---

### Task 9: Add Integration Tests

**Files:**
- Create: `test/10_ondequeue.js`
- Create: `test/11_copyto.js`
- Modify: `test/suite.js`

**Step 1: Create ondequeue test**

```javascript
const { VideoEncoder, VideoFrame } = require('../dist');

console.log('[TEST] Starting ondequeue Event Test...');

let dequeueCount = 0;
const encoder = new VideoEncoder({
    output: () => {},
    error: console.error
});

encoder.ondequeue = () => {
    dequeueCount++;
};

encoder.configure({ codec: 'avc1.42001E', width: 100, height: 100 });

const buf = Buffer.alloc(100 * 100 * 4);
for (let i = 0; i < 10; i++) {
    const frame = new VideoFrame(buf, { codedWidth: 100, codedHeight: 100, timestamp: i * 33000 });
    encoder.encode(frame);
    frame.close();
}

encoder.flush().then(() => {
    console.log(`[INFO] Dequeue events received: ${dequeueCount}`);
    if (dequeueCount >= 1) {
        console.log('[PASS] ondequeue events fired.');
    } else {
        console.error('[FAIL] No dequeue events received.');
        process.exit(1);
    }
});
```

**Step 2: Create copyTo test**

```javascript
const { VideoFrame, EncodedVideoChunk } = require('../dist');

console.log('[TEST] Starting copyTo Test...');

// Test EncodedVideoChunk.copyTo
const chunkData = Buffer.from([1, 2, 3, 4, 5]);
const chunk = new EncodedVideoChunk({ type: 'key', timestamp: 0, data: chunkData });

const dest1 = new Uint8Array(10);
chunk.copyTo(dest1);
if (dest1[0] === 1 && dest1[4] === 5) {
    console.log('[PASS] EncodedVideoChunk.copyTo works.');
} else {
    console.error('[FAIL] EncodedVideoChunk.copyTo failed.');
    process.exit(1);
}

// Test VideoFrame.copyTo
const width = 10;
const height = 10;
const frameBuf = Buffer.alloc(width * height * 4, 0xAB);
const frame = new VideoFrame(frameBuf, { codedWidth: width, codedHeight: height, timestamp: 0 });

const dest2 = new Uint8Array(width * height * 4);
frame.copyTo(dest2).then((layout) => {
    if (dest2[0] === 0xAB && layout[0].stride === width * 4) {
        console.log('[PASS] VideoFrame.copyTo works.');
    } else {
        console.error('[FAIL] VideoFrame.copyTo failed.');
        process.exit(1);
    }
    frame.close();
});
```

**Step 3: Update suite.js**

Add to tests array:
```javascript
'10_ondequeue.js',
'11_copyto.js'
```

**Step 4: Run tests**

Run: `npm test`
Expected: All 11 tests pass

**Step 5: Commit**

```bash
git add test/10_ondequeue.js test/11_copyto.js test/suite.js
git commit -m "test: add ondequeue and copyTo integration tests"
```

---

## Execution Order Summary

| Task | Description | Dependencies |
|------|-------------|--------------|
| 1 | EncodedVideoChunk.copyTo() | None |
| 2 | VideoFrame.copyTo() TypeScript | Task 3 |
| 3 | Native VideoFrame.getData() | None |
| 4 | ondequeue event infrastructure | None |
| 5 | Threading header changes | None |
| 6 | Async encoding thread | Task 5 |
| 7 | Proper flush with Promise | Task 6 |
| 8 | Reset with promise rejection | Task 7 |
| 9 | Integration tests | Tasks 1-8 |

Tasks 1, 3, 4, 5 can be parallelized. Tasks 6-9 are sequential.
