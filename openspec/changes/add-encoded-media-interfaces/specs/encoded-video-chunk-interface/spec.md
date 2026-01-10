# Encoded Video Chunk Interface

W3C WebCodecs spec section 8.2 - EncodedVideoChunk Interface

## ADDED Requirements

### Requirement: EncodedVideoChunk Internal Slots

The EncodedVideoChunk class SHALL maintain the following internal slots:
- **[[internal data]]**: An array of bytes representing the encoded chunk data
- **[[type]]**: The EncodedVideoChunkType of this chunk
- **[[timestamp]]**: The presentation timestamp in microseconds (long long)
- **[[duration]]**: The presentation duration in microseconds (unsigned long long, nullable)
- **[[byte length]]**: The byte length of [[internal data]] (unsigned long)

#### Scenario: Internal slots initialized from constructor
- **WHEN** an EncodedVideoChunk is constructed with valid init
- **THEN** all internal slots SHALL be populated from the init dictionary

#### Scenario: Duration slot is nullable
- **WHEN** an EncodedVideoChunk is constructed without duration in init
- **THEN** [[duration]] SHALL be null

---

### Requirement: EncodedVideoChunk Constructor

The EncodedVideoChunk constructor SHALL accept an EncodedVideoChunkInit dictionary and:
1. If init.transfer contains more than one reference to the same ArrayBuffer, throw DataCloneError DOMException
2. For each transferable in init.transfer: if [[Detached]] is true, throw DataCloneError DOMException
3. Create the chunk object with slots from init (type, timestamp, duration, data)
4. If init.transfer contains an ArrayBuffer referenced by init.data, the implementation MAY use a reference
5. Otherwise, assign a copy of init.data to [[internal data]]
6. For each transferable in init.transfer: perform DetachArrayBuffer

#### Scenario: Construct with valid init
- **WHEN** constructor is called with valid EncodedVideoChunkInit
- **THEN** an EncodedVideoChunk instance SHALL be returned with correct attribute values

#### Scenario: Construct with ArrayBuffer data
- **WHEN** constructor is called with data as ArrayBuffer
- **THEN** the chunk SHALL copy or reference the data correctly

#### Scenario: Construct with ArrayBufferView data
- **WHEN** constructor is called with data as Uint8Array or other ArrayBufferView
- **THEN** the chunk SHALL copy the data correctly respecting byteOffset and byteLength

#### Scenario: Throw on duplicate ArrayBuffer in transfer
- **WHEN** init.transfer contains the same ArrayBuffer twice
- **THEN** constructor SHALL throw DataCloneError DOMException

#### Scenario: Throw on detached ArrayBuffer in transfer
- **WHEN** init.transfer contains an ArrayBuffer that is already detached
- **THEN** constructor SHALL throw DataCloneError DOMException

#### Scenario: Transfer semantics detach source ArrayBuffer
- **WHEN** init.transfer contains an ArrayBuffer referenced by init.data
- **THEN** the source ArrayBuffer SHALL be detached after construction

---

### Requirement: EncodedVideoChunk Type Attribute

The type attribute SHALL return the value of [[type]] slot.
The EncodedVideoChunkType enum values are "key" (I-frames, independently decodable) and "delta" (P/B-frames, dependent on other frames).

#### Scenario: Type is "key" for keyframes
- **WHEN** chunk is constructed with type: "key"
- **THEN** type attribute SHALL return "key"

#### Scenario: Type is "delta" for delta frames
- **WHEN** chunk is constructed with type: "delta"
- **THEN** type attribute SHALL return "delta"

#### Scenario: Type attribute is readonly
- **WHEN** attempting to assign to type attribute
- **THEN** assignment SHALL have no effect (attribute remains unchanged)

---

### Requirement: EncodedVideoChunk Timestamp Attribute

The timestamp attribute SHALL return the value of [[timestamp]] slot in microseconds.
Timestamps are signed 64-bit integers (long long) and MAY be negative.

#### Scenario: Timestamp preserves value
- **WHEN** chunk is constructed with timestamp: 1000000
- **THEN** timestamp attribute SHALL return 1000000

#### Scenario: Timestamp supports negative values
- **WHEN** chunk is constructed with timestamp: -5000
- **THEN** timestamp attribute SHALL return -5000

#### Scenario: Timestamp supports large values
- **WHEN** chunk is constructed with timestamp: 12345678901
- **THEN** timestamp attribute SHALL return 12345678901

---

### Requirement: EncodedVideoChunk Duration Attribute

The duration attribute SHALL return the value of [[duration]] slot in microseconds.
Duration is an unsigned 64-bit integer that is nullable (returns null when not provided).

#### Scenario: Duration returns value when provided
- **WHEN** chunk is constructed with duration: 33333
- **THEN** duration attribute SHALL return 33333

#### Scenario: Duration returns null when not provided
- **WHEN** chunk is constructed without duration
- **THEN** duration attribute SHALL return null

---

### Requirement: EncodedVideoChunk ByteLength Attribute

The byteLength attribute SHALL return the value of [[byte length]] slot.

#### Scenario: ByteLength matches data size
- **WHEN** chunk is constructed with 8-byte data
- **THEN** byteLength attribute SHALL return 8

#### Scenario: ByteLength is zero for empty data
- **WHEN** chunk is constructed with 0-byte data
- **THEN** byteLength attribute SHALL return 0

#### Scenario: ByteLength supports large video frames
- **WHEN** chunk is constructed with 2MB data (typical 4K keyframe)
- **THEN** byteLength attribute SHALL return 2097152

---

### Requirement: EncodedVideoChunk copyTo Method

The copyTo(destination) method SHALL:
1. If [[byte length]] is greater than destination byte length, throw TypeError
2. Copy [[internal data]] into destination

#### Scenario: Copy data to ArrayBuffer
- **WHEN** copyTo is called with ArrayBuffer destination of sufficient size
- **THEN** data SHALL be copied to destination

#### Scenario: Copy data to ArrayBufferView
- **WHEN** copyTo is called with Uint8Array destination of sufficient size
- **THEN** data SHALL be copied to destination

#### Scenario: Copy to larger destination succeeds
- **WHEN** copyTo is called with destination larger than byteLength
- **THEN** data SHALL be copied to beginning of destination

#### Scenario: Throw TypeError when destination too small
- **WHEN** copyTo is called with destination smaller than byteLength
- **THEN** copyTo SHALL throw TypeError

---

### Requirement: EncodedVideoChunk Serialization

EncodedVideoChunk SHALL be Serializable with the following constraints:
- If forStorage is true, throw DataCloneError
- Serialize all internal slots by value
- Deserialize by restoring all internal slots

#### Scenario: Serialization for transfer succeeds
- **WHEN** chunk is serialized with forStorage=false
- **THEN** serialization SHALL succeed and all slots SHALL be preserved

#### Scenario: Serialization for storage fails
- **WHEN** chunk is serialized with forStorage=true
- **THEN** DataCloneError SHALL be thrown

---

### Requirement: EncodedVideoChunkInit Dictionary

The EncodedVideoChunkInit dictionary SHALL have the following members:
- **type** (required): EncodedVideoChunkType
- **timestamp** (required): long long in microseconds, with [EnforceRange]
- **duration** (optional): unsigned long long in microseconds, with [EnforceRange]
- **data** (required): AllowSharedBufferSource
- **transfer** (optional): sequence<ArrayBuffer>, default []

#### Scenario: Init with required fields only
- **WHEN** init contains only type, timestamp, and data
- **THEN** chunk SHALL be constructed successfully

#### Scenario: Init with all fields
- **WHEN** init contains type, timestamp, duration, data, and transfer
- **THEN** chunk SHALL be constructed successfully with all values

---

### Requirement: EncodedVideoChunkType Enum

The EncodedVideoChunkType enum SHALL have exactly two values:
- "key": Indicates an I-frame that can be decoded independently
- "delta": Indicates a P-frame or B-frame that depends on previous frames

#### Scenario: Only valid enum values accepted
- **WHEN** constructor is called with type not "key" or "delta"
- **THEN** constructor SHALL throw TypeError

---

### Requirement: GOP Structure Support

EncodedVideoChunk SHALL support typical Group of Pictures (GOP) patterns where:
- Key frames (type: "key") are placed periodically (e.g., every 30 frames)
- Delta frames (type: "delta") reference previous frames for decoding

#### Scenario: Key frame followed by delta frames
- **WHEN** encoder produces a GOP (key, delta, delta, ...)
- **THEN** all chunks SHALL have correct type attribute matching frame type

#### Scenario: Key frames are independently decodable
- **WHEN** decoder receives a key frame
- **THEN** decoder SHALL be able to decode without prior frame context
