// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// VideoDecoderWorker implementation.

#include "src/video_decoder_worker.h"

#include <cmath>
#include <cstring>
#include <string>
#include <utility>
#include <vector>

extern "C" {
#include <libavcodec/avcodec.h>
#include <libswscale/swscale.h>
}

#include "src/common.h"

namespace {
// Used to calculate RGBA buffer size
[[maybe_unused]] constexpr int kBytesPerPixelRgba = 4;
}  // namespace

namespace webcodecs {

VideoDecoderWorker::VideoDecoderWorker(VideoControlQueue* queue)
    : CodecWorker<VideoControlQueue>(queue) {}

VideoDecoderWorker::~VideoDecoderWorker() {
  // Stop() is called by CodecWorker destructor, but we call it here to ensure
  // worker thread exits before we destroy our resources
  Stop();

  // Release FFmpeg resources (RAII handles cleanup)
  codec_context_.reset();
  sws_context_.reset();
  frame_.reset();
  packet_.reset();
}

void VideoDecoderWorker::SetConfig(const VideoDecoderConfig& config) {
  config_ = config;
}

bool VideoDecoderWorker::IsCodecOpen() const {
  return codec_configured_ && codec_context_ &&
         avcodec_is_open(codec_context_.get());
}

bool VideoDecoderWorker::OnConfigure(const ConfigureMessage& msg) {
  // Execute the configure function from the message
  // This allows the main thread to set up config before worker starts
  if (msg.configure_fn && !msg.configure_fn()) {
    return false;
  }

  // Find decoder
  codec_ = avcodec_find_decoder(config_.codec_id);
  if (!codec_) {
    OutputError(AVERROR_DECODER_NOT_FOUND, "Decoder not found for codec");
    return false;
  }

  // Allocate codec context
  codec_context_ = ffmpeg::make_codec_context(codec_);
  if (!codec_context_) {
    OutputError(AVERROR(ENOMEM), "Could not allocate codec context");
    return false;
  }

  // Set dimensions only if provided (decoder will use bitstream dimensions
  // otherwise)
  if (config_.coded_width > 0) {
    codec_context_->width = config_.coded_width;
  }
  if (config_.coded_height > 0) {
    codec_context_->height = config_.coded_height;
  }

  // Handle extradata (SPS+PPS for H.264, etc.)
  if (!config_.extradata.empty()) {
    size_t extradata_size = config_.extradata.size();
    codec_context_->extradata = static_cast<uint8_t*>(
        av_malloc(extradata_size + AV_INPUT_BUFFER_PADDING_SIZE));
    if (codec_context_->extradata) {
      memcpy(codec_context_->extradata, config_.extradata.data(),
             extradata_size);
      memset(codec_context_->extradata + extradata_size, 0,
             AV_INPUT_BUFFER_PADDING_SIZE);
      codec_context_->extradata_size = static_cast<int>(extradata_size);
    }
  }

  // Apply low-latency flags if requested
  if (config_.optimize_for_latency) {
    codec_context_->flags |= AV_CODEC_FLAG_LOW_DELAY;
    codec_context_->flags2 |= AV_CODEC_FLAG2_FAST;
  }

  // Open codec
  int ret = avcodec_open2(codec_context_.get(), codec_, nullptr);
  if (ret < 0) {
    std::string error_msg =
        "Could not open decoder: " + webcodecs::FFmpegErrorString(ret);
    OutputError(ret, error_msg);
    codec_context_.reset();
    return false;
  }

  // Allocate frame and packet
  frame_ = ffmpeg::make_frame();
  if (!frame_) {
    OutputError(AVERROR(ENOMEM), "Could not allocate frame");
    codec_context_.reset();
    return false;
  }

  packet_ = ffmpeg::make_packet();
  if (!packet_) {
    OutputError(AVERROR(ENOMEM), "Could not allocate packet");
    codec_context_.reset();
    frame_.reset();
    return false;
  }

  codec_configured_ = true;
  return true;
}

void VideoDecoderWorker::OnDecode(const DecodeMessage& msg) {
  if (!codec_context_ || !codec_configured_) {
    OutputError(AVERROR_INVALIDDATA, "Decoder not configured");
    return;
  }

  // Get packet from message
  AVPacket* pkt = msg.packet.get();
  if (!pkt) {
    OutputError(AVERROR_INVALIDDATA, "Invalid packet");
    return;
  }

  // Send packet to decoder
  int ret = avcodec_send_packet(codec_context_.get(), pkt);
  if (ret < 0 && ret != AVERROR(EAGAIN) && ret != AVERROR_EOF) {
    std::string error_msg = "Decode error: " + webcodecs::FFmpegErrorString(ret);
    OutputError(ret, error_msg);
    return;
  }

  // Receive all available frames
  while (true) {
    ret = avcodec_receive_frame(codec_context_.get(), frame_.get());
    if (ret == AVERROR(EAGAIN) || ret == AVERROR_EOF) {
      break;
    }
    if (ret < 0) {
      std::string error_msg =
          "Decode receive error: " + webcodecs::FFmpegErrorString(ret);
      OutputError(ret, error_msg);
      break;
    }

    // Emit the decoded frame
    EmitFrame(frame_.get(), frame_->pts);
    av_frame_unref(frame_.get());
  }

  // Signal dequeue event with updated queue size
  SignalDequeue(static_cast<uint32_t>(queue()->size()));
}

void VideoDecoderWorker::OnFlush(const FlushMessage& msg) {
  if (!codec_context_ || !codec_configured_) {
    // Not configured - just resolve the promise
    FlushComplete(msg.promise_id, true);
    return;
  }

  // Send NULL packet to trigger drain
  int ret = avcodec_send_packet(codec_context_.get(), nullptr);
  if (ret < 0 && ret != AVERROR_EOF) {
    std::string error_msg = "Flush error: " + webcodecs::FFmpegErrorString(ret);
    FlushComplete(msg.promise_id, false, error_msg);
    return;
  }

  // Drain all remaining frames
  while (true) {
    ret = avcodec_receive_frame(codec_context_.get(), frame_.get());
    if (ret == AVERROR(EAGAIN) || ret == AVERROR_EOF) {
      break;
    }
    if (ret < 0) {
      std::string error_msg =
          "Flush receive error: " + webcodecs::FFmpegErrorString(ret);
      FlushComplete(msg.promise_id, false, error_msg);
      return;
    }

    EmitFrame(frame_.get(), frame_->pts);
    av_frame_unref(frame_.get());
  }

  // Reset decoder to accept new packets after drain.
  // Without this, decoder stays in drain mode and rejects further input.
  avcodec_flush_buffers(codec_context_.get());

  FlushComplete(msg.promise_id, true);
}

void VideoDecoderWorker::OnReset() {
  // Clear any pending work in the queue
  queue()->Clear();

  // Flush decoder buffers if configured
  if (codec_context_ && codec_configured_ &&
      avcodec_is_open(codec_context_.get())) {
    avcodec_flush_buffers(codec_context_.get());
  }

  // Reset sws context tracking (will be recreated on next frame)
  sws_context_.reset();
  last_frame_format_ = AV_PIX_FMT_NONE;
  last_frame_width_ = 0;
  last_frame_height_ = 0;
}

void VideoDecoderWorker::OnClose() {
  // Release all resources
  codec_configured_ = false;

  if (codec_context_ && avcodec_is_open(codec_context_.get())) {
    avcodec_flush_buffers(codec_context_.get());
  }

  frame_.reset();
  packet_.reset();
  sws_context_.reset();
  codec_context_.reset();
  codec_ = nullptr;
}

bool VideoDecoderWorker::EnsureSwsContext(AVFrame* frame) {
  AVPixelFormat frame_format = static_cast<AVPixelFormat>(frame->format);

  // Check if we need to recreate the context
  if (sws_context_ && last_frame_format_ == frame_format &&
      last_frame_width_ == frame->width &&
      last_frame_height_ == frame->height) {
    return true;  // Existing context is valid
  }

  // Create new SwsContext (RAII handles cleanup of old one)
  sws_context_.reset(
      sws_getContext(frame->width, frame->height, frame_format, frame->width,
                     frame->height, AV_PIX_FMT_RGBA, SWS_BILINEAR, nullptr,
                     nullptr, nullptr));

  if (!sws_context_) {
    OutputError(AVERROR(ENOMEM), "Could not create sws context");
    return false;
  }

  last_frame_format_ = frame_format;
  last_frame_width_ = frame->width;
  last_frame_height_ = frame->height;
  return true;
}

void VideoDecoderWorker::EmitFrame(AVFrame* frame, int64_t timestamp) {
  if (!EnsureSwsContext(frame)) {
    return;  // Error already reported
  }

  // Create output frame with RGBA data
  auto output_frame = ffmpeg::make_frame();
  if (!output_frame) {
    OutputError(AVERROR(ENOMEM), "Could not allocate output frame");
    return;
  }

  output_frame->width = frame->width;
  output_frame->height = frame->height;
  output_frame->format = AV_PIX_FMT_RGBA;
  output_frame->pts = timestamp;

  // Calculate display dimensions based on aspect ratio (per W3C spec)
  int display_width = frame->width;
  int display_height = frame->height;
  if (config_.metadata.display_width > 0 &&
      config_.metadata.display_height > 0) {
    // Per W3C spec: displayWidth = codedHeight * aspectWidth / aspectHeight
    display_width = static_cast<int>(
        std::round(static_cast<double>(frame->height) *
                   static_cast<double>(config_.metadata.display_width) /
                   static_cast<double>(config_.metadata.display_height)));
    display_height = frame->height;
  }

  // Allocate buffer for RGBA data
  int ret = av_frame_get_buffer(output_frame.get(), 0);
  if (ret < 0) {
    OutputError(ret, "Could not allocate output frame buffer");
    return;
  }

  // Convert to RGBA
  sws_scale(sws_context_.get(), frame->data, frame->linesize, 0, frame->height,
            output_frame->data, output_frame->linesize);

  // Store metadata in frame for later use by VideoFrame creation
  // Using opaque_ref to pass display dimensions and metadata
  // Note: We encode display dimensions in the frame's sample_aspect_ratio
  // since AVFrame doesn't have display_width/height fields
  output_frame->sample_aspect_ratio.num = display_width;
  output_frame->sample_aspect_ratio.den = display_height;

  // Store rotation/flip in opaque (simple encoding for now)
  // Note: This is a workaround since AVFrame lacks rotation/flip fields
  // We'll need to handle this properly in the TSFN callback
  output_frame->opaque = reinterpret_cast<void*>(
      static_cast<intptr_t>((config_.metadata.rotation << 1) |
                            (config_.metadata.flip ? 1 : 0)));

  // Output the frame via callback
  OutputFrame(std::move(output_frame));
}

}  // namespace webcodecs
