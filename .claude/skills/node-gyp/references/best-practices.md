# node-gyp Best Practices

## 1. Always Use N-API for New Projects

Forward compatibility across Node.js versions:

```json
{
  "dependencies": {
    "node-addon-api": "^7.0.0"
  }
}
```

**Benefit:** Users won't need to recompile when upgrading Node.js.

---

## 2. Distribute Pre-built Binaries

```json
{
  "scripts": {
    "install": "prebuild-install || node-gyp rebuild"
  }
}
```

**Why:** 80% of users don't have build tools installed.

---

## 3. Use Parallel Compilation

```bash
node-gyp rebuild -j max
```

Speeds up builds significantly on multi-core systems. Always use in CI/CD.

---

## 4. Test on All Target Platforms

```yaml
# .github/workflows/test.yml
strategy:
  matrix:
    os: [ubuntu-latest, macos-latest, windows-latest]
    node: [16, 18, 20]
```

Build failures are often platform-specific: Windows path issues, macOS framework linking, Linux library versions.

---

## 5. Keep binding.gyp Organized

```json
{
  "targets": [{
    "target_name": "addon",
    "sources": ["..."],
    "include_dirs": ["..."],
    "defines": ["..."],

    "conditions": [
      // Group by OS
      ["OS=='linux'", { "..." }],
      ["OS=='mac'", { "..." }],
      ["OS=='win'", { "..." }],

      // Then by architecture
      ["target_arch=='arm64'", { "..." }]
    ]
  }]
}
```

---

## 6. Use Release Builds in Production

```bash
node-gyp rebuild --release
```

`--release` is default; only use `--debug` during development. Debug builds are slower and larger.

---

## 7. Pin Build Tool Versions in CI

```json
{
  "engines": {
    "node": ">=16.0.0",
    "npm": ">=8.0.0"
  }
}
```

---

## 8. Document Platform Requirements

```markdown
## Installation

Requires:
- Node.js 16+
- Python 3.6+
- C++ build tools (platform-specific)

See [node-gyp installation](https://github.com/nodejs/node-gyp#installation) for details.
```

---

## 9. Cache Build Artifacts in CI

```yaml
# GitHub Actions
- uses: actions/cache@v3
  with:
    path: ~/.node-gyp
    key: ${{ runner.os }}-node-gyp-${{ hashFiles('binding.gyp') }}
```

---

## 10. Handle Missing Dependencies Gracefully

```javascript
let addon;
try {
  addon = require('./build/Release/addon.node');
} catch (err) {
  console.error('Native addon failed to load. Falling back to pure JS.');
  addon = require('./lib/fallback.js');
}
module.exports = addon;
```

---

## Common Flags Reference

```bash
# Performance
-j max                    # Use all CPU cores for parallel builds

# Build type
--debug                   # Debug build (symbols, no optimization)
--release                 # Release build (default)

# Target configuration
--target=VERSION          # Target Node.js version (e.g., 18.0.0)
--arch=ARCH              # Target architecture (x64, arm64, ia32)
--dist-url=URL           # Headers download URL

# Platform-specific
--python=PATH            # Specify Python executable
--msvs_version=VERSION   # Visual Studio version (2017, 2019, 2022)

# Debugging
--verbose                # Detailed build output
--silly                  # Maximum verbosity

# Advanced
--devdir=DIR             # Headers cache directory (default: ~/.node-gyp)
--nodedir=DIR            # Node source directory (for building from source)
```

---

## Related Resources

- [node-gyp Official Docs](https://github.com/nodejs/node-gyp)
- [Node-API Documentation](https://nodejs.org/api/n-api.html)
- [node-addon-api Package](https://github.com/nodejs/node-addon-api)
- [GYP Input Format Reference](https://gyp.gsrc.io/docs/InputFormatReference.md)
- [prebuild Package](https://github.com/prebuild/prebuild)
- [electron-rebuild](https://github.com/electron/electron-rebuild)
- [Native Abstractions for Node.js (nan)](https://github.com/nodejs/nan) - Legacy, use N-API instead
