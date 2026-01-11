// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// VideoEncoderWorker implementation.

#include "src/video_encoder_worker.h"

#include <cstdio>
#include <cstring>
#include <memory>
#include <string>
#include <utility>
#include <vector>

#include "src/common.h"

namespace webcodecs {

namespace {

// Encoder configuration constants
constexpr int kFrameBufferAlignment = 32;
constexpr int kBytesPerPixelRgba = 4;
constexpr int kDefaultGopSize = 30;

}  // namespace

VideoEncoderWorker::VideoEncoderWorker(VideoControlQueue* queue)
    : CodecWorker<VideoControlQueue>(queue) {}

VideoEncoderWorker::~VideoEncoderWorker() {
  // Stop() is called by base class destructor, but we call it here first
  // to ensure our resources are cleaned up before base class destructor runs.
  Stop();
}

bool VideoEncoderWorker::Configure(const VideoEncoderConfig& config) {
  config_ = config;

  // Queue a configure message that will initialize the codec on the worker
  // thread
  ConfigureMessage msg;
  msg.configure_fn = [this]() -> bool { return InitializeCodec(); };

  return Enqueue(std::move(msg));
}

bool VideoEncoderWorker::OnConfigure(const ConfigureMessage& msg) {
  // Execute the configure function (which calls InitializeCodec)
  return msg.configure_fn();
}

bool VideoEncoderWorker::InitializeCodec() {
  // Find encoder based on codec string
  AVCodecID codec_id = AV_CODEC_ID_NONE;
  const std::string& codec_str = config_.codec_string;

  if (codec_str.find("avc1") == 0 || codec_str == "h264") {
    codec_id = AV_CODEC_ID_H264;
  } else if (codec_str == "vp8") {
    codec_id = AV_CODEC_ID_VP8;
  } else if (codec_str.find("vp09") == 0 || codec_str == "vp9") {
    codec_id = AV_CODEC_ID_VP9;
  } else if (codec_str.find("av01") == 0 || codec_str == "av1") {
    codec_id = AV_CODEC_ID_AV1;
  } else if (codec_str.find("hev1") == 0 || codec_str.find("hvc1") == 0 ||
             codec_str == "hevc") {
    codec_id = AV_CODEC_ID_HEVC;
  } else {
    OutputError(AVERROR_ENCODER_NOT_FOUND,
                "Unsupported codec: " + codec_str);
    return false;
  }

  // Try hardware encoders first based on platform and hardwareAcceleration
  codec_ = nullptr;
  const std::string& hw_accel = config_.hw_accel;

  if (hw_accel != "prefer-software") {
#ifdef __APPLE__
    if (codec_id == AV_CODEC_ID_H264) {
      codec_ = avcodec_find_encoder_by_name("h264_videotoolbox");
    } else if (codec_id == AV_CODEC_ID_HEVC) {
      codec_ = avcodec_find_encoder_by_name("hevc_videotoolbox");
    }
#endif
#ifdef _WIN32
    if (codec_id == AV_CODEC_ID_H264) {
      codec_ = avcodec_find_encoder_by_name("h264_nvenc");
      if (!codec_) codec_ = avcodec_find_encoder_by_name("h264_qsv");
      if (!codec_) codec_ = avcodec_find_encoder_by_name("h264_amf");
    } else if (codec_id == AV_CODEC_ID_HEVC) {
      codec_ = avcodec_find_encoder_by_name("hevc_nvenc");
      if (!codec_) codec_ = avcodec_find_encoder_by_name("hevc_qsv");
    }
#endif
#ifdef __linux__
    if (codec_id == AV_CODEC_ID_H264) {
      codec_ = avcodec_find_encoder_by_name("h264_vaapi");
      if (!codec_) codec_ = avcodec_find_encoder_by_name("h264_nvenc");
    } else if (codec_id == AV_CODEC_ID_HEVC) {
      codec_ = avcodec_find_encoder_by_name("hevc_vaapi");
      if (!codec_) codec_ = avcodec_find_encoder_by_name("hevc_nvenc");
    }
#endif
  }

  // Fallback to software encoder
  // When prefer-software is set (or no HW encoder found), explicitly find
  // software encoders by name to avoid avcodec_find_encoder returning a
  // hardware encoder (e.g., VideoToolbox on macOS).
  if (!codec_) {
    if (codec_id == AV_CODEC_ID_H264) {
      codec_ = avcodec_find_encoder_by_name("libx264");
    } else if (codec_id == AV_CODEC_ID_HEVC) {
      codec_ = avcodec_find_encoder_by_name("libx265");
    } else if (codec_id == AV_CODEC_ID_VP8) {
      codec_ = avcodec_find_encoder_by_name("libvpx");
    } else if (codec_id == AV_CODEC_ID_VP9) {
      codec_ = avcodec_find_encoder_by_name("libvpx-vp9");
    } else if (codec_id == AV_CODEC_ID_AV1) {
      codec_ = avcodec_find_encoder_by_name("libsvtav1");
      if (!codec_) codec_ = avcodec_find_encoder_by_name("libaom-av1");
    }
    // Final fallback to generic encoder lookup
    if (!codec_) {
      codec_ = avcodec_find_encoder(codec_id);
    }
  }

  if (!codec_) {
    OutputError(AVERROR_ENCODER_NOT_FOUND,
                "Encoder not found for codec: " + codec_str);
    return false;
  }

  codec_context_ = ffmpeg::make_codec_context(codec_);
  if (!codec_context_) {
    OutputError(AVERROR(ENOMEM), "Could not allocate codec context");
    return false;
  }

  // Configure encoder
  codec_context_->width = config_.width;
  codec_context_->height = config_.height;
  codec_context_->time_base = {1, config_.framerate};
  codec_context_->framerate = {config_.framerate, 1};
  codec_context_->pix_fmt = AV_PIX_FMT_YUV420P;
  codec_context_->gop_size = config_.gop_size;
  // CRITICAL: Disable B-frames for reliable keyframe control.
  // B-frames cause frame reordering which breaks pict_type hints.
  // Per WebCodecs spec, when keyFrame=true, the output MUST be a keyframe,
  // which requires no frame reordering.
  codec_context_->max_b_frames = 0;

  if (config_.use_qscale) {
    codec_context_->flags |= AV_CODEC_FLAG_QSCALE;
    codec_context_->global_quality = FF_QP2LAMBDA * 23;
  } else {
    codec_context_->bit_rate = config_.bitrate;
  }

  if (config_.bitstream_format != "annexb") {
    codec_context_->flags |= AV_CODEC_FLAG_GLOBAL_HEADER;
  }

  // Detect if this is a hardware encoder
  bool is_hw_encoder =
      codec_ && (strstr(codec_->name, "videotoolbox") != nullptr ||
                 strstr(codec_->name, "nvenc") != nullptr ||
                 strstr(codec_->name, "qsv") != nullptr ||
                 strstr(codec_->name, "vaapi") != nullptr ||
                 strstr(codec_->name, "amf") != nullptr);

  // Detect specific software encoder libraries
  bool is_libx264 = codec_ && strcmp(codec_->name, "libx264") == 0;
  bool is_libx265 = codec_ && strcmp(codec_->name, "libx265") == 0;
  bool is_libvpx =
      codec_ && (strcmp(codec_->name, "libvpx") == 0 ||
                 strcmp(codec_->name, "libvpx-vp9") == 0);
  bool is_libaom = codec_ && strcmp(codec_->name, "libaom-av1") == 0;
  bool is_libsvtav1 = codec_ && strcmp(codec_->name, "libsvtav1") == 0;

  // Codec-specific options
  if (!is_hw_encoder) {
    if (codec_id == AV_CODEC_ID_H264 && is_libx264) {
      av_opt_set(codec_context_->priv_data, "preset", "fast", 0);
      av_opt_set(codec_context_->priv_data, "tune", "zerolatency", 0);
      // CRITICAL: Enable forced-idr so pict_type=I produces IDR frames
      // Without this, x264 may ignore the pict_type hint
      av_opt_set(codec_context_->priv_data, "forced-idr", "1", 0);
      if (config_.use_qscale) {
        av_opt_set_int(codec_context_->priv_data, "qp", 23, 0);
      }
    } else if ((codec_id == AV_CODEC_ID_VP8 || codec_id == AV_CODEC_ID_VP9) &&
               is_libvpx) {
      av_opt_set(codec_context_->priv_data, "quality", "realtime", 0);
      av_opt_set(codec_context_->priv_data, "speed", "6", 0);
      codec_context_->max_b_frames = 0;
    } else if (codec_id == AV_CODEC_ID_AV1 && is_libaom) {
      av_opt_set(codec_context_->priv_data, "cpu-used", "8", 0);
    } else if (codec_id == AV_CODEC_ID_AV1 && is_libsvtav1) {
      av_opt_set(codec_context_->priv_data, "preset", "8", 0);
    } else if (codec_id == AV_CODEC_ID_HEVC && is_libx265) {
      av_opt_set(codec_context_->priv_data, "preset", "fast", 0);
      // Enable forced-idr for keyframe control
      av_opt_set(codec_context_->priv_data, "x265-params",
                 "bframes=0:forced-idr=1", 0);
    }
  }

  // Hardware encoder-specific options
  if (is_hw_encoder) {
    if (strstr(codec_->name, "videotoolbox") != nullptr) {
      av_opt_set(codec_context_->priv_data, "allow_sw", "1", 0);
    }
  }

  int ret = avcodec_open2(codec_context_.get(), codec_, nullptr);

  // If hardware encoder failed, fall back to software encoder
  if (ret < 0 && is_hw_encoder) {
    codec_context_.reset();
    codec_ = avcodec_find_encoder(codec_id);
    if (codec_) {
      codec_context_ = ffmpeg::make_codec_context(codec_);
      if (codec_context_) {
        // Reconfigure for software
        codec_context_->width = config_.width;
        codec_context_->height = config_.height;
        codec_context_->time_base = {1, config_.framerate};
        codec_context_->framerate = {config_.framerate, 1};
        codec_context_->pix_fmt = AV_PIX_FMT_YUV420P;
        codec_context_->gop_size = config_.gop_size;
        // Disable B-frames for reliable keyframe control
        codec_context_->max_b_frames = 0;

        if (config_.use_qscale) {
          codec_context_->flags |= AV_CODEC_FLAG_QSCALE;
          codec_context_->global_quality = FF_QP2LAMBDA * 23;
        } else {
          codec_context_->bit_rate = config_.bitrate;
        }

        if (config_.bitstream_format != "annexb") {
          codec_context_->flags |= AV_CODEC_FLAG_GLOBAL_HEADER;
        }

        // Set software encoder-specific options
        if (codec_id == AV_CODEC_ID_H264 &&
            strcmp(codec_->name, "libx264") == 0) {
          av_opt_set(codec_context_->priv_data, "preset", "fast", 0);
          av_opt_set(codec_context_->priv_data, "tune", "zerolatency", 0);
          av_opt_set(codec_context_->priv_data, "forced-idr", "1", 0);
          if (config_.use_qscale) {
            av_opt_set_int(codec_context_->priv_data, "qp", 23, 0);
          }
        } else if (codec_id == AV_CODEC_ID_HEVC &&
                   strcmp(codec_->name, "libx265") == 0) {
          av_opt_set(codec_context_->priv_data, "preset", "fast", 0);
          av_opt_set(codec_context_->priv_data, "x265-params",
                     "bframes=0:forced-idr=1", 0);
        }

        ret = avcodec_open2(codec_context_.get(), codec_, nullptr);
      }
    }
  }

  if (ret < 0) {
    OutputError(ret, "Could not open codec: " + FFmpegErrorString(ret));
    codec_context_.reset();
    return false;
  }

  // Allocate frame and packet
  frame_ = ffmpeg::make_frame();
  frame_->format = codec_context_->pix_fmt;
  frame_->width = config_.width;
  frame_->height = config_.height;
  ret = av_frame_get_buffer(frame_.get(), kFrameBufferAlignment);
  if (ret < 0) {
    OutputError(ret, "Failed to allocate frame buffer");
    codec_context_.reset();
    return false;
  }

  packet_ = ffmpeg::make_packet();

  // Setup color converter (RGBA -> YUV420P)
  sws_context_.reset(
      sws_getContext(config_.width, config_.height, AV_PIX_FMT_RGBA,
                     config_.width, config_.height, AV_PIX_FMT_YUV420P,
                     SWS_BILINEAR, nullptr, nullptr, nullptr));

  frame_count_ = 0;

  return true;
}

bool VideoEncoderWorker::ReinitializeCodec() {
  if (!codec_) {
    return false;  // No codec to reinitialize
  }

  // Close old codec context
  codec_context_.reset();
  sws_context_.reset();

  // Reinitialize and propagate result
  if (!InitializeCodec()) {
    return false;
  }

  // Note: frame_count_ is NOT reset - continue numbering from before flush
  return true;
}

void VideoEncoderWorker::OnEncode(const EncodeMessage& msg) {
  if (!codec_context_ || !sws_context_ || !frame_ || !packet_) {
    OutputError(AVERROR_INVALIDDATA, "Encoder not initialized");
    return;
  }

  // Get frame data from the message
  AVFrame* src_frame = msg.frame.get();
  if (!src_frame || !src_frame->data[0]) {
    OutputError(AVERROR_INVALIDDATA, "Invalid frame data");
    return;
  }

  // CRITICAL: Make frame writable before modifying
  // This ensures we don't corrupt shared frame data
  int ret = av_frame_make_writable(frame_.get());
  if (ret < 0) {
    OutputError(ret, "Failed to make frame writable: " + FFmpegErrorString(ret));
    return;
  }

  // Get dimensions and timestamp from source frame
  int src_width = src_frame->width;
  int src_height = src_frame->height;
  int64_t timestamp = src_frame->pts;
  int64_t duration = AV_FRAME_DURATION(src_frame);

  // For RGBA input, convert to YUV420P
  // The source frame contains RGBA data packed in data[0]
  const uint8_t* src_data[1] = {src_frame->data[0]};
  int src_linesize[1] = {src_width * kBytesPerPixelRgba};

  sws_scale(sws_context_.get(), src_data, src_linesize, 0, src_height,
            frame_->data, frame_->linesize);

  // Use frame_count_ as pts for consistent SVC layer computation
  frame_->pts = frame_count_;
  frame_info_[frame_count_] = std::make_pair(timestamp, duration);

  // Honor keyFrame flag per W3C WebCodecs spec
  // The most reliable cross-encoder method is setting pict_type = AV_PICTURE_TYPE_I
  // This works because we configure encoders without B-frames for realtime mode.
  if (msg.key_frame) {
    frame_->pict_type = AV_PICTURE_TYPE_I;
    frame_->flags |= AV_FRAME_FLAG_KEY;
  } else {
    frame_->pict_type = AV_PICTURE_TYPE_NONE;
    frame_->flags &= ~AV_FRAME_FLAG_KEY;
  }

  // Apply per-frame quantizer if stored in quality field
  // The quality field is set by the caller via src_frame->quality
  if (src_frame->quality > 0) {
    frame_->quality = src_frame->quality;
  } else {
    frame_->quality = 0;
  }

  frame_count_++;

  // Send frame to encoder
  ret = avcodec_send_frame(codec_context_.get(), frame_.get());
  if (ret < 0 && ret != AVERROR(EAGAIN)) {
    OutputError(ret, "Error sending frame: " + FFmpegErrorString(ret));
    return;
  }

  // Receive encoded packets
  while (avcodec_receive_packet(codec_context_.get(), packet_.get()) == 0) {
    EmitPacket(packet_.get());
    av_packet_unref(packet_.get());
  }

  // Signal dequeue event
  if (dequeue_callback_) {
    dequeue_callback_(static_cast<uint32_t>(queue()->size()));
  }
}

void VideoEncoderWorker::OnFlush(const FlushMessage& msg) {
  if (!codec_context_ || !packet_) {
    if (flush_callback_) {
      flush_callback_(msg.promise_id, true, "");
    }
    return;
  }

  // Send NULL frame to flush encoder
  avcodec_send_frame(codec_context_.get(), nullptr);

  // Drain all remaining packets
  while (avcodec_receive_packet(codec_context_.get(), packet_.get()) == 0) {
    EmitPacket(packet_.get());
    av_packet_unref(packet_.get());
  }

  // Clear frame info map after flush
  frame_info_.clear();

  // Reinitialize codec (FFmpeg enters EOF mode after NULL frame)
  bool reinit_success = ReinitializeCodec();

  // Signal flush complete (with success/failure from reinitialization)
  if (flush_callback_) {
    if (reinit_success) {
      flush_callback_(msg.promise_id, true, "");
    } else {
      flush_callback_(msg.promise_id, false,
                      "Failed to reinitialize codec after flush");
    }
  }
}

void VideoEncoderWorker::OnReset() {
  // Drain and discard any remaining packets
  if (codec_context_ && packet_) {
    avcodec_send_frame(codec_context_.get(), nullptr);
    while (avcodec_receive_packet(codec_context_.get(), packet_.get()) == 0) {
      av_packet_unref(packet_.get());
    }
  }

  // Clean up FFmpeg resources
  frame_.reset();
  packet_.reset();
  sws_context_.reset();
  codec_context_.reset();
  codec_ = nullptr;

  // Reset state
  frame_count_ = 0;
  frame_info_.clear();
}

void VideoEncoderWorker::OnClose() {
  OnReset();
}

void VideoEncoderWorker::EmitPacket(AVPacket* pkt) {
  // Increment pending count before async operation
  pending_chunks_->fetch_add(1);

  // pkt->pts is the frame_index (set in OnEncode)
  int64_t frame_index = pkt->pts;

  // Look up original timestamp/duration from the map
  int64_t timestamp = 0;
  int64_t duration = 0;
  auto it = frame_info_.find(frame_index);
  if (it != frame_info_.end()) {
    timestamp = it->second.first;
    duration = it->second.second;
    frame_info_.erase(it);
  }

  // Create packet data
  auto packet_data = std::make_unique<EncodedPacketData>();
  packet_data->data.assign(pkt->data, pkt->data + pkt->size);
  packet_data->timestamp = timestamp;
  packet_data->duration = duration;
  packet_data->is_key = (pkt->flags & AV_PKT_FLAG_KEY) != 0;
  packet_data->frame_index = frame_index;
  packet_data->metadata = config_;
  packet_data->pending = pending_chunks_;

  // Copy extradata from codec_context at emit time
  if (codec_context_ && codec_context_->extradata &&
      codec_context_->extradata_size > 0) {
    packet_data->extradata.assign(
        codec_context_->extradata,
        codec_context_->extradata + codec_context_->extradata_size);
  }

  // Call output callback
  if (packet_output_callback_) {
    packet_output_callback_(std::move(packet_data));
  } else {
    // No callback, decrement pending
    pending_chunks_->fetch_sub(1);
  }
}

int VideoEncoderWorker::ComputeTemporalLayerId(int64_t frame_index) const {
  if (config_.temporal_layer_count <= 1) return 0;

  if (config_.temporal_layer_count == 2) {
    // L1T2: alternating pattern [0, 1, 0, 1, ...]
    return (frame_index % 2 == 0) ? 0 : 1;
  }

  // L1T3: pyramid pattern [0, 2, 1, 2, 0, 2, 1, 2, ...]
  int pos = frame_index % 4;
  if (pos == 0) return 0;  // Base layer
  if (pos == 2) return 1;  // Middle layer
  return 2;                // Enhancement layer (pos 1, 3)
}

}  // namespace webcodecs
