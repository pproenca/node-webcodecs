# node-gyp Troubleshooting Guide

Comprehensive troubleshooting for common node-gyp build errors.

## Python Not Found

**Symptoms:**
```
gyp ERR! find Python
gyp ERR! Could not find Python
```

**Solutions:**
```bash
# Check Python version (needs 3.6+)
python3 --version

# Option 1: Set globally
npm config set python /usr/bin/python3

# Option 2: Set per-project (.npmrc)
echo "python=/usr/bin/python3" >> .npmrc

# Option 3: Environment variable
export npm_config_python=/usr/bin/python3
```

**Why:** node-gyp requires Python to generate build files but doesn't always detect it correctly.

---

## Visual Studio Not Found (Windows)

**Symptoms:**
```
gyp ERR! find VS
gyp ERR! Could not find Visual Studio installation
```

**Solutions:**
```bash
# Check installed versions
where msbuild

# Specify version explicitly
node-gyp rebuild --msvs_version=2022

# Set globally
npm config set msvs_version 2022

# Alternative: Use VS Build Tools (lighter than full VS)
# Download from: https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022
```

**Why:** Windows requires Visual Studio's C++ compiler. Auto-detection sometimes fails, especially with VS 2022.

---

## NODE_MODULE_VERSION Mismatch

**Symptoms:**
```
Error: The module was compiled against a different Node.js version using
NODE_MODULE_VERSION 93. This version of Node.js requires NODE_MODULE_VERSION 108.
```

**Solutions:**
```bash
# Rebuild all native modules
npm rebuild

# Rebuild specific package
npm rebuild bcrypt

# Or full reinstall
rm -rf node_modules
npm install

# For global modules
npm rebuild -g
```

**Why:** Native modules are compiled for specific Node.js versions. When you upgrade Node, they must be recompiled.

---

## Architecture Mismatch (M1/M2 Macs)

**Symptoms:**
```
Error: dlopen(...): mach-o, but wrong architecture
```

**Solutions:**
```bash
# Clean and rebuild for current architecture
rm -rf node_modules
npm install

# Or explicitly specify
node-gyp rebuild --arch=arm64  # for M1/M2
node-gyp rebuild --arch=x64    # for Intel/Rosetta

# Check your Node architecture
node -p "process.arch"  # should match your system
```

**Why:** Running x64 Node on ARM Mac (or vice versa) requires matching native modules.

---

## Missing Node.js Headers

**Symptoms:**
```
gyp ERR! Could not find common.gypi
gyp ERR! Could not find node.h
```

**Solutions:**
```bash
# Download headers for current Node version
node-gyp install

# Force re-download
rm -rf ~/.node-gyp
node-gyp rebuild

# For specific Node version
node-gyp install --target=18.0.0
```

**Why:** Headers are cached in `~/.node-gyp/`. Corruption or version mismatches cause this error.

---

## Make Not Found (Linux/macOS)

**Symptoms:**
```
gyp ERR! build error
gyp ERR! stack Error: `make` failed with exit code: 127
```

**Solutions:**
```bash
# macOS
xcode-select --install

# Ubuntu/Debian
sudo apt-get install build-essential

# CentOS/RHEL
sudo yum groupinstall "Development Tools"

# Verify
make --version
gcc --version
```

**Why:** Build tools aren't installed. Rare on developer machines but common in CI environments.

---

## Permission Denied Errors

**Symptoms:**
```
EACCES: permission denied
gyp ERR! stack Error: EACCES: permission denied, mkdir '...'
```

**Solutions:**
```bash
# DO NOT use sudo npm install - use nvm or fix permissions instead

# Option 1: Use nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install node

# Option 2: Fix npm permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Option 3: Fix ownership (Linux)
sudo chown -R $(whoami) ~/.npm /usr/local/lib/node_modules
```

**Why:** Installing with sudo causes permission issues. Always use a user-owned Node installation.

---

## Undefined Reference / Symbol Not Found

**Symptoms:**
```
undefined reference to `pthread_create'
ld: symbol(s) not found for architecture arm64
```

**Solutions:**

Add missing libraries to binding.gyp:
```json
{
  "targets": [{
    "conditions": [
      ["OS=='linux'", {
        "libraries": ["-lpthread", "-ldl"]
      }],
      ["OS=='mac'", {
        "libraries": ["-framework CoreFoundation"]
      }]
    ]
  }]
}
```

**Why:** Missing system libraries. Platform-specific linking is required.

---

## Verbose Debugging

When errors are unclear, enable detailed logging:

```bash
# Enable detailed logging
node-gyp rebuild --verbose

# Even more detail
node-gyp rebuild --verbose --silly

# Check environment
node-gyp list  # Show installed Node versions
node -p "process.versions"  # Node/V8 versions
npm config list  # npm configuration
```

**Why:** Default output hides crucial details. Verbose mode shows exact compiler commands and errors.
