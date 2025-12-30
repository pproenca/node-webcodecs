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

#include <napi.h>

#include <atomic>
#include <condition_variable>
#include <mutex>
#include <queue>
#include <thread>
#include <vector>

class VideoEncoder;

struct EncodeTask {
  std::vector<uint8_t> rgba_data;
  uint32_t width;
  uint32_t height;
  int64_t timestamp;
  int64_t duration;
  bool key_frame;
};

struct EncodedChunk {
  std::vector<uint8_t> data;
  int64_t timestamp;
  int64_t duration;
  bool is_key;
};

class AsyncEncodeWorker {
 public:
  explicit AsyncEncodeWorker(VideoEncoder* encoder,
                             Napi::ThreadSafeFunction output_tsfn,
                             Napi::ThreadSafeFunction error_tsfn);
  ~AsyncEncodeWorker();

  void Start();
  void Stop();
  void Enqueue(EncodeTask task);
  void Flush();
  bool IsRunning() const { return running_.load(); }
  size_t QueueSize() const;
  void SetCodecContext(AVCodecContext* ctx, SwsContext* sws,
                       int width, int height);

 private:
  void WorkerThread();
  void ProcessFrame(const EncodeTask& task);
  void EmitChunk(AVPacket* packet);

  VideoEncoder* encoder_;
  Napi::ThreadSafeFunction output_tsfn_;
  Napi::ThreadSafeFunction error_tsfn_;

  std::thread worker_thread_;
  std::queue<EncodeTask> task_queue_;
  mutable std::mutex queue_mutex_;  // mutable for const QueueSize()
  std::condition_variable queue_cv_;
  std::atomic<bool> running_{false};
  std::atomic<bool> flushing_{false};

  // FFmpeg contexts (owned by VideoEncoder, just references here)
  AVCodecContext* codec_context_;
  SwsContext* sws_context_;
  AVFrame* frame_;
  AVPacket* packet_;
  int width_;
  int height_;
};

#endif  // SRC_ASYNC_ENCODE_WORKER_H_
