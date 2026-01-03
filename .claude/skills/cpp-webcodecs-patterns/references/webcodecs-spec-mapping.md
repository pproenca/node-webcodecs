# W3C WebCodecs Spec to Implementation Mapping

## VideoDecoder Implementation

### State Machine (per spec)

```
                    ┌─────────────────────────────────────────┐
                    │                                         │
                    ▼                                         │
    ┌──────────────────────────┐                              │
    │      Unconfigured        │◄─────────────────────────────┤
    └──────────────────────────┘                              │
                │                                             │
                │ configure()                                 │
                ▼                                             │
    ┌──────────────────────────┐         reset()              │
    │       Configured         │──────────────────────────────┘
    └──────────────────────────┘
                │
                │ close()
                ▼
    ┌──────────────────────────┐
    │         Closed           │
    └──────────────────────────┘
```

### C++ State Machine Implementation

```cpp
class VideoDecoderState {
public:
    enum class State { Unconfigured, Configured, Closed };
    
    void Configure() {
        if (state_ != State::Unconfigured) {
            throw DOMException("InvalidStateError", 
                "VideoDecoder must be unconfigured to call configure()");
        }
        state_ = State::Configured;
    }
    
    void Decode() {
        if (state_ != State::Configured) {
            throw DOMException("InvalidStateError",
                "VideoDecoder must be configured to call decode()");
        }
    }
    
    void Flush() {
        if (state_ != State::Configured) {
            throw DOMException("InvalidStateError",
                "VideoDecoder must be configured to call flush()");
        }
    }
    
    void Reset() {
        if (state_ == State::Closed) {
            throw DOMException("InvalidStateError", "VideoDecoder is closed");
        }
        state_ = State::Unconfigured;
    }
    
    void Close() {
        state_ = State::Closed;
    }

private:
    State state_ = State::Unconfigured;
};
```

### Codec String Parsing

WebCodecs uses MIME-style codec strings:

```cpp
struct CodecInfo {
    std::string codec;      // "avc1", "vp8", "vp09", "av01", "hev1"
    int profile = -1;
    int level = -1;
    int bit_depth = 8;
    // ... other parameters
};

CodecInfo ParseCodecString(const std::string& codec_string) {
    CodecInfo info;
    
    // "avc1.42E01E" -> AVC, Baseline Profile, Level 3.0
    if (codec_string.starts_with("avc1.") || codec_string.starts_with("avc3.")) {
        info.codec = codec_string.substr(0, 4);
        if (codec_string.length() >= 11) {
            // Parse profile_idc, constraint_set_flags, level_idc
            auto params = codec_string.substr(5);
            info.profile = std::stoi(params.substr(0, 2), nullptr, 16);
            info.level = std::stoi(params.substr(4, 2), nullptr, 16);
        }
    }
    // "vp09.00.10.08" -> VP9, Profile 0, Level 1.0, 8-bit
    else if (codec_string.starts_with("vp09.")) {
        info.codec = "vp09";
        auto parts = Split(codec_string, '.');
        if (parts.size() >= 4) {
            info.profile = std::stoi(parts[1]);
            info.level = std::stoi(parts[2]);
            info.bit_depth = std::stoi(parts[3]);
        }
    }
    // ... handle other codecs
    
    return info;
}

// Map to FFmpeg codec
AVCodecID ToFFmpegCodec(const CodecInfo& info) {
    static const std::map<std::string, AVCodecID> codec_map = {
        {"avc1", AV_CODEC_ID_H264},
        {"avc3", AV_CODEC_ID_H264},
        {"hev1", AV_CODEC_ID_HEVC},
        {"hvc1", AV_CODEC_ID_HEVC},
        {"vp8", AV_CODEC_ID_VP8},
        {"vp09", AV_CODEC_ID_VP9},
        {"av01", AV_CODEC_ID_AV1},
    };
    auto it = codec_map.find(info.codec);
    return it != codec_map.end() ? it->second : AV_CODEC_ID_NONE;
}
```

### EncodedVideoChunk Structure

```cpp
struct EncodedVideoChunk {
    enum class Type { Key, Delta };
    
    Type type;
    int64_t timestamp;           // microseconds
    std::optional<int64_t> duration;  // microseconds
    std::vector<uint8_t> data;
    
    // Convert to FFmpeg AVPacket
    AVPacket* ToAVPacket() const {
        AVPacket* pkt = av_packet_alloc();
        av_packet_from_data(pkt, 
            const_cast<uint8_t*>(data.data()),  // FFmpeg won't modify
            data.size());
        
        // WebCodecs timestamps are in microseconds
        // FFmpeg uses time_base, typically {1, 90000} for video
        pkt->pts = timestamp * 90000 / 1000000;
        pkt->dts = pkt->pts;  // Simplified - real impl needs DTS tracking
        
        if (type == Type::Key) {
            pkt->flags |= AV_PKT_FLAG_KEY;
        }
        
        return pkt;
    }
};
```

### VideoFrame Structure

```cpp
class VideoFrame {
public:
    enum class Format {
        I420, I420A, I422, I444, NV12, 
        RGBA, RGBX, BGRA, BGRX
    };
    
    // Required by spec
    Format format() const;
    uint32_t codedWidth() const;
    uint32_t codedHeight() const;
    uint32_t displayWidth() const;
    uint32_t displayHeight() const;
    std::optional<int64_t> timestamp() const;  // microseconds
    std::optional<uint64_t> duration() const;
    
    // Rect operations
    struct Rect { uint32_t x, y, width, height; };
    Rect visibleRect() const;
    
    // Copy to buffer
    uint32_t allocationSize(const VideoFrameCopyToOptions& options) const;
    void copyTo(void* destination, const VideoFrameCopyToOptions& options) const;
    
    // Lifecycle
    void close();
    VideoFrame* clone() const;
    
    // Conversion from FFmpeg
    static std::unique_ptr<VideoFrame> FromAVFrame(const AVFrame* frame) {
        auto vf = std::make_unique<VideoFrame>();
        
        // Map pixel format
        vf->format_ = MapPixelFormat(frame->format);
        vf->coded_width_ = frame->width;
        vf->coded_height_ = frame->height;
        
        // Copy plane data
        for (int i = 0; i < AV_NUM_DATA_POINTERS && frame->data[i]; i++) {
            int plane_height = (i == 0) ? frame->height : frame->height / 2;  // Simplified
            int plane_size = frame->linesize[i] * plane_height;
            vf->planes_.emplace_back(frame->data[i], frame->data[i] + plane_size);
            vf->strides_.push_back(frame->linesize[i]);
        }
        
        // Timestamp conversion (FFmpeg time_base -> microseconds)
        if (frame->pts != AV_NOPTS_VALUE) {
            vf->timestamp_ = frame->pts * 1000000 / 90000;  // Assuming 90kHz time_base
        }
        
        return vf;
    }

private:
    Format format_;
    uint32_t coded_width_, coded_height_;
    uint32_t display_width_, display_height_;
    std::optional<int64_t> timestamp_;
    std::optional<uint64_t> duration_;
    std::vector<std::vector<uint8_t>> planes_;
    std::vector<int> strides_;
};
```

### Output Callback Pattern

WebCodecs uses callbacks, not promises:

```cpp
class VideoDecoderImpl {
public:
    void Configure(const VideoDecoderConfig& config,
                   std::function<void(VideoFrame*)> output,
                   std::function<void(DOMException)> error) {
        output_callback_ = std::move(output);
        error_callback_ = std::move(error);
        
        // ... configure FFmpeg decoder ...
    }
    
    void Decode(const EncodedVideoChunk& chunk) {
        // Queue the decode operation
        pending_decodes_.push({chunk, decode_queue_id_++});
        ProcessQueue();
    }
    
    std::promise<void> Flush() {
        std::promise<void> promise;
        flush_promises_.push(std::move(promise));
        ProcessQueue();
        return flush_promises_.back();
    }

private:
    void ProcessQueue() {
        while (!pending_decodes_.empty()) {
            auto& item = pending_decodes_.front();
            
            auto result = DecodeChunk(item.chunk);
            if (result.error) {
                error_callback_(*result.error);
                return;
            }
            
            for (auto& frame : result.frames) {
                output_callback_(frame.get());
            }
            
            pending_decodes_.pop();
        }
        
        // Complete flush if no pending decodes
        while (!flush_promises_.empty()) {
            flush_promises_.front().set_value();
            flush_promises_.pop();
        }
    }
    
    std::function<void(VideoFrame*)> output_callback_;
    std::function<void(DOMException)> error_callback_;
    std::queue<DecodeItem> pending_decodes_;
    std::queue<std::promise<void>> flush_promises_;
    uint64_t decode_queue_id_ = 0;
};
```

### isConfigSupported Static Method

```cpp
// Static method - must not require instance
static Napi::Value IsConfigSupported(const Napi::CallbackInfo& info) {
    auto env = info.Env();
    auto config = ParseConfig(info[0].As<Napi::Object>());
    
    // Check if we can decode this codec
    auto codec_info = ParseCodecString(config.codec);
    auto ffmpeg_codec = ToFFmpegCodec(codec_info);
    
    VideoDecoderSupport support;
    support.supported = (avcodec_find_decoder(ffmpeg_codec) != nullptr);
    support.config = config;  // Echo back the config
    
    // Return promise that resolves immediately
    auto deferred = Napi::Promise::Deferred::New(env);
    deferred.Resolve(support.ToJS(env));
    return deferred.Promise();
}
```

### Handling Codec-Specific Data (avcC/hvcC)

For H.264/HEVC, the spec requires extradata:

```cpp
void ConfigureWithDescription(const VideoDecoderConfig& config) {
    if (!config.description.empty()) {
        // description contains avcC/hvcC atom
        ctx_->extradata_size = config.description.size();
        ctx_->extradata = static_cast<uint8_t*>(
            av_mallocz(config.description.size() + AV_INPUT_BUFFER_PADDING_SIZE)
        );
        memcpy(ctx_->extradata, config.description.data(), config.description.size());
    }
    
    avcodec_open2(ctx_, codec_, nullptr);
}
```

## VideoEncoder Implementation

### Encode Queue with Backpressure

```cpp
class VideoEncoderImpl {
public:
    void Encode(VideoFrame* frame, const VideoEncoderEncodeOptions& options) {
        if (encode_queue_size_ >= MAX_QUEUE_SIZE) {
            // Spec: "queue full" triggers backpressure
            // Implementation should signal via encodeQueueSize attribute
            throw DOMException("EncodingError", "Encode queue full");
        }
        
        encode_queue_size_++;
        
        // Convert to AVFrame
        auto av_frame = frame->ToAVFrame();
        if (options.keyFrame) {
            av_frame->pict_type = AV_PICTURE_TYPE_I;
        }
        
        // Queue for encoding
        pending_frames_.push(std::move(av_frame));
        ProcessEncodeQueue();
    }
    
    uint32_t encodeQueueSize() const { return encode_queue_size_; }

private:
    std::atomic<uint32_t> encode_queue_size_{0};
    static constexpr uint32_t MAX_QUEUE_SIZE = 16;
};
```

### EncodedVideoChunkMetadata

```cpp
struct EncodedVideoChunkMetadata {
    std::optional<VideoDecoderConfig> decoderConfig;  // On keyframes
    std::optional<SvcOutputMetadata> svc;
    std::optional<uint32_t> temporalLayerId;
    
    static EncodedVideoChunkMetadata FromAVPacket(
        const AVPacket* pkt,
        const AVCodecContext* ctx
    ) {
        EncodedVideoChunkMetadata meta;
        
        if (pkt->flags & AV_PKT_FLAG_KEY) {
            // Include decoder config on keyframes
            VideoDecoderConfig config;
            config.codec = GetCodecString(ctx);
            config.codedWidth = ctx->width;
            config.codedHeight = ctx->height;
            
            if (ctx->extradata) {
                config.description.assign(
                    ctx->extradata,
                    ctx->extradata + ctx->extradata_size
                );
            }
            
            meta.decoderConfig = std::move(config);
        }
        
        return meta;
    }
};
```
