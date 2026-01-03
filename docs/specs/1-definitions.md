# 1. Definitions

**Codec**
: Refers generically to an instance of [`AudioDecoder`](#audiodecoder), [`AudioEncoder`](#audioencoder), [`VideoDecoder`](#videodecoder), or [`VideoEncoder`](#videoencoder).

**Key Chunk**
: An encoded chunk that does not depend on any other frames for decoding. Also commonly referred to as a "key frame".

**Internal Pending Output**
: Codec outputs such as [`VideoFrame`](#videoframe)s that currently reside in the internal pipeline of the underlying codec implementation. The underlying codec implementation _MAY_ emit new outputs only when new inputs are provided. The underlying codec implementation _MUST_ emit all outputs in response to a flush.

**Codec System Resources**
: Resources including CPU memory, GPU memory, and exclusive handles to specific decoding/encoding hardware that _MAY_ be allocated by the User Agent as part of codec configuration or generation of [`AudioData`](#audiodata) and [`VideoFrame`](#videoframe) objects. Such resources _MAY_ be quickly exhausted and _SHOULD_ be released immediately when no longer in use.

**Temporal Layer**
: A grouping of [`EncodedVideoChunk`](#encodedvideochunk)s whose timestamp cadence produces a particular framerate. See [`scalabilityMode`](#dom-videoencoderconfig-scalabilitymode).

**Progressive Image**
: An image that supports decoding to multiple levels of detail, with lower levels becoming available while the encoded data is not yet fully buffered.

**Progressive Image Frame Generation**
: A generational identifier for a given [Progressive Image](#progressive-image) decoded output. Each successive generation adds additional detail to the decoded output. The mechanism for computing a frame’s generation is implementer defined.

**Primary Image Track**
: An image track that is marked by the given image file as being the default track. The mechanism for indicating a primary track is format defined.

**RGB Format**
: A [`VideoPixelFormat`](#enumdef-videopixelformat) containing red, green, and blue color channels in any order or layout (interleaved or planar), and irrespective of whether an alpha channel is present.

**sRGB Color Space**
: A [`VideoColorSpace`](#videocolorspace) object, initialized as follows:

1.  [`[[primaries]]`](#dom-videocolorspace-primaries-slot) is set to [`bt709`](#dom-videocolorprimaries-bt709),
    
2.  [`[[transfer]]`](#dom-videocolorspace-transfer-slot) is set to [`iec61966-2-1`](#dom-videotransfercharacteristics-iec61966-2-1),
    
3.  [`[[matrix]]`](#dom-videocolorspace-matrix-slot) is set to [`rgb`](#dom-videomatrixcoefficients-rgb),
    
4.  [`[[full range]]`](#dom-videocolorspace-full-range-slot) is set to `true`

**Display P3 Color Space**
: A [`VideoColorSpace`](#videocolorspace) object, initialized as follows:

1.  [`[[primaries]]`](#dom-videocolorspace-primaries-slot) is set to [`smpte432`](#dom-videocolorprimaries-smpte432),
    
2.  [`[[transfer]]`](#dom-videocolorspace-transfer-slot) is set to [`iec61966-2-1`](#dom-videotransfercharacteristics-iec61966-2-1),
    
3.  [`[[matrix]]`](#dom-videocolorspace-matrix-slot) is set to [`rgb`](#dom-videomatrixcoefficients-rgb),
    
4.  [`[[full range]]`](#dom-videocolorspace-full-range-slot) is set to `true`

**REC709 Color Space**
: A [`VideoColorSpace`](#videocolorspace) object, initialized as follows:

1.  [`[[primaries]]`](#dom-videocolorspace-primaries-slot) is set to [`bt709`](#dom-videocolorprimaries-bt709),
    
2.  [`[[transfer]]`](#dom-videocolorspace-transfer-slot) is set to [`bt709`](#dom-videotransfercharacteristics-bt709),
    
3.  [`[[matrix]]`](#dom-videocolorspace-matrix-slot) is set to [`bt709`](#dom-videomatrixcoefficients-bt709),
    
4.  [`[[full range]]`](#dom-videocolorspace-full-range-slot) is set to `false`

**Codec Saturation**
: The state of an underlying codec implementation where the number of active decoding or encoding requests has reached an implementation specific maximum such that it is temporarily unable to accept more work. The maximum may be any value greater than 1, including infinity (no maximum). While saturated, additional calls to `decode()` or `encode()` will be buffered in the [control message queue](#control-message-queue), and will increment the respective `decodeQueueSize` and `encodeQueueSize` attributes. The codec implementation will become unsaturated after making sufficient progress on the current workload.

---

[← Back to Table of Contents](../TOC.md)
