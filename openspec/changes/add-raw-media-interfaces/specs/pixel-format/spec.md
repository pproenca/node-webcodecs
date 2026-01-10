# Pixel Format Capability

Defines the VideoPixelFormat enum and related concepts for video frame pixel arrangements per W3C WebCodecs spec section 9.8.

## ADDED Requirements

### Requirement: VideoPixelFormat Enum

The system SHALL provide a VideoPixelFormat enum that describes the arrangement and bit depth of video frame pixels.

The enum SHALL include 4:2:0 YUV formats:
- "I420" - 8-bit Y, U, V planes, U/V subsampled 2x horizontally and vertically
- "I420P10" - 10-bit Y, U, V planes (stored in 16-bit), 2x subsampling
- "I420P12" - 12-bit Y, U, V planes (stored in 16-bit), 2x subsampling
- "I420A" - 8-bit Y, U, V, A planes, U/V subsampled 2x
- "I420AP10" - 10-bit Y, U, V, A planes, 2x subsampling
- "I420AP12" - 12-bit Y, U, V, A planes, 2x subsampling

The enum SHALL include 4:2:2 YUV formats:
- "I422" - 8-bit Y, U, V planes, U/V subsampled 2x horizontally only
- "I422P10" - 10-bit Y, U, V planes, 2x horizontal subsampling
- "I422P12" - 12-bit Y, U, V planes, 2x horizontal subsampling
- "I422A" - 8-bit Y, U, V, A planes, 2x horizontal subsampling
- "I422AP10" - 10-bit Y, U, V, A planes, 2x horizontal subsampling
- "I422AP12" - 12-bit Y, U, V, A planes, 2x horizontal subsampling

The enum SHALL include 4:4:4 YUV formats:
- "I444" - 8-bit Y, U, V planes, no subsampling
- "I444P10" - 10-bit Y, U, V planes, no subsampling
- "I444P12" - 12-bit Y, U, V planes, no subsampling
- "I444A" - 8-bit Y, U, V, A planes, no subsampling
- "I444AP10" - 10-bit Y, U, V, A planes, no subsampling
- "I444AP12" - 12-bit Y, U, V, A planes, no subsampling

The enum SHALL include semi-planar and packed formats:
- "NV12" - 8-bit Y plane, interleaved UV plane, 2x subsampling
- "RGBA" - 8-bit packed Red, Green, Blue, Alpha
- "RGBX" - 8-bit packed Red, Green, Blue, padding (opaque)
- "BGRA" - 8-bit packed Blue, Green, Red, Alpha
- "BGRX" - 8-bit packed Blue, Green, Red, padding (opaque)

#### Scenario: Valid pixel format values

- **WHEN** a VideoPixelFormat value is used
- **THEN** it MUST be one of the 24 defined format strings

### Requirement: I420 Subsampling Layout

For I420-based formats (I420, I420P10, I420P12, I420A, I420AP10, I420AP12), the system SHALL implement 4:2:0 chroma subsampling.

- Y plane: codedWidth * codedHeight samples
- U plane: ceil(codedWidth/2) * ceil(codedHeight/2) samples
- V plane: ceil(codedWidth/2) * ceil(codedHeight/2) samples
- A plane (if present): codedWidth * codedHeight samples
- visibleRect.x and visibleRect.y MUST be even numbers

#### Scenario: I420 plane sizes

- **GIVEN** a VideoFrame with format "I420", codedWidth 1920, codedHeight 1080
- **WHEN** plane sizes are calculated
- **THEN** Y plane is 2,073,600 bytes, U plane is 518,400 bytes, V plane is 518,400 bytes

### Requirement: I422 Subsampling Layout

For I422-based formats (I422, I422P10, I422P12, I422A, I422AP10, I422AP12), the system SHALL implement 4:2:2 chroma subsampling.

- Y plane: codedWidth * codedHeight samples
- U plane: ceil(codedWidth/2) * codedHeight samples
- V plane: ceil(codedWidth/2) * codedHeight samples
- A plane (if present): codedWidth * codedHeight samples
- visibleRect.x MUST be even

#### Scenario: I422 plane sizes

- **GIVEN** a VideoFrame with format "I422", codedWidth 1920, codedHeight 1080
- **WHEN** plane sizes are calculated
- **THEN** Y plane is 2,073,600 bytes, U plane is 1,036,800 bytes, V plane is 1,036,800 bytes

### Requirement: I444 No Subsampling Layout

For I444-based formats (I444, I444P10, I444P12, I444A, I444AP10, I444AP12), the system SHALL implement 4:4:4 chroma (no subsampling).

- All planes have codedWidth * codedHeight samples
- No alignment restrictions on visibleRect

#### Scenario: I444 plane sizes

- **GIVEN** a VideoFrame with format "I444", codedWidth 1920, codedHeight 1080
- **WHEN** plane sizes are calculated
- **THEN** Y, U, and V planes are each 2,073,600 bytes

### Requirement: NV12 Semi-Planar Layout

For NV12 format, the system SHALL implement semi-planar 4:2:0 layout.

- Y plane: codedWidth * codedHeight samples (8-bit)
- UV plane: codedWidth * ceil(codedHeight/2) samples with interleaved U, V pairs
- visibleRect.x and visibleRect.y MUST be even numbers

#### Scenario: NV12 layout

- **GIVEN** a VideoFrame with format "NV12", codedWidth 16, codedHeight 10
- **WHEN** the buffer layout is examined
- **THEN** Y plane has 160 bytes, UV plane has 80 bytes (40 U/V pairs)

### Requirement: RGBA/BGRA Packed Layout

For packed RGB formats (RGBA, RGBX, BGRA, BGRX), the system SHALL implement single-plane layout.

- Single plane: codedWidth * codedHeight * 4 bytes
- Each pixel is 4 consecutive bytes in the specified component order
- X formats (RGBX, BGRX) SHALL ignore the fourth byte (always opaque)

#### Scenario: RGBA layout

- **GIVEN** a VideoFrame with format "RGBA", codedWidth 1920, codedHeight 1080
- **WHEN** the buffer size is calculated
- **THEN** the single plane is 8,294,400 bytes (1920 * 1080 * 4)

### Requirement: Equivalent Opaque Format

Pixel formats with alpha channels SHALL have a defined equivalent opaque format.

- I420A -> I420, I420AP10 -> I420P10, I420AP12 -> I420P12
- I422A -> I422, I422AP10 -> I422P10, I422AP12 -> I422P12
- I444A -> I444, I444AP10 -> I444P10, I444AP12 -> I444P12
- RGBA -> RGBX, BGRA -> BGRX
- Formats without alpha are their own equivalent opaque format

#### Scenario: Alpha to opaque conversion

- **GIVEN** a VideoFrame with format "I420A"
- **WHEN** copyTo is called with format "I420"
- **THEN** the alpha channel is dropped and the opaque format is produced
