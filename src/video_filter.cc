// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#include "src/video_filter.h"

#include <cstdio>
#include <cstring>
#include <string>
#include <vector>

Napi::FunctionReference video_filter_constructor;

Napi::Object InitVideoFilter(Napi::Env env, Napi::Object exports) {
  return VideoFilter::Init(env, exports);
}

Napi::Object VideoFilter::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func = DefineClass(
      env, "VideoFilter",
      {
          InstanceAccessor("state", &VideoFilter::GetState, nullptr),
          InstanceMethod("configure", &VideoFilter::Configure),
          InstanceMethod("applyBlur", &VideoFilter::ApplyBlur),
          InstanceMethod("close", &VideoFilter::Close),
      });

  video_filter_constructor = Napi::Persistent(func);
  video_filter_constructor.SuppressDestruct();

  exports.Set("VideoFilter", func);
  return exports;
}

VideoFilter::VideoFilter(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<VideoFilter>(info),
      filter_graph_(nullptr),
      buffersrc_ctx_(nullptr),
      buffersink_ctx_(nullptr),
      sws_rgba_to_yuv_(nullptr),
      sws_yuv_to_rgba_(nullptr),
      yuv_frame_(nullptr),
      output_frame_(nullptr),
      width_(0),
      height_(0),
      state_("unconfigured") {}

VideoFilter::~VideoFilter() { Cleanup(); }

void VideoFilter::Cleanup() {
  if (filter_graph_) {
    avfilter_graph_free(&filter_graph_);
    filter_graph_ = nullptr;
    buffersrc_ctx_ = nullptr;
    buffersink_ctx_ = nullptr;
  }

  if (sws_rgba_to_yuv_) {
    sws_freeContext(sws_rgba_to_yuv_);
    sws_rgba_to_yuv_ = nullptr;
  }

  if (sws_yuv_to_rgba_) {
    sws_freeContext(sws_yuv_to_rgba_);
    sws_yuv_to_rgba_ = nullptr;
  }

  if (yuv_frame_) {
    av_frame_free(&yuv_frame_);
    yuv_frame_ = nullptr;
  }

  if (output_frame_) {
    av_frame_free(&output_frame_);
    output_frame_ = nullptr;
  }
}

Napi::Value VideoFilter::GetState(const Napi::CallbackInfo& info) {
  return Napi::String::New(info.Env(), state_);
}

Napi::Value VideoFilter::Configure(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (state_ == "closed") {
    Napi::Error::New(env, "VideoFilter is closed").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  if (info.Length() < 1 || !info[0].IsObject()) {
    Napi::TypeError::New(env, "Config object required")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  Napi::Object config = info[0].As<Napi::Object>();
  width_ = config.Get("width").As<Napi::Number>().Int32Value();
  height_ = config.Get("height").As<Napi::Number>().Int32Value();

  if (width_ <= 0 || height_ <= 0) {
    Napi::Error::New(env, "Invalid dimensions").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Allocate YUV frame.
  yuv_frame_ = av_frame_alloc();
  if (!yuv_frame_) {
    Napi::Error::New(env, "Failed to allocate yuv_frame")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }
  yuv_frame_->width = width_;
  yuv_frame_->height = height_;
  yuv_frame_->format = AV_PIX_FMT_YUV420P;
  av_frame_get_buffer(yuv_frame_, 0);

  // Create SWS contexts for color conversion.
  sws_rgba_to_yuv_ = sws_getContext(width_, height_, AV_PIX_FMT_RGBA, width_,
                                    height_, AV_PIX_FMT_YUV420P, SWS_BILINEAR,
                                    nullptr, nullptr, nullptr);
  sws_yuv_to_rgba_ = sws_getContext(width_, height_, AV_PIX_FMT_YUV420P, width_,
                                    height_, AV_PIX_FMT_RGBA, SWS_BILINEAR,
                                    nullptr, nullptr, nullptr);

  if (!sws_rgba_to_yuv_ || !sws_yuv_to_rgba_) {
    Cleanup();
    Napi::Error::New(env, "Failed to create sws contexts")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  state_ = "configured";
  return env.Undefined();
}

bool VideoFilter::InitFilterGraph(int blur_strength) {
  // Allocate filter graph.
  filter_graph_ = avfilter_graph_alloc();
  if (!filter_graph_) {
    return false;
  }

  const AVFilter* buffersrc = avfilter_get_by_name("buffer");
  const AVFilter* buffersink = avfilter_get_by_name("buffersink");
  const AVFilter* boxblur = avfilter_get_by_name("boxblur");

  if (!buffersrc || !buffersink || !boxblur) {
    avfilter_graph_free(&filter_graph_);
    filter_graph_ = nullptr;
    return false;
  }

  char args[512];
  snprintf(args, sizeof(args),
           "video_size=%dx%d:pix_fmt=%d:time_base=1/30:pixel_aspect=1/1",
           width_, height_, AV_PIX_FMT_YUV420P);

  int ret = avfilter_graph_create_filter(&buffersrc_ctx_, buffersrc, "in", args,
                                         nullptr, filter_graph_);
  if (ret < 0) {
    avfilter_graph_free(&filter_graph_);
    filter_graph_ = nullptr;
    return false;
  }

  ret = avfilter_graph_create_filter(&buffersink_ctx_, buffersink, "out",
                                     nullptr, nullptr, filter_graph_);
  if (ret < 0) {
    avfilter_graph_free(&filter_graph_);
    filter_graph_ = nullptr;
    return false;
  }

  // Create blur filter.
  AVFilterContext* blur_ctx;
  snprintf(args, sizeof(args), "luma_radius=%d:chroma_radius=%d",
           blur_strength, blur_strength);
  ret = avfilter_graph_create_filter(&blur_ctx, boxblur, "blur", args, nullptr,
                                     filter_graph_);
  if (ret < 0) {
    avfilter_graph_free(&filter_graph_);
    filter_graph_ = nullptr;
    return false;
  }

  // Link: src -> blur -> sink.
  ret = avfilter_link(buffersrc_ctx_, 0, blur_ctx, 0);
  if (ret < 0) {
    avfilter_graph_free(&filter_graph_);
    filter_graph_ = nullptr;
    return false;
  }

  ret = avfilter_link(blur_ctx, 0, buffersink_ctx_, 0);
  if (ret < 0) {
    avfilter_graph_free(&filter_graph_);
    filter_graph_ = nullptr;
    return false;
  }

  ret = avfilter_graph_config(filter_graph_, nullptr);
  if (ret < 0) {
    avfilter_graph_free(&filter_graph_);
    filter_graph_ = nullptr;
    return false;
  }

  return true;
}

std::string VideoFilter::BuildFilterString(
    const std::vector<std::tuple<int, int, int, int>>& regions,
    int blur_strength) {
  // For now, just use a simple full-frame blur.
  char args[64];
  snprintf(args, sizeof(args), "boxblur=%d:%d", blur_strength, blur_strength);
  return std::string(args);
}

AVFrame* VideoFilter::ProcessFrame(AVFrame* input) {
  // Add frame to filter graph.
  int ret = av_buffersrc_add_frame_flags(buffersrc_ctx_, input,
                                         AV_BUFFERSRC_FLAG_KEEP_REF);
  if (ret < 0) {
    return nullptr;
  }

  // Get filtered frame.
  AVFrame* filtered = av_frame_alloc();
  ret = av_buffersink_get_frame(buffersink_ctx_, filtered);
  if (ret < 0) {
    av_frame_free(&filtered);
    return nullptr;
  }

  return filtered;
}

Napi::Value VideoFilter::ApplyBlur(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (state_ != "configured") {
    Napi::Error::New(env, "VideoFilter is not configured")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  if (info.Length() < 2) {
    Napi::TypeError::New(env, "Frame and regions required")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Get frame data from VideoFrame object.
  Napi::Object frame_obj = info[0].As<Napi::Object>();
  Napi::Buffer<uint8_t> frame_data =
      frame_obj.Get("getData").As<Napi::Function>().Call(frame_obj, {})
          .As<Napi::Buffer<uint8_t>>();

  // Get blur strength (default 20).
  int blur_strength = 20;
  if (info.Length() > 2 && info[2].IsNumber()) {
    blur_strength = info[2].As<Napi::Number>().Int32Value();
  }

  // Initialize filter graph if needed.
  if (!filter_graph_) {
    if (!InitFilterGraph(blur_strength)) {
      Napi::Error::New(env, "Failed to initialize filter graph")
          .ThrowAsJavaScriptException();
      return env.Undefined();
    }
  }

  // Convert RGBA to YUV420P.
  const uint8_t* src_data[1] = {frame_data.Data()};
  int src_linesize[1] = {static_cast<int>(width_ * 4)};
  sws_scale(sws_rgba_to_yuv_, src_data, src_linesize, 0, height_,
            yuv_frame_->data, yuv_frame_->linesize);

  // Process through filter.
  AVFrame* filtered = ProcessFrame(yuv_frame_);
  if (!filtered) {
    Napi::Error::New(env, "Failed to process frame")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Convert back to RGBA.
  std::vector<uint8_t> rgba_out(width_ * height_ * 4);
  uint8_t* dst_data[1] = {rgba_out.data()};
  int dst_linesize[1] = {static_cast<int>(width_ * 4)};
  sws_scale(sws_yuv_to_rgba_, filtered->data, filtered->linesize, 0, height_,
            dst_data, dst_linesize);

  av_frame_free(&filtered);

  // Create new VideoFrame with filtered data.
  Napi::Object init = Napi::Object::New(env);
  init.Set("codedWidth", width_);
  init.Set("codedHeight", height_);
  init.Set("timestamp",
           frame_obj.Get("timestamp").As<Napi::Number>().Int64Value());
  init.Set("format", "RGBA");

  Napi::Buffer<uint8_t> out_buffer =
      Napi::Buffer<uint8_t>::Copy(env, rgba_out.data(), rgba_out.size());

  // Get VideoFrame constructor and create new instance.
  Napi::Function video_frame_ctor =
      env.Global().Get("VideoFrame").As<Napi::Function>();

  // Use raw native VideoFrame constructor.
  Napi::Object exports = env.Global().Get("require").As<Napi::Function>()
      .Call({Napi::String::New(env, "../build/Release/node_webcodecs.node")})
      .As<Napi::Object>();
  Napi::Function native_video_frame =
      exports.Get("VideoFrame").As<Napi::Function>();

  return native_video_frame.New({out_buffer, init});
}

void VideoFilter::Close(const Napi::CallbackInfo& info) {
  Cleanup();
  state_ = "closed";
}
