# Node-addon Lifecycle Patterns

## Preventing Segfaults in Addon Lifecycle

### The Destructor Problem

Node.js GC can destroy your ObjectWrap at any time. If FFmpeg is still using your context:

```cpp
// DANGEROUS
~VideoDecoder() {
    avcodec_free_context(&ctx_);  // May crash if worker thread is using ctx_
}
```

### Solution: Two-Phase Destruction

```cpp
class VideoDecoder : public Napi::ObjectWrap<VideoDecoder> {
public:
    ~VideoDecoder() {
        // GC is running - must be synchronous and fast
        Cleanup();
    }
    
    Napi::Value Close(const Napi::CallbackInfo& info) {
        // Explicit close - can be async
        Cleanup();
        return info.Env().Undefined();
    }

private:
    void Cleanup() {
        if (closed_.exchange(true)) return;  // Already closed
        
        // Signal all async operations to stop
        destroyed_ = true;
        
        // Wait for pending operations (with timeout)
        if (pending_operations_ > 0) {
            // In destructor: can't wait, just mark destroyed
            // In Close(): can wait for completion
        }
        
        // Release FFmpeg resources
        if (ctx_) {
            avcodec_free_context(&ctx_);
            ctx_ = nullptr;
        }
        
        // Release ThreadSafeFunction
        if (tsfn_) {
            tsfn_.Release();
        }
    }
    
    std::atomic<bool> closed_{false};
    std::atomic<bool> destroyed_{false};
    std::atomic<int> pending_operations_{0};
    AVCodecContext* ctx_ = nullptr;
    Napi::ThreadSafeFunction tsfn_;
};
```

### Guard Pattern for Async Operations

```cpp
class OperationGuard {
public:
    OperationGuard(std::atomic<int>& counter, std::atomic<bool>& destroyed)
        : counter_(counter), destroyed_(destroyed), valid_(!destroyed) {
        if (valid_) counter_++;
    }
    
    ~OperationGuard() {
        if (valid_) counter_--;
    }
    
    bool valid() const { return valid_ && !destroyed_; }
    
private:
    std::atomic<int>& counter_;
    std::atomic<bool>& destroyed_;
    bool valid_;
};

// Usage in AsyncWorker
void DecodeWorker::Execute() {
    OperationGuard guard(decoder_->pending_operations_, decoder_->destroyed_);
    if (!guard.valid()) {
        SetError("Decoder was closed");
        return;
    }
    
    // Safe to use decoder_->ctx_ here
    // ...
}
```

### preventing GC During Async Operations

```cpp
class VideoDecoder : public Napi::ObjectWrap<VideoDecoder> {
private:
    Napi::Value Decode(const Napi::CallbackInfo& info) {
        auto env = info.Env();
        
        // Create reference to prevent GC during async operation
        Napi::Reference<Napi::Object> ref = 
            Napi::Reference<Napi::Object>::New(info.This().As<Napi::Object>(), 1);
        
        auto* worker = new DecodeWorker(
            env, 
            this, 
            std::move(ref),  // Worker releases this when done
            // ...
        );
        worker->Queue();
        
        return deferred.Promise();
    }
};

class DecodeWorker : public Napi::AsyncWorker {
public:
    DecodeWorker(Napi::Env env, VideoDecoder* decoder,
                 Napi::Reference<Napi::Object> ref, /*...*/)
        : Napi::AsyncWorker(env)
        , decoder_(decoder)
        , ref_(std::move(ref)) {}
    
    void OnOK() override {
        // ref_ automatically releases when worker is destroyed
        // ...
    }
    
private:
    VideoDecoder* decoder_;
    Napi::Reference<Napi::Object> ref_;
};
```

## Buffer Ownership Patterns

### Pattern 1: Copy Input (Safe, Simple)

```cpp
Napi::Value Decode(const Napi::CallbackInfo& info) {
    auto buffer = info[0].As<Napi::Buffer<uint8_t>>();
    
    // Copy data - buffer may be GC'd during async operation
    std::vector<uint8_t> data(buffer.Data(), buffer.Data() + buffer.Length());
    
    auto* worker = new DecodeWorker(env, std::move(data), /*...*/);
    worker->Queue();
}
```

### Pattern 2: Reference Input (Zero-Copy, Complex)

```cpp
Napi::Value Decode(const Napi::CallbackInfo& info) {
    auto buffer = info[0].As<Napi::Buffer<uint8_t>>();
    
    // Hold reference to buffer
    Napi::Reference<Napi::Buffer<uint8_t>> bufferRef = 
        Napi::Reference<Napi::Buffer<uint8_t>>::New(buffer, 1);
    
    // Worker receives raw pointer + reference
    auto* worker = new DecodeWorker(
        env,
        buffer.Data(),      // Raw pointer
        buffer.Length(),
        std::move(bufferRef),  // Prevents GC
        /*...*/
    );
    worker->Queue();
}
```

### Pattern 3: External Buffer (Output to JS)

```cpp
Napi::Value GetFrame(const Napi::CallbackInfo& info) {
    auto env = info.Env();
    
    // Allocate frame that will be passed to JS
    auto* frame_data = new uint8_t[frame_size];
    // ... fill frame_data ...
    
    // Create buffer with release callback
    auto buffer = Napi::Buffer<uint8_t>::New(
        env,
        frame_data,
        frame_size,
        [](Napi::Env, uint8_t* data) {
            delete[] data;  // Called when JS garbage collects the buffer
        }
    );
    
    return buffer;
}
```

## Process Exit Cleanup

Node.js may exit without calling destructors:

```cpp
// Register cleanup hook in addon initialization
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    // ... register classes ...
    
    // Cleanup on process exit
    napi_add_env_cleanup_hook(
        env,
        [](void* arg) {
            // Cleanup global resources
            GlobalCodecRegistry::Instance().Shutdown();
        },
        nullptr
    );
    
    return exports;
}
```
