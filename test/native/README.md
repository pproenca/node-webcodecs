# Native C++ Tests

Comprehensive test suite for validating W3C WebCodecs spec compliance, memory safety, and thread safety at the C++ layer.

## Test Coverage

- **RAII Wrappers** (`test/native/ffmpeg_raii_test.cc`): 10 tests for `AVFramePtr` and `AVPacketPtr` cleanup
- **Control Message Queue** (`test/native/unit/test_control_message_queue.cpp`): 20 tests for FIFO ordering, blocking, shutdown
- **State Machine** (`test/native/spec/test_state_machine.cpp`): 31 tests for VideoEncoder/VideoDecoder state transitions
- **Queue Semantics** (`test/native/spec/test_queue_semantics.cpp`): 15 tests for W3C spec 2.2 control message processing
- **Saturation Detection** (`test/native/spec/test_saturation_detection.cpp`): 15 tests for queue size tracking
- **Flush Semantics** (`test/native/spec/test_flush_semantics.cpp`): 9 tests for W3C flush() algorithm
- **Reset Semantics** (`test/native/spec/test_reset_semantics.cpp`): 9 tests for W3C reset() algorithm
- **Thread Safety** (`test/native/stress/test_concurrent_operations.cpp`): 11 tests for concurrent operations
- **Memory Safety** (`test/native/stress/test_memory_leaks.cpp`): 14 tests for RAII cleanup under load

**Total: 134 tests across 10 test suites**

## Quick Start

```bash
# Run all tests (basic build)
npm run test:native

# Run with sanitizers (recommended for development)
npm run test:native:sanitize

# Run with ThreadSanitizer (detects data races)
npm run test:native:tsan

# Generate coverage report
npm run test:native:coverage
```

## Manual Build

```bash
cd test/native
mkdir -p build && cd build

# Basic build
cmake .. && make -j4 && ./webcodecs_tests

# With AddressSanitizer + LeakSanitizer
cmake .. -DSANITIZE=ON && make -j4
ASAN_OPTIONS=detect_leaks=1 ./webcodecs_tests

# With ThreadSanitizer
cmake .. -DTSAN=ON && make -j4
TSAN_OPTIONS=halt_on_error=1 ./webcodecs_tests

# With coverage
cmake .. -DCOVERAGE=ON && make -j4
./webcodecs_tests
lcov --capture --directory . --output-file coverage.info
lcov --remove coverage.info '/usr/*' '*/googletest/*' --output-file coverage.info
genhtml coverage.info --output-directory coverage_html
```

## Test Output Filtering

```bash
# Brief output (pass/fail summary)
./webcodecs_tests --gtest_brief=1

# Run specific test suite
./webcodecs_tests --gtest_filter=ControlMessageQueueTest.*

# Run specific test
./webcodecs_tests --gtest_filter=StateTransitionTest.Configure_FromUnconfigured_TransitionsToConfigured

# List all tests without running
./webcodecs_tests --gtest_list_tests
```

## Sanitizer Options

### AddressSanitizer (ASan)

Detects:
- Heap/stack buffer overflows
- Use-after-free
- Use-after-return
- Memory leaks (via LeakSanitizer)

```bash
ASAN_OPTIONS=detect_leaks=1:strict_string_checks=1:detect_stack_use_after_return=1 ./webcodecs_tests
```

### ThreadSanitizer (TSan)

Detects:
- Data races
- Deadlocks
- Thread leaks

```bash
TSAN_OPTIONS=halt_on_error=1:history_size=7 ./webcodecs_tests
```

**Note:** TSan and ASan cannot be enabled simultaneously. TSan requires a separate build.

### LeakSanitizer (LSan)

Included with ASan on Linux. **Not supported on macOS.**

For macOS development, use Valgrind or test on Linux CI.

## Coverage Reporting

After running with `-DCOVERAGE=ON`:

```bash
# Generate HTML report
genhtml coverage.info --output-directory coverage_html

# Open report (macOS)
open coverage_html/index.html

# Open report (Linux)
xdg-open coverage_html/index.html

# Print summary
lcov --summary coverage.info
```

**Coverage targets:**
- Infrastructure (queue, RAII): 95%+ line coverage
- Worker implementations: 85%+ line coverage

## CI Integration

GitHub Actions automatically runs:

1. **ASan + LSan** (Linux): Validates memory safety
2. **TSan** (Linux): Validates thread safety
3. **Coverage**: Generates line coverage metrics

Test results and coverage reports are uploaded as artifacts.

## Debugging Test Failures

### Memory Issues

```bash
# Run with verbose ASan output
ASAN_OPTIONS=verbosity=1:detect_leaks=1 ./webcodecs_tests

# Run with LeakSanitizer only (skip ASan)
LSAN_OPTIONS=verbosity=1 ./webcodecs_tests
```

### Thread Issues

```bash
# Run with verbose TSan output
TSAN_OPTIONS=verbosity=2:halt_on_error=1 ./webcodecs_tests

# Generate TSan report
TSAN_OPTIONS=halt_on_error=0:report_bugs=1 ./webcodecs_tests 2>&1 | tee tsan.log
```

### Specific Test Failures

```bash
# Run single test with detailed output
./webcodecs_tests --gtest_filter=TestSuite.TestName --gtest_also_run_disabled_tests

# Repeat test 100 times to catch flaky failures
./webcodecs_tests --gtest_filter=TestSuite.TestName --gtest_repeat=100 --gtest_break_on_failure
```

## Adding New Tests

1. **Choose directory:**
   - `unit/` - No FFmpeg codec operations required
   - `integration/` - Requires FFmpeg codec operations
   - `spec/` - W3C spec compliance validation
   - `stress/` - Thread safety, memory safety, high load

2. **Create test file:**
   ```cpp
   #include <gtest/gtest.h>
   #include "src/shared/control_message_queue.h"
   #include "test_utils.h"

   using namespace webcodecs;
   using namespace webcodecs::testing;

   TEST(MyTestSuite, MyTest_Scenario_ExpectedBehavior) {
     // Arrange
     auto queue = std::make_unique<VideoControlQueue>();

     // Act
     bool result = queue->Enqueue(CreateTestMessage());

     // Assert
     EXPECT_TRUE(result);
   }
   ```

3. **CMake auto-detects** new `*.cpp` files via `file(GLOB ...)` patterns

4. **Rebuild and run:**
   ```bash
   cd build && make -j4 && ./webcodecs_tests
   ```

## Troubleshooting

### CMake can't find FFmpeg

```bash
# macOS (Homebrew)
export PKG_CONFIG_PATH="/opt/homebrew/opt/ffmpeg/lib/pkgconfig"

# Linux (apt)
sudo apt-get install libavcodec-dev libavformat-dev libavutil-dev libswscale-dev libswresample-dev libavfilter-dev
```

### Build fails with "GoogleTest not found"

CMake automatically downloads GoogleTest v1.14.0 via FetchContent. Ensure internet connection is available.

### Tests pass locally but fail in CI

- **Timing issues**: CI is slower, increase timeouts
- **Platform differences**: Test on Docker with ubuntu-24.04 image
- **Missing sanitizers**: Ensure compiler supports `-fsanitize=address,thread,undefined`

## References

- [GoogleTest Primer](https://google.github.io/googletest/primer.html)
- [W3C WebCodecs Spec](https://www.w3.org/TR/webcodecs/)
- [AddressSanitizer Documentation](https://github.com/google/sanitizers/wiki/AddressSanitizer)
- [ThreadSanitizer Documentation](https://github.com/google/sanitizers/wiki/ThreadSanitizerCppManual)
- [LCOV Documentation](http://ltp.sourceforge.net/coverage/lcov.php)
