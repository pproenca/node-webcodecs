// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// AsyncDecodeWorker for non-blocking video decoding.

#ifndef SRC_ASYNC_DECODE_WORKER_H_
#define SRC_ASYNC_DECODE_WORKER_H_

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavutil/imgutils.h>
#include <libswscale/swscale.h>
}

#include "src/ffmpeg_raii.h"

#include <napi.h>

#include <atomic>
#include <condition_variable>
#include <memory>
#include <mutex>
#include <queue>
#include <string>
#include <thread>
#include <vector>

class VideoDecoder;

// Metadata config for decoded video frames (mirrors EncoderMetadataConfig pattern)
struct DecoderMetadataConfig {
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

struct DecodeTask {
  std::vector<uint8_t> data;
  int64_t timestamp;
  int64_t duration;
  bool is_key;
  bool is_flush = false;  // When true, flush the decoder instead of decoding
};

struct DecodedFrame {
  std::vector<uint8_t> rgba_data;
  uint32_t width;
  uint32_t height;
  int64_t timestamp;
  int64_t duration;
};

class AsyncDecodeWorker {
 public:
  explicit AsyncDecodeWorker(VideoDecoder* decoder,
                             Napi::ThreadSafeFunction output_tsfn,
                             Napi::ThreadSafeFunction error_tsfn);
  ~AsyncDecodeWorker();

  // Disallow copy and assign.
  AsyncDecodeWorker(const AsyncDecodeWorker&) = delete;
  AsyncDecodeWorker& operator=(const AsyncDecodeWorker&) = delete;

  void Start();
  void Stop();
  void Enqueue(DecodeTask task);
  void Flush();
  void SetCodecContext(AVCodecContext* ctx, SwsContext* sws, int width,
                       int height);
  void SetMetadataConfig(const DecoderMetadataConfig& config);
  bool IsRunning() const { return running_.load(); }
  size_t QueueSize() const;
  int GetPendingFrames() const { return pending_frames_->load(); }
  // Get shared pending counter for TSFN callbacks to capture
  std::shared_ptr<std::atomic<int>> GetPendingFramesPtr() const {
    return pending_frames_;
  }

 private:
  void WorkerThread();
  void ProcessPacket(const DecodeTask& task);
  void EmitFrame(AVFrame* frame);

  Napi::ThreadSafeFunction output_tsfn_;
  Napi::ThreadSafeFunction error_tsfn_;

  std::thread worker_thread_;
  std::queue<DecodeTask> task_queue_;
  mutable std::mutex queue_mutex_;  // mutable for const QueueSize()
  std::condition_variable queue_cv_;
  std::mutex codec_mutex_;  // Protects codec_context_, sws_context_, frame_, packet_, metadata_config_
  std::atomic<bool> running_{false};
  std::atomic<bool> flushing_{false};
  std::atomic<int> processing_{0};  // Track tasks currently being processed
  // Use shared_ptr for pending counter so TSFN callbacks can safely access it
  // even after the worker object is destroyed. The shared_ptr is captured by
  // the callback lambda, ensuring the atomic counter remains valid.
  std::shared_ptr<std::atomic<int>> pending_frames_ =
      std::make_shared<std::atomic<int>>(0);

  // FFmpeg contexts (owned by VideoDecoder, just references here)
  AVCodecContext* codec_context_;
  SwsContext* sws_context_;  // Created lazily on first frame
  ffmpeg::AVFramePtr frame_;       // RAII-managed, owned by this worker
  ffmpeg::AVPacketPtr packet_;     // RAII-managed, owned by this worker
  int output_width_;
  int output_height_;

  // Track last frame format/dimensions for sws_context recreation
  AVPixelFormat last_frame_format_ = AV_PIX_FMT_NONE;
  int last_frame_width_ = 0;
  int last_frame_height_ = 0;

  // Buffer pool for decoded frame data to reduce allocations
  std::vector<std::vector<uint8_t>*> buffer_pool_;
  std::mutex pool_mutex_;

  // Decoder metadata for output frames
  DecoderMetadataConfig metadata_config_;

  std::vector<uint8_t>* AcquireBuffer(size_t size);
  void ReleaseBuffer(std::vector<uint8_t>* buffer);
};

#endif  // SRC_ASYNC_DECODE_WORKER_H_
