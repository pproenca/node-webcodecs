// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#include "src/test_video_generator.h"

#include <cstdio>
#include <string>

#include "src/common.h"
#include "src/video_frame.h"

Napi::Object TestVideoGenerator::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func = DefineClass(
      env, "TestVideoGenerator",
      {
          InstanceMethod("configure", &TestVideoGenerator::Configure),
          InstanceMethod("generate", &TestVideoGenerator::Generate),
          InstanceMethod("close", &TestVideoGenerator::Close),
          InstanceAccessor("state", &TestVideoGenerator::GetState, nullptr),
      });

  exports.Set("TestVideoGenerator", func);
  return exports;
}

TestVideoGenerator::TestVideoGenerator(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<TestVideoGenerator>(info),
      buffersink_ctx_(nullptr),
      width_(0),
      height_(0),
      frame_rate_(30),
      duration_(1),
      pattern_("testsrc"),
      state_("unconfigured") {}

TestVideoGenerator::~TestVideoGenerator() { Cleanup(); }

void TestVideoGenerator::Cleanup() {
  filter_graph_.reset();
  sws_yuv_to_rgba_.reset();
  output_frame_.reset();
  buffersink_ctx_ = nullptr;
}

Napi::Value TestVideoGenerator::GetState(const Napi::CallbackInfo& info) {
  return Napi::String::New(info.Env(), state_);
}

Napi::Value TestVideoGenerator::Close(const Napi::CallbackInfo& info) {
  Cleanup();
  state_ = "closed";
  return info.Env().Undefined();
}

Napi::Value TestVideoGenerator::Configure(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (state_ == "closed") {
    Napi::Error::New(env, "TestVideoGenerator is closed")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  if (info.Length() < 1 || !info[0].IsObject()) {
    Napi::TypeError::New(env, "Config object required")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  Napi::Object config = info[0].As<Napi::Object>();

  width_ = webcodecs::AttrAsInt32(config, "width");
  height_ = webcodecs::AttrAsInt32(config, "height");

  if (webcodecs::HasAttr(config, "frameRate")) {
    frame_rate_ = webcodecs::AttrAsInt32(config, "frameRate");
  }
  if (webcodecs::HasAttr(config, "duration")) {
    duration_ = webcodecs::AttrAsInt32(config, "duration");
  }
  if (webcodecs::HasAttr(config, "pattern")) {
    pattern_ = webcodecs::AttrAsStr(config, "pattern");
  }

  if (width_ <= 0 || height_ <= 0) {
    Napi::RangeError::New(env, "width and height must be positive")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Initialize swscale for YUV420P -> RGBA conversion
  sws_yuv_to_rgba_.reset(
      sws_getContext(width_, height_, AV_PIX_FMT_YUV420P, width_, height_,
                     AV_PIX_FMT_RGBA, SWS_BILINEAR, nullptr, nullptr, nullptr));

  if (!sws_yuv_to_rgba_) {
    Napi::Error::New(env, "Failed to create swscale context")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  output_frame_ = ffmpeg::make_frame();

  state_ = "configured";
  return env.Undefined();
}

bool TestVideoGenerator::InitFilterGraph() {
  filter_graph_ = ffmpeg::make_filter_graph();
  if (!filter_graph_) return false;

  const AVFilter* buffersink = avfilter_get_by_name("buffersink");
  const AVFilter* testsrc = avfilter_get_by_name(pattern_.c_str());

  if (!testsrc) {
    // Fallback to testsrc if pattern not found
    testsrc = avfilter_get_by_name("testsrc");
  }

  // Create testsrc filter
  char args[256];
  snprintf(args, sizeof(args), "duration=%d:size=%dx%d:rate=%d", duration_,
           width_, height_, frame_rate_);

  AVFilterContext* testsrc_ctx = nullptr;
  int ret = avfilter_graph_create_filter(&testsrc_ctx, testsrc, "in", args,
                                         nullptr, filter_graph_.get());
  if (ret < 0) return false;

  // Create buffersink
  ret = avfilter_graph_create_filter(&buffersink_ctx_, buffersink, "out",
                                     nullptr, nullptr, filter_graph_.get());
  if (ret < 0) return false;

  // Link testsrc -> buffersink
  ret = avfilter_link(testsrc_ctx, 0, buffersink_ctx_, 0);
  if (ret < 0) return false;

  ret = avfilter_graph_config(filter_graph_.get(), nullptr);
  return ret >= 0;
}

Napi::Value TestVideoGenerator::Generate(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (state_ != "configured") {
    Napi::Error::New(env, "TestVideoGenerator not configured")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  if (info.Length() < 1 || !info[0].IsFunction()) {
    Napi::TypeError::New(env, "Callback function required")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  Napi::Function callback = info[0].As<Napi::Function>();

  // Initialize filter graph
  if (!InitFilterGraph()) {
    Napi::Error::New(env, "Failed to initialize filter graph")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Generate frames
  int64_t frame_count = 0;
  size_t output_size = width_ * height_ * 4;

  while (true) {
    av_frame_unref(output_frame_.get());
    int ret = av_buffersink_get_frame(buffersink_ctx_, output_frame_.get());

    if (ret == AVERROR(EAGAIN) || ret == AVERROR_EOF) {
      break;
    }
    if (ret < 0) {
      Napi::Error::New(env, "Error getting frame from filter")
          .ThrowAsJavaScriptException();
      return env.Undefined();
    }

    // Convert YUV420P to RGBA
    Napi::Buffer<uint8_t> output_buffer =
        Napi::Buffer<uint8_t>::New(env, output_size);
    uint8_t* output_data = output_buffer.Data();
    uint8_t* dst_slices[1] = {output_data};
    int dst_stride[1] = {width_ * 4};

    sws_scale(sws_yuv_to_rgba_.get(), output_frame_->data,
              output_frame_->linesize, 0, height_, dst_slices, dst_stride);

    // Calculate timestamp in microseconds
    int64_t timestamp = (frame_count * 1000000) / frame_rate_;

    // Create VideoFrame
    Napi::Value frame = VideoFrame::CreateInstance(
        env, output_data, output_size, width_, height_, timestamp, "RGBA");

    // Call callback with frame
    callback.Call({frame});
    frame_count++;
  }

  // Return a resolved promise
  Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
  deferred.Resolve(env.Undefined());
  return deferred.Promise();
}

Napi::Object InitTestVideoGenerator(Napi::Env env, Napi::Object exports) {
  return TestVideoGenerator::Init(env, exports);
}
