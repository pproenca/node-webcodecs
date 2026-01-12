# Advanced node-gyp Patterns

## Platform-Specific Configurations

Use conditions in binding.gyp for cross-platform support:

```json
{
  "targets": [{
    "target_name": "addon",
    "sources": ["src/addon.cc"],
    "conditions": [
      ["OS=='linux'", {
        "libraries": ["-lpthread"],
        "cflags": ["-fPIC"]
      }],
      ["OS=='mac'", {
        "xcode_settings": {
          "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
          "MACOSX_DEPLOYMENT_TARGET": "10.13"
        }
      }],
      ["OS=='win'", {
        "msvs_settings": {
          "VCCLCompilerTool": {
            "ExceptionHandling": 1
          }
        }
      }]
    ]
  }]
}
```

**Common platform conditions:**
- `OS=='linux'` / `OS=='mac'` / `OS=='win'`
- `target_arch=='x64'` / `target_arch=='arm64'`
- `node_shared_openssl=='true'`

---

## Electron Support

### Using electron-rebuild (Recommended)

```bash
npm install --save-dev electron-rebuild
npx electron-rebuild
```

**package.json script:**
```json
{
  "scripts": {
    "rebuild-electron": "electron-rebuild -f -w your-native-module"
  }
}
```

### Manual Approach

When electron-rebuild fails:

```bash
node-gyp rebuild \
  --target=28.0.0 \
  --arch=x64 \
  --dist-url=https://electronjs.org/headers
```

---

## Pre-built Binaries Distribution

Distribute pre-compiled binaries so users don't need build tools.

### Using prebuild (Recommended)

**package.json:**
```json
{
  "scripts": {
    "install": "prebuild-install || node-gyp rebuild",
    "prebuild": "prebuild --all --strip --verbose"
  },
  "devDependencies": {
    "prebuild": "^12.0.0"
  },
  "dependencies": {
    "prebuild-install": "^7.0.0"
  }
}
```

**Build binaries for all platforms:**
```bash
npx prebuild --all
```

Creates binaries in `prebuilds/` that users download instead of compiling.

**Why use prebuild?** 80% of users don't have build tools installed. The `|| node-gyp rebuild` fallback handles edge cases.

---

## Cross-Compilation

Build for different architectures or Node.js versions:

```bash
# Build for different architecture on M1/M2 Mac
node-gyp rebuild --arch=x64

# Build for different Node.js version
node-gyp rebuild --target=18.0.0

# Combine multiple options
node-gyp rebuild --target=20.0.0 --arch=arm64 --dist-url=https://nodejs.org/dist
```

---

## Graceful Fallback Pattern

Handle missing native dependencies:

```javascript
// index.js
let addon;
try {
  addon = require('./build/Release/addon.node');
} catch (err) {
  console.error('Native addon failed to load. Falling back to pure JS implementation.');
  addon = require('./lib/fallback.js');
}
module.exports = addon;
```
