# Code Style and Conventions

## C++ Style
- **Style Guide**: Google C++ Style Guide (configured in `.clang-format`)
- **File Extensions**: `.cc` for source files, `.h` for headers
- **Formatting Tool**: `clang-format -i -style=file`
- **Linting Tool**: `cpplint --recursive src/`
- **Pointer Alignment**: Left-aligned (`Type* ptr` not `Type *ptr`)

### Naming Conventions (C++)
- Classes: `PascalCase` (e.g., `VideoEncoder`, `EncodedVideoChunk`)
- Methods: `PascalCase` (e.g., `Configure`, `Encode`, `GetState`)
- Variables: `snake_case` (e.g., `frame_data`, `codec_context`)
- Constants: `kPascalCase` (e.g., `kDefaultBitrate`)

## TypeScript Style
- **Target**: ES2020
- **Module**: CommonJS
- **Strict Mode**: Enabled
- **Declaration Files**: Generated automatically

### Naming Conventions (TypeScript)
- Classes: `PascalCase` (e.g., `VideoEncoder`)
- Methods/Properties: `camelCase` (e.g., `encodeQueueSize`, `configure`)
- Private members: `_camelCase` prefix (e.g., `_native`, `_state`, `_closed`)
- Constants: `camelCase` for module-level (e.g., `native`)

## Test File Conventions
- Numbered sequentially: `01_smoke.js`, `02_frame_data.js`, etc.
- Plain JavaScript (not TypeScript)
- Use Node.js built-in `assert` module
- Located in `test/` directory

## Architecture Patterns
- TypeScript classes wrap native C++ objects via `_native` property
- State machine pattern: `unconfigured` → `configured` → `closed`
- Callback pattern for async output (output/error callbacks)

## File Organization
```
lib/           # TypeScript source
  index.ts     # Main exports, class implementations
  types.ts     # Type definitions
src/           # C++ native addon source
  addon.cc     # Module entry point
  *_encoder.cc/h   # Encoder implementations
  *_decoder.cc/h   # Decoder implementations
  *_frame.cc/h     # Frame containers
  encoded_*_chunk.cc/h  # Encoded data containers
test/          # Test files
dist/          # Compiled TypeScript output
build/         # Native addon build output
```
