// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// State machine tests for W3C WebCodecs spec compliance.
// Validates state transitions per spec 7.15 (CodecState).
//
// Spec reference: docs/specs/7-configurations/7.15-codecstate.md
//
// NOTE: State machine is implemented in TypeScript layer (lib/*.ts).
// These tests validate that the control queue semantics SUPPORT correct
// state machine behavior by simulating the state transitions.

#include <gtest/gtest.h>
#include <gmock/gmock.h>

#include <atomic>
#include <functional>
#include <string>

#include "src/shared/control_message_queue.h"
#include "test_utils.h"

using namespace webcodecs;
using namespace webcodecs::testing;

// =============================================================================
// STATE MACHINE SIMULATOR
// =============================================================================

/**
 * Simulates W3C WebCodecs state machine for testing.
 * Implements the three states: unconfigured, configured, closed.
 */
class CodecStateMachine {
 public:
  enum class State {
    kUnconfigured,  // Initial state
    kConfigured,    // After successful configure()
    kClosed         // After close() or fatal error (irreversible)
  };

  enum class ErrorType {
    kNone,
    kInvalidStateError,  // Operation in wrong state
    kNotSupportedError,  // Unsupported codec
    kDataError,          // Invalid chunk data (e.g., missing key chunk)
    kEncodingError,      // Codec implementation failure
    kAbortError          // User-initiated abort (reset/close)
  };

  struct Error {
    ErrorType type = ErrorType::kNone;
    std::string message;

    bool IsError() const { return type != ErrorType::kNone; }
  };

  CodecStateMachine() : state_(State::kUnconfigured) {}

  // State queries
  State GetState() const { return state_; }
  bool IsConfigured() const { return state_ == State::kConfigured; }
  bool IsClosed() const { return state_ == State::kClosed; }

  // State transitions per W3C spec

  /**
   * Configure codec.
   * Valid states: unconfigured, configured
   * Invalid states: closed
   * Per spec 6.5.1 (VideoEncoder configure algorithm)
   */
  Error Configure(bool success = true) {
    if (state_ == State::kClosed) {
      return {ErrorType::kInvalidStateError,
              "Cannot configure closed codec"};
    }

    if (!success) {
      // Configure failure closes codec per spec
      state_ = State::kClosed;
      return {ErrorType::kNotSupportedError, "Configuration failed"};
    }

    state_ = State::kConfigured;
    return {ErrorType::kNone, ""};
  }

  /**
   * Encode/Decode operation.
   * Valid states: configured
   * Invalid states: unconfigured, closed
   * Per spec 6.5.2 (VideoEncoder encode algorithm)
   */
  Error Encode() {
    if (state_ == State::kClosed) {
      return {ErrorType::kInvalidStateError,
              "Cannot encode on closed codec"};
    }
    if (state_ == State::kUnconfigured) {
      return {ErrorType::kInvalidStateError,
              "Cannot encode on unconfigured codec"};
    }
    return {ErrorType::kNone, ""};
  }

  Error Decode(bool is_key_chunk = true) {
    if (state_ == State::kClosed) {
      return {ErrorType::kInvalidStateError,
              "Cannot decode on closed codec"};
    }
    if (state_ == State::kUnconfigured) {
      return {ErrorType::kInvalidStateError,
              "Cannot decode on unconfigured codec"};
    }

    // Key chunk requirement per spec 4.5.3
    if (key_chunk_required_ && !is_key_chunk) {
      return {ErrorType::kDataError,
              "First chunk after configure/flush must be key chunk"};
    }

    key_chunk_required_ = false;
    return {ErrorType::kNone, ""};
  }

  /**
   * Flush operation.
   * Valid states: configured
   * Invalid states: unconfigured, closed
   * Per spec 4.5.4 (VideoDecoder flush algorithm)
   */
  Error Flush() {
    if (state_ == State::kClosed) {
      return {ErrorType::kInvalidStateError,
              "Cannot flush closed codec"};
    }
    if (state_ == State::kUnconfigured) {
      return {ErrorType::kInvalidStateError,
              "Cannot flush unconfigured codec"};
    }

    // Flush sets key_chunk_required per spec
    key_chunk_required_ = true;
    return {ErrorType::kNone, ""};
  }

  /**
   * Reset operation.
   * Valid states: unconfigured, configured
   * Invalid states: closed
   * Per spec 4.6 (VideoDecoder reset algorithm)
   */
  Error Reset() {
    if (state_ == State::kClosed) {
      return {ErrorType::kInvalidStateError,
              "Cannot reset closed codec"};
    }

    // Reset maintains configured state but clears queue
    // Sets key_chunk_required for decoders per spec
    key_chunk_required_ = true;
    return {ErrorType::kNone, ""};
  }

  /**
   * Close operation.
   * Valid states: all
   * Invalid states: none (close is always valid)
   * Per spec 4.6 (VideoDecoder close algorithm)
   *
   * @param error Optional error that caused close (nullptr = user-initiated)
   */
  Error Close(const Error* error = nullptr) {
    State old_state = state_;
    state_ = State::kClosed;

    // Per spec: AbortError does NOT trigger error callback
    if (error && error->type == ErrorType::kAbortError) {
      return {ErrorType::kNone, ""};
    }

    // If closing due to error, return that error
    if (error && error->IsError()) {
      return *error;
    }

    // User-initiated close
    return {ErrorType::kAbortError,
            old_state == State::kClosed ? "Already closed" : "Closed"};
  }

  /**
   * Simulate encoding/decoding error that closes codec.
   * Per spec: EncodingError closes codec and triggers error callback.
   */
  Error SimulateCodecError(const std::string& message) {
    state_ = State::kClosed;
    return {ErrorType::kEncodingError, message};
  }

  // Test helpers
  void ResetKeyChunkRequired() { key_chunk_required_ = false; }
  bool IsKeyChunkRequired() const { return key_chunk_required_; }

 private:
  State state_;
  bool key_chunk_required_ = true;  // Decoders start requiring key chunk
};

// =============================================================================
// TEST FIXTURE
// =============================================================================

class StateMachineTest : public ::testing::Test {
 protected:
  CodecStateMachine codec_;
};

// =============================================================================
// HAPPY PATH TESTS - STATE TRANSITIONS
// =============================================================================

TEST_F(StateMachineTest, InitialState_IsUnconfigured) {
  EXPECT_EQ(codec_.GetState(), CodecStateMachine::State::kUnconfigured);
  EXPECT_FALSE(codec_.IsConfigured());
  EXPECT_FALSE(codec_.IsClosed());
}

TEST_F(StateMachineTest, Configure_FromUnconfigured_TransitionsToConfigured) {
  auto error = codec_.Configure(true);

  EXPECT_FALSE(error.IsError());
  EXPECT_EQ(codec_.GetState(), CodecStateMachine::State::kConfigured);
  EXPECT_TRUE(codec_.IsConfigured());
}

TEST_F(StateMachineTest, Configure_Reconfigure_MaintainsConfigured) {
  codec_.Configure(true);
  EXPECT_EQ(codec_.GetState(), CodecStateMachine::State::kConfigured);

  // Reconfigure while already configured
  auto error = codec_.Configure(true);

  EXPECT_FALSE(error.IsError());
  EXPECT_EQ(codec_.GetState(), CodecStateMachine::State::kConfigured);
}

TEST_F(StateMachineTest, Encode_AfterConfigure_Succeeds) {
  codec_.Configure(true);

  auto error = codec_.Encode();

  EXPECT_FALSE(error.IsError());
  EXPECT_EQ(codec_.GetState(), CodecStateMachine::State::kConfigured);
}

TEST_F(StateMachineTest, Decode_WithKeyChunk_AfterConfigure_Succeeds) {
  codec_.Configure(true);

  auto error = codec_.Decode(true);  // is_key_chunk = true

  EXPECT_FALSE(error.IsError());
  EXPECT_EQ(codec_.GetState(), CodecStateMachine::State::kConfigured);
  EXPECT_FALSE(codec_.IsKeyChunkRequired());
}

TEST_F(StateMachineTest, Decode_NonKeyChunk_AfterKeyChunk_Succeeds) {
  codec_.Configure(true);
  codec_.Decode(true);  // First chunk is key

  auto error = codec_.Decode(false);  // Second chunk can be delta

  EXPECT_FALSE(error.IsError());
  EXPECT_EQ(codec_.GetState(), CodecStateMachine::State::kConfigured);
}

TEST_F(StateMachineTest, Flush_AfterConfigure_Succeeds) {
  codec_.Configure(true);

  auto error = codec_.Flush();

  EXPECT_FALSE(error.IsError());
  EXPECT_EQ(codec_.GetState(), CodecStateMachine::State::kConfigured);
}

TEST_F(StateMachineTest, Flush_SetsKeyChunkRequired) {
  codec_.Configure(true);
  codec_.Decode(true);  // Clear key chunk requirement
  EXPECT_FALSE(codec_.IsKeyChunkRequired());

  codec_.Flush();

  // Per spec 4.5.4: flush sets [[key chunk required]] = true
  EXPECT_TRUE(codec_.IsKeyChunkRequired());
}

TEST_F(StateMachineTest, Reset_MaintainsConfiguredState) {
  codec_.Configure(true);

  auto error = codec_.Reset();

  EXPECT_FALSE(error.IsError());
  EXPECT_EQ(codec_.GetState(), CodecStateMachine::State::kConfigured);
}

TEST_F(StateMachineTest, Reset_SetsKeyChunkRequired) {
  codec_.Configure(true);
  codec_.Decode(true);  // Clear key chunk requirement
  EXPECT_FALSE(codec_.IsKeyChunkRequired());

  codec_.Reset();

  // Per spec 4.6: reset sets [[key chunk required]] = true
  EXPECT_TRUE(codec_.IsKeyChunkRequired());
}

TEST_F(StateMachineTest, Close_FromConfigured_TransitionsToClosed) {
  codec_.Configure(true);

  auto error = codec_.Close();

  EXPECT_EQ(error.type, CodecStateMachine::ErrorType::kAbortError);
  EXPECT_EQ(codec_.GetState(), CodecStateMachine::State::kClosed);
  EXPECT_TRUE(codec_.IsClosed());
}

TEST_F(StateMachineTest, Close_FromUnconfigured_TransitionsToClosed) {
  auto error = codec_.Close();

  EXPECT_EQ(error.type, CodecStateMachine::ErrorType::kAbortError);
  EXPECT_EQ(codec_.GetState(), CodecStateMachine::State::kClosed);
}

// =============================================================================
// SAD PATH TESTS - INVALID STATE OPERATIONS
// =============================================================================

TEST_F(StateMachineTest, Encode_WithoutConfigure_ReturnsInvalidStateError) {
  auto error = codec_.Encode();

  EXPECT_EQ(error.type, CodecStateMachine::ErrorType::kInvalidStateError);
  EXPECT_THAT(error.message, ::testing::HasSubstr("unconfigured"));
}

TEST_F(StateMachineTest, Decode_WithoutConfigure_ReturnsInvalidStateError) {
  auto error = codec_.Decode(true);

  EXPECT_EQ(error.type, CodecStateMachine::ErrorType::kInvalidStateError);
  EXPECT_THAT(error.message, ::testing::HasSubstr("unconfigured"));
}

TEST_F(StateMachineTest, Flush_WithoutConfigure_ReturnsInvalidStateError) {
  auto error = codec_.Flush();

  EXPECT_EQ(error.type, CodecStateMachine::ErrorType::kInvalidStateError);
  EXPECT_THAT(error.message, ::testing::HasSubstr("unconfigured"));
}

TEST_F(StateMachineTest, Configure_WhenClosed_ReturnsInvalidStateError) {
  codec_.Configure(true);
  codec_.Close();

  auto error = codec_.Configure(true);

  EXPECT_EQ(error.type, CodecStateMachine::ErrorType::kInvalidStateError);
  EXPECT_THAT(error.message, ::testing::HasSubstr("closed"));
}

TEST_F(StateMachineTest, Encode_WhenClosed_ReturnsInvalidStateError) {
  codec_.Configure(true);
  codec_.Close();

  auto error = codec_.Encode();

  EXPECT_EQ(error.type, CodecStateMachine::ErrorType::kInvalidStateError);
  EXPECT_THAT(error.message, ::testing::HasSubstr("closed"));
}

TEST_F(StateMachineTest, Decode_WhenClosed_ReturnsInvalidStateError) {
  codec_.Configure(true);
  codec_.Close();

  auto error = codec_.Decode(true);

  EXPECT_EQ(error.type, CodecStateMachine::ErrorType::kInvalidStateError);
  EXPECT_THAT(error.message, ::testing::HasSubstr("closed"));
}

TEST_F(StateMachineTest, Flush_WhenClosed_ReturnsInvalidStateError) {
  codec_.Configure(true);
  codec_.Close();

  auto error = codec_.Flush();

  EXPECT_EQ(error.type, CodecStateMachine::ErrorType::kInvalidStateError);
  EXPECT_THAT(error.message, ::testing::HasSubstr("closed"));
}

TEST_F(StateMachineTest, Reset_WhenClosed_ReturnsInvalidStateError) {
  codec_.Configure(true);
  codec_.Close();

  auto error = codec_.Reset();

  EXPECT_EQ(error.type, CodecStateMachine::ErrorType::kInvalidStateError);
  EXPECT_THAT(error.message, ::testing::HasSubstr("closed"));
}

TEST_F(StateMachineTest, Close_WhenAlreadyClosed_RemainsClosedWithAbortError) {
  codec_.Configure(true);
  codec_.Close();

  auto error = codec_.Close();

  // Per spec: close is always valid, but returns AbortError
  EXPECT_EQ(error.type, CodecStateMachine::ErrorType::kAbortError);
  EXPECT_EQ(codec_.GetState(), CodecStateMachine::State::kClosed);
}

// =============================================================================
// KEY CHUNK REQUIREMENT TESTS (DECODERS)
// =============================================================================

TEST_F(StateMachineTest, Decode_NonKeyChunkFirst_ReturnsDataError) {
  codec_.Configure(true);

  auto error = codec_.Decode(false);  // Non-key chunk first

  // Per spec 4.5.3: First chunk must be key
  EXPECT_EQ(error.type, CodecStateMachine::ErrorType::kDataError);
  EXPECT_THAT(error.message, ::testing::HasSubstr("key chunk"));
}

TEST_F(StateMachineTest, Decode_NonKeyChunk_AfterFlush_ReturnsDataError) {
  codec_.Configure(true);
  codec_.Decode(true);   // Key chunk
  codec_.Decode(false);  // Delta chunk OK
  codec_.Flush();        // Resets key chunk requirement

  auto error = codec_.Decode(false);  // Non-key chunk after flush

  // Per spec 4.5.4: First chunk after flush must be key
  EXPECT_EQ(error.type, CodecStateMachine::ErrorType::kDataError);
  EXPECT_THAT(error.message, ::testing::HasSubstr("key chunk"));
}

TEST_F(StateMachineTest, Decode_NonKeyChunk_AfterReset_ReturnsDataError) {
  codec_.Configure(true);
  codec_.Decode(true);   // Key chunk
  codec_.Decode(false);  // Delta chunk OK
  codec_.Reset();        // Resets key chunk requirement

  auto error = codec_.Decode(false);  // Non-key chunk after reset

  // Per spec 4.6: First chunk after reset must be key
  EXPECT_EQ(error.type, CodecStateMachine::ErrorType::kDataError);
  EXPECT_THAT(error.message, ::testing::HasSubstr("key chunk"));
}

TEST_F(StateMachineTest, Decode_KeyChunk_AfterFlush_ClearsRequirement) {
  codec_.Configure(true);
  codec_.Decode(true);
  codec_.Flush();

  auto error1 = codec_.Decode(true);  // Key chunk after flush
  EXPECT_FALSE(error1.IsError());

  auto error2 = codec_.Decode(false);  // Delta chunk now OK
  EXPECT_FALSE(error2.IsError());
}

// =============================================================================
// ERROR HANDLING TESTS
// =============================================================================

TEST_F(StateMachineTest, Configure_Failure_ClosesCodec) {
  auto error = codec_.Configure(false);  // Simulate configure failure

  EXPECT_EQ(error.type, CodecStateMachine::ErrorType::kNotSupportedError);
  EXPECT_EQ(codec_.GetState(), CodecStateMachine::State::kClosed);
}

TEST_F(StateMachineTest, CodecError_ClosesCodec_ReturnsEncodingError) {
  codec_.Configure(true);

  auto error = codec_.SimulateCodecError("FFmpeg error");

  EXPECT_EQ(error.type, CodecStateMachine::ErrorType::kEncodingError);
  EXPECT_EQ(codec_.GetState(), CodecStateMachine::State::kClosed);
  EXPECT_THAT(error.message, ::testing::HasSubstr("FFmpeg"));
}

TEST_F(StateMachineTest, Close_WithEncodingError_ReturnsEncodingError) {
  codec_.Configure(true);

  CodecStateMachine::Error encoding_error{
      CodecStateMachine::ErrorType::kEncodingError, "Codec failed"};
  auto error = codec_.Close(&encoding_error);

  // Per spec: close with error returns that error (triggers callback)
  EXPECT_EQ(error.type, CodecStateMachine::ErrorType::kEncodingError);
  EXPECT_EQ(codec_.GetState(), CodecStateMachine::State::kClosed);
}

TEST_F(StateMachineTest, Close_WithAbortError_DoesNotTriggerCallback) {
  codec_.Configure(true);

  CodecStateMachine::Error abort_error{
      CodecStateMachine::ErrorType::kAbortError, "User closed"};
  auto error = codec_.Close(&abort_error);

  // Per spec: AbortError from user reset/close does NOT trigger error callback
  EXPECT_EQ(error.type, CodecStateMachine::ErrorType::kNone);
  EXPECT_EQ(codec_.GetState(), CodecStateMachine::State::kClosed);
}

// =============================================================================
// INTEGRATION WITH CONTROL QUEUE
// =============================================================================

/**
 * Verify state machine works correctly with ControlMessageQueue.
 * This simulates the TypeScript layer using the control queue.
 */
TEST(StateMachineIntegrationTest, StateTransitions_WithControlQueue) {
  VideoControlQueue queue;
  CodecStateMachine codec;
  std::atomic<bool> configured{false};

  // Configure message
  VideoControlQueue::ConfigureMessage configure_msg;
  configure_msg.configure_fn = [&]() {
    auto error = codec.Configure(true);
    configured.store(true);
    return !error.IsError();
  };
  EXPECT_TRUE(queue.Enqueue(configure_msg));

  // Process configure
  auto msg1 = queue.Dequeue();
  ASSERT_TRUE(msg1.has_value());
  auto* config = std::get_if<VideoControlQueue::ConfigureMessage>(&*msg1);
  ASSERT_NE(config, nullptr);
  EXPECT_TRUE(config->configure_fn());
  EXPECT_TRUE(configured.load());
  EXPECT_TRUE(codec.IsConfigured());

  // Encode message (should succeed after configure)
  VideoControlQueue::EncodeMessage encode_msg;
  encode_msg.frame = CreateTestFrame(320, 240);
  encode_msg.key_frame = true;
  EXPECT_TRUE(queue.Enqueue(std::move(encode_msg)));

  auto msg2 = queue.Dequeue();
  ASSERT_TRUE(msg2.has_value());
  EXPECT_TRUE(std::holds_alternative<VideoControlQueue::EncodeMessage>(*msg2));

  auto error = codec.Encode();
  EXPECT_FALSE(error.IsError());

  // Flush message
  VideoControlQueue::FlushMessage flush_msg;
  flush_msg.promise_id = 1;
  EXPECT_TRUE(queue.Enqueue(flush_msg));

  auto msg3 = queue.Dequeue();
  ASSERT_TRUE(msg3.has_value());
  auto* flush = std::get_if<VideoControlQueue::FlushMessage>(&*msg3);
  ASSERT_NE(flush, nullptr);

  auto flush_error = codec.Flush();
  EXPECT_FALSE(flush_error.IsError());
  EXPECT_TRUE(codec.IsKeyChunkRequired());  // Flush sets key chunk required
}

/**
 * Verify queue is cleared on reset per spec 4.6.
 */
TEST(StateMachineIntegrationTest, Reset_ClearsQueue) {
  VideoControlQueue queue;
  CodecStateMachine codec;

  // Configure
  codec.Configure(true);

  // Enqueue multiple encode messages
  for (int i = 0; i < 5; ++i) {
    VideoControlQueue::EncodeMessage msg;
    msg.frame = CreateTestFrame(320, 240);
    bool enqueued = queue.Enqueue(std::move(msg));
    EXPECT_TRUE(enqueued);
  }

  EXPECT_EQ(queue.size(), 5u);

  // Reset clears queue per spec
  auto dropped = queue.ClearFrames();
  auto reset_error = codec.Reset();

  EXPECT_FALSE(reset_error.IsError());
  EXPECT_EQ(queue.size(), 0u);
  EXPECT_EQ(dropped.size(), 5u);
  EXPECT_TRUE(codec.IsKeyChunkRequired());
  EXPECT_TRUE(codec.IsConfigured());  // Reset maintains configured state
}
