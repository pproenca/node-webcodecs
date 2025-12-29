#include "encoded_video_chunk.h"
#include <cstring>

Napi::FunctionReference EncodedVideoChunk::constructor;

Napi::Object InitEncodedVideoChunk(Napi::Env env, Napi::Object exports) {
    return EncodedVideoChunk::Init(env, exports);
}

Napi::Object EncodedVideoChunk::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "EncodedVideoChunk", {
        InstanceAccessor("type", &EncodedVideoChunk::GetType, nullptr),
        InstanceAccessor("timestamp", &EncodedVideoChunk::GetTimestamp, nullptr),
        InstanceAccessor("duration", &EncodedVideoChunk::GetDuration, nullptr),
        InstanceAccessor("byteLength", &EncodedVideoChunk::GetByteLength, nullptr),
        InstanceMethod("copyTo", &EncodedVideoChunk::CopyTo),
        InstanceMethod("close", &EncodedVideoChunk::Close),
    });

    constructor = Napi::Persistent(func);
    constructor.SuppressDestruct();

    exports.Set("EncodedVideoChunk", func);
    return exports;
}

Napi::Object EncodedVideoChunk::CreateInstance(Napi::Env env,
                                                const std::string& type,
                                                int64_t timestamp,
                                                int64_t duration,
                                                const uint8_t* data,
                                                size_t size) {
    Napi::Object init = Napi::Object::New(env);
    init.Set("type", type);
    init.Set("timestamp", Napi::Number::New(env, timestamp));
    init.Set("duration", Napi::Number::New(env, duration));
    init.Set("data", Napi::Buffer<uint8_t>::Copy(env, data, size));
    return constructor.New({ init });
}

EncodedVideoChunk::EncodedVideoChunk(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<EncodedVideoChunk>(info), hasDuration_(false), duration_(0), closed_(false) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsObject()) {
        throw Napi::TypeError::New(env, "EncodedVideoChunk requires init object");
    }

    Napi::Object init = info[0].As<Napi::Object>();

    // Required: type
    if (!init.Has("type") || !init.Get("type").IsString()) {
        throw Napi::TypeError::New(env, "init.type must be 'key' or 'delta'");
    }
    type_ = init.Get("type").As<Napi::String>().Utf8Value();
    if (type_ != "key" && type_ != "delta") {
        throw Napi::TypeError::New(env, "init.type must be 'key' or 'delta'");
    }

    // Required: timestamp
    if (!init.Has("timestamp") || !init.Get("timestamp").IsNumber()) {
        throw Napi::TypeError::New(env, "init.timestamp must be a number");
    }
    timestamp_ = init.Get("timestamp").As<Napi::Number>().Int64Value();

    // Optional: duration
    if (init.Has("duration") && init.Get("duration").IsNumber()) {
        duration_ = init.Get("duration").As<Napi::Number>().Int64Value();
        hasDuration_ = true;
    }

    // Required: data
    if (!init.Has("data")) {
        throw Napi::TypeError::New(env, "init.data is required");
    }

    Napi::Value dataVal = init.Get("data");
    if (dataVal.IsBuffer()) {
        Napi::Buffer<uint8_t> buf = dataVal.As<Napi::Buffer<uint8_t>>();
        data_.assign(buf.Data(), buf.Data() + buf.Length());
    } else if (dataVal.IsArrayBuffer()) {
        Napi::ArrayBuffer ab = dataVal.As<Napi::ArrayBuffer>();
        data_.assign(static_cast<uint8_t*>(ab.Data()),
                     static_cast<uint8_t*>(ab.Data()) + ab.ByteLength());
    } else if (dataVal.IsTypedArray()) {
        Napi::TypedArray ta = dataVal.As<Napi::TypedArray>();
        Napi::ArrayBuffer ab = ta.ArrayBuffer();
        size_t offset = ta.ByteOffset();
        size_t length = ta.ByteLength();
        data_.assign(static_cast<uint8_t*>(ab.Data()) + offset,
                     static_cast<uint8_t*>(ab.Data()) + offset + length);
    } else {
        throw Napi::TypeError::New(env, "init.data must be BufferSource");
    }
}

Napi::Value EncodedVideoChunk::GetType(const Napi::CallbackInfo& info) {
    return Napi::String::New(info.Env(), type_);
}

Napi::Value EncodedVideoChunk::GetTimestamp(const Napi::CallbackInfo& info) {
    return Napi::Number::New(info.Env(), timestamp_);
}

Napi::Value EncodedVideoChunk::GetDuration(const Napi::CallbackInfo& info) {
    if (!hasDuration_) {
        return info.Env().Null();
    }
    return Napi::Number::New(info.Env(), duration_);
}

Napi::Value EncodedVideoChunk::GetByteLength(const Napi::CallbackInfo& info) {
    return Napi::Number::New(info.Env(), static_cast<double>(data_.size()));
}

void EncodedVideoChunk::CopyTo(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1) {
        throw Napi::TypeError::New(env, "copyTo requires destination buffer");
    }

    Napi::Value destVal = info[0];
    uint8_t* destData = nullptr;
    size_t destSize = 0;

    if (destVal.IsBuffer()) {
        Napi::Buffer<uint8_t> buf = destVal.As<Napi::Buffer<uint8_t>>();
        destData = buf.Data();
        destSize = buf.Length();
    } else if (destVal.IsArrayBuffer()) {
        Napi::ArrayBuffer ab = destVal.As<Napi::ArrayBuffer>();
        destData = static_cast<uint8_t*>(ab.Data());
        destSize = ab.ByteLength();
    } else if (destVal.IsTypedArray()) {
        Napi::TypedArray ta = destVal.As<Napi::TypedArray>();
        Napi::ArrayBuffer ab = ta.ArrayBuffer();
        destData = static_cast<uint8_t*>(ab.Data()) + ta.ByteOffset();
        destSize = ta.ByteLength();
    } else {
        throw Napi::TypeError::New(env, "destination must be BufferSource");
    }

    if (destSize < data_.size()) {
        throw Napi::TypeError::New(env, "destination buffer too small");
    }

    std::memcpy(destData, data_.data(), data_.size());
}

void EncodedVideoChunk::Close(const Napi::CallbackInfo& info) {
    if (!closed_) {
        data_.clear();
        closed_ = true;
    }
}
