// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// AsyncDecodeWorker for non-blocking video decoding.

#ifndef SRC_ASYNC_DECODE_WORKER_H_
#define SRC_ASYNC_DECODE_WORKER_H_

#include <napi.h>

#include <atomic>
#include <condition_variable>
#include <mutex>
#include <queue>
#include <thread>
#include <vector>

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavutil/imgutils.h>
#include <libswscale/swscale.h>
}

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
  AsyncDecodeWorker(VideoDecoder* decoder,
                    Napi::ThreadSafeFunction output_tsfn,
                    Napi::ThreadSafeFunction error_tsfn);
  ~AsyncDecodeWorker();

  void Start();
  void Stop();
  void Enqueue(DecodeTask task);
  void Flush();
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
  std::mutex queue_mutex_;
  std::condition_variable queue_cv_;
  std::atomic<bool> running_{false};
  std::atomic<bool> flushing_{false};

  // FFmpeg contexts (owned by VideoDecoder, just references here)
  AVCodecContext* codec_context_;
  SwsContext* sws_context_;
};

#endif  // SRC_ASYNC_DECODE_WORKER_H_
