---
title: 'AVC (H.264)'
---

> From [AVC (H.264) Registration](https://www.w3.org/TR/webcodecs-avc-codec-registration/)

## Abstract

This registration is entered into the [\[webcodecs-codec-registry\]](https://www.w3.org/TR/webcodecs-avc-codec-registration/#biblio-webcodecs-codec-registry). It describes, for AVC (H.264), the (1) fully qualified [codec strings](https://www.w3.org/TR/webcodecs/#config-codec-string), (2) the codec-specific [EncodedVideoChunk](https://www.w3.org/TR/webcodecs/#encodedvideochunk) [[[internal data]]](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunk-internal-data-slot) bytes, (3) the [VideoDecoderConfig.description](https://www.w3.org/TR/webcodecs/#dom-videodecoderconfig-description) bytes, (4) the values of [EncodedVideoChunk](https://www.w3.org/TR/webcodecs/#encodedvideochunk) [[[type]]](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunk-type-slot), (5) the codec-specific extensions to [VideoEncoderConfig](https://www.w3.org/TR/webcodecs/#dictdef-videoencoderconfig), and (6) the codec-specific extensions to [VideoEncoderEncodeOptions](https://www.w3.org/TR/webcodecs/#dictdef-videoencoderencodeoptions).

The registration is not intended to include any information on whether a codec format is encumbered by intellectual property claims. Implementers and authors are advised to seek appropriate legal counsel in this matter if they intend to implement or use a specific codec format. Implementers of WebCodecs are not required to support the AVC / H.264 codec.

This registration is non-normative.

## Status of this document

_This section describes the status of this document at the time of its publication. A list of current W3C publications and the latest revision of this technical report can be found in the [W3C standards and drafts index](https://www.w3.org/TR/) at https://www.w3.org/TR/._

Feedback and comments on this specification are welcome. [GitHub Issues](https://github.com/w3c/webcodecs/issues) are preferred for discussion on this specification. Alternatively, you can send comments to the Media Working Group’s mailing-list, [public-media-wg@w3.org](mailto:public-media-wg@w3.org) ([archives](https://lists.w3.org/Archives/Public/public-media-wg/)). This draft highlights some of the pending issues that are still to be discussed in the working group. No decision has been taken on the outcome of these issues including whether they are valid.

This document was published by the [Media Working Group](https://www.w3.org/groups/wg/media/) as a Group Draft Note using the [Note track](https://www.w3.org/policies/process/20231103/#recs-and-notes).

Group Draft Notes are not endorsed by W3C nor its Members.

This is a draft document and may be updated, replaced or obsoleted by other documents at any time. It is inappropriate to cite this document as other than work in progress.

The [W3C Patent Policy](https://www.w3.org/policies/patent-policy/) does not carry any licensing requirements or commitments on this document.

This document is governed by the [03 November 2023 W3C Process Document](https://www.w3.org/policies/process/20231103/).

## [1. Fully qualified codec strings](https://www.w3.org/TR/webcodecs-avc-codec-registration/#fully-qualified-codec-strings)

The [codec string](https://www.w3.org/TR/webcodecs/#config-codec-string) begins with the prefix "avc1." or "avc3.", with a suffix of 6 characters as described respectively in Section 3.4 of [\[rfc6381\]](https://www.w3.org/TR/webcodecs-avc-codec-registration/#biblio-rfc6381) and Section 5.4.1 of [\[iso14496-15\]](https://www.w3.org/TR/webcodecs-avc-codec-registration/#biblio-iso14496-15).

## [2. EncodedVideoChunk data](https://www.w3.org/TR/webcodecs-avc-codec-registration/#encodedvideochunk-data)

[EncodedVideoChunk](https://www.w3.org/TR/webcodecs/#encodedvideochunk) [[[internal data]]](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunk-internal-data-slot) is expected to be an access unit as defined in [\[ITU-T-REC-H.264\]](https://www.w3.org/TR/webcodecs-avc-codec-registration/#biblio-itu-t-rec-h264) section 7.4.1.2.

NOTE: An access unit contains exactly one primary coded picture.

If the bitstream is in [avc](https://www.w3.org/TR/webcodecs-avc-codec-registration/#dom-avcbitstreamformat-avc) format, [[[internal data]]](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunk-internal-data-slot) is assumed to be in canonical format, as defined in [\[iso14496-15\]](https://www.w3.org/TR/webcodecs-avc-codec-registration/#biblio-iso14496-15) section 5.3.2.

If the bitstream is in [annexb](https://www.w3.org/TR/webcodecs-avc-codec-registration/#dom-avcbitstreamformat-annexb) format, [[[internal data]]](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunk-internal-data-slot) is assumed to be in in Annex B format, as defined in [\[ITU-T-REC-H.264\]](https://www.w3.org/TR/webcodecs-avc-codec-registration/#biblio-itu-t-rec-h264) Annex B.

NOTE: Since [[[internal data]]](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunk-internal-data-slot) is inherently byte-aligned, implementations are not required to recover byte-alignment.

## [3. VideoDecoderConfig description](https://www.w3.org/TR/webcodecs-avc-codec-registration/#videodecoderconfig-description)

If the [description](https://www.w3.org/TR/webcodecs/#dom-videodecoderconfig-description) is present, it is assumed to be an `AVCDecoderConfigurationRecord`, as defined by [\[iso14496-15\]](https://www.w3.org/TR/webcodecs-avc-codec-registration/#biblio-iso14496-15), section 5.3.3.1, and the bitstream is assumed to be in [avc](https://www.w3.org/TR/webcodecs-avc-codec-registration/#dom-avcbitstreamformat-avc) format.

NOTE: This format is commonly used in .MP4 files, where the player generally has random access to the media data.

If the [description](https://www.w3.org/TR/webcodecs/#dom-videodecoderconfig-description) is not present, the bitstream is assumed to be in [annexb](https://www.w3.org/TR/webcodecs-avc-codec-registration/#dom-avcbitstreamformat-annexb) format.

NOTE: "annexb" format is described in greater detail by [\[ITU-T-REC-H.264\]](https://www.w3.org/TR/webcodecs-avc-codec-registration/#biblio-itu-t-rec-h264), Annex B. This format is commonly used in live-streaming applications, where including the SPS and PPS data periodically allows users to easily start from the middle of the stream.

## [4. EncodedVideoChunk type](https://www.w3.org/TR/webcodecs-avc-codec-registration/#encodedvideochunk-type)

If an [EncodedVideoChunk](https://www.w3.org/TR/webcodecs/#encodedvideochunk)’s [[[type]]](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunk-type-slot) is [key](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunktype-key), and the bitstream is in [avc](https://www.w3.org/TR/webcodecs-avc-codec-registration/#dom-avcbitstreamformat-avc) format, then the [EncodedVideoChunk](https://www.w3.org/TR/webcodecs/#encodedvideochunk) is expected to contain a primary coded picture that is an instantaneous decoding refresh (IDR) picture.

NOTE: If the bitstream is in [avc](https://www.w3.org/TR/webcodecs-avc-codec-registration/#dom-avcbitstreamformat-avc) format, parameter sets necessary for decoding are included in [VideoDecoderConfig.description](https://www.w3.org/TR/webcodecs/#dom-videodecoderconfig-description).

If an [EncodedVideoChunk](https://www.w3.org/TR/webcodecs/#encodedvideochunk)’s [[[type]]](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunk-type-slot) is [key](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunktype-key), and the bitstream is in [annexb](https://www.w3.org/TR/webcodecs-avc-codec-registration/#dom-avcbitstreamformat-annexb) format, then the [EncodedVideoChunk](https://www.w3.org/TR/webcodecs/#encodedvideochunk) is expected to contain both a primary coded picture that is an instantaneous decoding refresh (IDR) picture, and all parameter sets necessary to decode all video data NAL units in the [EncodedVideoChunk](https://www.w3.org/TR/webcodecs/#encodedvideochunk).

## [5. VideoEncoderConfig extensions](https://www.w3.org/TR/webcodecs-avc-codec-registration/#videoencoderconfig-extensions)

```webidl
partial dictionary VideoEncoderConfig {
  AvcEncoderConfig avc;
};
```

**`avc`, of type [AvcEncoderConfig](https://www.w3.org/TR/webcodecs-avc-codec-registration/#dictdef-avcencoderconfig)**

Contains codec specific configuration options for the AVC (H.264) codec.

### [5.1. AvcEncoderConfig](https://www.w3.org/TR/webcodecs-avc-codec-registration/#avc-encoder-config)

```webidl
dictionary AvcEncoderConfig {
  AvcBitstreamFormat format = "avc";
};
```

**`format`, of type [AvcBitstreamFormat](https://www.w3.org/TR/webcodecs-avc-codec-registration/#enumdef-avcbitstreamformat), defaulting to `"avc"`**

Configures the format of output [EncodedVideoChunk](https://www.w3.org/TR/webcodecs/#encodedvideochunk)s. See [AvcBitstreamFormat](https://www.w3.org/TR/webcodecs-avc-codec-registration/#enumdef-avcbitstreamformat).

### [5.2. AvcBitstreamFormat](https://www.w3.org/TR/webcodecs-avc-codec-registration/#avc-bitstream-format)

```webidl
enum AvcBitstreamFormat {
  "annexb",
  "avc",
};
```

The [AvcBitstreamFormat](https://www.w3.org/TR/webcodecs-avc-codec-registration/#enumdef-avcbitstreamformat) determines the location of AVC parameter sets, and mechanisms for packaging the bitstream.

**`annexb`**

SPS and PPS data are included periodically throughout the bitstream.

NOTE: This format is described in greater detail by [\[ITU-T-REC-H.264\]](https://www.w3.org/TR/webcodecs-avc-codec-registration/#biblio-itu-t-rec-h264), Annex B. This format is commonly used in live-streaming applications, where including the SPS and PPS data periodically allows users to easily start from the middle of the stream.
**`avc`**

SPS and PPS data are not included in the bitstream and are instead emitted via the [[[output callback]]](https://www.w3.org/TR/webcodecs/#dom-videoencoder-output-callback-slot) as the [VideoDecoderConfig.description](https://www.w3.org/TR/webcodecs/#dom-videodecoderconfig-description) of the [EncodedVideoChunkMetadata.decoderConfig](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunkmetadata-decoderconfig).

NOTE: This format is described in greater detail by [\[iso14496-15\]](https://www.w3.org/TR/webcodecs-avc-codec-registration/#biblio-iso14496-15), section 5.3. This format is commonly used in .MP4 files, where the player generally has random access to the media data.

## [6. VideoEncoderEncodeOptions extensions](https://www.w3.org/TR/webcodecs-avc-codec-registration/#videoencoderencodeoptions-extensions)

```webidl
partial dictionary VideoEncoderEncodeOptions {
  VideoEncoderEncodeOptionsForAvc avc;
};
```

**`avc`, of type [VideoEncoderEncodeOptionsForAvc](https://www.w3.org/TR/webcodecs-avc-codec-registration/#dictdef-videoencoderencodeoptionsforavc)**

Contains codec specific encode options for the [\[ITU-T-REC-H.264\]](https://www.w3.org/TR/webcodecs-avc-codec-registration/#biblio-itu-t-rec-h264) codec.

### [6.1. VideoEncoderEncodeOptionsForAvc](https://www.w3.org/TR/webcodecs-avc-codec-registration/#avc-encode-options)

```webidl
dictionary VideoEncoderEncodeOptionsForAvc {
  unsigned short? quantizer;
};
```

**`quantizer`, of type [unsigned short](https://webidl.spec.whatwg.org/#idl-unsigned-short), nullable**

Sets per-frame quantizer value. In [\[ITU-T-REC-H.264\]](https://www.w3.org/TR/webcodecs-avc-codec-registration/#biblio-itu-t-rec-h264) the quantizer threshold can be varied from 0 to 51.

## [7. Privacy Considerations](https://www.w3.org/TR/webcodecs-avc-codec-registration/#privacy-considerations)

Please refer to the section [Privacy Considerations](https://www.w3.org/TR/webcodecs/#privacy-considerations) in [\[WEBCODECS\]](https://www.w3.org/TR/webcodecs-avc-codec-registration/#biblio-webcodecs).

## [8. Security Considerations](https://www.w3.org/TR/webcodecs-avc-codec-registration/#security-considerations)

Please refer to the section [Security Considerations](https://www.w3.org/TR/webcodecs/#security-considerations) in [\[WEBCODECS\]](https://www.w3.org/TR/webcodecs-avc-codec-registration/#biblio-webcodecs).

## [Conformance](https://www.w3.org/TR/webcodecs-avc-codec-registration/#w3c-conformance)

### [Document conventions](https://www.w3.org/TR/webcodecs-avc-codec-registration/#w3c-conventions)

Conformance requirements are expressed with a combination of descriptive assertions and RFC 2119 terminology. The key words “MUST”, “MUST NOT”, “REQUIRED”, “SHALL”, “SHALL NOT”, “SHOULD”, “SHOULD NOT”, “RECOMMENDED”, “MAY”, and “OPTIONAL” in the normative parts of this document are to be interpreted as described in RFC 2119. However, for readability, these words do not appear in all uppercase letters in this specification.

All of the text of this specification is normative except sections explicitly marked as non-normative, examples, and notes. [\[RFC2119\]](https://www.w3.org/TR/webcodecs-avc-codec-registration/#biblio-rfc2119)

Examples in this specification are introduced with the words “for example” or are set apart from the normative text with `class="example"`, like this:

[](https://www.w3.org/TR/webcodecs-avc-codec-registration/#w3c-example)

This is an example of an informative example.

Informative notes begin with the word “Note” and are set apart from the normative text with `class="note"`, like this:

Note, this is an informative note.

## [Index](https://www.w3.org/TR/webcodecs-avc-codec-registration/#index)

### [Terms defined by this specification](https://www.w3.org/TR/webcodecs-avc-codec-registration/#index-defined-here)

- ["annexb"](https://www.w3.org/TR/webcodecs-avc-codec-registration/#dom-avcbitstreamformat-annexb), in § 5.2
- [annexb](https://www.w3.org/TR/webcodecs-avc-codec-registration/#dom-avcbitstreamformat-annexb), in § 5.2
- ["avc"](https://www.w3.org/TR/webcodecs-avc-codec-registration/#dom-avcbitstreamformat-avc), in § 5.2
- avc
  - [dict-member for VideoEncoderConfig](https://www.w3.org/TR/webcodecs-avc-codec-registration/#dom-videoencoderconfig-avc), in § 5
  - [dict-member for VideoEncoderEncodeOptions](https://www.w3.org/TR/webcodecs-avc-codec-registration/#dom-videoencoderencodeoptions-avc), in § 6
  - [enum-value for AvcBitstreamFormat](https://www.w3.org/TR/webcodecs-avc-codec-registration/#dom-avcbitstreamformat-avc), in § 5.2
- [AvcBitstreamFormat](https://www.w3.org/TR/webcodecs-avc-codec-registration/#enumdef-avcbitstreamformat), in § 5.2
- [AvcEncoderConfig](https://www.w3.org/TR/webcodecs-avc-codec-registration/#dictdef-avcencoderconfig), in § 5.1
- [format](https://www.w3.org/TR/webcodecs-avc-codec-registration/#dom-avcencoderconfig-format), in § 5.1
- [quantizer](https://www.w3.org/TR/webcodecs-avc-codec-registration/#dom-videoencoderencodeoptionsforavc-quantizer), in § 6.1
- [VideoEncoderEncodeOptionsForAvc](https://www.w3.org/TR/webcodecs-avc-codec-registration/#dictdef-videoencoderencodeoptionsforavc), in § 6.1

### [Terms defined by reference](https://www.w3.org/TR/webcodecs-avc-codec-registration/#index-defined-elsewhere)

- \[WEBCODECS\] defines the following terms:
  - "key"
  - EncodedVideoChunk
  - VideoEncoderConfig
  - VideoEncoderEncodeOptions
  - \[\[internal data\]\]
  - \[\[output callback\]\]
  - \[\[type\]\]
  - decoderConfig
  - description
- \[WEBIDL\] defines the following terms:
  - unsigned short

## [References](https://www.w3.org/TR/webcodecs-avc-codec-registration/#references)

### [Normative References](https://www.w3.org/TR/webcodecs-avc-codec-registration/#normative)

**\[RFC2119\]**

S. Bradner. [Key words for use in RFCs to Indicate Requirement Levels](https://datatracker.ietf.org/doc/html/rfc2119). March 1997. Best Current Practice. URL: [https://datatracker.ietf.org/doc/html/rfc2119](https://datatracker.ietf.org/doc/html/rfc2119)
**\[WEBCODECS\]**

Paul Adenot; Eugene Zemtsov. [WebCodecs](https://www.w3.org/TR/webcodecs/). 17 April 2025. WD. URL: [https://www.w3.org/TR/webcodecs/](https://www.w3.org/TR/webcodecs/)
**\[WEBIDL\]**

Edgar Chen; Timothy Gu. [Web IDL Standard](https://webidl.spec.whatwg.org/). Living Standard. URL: [https://webidl.spec.whatwg.org/](https://webidl.spec.whatwg.org/)

### [Informative References](https://www.w3.org/TR/webcodecs-avc-codec-registration/#informative)

**\[ISO14496-15\]**

[ISO/IEC 14496-15:2024 Information technology — Coding of audio-visual objects — Part 15: Carriage of network abstraction layer (NAL) unit structured video in the ISO base media file format](https://www.iso.org/standard/89118.html). October 2024. URL: [https://www.iso.org/standard/89118.html](https://www.iso.org/standard/89118.html)
**\[ITU-T-REC-H.264\]**

[H.264 : Advanced video coding for generic audiovisual services](https://www.itu.int/rec/T-REC-H.264). June 2019. URL: [https://www.itu.int/rec/T-REC-H.264](https://www.itu.int/rec/T-REC-H.264)
**\[RFC6381\]**

R. Gellens; D. Singer; P. Frojdh. [The 'Codecs' and 'Profiles' Parameters for "Bucket" Media Types](https://www.rfc-editor.org/rfc/rfc6381). August 2011. Proposed Standard. URL: [https://www.rfc-editor.org/rfc/rfc6381](https://www.rfc-editor.org/rfc/rfc6381)
**\[WEBCODECS-CODEC-REGISTRY\]**

Paul Adenot; Bernard Aboba. [WebCodecs Codec Registry](https://www.w3.org/TR/webcodecs-codec-registry/). 9 September 2024. DRY. URL: [https://www.w3.org/TR/webcodecs-codec-registry/](https://www.w3.org/TR/webcodecs-codec-registry/)

## [IDL Index](https://www.w3.org/TR/webcodecs-avc-codec-registration/#idl-index)

```webidl
partial dictionary VideoEncoderConfig {
  AvcEncoderConfig avc;
};


dictionary AvcEncoderConfig {
  AvcBitstreamFormat format = "avc";
};


enum AvcBitstreamFormat {
  "annexb",
  "avc",
};


partial dictionary VideoEncoderEncodeOptions {
  VideoEncoderEncodeOptionsForAvc avc;
};


dictionary VideoEncoderEncodeOptionsForAvc {
  unsigned short? quantizer;
};
```

/\* Boilerplate: script-dom-helper \*/ "use strict"; function query(sel) { return document.querySelector(sel); } function queryAll(sel) { return \[...document.querySelectorAll(sel)\]; } function iter(obj) { if(!obj) return \[\]; var it = obj\[Symbol.iterator\]; if(it) return it; return Object.entries(obj); } function mk(tagname, attrs, ...children) { const el = document.createElement(tagname); for(const \[k,v\] of iter(attrs)) { if(k.slice(0,3) == "\_on") { const eventName = k.slice(3); el.addEventListener(eventName, v); } else if(k\[0\] == "\_") { // property, not attribute el\[k.slice(1)\] = v; } else { if(v === false || v == null) { continue; } else if(v === true) { el.setAttribute(k, ""); continue; } else { el.setAttribute(k, v); } } } append(el, children); return el; } /\* Create shortcuts for every known HTML element \*/ \[ "a", "abbr", "acronym", "address", "applet", "area", "article", "aside", "audio", "b", "base", "basefont", "bdo", "big", "blockquote", "body", "br", "button", "canvas", "caption", "center", "cite", "code", "col", "colgroup", "datalist", "dd", "del", "details", "dfn", "dialog", "div", "dl", "dt", "em", "embed", "fieldset", "figcaption", "figure", "font", "footer", "form", "frame", "frameset", "head", "header", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "html", "i", "iframe", "img", "input", "ins", "kbd", "label", "legend", "li", "link", "main", "map", "mark", "meta", "meter", "nav", "nobr", "noscript", "object", "ol", "optgroup", "option", "output", "p", "param", "pre", "progress", "q", "s", "samp", "script", "section", "select", "small", "source", "span", "strike", "strong", "style", "sub", "summary", "sup", "table", "tbody", "td", "template", "textarea", "tfoot", "th", "thead", "time", "title", "tr", "u", "ul", "var", "video", "wbr", "xmp", \].forEach(tagname=>{ mk\[tagname\] = (...args) => mk(tagname, ...args); }); function\* nodesFromChildList(children) { for(const child of children.flat(Infinity)) { if(child instanceof Node) { yield child; } else { yield new Text(child); } } } function append(el, ...children) { for(const child of nodesFromChildList(children)) { if(el instanceof Node) el.appendChild(child); else el.push(child); } return el; } function insertAfter(el, ...children) { for(const child of nodesFromChildList(children)) { el.parentNode.insertBefore(child, el.nextSibling); } return el; } function clearContents(el) { el.innerHTML = ""; return el; } function parseHTML(markup) { if(markup.toLowerCase().trim().indexOf('<!doctype') === 0) { const doc = document.implementation.createHTMLDocument(""); doc.documentElement.innerHTML = markup; return doc; } else { const el = mk.template({}); el.innerHTML = markup; return el.content; } } /\* Boilerplate: script-dfn-panel \*/ "use strict"; { let dfnPanelData = { "125a0a40": {"dfnID":"125a0a40","dfnText":"\[\[output callback\]\]","external":true,"refSections":\[{"refs":\[{"id":"ref-for-dom-videoencoder-output-callback-slot"}\],"title":"5.2. AvcBitstreamFormat"}\],"url":"https://www.w3.org/TR/webcodecs/#dom-videoencoder-output-callback-slot"}, "18866b6c": {"dfnID":"18866b6c","dfnText":"decoderConfig","external":true,"refSections":\[{"refs":\[{"id":"ref-for-dom-encodedvideochunkmetadata-decoderconfig"}\],"title":"5.2. AvcBitstreamFormat"}\],"url":"https://www.w3.org/TR/webcodecs/#dom-encodedvideochunkmetadata-decoderconfig"}, "22466159": {"dfnID":"22466159","dfnText":"EncodedVideoChunk","external":true,"refSections":\[{"refs":\[{"id":"ref-for-encodedvideochunk"},{"id":"ref-for-encodedvideochunk\\u2460"}\],"title":"Unnumbered Section"},{"refs":\[{"id":"ref-for-encodedvideochunk\\u2461"}\],"title":"2. EncodedVideoChunk data"},{"refs":\[{"id":"ref-for-encodedvideochunk\\u2462"},{"id":"ref-for-encodedvideochunk\\u2463"},{"id":"ref-for-encodedvideochunk\\u2464"},{"id":"ref-for-encodedvideochunk\\u2465"},{"id":"ref-for-encodedvideochunk\\u2466"}\],"title":"4. EncodedVideoChunk type"},{"refs":\[{"id":"ref-for-encodedvideochunk\\u2467"}\],"title":"5.1. AvcEncoderConfig"}\],"url":"https://www.w3.org/TR/webcodecs/#encodedvideochunk"}, "2720ddb0": {"dfnID":"2720ddb0","dfnText":"VideoEncoderEncodeOptions","external":true,"refSections":\[{"refs":\[{"id":"ref-for-dictdef-videoencoderencodeoptions"}\],"title":"Unnumbered Section"},{"refs":\[{"id":"ref-for-dictdef-videoencoderencodeoptions\\u2460"}\],"title":"6. VideoEncoderEncodeOptions extensions"}\],"url":"https://www.w3.org/TR/webcodecs/#dictdef-videoencoderencodeoptions"}, "3aa8626d": {"dfnID":"3aa8626d","dfnText":"VideoEncoderConfig","external":true,"refSections":\[{"refs":\[{"id":"ref-for-dictdef-videoencoderconfig"}\],"title":"Unnumbered Section"},{"refs":\[{"id":"ref-for-dictdef-videoencoderconfig\\u2460"}\],"title":"5. VideoEncoderConfig extensions"}\],"url":"https://www.w3.org/TR/webcodecs/#dictdef-videoencoderconfig"}, "450958f7": {"dfnID":"450958f7","dfnText":"unsigned short","external":true,"refSections":\[{"refs":\[{"id":"ref-for-idl-unsigned-short"},{"id":"ref-for-idl-unsigned-short\\u2460"}\],"title":"6.1. VideoEncoderEncodeOptionsForAvc"}\],"url":"https://webidl.spec.whatwg.org/#idl-unsigned-short"}, "54f0e453": {"dfnID":"54f0e453","dfnText":"\[\[type\]\]","external":true,"refSections":\[{"refs":\[{"id":"ref-for-dom-encodedvideochunk-type-slot"}\],"title":"Unnumbered Section"},{"refs":\[{"id":"ref-for-dom-encodedvideochunk-type-slot\\u2460"},{"id":"ref-for-dom-encodedvideochunk-type-slot\\u2461"}\],"title":"4. EncodedVideoChunk type"}\],"url":"https://www.w3.org/TR/webcodecs/#dom-encodedvideochunk-type-slot"}, "6dae30ed": {"dfnID":"6dae30ed","dfnText":"description","external":true,"refSections":\[{"refs":\[{"id":"ref-for-dom-videodecoderconfig-description"}\],"title":"Unnumbered Section"},{"refs":\[{"id":"ref-for-dom-videodecoderconfig-description\\u2460"},{"id":"ref-for-dom-videodecoderconfig-description\\u2461"}\],"title":"3. VideoDecoderConfig description"},{"refs":\[{"id":"ref-for-dom-videodecoderconfig-description\\u2462"}\],"title":"4. EncodedVideoChunk type"},{"refs":\[{"id":"ref-for-dom-videodecoderconfig-description\\u2463"}\],"title":"5.2. AvcBitstreamFormat"}\],"url":"https://www.w3.org/TR/webcodecs/#dom-videodecoderconfig-description"}, "9cb4afd6": {"dfnID":"9cb4afd6","dfnText":"\[\[internal data\]\]","external":true,"refSections":\[{"refs":\[{"id":"ref-for-dom-encodedvideochunk-internal-data-slot"}\],"title":"Unnumbered Section"},{"refs":\[{"id":"ref-for-dom-encodedvideochunk-internal-data-slot\\u2460"},{"id":"ref-for-dom-encodedvideochunk-internal-data-slot\\u2461"},{"id":"ref-for-dom-encodedvideochunk-internal-data-slot\\u2462"},{"id":"ref-for-dom-encodedvideochunk-internal-data-slot\\u2463"}\],"title":"2. EncodedVideoChunk data"}\],"url":"https://www.w3.org/TR/webcodecs/#dom-encodedvideochunk-internal-data-slot"}, "d239a8c2": {"dfnID":"d239a8c2","dfnText":"\\"key\\"","external":true,"refSections":\[{"refs":\[{"id":"ref-for-dom-encodedvideochunktype-key"},{"id":"ref-for-dom-encodedvideochunktype-key\\u2460"}\],"title":"4. EncodedVideoChunk type"}\],"url":"https://www.w3.org/TR/webcodecs/#dom-encodedvideochunktype-key"}, "dictdef-avcencoderconfig": {"dfnID":"dictdef-avcencoderconfig","dfnText":"AvcEncoderConfig","external":false,"refSections":\[{"refs":\[{"id":"ref-for-dictdef-avcencoderconfig"},{"id":"ref-for-dictdef-avcencoderconfig\\u2460"}\],"title":"5. VideoEncoderConfig extensions"}\],"url":"#dictdef-avcencoderconfig"}, "dictdef-videoencoderencodeoptionsforavc": {"dfnID":"dictdef-videoencoderencodeoptionsforavc","dfnText":"VideoEncoderEncodeOptionsForAvc","external":false,"refSections":\[{"refs":\[{"id":"ref-for-dictdef-videoencoderencodeoptionsforavc"},{"id":"ref-for-dictdef-videoencoderencodeoptionsforavc\\u2460"}\],"title":"6. VideoEncoderEncodeOptions extensions"}\],"url":"#dictdef-videoencoderencodeoptionsforavc"}, "dom-avcbitstreamformat-annexb": {"dfnID":"dom-avcbitstreamformat-annexb","dfnText":"annexb","external":false,"refSections":\[{"refs":\[{"id":"ref-for-dom-avcbitstreamformat-annexb"}\],"title":"2. EncodedVideoChunk data"},{"refs":\[{"id":"ref-for-dom-avcbitstreamformat-annexb\\u2460"}\],"title":"3. VideoDecoderConfig description"},{"refs":\[{"id":"ref-for-dom-avcbitstreamformat-annexb\\u2461"}\],"title":"4. EncodedVideoChunk type"},{"refs":\[{"id":"ref-for-dom-avcbitstreamformat-annexb\\u2462"}\],"title":"5.2. AvcBitstreamFormat"}\],"url":"#dom-avcbitstreamformat-annexb"}, "dom-avcbitstreamformat-avc": {"dfnID":"dom-avcbitstreamformat-avc","dfnText":"avc","external":false,"refSections":\[{"refs":\[{"id":"ref-for-dom-avcbitstreamformat-avc"}\],"title":"2. EncodedVideoChunk data"},{"refs":\[{"id":"ref-for-dom-avcbitstreamformat-avc\\u2460"}\],"title":"3. VideoDecoderConfig description"},{"refs":\[{"id":"ref-for-dom-avcbitstreamformat-avc\\u2461"},{"id":"ref-for-dom-avcbitstreamformat-avc\\u2462"}\],"title":"4. EncodedVideoChunk type"},{"refs":\[{"id":"ref-for-dom-avcbitstreamformat-avc\\u2463"}\],"title":"5.2. AvcBitstreamFormat"}\],"url":"#dom-avcbitstreamformat-avc"}, "dom-avcencoderconfig-format": {"dfnID":"dom-avcencoderconfig-format","dfnText":"format","external":false,"refSections":\[{"refs":\[{"id":"ref-for-dom-avcencoderconfig-format"}\],"title":"5.1. AvcEncoderConfig"}\],"url":"#dom-avcencoderconfig-format"}, "dom-videoencoderconfig-avc": {"dfnID":"dom-videoencoderconfig-avc","dfnText":"avc","external":false,"refSections":\[{"refs":\[{"id":"ref-for-dom-videoencoderconfig-avc"}\],"title":"5. VideoEncoderConfig extensions"}\],"url":"#dom-videoencoderconfig-avc"}, "dom-videoencoderencodeoptions-avc": {"dfnID":"dom-videoencoderencodeoptions-avc","dfnText":"avc","external":false,"refSections":\[{"refs":\[{"id":"ref-for-dom-videoencoderencodeoptions-avc"}\],"title":"6. VideoEncoderEncodeOptions extensions"}\],"url":"#dom-videoencoderencodeoptions-avc"}, "dom-videoencoderencodeoptionsforavc-quantizer": {"dfnID":"dom-videoencoderencodeoptionsforavc-quantizer","dfnText":"quantizer","external":false,"refSections":\[{"refs":\[{"id":"ref-for-dom-videoencoderencodeoptionsforavc-quantizer"}\],"title":"6.1. VideoEncoderEncodeOptionsForAvc"}\],"url":"#dom-videoencoderencodeoptionsforavc-quantizer"}, "enumdef-avcbitstreamformat": {"dfnID":"enumdef-avcbitstreamformat","dfnText":"AvcBitstreamFormat","external":false,"refSections":\[{"refs":\[{"id":"ref-for-enumdef-avcbitstreamformat"},{"id":"ref-for-enumdef-avcbitstreamformat\\u2460"},{"id":"ref-for-enumdef-avcbitstreamformat\\u2461"}\],"title":"5.1. AvcEncoderConfig"},{"refs":\[{"id":"ref-for-enumdef-avcbitstreamformat\\u2462"}\],"title":"5.2. AvcBitstreamFormat"}\],"url":"#enumdef-avcbitstreamformat"}, }; document.addEventListener("DOMContentLoaded", ()=>{ genAllDfnPanels(); document.body.addEventListener("click", (e) => { // If not handled already, just hide all dfn panels. hideAllDfnPanels(); }); }); window.addEventListener("resize", () => { // Pin any visible dfn panel queryAll(".dfn-panel.on, .dfn-panel.activated").forEach(el=>positionDfnPanel(el)); }); function genAllDfnPanels() { for(const panelData of Object.values(dfnPanelData)) { const dfnID = panelData.dfnID; const dfn = document.getElementById(dfnID); if(!dfn) { console.log(\`Can't find dfn#${dfnID}.\`, panelData); continue; } dfn.panelData = panelData; insertDfnPopupAction(dfn); } } function genDfnPanel(dfn, { dfnID, url, dfnText, refSections, external }) { const dfnPanel = mk.aside({ class: "dfn-panel on", id: \`infopanel-for-${dfnID}\`, "data-for": dfnID, "aria-labelled-by":\`infopaneltitle-for-${dfnID}\`, }, mk.span({id:\`infopaneltitle-for-${dfnID}\`, style:"display:none"}, \`Info about the '${dfnText}' ${external?"external":""} reference.\`), mk.a({href:url, class:"dfn-link"}, url), refSections.length == 0 ? \[\] : mk.b({}, "Referenced in:"), mk.ul({}, ...refSections.map(section=> mk.li({}, ...section.refs.map((ref, refI)=> \[ mk.a({ href: \`#${ref.id}\` }, (refI == 0) ? section.title : \`(${refI + 1})\` ), " ", \] ), ), ), ), genLinkingSyntaxes(dfn), ); dfnPanel.addEventListener('click', (event) => { if (event.target.nodeName == 'A') { scrollToTargetAndHighlight(event); pinDfnPanel(dfnPanel); } event.stopPropagation(); refocusOnTarget(event); }); dfnPanel.addEventListener('keydown', (event) => { if(event.keyCode == 27) { // Escape key hideDfnPanel({dfnPanel}); event.stopPropagation(); event.preventDefault(); } }); dfnPanel.dfn = dfn; dfn.dfnPanel = dfnPanel; return dfnPanel; } function hideAllDfnPanels() { // Delete the currently-active dfn panel. queryAll(".dfn-panel").forEach(dfnPanel=>hideDfnPanel({dfnPanel})); } function showDfnPanel(dfn) { hideAllDfnPanels(); // Only display one at a time. dfn.setAttribute("aria-expanded", "true"); const dfnPanel = genDfnPanel(dfn, dfn.panelData); // Give the dfn a unique tabindex, and then // give all the tabbable panel bits successive indexes. let tabIndex = 100; dfn.tabIndex = tabIndex++; const tabbable = dfnPanel.querySelectorAll(":is(a, button)"); for (const el of tabbable) { el.tabIndex = tabIndex++; } append(document.body, dfnPanel); positionDfnPanel(dfnPanel); } function positionDfnPanel(dfnPanel) { const dfn = dfnPanel.dfn; const dfnPos = getBounds(dfn); dfnPanel.style.top = dfnPos.bottom + "px"; dfnPanel.style.left = dfnPos.left + "px"; const panelPos = dfnPanel.getBoundingClientRect(); const panelMargin = 8; const maxRight = document.body.parentNode.clientWidth - panelMargin; if (panelPos.right > maxRight) { const overflowAmount = panelPos.right - maxRight; const newLeft = Math.max(panelMargin, dfnPos.left - overflowAmount); dfnPanel.style.left = newLeft + "px"; } } function pinDfnPanel(dfnPanel) { // Switch it to "activated" state, which pins it. dfnPanel.classList.add("activated"); dfnPanel.style.position = "fixed"; dfnPanel.style.left = null; dfnPanel.style.top = null; } function hideDfnPanel({dfn, dfnPanel}) { if(!dfnPanel) dfnPanel = dfn.dfnPanel; if(!dfn) dfn = dfnPanel.dfn; dfn.dfnPanel = undefined; dfnPanel.dfn = undefined; dfn.setAttribute("aria-expanded", "false"); dfn.tabIndex = undefined; dfnPanel.remove() } function toggleDfnPanel(dfn) { if(dfn.dfnPanel) { hideDfnPanel(dfn); } else { showDfnPanel(dfn); } } function insertDfnPopupAction(dfn) { dfn.setAttribute('role', 'button'); dfn.setAttribute('aria-expanded', 'false') dfn.tabIndex = 0; dfn.classList.add('has-dfn-panel'); dfn.addEventListener('click', (event) => { toggleDfnPanel(dfn); event.stopPropagation(); }); dfn.addEventListener('keypress', (event) => { const kc = event.keyCode; // 32->Space, 13->Enter if(kc == 32 || kc == 13) { toggleDfnPanel(dfn); event.stopPropagation(); event.preventDefault(); } }); } function refocusOnTarget(event) { const target = event.target; setTimeout(() => { // Refocus on the event.target element. // This is needed after browser scrolls to the destination. target.focus(); }); } // TODO: shared util // Returns the root-level absolute position {left and top} of element. function getBounds(el, relativeTo=document.body) { const relativeRect = relativeTo.getBoundingClientRect(); const elRect = el.getBoundingClientRect(); const top = elRect.top - relativeRect.top; const left = elRect.left - relativeRect.left; return { top, left, bottom: top + elRect.height, right: left + elRect.width, } } function scrollToTargetAndHighlight(event) { let hash = event.target.hash; if (hash) { hash = decodeURIComponent(hash.substring(1)); const dest = document.getElementById(hash); if (dest) { dest.classList.add('highlighted'); setTimeout(() => dest.classList.remove('highlighted'), 1000); } } } // Functions, divided by link type, that wrap an autolink's // contents with the appropriate outer syntax. // Alternately, a string naming another type they format // the same as. function needsFor(type) { switch(type) { case "descriptor": case "value": case "element-attr": case "attr-value": case "element-state": case "method": case "constructor": case "argument": case "attribute": case "const": case "dict-member": case "event": case "enum-value": case "stringifier": case "serializer": case "iterator": case "maplike": case "setlike": case "state": case "mode": case "context": case "facet": return true; default: return false; } } function refusesFor(type) { switch(type) { case "property": case "element": case "interface": case "namespace": case "callback": case "dictionary": case "enum": case "exception": case "typedef": case "http-header": case "permission": return true; default: return false; } } function linkFormatterFromType(type) { switch(type) { case 'scheme': case 'permission': case 'dfn': return (text) => \`\[=${text}=\]\`; case 'abstract-op': return (text) => \`\[\\$${text}\\$\]\`; case 'function': case 'at-rule': case 'selector': case 'value': return (text) => \`''${text}''\`; case 'http-header': return (text) => \`\[:${text}:\]\`; case 'interface': case 'constructor': case 'method': case 'argument': case 'attribute': case 'callback': case 'dictionary': case 'dict-member': case 'enum': case 'enum-value': case 'exception': case 'const': case 'typedef': case 'stringifier': case 'serializer': case 'iterator': case 'maplike': case 'setlike': case 'extended-attribute': case 'event': case 'idl': return (text) => \`{{${text}}}\`; case 'element-state': case 'element-attr': case 'attr-value': case 'element': return (element) => \`<{${element}}>\`; case 'grammar': return (text) => \`${text} (within a <pre class=prod>)\`; case 'type': return (text)=> \`<<${text}>>\`; case 'descriptor': case 'property': return (text) => \`'${text}'\`; default: return; }; }; function genLinkingSyntaxes(dfn) { if(dfn.tagName != "DFN") return; const type = dfn.getAttribute('data-dfn-type'); if(!type) { console.log(\`<dfn> doesn't have a data-dfn-type:\`, dfn); return \[\]; } // Return a function that wraps link text based on the type const linkFormatter = linkFormatterFromType(type); if(!linkFormatter) { console.log(\`<dfn> has an unknown data-dfn-type:\`, dfn); return \[\]; } let ltAlts; if(dfn.hasAttribute('data-lt')) { ltAlts = dfn.getAttribute('data-lt') .split("|") .map(x=>x.trim()); } else { ltAlts = \[dfn.textContent.trim()\]; } if(type == "type") { // lt of "<foo>", but "foo" is the interior; // <<foo/bar>> is how you write it with a for, // not <foo/<bar>> or whatever. for(var i = 0; i < ltAlts.length; i++) { const lt = ltAlts\[i\]; const match = /<(.\*)>/.exec(lt); if(match) { ltAlts\[i\] = match\[1\]; } } } let forAlts; if(dfn.hasAttribute('data-dfn-for')) { forAlts = dfn.getAttribute('data-dfn-for') .split(",") .map(x=>x.trim()); } else { forAlts = \[''\]; } let linkingSyntaxes = \[\]; if(!needsFor(type)) { for(const lt of ltAlts) { linkingSyntaxes.push(linkFormatter(lt)); } } if(!refusesFor(type)) { for(const f of forAlts) { linkingSyntaxes.push(linkFormatter(\`${f}/${ltAlts\[0\]}\`)) } } return \[ mk.b({}, 'Possible linking syntaxes:'), mk.ul({}, ...linkingSyntaxes.map(link => { const copyLink = async () => await navigator.clipboard.writeText(link); return mk.li({}, mk.div({ class: 'link-item' }, mk.button({ class: 'copy-icon', title: 'Copy', type: 'button', \_onclick: copyLink, tabindex: 0, }, mk.span({ class: 'icon' }) ), mk.span({}, link) ) ); }) ) \]; } } /\* Boilerplate: script-ref-hints \*/ "use strict"; { let refsData = { "#dictdef-avcencoderconfig": {"displayText":"AvcEncoderConfig","export":true,"for\_":\[\],"level":"","normative":true,"shortname":"webcodecs-avc-codec-registration","spec":"webcodecs-avc-codec-registration","status":"local","text":"AvcEncoderConfig","type":"dictionary","url":"#dictdef-avcencoderconfig"}, "#dictdef-videoencoderencodeoptionsforavc": {"displayText":"VideoEncoderEncodeOptionsForAvc","export":true,"for\_":\[\],"level":"","normative":true,"shortname":"webcodecs-avc-codec-registration","spec":"webcodecs-avc-codec-registration","status":"local","text":"VideoEncoderEncodeOptionsForAvc","type":"dictionary","url":"#dictdef-videoencoderencodeoptionsforavc"}, "#dom-avcbitstreamformat-annexb": {"displayText":"annexb","export":true,"for\_":\["AvcBitstreamFormat"\],"level":"","normative":true,"shortname":"webcodecs-avc-codec-registration","spec":"webcodecs-avc-codec-registration","status":"local","text":"annexb","type":"enum-value","url":"#dom-avcbitstreamformat-annexb"}, "#dom-avcbitstreamformat-avc": {"displayText":"avc","export":true,"for\_":\["AvcBitstreamFormat"\],"level":"","normative":true,"shortname":"webcodecs-avc-codec-registration","spec":"webcodecs-avc-codec-registration","status":"local","text":"avc","type":"enum-value","url":"#dom-avcbitstreamformat-avc"}, "#dom-avcencoderconfig-format": {"displayText":"format","export":true,"for\_":\["AvcEncoderConfig"\],"level":"","normative":true,"shortname":"webcodecs-avc-codec-registration","spec":"webcodecs-avc-codec-registration","status":"local","text":"format","type":"dict-member","url":"#dom-avcencoderconfig-format"}, "#dom-videoencoderconfig-avc": {"displayText":"avc","export":true,"for\_":\["VideoEncoderConfig"\],"level":"","normative":true,"shortname":"webcodecs-avc-codec-registration","spec":"webcodecs-avc-codec-registration","status":"local","text":"avc","type":"dict-member","url":"#dom-videoencoderconfig-avc"}, "#dom-videoencoderencodeoptions-avc": {"displayText":"avc","export":true,"for\_":\["VideoEncoderEncodeOptions"\],"level":"","normative":true,"shortname":"webcodecs-avc-codec-registration","spec":"webcodecs-avc-codec-registration","status":"local","text":"avc","type":"dict-member","url":"#dom-videoencoderencodeoptions-avc"}, "#dom-videoencoderencodeoptionsforavc-quantizer": {"displayText":"quantizer","export":true,"for\_":\["VideoEncoderEncodeOptionsForAvc"\],"level":"","normative":true,"shortname":"webcodecs-avc-codec-registration","spec":"webcodecs-avc-codec-registration","status":"local","text":"quantizer","type":"dict-member","url":"#dom-videoencoderencodeoptionsforavc-quantizer"}, "#enumdef-avcbitstreamformat": {"displayText":"AvcBitstreamFormat","export":true,"for\_":\[\],"level":"","normative":true,"shortname":"webcodecs-avc-codec-registration","spec":"webcodecs-avc-codec-registration","status":"local","text":"AvcBitstreamFormat","type":"enum","url":"#enumdef-avcbitstreamformat"}, "https://webidl.spec.whatwg.org/#idl-unsigned-short": {"displayText":"unsigned short","export":true,"for\_":\[\],"level":"1","normative":true,"shortname":"webidl","spec":"webidl","status":"current","text":"unsigned short","type":"interface","url":"https://webidl.spec.whatwg.org/#idl-unsigned-short"}, "https://www.w3.org/TR/webcodecs/#dictdef-videoencoderconfig": {"displayText":"VideoEncoderConfig","export":true,"for\_":\[\],"level":"1","normative":true,"shortname":"webcodecs","spec":"webcodecs","status":"snapshot","text":"VideoEncoderConfig","type":"dictionary","url":"https://www.w3.org/TR/webcodecs/#dictdef-videoencoderconfig"}, "https://www.w3.org/TR/webcodecs/#dictdef-videoencoderencodeoptions": {"displayText":"VideoEncoderEncodeOptions","export":true,"for\_":\[\],"level":"1","normative":true,"shortname":"webcodecs","spec":"webcodecs","status":"snapshot","text":"VideoEncoderEncodeOptions","type":"dictionary","url":"https://www.w3.org/TR/webcodecs/#dictdef-videoencoderencodeoptions"}, "https://www.w3.org/TR/webcodecs/#dom-encodedvideochunk-internal-data-slot": {"displayText":"\[\[internal data\]\]","export":true,"for\_":\["EncodedVideoChunk"\],"level":"1","normative":true,"shortname":"webcodecs","spec":"webcodecs","status":"snapshot","text":"\[\[internal data\]\]","type":"attribute","url":"https://www.w3.org/TR/webcodecs/#dom-encodedvideochunk-internal-data-slot"}, "https://www.w3.org/TR/webcodecs/#dom-encodedvideochunk-type-slot": {"displayText":"\[\[type\]\]","export":true,"for\_":\["EncodedVideoChunk"\],"level":"1","normative":true,"shortname":"webcodecs","spec":"webcodecs","status":"snapshot","text":"\[\[type\]\]","type":"attribute","url":"https://www.w3.org/TR/webcodecs/#dom-encodedvideochunk-type-slot"}, "https://www.w3.org/TR/webcodecs/#dom-encodedvideochunkmetadata-decoderconfig": {"displayText":"decoderConfig","export":true,"for\_":\["EncodedVideoChunkMetadata"\],"level":"1","normative":true,"shortname":"webcodecs","spec":"webcodecs","status":"snapshot","text":"decoderConfig","type":"dict-member","url":"https://www.w3.org/TR/webcodecs/#dom-encodedvideochunkmetadata-decoderconfig"}, "https://www.w3.org/TR/webcodecs/#dom-encodedvideochunktype-key": {"displayText":"\\"key\\"","export":true,"for\_":\["EncodedVideoChunkType"\],"level":"1","normative":true,"shortname":"webcodecs","spec":"webcodecs","status":"snapshot","text":"\\"key\\"","type":"enum-value","url":"https://www.w3.org/TR/webcodecs/#dom-encodedvideochunktype-key"}, "https://www.w3.org/TR/webcodecs/#dom-videodecoderconfig-description": {"displayText":"description","export":true,"for\_":\["VideoDecoderConfig"\],"level":"1","normative":true,"shortname":"webcodecs","spec":"webcodecs","status":"snapshot","text":"description","type":"dict-member","url":"https://www.w3.org/TR/webcodecs/#dom-videodecoderconfig-description"}, "https://www.w3.org/TR/webcodecs/#dom-videoencoder-output-callback-slot": {"displayText":"\[\[output callback\]\]","export":true,"for\_":\["VideoEncoder"\],"level":"1","normative":true,"shortname":"webcodecs","spec":"webcodecs","status":"snapshot","text":"\[\[output callback\]\]","type":"attribute","url":"https://www.w3.org/TR/webcodecs/#dom-videoencoder-output-callback-slot"}, "https://www.w3.org/TR/webcodecs/#encodedvideochunk": {"displayText":"EncodedVideoChunk","export":true,"for\_":\[\],"level":"1","normative":true,"shortname":"webcodecs","spec":"webcodecs","status":"snapshot","text":"EncodedVideoChunk","type":"interface","url":"https://www.w3.org/TR/webcodecs/#encodedvideochunk"}, }; function mkRefHint(link, ref) { const linkText = link.textContent; let dfnTextElements = ''; if (ref.displayText.toLowerCase() != linkText.toLowerCase()) { // Give the original term if it's being displayed in a different way. // But allow casing differences, they're insignificant. dfnTextElements = mk.li({}, mk.b({}, "Term: "), mk.span({}, ref.displayText) ); } const forList = ref.for\_; let forListElements; if(forList.length == 0) { forListElements = \[\]; } else if(forList.length == 1) { forListElements = mk.li({}, mk.b({}, "For: "), mk.span({}, forList\[0\]), ); } else { forListElements = mk.li({}, mk.b({}, "For: "), mk.ul({}, ...forList.map(forItem => mk.li({}, mk.span({}, forItem) ), ), ), ); } const url = ref.url; const safeUrl = encodeURIComponent(url); const hintPanel = mk.aside({ class: "ref-hint", id: \`ref-hint-for-${safeUrl}\`, "data-for": url, "aria-labelled-by": \`ref-hint-for-${safeUrl}\`, }, mk.ul({}, dfnTextElements, mk.li({}, mk.b({}, "URL: "), mk.a({ href: url, class: "ref" }, url), ), mk.li({}, mk.b({}, "Type: "), mk.span({}, \`${ref.type}\`), ), mk.li({}, mk.b({}, "Spec: "), mk.span({}, \`${ref.spec ? ref.spec : ''}\`), ), forListElements ), ); hintPanel.forLink = link; setupRefHintEventListeners(link, hintPanel); return hintPanel; } function hideAllRefHints() { queryAll(".ref-hint").forEach(el=>hideRefHint(el)); } function hideRefHint(refHint) { const link = refHint.forLink; link.setAttribute("aria-expanded", "false"); if(refHint.teardownEventListeners) { refHint.teardownEventListeners(); } refHint.remove(); } function showRefHint(link) { if(link.classList.contains("dfn-link")) return; const url = link.getAttribute("href"); const refHintKey = link.getAttribute("data-refhint-key"); let key = url; if(refHintKey) { key = refHintKey + "\_" + url; } const ref = refsData\[key\]; if(!ref) return; hideAllRefHints(); // Only display one at this time. const refHint = mkRefHint(link, ref); append(document.body, refHint); link.setAttribute("aria-expanded", "true"); positionRefHint(refHint); } function setupRefHintEventListeners(link, refHint) { if (refHint.teardownEventListeners) return; // Add event handlers to hide the refHint after the user moves away // from both the link and refHint, if not hovering either within one second. let timeout = null; const startHidingRefHint = (event) => { if (timeout) { clearTimeout(timeout); } timeout = setTimeout(() => { hideRefHint(refHint); }, 1000); } const resetHidingRefHint = (event) => { if (timeout) clearTimeout(timeout); timeout = null; }; link.addEventListener("mouseleave", startHidingRefHint); link.addEventListener("mouseenter", resetHidingRefHint); link.addEventListener("blur", startHidingRefHint); link.addEventListener("focus", resetHidingRefHint); refHint.addEventListener("mouseleave", startHidingRefHint); refHint.addEventListener("mouseenter", resetHidingRefHint); refHint.addEventListener("blur", startHidingRefHint); refHint.addEventListener("focus", resetHidingRefHint); refHint.teardownEventListeners = () => { // remove event listeners resetHidingRefHint(); link.removeEventListener("mouseleave", startHidingRefHint); link.removeEventListener("mouseenter", resetHidingRefHint); link.removeEventListener("blur", startHidingRefHint); link.removeEventListener("focus", resetHidingRefHint); refHint.removeEventListener("mouseleave", startHidingRefHint); refHint.removeEventListener("mouseenter", resetHidingRefHint); refHint.removeEventListener("blur", startHidingRefHint); refHint.removeEventListener("focus", resetHidingRefHint); }; } function positionRefHint(refHint) { const link = refHint.forLink; const linkPos = getBounds(link); refHint.style.top = linkPos.bottom + "px"; refHint.style.left = linkPos.left + "px"; const panelPos = refHint.getBoundingClientRect(); const panelMargin = 8; const maxRight = document.body.parentNode.clientWidth - panelMargin; if (panelPos.right > maxRight) { const overflowAmount = panelPos.right - maxRight; const newLeft = Math.max(panelMargin, linkPos.left - overflowAmount); refHint.style.left = newLeft + "px"; } } // TODO: shared util // Returns the root-level absolute position {left and top} of element. function getBounds(el, relativeTo=document.body) { const relativeRect = relativeTo.getBoundingClientRect(); const elRect = el.getBoundingClientRect(); const top = elRect.top - relativeRect.top; const left = elRect.left - relativeRect.left; return { top, left, bottom: top + elRect.height, right: left + elRect.width, } } function showRefHintListener(e) { // If the target isn't in a link (or is a link), // just ignore it. let link = e.target.closest("a"); if(!link) return; // If the target is in a ref-hint panel // (aka a link in the already-open one), // also just ignore it. if(link.closest(".ref-hint")) return; // Otherwise, show the panel for the link. showRefHint(link); } function hideAllHintsListener(e) { // If the click is inside a ref-hint panel, ignore it. if(e.target.closest(".ref-hint")) return; // Otherwise, close all the current panels. hideAllRefHints(); } document.addEventListener("DOMContentLoaded", () => { document.body.addEventListener("mousedown", showRefHintListener); document.body.addEventListener("focus", showRefHintListener); document.body.addEventListener("click", hideAllHintsListener); }); window.addEventListener("resize", () => { // Hide any open ref hint. hideAllRefHints(); }); }
