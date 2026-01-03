---
title: '13. Privacy Considerations'
---

> Section 13 from [W3C WebCodecs Specification](https://www.w3.org/TR/webcodecs/)

## [13. Privacy Considerations](https://www.w3.org/TR/webcodecs/#privacy-considerations)

### 13.1. Hardware Fingerprinting

**isConfigSupported() Fingerprinting Risk**

The `isConfigSupported()` static method can reveal hardware capabilities:

```javascript
// Potential fingerprinting vector
const h264Support = await VideoDecoder.isConfigSupported({
  codec: 'avc1.42001E',
  hardwareAcceleration: 'prefer-hardware',
});
// Reveals: Does this device have H.264 hardware decoder?
```

**W3C Mitigation Requirement**:

> "To prevent fingerprinting, if a User Agent implements [media-capabilities], the User Agent MUST ensure rejection or acceptance of a given HardwareAcceleration preference reveals no additional information on top of what is inherent to the User Agent and revealed by [media-capabilities]."

**Node.js Implementation**:

Since Node.js doesn't run in a browser context with fingerprinting concerns, implementations MAY report accurate hardware capabilities. However, for privacy-conscious applications:

```cpp
// Option: Always report software-only support
bool IsConfigSupported(const Config& config) {
  if (config.hardwareAcceleration == "prefer-hardware") {
    // Could return false to hide hardware capabilities
    return CheckSoftwareSupport(config);
  }
  return CheckSoftwareSupport(config);
}
```

### 13.2. Timing Side Channels

**Decode/Encode Timing**

Timing variations can reveal content characteristics:

| Observable           | Information Leaked             |
| -------------------- | ------------------------------ |
| Decode time variance | Frame type (I/P/B), complexity |
| Hardware vs software | GPU presence, driver version   |
| First frame latency  | Codec initialization time      |

**Mitigation** (if needed for privacy):

- Add random delays to normalize timing
- Use constant-time comparisons for sensitive data
- Avoid exposing precise timing in error messages

### 13.3. Resource Usage Patterns

**Memory Allocation Patterns**

Frame allocation sizes reveal video characteristics:

```javascript
const frame = await decoder.decode(chunk);
// frame.allocationSize() reveals resolution
// Multiple frames reveal framerate patterns
```

**Node.js Context**: These privacy concerns are primarily for browser environments. In server-side Node.js applications, the operator typically controls both the code and data, making these concerns less relevant.

### 13.4. Recommendations for Privacy-Sensitive Applications

If building privacy-preserving media pipelines in Node.js:

1. **Normalize Timing**: Add consistent delays to codec operations
2. **Limit Config Queries**: Cache `isConfigSupported()` results
3. **Software-Only Mode**: Use `prefer-software` to avoid hardware fingerprinting
4. **Audit Logging**: Be careful what codec metadata gets logged
