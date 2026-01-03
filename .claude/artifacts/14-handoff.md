# 14 Handoff: Best Practices for Authors

## Status: COMPLETE

## Spec Compliance Mapping

| Spec Section | Best Practice | Documentation | Location |
|--------------|---------------|---------------|----------|
| 14 | Worker thread processing | Documented | docs/best-practices.md (Threading section) |
| 14 | Main thread contention | Documented | docs/best-practices.md (Threading section) |
| - | Resource closing | Documented | docs/best-practices.md (Resource Management) |
| - | Error handling | Documented | docs/best-practices.md (Error Handling) |
| - | isConfigSupported | Documented | docs/best-practices.md (Configuration) |
| - | Queue monitoring | Documented | docs/best-practices.md (Queue Management) |
| - | Common pitfalls | Documented | docs/best-practices.md (Common Pitfalls) |

## Documentation Created

### docs/best-practices.md

Comprehensive best practices document covering:

1. **Resource Management**
   - Always close VideoFrame/AudioData
   - Close codecs when done
   - Process output promptly

2. **Error Handling**
   - Use both output and error callbacks
   - Handle promise rejections

3. **Configuration**
   - Check isConfigSupported() before configure()
   - Match configuration to media dimensions
   - Use normalized config from isConfigSupported result

4. **Queue Management**
   - Monitor encodeQueueSize/decodeQueueSize
   - Implement back-pressure with ondequeue
   - Batch processing strategies

5. **Threading**
   - Internal AsyncWorker usage explained
   - Avoid blocking callbacks
   - Async I/O recommendations

6. **Codec Selection**
   - Video codec guidelines (H.264, H.265, VP9, AV1)
   - Audio codec guidelines (AAC, Opus, FLAC)

7. **Common Pitfalls**
   - Forgetting to close resources
   - Encoding on closed codec
   - Missing description for H.264/H.265
   - Ignoring queue depth

### README.md Update

Added link to best-practices.md in API section.

## Files Modified

- `docs/best-practices.md`: New comprehensive best practices guide
- `README.md`: Added link to best-practices.md

## Test Coverage

N/A - Documentation-only task. Examples in documentation are illustrative code snippets.

## Downstream Unblocked

- None - TODO-14 has no downstream dependencies

## Notes

- Section 14 of W3C spec is brief (worker thread recommendation only)
- Extended documentation covers broader WebCodecs best practices
- All code examples follow the patterns already in the codebase
- Documentation references W3C spec for authority
