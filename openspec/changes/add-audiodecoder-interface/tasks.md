# Tasks: Migrate W3C AudioDecoder Interface to OpenSpec

## 1. Verification

- [ ] 1.1 Verify spec delta requirements match W3C spec in `docs/specs/3-audiodecoder-interface/`
- [ ] 1.2 Verify requirements align with current implementation in `lib/audio-decoder.ts`
- [ ] 1.3 Cross-reference with `add-webcodecs-definitions` and `add-codec-processing-model` for consistency

## 2. Testing

- [ ] 2.1 Verify existing tests in `test/golden/` cover AudioDecoder requirements
- [ ] 2.2 Identify gaps between spec requirements and test coverage
- [ ] 2.3 Document test mapping for each requirement

## 3. Documentation

- [ ] 3.1 Update compliance matrix in `docs/specs/compliance-matrix.md` with AudioDecoder section status
- [ ] 3.2 Add cross-references to related capabilities (definitions, processing model)

## 4. Archive

- [ ] 4.1 Run `openspec archive add-audiodecoder-interface` after approval and verification
- [ ] 4.2 Verify archived spec renders correctly in `openspec/specs/audiodecoder-interface/spec.md`
