# FFmpeg Threading Model

## FFmpeg's Internal Threading

FFmpeg codecs use internal threading for parallel decoding. You must understand this to avoid data races.

### Thread Count Configuration

```cpp
AVCodecContext* ctx = avcodec_alloc_context3(codec);

// Option 1: Let FFmpeg decide (recommended)
ctx->thread_count = 0;  // Auto-detect based on CPU cores

// Option 2: Explicit control
ctx->thread_count = 4;

// Thread type selection
ctx->thread_type = FF_THREAD_FRAME;   // Decode multiple frames in parallel
ctx->thread_type = FF_THREAD_SLICE;   // Decode slices of one frame in parallel
ctx->thread_type = FF_THREAD_FRAME | FF_THREAD_SLICE;  // Both
```

### Thread Safety Rules

| Operation | Thread Safe? | Notes |
|-----------|--------------|-------|
| `avcodec_alloc_context3` | ✓ | Creates new context |
| `avcodec_open2` | ✗ | Must not overlap on same ctx |
| `avcodec_send_packet` | ✗ | Serialize calls per ctx |
| `avcodec_receive_frame` | ✗ | Serialize calls per ctx |
| `avcodec_free_context` | ✗ | Must not overlap with any other call |
| `av_frame_alloc` | ✓ | Thread-local allocation |
| `av_frame_free` | ✓ | Thread-local deallocation |

### Safe Pattern: One Decoder Per Thread

```cpp
// WRONG: Shared decoder across threads
class BadDecoder {
    AVCodecContext* ctx_;  // Shared!
    
    void DecodeOnThread1() { avcodec_send_packet(ctx_, pkt1); }
    void DecodeOnThread2() { avcodec_send_packet(ctx_, pkt2); }  // RACE!
};

// CORRECT: Mutex-protected access
class SafeDecoder {
    AVCodecContext* ctx_;
    std::mutex mutex_;
    
    void Decode(AVPacket* pkt) {
        std::lock_guard<std::mutex> lock(mutex_);
        avcodec_send_packet(ctx_, pkt);
        // ... receive frames ...
    }
};

// BETTER: Queue + single decoder thread (Meta/Google pattern)
class QueuedDecoder {
    AVCodecContext* ctx_;
    BoundedQueue<AVPacket*> input_queue_;
    std::thread decoder_thread_;
    
    void Start() {
        decoder_thread_ = std::thread([this] {
            while (auto pkt = input_queue_.Pop()) {
                avcodec_send_packet(ctx_, *pkt);
                // ... receive and emit frames ...
            }
        });
    }
};
```

## Frame Threading Gotchas

With `FF_THREAD_FRAME`, frames may be returned out of order:

```cpp
// Frames may not come out in PTS order!
while (avcodec_receive_frame(ctx, frame) == 0) {
    // frame->pts may be: 0, 3, 1, 4, 2, ...
    reorder_buffer_.Insert(frame);
}

// Reorder buffer pattern
class ReorderBuffer {
    std::map<int64_t, AVFrame*> frames_;  // Ordered by PTS
    int64_t next_pts_ = 0;
    
    void Insert(AVFrame* frame) {
        frames_[frame->pts] = av_frame_clone(frame);
        Flush();
    }
    
    void Flush() {
        while (frames_.count(next_pts_)) {
            EmitFrame(frames_[next_pts_]);
            frames_.erase(next_pts_);
            next_pts_++;
        }
    }
};
```

## Hardware Acceleration Threading

Hardware decoders have their own threading model:

```cpp
// Hardware decoder setup
AVBufferRef* hw_device_ctx = nullptr;
av_hwdevice_ctx_create(&hw_device_ctx, AV_HWDEVICE_TYPE_CUDA, nullptr, nullptr, 0);

ctx->hw_device_ctx = av_buffer_ref(hw_device_ctx);
ctx->get_format = [](AVCodecContext* ctx, const enum AVPixelFormat* pix_fmts) {
    // Select hardware pixel format
    for (const auto* p = pix_fmts; *p != AV_PIX_FMT_NONE; p++) {
        if (*p == AV_PIX_FMT_CUDA) return *p;
    }
    return pix_fmts[0];  // Fallback to software
};

// Hardware frames live on GPU - transfer to CPU for Node.js
AVFrame* sw_frame = av_frame_alloc();
av_hwframe_transfer_data(sw_frame, hw_frame, 0);  // GPU -> CPU copy
```

### Hardware Threading Constraints

- CUDA/NVDEC: One decoder per CUDA context, can share across threads
- VideoToolbox: Thread-safe, but one session per context
- VAAPI: Thread-safe with proper display connection handling
- QSV: Complex threading model, prefer single-threaded access

## Async FFmpeg Operations in Node-addon

### Pattern: Dedicated FFmpeg Thread Pool

```cpp
class FFmpegThreadPool {
public:
    explicit FFmpegThreadPool(size_t num_threads) {
        for (size_t i = 0; i < num_threads; i++) {
            workers_.emplace_back([this] {
                while (true) {
                    std::function<void()> task;
                    {
                        std::unique_lock<std::mutex> lock(mutex_);
                        cv_.wait(lock, [this] { return stop_ || !tasks_.empty(); });
                        if (stop_ && tasks_.empty()) return;
                        task = std::move(tasks_.front());
                        tasks_.pop();
                    }
                    task();
                }
            });
        }
    }
    
    template<typename F>
    void Enqueue(F&& task) {
        {
            std::lock_guard<std::mutex> lock(mutex_);
            tasks_.push(std::forward<F>(task));
        }
        cv_.notify_one();
    }
    
    ~FFmpegThreadPool() {
        {
            std::lock_guard<std::mutex> lock(mutex_);
            stop_ = true;
        }
        cv_.notify_all();
        for (auto& worker : workers_) worker.join();
    }

private:
    std::vector<std::thread> workers_;
    std::queue<std::function<void()>> tasks_;
    std::mutex mutex_;
    std::condition_variable cv_;
    bool stop_ = false;
};

// Global pool for FFmpeg operations
FFmpegThreadPool& GetFFmpegPool() {
    static FFmpegThreadPool pool(std::thread::hardware_concurrency());
    return pool;
}
```

### Integration with AsyncWorker

```cpp
class DecodeWorker : public Napi::AsyncWorker {
    void Execute() override {
        // This runs on libuv thread pool
        // For CPU-bound FFmpeg work, consider offloading to FFmpeg pool
        
        std::promise<int> promise;
        auto future = promise.get_future();
        
        GetFFmpegPool().Enqueue([this, &promise] {
            int result = avcodec_send_packet(ctx_, pkt_);
            promise.set_value(result);
        });
        
        result_ = future.get();  // Wait for FFmpeg pool completion
    }
};
```

## Preventing Deadlocks

### Common Deadlock: Callback to JS from FFmpeg Thread

```cpp
// DEADLOCK RISK
static int ReadPacketCallback(void* opaque, uint8_t* buf, int size) {
    auto* self = static_cast<Decoder*>(opaque);
    
    // WRONG: Trying to call JS from FFmpeg's internal thread
    self->js_callback_.Call({});  // DEADLOCK - main thread may be waiting for this
    
    return size;
}

// CORRECT: Use ThreadSafeFunction
static int ReadPacketCallback(void* opaque, uint8_t* buf, int size) {
    auto* self = static_cast<Decoder*>(opaque);
    
    std::promise<int> promise;
    auto future = promise.get_future();
    
    self->tsfn_.NonBlockingCall([&promise, buf, size](Napi::Env env, Napi::Function fn) {
        // This runs on main thread
        auto result = fn.Call({/* ... */});
        promise.set_value(result.As<Napi::Number>().Int32Value());
    });
    
    return future.get();  // Wait for main thread
}
```

### Timeout Protection

```cpp
static int ReadPacketCallback(void* opaque, uint8_t* buf, int size) {
    // ... setup promise/future ...
    
    auto status = future.wait_for(std::chrono::seconds(5));
    if (status == std::future_status::timeout) {
        // Main thread is blocked - return error to FFmpeg
        return AVERROR(ETIMEDOUT);
    }
    
    return future.get();
}
```
