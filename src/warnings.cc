// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#include "src/warnings.h"

#include <string>
#include <vector>

namespace webcodecs {

WarningAccumulator* globalWarnings = nullptr;

Napi::Object WarningAccumulator::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func = DefineClass(
      env, "WarningAccumulator",
      {
          InstanceMethod("add", &WarningAccumulator::Add),
          InstanceMethod("drain", &WarningAccumulator::Drain),
          InstanceMethod("hasWarnings", &WarningAccumulator::HasWarningsJS),
          InstanceMethod("count", &WarningAccumulator::CountJS),
      });

  Napi::FunctionReference* constructor = new Napi::FunctionReference();
  *constructor = Napi::Persistent(func);
  env.SetInstanceData(constructor);

  exports.Set("WarningAccumulator", func);
  return exports;
}

WarningAccumulator::WarningAccumulator(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<WarningAccumulator>(info) {}

void WarningAccumulator::AddWarning(const std::string& warning) {
  std::lock_guard<std::mutex> lock(mutex_);
  warnings_.push(warning);
}

std::vector<std::string> WarningAccumulator::DrainWarnings() {
  std::lock_guard<std::mutex> lock(mutex_);
  std::vector<std::string> result;
  while (!warnings_.empty()) {
    result.push_back(warnings_.front());
    warnings_.pop();
  }
  return result;
}

bool WarningAccumulator::HasWarnings() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return !warnings_.empty();
}

size_t WarningAccumulator::Count() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return warnings_.size();
}

void WarningAccumulator::Add(const Napi::CallbackInfo& info) {
  if (info.Length() < 1 || !info[0].IsString()) {
    Napi::TypeError::New(info.Env(), "Expected string argument")
        .ThrowAsJavaScriptException();
    return;
  }
  AddWarning(info[0].As<Napi::String>().Utf8Value());
}

Napi::Value WarningAccumulator::Drain(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  auto warnings = DrainWarnings();

  Napi::Array result = Napi::Array::New(env, warnings.size());
  for (size_t i = 0; i < warnings.size(); ++i) {
    result.Set(i, Napi::String::New(env, warnings[i]));
  }
  return result;
}

Napi::Value WarningAccumulator::HasWarningsJS(const Napi::CallbackInfo& info) {
  return Napi::Boolean::New(info.Env(), HasWarnings());
}

Napi::Value WarningAccumulator::CountJS(const Napi::CallbackInfo& info) {
  return Napi::Number::New(info.Env(), static_cast<double>(Count()));
}

}  // namespace webcodecs
