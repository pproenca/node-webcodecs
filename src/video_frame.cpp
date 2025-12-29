#include "video_frame.h"

Napi::Object InitVideoFrame(Napi::Env env, Napi::Object exports) {
    return VideoFrame::Init(env, exports);
}

Napi::Object VideoFrame::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "VideoFrame", {
        InstanceAccessor("codedWidth", &VideoFrame::GetCodedWidth, nullptr),
        InstanceAccessor("codedHeight", &VideoFrame::GetCodedHeight, nullptr),
        InstanceAccessor("timestamp", &VideoFrame::GetTimestamp, nullptr),
        InstanceAccessor("format", &VideoFrame::GetFormat, nullptr),
        InstanceMethod("close", &VideoFrame::Close),
        InstanceMethod("getData", &VideoFrame::GetDataBuffer),
    });

    Napi::FunctionReference* constructor = new Napi::FunctionReference();
    *constructor = Napi::Persistent(func);
    env.SetInstanceData(constructor);

    exports.Set("VideoFrame", func);
    return exports;
}

VideoFrame::VideoFrame(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<VideoFrame>(info), closed_(false) {
    Napi::Env env = info.Env();

    if (info.Length() < 2) {
        throw Napi::Error::New(env, "VideoFrame requires buffer and options");
    }

    // Get buffer data
    Napi::Buffer<uint8_t> buffer = info[0].As<Napi::Buffer<uint8_t>>();
    data_.assign(buffer.Data(), buffer.Data() + buffer.Length());

    // Get options
    Napi::Object opts = info[1].As<Napi::Object>();
    codedWidth_ = opts.Get("codedWidth").As<Napi::Number>().Int32Value();
    codedHeight_ = opts.Get("codedHeight").As<Napi::Number>().Int32Value();
    timestamp_ = opts.Get("timestamp").As<Napi::Number>().Int64Value();

    if (opts.Has("format")) {
        format_ = opts.Get("format").As<Napi::String>().Utf8Value();
    } else {
        format_ = "RGBA";
    }
}

VideoFrame::~VideoFrame() {
    data_.clear();
}

Napi::Value VideoFrame::GetCodedWidth(const Napi::CallbackInfo& info) {
    if (closed_) {
        throw Napi::Error::New(info.Env(), "VideoFrame is closed");
    }
    return Napi::Number::New(info.Env(), codedWidth_);
}

Napi::Value VideoFrame::GetCodedHeight(const Napi::CallbackInfo& info) {
    if (closed_) {
        throw Napi::Error::New(info.Env(), "VideoFrame is closed");
    }
    return Napi::Number::New(info.Env(), codedHeight_);
}

Napi::Value VideoFrame::GetTimestamp(const Napi::CallbackInfo& info) {
    if (closed_) {
        throw Napi::Error::New(info.Env(), "VideoFrame is closed");
    }
    return Napi::Number::New(info.Env(), timestamp_);
}

Napi::Value VideoFrame::GetFormat(const Napi::CallbackInfo& info) {
    if (closed_) {
        throw Napi::Error::New(info.Env(), "VideoFrame is closed");
    }
    return Napi::String::New(info.Env(), format_);
}

void VideoFrame::Close(const Napi::CallbackInfo& info) {
    if (!closed_) {
        data_.clear();
        closed_ = true;
    }
}

Napi::Value VideoFrame::GetDataBuffer(const Napi::CallbackInfo& info) {
    if (closed_) {
        throw Napi::Error::New(info.Env(), "VideoFrame is closed");
    }
    return Napi::Buffer<uint8_t>::Copy(info.Env(), data_.data(), data_.size());
}
