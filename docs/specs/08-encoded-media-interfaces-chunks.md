---
title: '8. Encoded Media Interfaces (Chunks)'
---

> Section 8 from [W3C WebCodecs Specification](https://www.w3.org/TR/webcodecs/)

## [8. Encoded Media Interfaces (Chunks)](https://www.w3.org/TR/webcodecs/#encoded-media-interfaces)

### [8.1. EncodedAudioChunk Interface](https://www.w3.org/TR/webcodecs/#encodedaudiochunk-interface)

```webidl
[Exposed=(Window,DedicatedWorker), Serializable]
interface EncodedAudioChunk {
  constructor(EncodedAudioChunkInit init);
  readonly attribute EncodedAudioChunkType type;
  readonly attribute long long timestamp;          // microseconds
  readonly attribute unsigned long long? duration; // microseconds
  readonly attribute unsigned long byteLength;

  undefined copyTo(AllowSharedBufferSource destination);
};

dictionary EncodedAudioChunkInit {
  required EncodedAudioChunkType type;
  [EnforceRange] required long long timestamp;    // microseconds
  [EnforceRange] unsigned long long duration;     // microseconds
  required AllowSharedBufferSource data;
  sequence<ArrayBuffer> transfer = [];
};

enum EncodedAudioChunkType {
    "key",
    "delta",
};
```

#### [8.1.1. Internal Slots](https://www.w3.org/TR/webcodecs/#encodedaudiochunk-internal-slots)

**`[[internal data]]`**

An array of bytes representing the encoded chunk data.
**`[[type]]`**

Describes whether the chunk is a [key chunk](https://www.w3.org/TR/webcodecs/#key-chunk).
**`[[timestamp]]`**

The presentation timestamp, given in microseconds.
**`[[duration]]`**

The presentation duration, given in microseconds.
**`[[byte length]]`**

The byte length of [[[internal data]]](https://www.w3.org/TR/webcodecs/#dom-encodedaudiochunk-internal-data-slot).

#### [8.1.2. Constructors](https://www.w3.org/TR/webcodecs/#encodedaudiochunk-constructors)

`EncodedAudioChunk(init)`

1.  If init.[transfer](https://www.w3.org/TR/webcodecs/#dom-encodedaudiochunkinit-transfer) contains more than one reference to the same [ArrayBuffer](https://webidl.spec.whatwg.org/#idl-ArrayBuffer), then throw a [DataCloneError](https://webidl.spec.whatwg.org/#datacloneerror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).
2.  For each transferable in init.[transfer](https://www.w3.org/TR/webcodecs/#dom-encodedaudiochunkinit-transfer):
    1.  If [[[Detached]]](https://html.spec.whatwg.org/multipage/structured-data.html#detached) internal slot is `true`, then throw a [DataCloneError](https://webidl.spec.whatwg.org/#datacloneerror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).

3.  Let chunk be a new [EncodedAudioChunk](https://www.w3.org/TR/webcodecs/#encodedaudiochunk) object, initialized as follows
    1.  Assign `init.type` to [[[type]]](https://www.w3.org/TR/webcodecs/#dom-encodedaudiochunk-type-slot).
    2.  Assign `init.timestamp` to [[[timestamp]]](https://www.w3.org/TR/webcodecs/#dom-encodedaudiochunk-timestamp-slot).
    3.  If `init.duration` exists, assign it to [[[duration]]](https://www.w3.org/TR/webcodecs/#dom-encodedaudiochunk-duration-slot), or assign `null` otherwise.
    4.  Assign `init.data.byteLength` to [[[byte length]]](https://www.w3.org/TR/webcodecs/#dom-encodedaudiochunk-byte-length-slot);
    5.  If init.[transfer](https://www.w3.org/TR/webcodecs/#dom-encodedaudiochunkinit-transfer) contains an [ArrayBuffer](https://webidl.spec.whatwg.org/#idl-ArrayBuffer) referenced by init.[data](https://www.w3.org/TR/webcodecs/#dom-encodedaudiochunkinit-data) the User Agent _MAY_ choose to:
        1.  Let resource be a new [media resource](https://www.w3.org/TR/webcodecs/#media-resource) referencing sample data in init.[data](https://www.w3.org/TR/webcodecs/#dom-encodedaudiochunkinit-data).

    6.  Otherwise:
        1.  Assign a copy of init.[data](https://www.w3.org/TR/webcodecs/#dom-encodedaudiochunkinit-data) to [[[internal data]]](https://www.w3.org/TR/webcodecs/#dom-encodedaudiochunk-internal-data-slot).

4.  For each transferable in init.[transfer](https://www.w3.org/TR/webcodecs/#dom-encodedaudiochunkinit-transfer):
    1.  Perform [DetachArrayBuffer](https://tc39.es/ecma262/#sec-detacharraybuffer) on transferable

5.  Return chunk.

#### [8.1.3. Attributes](https://www.w3.org/TR/webcodecs/#encodedaudiochunk-attributes)

**`type`, of type [EncodedAudioChunkType](https://www.w3.org/TR/webcodecs/#enumdef-encodedaudiochunktype), readonly**

Returns the value of [[[type]]](https://www.w3.org/TR/webcodecs/#dom-encodedaudiochunk-type-slot).
**`timestamp`, of type [long long](https://webidl.spec.whatwg.org/#idl-long-long), readonly**

Returns the value of [[[timestamp]]](https://www.w3.org/TR/webcodecs/#dom-encodedaudiochunk-timestamp-slot).
**`duration`, of type [unsigned long long](https://webidl.spec.whatwg.org/#idl-unsigned-long-long), readonly, nullable**

Returns the value of [[[duration]]](https://www.w3.org/TR/webcodecs/#dom-encodedaudiochunk-duration-slot).
**`byteLength`, of type [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long), readonly**

Returns the value of [[[byte length]]](https://www.w3.org/TR/webcodecs/#dom-encodedaudiochunk-byte-length-slot).

#### [8.1.4. Methods](https://www.w3.org/TR/webcodecs/#encodedaudiochunk-methods)

**`copyTo(destination)`**

When invoked, run these steps:

1.  If the [[[byte length]]](https://www.w3.org/TR/webcodecs/#dom-encodedaudiochunk-byte-length-slot) of this [EncodedAudioChunk](https://www.w3.org/TR/webcodecs/#encodedaudiochunk) is greater than in destination, throw a [TypeError](https://webidl.spec.whatwg.org/#exceptiondef-typeerror).
2.  Copy the [[[internal data]]](https://www.w3.org/TR/webcodecs/#dom-encodedaudiochunk-internal-data-slot) into destination.

#### [8.1.5. Serialization](https://www.w3.org/TR/webcodecs/#encodedaudiochunk-serialization)

**The [EncodedAudioChunk](https://www.w3.org/TR/webcodecs/#encodedaudiochunk) [serialization steps](https://html.spec.whatwg.org/multipage/structured-data.html#serialization-steps) (with value, serialized, and forStorage) are:**

1.  If forStorage is `true`, throw a [DataCloneError](https://webidl.spec.whatwg.org/#datacloneerror).
2.  For each [EncodedAudioChunk](https://www.w3.org/TR/webcodecs/#encodedaudiochunk) internal slot in value, assign the value of each internal slot to a field in serialized with the same name as the internal slot.
    **The [EncodedAudioChunk](https://www.w3.org/TR/webcodecs/#encodedaudiochunk) [deserialization steps](https://html.spec.whatwg.org/multipage/structured-data.html#deserialization-steps) (with serialized and value) are:**

3.  For all named fields in serialized, assign the value of each named field to the [EncodedAudioChunk](https://www.w3.org/TR/webcodecs/#encodedaudiochunk) internal slot in value with the same name as the named field.

NOTE: Since [EncodedAudioChunk](https://www.w3.org/TR/webcodecs/#encodedaudiochunk)s are immutable, User Agents can choose to implement serialization using a reference counting model similar to [§ 9.2.6 Transfer and Serialization](https://www.w3.org/TR/webcodecs/#audiodata-transfer-serialization).

### [8.2. EncodedVideoChunk Interface](https://www.w3.org/TR/webcodecs/#encodedvideochunk-interface)

```webidl
[Exposed=(Window,DedicatedWorker), Serializable]
interface EncodedVideoChunk {
  constructor(EncodedVideoChunkInit init);
  readonly attribute EncodedVideoChunkType type;
  readonly attribute long long timestamp;             // microseconds
  readonly attribute unsigned long long? duration;    // microseconds
  readonly attribute unsigned long byteLength;

  undefined copyTo(AllowSharedBufferSource destination);
};

dictionary EncodedVideoChunkInit {
  required EncodedVideoChunkType type;
  [EnforceRange] required long long timestamp;        // microseconds
  [EnforceRange] unsigned long long duration;         // microseconds
  required AllowSharedBufferSource data;
  sequence<ArrayBuffer> transfer = [];
};

enum EncodedVideoChunkType {
    "key",
    "delta",
};
```

#### [8.2.1. Internal Slots](https://www.w3.org/TR/webcodecs/#encodedvideochunk-internal-slots)

**`[[internal data]]`**

An array of bytes representing the encoded chunk data.
**`[[type]]`**

The [EncodedVideoChunkType](https://www.w3.org/TR/webcodecs/#enumdef-encodedvideochunktype) of this [EncodedVideoChunk](https://www.w3.org/TR/webcodecs/#encodedvideochunk);
**`[[timestamp]]`**

The presentation timestamp, given in microseconds.
**`[[duration]]`**

The presentation duration, given in microseconds.
**`[[byte length]]`**

The byte length of [[[internal data]]](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunk-internal-data-slot).

#### [8.2.2. Constructors](https://www.w3.org/TR/webcodecs/#encodedvideochunk-constructors)

`EncodedVideoChunk(init)`

1.  If init.[transfer](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunkinit-transfer) contains more than one reference to the same [ArrayBuffer](https://webidl.spec.whatwg.org/#idl-ArrayBuffer), then throw a [DataCloneError](https://webidl.spec.whatwg.org/#datacloneerror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).
2.  For each transferable in init.[transfer](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunkinit-transfer):
    1.  If [[[Detached]]](https://html.spec.whatwg.org/multipage/structured-data.html#detached) internal slot is `true`, then throw a [DataCloneError](https://webidl.spec.whatwg.org/#datacloneerror) [DOMException](https://webidl.spec.whatwg.org/#idl-DOMException).

3.  Let chunk be a new [EncodedVideoChunk](https://www.w3.org/TR/webcodecs/#encodedvideochunk) object, initialized as follows
    1.  Assign `init.type` to [[[type]]](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunk-type-slot).
    2.  Assign `init.timestamp` to [[[timestamp]]](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunk-timestamp-slot).
    3.  If duration is present in init, assign `init.duration` to [[[duration]]](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunk-duration-slot). Otherwise, assign `null` to [[[duration]]](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunk-duration-slot).
    4.  Assign `init.data.byteLength` to [[[byte length]]](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunk-byte-length-slot);
    5.  If init.[transfer](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunkinit-transfer) contains an [ArrayBuffer](https://webidl.spec.whatwg.org/#idl-ArrayBuffer) referenced by init.[data](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunkinit-data) the User Agent _MAY_ choose to:
        1.  Let resource be a new [media resource](https://www.w3.org/TR/webcodecs/#media-resource) referencing sample data in init.[data](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunkinit-data).

    6.  Otherwise:
        1.  Assign a copy of init.[data](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunkinit-data) to [[[internal data]]](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunk-internal-data-slot).

4.  For each transferable in init.[transfer](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunkinit-transfer):
    1.  Perform [DetachArrayBuffer](https://tc39.es/ecma262/#sec-detacharraybuffer) on transferable

5.  Return chunk.

#### [8.2.3. Attributes](https://www.w3.org/TR/webcodecs/#encodedvideochunk-attributes)

**`type`, of type [EncodedVideoChunkType](https://www.w3.org/TR/webcodecs/#enumdef-encodedvideochunktype), readonly**

Returns the value of [[[type]]](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunk-type-slot).
**`timestamp`, of type [long long](https://webidl.spec.whatwg.org/#idl-long-long), readonly**

Returns the value of [[[timestamp]]](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunk-timestamp-slot).
**`duration`, of type [unsigned long long](https://webidl.spec.whatwg.org/#idl-unsigned-long-long), readonly, nullable**

Returns the value of [[[duration]]](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunk-duration-slot).
**`byteLength`, of type [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long), readonly**

Returns the value of [[[byte length]]](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunk-byte-length-slot).

#### [8.2.4. Methods](https://www.w3.org/TR/webcodecs/#encodedvideochunk-methods)

**`copyTo(destination)`**

When invoked, run these steps:

1.  If [[[byte length]]](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunk-byte-length-slot) is greater than the [[[byte length]]](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunk-byte-length-slot) of destination, throw a [TypeError](https://webidl.spec.whatwg.org/#exceptiondef-typeerror).
2.  Copy the [[[internal data]]](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunk-internal-data-slot) into destination.

#### [8.2.5. Serialization](https://www.w3.org/TR/webcodecs/#encodedvideochunk-serialization)

**The [EncodedVideoChunk](https://www.w3.org/TR/webcodecs/#encodedvideochunk) [serialization steps](https://html.spec.whatwg.org/multipage/structured-data.html#serialization-steps) (with value, serialized, and forStorage) are:**

1.  If forStorage is `true`, throw a [DataCloneError](https://webidl.spec.whatwg.org/#datacloneerror).
2.  For each [EncodedVideoChunk](https://www.w3.org/TR/webcodecs/#encodedvideochunk) internal slot in value, assign the value of each internal slot to a field in serialized with the same name as the internal slot.
    **The [EncodedVideoChunk](https://www.w3.org/TR/webcodecs/#encodedvideochunk) [deserialization steps](https://html.spec.whatwg.org/multipage/structured-data.html#deserialization-steps) (with serialized and value) are:**

3.  For all named fields in serialized, assign the value of each named field to the [EncodedVideoChunk](https://www.w3.org/TR/webcodecs/#encodedvideochunk) internal slot in value with the same name as the named field.

NOTE: Since [EncodedVideoChunk](https://www.w3.org/TR/webcodecs/#encodedvideochunk)s are immutable, User Agents can choose to implement serialization using a reference counting model similar to [§ 9.4.7 Transfer and Serialization](https://www.w3.org/TR/webcodecs/#videoframe-transfer-serialization).
