# Change: Add Resource Reclamation Capability

## Why

W3C WebCodecs spec section 11 defines resource reclamation rules that allow implementations to proactively reclaim codec resources when constrained. This is critical for server-side Node.js usage where multiple codecs may compete for limited hardware resources (e.g., VideoToolbox on macOS, NVENC on Linux). Currently, node-webcodecs implements a ResourceManager but lacks full spec compliance and integration across all codec types.

## What Changes

- **ADDED**: Resource reclamation capability spec aligned with W3C section 11
- Formalize codec classification rules:
  - Active codec: Made progress on `[[codec work queue]]` in past 10 seconds
  - Inactive codec: No progress in past 10 seconds
  - Background codec: Associated context is not visible (Node.js adaptation)
- Define reclamation rules per spec:
  - MUST NOT reclaim active AND foreground codecs
  - MUST NOT reclaim active background encoders
  - MUST NOT reclaim active background decoders when paired with active encoder (transcoding protection)
  - To reclaim: run close algorithm with `QuotaExceededError`
- Node.js-specific extensions:
  - Process-level resource tracking (Node.js has no document/tab concept)
  - Explicit `ResourceManager` API for testing and advanced control

## Impact

- Affected specs: New `resource-reclamation` capability
- Affected code:
  - `lib/resource-manager.ts` (already exists, verify spec compliance)
  - `lib/video-encoder.ts`, `lib/video-decoder.ts` (integration exists)
  - `lib/audio-encoder.ts`, `lib/audio-decoder.ts` (verify integration)
  - `test/unit/resource-manager.test.ts` (already exists, may need expansion)

## Dependencies

- Requires codec interfaces (`add-audiodecoder-interface`, `add-audioencoder-interface`, `add-videodecoder-interface`, `add-videoencoder-interface`) to be finalized for consistent integration
