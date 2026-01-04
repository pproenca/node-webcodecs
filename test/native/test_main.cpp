// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// GoogleTest main entry point for native C++ tests.

#include <gtest/gtest.h>

extern "C" {
#include <libavutil/log.h>
}

/**
 * Custom test environment for FFmpeg initialization.
 * Sets FFmpeg log level to reduce noise during test runs.
 */
class FFmpegTestEnvironment : public ::testing::Environment {
 public:
  void SetUp() override {
    // Reduce FFmpeg log noise during tests
    // AV_LOG_ERROR = only show errors
    // AV_LOG_WARNING = show warnings and errors
    // AV_LOG_QUIET = silence all output
    av_log_set_level(AV_LOG_ERROR);
  }

  void TearDown() override {
    // No cleanup needed
  }
};

int main(int argc, char** argv) {
  ::testing::InitGoogleTest(&argc, argv);

  // Register custom environment for FFmpeg setup
  ::testing::AddGlobalTestEnvironment(new FFmpegTestEnvironment());

  return RUN_ALL_TESTS();
}
