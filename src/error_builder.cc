// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#include "src/error_builder.h"
#include "src/common.h"

namespace webcodecs {

Napi::Object ErrorBuilder::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func = DefineClass(env, "ErrorBuilder", {
    InstanceMethod("withFFmpegCode", &ErrorBuilder::WithFFmpegCodeJS),
    InstanceMethod("withContext", &ErrorBuilder::WithContextJS),
    InstanceMethod("withValue", &ErrorBuilder::WithValueJS),
    InstanceMethod("build", &ErrorBuilder::BuildJS),
    InstanceMethod("throwError", &ErrorBuilder::ThrowErrorJS),
  });

  Napi::FunctionReference* constructor = new Napi::FunctionReference();
  *constructor = Napi::Persistent(func);
  env.SetInstanceData(constructor);

  exports.Set("ErrorBuilder", func);
  return exports;
}

ErrorBuilder::ErrorBuilder(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<ErrorBuilder>(info) {
  if (info.Length() > 0 && info[0].IsString()) {
    operation_ = info[0].As<Napi::String>().Utf8Value();
  }
}

ErrorBuilder& ErrorBuilder::WithFFmpegCode(int errnum) {
  ffmpeg_code_ = errnum;
  return *this;
}

ErrorBuilder& ErrorBuilder::WithContext(const std::string& context) {
  context_.push_back(context);
  return *this;
}

ErrorBuilder& ErrorBuilder::WithValue(const std::string& name, int64_t value) {
  values_.emplace_back(name, std::to_string(value));
  return *this;
}

ErrorBuilder& ErrorBuilder::WithValue(const std::string& name,
                                       const std::string& value) {
  values_.emplace_back(name, value);
  return *this;
}

std::string ErrorBuilder::Build() const {
  std::string msg = operation_;

  if (ffmpeg_code_ != 0) {
    msg += ": " + FFmpegErrorString(ffmpeg_code_);
  }

  if (!context_.empty() || !values_.empty()) {
    msg += " (";
    bool first = true;

    for (const auto& ctx : context_) {
      if (!first) msg += ", ";
      msg += ctx;
      first = false;
    }

    for (const auto& [name, value] : values_) {
      if (!first) msg += ", ";
      msg += name + "=" + value;
      first = false;
    }

    msg += ")";
  }

  return msg;
}

Napi::Error ErrorBuilder::BuildNapi(Napi::Env env) const {
  return Napi::Error::New(env, Build());
}

Napi::Value ErrorBuilder::WithFFmpegCodeJS(const Napi::CallbackInfo& info) {
  if (info.Length() > 0 && info[0].IsNumber()) {
    WithFFmpegCode(info[0].As<Napi::Number>().Int32Value());
  }
  return info.This();
}

Napi::Value ErrorBuilder::WithContextJS(const Napi::CallbackInfo& info) {
  if (info.Length() > 0 && info[0].IsString()) {
    WithContext(info[0].As<Napi::String>().Utf8Value());
  }
  return info.This();
}

Napi::Value ErrorBuilder::WithValueJS(const Napi::CallbackInfo& info) {
  if (info.Length() >= 2 && info[0].IsString()) {
    std::string name = info[0].As<Napi::String>().Utf8Value();
    if (info[1].IsNumber()) {
      WithValue(name, info[1].As<Napi::Number>().Int64Value());
    } else if (info[1].IsString()) {
      WithValue(name, info[1].As<Napi::String>().Utf8Value());
    }
  }
  return info.This();
}

Napi::Value ErrorBuilder::BuildJS(const Napi::CallbackInfo& info) {
  return Napi::String::New(info.Env(), Build());
}

void ErrorBuilder::ThrowErrorJS(const Napi::CallbackInfo& info) {
  BuildNapi(info.Env()).ThrowAsJavaScriptException();
}

}  // namespace webcodecs
