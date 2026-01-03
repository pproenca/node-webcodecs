# Security Policy

## Supported Versions

| Version          | Supported          |
| ---------------- | ------------------ |
| 1.x.x (stable)   | :white_check_mark: |
| 1.x.x-alpha/beta | Best effort        |
| < 1.0            | :x:                |

**Note**: Pre-release versions (alpha, beta, rc) receive security fixes on a best-effort basis. For production use, prefer stable releases.

## Reporting a Vulnerability

Please report security vulnerabilities via GitHub's private vulnerability reporting:
https://github.com/pproenca/node-webcodecs/security/advisories/new

**Do NOT open a public GitHub issue for security vulnerabilities.**

You can expect:

- Acknowledgment within 48 hours
- Status update within 7 days
- Fix timeline based on severity (critical: 7 days, high: 30 days, medium: 90 days)

## Security Measures

### Build Security

- **npm provenance**: All packages published with OIDC attestation
- **Pinned versions**: FFmpeg and codec versions are pinned in `ffmpeg/versions.json`
- **Reproducible builds**: Docker-based builds for Linux ensure consistency

### Runtime Security

- **Zero install scripts**: No postinstall or lifecycle scripts
- **Static linking**: No dynamic library loading at runtime
- **No network access**: Installation requires no network after npm download
- **Platform isolation**: Each platform has its own isolated binary

### Code Security

- **Memory safety**: RAII patterns in C++ code (see CLAUDE.md)
- **Thread safety**: Strict isolation between JS and worker threads
- **Input validation**: All inputs validated at API boundaries
- **Fuzzing**: Regular fuzz testing of codec interfaces

## Dependency Security

Dependencies are monitored via:

- GitHub Dependabot (automatic security alerts)
- npm audit (run in CI before publishing)

## Third-Party Code

This project includes statically linked third-party code:

- FFmpeg (LGPL-2.1+)
- x264 (GPL-2.0+)
- x265 (GPL-2.0+)
- libvpx (BSD-3-Clause)
- libaom (BSD-2-Clause)
- Opus (BSD-3-Clause)
- LAME (LGPL-2.0+)

See NOTICE file for complete attribution.

Security vulnerabilities in these dependencies should be reported to their
respective projects. We will update to patched versions as they become available.
