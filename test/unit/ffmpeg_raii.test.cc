// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Unit tests for RAII wrappers in ffmpeg_raii.h
// This test verifies MemoryBufferContextPtr behavior without FFmpeg deps

#include <cassert>
#include <cstdio>
#include <memory>

namespace ffmpeg {

// Define MemoryBufferContext for testing (tracks deletion)
// In production, this will be defined in image_decoder.cc
struct MemoryBufferContext {
  int value;
  bool* deleted_flag;
  ~MemoryBufferContext() {
    if (deleted_flag) *deleted_flag = true;
  }
};

// MemoryBufferContext deleter (custom delete)
// Mirrors the deleter that will be added to ffmpeg_raii.h
struct MemoryBufferContextDeleter {
  void operator()(MemoryBufferContext* ctx) const noexcept { delete ctx; }
};

using MemoryBufferContextPtr =
    std::unique_ptr<MemoryBufferContext, MemoryBufferContextDeleter>;

}  // namespace ffmpeg

void test_memory_buffer_context_deleter() {
  bool deleted = false;
  {
    ffmpeg::MemoryBufferContext* ctx =
        new ffmpeg::MemoryBufferContext{42, &deleted};
    ffmpeg::MemoryBufferContextPtr ptr(ctx);
    assert(ptr->value == 42);
  }  // ptr goes out of scope
  assert(deleted == true);  // Deleter called delete
  printf("PASS: test_memory_buffer_context_deleter\n");
}

int main() {
  test_memory_buffer_context_deleter();
  printf("All tests passed!\n");
  return 0;
}
