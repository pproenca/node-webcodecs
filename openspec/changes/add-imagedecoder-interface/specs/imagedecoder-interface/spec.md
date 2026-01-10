# ImageDecoder Interface

W3C WebCodecs Section 10: Image Decoding capability for node-webcodecs.

## ADDED Requirements

### Requirement: ImageDecoder Constructor

The system SHALL provide an ImageDecoder constructor that accepts an ImageDecoderInit dictionary and initializes internal state per W3C spec Section 10.2.2.

#### Scenario: Construct with BufferSource data

- **GIVEN** ImageDecoderInit with type "image/png" and data as Uint8Array containing valid PNG bytes
- **WHEN** new ImageDecoder(init) is called
- **THEN** ImageDecoder is created with type "image/png", complete true, and tracks containing one ImageTrack

#### Scenario: Construct with ReadableStream data

- **GIVEN** ImageDecoderInit with type "image/gif" and data as ReadableStream of GIF bytes
- **WHEN** new ImageDecoder(init) is called
- **THEN** ImageDecoder is created with complete false initially, completed promise pending, and tracks.ready pending

#### Scenario: Reject invalid ImageDecoderInit

- **GIVEN** ImageDecoderInit with desiredWidth but no desiredHeight
- **WHEN** new ImageDecoder(init) is called
- **THEN** TypeError is thrown per W3C spec Section 10.3 step 4

#### Scenario: Reject unsupported type

- **GIVEN** ImageDecoderInit with type "image/unsupported" and valid data
- **WHEN** new ImageDecoder(init) is called and decode() is called
- **THEN** NotSupportedError DOMException is thrown

### Requirement: ImageDecoder Type Attribute

ImageDecoder SHALL expose a readonly type attribute that returns the MIME type string provided at construction.

#### Scenario: Type getter returns construction type

- **GIVEN** ImageDecoder constructed with type "image/jpeg"
- **WHEN** decoder.type is accessed
- **THEN** "image/jpeg" is returned

### Requirement: ImageDecoder Complete Attribute

ImageDecoder SHALL expose a readonly complete attribute indicating whether encoded data is fully buffered.

#### Scenario: Complete true for BufferSource

- **GIVEN** ImageDecoder constructed with BufferSource data
- **WHEN** decoder.complete is accessed
- **THEN** true is returned

#### Scenario: Complete false for pending ReadableStream

- **GIVEN** ImageDecoder constructed with ReadableStream data that has not finished
- **WHEN** decoder.complete is accessed
- **THEN** false is returned

### Requirement: ImageDecoder Completed Promise

ImageDecoder SHALL expose a readonly completed attribute that resolves when complete becomes true.

#### Scenario: Completed resolves for BufferSource

- **GIVEN** ImageDecoder constructed with BufferSource data
- **WHEN** decoder.completed is awaited
- **THEN** Promise resolves immediately

#### Scenario: Completed resolves when stream finishes

- **GIVEN** ImageDecoder constructed with ReadableStream data
- **WHEN** stream finishes and decoder.completed is awaited
- **THEN** Promise resolves after stream consumption completes

### Requirement: ImageDecoder Tracks Attribute

ImageDecoder SHALL expose a readonly tracks attribute returning a live ImageTrackList describing available tracks.

#### Scenario: Tracks returns ImageTrackList for static image

- **GIVEN** ImageDecoder constructed with static PNG image data
- **WHEN** decoder.tracks is accessed
- **THEN** ImageTrackList with length 1 is returned, selectedIndex 0, selectedTrack.animated false

#### Scenario: Tracks returns ImageTrackList for animated image

- **GIVEN** ImageDecoder constructed with animated GIF with 10 frames
- **WHEN** decoder.tracks is accessed
- **THEN** ImageTrackList with length 1, selectedTrack.animated true, selectedTrack.frameCount 10

### Requirement: ImageDecoder decode Method

ImageDecoder SHALL provide a decode(options) method that returns a Promise resolving to ImageDecodeResult containing a VideoFrame.

#### Scenario: Decode static image frame 0

- **GIVEN** ImageDecoder with static PNG image and decoder not closed
- **WHEN** decoder.decode() is called with no options
- **THEN** Promise resolves with ImageDecodeResult where image is VideoFrame and complete is true

#### Scenario: Decode specific frame from animated image

- **GIVEN** ImageDecoder with animated GIF containing 5 frames
- **WHEN** decoder.decode({ frameIndex: 3 }) is called
- **THEN** Promise resolves with ImageDecodeResult where image is VideoFrame for frame 3, complete is true

#### Scenario: Reject decode when closed

- **GIVEN** ImageDecoder that has been closed
- **WHEN** decoder.decode() is called
- **THEN** Promise is rejected with InvalidStateError DOMException

#### Scenario: Reject invalid frameIndex

- **GIVEN** ImageDecoder with 3-frame animated image
- **WHEN** decoder.decode({ frameIndex: 10 }) is called
- **THEN** Promise is rejected with RangeError

### Requirement: ImageDecoder reset Method

ImageDecoder SHALL provide a reset() method that immediately aborts all pending decode operations.

#### Scenario: Reset aborts pending decodes

- **GIVEN** ImageDecoder with pending decode operations
- **WHEN** decoder.reset() is called
- **THEN** All pending decode promises are rejected with AbortError DOMException

### Requirement: ImageDecoder close Method

ImageDecoder SHALL provide a close() method that releases system resources and prevents further operations.

#### Scenario: Close releases resources

- **GIVEN** Open ImageDecoder
- **WHEN** decoder.close() is called
- **THEN** Subsequent decode() calls throw InvalidStateError

#### Scenario: Close is idempotent

- **GIVEN** ImageDecoder that has been closed
- **WHEN** decoder.close() is called again
- **THEN** No error is thrown

### Requirement: ImageDecoder isTypeSupported Static Method

ImageDecoder SHALL provide a static isTypeSupported(type) method returning Promise<boolean> indicating codec support.

#### Scenario: isTypeSupported returns true for PNG

- **GIVEN** type "image/png"
- **WHEN** ImageDecoder.isTypeSupported("image/png") is called
- **THEN** Promise resolves to true

#### Scenario: isTypeSupported returns true for supported animated formats

- **GIVEN** type "image/gif" or "image/webp"
- **WHEN** ImageDecoder.isTypeSupported(type) is called
- **THEN** Promise resolves to true

#### Scenario: isTypeSupported returns false for unsupported type

- **GIVEN** type "image/svg+xml"
- **WHEN** ImageDecoder.isTypeSupported("image/svg+xml") is called
- **THEN** Promise resolves to false

#### Scenario: isTypeSupported rejects invalid MIME type

- **GIVEN** type "not-a-mime-type"
- **WHEN** ImageDecoder.isTypeSupported("not-a-mime-type") is called
- **THEN** Promise is rejected with TypeError

### Requirement: ImageDecoderInit Dictionary Validation

The system SHALL validate ImageDecoderInit per W3C spec Section 10.3 before constructing ImageDecoder.

#### Scenario: Validate type is required

- **GIVEN** ImageDecoderInit without type property
- **WHEN** new ImageDecoder(init) is called
- **THEN** TypeError is thrown

#### Scenario: Validate data is required

- **GIVEN** ImageDecoderInit with type but no data property
- **WHEN** new ImageDecoder(init) is called
- **THEN** TypeError is thrown

#### Scenario: Validate desiredWidth requires desiredHeight

- **GIVEN** ImageDecoderInit with desiredWidth: 100 but no desiredHeight
- **WHEN** new ImageDecoder(init) is called
- **THEN** TypeError is thrown

#### Scenario: Validate desiredHeight requires desiredWidth

- **GIVEN** ImageDecoderInit with desiredHeight: 100 but no desiredWidth
- **WHEN** new ImageDecoder(init) is called
- **THEN** TypeError is thrown

### Requirement: ImageDecodeResult Structure

ImageDecodeResult SHALL contain an image property (VideoFrame) and complete property (boolean).

#### Scenario: ImageDecodeResult contains VideoFrame

- **GIVEN** successful decode() call
- **WHEN** result is examined
- **THEN** result.image is a VideoFrame with codedWidth, codedHeight, timestamp properties

#### Scenario: ImageDecodeResult complete indicates full detail

- **GIVEN** decode() called with completeFramesOnly: true (default)
- **WHEN** result is examined
- **THEN** result.complete is true

### Requirement: ImageTrackList Interface

ImageTrackList SHALL provide ready, length, selectedIndex, selectedTrack attributes and index getter for track access.

#### Scenario: ImageTrackList ready resolves when tracks established

- **GIVEN** ImageDecoder constructed with BufferSource data
- **WHEN** decoder.tracks.ready is awaited
- **THEN** Promise resolves after tracks are parsed

#### Scenario: ImageTrackList length returns track count

- **GIVEN** ImageDecoder with single-track image
- **WHEN** decoder.tracks.length is accessed
- **THEN** 1 is returned

#### Scenario: ImageTrackList index getter returns ImageTrack

- **GIVEN** ImageDecoder with tracks established
- **WHEN** decoder.tracks[0] is accessed
- **THEN** ImageTrack object is returned

#### Scenario: ImageTrackList selectedIndex returns selected track index

- **GIVEN** ImageDecoder with default track selection
- **WHEN** decoder.tracks.selectedIndex is accessed
- **THEN** 0 is returned (first track selected by default)

#### Scenario: ImageTrackList selectedTrack returns selected ImageTrack

- **GIVEN** ImageDecoder with track at index 0 selected
- **WHEN** decoder.tracks.selectedTrack is accessed
- **THEN** Same ImageTrack as decoder.tracks[0] is returned

### Requirement: ImageTrack Interface

ImageTrack SHALL expose animated, frameCount, repetitionCount readonly attributes and selected read/write attribute.

#### Scenario: ImageTrack animated indicates animation

- **GIVEN** ImageTrack for static PNG
- **WHEN** track.animated is accessed
- **THEN** false is returned

#### Scenario: ImageTrack animated true for GIF

- **GIVEN** ImageTrack for animated GIF with multiple frames
- **WHEN** track.animated is accessed
- **THEN** true is returned

#### Scenario: ImageTrack frameCount returns number of frames

- **GIVEN** ImageTrack for GIF with 10 frames
- **WHEN** track.frameCount is accessed
- **THEN** 10 is returned

#### Scenario: ImageTrack repetitionCount returns loop count

- **GIVEN** ImageTrack for GIF with infinite loop
- **WHEN** track.repetitionCount is accessed
- **THEN** Infinity is returned

#### Scenario: ImageTrack selected setter changes selection

- **GIVEN** ImageTrack that is not selected
- **WHEN** track.selected = true is set
- **THEN** track becomes selected and previous selection is deselected

#### Scenario: ImageTrack selected setter no-op when decoder closed

- **GIVEN** ImageTrack belonging to closed ImageDecoder
- **WHEN** track.selected = true is set
- **THEN** No change occurs and no error is thrown
