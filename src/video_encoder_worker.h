// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// VideoEncoderWorker - Dedicated worker thread for video encoding.
//
// Uses the CodecWorker template for message-based codec processing.
// Owns the AVCodecContext exclusively on the worker thread.

#ifndef SRC_VIDEO_ENCODER_WORKER_H_
#define SRC_VIDEO_ENCODER_WORKER_H_

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavutil/imgutils.h>
#include <libavutil/opt.h>
#include <libswscale/swscale.h>
}

#include <napi.h>

#include <atomic>
#include <functional>
#include <map>
#include <memory>
#include <string>
#include <utility>
#include <vector>

#include "src/ffmpeg_raii.h"
#include "src/shared/codec_worker.h"
#include "src/shared/control_message_queue.h"
#include "src/shared/safe_tsfn.h"

namespace webcodecs {

/**
 * Encoder configuration for worker initialization.
 */
struct VideoEncoderConfig {
  int width = 0;
  int height = 0;
  int display_width = 0;
  int display_height = 0;
  int bitrate = 1000000;
  int framerate = 30;
  int gop_size = 30;
  int max_b_frames = 2;
  bool use_qscale = false;
  std::string codec_string;
  std::string bitstream_format = "annexb";
  std::string color_primaries;
  std::string color_transfer;
  std::string color_matrix;
  bool color_full_range = false;
  int temporal_layer_count = 1;
  std::string hw_accel = "no-preference";
};

/**
 * Output packet data for TSFN delivery to JS thread.
 */
struct EncodedPacketData {
  std::vector<uint8_t> data;
  int64_t timestamp;
  int64_t duration;
  bool is_key;
  int64_t frame_index;
  VideoEncoderConfig metadata;
  std::vector<uint8_t> extradata;
  std::shared_ptr<std::atomic<int>> pending;
};

/**
 * VideoEncoderWorker - Worker thread for video encoding operations.
 *
 * Extends CodecWorker<VideoControlQueue> to provide video-specific encoding.
 * The worker owns the AVCodecContext and processes encode operations in FIFO
 * order.
 */
class VideoEncoderWorker : public CodecWorker<VideoControlQueue> {
 public:
  using PacketOutputCallback =
      std::function<void(std::unique_ptr<EncodedPacketData>)>;
  using ErrorCallback =
      std::function<void(int error_code, const std::string& message)>;
  using FlushCallback =
      std::function<void(uint32_t promise_id, bool success,
                         const std::string& error)>;
  using DequeueCallback = std::function<void(uint32_t new_queue_size)>;

  explicit VideoEncoderWorker(VideoControlQueue* queue);
  ~VideoEncoderWorker() override;

  // Disallow copy and assign
  VideoEncoderWorker(const VideoEncoderWorker&) = delete;
  VideoEncoderWorker& operator=(const VideoEncoderWorker&) = delete;

  /**
   * Configure the encoder.
   * Called from JS thread; actual codec initialization happens on worker.
   *
   * @param config Encoder configuration
   * @return true if configuration was queued successfully
   */
  bool Configure(const VideoEncoderConfig& config);

  /**
   * Set callback for packet output.
   */
  void SetPacketOutputCallback(PacketOutputCallback cb) {
    packet_output_callback_ = std::move(cb);
  }

  /**
   * Set callback for errors.
   */
  void SetErrorOutputCallback(ErrorCallback cb) {
    error_output_callback_ = std::move(cb);
  }

  /**
   * Set callback for flush completion.
   */
  void SetFlushCompleteCallback(FlushCallback cb) {
    flush_callback_ = std::move(cb);
  }

  /**
   * Set callback for dequeue events.
   */
  void SetDequeueEventCallback(DequeueCallback cb) {
    dequeue_callback_ = std::move(cb);
  }

  /**
   * Get pending chunks counter for JS-side polling.
   */
  std::shared_ptr<std::atomic<int>> GetPendingChunksPtr() const {
    return pending_chunks_;
  }

  /**
   * Get current pending chunks count.
   */
  int GetPendingChunks() const { return pending_chunks_->load(); }

 protected:
  // CodecWorker overrides
  bool OnConfigure(const ConfigureMessage& msg) override;
  void OnEncode(const EncodeMessage& msg) override;
  void OnFlush(const FlushMessage& msg) override;
  void OnReset() override;
  void OnClose() override;

 private:
  /**
   * Initialize the codec with current configuration.
   * Called on worker thread.
   */
  bool InitializeCodec();

  /**
   * Reinitialize codec after flush (FFmpeg enters EOF mode).
   * @return true on success, false on failure
   */
  bool ReinitializeCodec();

  /**
   * Emit an encoded packet via callback.
   */
  void EmitPacket(AVPacket* pkt);

  /**
   * Compute temporal layer ID for SVC.
   */
  int ComputeTemporalLayerId(int64_t frame_index) const;

  // Configuration
  VideoEncoderConfig config_;

  // FFmpeg resources (owned by this worker)
  const AVCodec* codec_ = nullptr;
  ffmpeg::AVCodecContextPtr codec_context_;
  ffmpeg::SwsContextPtr sws_context_;
  ffmpeg::AVFramePtr frame_;
  ffmpeg::AVPacketPtr packet_;

  // Frame tracking
  int64_t frame_count_ = 0;
  std::map<int64_t, std::pair<int64_t, int64_t>>
      frame_info_;  // frame_index -> (timestamp, duration)

  // Pending chunks counter (shared_ptr for safe access in TSFN callbacks)
  std::shared_ptr<std::atomic<int>> pending_chunks_ =
      std::make_shared<std::atomic<int>>(0);

  // Callbacks
  PacketOutputCallback packet_output_callback_;
  ErrorCallback error_output_callback_;
  FlushCallback flush_callback_;
  DequeueCallback dequeue_callback_;
};

}  // namespace webcodecs

#endif  // SRC_VIDEO_ENCODER_WORKER_H_
