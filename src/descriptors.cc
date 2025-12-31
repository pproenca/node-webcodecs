// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#include "src/descriptors.h"
#include "src/common.h"

namespace webcodecs {

VideoEncoderConfigDescriptor CreateEncoderConfigDescriptor(
    Napi::Env env, Napi::Object config) {
  VideoEncoderConfigDescriptor desc;

  desc.codec = AttrAsStr(config, "codec");
  desc.width = AttrAsUint32(config, "width");
  desc.height = AttrAsUint32(config, "height");

  // Display dimensions default to coded dimensions
  desc.displayWidth = AttrAsUint32(config, "displayWidth");
  if (desc.displayWidth == 0) desc.displayWidth = desc.width;

  desc.displayHeight = AttrAsUint32(config, "displayHeight");
  if (desc.displayHeight == 0) desc.displayHeight = desc.height;

  desc.bitrate = AttrAsInt64(config, "bitrate", 0);
  desc.framerate = AttrAsDouble(config, "framerate", 0.0);
  desc.latencyMode = AttrAsStr(config, "latencyMode", "quality");
  desc.bitrateMode = AttrAsStr(config, "bitrateMode", "variable");
  desc.scalabilityMode = AttrAsStr(config, "scalabilityMode", "");
  desc.hardwareAcceleration = AttrAsStr(config, "hardwareAcceleration",
                                         "no-preference");
  desc.avc = AttrAsStr(config, "avc", "avc");
  desc.hevc = AttrAsStr(config, "hevc", "hevc");

  // Color space from nested object
  if (HasAttr(config, "colorSpace")) {
    Napi::Object cs = config.Get("colorSpace").As<Napi::Object>();
    desc.colorPrimaries = AttrAsStr(cs, "primaries", "");
    desc.colorTransfer = AttrAsStr(cs, "transfer", "");
    desc.colorMatrix = AttrAsStr(cs, "matrix", "");
    desc.colorFullRange = AttrAsBool(cs, "fullRange", false);
  }

  return desc;
}

Napi::Object EncoderConfigToJS(Napi::Env env,
                                const VideoEncoderConfigDescriptor& desc) {
  Napi::Object obj = Napi::Object::New(env);

  obj.Set("codec", desc.codec);
  obj.Set("width", desc.width);
  obj.Set("height", desc.height);
  obj.Set("displayWidth", desc.displayWidth);
  obj.Set("displayHeight", desc.displayHeight);
  obj.Set("bitrate", static_cast<double>(desc.bitrate));
  obj.Set("framerate", desc.framerate);
  obj.Set("latencyMode", desc.latencyMode);
  obj.Set("bitrateMode", desc.bitrateMode);
  obj.Set("scalabilityMode", desc.scalabilityMode);
  obj.Set("hardwareAcceleration", desc.hardwareAcceleration);
  obj.Set("avc", desc.avc);
  obj.Set("hevc", desc.hevc);
  obj.Set("colorPrimaries", desc.colorPrimaries);
  obj.Set("colorTransfer", desc.colorTransfer);
  obj.Set("colorMatrix", desc.colorMatrix);
  obj.Set("colorFullRange", desc.colorFullRange);

  return obj;
}

Napi::Value CreateEncoderConfigDescriptorJS(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsObject()) {
    Napi::TypeError::New(env, "Expected config object")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  auto desc = CreateEncoderConfigDescriptor(env, info[0].As<Napi::Object>());
  return EncoderConfigToJS(env, desc);
}

void InitDescriptors(Napi::Env env, Napi::Object exports) {
  exports.Set("createEncoderConfigDescriptor",
              Napi::Function::New(env, CreateEncoderConfigDescriptorJS));
}

}  // namespace webcodecs
