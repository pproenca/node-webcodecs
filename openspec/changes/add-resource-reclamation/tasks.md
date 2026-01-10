## 1. Verify Existing Implementation

- [ ] 1.1 Audit `lib/resource-manager.ts` against W3C spec section 11 requirements
- [ ] 1.2 Verify 10-second inactivity timeout is correctly implemented
- [ ] 1.3 Verify `QuotaExceededError` is thrown correctly on reclamation
- [ ] 1.4 Verify error callback is invoked before close() during reclamation

## 2. Integration with All Codec Types

- [ ] 2.1 Verify VideoEncoder registers with ResourceManager and records activity
- [ ] 2.2 Verify VideoDecoder registers with ResourceManager and records activity
- [ ] 2.3 Verify AudioEncoder registers with ResourceManager and records activity
- [ ] 2.4 Verify AudioDecoder registers with ResourceManager and records activity
- [ ] 2.5 Verify all codecs unregister on close()

## 3. Reclamation Rules Compliance

- [ ] 3.1 Implement transcoding protection: MUST NOT reclaim active background decoder when active encoder exists in same context
- [ ] 3.2 Implement audio playback protection: MUST NOT reclaim AudioDecoder when audio is playing (Node.js: when audio output stream is active)
- [ ] 3.3 Document Node.js adaptation for "background codec" concept (no document.hidden in Node.js)

## 4. Testing

- [ ] 4.1 Expand `test/unit/resource-manager.test.ts` for transcoding protection scenario
- [ ] 4.2 Add test for audio playback protection
- [ ] 4.3 Add integration test for reclamation with real codec instances
- [ ] 4.4 Add stress test for multiple concurrent codecs under resource pressure

## 5. Documentation

- [ ] 5.1 Add JSDoc to ResourceManager public API with `@example` blocks
- [ ] 5.2 Document Node.js-specific behavior vs browser behavior
