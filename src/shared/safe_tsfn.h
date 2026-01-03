// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#pragma once
/**
 * safe_tsfn.h - Thread-Safe Function Lifecycle Wrapper
 *
 * Provides a safe wrapper around Napi::TypedThreadSafeFunction that prevents:
 * - Calling after Release() (undefined behavior)
 * - Double Release() calls
 * - Race conditions between Call and Release
 *
 * Thread Safety:
 * - Call() can be called from any thread
 * - Release() can be called from any thread
 * - All operations are mutex-protected
 *
 * Usage:
 *   SafeThreadSafeFunction<Context, DataType> tsfn;
 *   tsfn.Init(napi_tsfn);
 *
 *   // From worker thread:
 *   if (!tsfn.Call(data)) {
 *     // TSFN was released, clean up data yourself
 *     delete data;
 *   }
 *
 *   // From any thread:
 *   tsfn.Release();  // Idempotent
 */

#include <napi.h>

#include <mutex>
#include <utility>

namespace webcodecs {

/**
 * Thread-safe wrapper for Napi::TypedThreadSafeFunction.
 *
 * Guarantees:
 * - No calls after Release()
 * - No double Release()
 * - Thread-safe call from any thread
 *
 * @tparam Context The context type passed to the TSFN callback
 * @tparam DataType The data type passed through the TSFN
 * @tparam CallJs Optional CallJs function pointer (compile-time callback)
 */
template <typename Context, typename DataType,
          void (*CallJs)(Napi::Env, Napi::Function, Context*, DataType*) =
              nullptr>
class SafeThreadSafeFunction {
 public:
  using TSFN = Napi::TypedThreadSafeFunction<Context, DataType, CallJs>;

  SafeThreadSafeFunction() = default;

  ~SafeThreadSafeFunction() {
    // Only release in destructor if not unref'd.
    // If Unref() was called, Node.js will clean up the TSFN during shutdown.
    // Calling Release() here after Unref() during process exit can cause
    // crashes.
    if (!unrefed_) {
      Release();
    }
  }

  // Non-copyable, non-movable (wraps non-copyable TSFN)
  SafeThreadSafeFunction(const SafeThreadSafeFunction&) = delete;
  SafeThreadSafeFunction& operator=(const SafeThreadSafeFunction&) = delete;
  SafeThreadSafeFunction(SafeThreadSafeFunction&&) = delete;
  SafeThreadSafeFunction& operator=(SafeThreadSafeFunction&&) = delete;

  /**
   * Initialize with a TSFN.
   * Must be called before any other operations.
   *
   * @param tsfn The TypedThreadSafeFunction to wrap
   */
  void Init(TSFN tsfn) {
    std::lock_guard<std::mutex> lock(mutex_);
    tsfn_ = std::move(tsfn);
    released_ = false;
    initialized_ = true;
  }

  /**
   * Thread-safe call to the TSFN.
   *
   * @param data Pointer to data to pass to the callback.
   *             If this returns false, caller is responsible for cleanup.
   * @return true if call succeeded, false if TSFN was released or not
   * initialized
   */
  [[nodiscard]] bool Call(DataType* data) {
    std::lock_guard<std::mutex> lock(mutex_);

    if (!initialized_ || released_) {
      // Caller must clean up data
      return false;
    }

    napi_status status = tsfn_.NonBlockingCall(data);
    return status == napi_ok;
  }

  /**
   * Thread-safe blocking call to the TSFN.
   * Blocks until the call is processed.
   *
   * @param data Pointer to data to pass to the callback
   * @return true if call succeeded, false if TSFN was released or not
   * initialized
   */
  [[nodiscard]] bool BlockingCall(DataType* data) {
    std::lock_guard<std::mutex> lock(mutex_);

    if (!initialized_ || released_) {
      return false;
    }

    napi_status status = tsfn_.BlockingCall(data);
    return status == napi_ok;
  }

  /**
   * Release the TSFN.
   * Idempotent - safe to call multiple times.
   * After this call, all future call() operations will return false.
   *
   * Note: If Unref() was called, Release() becomes a no-op because
   * Node.js will handle cleanup during process shutdown. Calling Release()
   * after Unref() during process exit can cause crashes.
   */
  void Release() {
    std::lock_guard<std::mutex> lock(mutex_);
    if (initialized_ && !released_ && !unrefed_) {
      tsfn_.Release();
      released_ = true;
    }
  }

  /**
   * Check if the TSFN has been released.
   */
  [[nodiscard]] bool IsReleased() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return released_;
  }

  /**
   * Check if the TSFN is initialized and not released.
   */
  [[nodiscard]] bool IsActive() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return initialized_ && !released_;
  }

  /**
   * Acquire a reference to prevent GC collection.
   * Must be balanced with a later release or unref.
   */
  void Acquire() {
    std::lock_guard<std::mutex> lock(mutex_);
    if (initialized_ && !released_) {
      tsfn_.Acquire();
    }
  }

  /**
   * Release a reference without fully releasing the TSFN.
   * This allows Node.js to exit even if the TSFN is still active.
   *
   * @param env The N-API environment
   */
  void Unref(Napi::Env env) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (initialized_ && !released_) {
      tsfn_.Unref(env);
      unrefed_ = true;
    }
  }

 private:
  mutable std::mutex mutex_;
  TSFN tsfn_;
  bool initialized_{false};
  bool released_{true};  // Start as released (not initialized)
  bool unrefed_{false};  // Track if Unref was called
};

/**
 * Scoped TSFN reference acquisition.
 * Acquires a reference on construction, releases on destruction.
 * Useful for ensuring TSFN stays alive during async operations.
 */
template <typename Context, typename DataType,
          void (*CallJs)(Napi::Env, Napi::Function, Context*, DataType*) =
              nullptr>
class ScopedTSFNRef {
 public:
  explicit ScopedTSFNRef(
      SafeThreadSafeFunction<Context, DataType, CallJs>* tsfn)
      : tsfn_(tsfn) {
    tsfn_->Acquire();
  }

  ~ScopedTSFNRef() { tsfn_->Release(); }

  // Non-copyable, non-movable
  ScopedTSFNRef(const ScopedTSFNRef&) = delete;
  ScopedTSFNRef& operator=(const ScopedTSFNRef&) = delete;

 private:
  SafeThreadSafeFunction<Context, DataType, CallJs>* tsfn_;
};

}  // namespace webcodecs
