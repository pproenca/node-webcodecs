// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Native unit tests for FFmpeg RAII wrappers.
// Run with: cmake -DBUILD_NATIVE_TESTS=ON .. && make && ctest

#include <gtest/gtest.h>

#include "src/ffmpeg_raii.h"

namespace {

// Test that AVFramePtr properly manages AVFrame lifecycle
TEST(FFmpegRAIITest, AVFramePtr_CreateAndDestroy) {
  ffmpeg::AVFramePtr frame = ffmpeg::make_frame();
  ASSERT_NE(frame.get(), nullptr);

  // Verify we can access the frame
  frame->width = 1920;
  frame->height = 1080;
  EXPECT_EQ(frame->width, 1920);
  EXPECT_EQ(frame->height, 1080);

  // Frame will be automatically freed when going out of scope
}

TEST(FFmpegRAIITest, AVFramePtr_MoveSemantics) {
  ffmpeg::AVFramePtr frame1 = ffmpeg::make_frame();
  ASSERT_NE(frame1.get(), nullptr);

  AVFrame* raw_ptr = frame1.get();

  // Move to another ptr
  ffmpeg::AVFramePtr frame2 = std::move(frame1);

  // frame1 should now be nullptr
  EXPECT_EQ(frame1.get(), nullptr);

  // frame2 should have the original pointer
  EXPECT_EQ(frame2.get(), raw_ptr);
}

TEST(FFmpegRAIITest, AVFramePtr_Release) {
  ffmpeg::AVFramePtr frame = ffmpeg::make_frame();
  AVFrame* raw = frame.release();

  EXPECT_EQ(frame.get(), nullptr);
  EXPECT_NE(raw, nullptr);

  // Manual cleanup required after release
  av_frame_free(&raw);
}

TEST(FFmpegRAIITest, AVFramePtr_Reset) {
  ffmpeg::AVFramePtr frame = ffmpeg::make_frame();
  AVFrame* old_ptr = frame.get();

  // Reset with new frame
  frame.reset(av_frame_alloc());

  EXPECT_NE(frame.get(), old_ptr);
  EXPECT_NE(frame.get(), nullptr);
}

// Test that AVPacketPtr properly manages AVPacket lifecycle
TEST(FFmpegRAIITest, AVPacketPtr_CreateAndDestroy) {
  ffmpeg::AVPacketPtr packet = ffmpeg::make_packet();
  ASSERT_NE(packet.get(), nullptr);

  // Packet will be automatically freed when going out of scope
}

// Test that AVCodecContextPtr properly manages AVCodecContext lifecycle
TEST(FFmpegRAIITest, AVCodecContextPtr_CreateAndDestroy) {
  const AVCodec* codec = avcodec_find_encoder(AV_CODEC_ID_H264);
  if (!codec) {
    GTEST_SKIP() << "H.264 encoder not available";
  }

  ffmpeg::AVCodecContextPtr ctx = ffmpeg::make_codec_context(codec);
  ASSERT_NE(ctx.get(), nullptr);

  // Verify we can configure the context
  ctx->width = 1920;
  ctx->height = 1080;
  ctx->bit_rate = 1000000;

  EXPECT_EQ(ctx->width, 1920);
  EXPECT_EQ(ctx->height, 1080);

  // Context will be automatically freed when going out of scope
}

// Test that SwsContextPtr properly manages SwsContext lifecycle
TEST(FFmpegRAIITest, SwsContextPtr_CreateAndDestroy) {
  SwsContext* raw_ctx = sws_getContext(
      1920, 1080, AV_PIX_FMT_RGBA,    // source
      1920, 1080, AV_PIX_FMT_YUV420P, // dest
      SWS_BILINEAR, nullptr, nullptr, nullptr);

  ASSERT_NE(raw_ctx, nullptr);

  ffmpeg::SwsContextPtr ctx(raw_ctx);
  EXPECT_EQ(ctx.get(), raw_ctx);

  // Context will be automatically freed when going out of scope
}

// Test that AVFilterGraphPtr properly manages AVFilterGraph lifecycle
TEST(FFmpegRAIITest, AVFilterGraphPtr_CreateAndDestroy) {
  ffmpeg::AVFilterGraphPtr graph = ffmpeg::make_filter_graph();
  ASSERT_NE(graph.get(), nullptr);

  // Graph will be automatically freed when going out of scope
}

// Test nullptr handling
TEST(FFmpegRAIITest, NullptrHandling) {
  // All deleters should handle nullptr gracefully
  ffmpeg::AVFramePtr null_frame(nullptr);
  ffmpeg::AVPacketPtr null_packet(nullptr);
  ffmpeg::AVCodecContextPtr null_ctx(nullptr);
  ffmpeg::SwsContextPtr null_sws(nullptr);
  ffmpeg::AVFilterGraphPtr null_graph(nullptr);

  EXPECT_EQ(null_frame.get(), nullptr);
  EXPECT_EQ(null_packet.get(), nullptr);
  EXPECT_EQ(null_ctx.get(), nullptr);
  EXPECT_EQ(null_sws.get(), nullptr);
  EXPECT_EQ(null_graph.get(), nullptr);

  // All should destruct without crashing
}

// Test RAII with scope
TEST(FFmpegRAIITest, ScopeBasedCleanup) {
  AVFrame* leaked_ptr = nullptr;

  {
    ffmpeg::AVFramePtr frame = ffmpeg::make_frame();
    leaked_ptr = frame.get();
    ASSERT_NE(leaked_ptr, nullptr);

    // Frame is alive here
    frame->width = 100;
  }

  // Frame should be freed now
  // Note: We can't verify this directly without ASan/Valgrind,
  // but the test documents expected behavior
}

}  // namespace
