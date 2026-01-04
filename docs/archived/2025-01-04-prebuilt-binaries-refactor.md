     Goal: Validate current prebuildify implementation against official Node.js N-API documentation and optimize based on best practices.

     Status: Project already uses prebuildify (.github/workflows/ci.yml), but needs validation against official guidance and potential simplification.

     ---
     Background: Current Architecture

     What You Have ✅

     1. Prebuildify workflow in ci.yml (lines 158-259)
     2. Static FFmpeg linking via binding.gyp (pkg-config --libs --static)
     3. Platform packages (@pproenca/node-webcodecs-{platform})
     4. node-gyp-build runtime for loading prebuilds
     5. Separate FFmpeg binary pipeline (build-ffmpeg.yml)

     Current Flow

     build-ffmpeg.yml → deps-vN release → ci.yml downloads FFmpeg →
     prebuildify creates .node → packages as npm tarballs →
     release.yml publishes to npm

     ---
     Official Documentation References

     All validation tasks below reference these official Node.js docs:

     - https://nodejs.org/api/n-api.html#building — Toolchain requirements, node-gyp vs CMake.js
     - https://nodejs.org/api/n-api.html#uploading-precompiled-binaries — prebuildify, node-pre-gyp, prebuild comparison

     ---
     Phase 1: Validate Toolchain Setup (N-API Building Docs)

     Reference: https://nodejs.org/api/n-api.html#building

     Task 1.1: Verify Platform Toolchains

     Files to check:
     - .github/workflows/ci.yml (Linux/macOS runners)
     - docker/Dockerfile.linux-x64-glibc (Linux build container)
     - .github/workflows/build-ffmpeg.yml (macOS setup)

     Official requirements:
     - Linux: GCC or LLVM ✅ (using Docker with GCC)
     - macOS: Xcode command-line tools ✅ (GitHub-hosted runners include this)
     - Windows: Visual Studio (NOT IMPLEMENTED - document this gap)

     Validation steps:
     1. Read ci.yml build-native job (check toolchain installation steps)
     2. Confirm Docker images have GCC/build-essential
     3. Document Windows platform gap in plan

     Expected outcome: Document which platforms meet N-API toolchain requirements and identify gaps.

     ---
     Task 1.2: Validate node-gyp Configuration

     Reference: https://nodejs.org/api/n-api.html#building (node-gyp section)

     Files to check:
     - binding.gyp (build configuration)
     - package.json (node-gyp version in devDependencies)
     - gyp/ffmpeg-paths-lib.js (custom GYP integration)

     Official guidance:
     node-gyp is based on the gyp-next fork of Google's GYP tool. It is bundled with npm and requires that users installing the native addon have a C/C++ toolchain installed.

     Validation checks:
     1. ✅ node-gyp in devDependencies (package.json:96)
     2. ✅ Python requirement documented (needed by node-gyp)
     3. ✅ binding.gyp uses standard targets format
     4. ⚠️ Custom gyp/ffmpeg-paths.js integration — validate this doesn't break standard node-gyp usage

     Action: Read gyp/ffmpeg-paths-lib.js and confirm it follows node-gyp best practices for external library integration.

     ---
     Task 1.3: FFmpeg Static Library Compilation

     Reference: https://nodejs.org/api/n-api.html#building (external dependencies)

     Official guidance from mapbox/node-pre-gyp wiki:
     The easiest method for external dependencies is to compile them as static libraries instead of shared libraries.

     Files to validate:
     - binding.gyp:86 — Linux static linking flags
     - binding.gyp:50 — macOS static linking flags
     - build-ffmpeg.yml:221-225 — FFmpeg build with -fPIC

     Critical validation:
     # Linux (binding.gyp:86)
     "pkg-config --libs --static libavcodec libavformat libavutil libswscale libswresample libavfilter"

     # macOS (binding.gyp:50)
     "pkg-config --libs libavcodec libavformat libavutil libswscale libswresample libavfilter"

     Question: Does macOS build also use --static? Check if the fallback pkg-config command includes static linking.

     Action: Verify both platforms produce self-contained .node binaries with no external FFmpeg dependencies using ldd (Linux) and otool -L (macOS).

     ---
     Phase 2: Validate Prebuildify Implementation (N-API Uploading Docs)

     Reference: https://nodejs.org/api/n-api.html#uploading-precompiled-binaries

     Task 2.1: Confirm prebuildify Tool Choice

     Official guidance:
     prebuildify is a tool based on node-gyp. The advantage of prebuildify is that the built binaries are bundled with the native addon when it's uploaded to npm. The binaries are downloaded from npm and are
      immediately available to the module user when the native addon is installed.

     Current implementation: .github/workflows/ci.yml:180-190
     - name: Run prebuildify
       run: npm run build:scripts && npx tsx scripts/ci/ci-workflow.ts prebuildify --arch ${{ matrix.arch }} --platform ${{ matrix.platform }}

     Validation:
     1. ✅ Uses prebuildify (confirmed in ci.yml)
     2. ✅ Binaries bundled via platform packages (optionalDependencies pattern)
     3. ✅ Uses node-gyp-build for runtime loading (package.json:84)

     Question: Why use custom scripts/ci/ci-workflow.ts prebuildify wrapper instead of direct npx prebuildify --napi?

     Action: Read scripts/ci/ci-workflow.ts and compare to standard prebuildify CLI usage.

     ---
     Task 2.2: Validate Prebuildify CLI Flags

     Official prebuildify docs (not in N-API docs, but standard usage):
     prebuildify --napi --strip

     Your implementation: scripts/ci/ci-workflow.ts (need to read)

     Validation checklist:
     - Uses --napi flag (for N-API ABI stability)
     - Uses --strip flag (reduces binary size)
     - Handles --arch and --platform correctly
     - For Linux: Uses --tag-libc for glibc vs musl distinction?

     Action: Read scripts/ci/ci-workflow.ts prebuildify command and validate flags against standard prebuildify usage.

     ---
     Task 2.3: Validate Platform Package Structure

     Official guidance:
     Binaries are downloaded from npm and are immediately available to the module user when the native addon is installed.

     Current structure: packages/@pproenca/node-webcodecs-{platform}/
     ├── package.json (os/cpu/libc constraints)
     ├── bin/
     │   └── node.napi.node

     Validation:
     1. ✅ Platform constraints in package.json (os, cpu, libc)
     2. ✅ Listed in main package optionalDependencies
     3. ⚠️ Non-standard bin/ directory (prebuildify default is prebuilds/)

     Question: Why use bin/node.napi.node instead of standard prebuilds/{platform}/node.napi.node?

     Official prebuildify structure:
     prebuilds/
     ├── darwin-x64/
     │   └── node.napi.node
     ├── darwin-arm64/
     │   └── node.napi.node
     └── linux-x64/
         └── node.napi.node

     Action: Compare custom structure vs. standard prebuildify layout. Document if there's a technical reason for deviation.

     ---
     Task 2.4: Validate Runtime Loading (node-gyp-build)

     Reference: https://nodejs.org/api/n-api.html#uploading-precompiled-binaries

     Official guidance:
     node-gyp-build works similar to node-gyp build except that it will check if a build or prebuild is present before rebuilding your project.

     Your implementation: lib/binding.ts:22-56
     // Try platform-specific package first
     const pkgPath = require.resolve(`${pkg}/package.json`);
     const binPath = join(dirname(pkgPath), 'bin', 'node.napi.node');
     return require(binPath);

     // Fallback to node-gyp-build
     const nodeGypBuild = require('node-gyp-build');
     return nodeGypBuild(rootDir);

     Validation:
     1. ✅ Uses node-gyp-build for fallback
     2. ⚠️ Custom platform package resolution instead of standard node-gyp-build flow

     Official node-gyp-build usage:
     const binding = require('node-gyp-build')(__dirname);

     Question: Why not use standard node-gyp-build resolution? Does it not support the optionalDependencies pattern?

     Action: Research if node-gyp-build natively supports platform packages via optionalDependencies, or if custom loader is necessary.

     ---
     Phase 3: Validate CI/CD Integration

     Reference: https://nodejs.org/api/n-api.html#uploading-precompiled-binaries

     Official guidance:
     These tools are typically integrated with CI/CD build systems like Travis CI and AppVeyor to build a native addon multiple times for a variety of platforms and architectures.

     Task 3.1: Multi-Platform Build Matrix

     Your implementation: .github/workflows/ci.yml:158-177
     strategy:
       fail-fast: false
       matrix:
         include:
           - os: ubuntu-24.04
             platform: linux-x64
             arch: x64
           - os: macos-15-intel
             platform: darwin-x64
             arch: x64
           - os: macos-15
             platform: darwin-arm64
             arch: arm64

     Validation:
     1. ✅ Native runners (not QEMU emulation) for best performance
     2. ✅ Covers primary platforms (Linux x64, macOS x64/arm64)
     3. ❌ Windows not included (document this gap)

     Official N-API tooling best practice: Use native runners for each architecture (you're doing this correctly).

     ---
     Task 3.2: FFmpeg Dependency Download Strategy

     Your implementation: ci.yml:115-147 (resolve-deps job)
     - name: Find latest deps release
       run: npx tsx scripts/ci/ci-workflow.ts latest-deps-release
     - name: Download FFmpeg binaries
       run: gh release download "$DEPS_TAG" --pattern "ffmpeg-$PLATFORM.tar.gz"

     Validation:
     1. ✅ Hermetic builds (pinned FFmpeg version via deps-vN releases)
     2. ✅ No reliance on system pkg-config during CI
     3. ✅ Reproducible (GitHub release artifacts are immutable)

     Best practice confirmation: This follows the "compile external dependencies as static libraries" guidance from N-API docs.

     ---
     Task 3.3: Binary Packaging & Publishing

     Your implementation:
     - Platform packaging: ci.yml:192-205 → Creates tar files
     - Publishing: release.yml:89-133 → npm publish with provenance

     Validation:
     1. ✅ Uses npm OIDC provenance (security best practice, not in N-API docs but recommended)
     2. ✅ Platform packages published to npm (matches prebuildify guidance)
     3. ⚠️ Complex multi-file workflow (ci.yml → artifacts → release.yml)

     Question: Could this be simplified using standard prebuildify publish workflow?

     Official guidance: Prebuildify bundles binaries directly in the main package when uploaded to npm. Your approach uses separate platform packages instead.

     Trade-off analysis needed:
     - Current (optionalDependencies): Users download only their platform
     - Standard (bundled): Users download all platforms (~200MB for 3 platforms)

     ---
     Phase 4: Optimization Opportunities

     Task 4.1: Windows Platform Support

     Gap identified: No Windows builds in ci.yml

     Official N-API tooling requirement:
     On Windows, all the required items can be installed with Visual Studio. However, it is not necessary to install the full Visual Studio. [...] Alternatively: npm install --global windows-build-tools

     Recommendation: Add Windows to build matrix using:
     - os: windows-latest
       platform: win32-x64
       arch: x64

     Blockers to investigate:
     - Does FFmpeg build produce Windows static libs?
     - Check build-ffmpeg.yml for Windows support (didn't see it in current workflow)

     ---
     Task 4.2: Simplify Platform Package Structure

     Current: Custom bin/node.napi.node path + custom loader
     Standard: prebuilds/{platform}/node.napi.node + node-gyp-build auto-resolution

     Recommendation: Investigate migrating to standard structure:
     1. Change scripts/ci/ci-workflow.ts to output to prebuilds/ dir
     2. Update lib/binding.ts to use standard require('node-gyp-build')(__dirname)
     3. Bundle prebuilds in main package instead of separate optionalDependencies

     Trade-off: Package size increases (~200MB) but installation simplifies.

     Validation: Test that node-gyp-build can find prebuilds in optionalDependencies packages (might not be supported).

     ---
     Task 4.3: libc Tagging for Linux

     Current: Single linux-x64 package (unclear if musl or glibc)

     Official prebuildify guidance: Use --tag-libc flag for musl/glibc distinction

     Recommendation:
     prebuildify --napi --strip --tag-libc glibc  # For most deployments
     prebuildify --napi --strip --tag-libc musl   # For Alpine

     Package names:
     - @pproenca/node-webcodecs-linux-x64-glibc
     - @pproenca/node-webcodecs-linux-x64-musl

     Action: Check if current linux-x64 package is glibc-based (likely yes, since build uses Dockerfile.linux-x64-glibc).

     ---
     Phase 5: Documentation & Validation Testing

     Task 5.1: Create Official Docs Cross-Reference

     File: docs/build-system.md (new file)

     Contents:
     - Link to N-API Building docs with platform toolchain requirements
     - Link to N-API Uploading Precompiled Binaries docs with prebuildify explanation
     - Document why static FFmpeg linking is used (per mapbox/node-pre-gyp wiki guidance)
     - Explain optionalDependencies approach vs. bundled approach
     - Document Windows platform gap

     ---
     Task 5.2: Validate Self-Contained Binaries

     Test on each platform:
     # Linux
     ldd prebuilds/linux-x64/node.napi.node | grep -i ffmpeg
     # Should return NOTHING (static linking)

     # macOS
     otool -L prebuilds/darwin-x64/node.napi.node | grep -i ffmpeg
     # Should return NOTHING (static linking)

     Action: Add CI job to ci.yml that validates no external FFmpeg dependencies.

     ---
     Task 5.3: Binary Size Analysis

     Measure .node file sizes:
     ls -lh prebuilds/*/node.napi.node

     Expected: ~40-70MB per platform (FFmpeg + codecs statically linked)

     Compare to npm 500MB unpacked limit:
     - 3 platforms × 70MB = 210MB (well within limit ✅)

     Document: Add size metrics to release notes or docs.

     ---
     Phase 6: Implementation Steps

     Step 1: Audit Current Implementation

     - Read scripts/ci/ci-workflow.ts prebuildify command
     - Read scripts/ci/platform-package.ts packaging logic
     - Compare to standard npx prebuildify --napi --strip usage
     - Document deviations and rationale

     Step 2: Validate Against N-API Docs

     - Confirm toolchains match N-API Building requirements
     - Confirm prebuildify usage matches N-API Uploading guidance
     - Test binary self-containment (ldd/otool validation)
     - Measure binary sizes

     Step 3: Document Findings

     - Create docs/build-system.md with official doc references
     - Document Windows platform gap
     - Document libc tagging approach (or lack thereof)
     - Explain optionalDependencies vs. bundled approach

     Step 4: Optimize (Optional)

     - Add Windows platform support (requires FFmpeg Windows build first)
     - Consider libc-tagged packages for Linux
     - Evaluate bundled approach vs. optionalDependencies

     Step 5: CI Validation Job

     - Add job to ci.yml that validates binary self-containment
     - Add job that checks binary sizes
     - Add job that verifies N-API version compatibility

     ---
     Critical Files Reference

     | File                      | Purpose                    | Official Docs Reference                                                           |
     |---------------------------|----------------------------|-----------------------------------------------------------------------------------|
     | binding.gyp               | node-gyp build config      | https://nodejs.org/api/n-api.html#building (node-gyp section)                     |
     | .github/workflows/ci.yml  | Prebuildify CI/CD          | https://nodejs.org/api/n-api.html#uploading-precompiled-binaries (CI integration) |
     | lib/binding.ts            | Runtime loading            | https://nodejs.org/api/n-api.html#uploading-precompiled-binaries (node-gyp-build) |
     | package.json              | optionalDependencies       | https://nodejs.org/api/n-api.html#uploading-precompiled-binaries (prebuildify)    |
     | scripts/ci/ci-workflow.ts | Custom prebuildify wrapper | Validate against standard prebuildify CLI                                         |
     | gyp/ffmpeg-paths-lib.js   | FFmpeg static linking      | https://github.com/mapbox/node-pre-gyp/wiki/External-libraries                    |

     ---
     Success Criteria

     1. ✅ Current implementation validated against N-API Building docs (toolchains)
     2. ✅ Current implementation validated against N-API Uploading docs (prebuildify usage)
     3. ✅ Binaries confirmed self-contained (no external FFmpeg deps)
     4. ✅ Documentation created with official doc cross-references
     5. ✅ Optimization opportunities identified (Windows, libc tagging)
     6. ✅ CI validation jobs added

     ---
     Open Questions for User

     1. Why custom bin/ structure instead of prebuilds/? Does node-gyp-build not support optionalDependencies auto-resolution?
     2. Windows support priority? Need FFmpeg Windows build first (not in build-ffmpeg.yml)
     3. libc tagging needed? Most deployments use glibc, but Alpine users need musl
     4. Bundled vs. optionalDependencies? Current approach saves bandwidth, but adds complexity
     5. Binary size acceptable? ~70MB per platform = ~210MB total (within npm 500MB limit)

     ---
     Next Steps

     After plan approval, execute phases 1-5 sequentially:
     1. Phase 1: Read and validate toolchain setup (1-2 tasks)
     2. Phase 2: Read and validate prebuildify implementation (4 tasks)
     3. Phase 3: Validate CI/CD integration (3 tasks)
     4. Phase 4: Identify optimization opportunities (3 tasks)
     5. Phase 5: Documentation + testing (3 tasks)
     6. Phase 6: Implement improvements (if any identified)

     Total estimated tasks: ~15-20 validation/documentation tasks + optional optimization work.