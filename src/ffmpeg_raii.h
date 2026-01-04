// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// RAII wrappers for FFmpeg types to ensure automatic resource cleanup.
// These eliminate the need for manual Cleanup() calls and prevent leaks.
//
// Usage:
//   AVFramePtr frame(av_frame_alloc());
//   if (!frame) { /* handle error */ }
//   // frame automatically freed when it goes out of scope
//
//   // Transfer ownership:
//   AVFrame* raw = frame.release();
//
//   // Reset with new value:
//   frame.reset(av_frame_alloc());

#ifndef SRC_FFMPEG_RAII_H_
#define SRC_FFMPEG_RAII_H_

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavfilter/avfilter.h>
#include <libavformat/avformat.h>
#include <libavutil/frame.h>
#include <libswresample/swresample.h>
#include <libswscale/swscale.h>
}

#include <memory>

namespace ffmpeg {

// AVFrame deleter - handles av_frame_free's double-pointer semantics
struct AVFrameDeleter {
  void operator()(AVFrame* frame) const noexcept {
    if (frame) {
      av_frame_free(&frame);
    }
  }
};

// AVPacket deleter
struct AVPacketDeleter {
  void operator()(AVPacket* packet) const noexcept {
    if (packet) {
      av_packet_free(&packet);
    }
  }
};

// AVCodecContext deleter
struct AVCodecContextDeleter {
  void operator()(AVCodecContext* ctx) const noexcept {
    if (ctx) {
      avcodec_free_context(&ctx);
    }
  }
};

// SwsContext deleter (swscale)
struct SwsContextDeleter {
  void operator()(SwsContext* ctx) const noexcept {
    if (ctx) {
      sws_freeContext(ctx);
    }
  }
};

// SwrContext deleter (swresample)
struct SwrContextDeleter {
  void operator()(SwrContext* ctx) const noexcept {
    if (ctx) {
      swr_free(&ctx);
    }
  }
};

// AVFormatContext deleter (for demuxing)
struct AVFormatContextDeleter {
  void operator()(AVFormatContext* ctx) const noexcept {
    if (ctx) {
      avformat_close_input(&ctx);
    }
  }
};

// AVFormatContext deleter (for muxing - uses different cleanup)
struct AVFormatContextOutputDeleter {
  void operator()(AVFormatContext* ctx) const noexcept {
    if (ctx) {
      if (ctx->pb) {
        avio_closep(&ctx->pb);
      }
      avformat_free_context(ctx);
    }
  }
};

// AVFilterGraph deleter
struct AVFilterGraphDeleter {
  void operator()(AVFilterGraph* graph) const noexcept {
    if (graph) {
      avfilter_graph_free(&graph);
    }
  }
};

// AVFilterInOut deleter
struct AVFilterInOutDeleter {
  void operator()(AVFilterInOut* inout) const noexcept {
    if (inout) {
      avfilter_inout_free(&inout);
    }
  }
};

// Forward declare MemoryBufferContext from image_decoder.cc
struct MemoryBufferContext;

// MemoryBufferContext deleter (custom delete)
// Used by ImageDecoder for in-memory buffer I/O context
struct MemoryBufferContextDeleter {
  void operator()(MemoryBufferContext* ctx) const noexcept { delete ctx; }
};

// AVIOContext deleter (handles avio_context_free semantics)
// NOTE: Also frees the internal buffer allocated with av_malloc
struct AVIOContextDeleter {
  void operator()(AVIOContext* ctx) const noexcept {
    if (ctx) {
      // Free the buffer allocated with av_malloc before freeing context
      if (ctx->buffer) {
        av_freep(&ctx->buffer);
      }
      avio_context_free(&ctx);
    }
  }
};

// AVFormatContext deleter for image decoding (uses alloc + close_input)
// Also cleans up associated AVIO context stored in ctx->pb
struct ImageFormatContextDeleter {
  void operator()(AVFormatContext* ctx) const noexcept {
    if (ctx) {
      // avformat_close_input handles both the context and its streams
      avformat_close_input(&ctx);
    }
  }
};

// Type aliases for convenient usage
using AVFramePtr = std::unique_ptr<AVFrame, AVFrameDeleter>;
using AVPacketPtr = std::unique_ptr<AVPacket, AVPacketDeleter>;
using AVCodecContextPtr =
    std::unique_ptr<AVCodecContext, AVCodecContextDeleter>;
using SwsContextPtr = std::unique_ptr<SwsContext, SwsContextDeleter>;
using SwrContextPtr = std::unique_ptr<SwrContext, SwrContextDeleter>;
using AVFormatContextPtr =
    std::unique_ptr<AVFormatContext, AVFormatContextDeleter>;
using AVFormatContextOutputPtr =
    std::unique_ptr<AVFormatContext, AVFormatContextOutputDeleter>;
using AVFilterGraphPtr = std::unique_ptr<AVFilterGraph, AVFilterGraphDeleter>;
using AVFilterInOutPtr = std::unique_ptr<AVFilterInOut, AVFilterInOutDeleter>;
using MemoryBufferContextPtr =
    std::unique_ptr<MemoryBufferContext, MemoryBufferContextDeleter>;
using AVIOContextPtr = std::unique_ptr<AVIOContext, AVIOContextDeleter>;
using ImageFormatContextPtr =
    std::unique_ptr<AVFormatContext, ImageFormatContextDeleter>;

// Factory functions for cleaner allocation
inline AVFramePtr make_frame() { return AVFramePtr(av_frame_alloc()); }

inline AVPacketPtr make_packet() { return AVPacketPtr(av_packet_alloc()); }

inline AVCodecContextPtr make_codec_context(const AVCodec* codec) {
  return AVCodecContextPtr(avcodec_alloc_context3(codec));
}

inline AVFilterGraphPtr make_filter_graph() {
  return AVFilterGraphPtr(avfilter_graph_alloc());
}

inline AVFilterInOutPtr make_filter_inout() {
  return AVFilterInOutPtr(avfilter_inout_alloc());
}

}  // namespace ffmpeg

#endif  // SRC_FFMPEG_RAII_H_
