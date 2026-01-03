// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// VideoFilter implementation wrapping FFmpeg libavfilter for blur effects.

#ifndef PACKAGES_NODE_WEBCODECS_SRC_VIDEO_FILTER_H_
#define PACKAGES_NODE_WEBCODECS_SRC_VIDEO_FILTER_H_

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavfilter/avfilter.h>
#include <libavfilter/buffersink.h>
#include <libavfilter/buffersrc.h>
#include <libavutil/imgutils.h>
#include <libavutil/opt.h>
#include <libswscale/swscale.h>
}

#include <napi.h>

#include <string>
#include <vector>

#include "src/ffmpeg_raii.h"

class VideoFilter : public Napi::ObjectWrap<VideoFilter> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  explicit VideoFilter(const Napi::CallbackInfo& info);
  ~VideoFilter();

  // Disallow copy and assign.
  VideoFilter(const VideoFilter&) = delete;
  VideoFilter& operator=(const VideoFilter&) = delete;

 private:
  // WebCodecs-style API methods.
  Napi::Value Configure(const Napi::CallbackInfo& info);
  Napi::Value ApplyBlur(const Napi::CallbackInfo& info);
  void Close(const Napi::CallbackInfo& info);
  Napi::Value GetState(const Napi::CallbackInfo& info);

  // Internal helpers.
  void Cleanup();
  AVFrame* ProcessFrame(AVFrame* input);
  std::string BuildFilterString(
      const std::vector<std::tuple<int, int, int, int>>& regions,
      int blur_strength);

  // FFmpeg filter state.
  ffmpeg::AVFilterGraphPtr filter_graph_;
  AVFilterContext* buffersrc_ctx_;   // Not owned - owned by filter_graph_
  AVFilterContext* buffersink_ctx_;  // Not owned - owned by filter_graph_
  ffmpeg::SwsContextPtr sws_rgba_to_yuv_;
  ffmpeg::SwsContextPtr sws_yuv_to_rgba_;
  ffmpeg::AVFramePtr yuv_frame_;
  ffmpeg::AVFramePtr output_frame_;

  // Configuration.
  int width_;
  int height_;
  std::string state_;
};

#endif  // PACKAGES_NODE_WEBCODECS_SRC_VIDEO_FILTER_H_
