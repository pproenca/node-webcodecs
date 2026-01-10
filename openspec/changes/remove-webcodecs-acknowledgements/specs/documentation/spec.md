# Documentation Cleanup

## REMOVED Requirements

### Requirement: W3C Acknowledgements Section

The W3C Acknowledgements section SHALL be removed from the documentation.

**Reason**: The acknowledgements content credits W3C working group members who contributed to the WebCodecs browser specification, not to the node-webcodecs implementation. This creates confusion about the distinction between the upstream W3C spec and this Node.js implementation.

**Migration**: Users seeking W3C acknowledgements should refer to the original W3C WebCodecs specification at https://www.w3.org/TR/webcodecs/

#### Scenario: Acknowledgements file removed
- **WHEN** a user browses the `docs/specs/` directory
- **THEN** the file `15-acknowledgements.md` SHALL NOT exist
- **AND** no broken links SHALL reference the removed file

#### Scenario: TOC updated
- **WHEN** a user views `docs/specs/TOC.md`
- **THEN** there SHALL be no entry for "15. Acknowledgements"
