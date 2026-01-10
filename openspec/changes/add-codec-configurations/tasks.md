# Tasks: Migrate W3C WebCodecs Configurations to OpenSpec

## 1. Verification

- [ ] 1.1 Verify spec delta requirements match W3C spec in `docs/specs/7-configurations/`
- [ ] 1.2 Verify config validation requirements align with implementations in `lib/*.ts`
- [ ] 1.3 Cross-reference with `add-videoencoder-interface` and other codec interface changes for consistency
- [ ] 1.4 Verify Check Configuration Support algorithm matches `docs/specs/7-configurations/7.1-check-configuration-support-with-config.md`
- [ ] 1.5 Verify Clone Configuration algorithm matches `docs/specs/7-configurations/7.2-clone-configuration-with-config.md`
- [ ] 1.6 Verify hardware acceleration enum semantics match `docs/specs/7-configurations/7.9-hardware-acceleration.md`

## 2. Testing

- [ ] 2.1 Verify existing tests in `test/golden/` cover configuration validation requirements
- [ ] 2.2 Identify gaps between spec requirements and test coverage for invalid configs
- [ ] 2.3 Document test mapping for each configuration dictionary validation

## 3. Documentation

- [ ] 3.1 Update compliance matrix in `docs/specs/compliance-matrix.md` with Configurations section status
- [ ] 3.2 Add cross-references to related capabilities (codec interfaces, definitions)

## 4. Archive

- [ ] 4.1 Run `openspec archive add-codec-configurations` after approval and verification
- [ ] 4.2 Verify archived spec renders correctly in `openspec/specs/codec-configurations/spec.md`
