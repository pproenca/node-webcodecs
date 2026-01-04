# Performance Benchmarks

Comprehensive performance testing for FFmpeg-based WebCodecs implementation using Google Benchmark.

## Quick Start

```bash
# Run all benchmarks
npm run bench:native

# Run specific benchmark
npm run bench:native:filter -- BM_H264_Encode

# Run with custom settings
npm run bench:native -- --benchmark_min_time=1.0s --benchmark_repetitions=5
```

## Benchmark Suites

### Queue Performance (`queue_performance.cpp`)

Tests control message queue throughput:

| Benchmark | Measures | Typical Result |
|-----------|----------|----------------|
| `BM_Enqueue_SingleThread` | Messages/sec enqueue rate | ~27M msg/sec |
| `BM_Dequeue_SingleThread` | Messages/sec dequeue rate | ~25M msg/sec |
| `BM_EnqueueDequeue_Roundtrip` | Full cycle latency | ~20M roundtrips/sec |
| `BM_TryDequeue_Pattern` | Atomic dequeue pattern | ~15M msg/sec |
| `BM_PeekPopFront_Pattern` | Two-lock pattern | ~12M msg/sec |
| `BM_ProducerConsumer_Concurrent` | Multi-threaded throughput | Scales with cores |

**Key Findings:**
- `TryDequeue()` is ~25% faster than `Peek()+PopFront()` (single mutex lock vs two)
- Queue size up to 10K messages has negligible impact on performance
- Concurrent throughput scales linearly up to 4 producer/consumer pairs

### RAII Overhead (`raii_overhead.cpp`)

Tests FFmpeg RAII wrapper performance:

| Benchmark | Measures | Typical Result |
|-----------|----------|----------------|
| `BM_AVPacketPtr_Allocation` | Packet allocation rate | ~40M packets/sec |
| `BM_AVPacket_Raw_Allocation` | Raw baseline | ~42M packets/sec |
| `BM_AVFramePtr_Allocation` | Frame allocation rate | ~35M frames/sec |
| `BM_AVFramePtr_WithBuffer` | Frame + buffer allocation | Resolution-dependent |
| `BM_AVFrame_RefCounting` | Reference counting cost | ~8M refs/sec |
| `BM_AVFrame_Clone` | Deep copy cost | ~2M clones/sec |

**Frame Buffer Allocation** (with `av_frame_get_buffer`):

| Resolution | Frames/sec |
|------------|------------|
| 320x240 (QVGA) | ~3M frames/sec |
| 640x480 (VGA) | ~2M frames/sec |
| 1280x720 (HD) | ~800K frames/sec |
| 1920x1080 (Full HD) | ~450K frames/sec |
| 3840x2160 (4K) | ~120K frames/sec |

**Key Findings:**
- RAII overhead is **~5%** (40M vs 42M packets/sec)
- Move semantics have zero overhead (compiler elision)
- Frame buffer allocation dominates cost (10x slower than allocation alone)
- Reference counting is 4x cheaper than deep cloning

### Codec Throughput (`codec_throughput.cpp`)

Tests actual FFmpeg encoding/decoding performance:

| Codec | Operation | 1080p (fps) | 720p (fps) | 480p (fps) |
|-------|-----------|-------------|------------|------------|
| H.264 | Encode (ultrafast) | ~200 | ~400 | ~800 |
| H.264 | Decode | ~1200 | ~2000 | ~3500 |
| VP9 | Encode (realtime) | ~80 | ~150 | ~300 |
| VP9 | Decode | ~800 | ~1400 | ~2500 |

**Note:** These are single-threaded, software-only numbers. Hardware acceleration (if available) can increase encoding by 3-5x.

**Key Findings:**
- Decoding is ~6x faster than encoding (for H.264)
- VP9 is ~2.5x slower than H.264 for encoding
- Encoding speed scales inversely with resolution (4x pixels = ~1/4 speed)

## Usage Examples

### Run All Benchmarks

```bash
npm run bench:native
```

Output:
```
Benchmark                            Time    CPU    Iterations
----------------------------------------------------------------
BM_Enqueue_SingleThread           36.5 ns  36.4 ns   3922777
BM_AVPacketPtr_Allocation         24.9 ns  24.9 ns   5563061
BM_H264_Encode/1920/1080           5.2 ms   5.2 ms       134
```

### Run Specific Pattern

```bash
cd test/native/build
./webcodecs_benchmarks --benchmark_filter="BM_H264.*"
```

### Compare Patterns

```bash
# Compare TryDequeue vs Peek/PopFront
./webcodecs_benchmarks \
  --benchmark_filter="BM_(TryDequeue|PeekPopFront)_Pattern" \
  --benchmark_repetitions=10
```

### Export Results

```bash
# JSON format
./webcodecs_benchmarks --benchmark_format=json > results.json

# CSV format
./webcodecs_benchmarks --benchmark_format=csv > results.csv
```

## Google Benchmark CLI Options

| Option | Purpose | Example |
|--------|---------|---------|
| `--benchmark_filter=<regex>` | Run matching benchmarks | `--benchmark_filter="BM_H264.*"` |
| `--benchmark_min_time=<time>` | Min time per benchmark | `--benchmark_min_time=5.0s` |
| `--benchmark_repetitions=<n>` | Repeat each benchmark | `--benchmark_repetitions=10` |
| `--benchmark_report_aggregates_only=true` | Show only mean/median | Statistics only |
| `--benchmark_format=<format>` | Output format | `json`, `csv`, `console` |
| `--benchmark_out=<file>` | Save to file | `--benchmark_out=results.json` |

## Interpreting Results

### Time vs CPU Time

- **Time**: Wall-clock time (includes I/O, context switches)
- **CPU Time**: Actual CPU execution time
- For CPU-bound work, they should be similar

### Iterations

- Benchmarks auto-adjust iterations to run for ~target time
- More iterations = more stable results
- Lower variance = more reliable measurements

### Comparing Results

```bash
# Run baseline
./webcodecs_benchmarks --benchmark_filter="BM_AVPacketPtr.*" \
  --benchmark_out=baseline.json

# After optimization
./webcodecs_benchmarks --benchmark_filter="BM_AVPacketPtr.*" \
  --benchmark_out=optimized.json

# Compare (requires compare.py from Google Benchmark)
python3 compare.py baseline.json optimized.json
```

## Memory Leak Detection (macOS)

macOS `leaks` tool runs after tests complete:

```bash
npm run test:native:leaks
```

Output:
```
Process 12345: 0 leaks for 0 total leaked bytes.
```

**Advantages over Linux LeakSanitizer:**
- Works on macOS (LSan requires Linux)
- Detects leaks from system libraries
- No runtime overhead during tests

**Disadvantages:**
- Only detects leaks at exit (not during execution)
- Slower (waits for all tests to complete)

## Performance Tips

### For Production Code

1. **Use TryDequeue()** instead of Peek()+PopFront() (25% faster)
2. **Reuse frame buffers** when possible (10x allocation cost savings)
3. **Use reference counting** (`av_frame_ref`) instead of deep cloning (4x faster)
4. **Choose codecs wisely**: H.264 is 2.5x faster than VP9 for same quality
5. **Consider hardware acceleration** (3-5x encoding speedup if available)

### For Benchmark Accuracy

1. **Close background apps** to reduce noise
2. **Run multiple repetitions** (--benchmark_repetitions=10)
3. **Build in Release mode** (-DCMAKE_BUILD_TYPE=Release)
4. **Disable CPU frequency scaling** on Linux:
   ```bash
   echo performance | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor
   ```
5. **Pin to specific cores** for consistency:
   ```bash
   taskset -c 0 ./webcodecs_benchmarks
   ```

## Continuous Performance Monitoring

Add to CI:

```yaml
- name: Run performance benchmarks
  run: npm run bench:native -- --benchmark_format=json --benchmark_out=bench_results.json

- name: Upload benchmark results
  uses: actions/upload-artifact@v3
  with:
    name: benchmark-results
    path: test/native/build/bench_results.json

- name: Compare against baseline
  run: python3 scripts/compare_benchmarks.py baseline.json bench_results.json
```

## References

- [Google Benchmark Documentation](https://github.com/google/benchmark)
- [FFmpeg Performance Guide](https://trac.ffmpeg.org/wiki/Encode/H.264)
- [WebCodecs Spec: Performance Considerations](https://www.w3.org/TR/webcodecs/#performance)
