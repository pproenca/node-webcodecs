// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#pragma once
/**
 * codec_worker.h - Template Worker Thread for WebCodecs Decoders/Encoders
 *
 * Provides a dedicated worker thread that:
 * - Owns the AVCodecContext exclusively (no mutex needed for codec ops)
 * - Processes messages from ControlMessageQueue in FIFO order
 * - Guarantees output ordering per W3C spec
 * - Handles lifecycle (Start/Stop) with proper shutdown
 *
 * Thread Safety:
 * - Main thread: Enqueue messages, Start/Stop worker
 * - Worker thread: Dequeue and process messages, FFmpeg calls
 * - Output via SafeThreadSafeFunction to JS thread
 *
 * Usage:
 *   class VideoDecoderWorker : public CodecWorker<VideoControlQueue> {
 *     void OnConfigure(const ConfigureMessage& msg) override;
 *     void OnDecode(const DecodeMessage& msg) override;
 *     // ...
 *   };
 *
 * @see https://www.w3.org/TR/webcodecs/#codec-processing-model
 */

#include <atomic>
#include <chrono>
#include <functional>
#include <memory>
#include <mutex>
#include <string>
#include <thread>
#include <utility>
#include <variant>

#include "../ffmpeg_raii.h"
#include "control_message_queue.h"
#include "safe_tsfn.h"

namespace webcodecs {

/**
 * Callback data types for TSFN delivery to JS thread.
 */
struct FrameOutputData {
  ffmpeg::AVFramePtr frame;
  int64_t timestamp;
  int64_t duration;
};

struct ErrorOutputData {
  int error_code;
  std::string message;
};

struct FlushCompleteData {
  uint32_t promise_id;
  bool success;
  std::string error_message;
};

struct DequeueEventData {
  uint32_t new_queue_size;
};

/**
 * Base template for codec worker threads.
 *
 * Subclasses implement codec-specific logic:
 * - OnConfigure: avcodec_open2, set codec parameters
 * - OnDecode: avcodec_send_packet, avcodec_receive_frame loop
 * - OnFlush: drain codec, resolve promise
 * - OnReset: avcodec_flush_buffers
 *
 * @tparam MessageQueue ControlMessageQueue type (VideoControlQueue or
 * AudioControlQueue)
 */
template <typename MessageQueue>
class CodecWorker {
 public:
  using ConfigureMessage = typename MessageQueue::ConfigureMessage;
  using DecodeMessage = typename MessageQueue::DecodeMessage;
  using EncodeMessage = typename MessageQueue::EncodeMessage;
  using FlushMessage = typename MessageQueue::FlushMessage;
  using ResetMessage = typename MessageQueue::ResetMessage;
  using CloseMessage = typename MessageQueue::CloseMessage;
  using Message = typename MessageQueue::Message;

  // Callback types for subclass to implement
  using OutputFrameCallback = std::function<void(ffmpeg::AVFramePtr frame)>;
  using OutputErrorCallback =
      std::function<void(int error_code, const std::string& message)>;
  using FlushCompleteCallback =
      std::function<void(uint32_t promise_id, bool success,
                         const std::string& error)>;
  using DequeueCallback = std::function<void(uint32_t new_queue_size)>;

  // ===========================================================================
  // CONSTRUCTOR / DESTRUCTOR
  // ===========================================================================

  /**
   * Construct worker with pointer to message queue.
   * Does NOT start the worker thread - call Start() explicitly.
   *
   * @param queue Pointer to the message queue (owned by parent codec, must
   * outlive worker)
   */
  explicit CodecWorker(MessageQueue* queue)
      : queue_(queue), running_(false), should_exit_(false) {}

  virtual ~CodecWorker() { Stop(); }

  // Non-copyable, non-movable (owns thread)
  CodecWorker(const CodecWorker&) = delete;
  CodecWorker& operator=(const CodecWorker&) = delete;
  CodecWorker(CodecWorker&&) = delete;
  CodecWorker& operator=(CodecWorker&&) = delete;

  // ===========================================================================
  // LIFECYCLE
  // ===========================================================================

  /**
   * Start the worker thread.
   * Safe to call multiple times (idempotent).
   *
   * @return true if worker started or already running, false on error
   */
  bool Start() {
    std::lock_guard<std::mutex> lock(lifecycle_mutex_);

    if (running_.load(std::memory_order_acquire)) {
      return true;  // Already running
    }

    should_exit_.store(false, std::memory_order_release);

    try {
      worker_thread_ = std::thread(&CodecWorker::WorkerLoop, this);
      running_.store(true, std::memory_order_release);
      return true;
    } catch (const std::exception&) {
      return false;
    }
  }

  /**
   * Stop the worker thread.
   * Signals shutdown, waits for thread to exit, then joins.
   * Safe to call multiple times (idempotent).
   *
   * After Stop(), the worker can be restarted with Start().
   */
  void Stop() {
    std::lock_guard<std::mutex> lock(lifecycle_mutex_);

    if (!running_.load(std::memory_order_acquire)) {
      return;  // Not running
    }

    // 1. Signal worker to exit
    should_exit_.store(true, std::memory_order_release);

    // 2. Shutdown the queue to unblock any waiting Dequeue()
    queue_->Shutdown();

    // 3. Join worker thread
    if (worker_thread_.joinable()) {
      worker_thread_.join();
    }

    running_.store(false, std::memory_order_release);
  }

  /**
   * Check if worker is currently running.
   */
  [[nodiscard]] bool IsRunning() const {
    return running_.load(std::memory_order_acquire);
  }

  /**
   * Check if worker should exit (for subclass use in long operations).
   */
  [[nodiscard]] bool ShouldExit() const {
    return should_exit_.load(std::memory_order_acquire);
  }

  // ===========================================================================
  // MESSAGE ENQUEUEING
  // ===========================================================================

  /**
   * Enqueue a message for processing.
   * Delegates to the underlying queue.
   *
   * @param msg The message to enqueue
   * @return true if message was enqueued, false if queue is closed
   */
  [[nodiscard]] bool Enqueue(Message msg) {
    return queue_->Enqueue(std::move(msg));
  }

  // ===========================================================================
  // CALLBACKS (set by parent codec)
  // ===========================================================================

  void SetOutputFrameCallback(OutputFrameCallback cb) {
    output_frame_callback_ = std::move(cb);
  }

  void SetOutputErrorCallback(OutputErrorCallback cb) {
    output_error_callback_ = std::move(cb);
  }

  void SetFlushCompleteCallback(FlushCompleteCallback cb) {
    flush_complete_callback_ = std::move(cb);
  }

  void SetDequeueCallback(DequeueCallback cb) {
    dequeue_callback_ = std::move(cb);
  }

 protected:
  // ===========================================================================
  // VIRTUAL HANDLERS (implement in subclass)
  // ===========================================================================

  /**
   * Handle Configure message.
   * Called on worker thread.
   *
   * Subclass should:
   * - Parse configuration
   * - Create codec context with avcodec_alloc_context3
   * - Set codec parameters
   * - Open codec with avcodec_open2
   * - Return success/failure
   *
   * @param msg Configure message with configuration function
   * @return true on success, false on failure (will trigger error callback)
   */
  virtual bool OnConfigure(const ConfigureMessage& msg) = 0;

  /**
   * Handle Decode message (for decoders).
   * Called on worker thread.
   *
   * Subclass should:
   * - avcodec_send_packet
   * - Loop avcodec_receive_frame until EAGAIN
   * - For each frame, call OutputFrame()
   * - Handle errors appropriately
   *
   * @param msg Decode message with packet
   */
  virtual void OnDecode(const DecodeMessage& msg) {
    // Default: no-op for encoders
    (void)msg;
  }

  /**
   * Handle Encode message (for encoders).
   * Called on worker thread.
   *
   * Subclass should:
   * - avcodec_send_frame
   * - Loop avcodec_receive_packet until EAGAIN
   * - For each packet, output via callback
   * - Handle errors appropriately
   *
   * @param msg Encode message with frame and keyFrame flag
   */
  virtual void OnEncode(const EncodeMessage& msg) {
    // Default: no-op for decoders
    (void)msg;
  }

  /**
   * Handle Flush message.
   * Called on worker thread.
   *
   * Subclass should:
   * - Send NULL packet to trigger drain
   * - Loop avcodec_receive_frame until EOF
   * - For each frame, call OutputFrame()
   * - Call FlushComplete() when done
   *
   * @param msg Flush message with promise_id
   */
  virtual void OnFlush(const FlushMessage& msg) = 0;

  /**
   * Handle Reset message.
   * Called on worker thread.
   *
   * Subclass should:
   * - avcodec_flush_buffers
   * - Reset internal state
   * - Set key chunk required
   */
  virtual void OnReset() = 0;

  /**
   * Handle Close message.
   * Called on worker thread before exit.
   *
   * Subclass should:
   * - Release codec context
   * - Clean up any resources
   *
   * Default implementation does nothing.
   */
  virtual void OnClose() {}

  // ===========================================================================
  // OUTPUT HELPERS (call from subclass)
  // ===========================================================================

  /**
   * Output a decoded frame.
   * Calls the output callback on worker thread (which will TSFN to JS).
   */
  void OutputFrame(ffmpeg::AVFramePtr frame) {
    if (output_frame_callback_) {
      output_frame_callback_(std::move(frame));
    }
  }

  /**
   * Signal an error.
   * Calls the error callback.
   */
  void OutputError(int error_code, const std::string& message) {
    if (output_error_callback_) {
      output_error_callback_(error_code, message);
    }
  }

  /**
   * Signal flush complete.
   * Resolves or rejects the flush promise.
   */
  void FlushComplete(uint32_t promise_id, bool success,
                     const std::string& error = "") {
    if (flush_complete_callback_) {
      flush_complete_callback_(promise_id, success, error);
    }
  }

  /**
   * Signal dequeue event.
   * Called after processing a decode message.
   */
  void SignalDequeue(uint32_t new_queue_size) {
    if (dequeue_callback_) {
      dequeue_callback_(new_queue_size);
    }
  }

  /**
   * Get pointer to the message queue.
   */
  MessageQueue* queue() { return queue_; }

 private:
  /**
   * Main worker loop.
   * Dequeues messages and dispatches to handlers.
   */
  void WorkerLoop() {
    while (!ShouldExit()) {
      // Dequeue with timeout to check for shutdown periodically
      auto msg_opt = queue_->DequeueFor(std::chrono::milliseconds(100));

      if (!msg_opt) {
        // Timeout or shutdown
        continue;
      }

      Message& msg = *msg_opt;

      // Dispatch based on message type
      std::visit(
          MessageVisitor{
              [this](ConfigureMessage& m) {
                bool success = OnConfigure(m);
                if (!success) {
                  // Configuration failed - error already signaled by subclass
                }
              },
              [this](DecodeMessage& m) { OnDecode(m); },
              [this](EncodeMessage& m) { OnEncode(m); },
              [this](FlushMessage& m) { OnFlush(m); },
              [this](ResetMessage&) { OnReset(); },
              [this](CloseMessage&) {
                OnClose();
                // Signal to exit after close
                should_exit_.store(true, std::memory_order_release);
              },
          },
          msg);
    }
  }

  // Message queue pointer (owned by parent codec, must outlive worker)
  MessageQueue* queue_;

  // Worker thread
  std::thread worker_thread_;
  std::mutex lifecycle_mutex_;
  std::atomic<bool> running_;
  std::atomic<bool> should_exit_;

  // Callbacks to parent codec
  OutputFrameCallback output_frame_callback_;
  OutputErrorCallback output_error_callback_;
  FlushCompleteCallback flush_complete_callback_;
  DequeueCallback dequeue_callback_;
};

// =============================================================================
// TYPE ALIASES
// =============================================================================

/**
 * Base class for video decoder workers.
 */
using VideoDecoderWorkerBase = CodecWorker<VideoControlQueue>;

/**
 * Base class for audio decoder workers.
 */
using AudioDecoderWorkerBase = CodecWorker<AudioControlQueue>;

/**
 * Base class for video encoder workers.
 */
using VideoEncoderWorkerBase = CodecWorker<VideoControlQueue>;

/**
 * Base class for audio encoder workers.
 */
using AudioEncoderWorkerBase = CodecWorker<AudioControlQueue>;

}  // namespace webcodecs
