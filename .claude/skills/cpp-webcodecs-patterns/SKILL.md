---
name: cpp-webcodecs-patterns
description: Proven C++ patterns for building WebCodecs API implementations with Node.js native addons and FFmpeg bindings. Based on Fabrice Bellard's FFmpeg architecture, Chromium's WebCodecs implementation, and Google/Meta video infrastructure patterns. Use when building video/audio codec bindings, implementing W3C WebCodecs spec server-side, managing async between Node.js and C++, or debugging memory/threading issues in native addons.
---

# C++ WebCodecs Patterns

Proven patterns from FFmpeg, Chromium, Google, and Meta video infrastructure.

## Core Architecture: The Context Pattern (Bellard/FFmpeg)

FFmpeg's fundamental design: **opaque context structs with explicit lifecycle**.

```cpp
// Pattern: All state in a single context struct
struct CodecContext {
    // Configuration (immutable after init)
    CodecConfig config;
    
    // Internal state (managed by implementation)
    void* priv_data;           // Codec-specific private data
    
    // Callbacks (set by caller)
    void (*output_callback)(void* opaque, Frame* frame);
    void* opaque;              // Caller's context for callbacks
    
    // Error state
    int error_code;
    char error_msg[256];
};

// Explicit lifecycle - no hidden allocations
CodecContext* codec_alloc();
int codec_init(CodecContext* ctx, const CodecConfig* config);
int codec_send_packet(CodecContext* ctx, const Packet* pkt);
int codec_receive_frame(CodecContext* ctx, Frame* frame);
void codec_flush(CodecContext* ctx);
void codec_free(CodecContext** ctx);  // Double pointer to null after free
```

**Why this works at scale:**
- Single allocation per codec instance
- No hidden state → deterministic debugging
- Caller controls memory → no surprise GC interactions
- Error state in struct → no exceptions crossing boundaries

## Node-addon-api Integration Patterns

### Pattern 1: Wrap Context in ObjectWrap

```cpp
class VideoDecoder : public Napi::ObjectWrap<VideoDecoder> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    VideoDecoder(const Napi::CallbackInfo& info);
    ~VideoDecoder();

private:
    // The FFmpeg-style context
    DecoderContext* ctx_ = nullptr;
    
    // prevent double-free
    bool closed_ = false;
    
    // prevent use-after-free in callbacks
    std::atomic<bool> destroyed_{false};
    
    // JS methods
    Napi::Value Configure(const Napi::CallbackInfo& info);
    Napi::Value Decode(const Napi::CallbackInfo& info);
    Napi::Value Flush(const Napi::CallbackInfo& info);
    Napi::Value Close(const Napi::CallbackInfo& info);
};
```

### Pattern 2: AsyncWorker for Blocking FFmpeg Calls

**Critical rule:** `Execute()` cannot touch N-API. Copy all data before, callback after.

```cpp
class DecodeWorker : public Napi::AsyncWorker {
public:
    DecodeWorker(Napi::Env env, DecoderContext* ctx,
                 std::vector<uint8_t> data,  // COPY the data
                 Napi::Promise::Deferred deferred)
        : Napi::AsyncWorker(env)
        , ctx_(ctx)
        , input_data_(std::move(data))
        , deferred_(deferred) {}

    void Execute() override {
        // SAFE: No N-API calls, only C++ and FFmpeg
        result_ = decode_packet(ctx_, input_data_.data(), input_data_.size());
        if (result_ < 0) {
            SetError(get_error_string(result_));
        }
    }

    void OnOK() override {
        // Back on main thread - safe to use N-API
        auto frame = create_video_frame(Env(), /* ... */);
        deferred_.Resolve(frame);
    }

    void OnError(const Napi::Error& e) override {
        deferred_.Reject(e.Value());
    }

private:
    DecoderContext* ctx_;
    std::vector<uint8_t> input_data_;
    Napi::Promise::Deferred deferred_;
    int result_;
};
```

### Pattern 3: ThreadSafeFunction for Callbacks from FFmpeg Threads

When FFmpeg calls back from its internal threads:

```cpp
class EncoderWithProgress : public Napi::ObjectWrap<EncoderWithProgress> {
private:
    Napi::ThreadSafeFunction tsfn_;
    
    void SetupProgressCallback(const Napi::CallbackInfo& info) {
        auto callback = info[0].As<Napi::Function>();
        
        tsfn_ = Napi::ThreadSafeFunction::New(
            info.Env(),
            callback,
            "EncoderProgress",
            0,                    // Unlimited queue
            1,                    // Initial thread count
            [](Napi::Env) {}      // Invoke release callback
        );
        
        // Set FFmpeg's progress callback to our static function
        ctx_->progress_callback = &EncoderWithProgress::OnProgress;
        ctx_->progress_opaque = this;
    }
    
    // Called from FFmpeg's encoding thread
    static void OnProgress(void* opaque, int percent) {
        auto self = static_cast<EncoderWithProgress*>(opaque);
        if (self->destroyed_) return;  // Guard against use-after-free
        
        // Queue callback to main thread
        auto callback = [percent](Napi::Env env, Napi::Function fn) {
            fn.Call({Napi::Number::New(env, percent)});
        };
        self->tsfn_.NonBlockingCall(callback);
    }
};
```

## Memory Management Patterns

### Pattern: Reference-Counted Frames (Chromium style)

```cpp
class VideoFrame {
public:
    static std::shared_ptr<VideoFrame> Create(int width, int height, PixelFormat fmt);
    
    // Zero-copy wrap of external buffer
    static std::shared_ptr<VideoFrame> WrapExternalBuffer(
        uint8_t* data, size_t size,
        std::function<void()> release_callback);
    
    uint8_t* data(int plane) const;
    int stride(int plane) const;
    
private:
    // prevent slicing
    VideoFrame() = default;
    
    std::vector<uint8_t> owned_data_;
    std::function<void()> release_cb_;
};
```

### Pattern: Buffer Pool (Google/Meta scale)

Avoid allocation in hot path:

```cpp
class FramePool {
public:
    explicit FramePool(size_t max_frames) : max_frames_(max_frames) {}
    
    std::shared_ptr<VideoFrame> Acquire(int width, int height, PixelFormat fmt) {
        std::lock_guard<std::mutex> lock(mutex_);
        
        // Find reusable frame
        for (auto& frame : pool_) {
            if (frame.use_count() == 1 && frame->Matches(width, height, fmt)) {
                return frame;
            }
        }
        
        // Allocate new if under limit
        if (pool_.size() < max_frames_) {
            auto frame = VideoFrame::Create(width, height, fmt);
            pool_.push_back(frame);
            return frame;
        }
        
        return nullptr;  // Pool exhausted - apply backpressure
    }
    
private:
    std::mutex mutex_;
    std::vector<std::shared_ptr<VideoFrame>> pool_;
    size_t max_frames_;
};
```

## Async Queue Pattern (Meta SVE style)

Decouple input rate from processing rate:

```cpp
template<typename T>
class BoundedQueue {
public:
    explicit BoundedQueue(size_t max_size) : max_size_(max_size) {}
    
    // Returns false if queue full (backpressure)
    bool TryPush(T item) {
        std::lock_guard<std::mutex> lock(mutex_);
        if (queue_.size() >= max_size_) return false;
        queue_.push(std::move(item));
        cv_.notify_one();
        return true;
    }
    
    // Blocking pop with timeout
    std::optional<T> Pop(std::chrono::milliseconds timeout) {
        std::unique_lock<std::mutex> lock(mutex_);
        if (!cv_.wait_for(lock, timeout, [this] { return !queue_.empty() || closed_; })) {
            return std::nullopt;
        }
        if (queue_.empty()) return std::nullopt;
        T item = std::move(queue_.front());
        queue_.pop();
        return item;
    }
    
    void Close() {
        std::lock_guard<std::mutex> lock(mutex_);
        closed_ = true;
        cv_.notify_all();
    }

private:
    std::queue<T> queue_;
    std::mutex mutex_;
    std::condition_variable cv_;
    size_t max_size_;
    bool closed_ = false;
};
```

## State Machine Pattern (Chromium WebCodecs)

WebCodecs spec requires explicit state management:

```cpp
enum class CodecState {
    Unconfigured,
    Configured,
    Closed
};

class VideoDecoderImpl {
public:
    void Configure(const VideoDecoderConfig& config) {
        if (state_ != CodecState::Unconfigured) {
            throw std::runtime_error("InvalidStateError: already configured");
        }
        // ... do configuration
        state_ = CodecState::Configured;
    }
    
    void Decode(const EncodedVideoChunk& chunk) {
        if (state_ != CodecState::Configured) {
            throw std::runtime_error("InvalidStateError: not configured");
        }
        // ... queue decode
    }
    
    void Reset() {
        if (state_ == CodecState::Closed) {
            throw std::runtime_error("InvalidStateError: closed");
        }
        FlushPendingDecodes();
        // State remains Configured
    }
    
    void Close() {
        state_ = CodecState::Closed;
        ReleaseResources();
    }

private:
    CodecState state_ = CodecState::Unconfigured;
};
```

## Error Handling Pattern

Never let FFmpeg errors propagate as exceptions across N-API boundary:

```cpp
// Wrap all FFmpeg calls
struct FFmpegResult {
    int code;
    std::string message;
    
    bool ok() const { return code >= 0; }
    
    static FFmpegResult FromAV(int averror) {
        if (averror >= 0) return {averror, ""};
        char buf[AV_ERROR_MAX_STRING_SIZE];
        av_strerror(averror, buf, sizeof(buf));
        return {averror, buf};
    }
};

// In your wrapper
Napi::Value VideoDecoder::Decode(const Napi::CallbackInfo& info) {
    auto result = FFmpegResult::FromAV(avcodec_send_packet(ctx_, pkt_));
    if (!result.ok()) {
        Napi::Error::New(info.Env(), result.message).ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }
    // ... continue
}
```

## Threading Rules Summary

| Operation | Thread | N-API Access |
|-----------|--------|--------------|
| Constructor/destructor | Main | ✓ |
| Configure/Close | Main | ✓ |
| AsyncWorker::Execute | Worker | ✗ |
| AsyncWorker::OnOK/OnError | Main | ✓ |
| FFmpeg callbacks | FFmpeg internal | ✗ |
| ThreadSafeFunction callback | Main | ✓ |

## See Also

- `references/node-addon-lifecycle.md` - Prevent segfaults in addon lifecycle
- `references/ffmpeg-threading.md` - FFmpeg thread model details
- `references/webcodecs-spec-mapping.md` - W3C spec to implementation mapping
