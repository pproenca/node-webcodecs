// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Test utilities for native C++ tests.
// Provides synchronization primitives and FFmpeg test object factories.

#ifndef TEST_NATIVE_HELPERS_TEST_UTILS_H_
#define TEST_NATIVE_HELPERS_TEST_UTILS_H_

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavutil/frame.h>
#include <libavutil/imgutils.h>
}

#include <chrono>
#include <condition_variable>
#include <cstring>
#include <mutex>

#include "src/ffmpeg_raii.h"

namespace webcodecs {
namespace testing {

// =============================================================================
// SYNCHRONIZATION PRIMITIVES
// =============================================================================

/**
 * SimpleLatch - C++17-compatible thread synchronization.
 * Waits for a condition to be signaled or timeout.
 */
class SimpleLatch {
 public:
  SimpleLatch() = default;

  /**
   * Wait for signal with optional timeout.
   * @param timeout Max wait duration (default: 5 seconds)
   * @return true if signaled, false if timeout
   */
  bool Wait(std::chrono::milliseconds timeout = std::chrono::seconds(5)) {
    std::unique_lock<std::mutex> lock(mutex_);
    return cv_.wait_for(lock, timeout, [this] { return signaled_; });
  }

  /**
   * Signal the latch, waking all waiters.
   */
  void Signal() {
    {
      std::lock_guard<std::mutex> lock(mutex_);
      signaled_ = true;
    }
    cv_.notify_all();
  }

  /**
   * Reset the latch for reuse.
   */
  void Reset() {
    std::lock_guard<std::mutex> lock(mutex_);
    signaled_ = false;
  }

 private:
  std::mutex mutex_;
  std::condition_variable cv_;
  bool signaled_ = false;
};

/**
 * CountDownLatch - Wait for N events before proceeding.
 */
class CountDownLatch {
 public:
  explicit CountDownLatch(int count) : count_(count) {}

  void CountDown() {
    std::unique_lock<std::mutex> lock(mutex_);
    if (--count_ <= 0) {
      cv_.notify_all();
    }
  }

  bool Wait(std::chrono::milliseconds timeout = std::chrono::seconds(5)) {
    std::unique_lock<std::mutex> lock(mutex_);
    return cv_.wait_for(lock, timeout, [this] { return count_ <= 0; });
  }

  void Reset(int count) {
    std::lock_guard<std::mutex> lock(mutex_);
    count_ = count;
  }

 private:
  std::mutex mutex_;
  std::condition_variable cv_;
  int count_;
};

// =============================================================================
// FFMPEG TEST OBJECT FACTORIES
// =============================================================================

/**
 * Create a test AVFrame with specified dimensions and format.
 * Frame buffer is allocated and initialized to zeros.
 *
 * @param width Frame width in pixels
 * @param height Frame height in pixels
 * @param format Pixel format (default: YUV420P)
 * @return Allocated and initialized frame, or nullptr on failure
 */
inline ffmpeg::AVFramePtr CreateTestFrame(int width,
                                          int height,
                                          AVPixelFormat format = AV_PIX_FMT_YUV420P) {
  ffmpeg::AVFramePtr frame = ffmpeg::make_frame();
  if (!frame) {
    return nullptr;
  }

  frame->width = width;
  frame->height = height;
  frame->format = format;

  // Allocate buffer for frame data
  int ret = av_frame_get_buffer(frame.get(), 32);  // 32-byte alignment
  if (ret < 0) {
    return nullptr;
  }

  // Initialize to zeros (black for luma, gray for chroma)
  av_frame_make_writable(frame.get());

  return frame;
}

/**
 * Create a test AVPacket with specified data.
 * Packet data is copied into the packet buffer.
 *
 * @param data Pointer to packet data
 * @param size Size of packet data in bytes
 * @param is_key Whether this is a keyframe packet
 * @return Allocated packet with data, or nullptr on failure
 */
inline ffmpeg::AVPacketPtr CreateTestPacket(const uint8_t* data,
                                            size_t size,
                                            bool is_key = true) {
  ffmpeg::AVPacketPtr packet = ffmpeg::make_packet();
  if (!packet) {
    return nullptr;
  }

  // Allocate packet data buffer
  int ret = av_new_packet(packet.get(), static_cast<int>(size));
  if (ret < 0) {
    return nullptr;
  }

  // Copy data into packet
  std::memcpy(packet->data, data, size);

  // Set keyframe flag
  if (is_key) {
    packet->flags |= AV_PKT_FLAG_KEY;
  }

  return packet;
}

/**
 * Create an empty test AVPacket (for testing allocation/deallocation).
 *
 * @return Allocated empty packet, or nullptr on failure
 */
inline ffmpeg::AVPacketPtr CreateEmptyPacket() {
  return ffmpeg::make_packet();
}

/**
 * Fill a frame with a solid color.
 * Useful for visual verification tests.
 *
 * @param frame Frame to fill (must be YUV420P format)
 * @param y Luma value (0-255)
 * @param u Chroma U value (0-255)
 * @param v Chroma V value (0-255)
 */
inline void FillFrameWithColor(AVFrame* frame, uint8_t y, uint8_t u, uint8_t v) {
  if (!frame || frame->format != AV_PIX_FMT_YUV420P) {
    return;
  }

  // Fill Y plane
  for (int row = 0; row < frame->height; ++row) {
    std::memset(frame->data[0] + row * frame->linesize[0], y, frame->width);
  }

  // Fill U and V planes (half resolution for 420)
  int chroma_height = frame->height / 2;
  int chroma_width = frame->width / 2;

  for (int row = 0; row < chroma_height; ++row) {
    std::memset(frame->data[1] + row * frame->linesize[1], u, chroma_width);
    std::memset(frame->data[2] + row * frame->linesize[2], v, chroma_width);
  }
}

/**
 * Compare two frames for pixel equality.
 * Frames must have same dimensions and format.
 *
 * @param a First frame
 * @param b Second frame
 * @return true if frames are pixel-identical, false otherwise
 */
inline bool FramesEqual(const AVFrame* a, const AVFrame* b) {
  if (!a || !b) {
    return false;
  }

  if (a->width != b->width || a->height != b->height || a->format != b->format) {
    return false;
  }

  // Compare each plane
  for (int plane = 0; plane < 3; ++plane) {
    if (!a->data[plane] || !b->data[plane]) {
      return false;
    }

    int height = (plane == 0) ? a->height : a->height / 2;
    int width = (plane == 0) ? a->width : a->width / 2;

    for (int row = 0; row < height; ++row) {
      const uint8_t* row_a = a->data[plane] + row * a->linesize[plane];
      const uint8_t* row_b = b->data[plane] + row * b->linesize[plane];

      if (std::memcmp(row_a, row_b, width) != 0) {
        return false;
      }
    }
  }

  return true;
}

}  // namespace testing
}  // namespace webcodecs

#endif  // TEST_NATIVE_HELPERS_TEST_UTILS_H_
