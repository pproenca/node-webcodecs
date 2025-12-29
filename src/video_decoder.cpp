// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#include "video_decoder.h"
#include "video_frame.h"
#include "encoded_video_chunk.h"

Napi::Object InitVideoDecoder(Napi::Env env, Napi::Object exports) {
    return VideoDecoder::Init(env, exports);
}

Napi::Object VideoDecoder::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "VideoDecoder", {
        InstanceMethod("configure", &VideoDecoder::Configure),
        InstanceMethod("decode", &VideoDecoder::Decode),
        InstanceMethod("flush", &VideoDecoder::Flush),
        InstanceMethod("reset", &VideoDecoder::Reset),
        InstanceMethod("close", &VideoDecoder::Close),
        InstanceAccessor("state", &VideoDecoder::GetState, nullptr),
        InstanceAccessor("decodeQueueSize", &VideoDecoder::GetDecodeQueueSize, nullptr),
        StaticMethod("isConfigSupported", &VideoDecoder::IsConfigSupported),
    });

    exports.Set("VideoDecoder", func);
    return exports;
}

VideoDecoder::VideoDecoder(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<VideoDecoder>(info),
      codec_(nullptr),
      codecContext_(nullptr),
      swsContext_(nullptr),
      frame_(nullptr),
      packet_(nullptr),
      state_("unconfigured"),
      codedWidth_(0),
      codedHeight_(0) {

    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsObject()) {
        throw Napi::Error::New(env, "VideoDecoder requires init object with output and error callbacks");
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

VideoDecoder::~VideoDecoder() {
    Cleanup();
}

void VideoDecoder::Cleanup() {
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

Napi::Value VideoDecoder::Configure(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (state_ == "closed") {
        throw Napi::Error::New(env, "InvalidStateError: Cannot configure a closed decoder");
    }

    if (info.Length() < 1 || !info[0].IsObject()) {
        throw Napi::Error::New(env, "configure requires config object");
    }

    Napi::Object config = info[0].As<Napi::Object>();

    // Parse codec string
    if (!config.Has("codec") || !config.Get("codec").IsString()) {
        throw Napi::Error::New(env, "config.codec is required");
    }
    std::string codecStr = config.Get("codec").As<Napi::String>().Utf8Value();

    // Parse dimensions
    if (!config.Has("codedWidth") || !config.Get("codedWidth").IsNumber()) {
        throw Napi::Error::New(env, "config.codedWidth is required");
    }
    if (!config.Has("codedHeight") || !config.Get("codedHeight").IsNumber()) {
        throw Napi::Error::New(env, "config.codedHeight is required");
    }

    codedWidth_ = config.Get("codedWidth").As<Napi::Number>().Int32Value();
    codedHeight_ = config.Get("codedHeight").As<Napi::Number>().Int32Value();

    if (codedWidth_ <= 0 || codedWidth_ > 16384) {
        throw Napi::Error::New(env, "codedWidth must be between 1 and 16384");
    }
    if (codedHeight_ <= 0 || codedHeight_ > 16384) {
        throw Napi::Error::New(env, "codedHeight must be between 1 and 16384");
    }

    // Determine codec ID from codec string
    AVCodecID codecId = AV_CODEC_ID_NONE;
    if (codecStr.find("avc1") == 0 || codecStr == "h264") {
        codecId = AV_CODEC_ID_H264;
    } else if (codecStr == "vp8") {
        codecId = AV_CODEC_ID_VP8;
    } else if (codecStr.find("vp09") == 0 || codecStr == "vp9") {
        codecId = AV_CODEC_ID_VP9;
    } else if (codecStr.find("av01") == 0 || codecStr == "av1") {
        codecId = AV_CODEC_ID_AV1;
    } else {
        throw Napi::Error::New(env, "Unsupported codec: " + codecStr);
    }

    // Find decoder
    codec_ = avcodec_find_decoder(codecId);
    if (!codec_) {
        throw Napi::Error::New(env, "Decoder not found for codec: " + codecStr);
    }

    // Allocate codec context
    codecContext_ = avcodec_alloc_context3(codec_);
    if (!codecContext_) {
        throw Napi::Error::New(env, "Could not allocate codec context");
    }

    // Configure decoder
    codecContext_->width = codedWidth_;
    codecContext_->height = codedHeight_;

    // Handle optional description (extradata / SPS+PPS for H.264)
    if (config.Has("description") && config.Get("description").IsTypedArray()) {
        Napi::TypedArray typedArray = config.Get("description").As<Napi::TypedArray>();
        Napi::ArrayBuffer arrayBuffer = typedArray.ArrayBuffer();
        size_t byteOffset = typedArray.ByteOffset();
        size_t byteLength = typedArray.ByteLength();

        uint8_t* data = static_cast<uint8_t*>(arrayBuffer.Data()) + byteOffset;

        codecContext_->extradata = static_cast<uint8_t*>(av_malloc(byteLength + AV_INPUT_BUFFER_PADDING_SIZE));
        if (codecContext_->extradata) {
            memcpy(codecContext_->extradata, data, byteLength);
            memset(codecContext_->extradata + byteLength, 0, AV_INPUT_BUFFER_PADDING_SIZE);
            codecContext_->extradata_size = static_cast<int>(byteLength);
        }
    }

    // Open codec
    int ret = avcodec_open2(codecContext_, codec_, nullptr);
    if (ret < 0) {
        char errbuf[256];
        av_strerror(ret, errbuf, sizeof(errbuf));
        Cleanup();
        throw Napi::Error::New(env, std::string("Could not open decoder: ") + errbuf);
    }

    // Allocate frame and packet
    frame_ = av_frame_alloc();
    if (!frame_) {
        Cleanup();
        throw Napi::Error::New(env, "Could not allocate frame");
    }

    packet_ = av_packet_alloc();
    if (!packet_) {
        Cleanup();
        throw Napi::Error::New(env, "Could not allocate packet");
    }

    state_ = "configured";

    return env.Undefined();
}

Napi::Value VideoDecoder::GetState(const Napi::CallbackInfo& info) {
    return Napi::String::New(info.Env(), state_);
}

Napi::Value VideoDecoder::GetDecodeQueueSize(const Napi::CallbackInfo& info) {
    // Stub - will be properly implemented in Task 6
    return Napi::Number::New(info.Env(), 0);
}

Napi::Value VideoDecoder::Decode(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (state_ != "configured") {
        throw Napi::Error::New(env, "InvalidStateError: Decoder not configured");
    }

    if (info.Length() < 1 || !info[0].IsObject()) {
        throw Napi::Error::New(env, "decode requires EncodedVideoChunk");
    }

    // Get EncodedVideoChunk
    EncodedVideoChunk* chunk = Napi::ObjectWrap<EncodedVideoChunk>::Unwrap(info[0].As<Napi::Object>());

    // Get data from chunk
    const uint8_t* data = chunk->GetData();
    size_t dataSize = chunk->GetDataSize();
    int64_t timestamp = chunk->GetTimestampValue();
    bool isKeyFrame = (chunk->GetTypeValue() == "key");

    // Setup packet
    av_packet_unref(packet_);
    packet_->data = const_cast<uint8_t*>(data);
    packet_->size = static_cast<int>(dataSize);
    packet_->pts = timestamp;
    packet_->dts = timestamp;

    if (isKeyFrame) {
        packet_->flags |= AV_PKT_FLAG_KEY;
    }

    // Send packet to decoder
    int ret = avcodec_send_packet(codecContext_, packet_);
    if (ret < 0 && ret != AVERROR(EAGAIN)) {
        char errbuf[256];
        av_strerror(ret, errbuf, sizeof(errbuf));
        errorCallback_.Call({ Napi::Error::New(env, std::string("Decode error: ") + errbuf).Value() });
        return env.Undefined();
    }

    // Emit any available decoded frames
    EmitFrames(env);

    return env.Undefined();
}

Napi::Value VideoDecoder::Flush(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (state_ != "configured") {
        // Return resolved promise if not configured
        Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
        deferred.Resolve(env.Undefined());
        return deferred.Promise();
    }

    // Send NULL packet to flush decoder
    int ret = avcodec_send_packet(codecContext_, nullptr);
    if (ret < 0 && ret != AVERROR_EOF) {
        char errbuf[256];
        av_strerror(ret, errbuf, sizeof(errbuf));
        errorCallback_.Call({ Napi::Error::New(env, std::string("Flush error: ") + errbuf).Value() });
    }

    // Emit remaining decoded frames
    EmitFrames(env);

    // Return resolved promise
    Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
    deferred.Resolve(env.Undefined());
    return deferred.Promise();
}

Napi::Value VideoDecoder::Reset(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (state_ == "closed") {
        throw Napi::Error::New(env, "InvalidStateError: Cannot reset a closed decoder");
    }

    // Flush any pending frames (discard them)
    if (codecContext_) {
        avcodec_send_packet(codecContext_, nullptr);
        while (avcodec_receive_frame(codecContext_, frame_) == 0) {
            av_frame_unref(frame_);
        }
    }

    // Clean up FFmpeg resources
    Cleanup();

    // Reset state
    state_ = "unconfigured";
    codedWidth_ = 0;
    codedHeight_ = 0;

    return env.Undefined();
}

void VideoDecoder::Close(const Napi::CallbackInfo& info) {
    Cleanup();
    state_ = "closed";
}

Napi::Value VideoDecoder::IsConfigSupported(const Napi::CallbackInfo& info) {
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
            const AVCodec* c = avcodec_find_decoder(AV_CODEC_ID_H264);
            if (!c) supported = false;
        } else if (codec == "vp8") {
            const AVCodec* c = avcodec_find_decoder(AV_CODEC_ID_VP8);
            if (!c) supported = false;
        } else if (codec.find("vp09") == 0 || codec == "vp9") {
            const AVCodec* c = avcodec_find_decoder(AV_CODEC_ID_VP9);
            if (!c) supported = false;
        } else if (codec.find("av01") == 0 || codec == "av1") {
            const AVCodec* c = avcodec_find_decoder(AV_CODEC_ID_AV1);
            if (!c) supported = false;
        } else {
            supported = false;
        }
    }

    // Validate and copy codedWidth
    if (!config.Has("codedWidth") || !config.Get("codedWidth").IsNumber()) {
        supported = false;
    } else {
        int codedWidth = config.Get("codedWidth").As<Napi::Number>().Int32Value();
        if (codedWidth <= 0 || codedWidth > 16384) {
            supported = false;
        }
        normalizedConfig.Set("codedWidth", codedWidth);
    }

    // Validate and copy codedHeight
    if (!config.Has("codedHeight") || !config.Get("codedHeight").IsNumber()) {
        supported = false;
    } else {
        int codedHeight = config.Get("codedHeight").As<Napi::Number>().Int32Value();
        if (codedHeight <= 0 || codedHeight > 16384) {
            supported = false;
        }
        normalizedConfig.Set("codedHeight", codedHeight);
    }

    // Copy optional properties if present
    if (config.Has("description") && config.Get("description").IsTypedArray()) {
        normalizedConfig.Set("description", config.Get("description"));
    }
    if (config.Has("hardwareAcceleration") && config.Get("hardwareAcceleration").IsString()) {
        normalizedConfig.Set("hardwareAcceleration", config.Get("hardwareAcceleration"));
    }
    if (config.Has("optimizeForLatency") && config.Get("optimizeForLatency").IsBoolean()) {
        normalizedConfig.Set("optimizeForLatency", config.Get("optimizeForLatency"));
    }

    result.Set("supported", supported);
    result.Set("config", normalizedConfig);

    // Return resolved Promise
    Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
    deferred.Resolve(result);
    return deferred.Promise();
}

void VideoDecoder::EmitFrames(Napi::Env env) {
    while (true) {
        int ret = avcodec_receive_frame(codecContext_, frame_);
        if (ret == AVERROR(EAGAIN) || ret == AVERROR_EOF) {
            break;
        }
        if (ret < 0) {
            char errbuf[256];
            av_strerror(ret, errbuf, sizeof(errbuf));
            errorCallback_.Call({ Napi::Error::New(env, std::string("Decode receive error: ") + errbuf).Value() });
            break;
        }

        // Initialize SwsContext if needed (convert from decoder's pixel format to RGBA)
        if (!swsContext_) {
            swsContext_ = sws_getContext(
                frame_->width, frame_->height, static_cast<AVPixelFormat>(frame_->format),
                frame_->width, frame_->height, AV_PIX_FMT_RGBA,
                SWS_BILINEAR, nullptr, nullptr, nullptr
            );
            if (!swsContext_) {
                errorCallback_.Call({ Napi::Error::New(env, "Could not create sws context").Value() });
                av_frame_unref(frame_);
                break;
            }
        }

        // Allocate RGBA buffer
        int rgbaSize = frame_->width * frame_->height * 4;
        std::vector<uint8_t> rgbaData(rgbaSize);

        // Setup output pointers
        uint8_t* dstData[1] = { rgbaData.data() };
        int dstLinesize[1] = { frame_->width * 4 };

        // Convert to RGBA
        sws_scale(swsContext_, frame_->data, frame_->linesize, 0, frame_->height,
                  dstData, dstLinesize);

        // Create VideoFrame
        Napi::Object videoFrame = VideoFrame::CreateInstance(
            env,
            rgbaData.data(),
            rgbaData.size(),
            frame_->width,
            frame_->height,
            frame_->pts,
            "RGBA"
        );

        // Call output callback
        outputCallback_.Call({ videoFrame });

        av_frame_unref(frame_);
    }
}
