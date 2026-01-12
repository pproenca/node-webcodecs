# Copyright 2024 The node-webcodecs Authors
# SPDX-License-Identifier: MIT
#
# Native C++ tests for node-webcodecs
# Build with: mkdir build && cd build && cmake .. && make

cmake_minimum_required(VERSION 3.15)
project(node_webcodecs_tests CXX)

# =============================================================================
# C++ STANDARD
# =============================================================================

# C++20 required (matches binding.gyp for ABI compatibility)
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# =============================================================================
# GOOGLETEST
# =============================================================================

include(FetchContent)
FetchContent_Declare(
  googletest
  GIT_REPOSITORY https://github.com/google/googletest.git
  GIT_TAG v1.14.0
)

# For Windows: Prevent overriding parent project's compiler/linker settings
set(gtest_force_shared_crt ON CACHE BOOL "" FORCE)

FetchContent_MakeAvailable(googletest)

# =============================================================================
# FFMPEG (5.0+ required per CLAUDE.md)
# =============================================================================

find_package(PkgConfig REQUIRED)
pkg_check_modules(FFMPEG REQUIRED IMPORTED_TARGET
  libavcodec>=59.0      # FFmpeg 5.0+
  libavformat>=59.0     # FFmpeg 5.0+
  libavutil>=57.0       # FFmpeg 5.0+
  libswscale>=6.0       # FFmpeg 5.0+
  libswresample>=4.0    # FFmpeg 5.0+
  libavfilter>=8.0      # FFmpeg 5.0+
)

# =============================================================================
# SOURCE FILES UNDER TEST
# =============================================================================

# Include only header-only and template code
# Full worker implementations will be tested as black boxes via their APIs
# Note: error_builder and common require N-API, excluded for now
set(SOURCE_FILES
  ../../src/ffmpeg_raii.h
  ../../src/shared/control_message_queue.h
  ../../src/shared/codec_worker.h
  ../../src/shared/safe_tsfn.h
)

# =============================================================================
# TEST FILES (explicit list - CMake best practice)
# =============================================================================

# Core test files
set(TEST_SOURCES
  ffmpeg_raii_test.cc
  test_main.cpp
)

# Unit tests (no FFmpeg codec operations required)
set(UNIT_TEST_SOURCES
  unit/test_control_message_queue.cpp
)

# Spec compliance tests
set(SPEC_TEST_SOURCES
  spec/test_flush_semantics.cpp
  spec/test_queue_semantics.cpp
  spec/test_reset_semantics.cpp
  spec/test_saturation_detection.cpp
  spec/test_state_machine.cpp
)

# Stress tests (thread safety, memory)
set(STRESS_TEST_SOURCES
  stress/test_concurrent_operations.cpp
  stress/test_memory_leaks.cpp
)

# Combine all test sources
list(APPEND TEST_SOURCES
  ${UNIT_TEST_SOURCES}
  ${SPEC_TEST_SOURCES}
  ${STRESS_TEST_SOURCES}
)

# =============================================================================
# COMPILER OPTIONS HELPER (reusable for tests and benchmarks)
# =============================================================================

function(webcodecs_set_compile_options target)
  if(APPLE)
    target_compile_options(${target} PRIVATE
      -Wall -Wextra -Wno-unused-parameter
      -Werror=return-type -Werror=uninitialized
    )
  elseif(UNIX)
    target_compile_options(${target} PRIVATE
      -Wall -Wextra -Wno-unused-parameter
      -Werror=return-type -Werror=uninitialized -fPIC
    )
  elseif(WIN32)
    target_compile_options(${target} PRIVATE /W4 /WX)
  endif()
endfunction()

# =============================================================================
# TEST EXECUTABLE
# =============================================================================

add_executable(webcodecs_tests
  ${TEST_SOURCES}
  ${SOURCE_FILES}
)
add_executable(WebCodecs::tests ALIAS webcodecs_tests)

target_include_directories(webcodecs_tests PRIVATE
  ${CMAKE_SOURCE_DIR}/../..  # Project root (for #include "src/...")
  ${CMAKE_CURRENT_SOURCE_DIR}/mocks
  ${CMAKE_CURRENT_SOURCE_DIR}/helpers
)

# Use imported target - no target_link_directories needed
target_link_libraries(webcodecs_tests PRIVATE
  GTest::gtest
  GTest::gtest_main
  GTest::gmock
  PkgConfig::FFMPEG
)

# Apply common compiler options
webcodecs_set_compile_options(webcodecs_tests)

# =============================================================================
# SANITIZERS (Optional)
# =============================================================================

option(SANITIZE "Enable AddressSanitizer, LeakSanitizer, and UndefinedBehaviorSanitizer" OFF)

if(SANITIZE)
  message(STATUS "Sanitizers enabled: ASan, LSan, UBSan")
  if(CMAKE_CXX_COMPILER_ID MATCHES "Clang|GNU")
    target_compile_options(webcodecs_tests PRIVATE
      -fsanitize=address,undefined
      -fno-omit-frame-pointer
      -g
    )
    target_link_options(webcodecs_tests PRIVATE
      -fsanitize=address,undefined
    )
  else()
    message(WARNING "Sanitizers not supported on this compiler")
  endif()
endif()

option(TSAN "Enable ThreadSanitizer (mutually exclusive with ASan)" OFF)

if(TSAN)
  message(STATUS "ThreadSanitizer enabled")
  if(SANITIZE)
    message(FATAL_ERROR "Cannot enable both SANITIZE (ASan) and TSAN simultaneously")
  endif()
  if(CMAKE_CXX_COMPILER_ID MATCHES "Clang|GNU")
    target_compile_options(webcodecs_tests PRIVATE
      -fsanitize=thread
      -fno-omit-frame-pointer
      -g
    )
    target_link_options(webcodecs_tests PRIVATE
      -fsanitize=thread
    )
  else()
    message(WARNING "ThreadSanitizer not supported on this compiler")
  endif()
endif()

# =============================================================================
# COVERAGE (Optional)
# =============================================================================

option(COVERAGE "Enable code coverage reporting" OFF)

if(COVERAGE)
  message(STATUS "Code coverage enabled")
  if(CMAKE_CXX_COMPILER_ID MATCHES "Clang|GNU")
    target_compile_options(webcodecs_tests PRIVATE
      --coverage
      -g
      -O0
    )
    target_link_options(webcodecs_tests PRIVATE
      --coverage
    )
  else()
    message(WARNING "Coverage not supported on this compiler")
  endif()
endif()

# =============================================================================
# GOOGLE BENCHMARK (Performance Tests)
# =============================================================================

option(BUILD_BENCHMARKS "Build performance benchmarks" OFF)

if(BUILD_BENCHMARKS)
  message(STATUS "Building performance benchmarks")

  FetchContent_Declare(
    benchmark
    GIT_REPOSITORY https://github.com/google/benchmark.git
    GIT_TAG v1.8.3
  )

  set(BENCHMARK_ENABLE_TESTING OFF CACHE BOOL "" FORCE)
  set(BENCHMARK_ENABLE_GTEST_TESTS OFF CACHE BOOL "" FORCE)

  FetchContent_MakeAvailable(benchmark)

  # Benchmark sources (explicit list - CMake best practice)
  set(BENCHMARK_SOURCES
    benchmark/codec_throughput.cpp
    benchmark/queue_performance.cpp
    benchmark/raii_overhead.cpp
  )

  add_executable(webcodecs_benchmarks
    ${BENCHMARK_SOURCES}
    ${SOURCE_FILES}
  )
  add_executable(WebCodecs::benchmarks ALIAS webcodecs_benchmarks)

  target_include_directories(webcodecs_benchmarks PRIVATE
    ${CMAKE_SOURCE_DIR}/../..
    ${CMAKE_CURRENT_SOURCE_DIR}/mocks
    ${CMAKE_CURRENT_SOURCE_DIR}/helpers
  )

  # Use imported target - no target_link_directories needed
  target_link_libraries(webcodecs_benchmarks PRIVATE
    benchmark::benchmark
    benchmark::benchmark_main
    PkgConfig::FFMPEG
  )

  # Apply common compiler options + benchmark-specific optimization
  webcodecs_set_compile_options(webcodecs_benchmarks)
  target_compile_options(webcodecs_benchmarks PRIVATE -O3)
  target_compile_definitions(webcodecs_benchmarks PRIVATE NDEBUG)

  add_custom_target(run_benchmarks
    COMMAND webcodecs_benchmarks
    DEPENDS webcodecs_benchmarks
    WORKING_DIRECTORY ${CMAKE_BINARY_DIR}
    COMMENT "Running performance benchmarks..."
  )
endif()

# =============================================================================
# TESTING
# =============================================================================

enable_testing()
include(GoogleTest)
gtest_discover_tests(webcodecs_tests)

# Convenience target: `make test` or `make run_tests`
add_custom_target(run_tests
  COMMAND webcodecs_tests
  DEPENDS webcodecs_tests
  WORKING_DIRECTORY ${CMAKE_BINARY_DIR}
  COMMENT "Running all native tests..."
)

# macOS leaks detection
if(APPLE)
  add_custom_target(run_tests_leaks
    COMMAND leaks --atExit -- ./webcodecs_tests --gtest_brief=1
    DEPENDS webcodecs_tests
    WORKING_DIRECTORY ${CMAKE_BINARY_DIR}
    COMMENT "Running tests with macOS leaks detection..."
  )
endif()

# =============================================================================
# INSTALLATION (Optional)
# =============================================================================

# Don't install test executable
# Tests are only for development/CI
