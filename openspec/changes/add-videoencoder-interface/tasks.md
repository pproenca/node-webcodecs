# Tasks: Migrate W3C VideoEncoder Interface to OpenSpec

## 1. Verification

- [ ] 1.1 Verify spec delta requirements match W3C spec in `docs/specs/6-videoencoder-interface/`
- [ ] 1.2 Verify requirements align with current implementation in `lib/video-encoder.ts`
- [ ] 1.3 Cross-reference with `add-webcodecs-definitions` and `add-codec-processing-model` for consistency
- [ ] 1.4 Verify Output EncodedVideoChunks algorithm matches `docs/specs/6-videoencoder-interface/6.6-algorithms.md`
- [ ] 1.5 Verify EncodedVideoChunkMetadata structure matches `docs/specs/6-videoencoder-interface/6.7-encodedvideochunkmetadata.md`

## 2. Testing

- [ ] 2.1 Verify existing tests in `test/golden/` cover VideoEncoder requirements
- [ ] 2.2 Identify gaps between spec requirements and test coverage
- [ ] 2.3 Document test mapping for each requirement

## 3. Documentation

- [ ] 3.1 Update compliance matrix in `docs/specs/compliance-matrix.md` with VideoEncoder section status
- [ ] 3.2 Add cross-references to related capabilities (definitions, processing model)

## 4. Archive

- [ ] 4.1 Run `openspec archive add-videoencoder-interface` after approval and verification
- [ ] 4.2 Verify archived spec renders correctly in `openspec/specs/videoencoder-interface/spec.md`
