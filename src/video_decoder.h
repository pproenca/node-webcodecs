// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// VideoDecoder implementation wrapping FFmpeg decoders.

#ifndef NODE_WEBCODECS_SRC_VIDEO_DECODER_H_
#define NODE_WEBCODECS_SRC_VIDEO_DECODER_H_

#include <napi.h>
#include <string>

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavutil/imgutils.h>
#include <libswscale/swscale.h>
}

class VideoDecoder : public Napi::ObjectWrap<VideoDecoder> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    VideoDecoder(const Napi::CallbackInfo& info);
    ~VideoDecoder();

private:
    // WebCodecs API methods
    Napi::Value Configure(const Napi::CallbackInfo& info);
    Napi::Value Decode(const Napi::CallbackInfo& info);
    Napi::Value Flush(const Napi::CallbackInfo& info);
    Napi::Value Reset(const Napi::CallbackInfo& info);
    void Close(const Napi::CallbackInfo& info);
    Napi::Value GetState(const Napi::CallbackInfo& info);
    Napi::Value GetDecodeQueueSize(const Napi::CallbackInfo& info);

    // Static methods
    static Napi::Value IsConfigSupported(const Napi::CallbackInfo& info);

    // Internal helpers
    void Cleanup();
    void EmitFrames(Napi::Env env);

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
    int codedWidth_;
    int codedHeight_;
};

#endif
