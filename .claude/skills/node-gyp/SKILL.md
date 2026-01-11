---
name: node-gyp
description: Build and troubleshoot native Node.js addons using node-gyp. Use when working with native addon compilation, binding.gyp configuration, NODE_MODULE_VERSION mismatch errors, Electron native module rebuilds, or packages like bcrypt, node-sass, sqlite3, sharp. Covers platform-specific build setup (Linux/macOS/Windows), N-API configuration, cross-compilation, and pre-built binary distribution.
---

# node-gyp: Native Node.js Addon Building

node-gyp compiles C/C++ code into native Node.js modules (.node files). It uses GYP configuration to create platform-specific build files.

**Build Pipeline:** binding.gyp → configure → platform build files → compile → .node binary

## Key Concepts

### Native Addons
Binary modules providing Node.js bindings to C/C++ libraries. Compiled for specific:
- **Node.js versions** (each has a MODULE_VERSION number)
- **Platforms** (Linux, macOS, Windows)
- **Architectures** (x64, arm64, ia32)

### binding.gyp
Configuration file defining how to build your addon. JSON-like syntax with GYP features.

### N-API (Node-API)
ABI-stable API for native addons. Modules work across Node.js versions without recompiling. **Always use for new projects.**

### Variable Expansion
- `<(var)` - String expansion
- `<@(var)` - List expansion
- `<!(cmd)` - Command output as string
- `<!@(cmd)` - Command output as list

## Platform Setup

**Linux:**
```bash
sudo apt-get install build-essential python3
```

**macOS:**
```bash
xcode-select --install
```

**Windows (choose one):**
```bash
# Option 1: Chocolatey (recommended)
choco install python visualstudio2022-workload-vctools -y

# Option 2: npm (requires admin PowerShell)
npm install --global --production windows-build-tools
```

## Essential Commands

```bash
# Clean rebuild (most common)
node-gyp rebuild

# Individual steps (for debugging)
node-gyp clean       # Remove build artifacts
node-gyp configure   # Generate build files
node-gyp build       # Compile the addon

# Parallel compilation (faster)
node-gyp rebuild -j max

# Debug build
node-gyp rebuild --debug

# Download Node.js headers
node-gyp install
```

**When to use each:**
- `rebuild` - Default choice, ensures clean build
- `configure` then `build` - When iterating on binding.gyp
- `clean` - When switching Node versions or architectures
- `install` - When headers are missing or corrupted

## Basic binding.gyp

```json
{
  "targets": [{
    "target_name": "addon",
    "sources": ["src/addon.cc"],
    "include_dirs": [
      "<!@(node -p \"require('node-addon-api').include\")"
    ],
    "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
    "cflags!": ["-fno-exceptions"],
    "cflags_cc!": ["-fno-exceptions"]
  }]
}
```

**Key fields:**
- `target_name` - Output filename (addon.node)
- `sources` - C/C++ source files
- `include_dirs` - Header search paths
- `defines` - Preprocessor definitions
- `cflags!` / `cflags_cc!` - Remove default flags (! means remove)

## N-API Setup (Recommended)

**package.json:**
```json
{
  "dependencies": {
    "node-addon-api": "^7.0.0"
  },
  "scripts": {
    "install": "node-gyp rebuild"
  }
}
```

**binding.gyp:**
```json
{
  "targets": [{
    "target_name": "addon",
    "sources": ["src/addon.cc"],
    "include_dirs": [
      "<!@(node -p \"require('node-addon-api').include\")"
    ],
    "dependencies": [
      "<!(node -p \"require('node-addon-api').gyp\")"
    ],
    "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"]
  }]
}
```

## Quick Troubleshooting Decision Tree

```
Build failed?
│
├─ Python error?
│  └─ npm config set python /usr/bin/python3
│
├─ Visual Studio error? (Windows)
│  └─ node-gyp rebuild --msvs_version=2022
│
├─ NODE_MODULE_VERSION mismatch?
│  └─ npm rebuild
│
├─ Architecture mismatch? (M1/M2 Mac)
│  └─ rm -rf node_modules && npm install
│
├─ Missing headers?
│  └─ node-gyp install
│
├─ Compilation/linking error?
│  └─ Check binding.gyp libraries, run with --verbose
│
└─ Still failing?
   └─ See references/troubleshooting.md for detailed solutions
```

## References

For detailed guidance on specific topics:

- **[references/troubleshooting.md](references/troubleshooting.md)** - Comprehensive troubleshooting for all common errors with symptoms, solutions, and explanations
- **[references/advanced-patterns.md](references/advanced-patterns.md)** - Platform-specific configurations, Electron support, pre-built binaries, cross-compilation
- **[references/best-practices.md](references/best-practices.md)** - Production recommendations, CI/CD setup, flags reference, related resources
