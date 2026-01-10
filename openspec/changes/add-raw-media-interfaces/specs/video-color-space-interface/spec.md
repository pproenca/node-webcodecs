# VideoColorSpace Interface Capability

Defines the VideoColorSpace interface and related enums for video color representation per W3C WebCodecs spec sections 9.9-9.12.

## ADDED Requirements

### Requirement: VideoColorSpace Constructor

The system SHALL provide a VideoColorSpace constructor that accepts an optional VideoColorSpaceInit dictionary.

VideoColorSpaceInit dictionary:
- primaries: VideoColorPrimaries? (default null)
- transfer: VideoTransferCharacteristics? (default null)
- matrix: VideoMatrixCoefficients? (default null)
- fullRange: boolean? (default null)

If no init is provided, all internal slots SHALL be set to null.

#### Scenario: Construct with defaults

- **WHEN** new VideoColorSpace() is called with no arguments
- **THEN** primaries, transfer, matrix, and fullRange are all null

#### Scenario: Construct with partial init

- **GIVEN** VideoColorSpaceInit { primaries: "bt709", fullRange: true }
- **WHEN** new VideoColorSpace(init) is called
- **THEN** primaries is "bt709", fullRange is true, transfer and matrix are null

### Requirement: VideoColorSpace Attributes

VideoColorSpace SHALL expose the following readonly attributes:

- primaries: VideoColorPrimaries? - Returns [[primaries]]
- transfer: VideoTransferCharacteristics? - Returns [[transfer]]
- matrix: VideoMatrixCoefficients? - Returns [[matrix]]
- fullRange: boolean? - Returns [[full range]]

All attributes MAY return null to indicate "unspecified".

#### Scenario: Access color space attributes

- **GIVEN** a VideoColorSpace constructed with { primaries: "bt2020", transfer: "pq", matrix: "bt2020-ncl", fullRange: false }
- **WHEN** attributes are accessed
- **THEN** primaries returns "bt2020", transfer returns "pq", matrix returns "bt2020-ncl", fullRange returns false

### Requirement: VideoColorSpace toJSON Method

The system SHALL provide a toJSON() method that returns a VideoColorSpaceInit dictionary.

- The returned dictionary SHALL contain all four properties
- Properties with null values SHALL be included as null

#### Scenario: Serialize to JSON

- **GIVEN** a VideoColorSpace with primaries "smpte432" and all other values null
- **WHEN** toJSON() is called
- **THEN** { primaries: "smpte432", transfer: null, matrix: null, fullRange: null } is returned

### Requirement: VideoColorPrimaries Enum

The system SHALL provide a VideoColorPrimaries enum with the following values:

- "bt709" - BT.709/sRGB primaries (H.273 table 2 value 1)
- "bt470bg" - BT.601 PAL primaries (H.273 table 2 value 5)
- "smpte170m" - BT.601 NTSC primaries (H.273 table 2 value 6)
- "bt2020" - BT.2020/BT.2100 primaries (H.273 table 2 value 9)
- "smpte432" - P3 D65 primaries (H.273 table 2 value 12)

#### Scenario: Valid color primaries values

- **WHEN** a VideoColorPrimaries value is used
- **THEN** it MUST be one of: "bt709", "bt470bg", "smpte170m", "bt2020", "smpte432"

### Requirement: VideoTransferCharacteristics Enum

The system SHALL provide a VideoTransferCharacteristics enum with the following values:

- "bt709" - BT.709 transfer (H.273 table 3 value 1)
- "smpte170m" - BT.601 transfer (H.273 table 3 value 6, functionally same as bt709)
- "iec61966-2-1" - sRGB transfer (H.273 table 3 value 13)
- "linear" - Linear RGB transfer (H.273 table 3 value 8)
- "pq" - BT.2100 PQ/HDR10 transfer (H.273 table 3 value 16)
- "hlg" - BT.2100 HLG transfer (H.273 table 3 value 18)

#### Scenario: Valid transfer characteristics values

- **WHEN** a VideoTransferCharacteristics value is used
- **THEN** it MUST be one of: "bt709", "smpte170m", "iec61966-2-1", "linear", "pq", "hlg"

### Requirement: VideoMatrixCoefficients Enum

The system SHALL provide a VideoMatrixCoefficients enum with the following values:

- "rgb" - Identity/sRGB matrix (H.273 table 4 value 0)
- "bt709" - BT.709 matrix (H.273 table 4 value 1)
- "bt470bg" - BT.601 PAL matrix (H.273 table 4 value 5)
- "smpte170m" - BT.601 NTSC matrix (H.273 table 4 value 6, functionally same as bt470bg)
- "bt2020-ncl" - BT.2020 NCL matrix (H.273 table 4 value 9)

#### Scenario: Valid matrix coefficients values

- **WHEN** a VideoMatrixCoefficients value is used
- **THEN** it MUST be one of: "rgb", "bt709", "bt470bg", "smpte170m", "bt2020-ncl"
