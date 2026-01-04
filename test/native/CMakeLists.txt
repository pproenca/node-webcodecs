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

# C++17 required (matches binding.gyp)
set(CMAKE_CXX_STANDARD 17)
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
# FFMPEG
# =============================================================================

find_package(PkgConfig REQUIRED)
pkg_check_modules(FFMPEG REQUIRED
  libavcodec>=58.0
  libavformat>=58.0
  libavutil>=56.0
  libswscale>=5.0
  libswresample>=3.0
  libavfilter>=7.0
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
# TEST FILES
# =============================================================================

# Existing test
set(TEST_SOURCES
  ffmpeg_raii_test.cc
  test_main.cpp
)

# Unit tests (no FFmpeg codec operations required)
file(GLOB UNIT_TEST_SOURCES "unit/*.cpp")
list(APPEND TEST_SOURCES ${UNIT_TEST_SOURCES})

# Integration tests (require FFmpeg codec operations)
file(GLOB INTEGRATION_TEST_SOURCES "integration/*.cpp")
list(APPEND TEST_SOURCES ${INTEGRATION_TEST_SOURCES})

# Spec compliance tests
file(GLOB SPEC_TEST_SOURCES "spec/*.cpp")
list(APPEND TEST_SOURCES ${SPEC_TEST_SOURCES})

# Stress tests (thread safety, memory)
file(GLOB STRESS_TEST_SOURCES "stress/*.cpp")
list(APPEND TEST_SOURCES ${STRESS_TEST_SOURCES})

# =============================================================================
# TEST EXECUTABLE
# =============================================================================

add_executable(webcodecs_tests
  ${TEST_SOURCES}
  ${SOURCE_FILES}
)

target_include_directories(webcodecs_tests PRIVATE
  ${CMAKE_SOURCE_DIR}/../..  # Project root (for #include "src/...")
  ${FFMPEG_INCLUDE_DIRS}
  ${CMAKE_CURRENT_SOURCE_DIR}/mocks
  ${CMAKE_CURRENT_SOURCE_DIR}/helpers
)

target_link_directories(webcodecs_tests PRIVATE
  ${FFMPEG_LIBRARY_DIRS}
)

target_link_libraries(webcodecs_tests PRIVATE
  GTest::gtest
  GTest::gtest_main
  GTest::gmock
  ${FFMPEG_LIBRARIES}
)

# =============================================================================
# COMPILER FLAGS (Google C++ Style Guide)
# =============================================================================

# Platform-specific warnings
if(APPLE)
  target_compile_options(webcodecs_tests PRIVATE
    -Wall
    -Wextra
    -Wno-unused-parameter
    -Werror=return-type
    -Werror=uninitialized
  )
elseif(UNIX)
  target_compile_options(webcodecs_tests PRIVATE
    -Wall
    -Wextra
    -Wno-unused-parameter
    -Werror=return-type
    -Werror=uninitialized
    -fPIC
  )
elseif(WIN32)
  target_compile_options(webcodecs_tests PRIVATE
    /W4
    /WX  # Warnings as errors
  )
endif()

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

# =============================================================================
# INSTALLATION (Optional)
# =============================================================================

# Don't install test executable
# Tests are only for development/CI
