// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#ifndef SRC_WARNINGS_H_
#define SRC_WARNINGS_H_

#include <mutex>
#include <queue>
#include <string>
#include <vector>

#include <napi.h>

namespace webcodecs {

class WarningAccumulator : public Napi::ObjectWrap<WarningAccumulator> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  explicit WarningAccumulator(const Napi::CallbackInfo& info);

  // Thread-safe methods
  void AddWarning(const std::string& warning);
  std::vector<std::string> DrainWarnings();
  bool HasWarnings() const;
  size_t Count() const;

 private:
  // JS-exposed methods
  void Add(const Napi::CallbackInfo& info);
  Napi::Value Drain(const Napi::CallbackInfo& info);
  Napi::Value HasWarningsJS(const Napi::CallbackInfo& info);
  Napi::Value CountJS(const Napi::CallbackInfo& info);

  std::queue<std::string> warnings_;
  mutable std::mutex mutex_;
};

// Global warning accumulator for FFmpeg messages
extern WarningAccumulator* globalWarnings;

}  // namespace webcodecs

#endif  // SRC_WARNINGS_H_
