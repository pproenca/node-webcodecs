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

// Stub implementations for now
Napi::Value VideoEncoder::Encode(const Napi::CallbackInfo& info) {
    return info.Env().Undefined();
}

Napi::Value VideoEncoder::Flush(const Napi::CallbackInfo& info) {
    return info.Env().Undefined();
}

void VideoEncoder::Close(const Napi::CallbackInfo& info) {
    Cleanup();
    state_ = "closed";
}

void VideoEncoder::EmitChunks(Napi::Env env) {
    // Will be implemented in Task 6
}
