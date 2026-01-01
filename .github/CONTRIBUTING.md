# Contributing to node-webcodecs

Thank you for your interest in contributing!

## Reporting Bugs

Please create a [new issue](https://github.com/aspect-build/node-webcodecs/issues/new) with:

- Steps to reproduce
- Expected vs actual behavior
- Node.js version and OS
- node-webcodecs version

## Development Setup

1. **Prerequisites:**
   - Node.js 18+
   - FFmpeg development libraries
   - C++17 compiler

2. **Clone and build:**
   ```sh
   git clone https://github.com/aspect-build/node-webcodecs.git
   cd node-webcodecs
   npm install
   npm run build
   ```

3. **Run tests:**
   ```sh
   npm test
   ```

## Code Style

- **TypeScript/JavaScript:** Linted with Biome
- **C++:** Google C++ style (cpplint)
- **Markdown:** Formatted with Prettier

Run `npm run lint` to check all, `npm run format` to fix markdown.

## Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes with tests
4. Run `npm test` to verify
5. Submit a PR against `master`

## Running Tests

```sh
# All tests
npm test

# Specific test file
npx vitest run test/golden/video-encoder.test.ts

# Stress tests
npm run test:stress
```

## Building

```sh
# Full build (native + TypeScript)
npm run build

# Native only (C++ addon)
npm run build:native

# TypeScript only
npm run build:ts
```

## Questions

Open an issue or reach out to maintainers.
