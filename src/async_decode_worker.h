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

#include <napi.h>

#include <atomic>
#include <condition_variable>
#include <mutex>
#include <queue>
#include <thread>
#include <vector>

class VideoDecoder;

struct DecodeTask {
  std::vector<uint8_t> data;
  int64_t timestamp;
  int64_t duration;
  bool is_key;
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
  void SetCodecContext(AVCodecContext* ctx, SwsContext* sws,
                       int width, int height);
  bool IsRunning() const { return running_.load(); }
  size_t QueueSize() const;

 private:
  void WorkerThread();
  void ProcessPacket(const DecodeTask& task);
  void EmitFrame(AVFrame* frame);

  VideoDecoder* decoder_;
  Napi::ThreadSafeFunction output_tsfn_;
  Napi::ThreadSafeFunction error_tsfn_;

  std::thread worker_thread_;
  std::queue<DecodeTask> task_queue_;
  mutable std::mutex queue_mutex_;  // mutable for const QueueSize()
  std::condition_variable queue_cv_;
  std::atomic<bool> running_{false};
  std::atomic<bool> flushing_{false};

  // FFmpeg contexts (owned by VideoDecoder, just references here)
  AVCodecContext* codec_context_;
  SwsContext* sws_context_;
  AVFrame* frame_;
  AVPacket* packet_;
  int output_width_;
  int output_height_;
};

#endif  // SRC_ASYNC_DECODE_WORKER_H_
