# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

1. **Do NOT** open a public GitHub issue for security vulnerabilities
2. Email the maintainers directly (see package.json for contact)
3. Include the following information:
   - Type of vulnerability (buffer overflow, memory corruption, etc.)
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 1 week
- **Resolution Timeline**: Depends on severity
  - Critical: 24-72 hours
  - High: 1-2 weeks
  - Medium: 2-4 weeks
  - Low: Next release cycle

### Disclosure Policy

- We follow coordinated disclosure
- Security fixes are released as soon as possible
- CVEs will be requested for significant vulnerabilities
- Credit will be given to reporters (unless anonymity is requested)

## Security Considerations

### Native Code

This package includes native C++ code that interfaces with FFmpeg. Key security considerations:

1. **Input Validation**: All inputs from JavaScript are validated in the native layer
2. **Memory Safety**: We use AddressSanitizer (ASAN) in CI to catch memory issues
3. **Undefined Behavior**: UndefinedBehaviorSanitizer (UBSAN) is used to detect UB

### FFmpeg Dependencies

This package depends on FFmpeg libraries for codec operations:

- Ensure you're using a supported FFmpeg version
- Keep FFmpeg updated to receive security patches
- FFmpeg processes potentially untrusted media data

### Recommended Practices

When using node-webcodecs in production:

1. **Sandbox untrusted input**: Use process isolation for untrusted media
2. **Limit resources**: Set memory and CPU limits
3. **Update regularly**: Keep both node-webcodecs and FFmpeg updated
4. **Monitor for issues**: Watch for crashes or unexpected behavior

## Security Testing

We employ several security testing measures:

```bash
# Run with AddressSanitizer
npm run test:asan

# Run with UndefinedBehaviorSanitizer
npm run test:ubsan

# Run memory leak tests
npm run test:stress
```

## Known Limitations

- **No sandboxing**: Native code runs in the Node.js process
- **FFmpeg vulnerabilities**: We depend on FFmpeg's security posture
- **Memory safety**: While we use RAII patterns, C++ is not memory-safe by default

## Acknowledgments

We thank the security researchers who have helped improve this project:

- (None yet - be the first!)
