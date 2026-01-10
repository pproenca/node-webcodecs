# VideoFrame Interface Capability

Defines the VideoFrame interface for raw video frame data per W3C WebCodecs spec section 9.4.

## ADDED Requirements

### Requirement: VideoFrame Constructor from CanvasImageSource

The system SHALL provide a VideoFrame constructor that accepts a CanvasImageSource and optional VideoFrameInit dictionary.

VideoFrameInit dictionary:
- duration: unsigned long long? (microseconds)
- timestamp: long long? (microseconds)
- alpha: AlphaOption ("keep" | "discard", default "keep")
- visibleRect: DOMRectInit? (default matches source dimensions)
- rotation: double (default 0, valid values: 0, 90, 180, 270)
- flip: boolean (default false)
- displayWidth: unsigned long? (default from source or visibleRect)
- displayHeight: unsigned long? (default from source or visibleRect)
- metadata: VideoFrameMetadata?

For Node.js, CanvasImageSource includes Buffer and TypedArray representations of image data.

#### Scenario: Construct from image source

- **GIVEN** a valid image source and VideoFrameInit { timestamp: 0, duration: 33333 }
- **WHEN** new VideoFrame(source, init) is called
- **THEN** a VideoFrame is created with the specified timestamp and duration

#### Scenario: Constructor requires timestamp

- **GIVEN** an image source without timestamp in VideoFrameInit and source has no intrinsic timestamp
- **WHEN** new VideoFrame(source, {}) is called
- **THEN** a TypeError is thrown

### Requirement: VideoFrame Constructor from Buffer

The system SHALL provide a VideoFrame constructor that accepts an AllowSharedBufferSource and VideoFrameBufferInit dictionary.

VideoFrameBufferInit dictionary (all required unless noted):
- format: VideoPixelFormat (required)
- codedWidth: unsigned long (required)
- codedHeight: unsigned long (required)
- timestamp: long long (required, microseconds)
- duration: unsigned long long? (optional, microseconds)
- layout: sequence<PlaneLayout>? (default tightly packed)
- visibleRect: DOMRectInit? (default full coded size at 0,0)
- rotation: double (default 0)
- flip: boolean (default false)
- displayWidth: unsigned long? (default from visibleRect)
- displayHeight: unsigned long? (default from visibleRect)
- colorSpace: VideoColorSpaceInit?
- transfer: sequence<ArrayBuffer>? (default empty)
- metadata: VideoFrameMetadata?

#### Scenario: Construct I420 frame from buffer

- **GIVEN** a 460800-byte buffer (640x480 I420) and VideoFrameBufferInit { format: "I420", codedWidth: 640, codedHeight: 480, timestamp: 0 }
- **WHEN** new VideoFrame(buffer, init) is called
- **THEN** a VideoFrame is created with the specified dimensions and format

#### Scenario: Constructor validates buffer size

- **GIVEN** a 100-byte buffer and VideoFrameBufferInit { format: "I420", codedWidth: 640, codedHeight: 480, timestamp: 0 }
- **WHEN** new VideoFrame(buffer, init) is called
- **THEN** a TypeError is thrown

#### Scenario: Construct with custom layout

- **GIVEN** a buffer with stride padding and VideoFrameBufferInit with layout specifying offsets and strides
- **WHEN** new VideoFrame(buffer, init) is called
- **THEN** a VideoFrame is created using the specified plane layouts

### Requirement: VideoFrame Attributes

VideoFrame SHALL expose the following readonly attributes:

- format: VideoPixelFormat? - Returns [[format]] or null if closed
- codedWidth: unsigned long - Returns [[coded width]]
- codedHeight: unsigned long - Returns [[coded height]]
- codedRect: DOMRectReadOnly? - Returns rect covering full coded dimensions, or null if closed
- visibleRect: DOMRectReadOnly? - Returns [[visible rect]], or null if closed
- rotation: double - Returns [[rotation]] (0, 90, 180, or 270)
- flip: boolean - Returns [[flip]]
- displayWidth: unsigned long - Returns [[display width]]
- displayHeight: unsigned long - Returns [[display height]]
- duration: unsigned long long? - Returns [[duration]] in microseconds, or null if not set
- timestamp: long long - Returns [[timestamp]] in microseconds
- colorSpace: VideoColorSpace - Returns [[color space]]

#### Scenario: Access attributes on valid VideoFrame

- **GIVEN** an open VideoFrame with format "I420", codedWidth 1920, codedHeight 1080, timestamp 1000000
- **WHEN** attributes are accessed
- **THEN** format returns "I420", codedWidth returns 1920, codedHeight returns 1080, timestamp returns 1000000

#### Scenario: Access format on closed VideoFrame

- **GIVEN** a VideoFrame that has been closed
- **WHEN** format is accessed
- **THEN** null is returned

### Requirement: VideoFrame metadata Method

The system SHALL provide a metadata() method that returns a VideoFrameMetadata dictionary.

- The returned dictionary MAY be empty if no metadata was provided
- Standard metadata fields are defined in the VideoFrame Metadata Registry

#### Scenario: Get metadata from frame

- **GIVEN** a VideoFrame constructed with metadata { captureTime: 12345.67 }
- **WHEN** metadata() is called
- **THEN** { captureTime: 12345.67 } is returned

### Requirement: VideoFrame allocationSize Method

The system SHALL provide an allocationSize(options?) method that returns the number of bytes required to hold the frame data when copied.

VideoFrameCopyToOptions dictionary:
- rect: DOMRectInit? (default visibleRect)
- layout: sequence<PlaneLayout>? (default tightly packed)
- format: VideoPixelFormat? (RGBA, RGBX, BGRA, BGRX only for conversion)
- colorSpace: PredefinedColorSpace? (only for RGB format conversion, default "srgb")

The rect coordinates MUST be sample-aligned for the format's subsampling.

#### Scenario: Calculate allocation size for full frame

- **GIVEN** a VideoFrame with format "I420", codedWidth 1920, codedHeight 1080
- **WHEN** allocationSize() is called
- **THEN** 3110400 is returned (Y: 2073600 + U: 518400 + V: 518400)

#### Scenario: Calculate allocation size with format conversion

- **GIVEN** a VideoFrame with format "I420", visibleRect 1920x1080
- **WHEN** allocationSize({ format: "RGBA" }) is called
- **THEN** 8294400 is returned (1920 * 1080 * 4)

### Requirement: VideoFrame copyTo Method

The system SHALL provide a copyTo(destination, options?) method that returns a Promise resolving to sequence<PlaneLayout>.

- The destination buffer MUST have sufficient space (at least allocationSize(options) bytes)
- For multi-plane formats, planes are copied consecutively (or according to layout)
- Format conversion SHALL be performed if options.format differs from source format
- The returned PlaneLayout sequence describes where each plane was written
- The method SHALL throw InvalidStateError if VideoFrame is closed

#### Scenario: Copy I420 frame to buffer

- **GIVEN** a VideoFrame with format "I420", 640x480
- **WHEN** copyTo(buffer) is called with a 460800-byte buffer
- **THEN** Promise resolves with [{ offset: 0, stride: 640 }, { offset: 307200, stride: 320 }, { offset: 384000, stride: 320 }]

#### Scenario: Copy with format conversion to RGBA

- **GIVEN** a VideoFrame with format "I420"
- **WHEN** copyTo(buffer, { format: "RGBA" }) is called
- **THEN** Promise resolves with [{ offset: 0, stride: width * 4 }] and buffer contains RGBA data

#### Scenario: Copy partial rect

- **GIVEN** a VideoFrame with format "I420", codedWidth 1920, codedHeight 1080
- **WHEN** copyTo(buffer, { rect: { x: 0, y: 0, width: 640, height: 480 } }) is called
- **THEN** only the specified region is copied

### Requirement: VideoFrame clone Method

The system SHALL provide a clone() method that returns a new VideoFrame referencing the same media resource.

- The new VideoFrame SHALL have identical attribute values
- Both VideoFrame objects SHALL share the same underlying [[resource reference]]
- The method SHALL throw InvalidStateError if the VideoFrame is closed

#### Scenario: Clone creates shared reference

- **GIVEN** an open VideoFrame
- **WHEN** clone() is called
- **THEN** a new VideoFrame is returned with identical attributes
- **AND** closing one does not affect the other's access to data

### Requirement: VideoFrame close Method

The system SHALL provide a close() method that releases the [[resource reference]].

- After close(), format, codedRect, and visibleRect SHALL return null
- After close(), calling allocationSize(), copyTo(), clone(), or metadata() SHALL throw InvalidStateError
- close() MAY be called multiple times (subsequent calls are no-op)

#### Scenario: Close releases resources

- **GIVEN** an open VideoFrame
- **WHEN** close() is called
- **THEN** format returns null
- **AND** clone() throws InvalidStateError

### Requirement: PlaneLayout Dictionary

The system SHALL provide a PlaneLayout dictionary for specifying memory layout of video planes.

PlaneLayout dictionary:
- offset: unsigned long (required) - Byte offset where the plane begins
- stride: unsigned long (required) - Bytes per row including padding

#### Scenario: Use PlaneLayout for custom stride

- **GIVEN** a buffer with Y plane at offset 0 with stride 2048 (padded from 1920)
- **WHEN** VideoFrame is constructed with layout [{ offset: 0, stride: 2048 }, ...]
- **THEN** the VideoFrame correctly interprets the padded layout

### Requirement: VideoFrameCopyToOptions Dictionary

The system SHALL provide VideoFrameCopyToOptions for controlling copyTo behavior.

- rect: Copy only the specified rectangle (must be sample-aligned)
- layout: Use custom offsets and strides in destination
- format: Convert to RGBA, RGBX, BGRA, or BGRX during copy
- colorSpace: Target color space for RGB conversion ("srgb" or "display-p3")

#### Scenario: Copy with non-default visible rect

- **GIVEN** a VideoFrame with visibleRect { x: 100, y: 100, width: 1720, height: 880 }
- **WHEN** copyTo(buffer, { rect: { x: 0, y: 0, width: 1920, height: 1080 } }) is called
- **THEN** the full coded region is copied (not just visibleRect)
