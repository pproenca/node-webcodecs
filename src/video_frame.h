// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// VideoFrame represents a single frame of video data.

#ifndef NODE_WEBCODECS_SRC_VIDEO_FRAME_H_
#define NODE_WEBCODECS_SRC_VIDEO_FRAME_H_

#include <napi.h>

#include <cstdint>
#include <string>
#include <vector>

class VideoFrame : public Napi::ObjectWrap<VideoFrame> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    static Napi::Object CreateInstance(Napi::Env env,
                                       const uint8_t* data,
                                       size_t dataSize,
                                       int width,
                                       int height,
                                       int64_t timestamp,
                                       const std::string& format);
    VideoFrame(const Napi::CallbackInfo& info);
    ~VideoFrame();

    // Getters
    Napi::Value GetCodedWidth(const Napi::CallbackInfo& info);
    Napi::Value GetCodedHeight(const Napi::CallbackInfo& info);
    Napi::Value GetTimestamp(const Napi::CallbackInfo& info);
    Napi::Value GetFormat(const Napi::CallbackInfo& info);

    // Methods
    void Close(const Napi::CallbackInfo& info);
    Napi::Value GetDataBuffer(const Napi::CallbackInfo& info);
    Napi::Value Clone(const Napi::CallbackInfo& info);

    // Static constructor reference for clone()
    static Napi::FunctionReference constructor;

    // Internal accessors for VideoEncoder
    uint8_t* GetData() { return data_.data(); }
    size_t GetDataSize() { return data_.size(); }
    int GetWidth() { return codedWidth_; }
    int GetHeight() { return codedHeight_; }
    int64_t GetTimestampValue() { return timestamp_; }

private:
    std::vector<uint8_t> data_;
    int codedWidth_;
    int codedHeight_;
    int64_t timestamp_;
    std::string format_;
    bool closed_;
};

#endif  // NODE_WEBCODECS_SRC_VIDEO_FRAME_H_
