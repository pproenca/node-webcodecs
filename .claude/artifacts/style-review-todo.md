# Google C++ Style Guide Compliance Review

## Task Overview
Review all C++ code in `src/` for Google Style Guide compliance, focusing on patterns that formatters/linters CANNOT catch reliably.

## Files to Review (27 total)
- [ ] addon.cc
- [ ] async_decode_worker.cc/h
- [ ] async_encode_worker.cc/h
- [ ] audio_data.cc/h
- [ ] audio_decoder.cc/h
- [ ] audio_encoder.cc/h
- [ ] demuxer.cc/h
- [ ] encoded_audio_chunk.cc/h
- [ ] encoded_video_chunk.cc/h
- [ ] ffmpeg_raii.h
- [ ] image_decoder.cc/h
- [ ] video_decoder.cc/h
- [ ] video_encoder.cc/h
- [ ] video_filter.cc/h
- [ ] video_frame.cc/h

## Focus Areas (What Linters Can't Catch)

### 1. Naming & Semantic Meaning
- [ ] Class vs. struct distinction (struct = passive data only)
- [ ] Namespace naming uniqueness
- [ ] Internal linkage intention (unnamed namespace/static)

### 2. Code Organization
- [ ] Header file self-containment
- [ ] Include order correctness
- [ ] Forward declaration appropriateness

### 3. Design Patterns
- [ ] Ownership transfer semantics (unique_ptr usage)
- [ ] No virtual calls in constructors
- [ ] Composition vs. inheritance choices

### 4. Comments & Documentation
- [ ] Intent documentation for complex code
- [ ] API clarity in headers
- [ ] Namespace closing comments

### 5. Memory & Lifetime Management
- [ ] Static variable triviality
- [ ] Function parameter lifetime safety
- [ ] Smart pointer usage context

### 6. Thread Safety
- [ ] thread_local initialization
- [ ] Destruction order awareness

### 7. Error Handling & Behavior
- [ ] No implicit conversions (explicit keyword)
- [ ] Default arguments on virtual functions
- [ ] RTTI avoidance

### 8. Miscellaneous
- [ ] Function length (~40 lines guideline)
- [ ] Operator overloading semantics
- [ ] Performance optimization justification

## Status
- **Phase**: Not started
- **Current**: Awaiting orchestrator launch
