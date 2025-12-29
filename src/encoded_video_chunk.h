// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// EncodedVideoChunk represents an encoded video frame.

#ifndef NODE_WEBCODECS_SRC_ENCODED_VIDEO_CHUNK_H_
#define NODE_WEBCODECS_SRC_ENCODED_VIDEO_CHUNK_H_

#include <napi.h>

#include <cstdint>
#include <string>
#include <vector>

class EncodedVideoChunk : public Napi::ObjectWrap<EncodedVideoChunk> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    static Napi::Object CreateInstance(Napi::Env env,
                                       const std::string& type,
                                       int64_t timestamp,
                                       int64_t duration,
                                       const uint8_t* data,
                                       size_t size);
    EncodedVideoChunk(const Napi::CallbackInfo& info);

    // Property getters
    Napi::Value GetType(const Napi::CallbackInfo& info);
    Napi::Value GetTimestamp(const Napi::CallbackInfo& info);
    Napi::Value GetDuration(const Napi::CallbackInfo& info);
    Napi::Value GetByteLength(const Napi::CallbackInfo& info);

    // Methods
    void CopyTo(const Napi::CallbackInfo& info);
    void Close(const Napi::CallbackInfo& info);

    // Internal accessors for VideoDecoder
    const uint8_t* GetData() const { return data_.data(); }
    size_t GetDataSize() const { return data_.size(); }
    int64_t GetTimestampValue() const { return timestamp_; }
    const std::string& GetTypeValue() const { return type_; }

private:
    static Napi::FunctionReference constructor;
    std::string type_;
    int64_t timestamp_;
    bool hasDuration_;
    int64_t duration_;
    std::vector<uint8_t> data_;
    bool closed_;
};

#endif  // NODE_WEBCODECS_SRC_ENCODED_VIDEO_CHUNK_H_
