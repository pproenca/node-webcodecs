// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#ifndef SRC_TEST_VIDEO_GENERATOR_H_
#define SRC_TEST_VIDEO_GENERATOR_H_

#include <napi.h>

extern "C" {
#include <libavfilter/avfilter.h>
#include <libavfilter/buffersink.h>
#include <libavfilter/buffersrc.h>
#include <libavutil/frame.h>
#include <libswscale/swscale.h>
}

#include <string>

#include "src/ffmpeg_raii.h"

class TestVideoGenerator : public Napi::ObjectWrap<TestVideoGenerator> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  explicit TestVideoGenerator(const Napi::CallbackInfo& info);
  ~TestVideoGenerator();

 private:
  Napi::Value Configure(const Napi::CallbackInfo& info);
  Napi::Value Generate(const Napi::CallbackInfo& info);
  Napi::Value Close(const Napi::CallbackInfo& info);
  Napi::Value GetState(const Napi::CallbackInfo& info);

  void Cleanup();
  bool InitFilterGraph();

  ffmpeg::AVFilterGraphPtr filter_graph_;
  AVFilterContext* buffersink_ctx_;
  ffmpeg::SwsContextPtr sws_yuv_to_rgba_;
  ffmpeg::AVFramePtr output_frame_;

  int width_;
  int height_;
  int frame_rate_;
  int duration_;
  std::string pattern_;
  std::string state_;
};

Napi::Object InitTestVideoGenerator(Napi::Env env, Napi::Object exports);

#endif  // SRC_TEST_VIDEO_GENERATOR_H_
