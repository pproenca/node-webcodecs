#include "video_encoder.h"
#include "video_frame.h"

Napi::Object InitVideoEncoder(Napi::Env env, Napi::Object exports) {
    return VideoEncoder::Init(env, exports);
}

Napi::Object VideoEncoder::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "VideoEncoder", {
        InstanceMethod("configure", &VideoEncoder::Configure),
        InstanceMethod("encode", &VideoEncoder::Encode),
        InstanceMethod("flush", &VideoEncoder::Flush),
        InstanceMethod("reset", &VideoEncoder::Reset),
        InstanceMethod("close", &VideoEncoder::Close),
        InstanceAccessor("state", &VideoEncoder::GetState, nullptr),
        InstanceAccessor("encodeQueueSize", &VideoEncoder::GetEncodeQueueSize, nullptr),
        StaticMethod("isConfigSupported", &VideoEncoder::IsConfigSupported),
    });

    exports.Set("VideoEncoder", func);
    return exports;
}

VideoEncoder::VideoEncoder(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<VideoEncoder>(info),
      codec_(nullptr),
      codecContext_(nullptr),
      swsContext_(nullptr),
      frame_(nullptr),
      packet_(nullptr),
      state_("unconfigured"),
      width_(0),
      height_(0),
      frameCount_(0) {

    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsObject()) {
        throw Napi::Error::New(env, "VideoEncoder requires init object with output and error callbacks");
    }

    Napi::Object init = info[0].As<Napi::Object>();

    if (!init.Has("output") || !init.Get("output").IsFunction()) {
        throw Napi::Error::New(env, "init.output must be a function");
    }
    if (!init.Has("error") || !init.Get("error").IsFunction()) {
        throw Napi::Error::New(env, "init.error must be a function");
    }

    outputCallback_ = Napi::Persistent(init.Get("output").As<Napi::Function>());
    errorCallback_ = Napi::Persistent(init.Get("error").As<Napi::Function>());
}

VideoEncoder::~VideoEncoder() {
    StopThread();
    Cleanup();
}

void VideoEncoder::Cleanup() {
    if (frame_) {
        av_frame_free(&frame_);
        frame_ = nullptr;
    }
    if (packet_) {
        av_packet_free(&packet_);
        packet_ = nullptr;
    }
    if (swsContext_) {
        sws_freeContext(swsContext_);
        swsContext_ = nullptr;
    }
    if (codecContext_) {
        avcodec_free_context(&codecContext_);
        codecContext_ = nullptr;
    }
    codec_ = nullptr;
}

void VideoEncoder::StartThread(Napi::Env env) {
    if (threadRunning_.load()) return;

    // Create thread-safe function for output callback
    outputTsfn_ = Napi::ThreadSafeFunction::New(
        env,
        outputCallback_.Value(),
        "OutputCallback",
        0,  // unlimited queue
        1   // single thread
    );

    // Create thread-safe function for dequeue events
    // We use a simple callback that will trigger the dequeue event on the JS side
    dequeueTsfn_ = Napi::ThreadSafeFunction::New(
        env,
        Napi::Function::New(env, [](const Napi::CallbackInfo& info) {
            // Placeholder - dequeue event handling
        }),
        "DequeueCallback",
        0,
        1
    );

    threadRunning_.store(true);
    encoderThread_ = std::thread(&VideoEncoder::EncoderThreadFunc, this);
}

void VideoEncoder::StopThread() {
    if (!threadRunning_.load()) return;

    threadRunning_.store(false);
    queueCondition_.notify_one();

    if (encoderThread_.joinable()) {
        encoderThread_.join();
    }

    // Release thread-safe functions
    if (outputTsfn_) {
        outputTsfn_.Release();
    }
    if (dequeueTsfn_) {
        dequeueTsfn_.Release();
    }
}

void VideoEncoder::EncoderThreadFunc() {
    while (threadRunning_.load()) {
        EncodeRequest request;
        bool hasRequest = false;
        bool hasFlush = false;
        FlushSentinel flushSentinel{0};

        {
            std::unique_lock<std::mutex> lock(queueMutex_);
            queueCondition_.wait(lock, [this] {
                return !encodeQueue_.empty() || !flushQueue_.empty() || !threadRunning_.load();
            });

            if (!threadRunning_.load() && encodeQueue_.empty() && flushQueue_.empty()) {
                break;
            }

            // Process encode requests first
            if (!encodeQueue_.empty()) {
                request = std::move(encodeQueue_.front());
                encodeQueue_.pop();
                hasRequest = true;

                // Decrement when processing STARTS (per W3C spec)
                encodeQueueSize_.fetch_sub(1);
            }

            // Check for flush sentinels only if no encode request
            if (!hasRequest && !flushQueue_.empty()) {
                flushSentinel = flushQueue_.front();
                flushQueue_.pop();
                hasFlush = true;
            }
        }

        if (hasRequest) {
            // Schedule dequeue event (with coalescing)
            ScheduleDequeueEvent();

            // Process the encode request
            ProcessEncodeRequest(request);
        }

        if (hasFlush) {
            // Flush encoder
            if (codecContext_) {
                avcodec_send_frame(codecContext_, nullptr);
                EmitChunksThreadSafe();
            }

            // Resolve matching flush promises
            {
                std::lock_guard<std::mutex> flushLock(flushMutex_);
                auto it = pendingFlushPromises_.begin();
                while (it != pendingFlushPromises_.end()) {
                    if (it->first == flushSentinel.resetCount) {
                        // Queue resolve on main thread
                        auto deferred = std::move(it->second);
                        outputTsfn_.BlockingCall([deferred](Napi::Env env, Napi::Function) mutable {
                            deferred.Resolve(env.Undefined());
                        });
                        it = pendingFlushPromises_.erase(it);
                    } else {
                        ++it;
                    }
                }
            }
        }
    }
}

void VideoEncoder::ScheduleDequeueEvent() {
    bool expected = false;
    if (dequeueEventScheduled_.compare_exchange_strong(expected, true)) {
        dequeueTsfn_.NonBlockingCall([this](Napi::Env env, Napi::Function) {
            // Reset the flag - called from main thread
            dequeueEventScheduled_.store(false);
        });
    }
}

void VideoEncoder::ProcessEncodeRequest(const EncodeRequest& request) {
    if (!codecContext_ || !frame_ || !swsContext_) {
        return;
    }

    // Convert RGBA to YUV420P
    const uint8_t* srcData[] = { request.frameData.data() };
    int srcLinesize[] = { request.width * 4 };

    sws_scale(swsContext_, srcData, srcLinesize, 0, height_,
              frame_->data, frame_->linesize);

    frame_->pts = frameCount_++;

    if (request.forceKeyFrame) {
        frame_->pict_type = AV_PICTURE_TYPE_I;
    } else {
        frame_->pict_type = AV_PICTURE_TYPE_NONE;
    }

    int ret = avcodec_send_frame(codecContext_, frame_);
    if (ret < 0) {
        // Handle error - could call error callback on main thread
        return;
    }

    EmitChunksThreadSafe();
}

void VideoEncoder::EmitChunksThreadSafe() {
    while (true) {
        int ret = avcodec_receive_packet(codecContext_, packet_);
        if (ret == AVERROR(EAGAIN) || ret == AVERROR_EOF) {
            break;
        }
        if (ret < 0) {
            break;
        }

        // Copy packet data
        std::string type = (packet_->flags & AV_PKT_FLAG_KEY) ? "key" : "delta";
        int64_t pts = packet_->pts;
        int64_t duration = packet_->duration;
        std::vector<uint8_t> data(packet_->data, packet_->data + packet_->size);

        av_packet_unref(packet_);

        // Call output on main thread
        outputTsfn_.BlockingCall([type, pts, duration, data = std::move(data)](Napi::Env env, Napi::Function callback) {
            Napi::Object chunk = Napi::Object::New(env);
            chunk.Set("type", type);
            chunk.Set("timestamp", Napi::Number::New(env, pts));
            chunk.Set("duration", Napi::Number::New(env, duration));
            chunk.Set("data", Napi::Buffer<uint8_t>::Copy(env, data.data(), data.size()));
            callback.Call({ chunk, env.Null() });
        });
    }
}

Napi::Value VideoEncoder::Configure(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsObject()) {
        throw Napi::Error::New(env, "configure requires config object");
    }

    Napi::Object config = info[0].As<Napi::Object>();

    // Parse config
    width_ = config.Get("width").As<Napi::Number>().Int32Value();
    height_ = config.Get("height").As<Napi::Number>().Int32Value();

    int bitrate = 1000000; // Default 1Mbps
    if (config.Has("bitrate")) {
        bitrate = config.Get("bitrate").As<Napi::Number>().Int32Value();
    }

    int framerate = 30; // Default 30fps
    if (config.Has("framerate")) {
        framerate = config.Get("framerate").As<Napi::Number>().Int32Value();
    }

    // Find H.264 encoder
    codec_ = avcodec_find_encoder(AV_CODEC_ID_H264);
    if (!codec_) {
        throw Napi::Error::New(env, "H.264 encoder not found");
    }

    codecContext_ = avcodec_alloc_context3(codec_);
    if (!codecContext_) {
        throw Napi::Error::New(env, "Could not allocate codec context");
    }

    // Configure encoder
    codecContext_->width = width_;
    codecContext_->height = height_;
    codecContext_->time_base = {1, framerate};
    codecContext_->framerate = {framerate, 1};
    codecContext_->pix_fmt = AV_PIX_FMT_YUV420P;
    codecContext_->bit_rate = bitrate;
    codecContext_->gop_size = 30; // Keyframe every 30 frames
    codecContext_->max_b_frames = 2;

    // H.264 specific options
    av_opt_set(codecContext_->priv_data, "preset", "fast", 0);
    av_opt_set(codecContext_->priv_data, "tune", "zerolatency", 0);

    int ret = avcodec_open2(codecContext_, codec_, nullptr);
    if (ret < 0) {
        char errbuf[256];
        av_strerror(ret, errbuf, sizeof(errbuf));
        Cleanup();
        throw Napi::Error::New(env, std::string("Could not open codec: ") + errbuf);
    }

    // Allocate frame and packet
    frame_ = av_frame_alloc();
    frame_->format = codecContext_->pix_fmt;
    frame_->width = width_;
    frame_->height = height_;
    av_frame_get_buffer(frame_, 32);

    packet_ = av_packet_alloc();

    // Setup color converter (RGBA -> YUV420P)
    swsContext_ = sws_getContext(
        width_, height_, AV_PIX_FMT_RGBA,
        width_, height_, AV_PIX_FMT_YUV420P,
        SWS_BILINEAR, nullptr, nullptr, nullptr
    );

    state_ = "configured";
    frameCount_ = 0;

    // Start the encoder thread
    StartThread(env);

    return env.Undefined();
}

Napi::Value VideoEncoder::GetState(const Napi::CallbackInfo& info) {
    return Napi::String::New(info.Env(), state_);
}

Napi::Value VideoEncoder::GetEncodeQueueSize(const Napi::CallbackInfo& info) {
    return Napi::Number::New(info.Env(), encodeQueueSize_.load());
}

Napi::Value VideoEncoder::Encode(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (state_ != "configured") {
        throw Napi::Error::New(env, "Encoder not configured");
    }

    if (info.Length() < 1 || !info[0].IsObject()) {
        throw Napi::Error::New(env, "encode requires VideoFrame");
    }

    // Get VideoFrame
    VideoFrame* videoFrame = Napi::ObjectWrap<VideoFrame>::Unwrap(info[0].As<Napi::Object>());

    // Validate buffer size matches configured dimensions
    size_t expectedSize = static_cast<size_t>(width_) * height_ * 4; // RGBA = 4 bytes per pixel
    size_t actualSize = videoFrame->GetDataSize();
    if (actualSize < expectedSize) {
        throw Napi::Error::New(env,
            "VideoFrame buffer too small: expected " + std::to_string(expectedSize) +
            " bytes, got " + std::to_string(actualSize));
    }

    // Check for keyFrame option
    bool forceKeyFrame = false;
    if (info.Length() >= 2 && info[1].IsObject()) {
        Napi::Object options = info[1].As<Napi::Object>();
        if (options.Has("keyFrame") && options.Get("keyFrame").IsBoolean()) {
            forceKeyFrame = options.Get("keyFrame").As<Napi::Boolean>().Value();
        }
    }

    // Create encode request
    EncodeRequest request;
    const uint8_t* data = videoFrame->GetData();
    request.frameData = std::vector<uint8_t>(data, data + actualSize);
    request.width = videoFrame->GetWidth();
    request.height = videoFrame->GetHeight();
    request.timestamp = videoFrame->GetTimestamp();
    request.forceKeyFrame = forceKeyFrame;

    // Queue the request
    {
        std::lock_guard<std::mutex> lock(queueMutex_);
        encodeQueue_.push(std::move(request));
        encodeQueueSize_.fetch_add(1);
    }
    queueCondition_.notify_one();

    return env.Undefined();
}

Napi::Value VideoEncoder::Flush(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);

    if (state_ != "configured") {
        deferred.Resolve(env.Undefined());
        return deferred.Promise();
    }

    uint32_t currentResetCount = resetCount_.load();

    // Store the deferred promise for later resolution
    {
        std::lock_guard<std::mutex> flushLock(flushMutex_);
        pendingFlushPromises_.push_back({currentResetCount, std::move(deferred)});
    }

    // Queue the flush sentinel
    {
        std::lock_guard<std::mutex> lock(queueMutex_);
        flushQueue_.push({currentResetCount});
    }
    queueCondition_.notify_one();

    // Return the promise from the stored pair
    std::lock_guard<std::mutex> flushLock(flushMutex_);
    return pendingFlushPromises_.back().second.Promise();
}

Napi::Value VideoEncoder::Reset(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (state_ == "closed") {
        throw Napi::Error::New(env, "InvalidStateError: Cannot reset a closed encoder");
    }

    // Increment reset count to invalidate stale callbacks
    resetCount_.fetch_add(1);

    // Stop thread, clear queues
    StopThread();

    {
        std::lock_guard<std::mutex> lock(queueMutex_);
        while (!encodeQueue_.empty()) encodeQueue_.pop();
        while (!flushQueue_.empty()) flushQueue_.pop();
        encodeQueueSize_.store(0);
    }

    // Reject all pending flush promises
    {
        std::lock_guard<std::mutex> flushLock(flushMutex_);
        for (auto& pair : pendingFlushPromises_) {
            pair.second.Reject(
                Napi::Error::New(env, "AbortError: Encoder was reset").Value()
            );
        }
        pendingFlushPromises_.clear();
    }

    Cleanup();
    state_ = "unconfigured";
    frameCount_ = 0;

    return env.Undefined();
}

void VideoEncoder::Close(const Napi::CallbackInfo& info) {
    if (state_ != "closed") {
        StopThread();

        // Clear pending flush promises silently (don't reject on close)
        {
            std::lock_guard<std::mutex> flushLock(flushMutex_);
            pendingFlushPromises_.clear();
        }

        // Clear queues
        {
            std::lock_guard<std::mutex> lock(queueMutex_);
            while (!encodeQueue_.empty()) encodeQueue_.pop();
            while (!flushQueue_.empty()) flushQueue_.pop();
            encodeQueueSize_.store(0);
        }
    }

    Cleanup();
    state_ = "closed";
}

void VideoEncoder::EmitChunks(Napi::Env env) {
    while (true) {
        int ret = avcodec_receive_packet(codecContext_, packet_);
        if (ret == AVERROR(EAGAIN) || ret == AVERROR_EOF) {
            break;
        }
        if (ret < 0) {
            char errbuf[256];
            av_strerror(ret, errbuf, sizeof(errbuf));
            errorCallback_.Call({ Napi::Error::New(env, std::string("Encoding error: ") + errbuf).Value() });
            break;
        }

        // Create EncodedVideoChunk-like object
        Napi::Object chunk = Napi::Object::New(env);
        chunk.Set("type", (packet_->flags & AV_PKT_FLAG_KEY) ? "key" : "delta");
        chunk.Set("timestamp", Napi::Number::New(env, packet_->pts));
        chunk.Set("duration", Napi::Number::New(env, packet_->duration));
        chunk.Set("data", Napi::Buffer<uint8_t>::Copy(env, packet_->data, packet_->size));

        // Call output callback
        outputCallback_.Call({ chunk, env.Null() });

        av_packet_unref(packet_);
    }
}

Napi::Value VideoEncoder::IsConfigSupported(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsObject()) {
        Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
        deferred.Reject(Napi::Error::New(env, "config must be an object").Value());
        return deferred.Promise();
    }

    Napi::Object config = info[0].As<Napi::Object>();
    Napi::Object result = Napi::Object::New(env);
    bool supported = true;

    Napi::Object normalizedConfig = Napi::Object::New(env);

    // Validate codec
    if (!config.Has("codec") || !config.Get("codec").IsString()) {
        supported = false;
    } else {
        std::string codec = config.Get("codec").As<Napi::String>().Utf8Value();
        normalizedConfig.Set("codec", codec);

        // Check if codec is supported
        if (codec.find("avc1") == 0 || codec == "h264") {
            const AVCodec* c = avcodec_find_encoder(AV_CODEC_ID_H264);
            if (!c) supported = false;
        } else if (codec == "vp8") {
            const AVCodec* c = avcodec_find_encoder(AV_CODEC_ID_VP8);
            if (!c) supported = false;
        } else if (codec.find("vp09") == 0 || codec == "vp9") {
            const AVCodec* c = avcodec_find_encoder(AV_CODEC_ID_VP9);
            if (!c) supported = false;
        } else if (codec.find("av01") == 0 || codec == "av1") {
            const AVCodec* c = avcodec_find_encoder(AV_CODEC_ID_AV1);
            if (!c) supported = false;
        } else {
            supported = false;
        }
    }

    // Validate and copy width
    if (!config.Has("width") || !config.Get("width").IsNumber()) {
        supported = false;
    } else {
        int width = config.Get("width").As<Napi::Number>().Int32Value();
        if (width <= 0 || width > 16384) {
            supported = false;
        }
        normalizedConfig.Set("width", width);
    }

    // Validate and copy height
    if (!config.Has("height") || !config.Get("height").IsNumber()) {
        supported = false;
    } else {
        int height = config.Get("height").As<Napi::Number>().Int32Value();
        if (height <= 0 || height > 16384) {
            supported = false;
        }
        normalizedConfig.Set("height", height);
    }

    // Copy optional properties if present
    if (config.Has("bitrate") && config.Get("bitrate").IsNumber()) {
        normalizedConfig.Set("bitrate", config.Get("bitrate"));
    }
    if (config.Has("framerate") && config.Get("framerate").IsNumber()) {
        normalizedConfig.Set("framerate", config.Get("framerate"));
    }
    if (config.Has("hardwareAcceleration") && config.Get("hardwareAcceleration").IsString()) {
        normalizedConfig.Set("hardwareAcceleration", config.Get("hardwareAcceleration"));
    }
    if (config.Has("latencyMode") && config.Get("latencyMode").IsString()) {
        normalizedConfig.Set("latencyMode", config.Get("latencyMode"));
    }
    if (config.Has("bitrateMode") && config.Get("bitrateMode").IsString()) {
        normalizedConfig.Set("bitrateMode", config.Get("bitrateMode"));
    }

    result.Set("supported", supported);
    result.Set("config", normalizedConfig);

    // Return resolved Promise
    Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
    deferred.Resolve(result);
    return deferred.Promise();
}
