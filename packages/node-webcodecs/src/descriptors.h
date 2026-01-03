// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#ifndef PACKAGES_NODE_WEBCODECS_SRC_DESCRIPTORS_H_
#define PACKAGES_NODE_WEBCODECS_SRC_DESCRIPTORS_H_

#include <napi.h>

#include <cstdint>
#include <string>

namespace webcodecs {

struct VideoEncoderConfigDescriptor {
  std::string codec = "";
  uint32_t width = 0;
  uint32_t height = 0;
  uint32_t displayWidth = 0;
  uint32_t displayHeight = 0;
  int64_t bitrate = 0;
  double framerate = 0.0;
  std::string latencyMode = "quality";
  std::string bitrateMode = "variable";
  std::string scalabilityMode = "";
  std::string hardwareAcceleration = "no-preference";
  std::string avc = "avc";
  std::string hevc = "hevc";

  // Color space
  std::string colorPrimaries = "";
  std::string colorTransfer = "";
  std::string colorMatrix = "";
  bool colorFullRange = false;

  VideoEncoderConfigDescriptor() = default;
};

VideoEncoderConfigDescriptor CreateEncoderConfigDescriptor(Napi::Env env,
                                                           Napi::Object config);

Napi::Object EncoderConfigToJS(Napi::Env env,
                               const VideoEncoderConfigDescriptor& desc);

void InitDescriptors(Napi::Env env, Napi::Object exports);

}  // namespace webcodecs

#endif  // PACKAGES_NODE_WEBCODECS_SRC_DESCRIPTORS_H_
