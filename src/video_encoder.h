// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// VideoEncoder implementation wrapping FFmpeg libx264.

#ifndef NODE_WEBCODECS_SRC_VIDEO_ENCODER_H_
#define NODE_WEBCODECS_SRC_VIDEO_ENCODER_H_

#include <napi.h>

#include <string>

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavutil/imgutils.h>
#include <libavutil/opt.h>
#include <libswscale/swscale.h>
}

class VideoEncoder : public Napi::ObjectWrap<VideoEncoder> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    static Napi::Value IsConfigSupported(const Napi::CallbackInfo& info);
    VideoEncoder(const Napi::CallbackInfo& info);
    ~VideoEncoder();

private:
    // WebCodecs API methods
    Napi::Value Configure(const Napi::CallbackInfo& info);
    Napi::Value Encode(const Napi::CallbackInfo& info);
    Napi::Value Flush(const Napi::CallbackInfo& info);
    Napi::Value Reset(const Napi::CallbackInfo& info);
    void Close(const Napi::CallbackInfo& info);
    Napi::Value GetState(const Napi::CallbackInfo& info);
    Napi::Value GetEncodeQueueSize(const Napi::CallbackInfo& info);

    // Internal helpers
    void Cleanup();
    void EmitChunks(Napi::Env env);

    // FFmpeg state
    const AVCodec* codec_;
    AVCodecContext* codecContext_;
    SwsContext* swsContext_;
    AVFrame* frame_;
    AVPacket* packet_;

    // Callbacks
    Napi::FunctionReference outputCallback_;
    Napi::FunctionReference errorCallback_;

    // State
    std::string state_;
    int width_;
    int height_;
    int64_t frameCount_;
    int encodeQueueSize_;
};

#endif  // NODE_WEBCODECS_SRC_VIDEO_ENCODER_H_
