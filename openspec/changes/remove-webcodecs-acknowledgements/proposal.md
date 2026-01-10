# Change: Remove W3C Acknowledgements Section

## Why

The `docs/specs/15-acknowledgements.md` file contains W3C-specific acknowledgements for contributors to the WebCodecs specification itself, not to this Node.js implementation. This content:
- Credits W3C working group members who contributed to the browser specification
- Is not relevant to users of node-webcodecs
- Creates confusion about the distinction between the W3C spec and this implementation
- Adds maintenance overhead for content that provides no value to implementers

## What Changes

- **Remove** `docs/specs/15-acknowledgements.md`
- **Update** `docs/specs/TOC.md` to remove the acknowledgements link
- **Update** `docs/specs/TODO.md` to remove the acknowledgements checkbox
- **Update** `docs/specs/compliance-matrix.md` to remove the acknowledgements section
- **Update** cross-references in `12-security-considerations.md` and `13-privacy-considerations.md`

## Impact

- Affected docs: `docs/specs/` directory (multiple files)
- Affected code: None - documentation only
- Breaking changes: None
- User-facing changes: Cleaner documentation that focuses on implementation details
