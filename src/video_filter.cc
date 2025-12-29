// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#include "video_filter.h"
#include "video_frame.h"

#include <sstream>

Napi::Object VideoFilter::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func = DefineClass(env, "VideoFilter", {
    InstanceMethod("configure", &VideoFilter::Configure),
    InstanceMethod("applyBlur", &VideoFilter::ApplyBlur),
    InstanceMethod("close", &VideoFilter::Close),
    InstanceAccessor("state", &VideoFilter::GetState, nullptr),
  });

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

VideoFilter::~VideoFilter() {
  Cleanup();
}

void VideoFilter::Cleanup() {
  if (filter_graph_) {
    avfilter_graph_free(&filter_graph_);
    filter_graph_ = nullptr;
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
  buffersrc_ctx_ = nullptr;
  buffersink_ctx_ = nullptr;
}

Napi::Value VideoFilter::GetState(const Napi::CallbackInfo& info) {
  return Napi::String::New(info.Env(), state_);
}

void VideoFilter::Close(const Napi::CallbackInfo& info) {
  Cleanup();
  state_ = "closed";
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

  if (!config.Has("width") || !config.Has("height")) {
    Napi::TypeError::New(env, "width and height required")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  width_ = config.Get("width").As<Napi::Number>().Int32Value();
  height_ = config.Get("height").As<Napi::Number>().Int32Value();

  if (width_ <= 0 || height_ <= 0) {
    Napi::RangeError::New(env, "width and height must be positive")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Initialize swscale contexts for RGBA <-> YUV420P conversion
  sws_rgba_to_yuv_ = sws_getContext(
      width_, height_, AV_PIX_FMT_RGBA,
      width_, height_, AV_PIX_FMT_YUV420P,
      SWS_BILINEAR, nullptr, nullptr, nullptr);

  sws_yuv_to_rgba_ = sws_getContext(
      width_, height_, AV_PIX_FMT_YUV420P,
      width_, height_, AV_PIX_FMT_RGBA,
      SWS_BILINEAR, nullptr, nullptr, nullptr);

  if (!sws_rgba_to_yuv_ || !sws_yuv_to_rgba_) {
    Cleanup();
    Napi::Error::New(env, "Failed to create swscale contexts")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Allocate YUV frame for filter input
  yuv_frame_ = av_frame_alloc();
  yuv_frame_->format = AV_PIX_FMT_YUV420P;
  yuv_frame_->width = width_;
  yuv_frame_->height = height_;
  av_frame_get_buffer(yuv_frame_, 0);

  // Allocate output frame
  output_frame_ = av_frame_alloc();

  state_ = "configured";
  return env.Undefined();
}

std::string VideoFilter::BuildFilterString(
    const std::vector<std::tuple<int, int, int, int>>& regions,
    int blur_strength) {
  // If no regions, return null filter (passthrough)
  if (regions.empty()) {
    return "null";
  }

  // Build filter: for each region, crop blurred area and overlay
  // Strategy: blur entire frame, then overlay original except for regions
  std::ostringstream oss;

  // boxblur uses radius:power format. strength 1-100 maps to radius 1-50
  int radius = std::max(1, blur_strength / 2);

  // Split input into original and blurred version
  oss << "[in]split=2[orig][toblur];";
  oss << "[toblur]boxblur=" << radius << ":1[blurred];";

  // For each region, crop from blurred and overlay onto original
  std::string current = "orig";
  for (size_t i = 0; i < regions.size(); ++i) {
    int x = std::get<0>(regions[i]);
    int y = std::get<1>(regions[i]);
    int w = std::get<2>(regions[i]);
    int h = std::get<3>(regions[i]);

    // Clamp to frame bounds
    x = std::max(0, std::min(x, width_ - 1));
    y = std::max(0, std::min(y, height_ - 1));
    w = std::min(w, width_ - x);
    h = std::min(h, height_ - y);

    if (w <= 0 || h <= 0) continue;

    std::string crop_label = "crop" + std::to_string(i);
    std::string out_label = (i == regions.size() - 1) ? "out" :
                            ("tmp" + std::to_string(i));

    oss << "[blurred]crop=" << w << ":" << h << ":" << x << ":" << y
        << "[" << crop_label << "];";
    oss << "[" << current << "][" << crop_label << "]overlay="
        << x << ":" << y << "[" << out_label << "]";

    if (i < regions.size() - 1) {
      oss << ";";
    }
    current = out_label;
  }

  return oss.str();
}

bool VideoFilter::InitFilterGraph(int blur_strength) {
  // This is called per-frame with dynamic regions, but we initialize
  // a simple passthrough graph here. Actual filtering happens in ProcessFrame.
  return true;
}

AVFrame* VideoFilter::ProcessFrame(AVFrame* input) {
  // This processes a YUV frame through the filter graph
  // Returns filtered frame (caller does NOT own - internal buffer)
  int ret = av_buffersrc_add_frame_flags(buffersrc_ctx_, input,
                                         AV_BUFFERSRC_FLAG_KEEP_REF);
  if (ret < 0) {
    return nullptr;
  }

  ret = av_buffersink_get_frame(buffersink_ctx_, output_frame_);
  if (ret < 0) {
    return nullptr;
  }

  return output_frame_;
}

Napi::Value VideoFilter::ApplyBlur(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (state_ != "configured") {
    Napi::Error::New(env, "VideoFilter not configured")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  if (info.Length() < 2) {
    Napi::TypeError::New(env, "frame and regions required")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Get frame data from VideoFrame object
  Napi::Object frame_obj = info[0].As<Napi::Object>();
  if (!frame_obj.Has("getData")) {
    Napi::TypeError::New(env, "Invalid VideoFrame object")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Get regions array
  Napi::Array regions_arr = info[1].As<Napi::Array>();
  std::vector<std::tuple<int, int, int, int>> regions;

  for (uint32_t i = 0; i < regions_arr.Length(); ++i) {
    Napi::Object region = regions_arr.Get(i).As<Napi::Object>();
    int x = region.Get("x").As<Napi::Number>().Int32Value();
    int y = region.Get("y").As<Napi::Number>().Int32Value();
    int w = region.Get("width").As<Napi::Number>().Int32Value();
    int h = region.Get("height").As<Napi::Number>().Int32Value();
    regions.emplace_back(x, y, w, h);
  }

  // Get blur strength (default 20)
  int blur_strength = 20;
  if (info.Length() >= 3 && info[2].IsNumber()) {
    blur_strength = info[2].As<Napi::Number>().Int32Value();
    blur_strength = std::max(1, std::min(100, blur_strength));
  }

  // If no regions, return cloned frame unchanged
  if (regions.empty()) {
    Napi::Function clone_fn = frame_obj.Get("clone").As<Napi::Function>();
    return clone_fn.Call(frame_obj, {});
  }

  // Get RGBA data from frame
  Napi::Function get_data = frame_obj.Get("getData").As<Napi::Function>();
  Napi::Buffer<uint8_t> rgba_buffer =
      get_data.Call(frame_obj, {}).As<Napi::Buffer<uint8_t>>();
  uint8_t* rgba_data = rgba_buffer.Data();

  // Build and initialize filter graph for these regions
  std::string filter_str = BuildFilterString(regions, blur_strength);

  // Clean up previous filter graph
  if (filter_graph_) {
    avfilter_graph_free(&filter_graph_);
    filter_graph_ = nullptr;
  }

  filter_graph_ = avfilter_graph_alloc();
  if (!filter_graph_) {
    Napi::Error::New(env, "Failed to allocate filter graph")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Create buffer source
  const AVFilter* buffersrc = avfilter_get_by_name("buffer");
  const AVFilter* buffersink = avfilter_get_by_name("buffersink");

  char args[512];
  snprintf(args, sizeof(args),
           "video_size=%dx%d:pix_fmt=%d:time_base=1/30:pixel_aspect=1/1",
           width_, height_, AV_PIX_FMT_YUV420P);

  int ret = avfilter_graph_create_filter(&buffersrc_ctx_, buffersrc, "in",
                                         args, nullptr, filter_graph_);
  if (ret < 0) {
    Napi::Error::New(env, "Failed to create buffer source")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  ret = avfilter_graph_create_filter(&buffersink_ctx_, buffersink, "out",
                                     nullptr, nullptr, filter_graph_);
  if (ret < 0) {
    Napi::Error::New(env, "Failed to create buffer sink")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Parse and link filter graph
  AVFilterInOut* outputs = avfilter_inout_alloc();
  AVFilterInOut* inputs = avfilter_inout_alloc();

  outputs->name = av_strdup("in");
  outputs->filter_ctx = buffersrc_ctx_;
  outputs->pad_idx = 0;
  outputs->next = nullptr;

  inputs->name = av_strdup("out");
  inputs->filter_ctx = buffersink_ctx_;
  inputs->pad_idx = 0;
  inputs->next = nullptr;

  ret = avfilter_graph_parse_ptr(filter_graph_, filter_str.c_str(),
                                 &inputs, &outputs, nullptr);
  avfilter_inout_free(&inputs);
  avfilter_inout_free(&outputs);

  if (ret < 0) {
    Napi::Error::New(env, "Failed to parse filter graph: " + filter_str)
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  ret = avfilter_graph_config(filter_graph_, nullptr);
  if (ret < 0) {
    Napi::Error::New(env, "Failed to configure filter graph")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Convert RGBA to YUV420P
  const uint8_t* src_slices[1] = { rgba_data };
  int src_stride[1] = { width_ * 4 };

  sws_scale(sws_rgba_to_yuv_, src_slices, src_stride, 0, height_,
            yuv_frame_->data, yuv_frame_->linesize);

  yuv_frame_->pts = 0;

  // Process through filter
  av_frame_unref(output_frame_);
  AVFrame* filtered = ProcessFrame(yuv_frame_);
  if (!filtered) {
    Napi::Error::New(env, "Filter processing failed")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Convert YUV420P back to RGBA
  size_t output_size = width_ * height_ * 4;
  Napi::Buffer<uint8_t> output_buffer = Napi::Buffer<uint8_t>::New(env, output_size);
  uint8_t* output_data = output_buffer.Data();

  uint8_t* dst_slices[1] = { output_data };
  int dst_stride[1] = { width_ * 4 };

  sws_scale(sws_yuv_to_rgba_, filtered->data, filtered->linesize,
            0, height_, dst_slices, dst_stride);

  // Get timestamp from original frame
  int64_t timestamp = frame_obj.Get("timestamp").As<Napi::Number>().Int64Value();

  // Create new VideoFrame with blurred data using VideoFrame::CreateInstance
  return VideoFrame::CreateInstance(env, output_data, output_size,
                                    width_, height_, timestamp, "RGBA");
}

Napi::Object InitVideoFilter(Napi::Env env, Napi::Object exports) {
  return VideoFilter::Init(env, exports);
}
