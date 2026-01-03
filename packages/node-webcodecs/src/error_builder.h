// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#ifndef PACKAGES_NODE_WEBCODECS_SRC_ERROR_BUILDER_H_
#define PACKAGES_NODE_WEBCODECS_SRC_ERROR_BUILDER_H_

#include <napi.h>

#include <string>
#include <utility>
#include <vector>

namespace webcodecs {

class ErrorBuilder : public Napi::ObjectWrap<ErrorBuilder> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  explicit ErrorBuilder(const Napi::CallbackInfo& info);

  // Fluent API for C++ usage
  ErrorBuilder& WithFFmpegCode(int errnum);
  ErrorBuilder& WithContext(const std::string& context);
  ErrorBuilder& WithValue(const std::string& name, int64_t value);
  ErrorBuilder& WithValue(const std::string& name, const std::string& value);

  std::string Build() const;
  Napi::Error BuildNapi(Napi::Env env) const;

 private:
  // JS-exposed methods
  Napi::Value WithFFmpegCodeJS(const Napi::CallbackInfo& info);
  Napi::Value WithContextJS(const Napi::CallbackInfo& info);
  Napi::Value WithValueJS(const Napi::CallbackInfo& info);
  Napi::Value BuildJS(const Napi::CallbackInfo& info);
  void ThrowErrorJS(const Napi::CallbackInfo& info);

  std::string operation_;
  int ffmpeg_code_ = 0;
  std::vector<std::string> context_;
  std::vector<std::pair<std::string, std::string>> values_;
};

}  // namespace webcodecs

#endif  // PACKAGES_NODE_WEBCODECS_SRC_ERROR_BUILDER_H_
