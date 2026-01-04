// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// VideoDecoderWorker - Worker-owned codec model for non-blocking video decoding.

#ifndef SRC_VIDEO_DECODER_WORKER_H_
#define SRC_VIDEO_DECODER_WORKER_H_

extern "C" {
#include <libavcodec/avcodec.h>
#include <libswscale/swscale.h>
}

#include <string>
#include <vector>

#include "src/ffmpeg_raii.h"
#include "src/shared/codec_worker.h"
#include "src/shared/control_message_queue.h"

namespace webcodecs {

/**
 * Metadata config for decoded video frames.
 * Passed to worker at configure time for consistent output frame creation.
 */
struct VideoDecoderMetadataConfig {
  int rotation = 0;
  bool flip = false;
  int display_width = 0;
  int display_height = 0;
  std::string color_primaries;
  std::string color_transfer;
  std::string color_matrix;
  bool color_full_range = false;
  bool has_color_space = false;
};

/**
 * Configuration for VideoDecoder.
 * Passed to worker thread via ConfigureMessage.
 */
struct VideoDecoderConfig {
  AVCodecID codec_id = AV_CODEC_ID_NONE;
  int coded_width = 0;
  int coded_height = 0;
  std::vector<uint8_t> extradata;
  bool optimize_for_latency = false;
  VideoDecoderMetadataConfig metadata;
};

/**
 * Worker thread for VideoDecoder.
 *
 * Owns the AVCodecContext exclusively - all FFmpeg operations happen on
 * the worker thread, eliminating need for mutex around codec operations.
 *
 * Messages are processed FIFO per W3C spec:
 * - Configure: Opens decoder with specified config
 * - Decode: avcodec_send_packet + receive frame loop
 * - Flush: Drains decoder and resolves promise via TSFN
 * - Reset: Clears state, flushes buffers
 * - Close: Releases resources
 */
class VideoDecoderWorker : public CodecWorker<VideoControlQueue> {
 public:
  explicit VideoDecoderWorker(VideoControlQueue* queue);
  ~VideoDecoderWorker() override;

  // Non-copyable, non-movable
  VideoDecoderWorker(const VideoDecoderWorker&) = delete;
  VideoDecoderWorker& operator=(const VideoDecoderWorker&) = delete;
  VideoDecoderWorker(VideoDecoderWorker&&) = delete;
  VideoDecoderWorker& operator=(VideoDecoderWorker&&) = delete;

  /**
   * Set decoder configuration.
   * Must be called before Start(), used by OnConfigure().
   */
  void SetConfig(const VideoDecoderConfig& config);

  /**
   * Check if codec context is currently open.
   */
  bool IsCodecOpen() const;

 protected:
  // CodecWorker virtual overrides
  bool OnConfigure(const ConfigureMessage& msg) override;
  void OnDecode(const DecodeMessage& msg) override;
  void OnFlush(const FlushMessage& msg) override;
  void OnReset() override;
  void OnClose() override;

 private:
  /**
   * Emit a decoded frame via output callback.
   * Converts from decoder's pixel format to RGBA.
   */
  void EmitFrame(AVFrame* frame, int64_t timestamp);

  /**
   * Initialize or recreate SwsContext for format conversion.
   * Called when frame format/dimensions change.
   *
   * @return true on success, false on error
   */
  bool EnsureSwsContext(AVFrame* frame);

  // Decoder configuration
  VideoDecoderConfig config_;

  // FFmpeg resources (owned by this worker)
  const AVCodec* codec_ = nullptr;
  ffmpeg::AVCodecContextPtr codec_context_;
  ffmpeg::SwsContextPtr sws_context_;
  ffmpeg::AVFramePtr frame_;
  ffmpeg::AVPacketPtr packet_;

  // Track last frame format/dimensions for sws_context recreation
  AVPixelFormat last_frame_format_ = AV_PIX_FMT_NONE;
  int last_frame_width_ = 0;
  int last_frame_height_ = 0;

  // Track if codec is configured (for reset safety)
  bool codec_configured_ = false;
};

}  // namespace webcodecs

#endif  // SRC_VIDEO_DECODER_WORKER_H_
