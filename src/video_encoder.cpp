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
        InstanceMethod("close", &VideoEncoder::Close),
        InstanceAccessor("state", &VideoEncoder::GetState, nullptr),
        InstanceAccessor("encodeQueueSize", &VideoEncoder::GetEncodeQueueSize, nullptr),
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
      frameCount_(0),
      encodeQueueSize_(0) {

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

    return env.Undefined();
}

Napi::Value VideoEncoder::GetState(const Napi::CallbackInfo& info) {
    return Napi::String::New(info.Env(), state_);
}

Napi::Value VideoEncoder::GetEncodeQueueSize(const Napi::CallbackInfo& info) {
    return Napi::Number::New(info.Env(), encodeQueueSize_);
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

    // Convert RGBA to YUV420P
    const uint8_t* srcData[] = { videoFrame->GetData() };
    int srcLinesize[] = { videoFrame->GetWidth() * 4 };

    sws_scale(swsContext_, srcData, srcLinesize, 0, height_,
              frame_->data, frame_->linesize);

    frame_->pts = frameCount_++;

    // Set picture type for keyframe forcing
    if (forceKeyFrame) {
        frame_->pict_type = AV_PICTURE_TYPE_I;
    } else {
        frame_->pict_type = AV_PICTURE_TYPE_NONE;
    }

    // Send frame to encoder
    int ret = avcodec_send_frame(codecContext_, frame_);
    if (ret < 0) {
        char errbuf[256];
        av_strerror(ret, errbuf, sizeof(errbuf));
        throw Napi::Error::New(env, std::string("Error sending frame: ") + errbuf);
    }

    // Receive encoded packets
    EmitChunks(env);

    return env.Undefined();
}

Napi::Value VideoEncoder::Flush(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (state_ != "configured") {
        return env.Undefined();
    }

    // Send NULL frame to flush encoder
    avcodec_send_frame(codecContext_, nullptr);

    // Get remaining packets
    EmitChunks(env);

    return env.Undefined();
}

void VideoEncoder::Close(const Napi::CallbackInfo& info) {
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
