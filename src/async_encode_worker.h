// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// AsyncEncodeWorker for non-blocking video encoding.

#ifndef SRC_ASYNC_ENCODE_WORKER_H_
#define SRC_ASYNC_ENCODE_WORKER_H_

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavutil/imgutils.h>
#include <libswscale/swscale.h>
}

#include "src/ffmpeg_raii.h"

#include <napi.h>

#include <atomic>
#include <condition_variable>
#include <map>
#include <memory>
#include <mutex>
#include <queue>
#include <string>
#include <thread>
#include <utility>
#include <vector>

class VideoEncoder;

struct EncodeTask {
  std::vector<uint8_t> rgba_data;
  uint32_t width = 0;
  uint32_t height = 0;
  int64_t timestamp = 0;
  int64_t duration = 0;
  bool key_frame = false;
  bool is_flush = false;    // When true, flush the encoder instead of encoding
  int quantizer = -1;       // -1 means not specified, otherwise 0-63 range
  int64_t frame_index = 0;  // Sequential frame index for SVC layer computation
};

struct EncodedChunk {
  std::vector<uint8_t> data;
  int64_t timestamp;
  int64_t duration;
  bool is_key;
};

// Metadata config passed from VideoEncoder to AsyncEncodeWorker for output
struct EncoderMetadataConfig {
  std::string codec_string;
  int coded_width = 0;
  int coded_height = 0;
  int display_width = 0;
  int display_height = 0;
  std::string color_primaries;
  std::string color_transfer;
  std::string color_matrix;
  bool color_full_range = false;
  int temporal_layer_count = 1;  // From scalabilityMode (L1T1=1, L1T2=2, L1T3=3)
  // Note: extradata is copied from codec_context at emit time (may be set after
  // configure)
};

class AsyncEncodeWorker {
 public:
  explicit AsyncEncodeWorker(VideoEncoder* encoder,
                             Napi::ThreadSafeFunction output_tsfn,
                             Napi::ThreadSafeFunction error_tsfn);
  ~AsyncEncodeWorker();

  // Disallow copy and assign.
  AsyncEncodeWorker(const AsyncEncodeWorker&) = delete;
  AsyncEncodeWorker& operator=(const AsyncEncodeWorker&) = delete;

  void Start();
  void Stop();
  void Enqueue(EncodeTask task);
  void Flush();
  bool IsRunning() const { return running_.load(); }
  size_t QueueSize() const;
  int GetPendingChunks() const { return pending_chunks_->load(); }
  // Get shared pending counter for TSFN callbacks to capture
  std::shared_ptr<std::atomic<int>> GetPendingChunksPtr() const {
    return pending_chunks_;
  }
  void SetCodecContext(AVCodecContext* ctx, SwsContext* sws, int width,
                       int height);
  void SetMetadataConfig(const EncoderMetadataConfig& config);

 private:
  void WorkerThread();
  void ProcessFrame(const EncodeTask& task);
  void EmitChunk(AVPacket* packet);

  Napi::ThreadSafeFunction output_tsfn_;
  Napi::ThreadSafeFunction error_tsfn_;

  std::thread worker_thread_;
  std::queue<EncodeTask> task_queue_;
  mutable std::mutex queue_mutex_;  // mutable for const QueueSize()
  std::mutex codec_mutex_;  // Protects codec_context_, sws_context_, frame_, packet_, metadata_config_
  std::condition_variable queue_cv_;
  std::atomic<bool> running_{false};
  std::atomic<bool> flushing_{false};
  std::atomic<int> processing_{0};  // Track tasks currently being processed
  // DARWIN-X64 FIX: Guard against codec access during shutdown race window.
  // Set to true after SetCodecContext, false at START of Stop().
  // ProcessFrame checks this before accessing codec_context_.
  std::atomic<bool> codec_valid_{false};
  // Mutex to synchronize Stop() calls from Cleanup() and destructor
  std::mutex stop_mutex_;
  // Use shared_ptr for pending counter so TSFN callbacks can safely access it
  // even after the worker object is destroyed. The shared_ptr is captured by
  // the callback lambda, ensuring the atomic counter remains valid.
  std::shared_ptr<std::atomic<int>> pending_chunks_ =
      std::make_shared<std::atomic<int>>(0);

  // FFmpeg contexts (owned by VideoEncoder, just references here)
  AVCodecContext* codec_context_;
  SwsContext* sws_context_;
  ffmpeg::AVFramePtr frame_;       // RAII-managed, owned by this worker
  ffmpeg::AVPacketPtr packet_;     // RAII-managed, owned by this worker
  int width_;
  int height_;

  // Encoder metadata for output chunks
  EncoderMetadataConfig metadata_config_;

  // Map from frame_index (used as pts) to original timestamp/duration
  // Needed because packets may come out in different order due to B-frames
  std::map<int64_t, std::pair<int64_t, int64_t>> frame_info_;  // frame_index -> (timestamp, duration)
};

#endif  // SRC_ASYNC_ENCODE_WORKER_H_
