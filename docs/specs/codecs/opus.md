---
title: 'Opus'
---

> From [Opus Registration](https://www.w3.org/TR/webcodecs-opus-codec-registration/)

## Abstract

This registration is entered into the [\[webcodecs-codec-registry\]](https://www.w3.org/TR/webcodecs-opus-codec-registration/#biblio-webcodecs-codec-registry). It describes, for Opus, the (1) fully qualified [codec strings](https://www.w3.org/TR/webcodecs/#config-codec-string), (2) the codec-specific [EncodedAudioChunk](https://www.w3.org/TR/webcodecs/#encodedaudiochunk) [[[internal data]]](https://www.w3.org/TR/webcodecs/#dom-encodedaudiochunk-internal-data-slot) bytes, (3) the [AudioDecoderConfig.description](https://www.w3.org/TR/webcodecs/#dom-audiodecoderconfig-description) bytes, (4) the values of [EncodedAudioChunk](https://www.w3.org/TR/webcodecs/#encodedaudiochunk) [[[type]]](https://www.w3.org/TR/webcodecs/#dom-encodedaudiochunk-type-slot), and (5) the codec-specific extensions to [AudioEncoderConfig](https://www.w3.org/TR/webcodecs/#dictdef-audioencoderconfig)

The registration is not intended to include any information on whether a codec format is encumbered by intellectual property claims. Implementers and authors are advised to seek appropriate legal counsel in this matter if they intend to implement or use a specific codec format. Implementers of WebCodecs are not required to support the Opus codec.

This registration is non-normative.

## Status of this document

_This section describes the status of this document at the time of its publication. A list of current W3C publications and the latest revision of this technical report can be found in the [W3C standards and drafts index](https://www.w3.org/TR/) at https://www.w3.org/TR/._

Feedback and comments on this specification are welcome. [GitHub Issues](https://github.com/w3c/webcodecs/issues) are preferred for discussion on this specification. Alternatively, you can send comments to the Media Working Group’s mailing-list, [public-media-wg@w3.org](mailto:public-media-wg@w3.org) ([archives](https://lists.w3.org/Archives/Public/public-media-wg/)). This draft highlights some of the pending issues that are still to be discussed in the working group. No decision has been taken on the outcome of these issues including whether they are valid.

This document was published by the [Media Working Group](https://www.w3.org/groups/wg/media/) as a Group Draft Note using the [Note track](https://www.w3.org/policies/process/20231103/#recs-and-notes).

Group Draft Notes are not endorsed by W3C nor its Members.

This is a draft document and may be updated, replaced or obsoleted by other documents at any time. It is inappropriate to cite this document as other than work in progress.

The [W3C Patent Policy](https://www.w3.org/policies/patent-policy/) does not carry any licensing requirements or commitments on this document.

This document is governed by the [03 November 2023 W3C Process Document](https://www.w3.org/policies/process/20231103/).

## [1. Fully qualified codec strings](https://www.w3.org/TR/webcodecs-opus-codec-registration/#fully-qualified-codec-strings)

The [codec string](https://www.w3.org/TR/webcodecs/#config-codec-string) is `"opus"`.

## [2. EncodedAudioChunk data](https://www.w3.org/TR/webcodecs-opus-codec-registration/#encodedaudiochunk-data)

An [EncodedAudioChunk](https://www.w3.org/TR/webcodecs/#encodedaudiochunk) containing Opus can be in two different formats.

If the bitstream is in [opus](https://www.w3.org/TR/webcodecs-opus-codec-registration/#dom-opusbitstreamformat-opus) format, [EncodedAudioChunk](https://www.w3.org/TR/webcodecs/#encodedaudiochunk) have to be Opus packets, as described in [section 3](https://datatracker.ietf.org/doc/html/rfc6716#section-3) of [\[OPUS\]](https://www.w3.org/TR/webcodecs-opus-codec-registration/#biblio-opus)

If the bitstream is in [ogg](https://www.w3.org/TR/webcodecs-opus-codec-registration/#dom-opusbitstreamformat-ogg) format, [EncodedAudioChunk](https://www.w3.org/TR/webcodecs/#encodedaudiochunk) have to be audio data packets, as described in [section 3](https://datatracker.ietf.org/doc/html/rfc7845#section-3) of [\[OPUS-IN-OGG\]](https://www.w3.org/TR/webcodecs-opus-codec-registration/#biblio-opus-in-ogg).

## [3. AudioDecoderConfig description](https://www.w3.org/TR/webcodecs-opus-codec-registration/#audiodecoderconfig-description)

[description](https://www.w3.org/TR/webcodecs/#dom-audiodecoderconfig-description) can be optionally set to an Identification Header, described in section 5.1 of [\[OPUS-IN-OGG\]](https://www.w3.org/TR/webcodecs-opus-codec-registration/#biblio-opus-in-ogg).

If a [description](https://www.w3.org/TR/webcodecs/#dom-audiodecoderconfig-description) has been set, the bitstream is assumed to be in [ogg](https://www.w3.org/TR/webcodecs-opus-codec-registration/#dom-opusbitstreamformat-ogg) format.

If a [description](https://www.w3.org/TR/webcodecs/#dom-audiodecoderconfig-description) has not been set, the bitstream is assumed to be in [opus](https://www.w3.org/TR/webcodecs-opus-codec-registration/#dom-opusbitstreamformat-opus) format.

## [4. EncodedAudioChunk type](https://www.w3.org/TR/webcodecs-opus-codec-registration/#encodedaudiochunk-type)

The [[[type]]](https://www.w3.org/TR/webcodecs/#dom-encodedaudiochunk-type-slot) for an [EncodedAudioChunk](https://www.w3.org/TR/webcodecs/#encodedaudiochunk) containing Opus is always "[key](https://www.w3.org/TR/webcodecs/#dom-encodedaudiochunktype-key)".

NOTE: Once the initialization has succeeded, any packet can be decoded at any time without error, but this might not result in the expected audio output.

## [5. AudioEncoderConfig extensions](https://www.w3.org/TR/webcodecs-opus-codec-registration/#audioencoderconfig-extensions)

```webidl
partial dictionary AudioEncoderConfig {
  OpusEncoderConfig opus;
};
```

**`opus`, of type [OpusEncoderConfig](https://www.w3.org/TR/webcodecs-opus-codec-registration/#dictdef-opusencoderconfig)**

Contains codec specific configuration options for the Opus codec.

### [5.1. OpusEncoderConfig](https://www.w3.org/TR/webcodecs-opus-codec-registration/#opus-encoder-config)

```webidl
dictionary OpusEncoderConfig {
  OpusBitstreamFormat format = "opus";
  OpusSignal signal = "auto";
  OpusApplication application = "audio";
  [EnforceRange] unsigned long long frameDuration = 20000;
  [EnforceRange] unsigned long complexity;
  [EnforceRange] unsigned long packetlossperc = 0;
  boolean useinbandfec = false;
  boolean usedtx = false;
};
```

To check if an [OpusEncoderConfig](https://www.w3.org/TR/webcodecs-opus-codec-registration/#dictdef-opusencoderconfig) is valid, run these steps:

1.  If [frameDuration](https://www.w3.org/TR/webcodecs-opus-codec-registration/#dom-opusencoderconfig-frameduration) is not a valid frame duration, which is described section 2.1.4 of [\[RFC6716\]](https://www.w3.org/TR/webcodecs-opus-codec-registration/#biblio-rfc6716), return `false`.
2.  If [complexity](https://www.w3.org/TR/webcodecs-opus-codec-registration/#dom-opusencoderconfig-complexity) is specified and not within the range of `0` and `10` inclusively, return `false`.
3.  If [packetlossperc](https://www.w3.org/TR/webcodecs-opus-codec-registration/#dom-opusencoderconfig-packetlossperc) is specified and not within the range of `0` and `100` inclusively, return `false`.
4.  Return `true`.

**`format`, of type [OpusBitstreamFormat](https://www.w3.org/TR/webcodecs-opus-codec-registration/#enumdef-opusbitstreamformat), defaulting to `"opus"`**

Configures the format of output [EncodedAudioChunk](https://www.w3.org/TR/webcodecs/#encodedaudiochunk)s. See [OpusBitstreamFormat](https://www.w3.org/TR/webcodecs-opus-codec-registration/#enumdef-opusbitstreamformat).
**`signal`, of type [OpusSignal](https://www.w3.org/TR/webcodecs-opus-codec-registration/#enumdef-opussignal), defaulting to `"auto"`**

Specificies the type of audio signal being encoded. See [OpusSignal](https://www.w3.org/TR/webcodecs-opus-codec-registration/#enumdef-opussignal).
**`application`, of type [OpusApplication](https://www.w3.org/TR/webcodecs-opus-codec-registration/#enumdef-opusapplication), defaulting to `"audio"`**

Specificies the encoder’s intended application. See [OpusApplication](https://www.w3.org/TR/webcodecs-opus-codec-registration/#enumdef-opusapplication).
**`frameDuration`, of type [unsigned long long](https://webidl.spec.whatwg.org/#idl-unsigned-long-long), defaulting to `20000`**

Configures the frame duration, in microseconds, of output [EncodedAudioChunk](https://www.w3.org/TR/webcodecs/#encodedaudiochunk)s.
**`complexity`, of type [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long)**

Configures the encoder’s computational complexity, as described in section 2.1.9. of [\[RFC6716\]](https://www.w3.org/TR/webcodecs-opus-codec-registration/#biblio-rfc6716). The valid range is `0` to `10`, with `10` representing the highest complexity. If no value is specificied, the default value is platform-specific: User Agents _SHOULD_ set a default of `5` for mobile platforms, and a default of `9` for all other platforms.
**`packetlossperc`, of type [unsigned long](https://webidl.spec.whatwg.org/#idl-unsigned-long), defaulting to `0`**

Configures the encoder’s expected packet loss percentage. The valid range is `0` to `100`.

NOTE: The packet loss percentage might be updated over the course of an encoding, and it is recommended for User Agents to support these reconfigurations.
**`useinbandfec`, of type [boolean](https://webidl.spec.whatwg.org/#idl-boolean), defaulting to `false`**

Specifies whether the encoder provides Opus in-band Forward Error Correction (FEC), as described by section 2.1.7. of [\[RFC6716\]](https://www.w3.org/TR/webcodecs-opus-codec-registration/#biblio-rfc6716).
**`usedtx`, of type [boolean](https://webidl.spec.whatwg.org/#idl-boolean), defaulting to `false`**

Specifies if the encoder uses Discontinuous Transmission (DTX), as described by section 2.1.9. of [\[RFC6716\]](https://www.w3.org/TR/webcodecs-opus-codec-registration/#biblio-rfc6716).

### [5.2. OpusBitstreamFormat](https://www.w3.org/TR/webcodecs-opus-codec-registration/#opus-bitstream-format)

```webidl
enum OpusBitstreamFormat {
  "opus",
  "ogg",
};
```

The [OpusBitstreamFormat](https://www.w3.org/TR/webcodecs-opus-codec-registration/#enumdef-opusbitstreamformat) determines if extra-data are necessary to decode the encoded audio stream.

**`opus`**

No metadata are necessary to decode the encoded audio stream.
**`ogg`**

The metadata of the encoded audio stream are provided at configuration via [AudioDecoderConfig.description](https://www.w3.org/TR/webcodecs/#dom-audiodecoderconfig-description).

### [5.3. OpusSignal](https://www.w3.org/TR/webcodecs-opus-codec-registration/#opus-signal)

```webidl
enum OpusSignal {
  "auto",
  "music",
  "voice",
};
```

The [OpusSignal](https://www.w3.org/TR/webcodecs-opus-codec-registration/#enumdef-opussignal) indicates the default value for the type of signal being encoded.

**`auto`**

The audio signal is not specified to be of a particular type.
**`music`**

The audio signal is music.
**`voice`**

The audio signal is voice or speech.

### [5.4. OpusApplication](https://www.w3.org/TR/webcodecs-opus-codec-registration/#opus-application)

```webidl
enum OpusApplication {
  "voip",
  "audio",
  "lowdelay",
};
```

The [OpusApplication](https://www.w3.org/TR/webcodecs-opus-codec-registration/#enumdef-opusapplication) indicates the default value for the encoder’s intended application.

**`voip`**

Process signal for improved speech intelligibility.
**`audio`**

Favor faithfulness to the original input.
**`lowdelay`**

Configure the minimum possible coding delay by disabling certain modes of operation.

## [6. Privacy Considerations](https://www.w3.org/TR/webcodecs-opus-codec-registration/#privacy-considerations)

Please refer to the section [Privacy Considerations](https://www.w3.org/TR/webcodecs/#privacy-considerations) in [\[WEBCODECS\]](https://www.w3.org/TR/webcodecs-opus-codec-registration/#biblio-webcodecs).

## [7. Security Considerations](https://www.w3.org/TR/webcodecs-opus-codec-registration/#security-considerations)

Please refer to the section [Security Considerations](https://www.w3.org/TR/webcodecs/#security-considerations) in [\[WEBCODECS\]](https://www.w3.org/TR/webcodecs-opus-codec-registration/#biblio-webcodecs).

## [Conformance](https://www.w3.org/TR/webcodecs-opus-codec-registration/#w3c-conformance)

### [Document conventions](https://www.w3.org/TR/webcodecs-opus-codec-registration/#w3c-conventions)

Conformance requirements are expressed with a combination of descriptive assertions and RFC 2119 terminology. The key words “MUST”, “MUST NOT”, “REQUIRED”, “SHALL”, “SHALL NOT”, “SHOULD”, “SHOULD NOT”, “RECOMMENDED”, “MAY”, and “OPTIONAL” in the normative parts of this document are to be interpreted as described in RFC 2119. However, for readability, these words do not appear in all uppercase letters in this specification.

All of the text of this specification is normative except sections explicitly marked as non-normative, examples, and notes. [\[RFC2119\]](https://www.w3.org/TR/webcodecs-opus-codec-registration/#biblio-rfc2119)

Examples in this specification are introduced with the words “for example” or are set apart from the normative text with `class="example"`, like this:

[](https://www.w3.org/TR/webcodecs-opus-codec-registration/#w3c-example)

This is an example of an informative example.

Informative notes begin with the word “Note” and are set apart from the normative text with `class="note"`, like this:

Note, this is an informative note.

## [Index](https://www.w3.org/TR/webcodecs-opus-codec-registration/#index)

### [Terms defined by this specification](https://www.w3.org/TR/webcodecs-opus-codec-registration/#index-defined-here)

- [application](https://www.w3.org/TR/webcodecs-opus-codec-registration/#dom-opusencoderconfig-application), in § 5.1
- ["audio"](https://www.w3.org/TR/webcodecs-opus-codec-registration/#dom-opusapplication-audio), in § 5.4
- [audio](https://www.w3.org/TR/webcodecs-opus-codec-registration/#dom-opusapplication-audio), in § 5.4
- ["auto"](https://www.w3.org/TR/webcodecs-opus-codec-registration/#dom-opussignal-auto), in § 5.3
- [auto](https://www.w3.org/TR/webcodecs-opus-codec-registration/#dom-opussignal-auto), in § 5.3
- [complexity](https://www.w3.org/TR/webcodecs-opus-codec-registration/#dom-opusencoderconfig-complexity), in § 5.1
- [format](https://www.w3.org/TR/webcodecs-opus-codec-registration/#dom-opusencoderconfig-format), in § 5.1
- [frameDuration](https://www.w3.org/TR/webcodecs-opus-codec-registration/#dom-opusencoderconfig-frameduration), in § 5.1
- ["lowdelay"](https://www.w3.org/TR/webcodecs-opus-codec-registration/#dom-opusapplication-lowdelay), in § 5.4
- [lowdelay](https://www.w3.org/TR/webcodecs-opus-codec-registration/#dom-opusapplication-lowdelay), in § 5.4
- ["music"](https://www.w3.org/TR/webcodecs-opus-codec-registration/#dom-opussignal-music), in § 5.3
- [music](https://www.w3.org/TR/webcodecs-opus-codec-registration/#dom-opussignal-music), in § 5.3
- ["ogg"](https://www.w3.org/TR/webcodecs-opus-codec-registration/#dom-opusbitstreamformat-ogg), in § 5.2
- [ogg](https://www.w3.org/TR/webcodecs-opus-codec-registration/#dom-opusbitstreamformat-ogg), in § 5.2
- ["opus"](https://www.w3.org/TR/webcodecs-opus-codec-registration/#dom-opusbitstreamformat-opus), in § 5.2
- opus
  - [dict-member for AudioEncoderConfig](https://www.w3.org/TR/webcodecs-opus-codec-registration/#dom-audioencoderconfig-opus), in § 5
  - [enum-value for OpusBitstreamFormat](https://www.w3.org/TR/webcodecs-opus-codec-registration/#dom-opusbitstreamformat-opus), in § 5.2
- [OpusApplication](https://www.w3.org/TR/webcodecs-opus-codec-registration/#enumdef-opusapplication), in § 5.4
- [OpusBitstreamFormat](https://www.w3.org/TR/webcodecs-opus-codec-registration/#enumdef-opusbitstreamformat), in § 5.2
- [OpusEncoderConfig](https://www.w3.org/TR/webcodecs-opus-codec-registration/#dictdef-opusencoderconfig), in § 5.1
- [OpusSignal](https://www.w3.org/TR/webcodecs-opus-codec-registration/#enumdef-opussignal), in § 5.3
- [packetlossperc](https://www.w3.org/TR/webcodecs-opus-codec-registration/#dom-opusencoderconfig-packetlossperc), in § 5.1
- [signal](https://www.w3.org/TR/webcodecs-opus-codec-registration/#dom-opusencoderconfig-signal), in § 5.1
- [usedtx](https://www.w3.org/TR/webcodecs-opus-codec-registration/#dom-opusencoderconfig-usedtx), in § 5.1
- [useinbandfec](https://www.w3.org/TR/webcodecs-opus-codec-registration/#dom-opusencoderconfig-useinbandfec), in § 5.1
- ["voice"](https://www.w3.org/TR/webcodecs-opus-codec-registration/#dom-opussignal-voice), in § 5.3
- [voice](https://www.w3.org/TR/webcodecs-opus-codec-registration/#dom-opussignal-voice), in § 5.3
- ["voip"](https://www.w3.org/TR/webcodecs-opus-codec-registration/#dom-opusapplication-voip), in § 5.4
- [voip](https://www.w3.org/TR/webcodecs-opus-codec-registration/#dom-opusapplication-voip), in § 5.4

### [Terms defined by reference](https://www.w3.org/TR/webcodecs-opus-codec-registration/#index-defined-elsewhere)

- \[WEBCODECS\] defines the following terms:
  - "key"
  - AudioEncoderConfig
  - EncodedAudioChunk
  - \[\[internal data\]\]
  - \[\[type\]\]
  - description
- \[WEBIDL\] defines the following terms:
  - EnforceRange
  - boolean
  - unsigned long
  - unsigned long long

## [References](https://www.w3.org/TR/webcodecs-opus-codec-registration/#references)

### [Normative References](https://www.w3.org/TR/webcodecs-opus-codec-registration/#normative)

**\[RFC2119\]**

S. Bradner. [Key words for use in RFCs to Indicate Requirement Levels](https://datatracker.ietf.org/doc/html/rfc2119). March 1997. Best Current Practice. URL: [https://datatracker.ietf.org/doc/html/rfc2119](https://datatracker.ietf.org/doc/html/rfc2119)
**\[WEBCODECS\]**

Paul Adenot; Eugene Zemtsov. [WebCodecs](https://www.w3.org/TR/webcodecs/). 14 May 2025. WD. URL: [https://www.w3.org/TR/webcodecs/](https://www.w3.org/TR/webcodecs/)
**\[WEBIDL\]**

Edgar Chen; Timothy Gu. [Web IDL Standard](https://webidl.spec.whatwg.org/). Living Standard. URL: [https://webidl.spec.whatwg.org/](https://webidl.spec.whatwg.org/)

### [Informative References](https://www.w3.org/TR/webcodecs-opus-codec-registration/#informative)

**\[OPUS\]**

[RFC 6716: Definition of the Opus Audio Codec](https://datatracker.ietf.org/doc/html/rfc6716). September 2012. URL: [https://datatracker.ietf.org/doc/html/rfc6716](https://datatracker.ietf.org/doc/html/rfc6716)
**\[OPUS-IN-OGG\]**

[RFC 7845: Ogg Encapsulation for the Opus Audio Codec](https://datatracker.ietf.org/doc/html/rfc7845). April 2016. URL: [https://datatracker.ietf.org/doc/html/rfc7845](https://datatracker.ietf.org/doc/html/rfc7845)
**\[RFC6716\]**

JM. Valin; K. Vos; T. Terriberry. [Definition of the Opus Audio Codec](https://www.rfc-editor.org/rfc/rfc6716). September 2012. Proposed Standard. URL: [https://www.rfc-editor.org/rfc/rfc6716](https://www.rfc-editor.org/rfc/rfc6716)
**\[WEBCODECS-CODEC-REGISTRY\]**

Paul Adenot; Bernard Aboba. [WebCodecs Codec Registry](https://www.w3.org/TR/webcodecs-codec-registry/). 9 September 2024. DRY. URL: [https://www.w3.org/TR/webcodecs-codec-registry/](https://www.w3.org/TR/webcodecs-codec-registry/)

## [IDL Index](https://www.w3.org/TR/webcodecs-opus-codec-registration/#idl-index)

```webidl
partial dictionary AudioEncoderConfig {
  OpusEncoderConfig opus;
};


dictionary OpusEncoderConfig {
  OpusBitstreamFormat format = "opus";
  OpusSignal signal = "auto";
  OpusApplication application = "audio";
  [EnforceRange] unsigned long long frameDuration = 20000;
  [EnforceRange] unsigned long complexity;
  [EnforceRange] unsigned long packetlossperc = 0;
  boolean useinbandfec = false;
  boolean usedtx = false;
};


enum OpusBitstreamFormat {
  "opus",
  "ogg",
};


enum OpusSignal {
  "auto",
  "music",
  "voice",
};


enum OpusApplication {
  "voip",
  "audio",
  "lowdelay",
};
```

/\* Boilerplate: script-dom-helper \*/ "use strict"; function query(sel) { return document.querySelector(sel); } function queryAll(sel) { return \[...document.querySelectorAll(sel)\]; } function iter(obj) { if(!obj) return \[\]; var it = obj\[Symbol.iterator\]; if(it) return it; return Object.entries(obj); } function mk(tagname, attrs, ...children) { const el = document.createElement(tagname); for(const \[k,v\] of iter(attrs)) { if(k.slice(0,3) == "\_on") { const eventName = k.slice(3); el.addEventListener(eventName, v); } else if(k\[0\] == "\_") { // property, not attribute el\[k.slice(1)\] = v; } else { if(v === false || v == null) { continue; } else if(v === true) { el.setAttribute(k, ""); continue; } else { el.setAttribute(k, v); } } } append(el, children); return el; } /\* Create shortcuts for every known HTML element \*/ \[ "a", "abbr", "acronym", "address", "applet", "area", "article", "aside", "audio", "b", "base", "basefont", "bdo", "big", "blockquote", "body", "br", "button", "canvas", "caption", "center", "cite", "code", "col", "colgroup", "datalist", "dd", "del", "details", "dfn", "dialog", "div", "dl", "dt", "em", "embed", "fieldset", "figcaption", "figure", "font", "footer", "form", "frame", "frameset", "head", "header", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "html", "i", "iframe", "img", "input", "ins", "kbd", "label", "legend", "li", "link", "main", "map", "mark", "meta", "meter", "nav", "nobr", "noscript", "object", "ol", "optgroup", "option", "output", "p", "param", "pre", "progress", "q", "s", "samp", "script", "section", "select", "small", "source", "span", "strike", "strong", "style", "sub", "summary", "sup", "table", "tbody", "td", "template", "textarea", "tfoot", "th", "thead", "time", "title", "tr", "u", "ul", "var", "video", "wbr", "xmp", \].forEach(tagname=>{ mk\[tagname\] = (...args) => mk(tagname, ...args); }); function\* nodesFromChildList(children) { for(const child of children.flat(Infinity)) { if(child instanceof Node) { yield child; } else { yield new Text(child); } } } function append(el, ...children) { for(const child of nodesFromChildList(children)) { if(el instanceof Node) el.appendChild(child); else el.push(child); } return el; } function insertAfter(el, ...children) { for(const child of nodesFromChildList(children)) { el.parentNode.insertBefore(child, el.nextSibling); } return el; } function clearContents(el) { el.innerHTML = ""; return el; } function parseHTML(markup) { if(markup.toLowerCase().trim().indexOf('<!doctype') === 0) { const doc = document.implementation.createHTMLDocument(""); doc.documentElement.innerHTML = markup; return doc; } else { const el = mk.template({}); el.innerHTML = markup; return el.content; } } /\* Boilerplate: script-dfn-panel \*/ "use strict"; { let dfnPanelData = { "3e400611": {"dfnID":"3e400611","dfnText":"EncodedAudioChunk","external":true,"refSections":\[{"refs":\[{"id":"ref-for-encodedaudiochunk"},{"id":"ref-for-encodedaudiochunk\\u2460"}\],"title":"Unnumbered Section"},{"refs":\[{"id":"ref-for-encodedaudiochunk\\u2461"},{"id":"ref-for-encodedaudiochunk\\u2462"},{"id":"ref-for-encodedaudiochunk\\u2463"}\],"title":"2. EncodedAudioChunk data"},{"refs":\[{"id":"ref-for-encodedaudiochunk\\u2464"}\],"title":"4. EncodedAudioChunk type"},{"refs":\[{"id":"ref-for-encodedaudiochunk\\u2465"},{"id":"ref-for-encodedaudiochunk\\u2466"}\],"title":"5.1. OpusEncoderConfig"}\],"url":"https://www.w3.org/TR/webcodecs/#encodedaudiochunk"}, "5372cca8": {"dfnID":"5372cca8","dfnText":"boolean","external":true,"refSections":\[{"refs":\[{"id":"ref-for-idl-boolean"},{"id":"ref-for-idl-boolean\\u2460"},{"id":"ref-for-idl-boolean\\u2461"},{"id":"ref-for-idl-boolean\\u2462"}\],"title":"5.1. OpusEncoderConfig"}\],"url":"https://webidl.spec.whatwg.org/#idl-boolean"}, "65dc4f12": {"dfnID":"65dc4f12","dfnText":"\[\[type\]\]","external":true,"refSections":\[{"refs":\[{"id":"ref-for-dom-encodedaudiochunk-type-slot"}\],"title":"Unnumbered Section"},{"refs":\[{"id":"ref-for-dom-encodedaudiochunk-type-slot\\u2460"}\],"title":"4. EncodedAudioChunk type"}\],"url":"https://www.w3.org/TR/webcodecs/#dom-encodedaudiochunk-type-slot"}, "73685fdd": {"dfnID":"73685fdd","dfnText":"description","external":true,"refSections":\[{"refs":\[{"id":"ref-for-dom-audiodecoderconfig-description"}\],"title":"Unnumbered Section"},{"refs":\[{"id":"ref-for-dom-audiodecoderconfig-description\\u2460"},{"id":"ref-for-dom-audiodecoderconfig-description\\u2461"},{"id":"ref-for-dom-audiodecoderconfig-description\\u2462"}\],"title":"3. AudioDecoderConfig description"},{"refs":\[{"id":"ref-for-dom-audiodecoderconfig-description\\u2463"}\],"title":"5.2. OpusBitstreamFormat"}\],"url":"https://www.w3.org/TR/webcodecs/#dom-audiodecoderconfig-description"}, "7405dd40": {"dfnID":"7405dd40","dfnText":"\[\[internal data\]\]","external":true,"refSections":\[{"refs":\[{"id":"ref-for-dom-encodedaudiochunk-internal-data-slot"}\],"title":"Unnumbered Section"}\],"url":"https://www.w3.org/TR/webcodecs/#dom-encodedaudiochunk-internal-data-slot"}, "94a945f4": {"dfnID":"94a945f4","dfnText":"AudioEncoderConfig","external":true,"refSections":\[{"refs":\[{"id":"ref-for-dictdef-audioencoderconfig"}\],"title":"Unnumbered Section"},{"refs":\[{"id":"ref-for-dictdef-audioencoderconfig\\u2460"}\],"title":"5. AudioEncoderConfig extensions"}\],"url":"https://www.w3.org/TR/webcodecs/#dictdef-audioencoderconfig"}, "c01cbda0": {"dfnID":"c01cbda0","dfnText":"EnforceRange","external":true,"refSections":\[{"refs":\[{"id":"ref-for-EnforceRange"},{"id":"ref-for-EnforceRange\\u2460"},{"id":"ref-for-EnforceRange\\u2461"}\],"title":"5.1. OpusEncoderConfig"}\],"url":"https://webidl.spec.whatwg.org/#EnforceRange"}, "c30731e3": {"dfnID":"c30731e3","dfnText":"\\"key\\"","external":true,"refSections":\[{"refs":\[{"id":"ref-for-dom-encodedaudiochunktype-key"}\],"title":"4. EncodedAudioChunk type"}\],"url":"https://www.w3.org/TR/webcodecs/#dom-encodedaudiochunktype-key"}, "dictdef-opusencoderconfig": {"dfnID":"dictdef-opusencoderconfig","dfnText":"OpusEncoderConfig","external":false,"refSections":\[{"refs":\[{"id":"ref-for-dictdef-opusencoderconfig"},{"id":"ref-for-dictdef-opusencoderconfig\\u2460"}\],"title":"5. AudioEncoderConfig extensions"},{"refs":\[{"id":"ref-for-dictdef-opusencoderconfig\\u2461"}\],"title":"5.1. OpusEncoderConfig"}\],"url":"#dictdef-opusencoderconfig"}, "dom-audioencoderconfig-opus": {"dfnID":"dom-audioencoderconfig-opus","dfnText":"opus","external":false,"refSections":\[{"refs":\[{"id":"ref-for-dom-audioencoderconfig-opus"}\],"title":"5. AudioEncoderConfig extensions"}\],"url":"#dom-audioencoderconfig-opus"}, "dom-opusapplication-audio": {"dfnID":"dom-opusapplication-audio","dfnText":"audio","external":false,"refSections":\[{"refs":\[{"id":"ref-for-dom-opusapplication-audio"}\],"title":"5.4. OpusApplication"}\],"url":"#dom-opusapplication-audio"}, "dom-opusapplication-lowdelay": {"dfnID":"dom-opusapplication-lowdelay","dfnText":"lowdelay","external":false,"refSections":\[{"refs":\[{"id":"ref-for-dom-opusapplication-lowdelay"}\],"title":"5.4. OpusApplication"}\],"url":"#dom-opusapplication-lowdelay"}, "dom-opusapplication-voip": {"dfnID":"dom-opusapplication-voip","dfnText":"voip","external":false,"refSections":\[{"refs":\[{"id":"ref-for-dom-opusapplication-voip"}\],"title":"5.4. OpusApplication"}\],"url":"#dom-opusapplication-voip"}, "dom-opusbitstreamformat-ogg": {"dfnID":"dom-opusbitstreamformat-ogg","dfnText":"ogg","external":false,"refSections":\[{"refs":\[{"id":"ref-for-dom-opusbitstreamformat-ogg"}\],"title":"2. EncodedAudioChunk data"},{"refs":\[{"id":"ref-for-dom-opusbitstreamformat-ogg\\u2460"}\],"title":"3. AudioDecoderConfig description"},{"refs":\[{"id":"ref-for-dom-opusbitstreamformat-ogg\\u2461"}\],"title":"5.2. OpusBitstreamFormat"}\],"url":"#dom-opusbitstreamformat-ogg"}, "dom-opusbitstreamformat-opus": {"dfnID":"dom-opusbitstreamformat-opus","dfnText":"opus","external":false,"refSections":\[{"refs":\[{"id":"ref-for-dom-opusbitstreamformat-opus"}\],"title":"2. EncodedAudioChunk data"},{"refs":\[{"id":"ref-for-dom-opusbitstreamformat-opus\\u2460"}\],"title":"3. AudioDecoderConfig description"},{"refs":\[{"id":"ref-for-dom-opusbitstreamformat-opus\\u2461"}\],"title":"5.2. OpusBitstreamFormat"}\],"url":"#dom-opusbitstreamformat-opus"}, "dom-opusencoderconfig-application": {"dfnID":"dom-opusencoderconfig-application","dfnText":"application","external":false,"refSections":\[{"refs":\[{"id":"ref-for-dom-opusencoderconfig-application"}\],"title":"5.1. OpusEncoderConfig"}\],"url":"#dom-opusencoderconfig-application"}, "dom-opusencoderconfig-complexity": {"dfnID":"dom-opusencoderconfig-complexity","dfnText":"complexity","external":false,"refSections":\[{"refs":\[{"id":"ref-for-dom-opusencoderconfig-complexity"},{"id":"ref-for-dom-opusencoderconfig-complexity\\u2460"}\],"title":"5.1. OpusEncoderConfig"}\],"url":"#dom-opusencoderconfig-complexity"}, "dom-opusencoderconfig-format": {"dfnID":"dom-opusencoderconfig-format","dfnText":"format","external":false,"refSections":\[{"refs":\[{"id":"ref-for-dom-opusencoderconfig-format"}\],"title":"5.1. OpusEncoderConfig"}\],"url":"#dom-opusencoderconfig-format"}, "dom-opusencoderconfig-frameduration": {"dfnID":"dom-opusencoderconfig-frameduration","dfnText":"frameDuration","external":false,"refSections":\[{"refs":\[{"id":"ref-for-dom-opusencoderconfig-frameduration"},{"id":"ref-for-dom-opusencoderconfig-frameduration\\u2460"}\],"title":"5.1. OpusEncoderConfig"}\],"url":"#dom-opusencoderconfig-frameduration"}, "dom-opusencoderconfig-packetlossperc": {"dfnID":"dom-opusencoderconfig-packetlossperc","dfnText":"packetlossperc","external":false,"refSections":\[{"refs":\[{"id":"ref-for-dom-opusencoderconfig-packetlossperc"},{"id":"ref-for-dom-opusencoderconfig-packetlossperc\\u2460"}\],"title":"5.1. OpusEncoderConfig"}\],"url":"#dom-opusencoderconfig-packetlossperc"}, "dom-opusencoderconfig-signal": {"dfnID":"dom-opusencoderconfig-signal","dfnText":"signal","external":false,"refSections":\[{"refs":\[{"id":"ref-for-dom-opusencoderconfig-signal"}\],"title":"5.1. OpusEncoderConfig"}\],"url":"#dom-opusencoderconfig-signal"}, "dom-opusencoderconfig-usedtx": {"dfnID":"dom-opusencoderconfig-usedtx","dfnText":"usedtx","external":false,"refSections":\[{"refs":\[{"id":"ref-for-dom-opusencoderconfig-usedtx"}\],"title":"5.1. OpusEncoderConfig"}\],"url":"#dom-opusencoderconfig-usedtx"}, "dom-opusencoderconfig-useinbandfec": {"dfnID":"dom-opusencoderconfig-useinbandfec","dfnText":"useinbandfec","external":false,"refSections":\[{"refs":\[{"id":"ref-for-dom-opusencoderconfig-useinbandfec"}\],"title":"5.1. OpusEncoderConfig"}\],"url":"#dom-opusencoderconfig-useinbandfec"}, "dom-opussignal-auto": {"dfnID":"dom-opussignal-auto","dfnText":"auto","external":false,"refSections":\[{"refs":\[{"id":"ref-for-dom-opussignal-auto"}\],"title":"5.3. OpusSignal"}\],"url":"#dom-opussignal-auto"}, "dom-opussignal-music": {"dfnID":"dom-opussignal-music","dfnText":"music","external":false,"refSections":\[{"refs":\[{"id":"ref-for-dom-opussignal-music"}\],"title":"5.3. OpusSignal"}\],"url":"#dom-opussignal-music"}, "dom-opussignal-voice": {"dfnID":"dom-opussignal-voice","dfnText":"voice","external":false,"refSections":\[{"refs":\[{"id":"ref-for-dom-opussignal-voice"}\],"title":"5.3. OpusSignal"}\],"url":"#dom-opussignal-voice"}, "e97a9688": {"dfnID":"e97a9688","dfnText":"unsigned long","external":true,"refSections":\[{"refs":\[{"id":"ref-for-idl-unsigned-long"},{"id":"ref-for-idl-unsigned-long\\u2460"},{"id":"ref-for-idl-unsigned-long\\u2461"},{"id":"ref-for-idl-unsigned-long\\u2462"}\],"title":"5.1. OpusEncoderConfig"}\],"url":"https://webidl.spec.whatwg.org/#idl-unsigned-long"}, "enumdef-opusapplication": {"dfnID":"enumdef-opusapplication","dfnText":"OpusApplication","external":false,"refSections":\[{"refs":\[{"id":"ref-for-enumdef-opusapplication"},{"id":"ref-for-enumdef-opusapplication\\u2460"},{"id":"ref-for-enumdef-opusapplication\\u2461"}\],"title":"5.1. OpusEncoderConfig"},{"refs":\[{"id":"ref-for-enumdef-opusapplication\\u2462"}\],"title":"5.4. OpusApplication"}\],"url":"#enumdef-opusapplication"}, "enumdef-opusbitstreamformat": {"dfnID":"enumdef-opusbitstreamformat","dfnText":"OpusBitstreamFormat","external":false,"refSections":\[{"refs":\[{"id":"ref-for-enumdef-opusbitstreamformat"},{"id":"ref-for-enumdef-opusbitstreamformat\\u2460"},{"id":"ref-for-enumdef-opusbitstreamformat\\u2461"}\],"title":"5.1. OpusEncoderConfig"},{"refs":\[{"id":"ref-for-enumdef-opusbitstreamformat\\u2462"}\],"title":"5.2. OpusBitstreamFormat"}\],"url":"#enumdef-opusbitstreamformat"}, "enumdef-opussignal": {"dfnID":"enumdef-opussignal","dfnText":"OpusSignal","external":false,"refSections":\[{"refs":\[{"id":"ref-for-enumdef-opussignal"},{"id":"ref-for-enumdef-opussignal\\u2460"},{"id":"ref-for-enumdef-opussignal\\u2461"}\],"title":"5.1. OpusEncoderConfig"},{"refs":\[{"id":"ref-for-enumdef-opussignal\\u2462"}\],"title":"5.3. OpusSignal"}\],"url":"#enumdef-opussignal"}, "f14b47b8": {"dfnID":"f14b47b8","dfnText":"unsigned long long","external":true,"refSections":\[{"refs":\[{"id":"ref-for-idl-unsigned-long-long"},{"id":"ref-for-idl-unsigned-long-long\\u2460"}\],"title":"5.1. OpusEncoderConfig"}\],"url":"https://webidl.spec.whatwg.org/#idl-unsigned-long-long"}, }; document.addEventListener("DOMContentLoaded", ()=>{ genAllDfnPanels(); document.body.addEventListener("click", (e) => { // If not handled already, just hide all dfn panels. hideAllDfnPanels(); }); }); window.addEventListener("resize", () => { // Pin any visible dfn panel queryAll(".dfn-panel.on, .dfn-panel.activated").forEach(el=>positionDfnPanel(el)); }); function genAllDfnPanels() { for(const panelData of Object.values(dfnPanelData)) { const dfnID = panelData.dfnID; const dfn = document.getElementById(dfnID); if(!dfn) { console.log(\`Can't find dfn#${dfnID}.\`, panelData); continue; } dfn.panelData = panelData; insertDfnPopupAction(dfn); } } function genDfnPanel(dfn, { dfnID, url, dfnText, refSections, external }) { const dfnPanel = mk.aside({ class: "dfn-panel on", id: \`infopanel-for-${dfnID}\`, "data-for": dfnID, "aria-labelled-by":\`infopaneltitle-for-${dfnID}\`, }, mk.span({id:\`infopaneltitle-for-${dfnID}\`, style:"display:none"}, \`Info about the '${dfnText}' ${external?"external":""} reference.\`), mk.a({href:url, class:"dfn-link"}, url), refSections.length == 0 ? \[\] : mk.b({}, "Referenced in:"), mk.ul({}, ...refSections.map(section=> mk.li({}, ...section.refs.map((ref, refI)=> \[ mk.a({ href: \`#${ref.id}\` }, (refI == 0) ? section.title : \`(${refI + 1})\` ), " ", \] ), ), ), ), genLinkingSyntaxes(dfn), ); dfnPanel.addEventListener('click', (event) => { if (event.target.nodeName == 'A') { scrollToTargetAndHighlight(event); pinDfnPanel(dfnPanel); } event.stopPropagation(); refocusOnTarget(event); }); dfnPanel.addEventListener('keydown', (event) => { if(event.keyCode == 27) { // Escape key hideDfnPanel({dfnPanel}); event.stopPropagation(); event.preventDefault(); } }); dfnPanel.dfn = dfn; dfn.dfnPanel = dfnPanel; return dfnPanel; } function hideAllDfnPanels() { // Delete the currently-active dfn panel. queryAll(".dfn-panel").forEach(dfnPanel=>hideDfnPanel({dfnPanel})); } function showDfnPanel(dfn) { hideAllDfnPanels(); // Only display one at a time. dfn.setAttribute("aria-expanded", "true"); const dfnPanel = genDfnPanel(dfn, dfn.panelData); // Give the dfn a unique tabindex, and then // give all the tabbable panel bits successive indexes. let tabIndex = 100; dfn.tabIndex = tabIndex++; const tabbable = dfnPanel.querySelectorAll(":is(a, button)"); for (const el of tabbable) { el.tabIndex = tabIndex++; } append(document.body, dfnPanel); positionDfnPanel(dfnPanel); } function positionDfnPanel(dfnPanel) { const dfn = dfnPanel.dfn; const dfnPos = getBounds(dfn); dfnPanel.style.top = dfnPos.bottom + "px"; dfnPanel.style.left = dfnPos.left + "px"; const panelPos = dfnPanel.getBoundingClientRect(); const panelMargin = 8; const maxRight = document.body.parentNode.clientWidth - panelMargin; if (panelPos.right > maxRight) { const overflowAmount = panelPos.right - maxRight; const newLeft = Math.max(panelMargin, dfnPos.left - overflowAmount); dfnPanel.style.left = newLeft + "px"; } } function pinDfnPanel(dfnPanel) { // Switch it to "activated" state, which pins it. dfnPanel.classList.add("activated"); dfnPanel.style.position = "fixed"; dfnPanel.style.left = null; dfnPanel.style.top = null; } function hideDfnPanel({dfn, dfnPanel}) { if(!dfnPanel) dfnPanel = dfn.dfnPanel; if(!dfn) dfn = dfnPanel.dfn; dfn.dfnPanel = undefined; dfnPanel.dfn = undefined; dfn.setAttribute("aria-expanded", "false"); dfn.tabIndex = undefined; dfnPanel.remove() } function toggleDfnPanel(dfn) { if(dfn.dfnPanel) { hideDfnPanel(dfn); } else { showDfnPanel(dfn); } } function insertDfnPopupAction(dfn) { dfn.setAttribute('role', 'button'); dfn.setAttribute('aria-expanded', 'false') dfn.tabIndex = 0; dfn.classList.add('has-dfn-panel'); dfn.addEventListener('click', (event) => { toggleDfnPanel(dfn); event.stopPropagation(); }); dfn.addEventListener('keypress', (event) => { const kc = event.keyCode; // 32->Space, 13->Enter if(kc == 32 || kc == 13) { toggleDfnPanel(dfn); event.stopPropagation(); event.preventDefault(); } }); } function refocusOnTarget(event) { const target = event.target; setTimeout(() => { // Refocus on the event.target element. // This is needed after browser scrolls to the destination. target.focus(); }); } // TODO: shared util // Returns the root-level absolute position {left and top} of element. function getBounds(el, relativeTo=document.body) { const relativeRect = relativeTo.getBoundingClientRect(); const elRect = el.getBoundingClientRect(); const top = elRect.top - relativeRect.top; const left = elRect.left - relativeRect.left; return { top, left, bottom: top + elRect.height, right: left + elRect.width, } } function scrollToTargetAndHighlight(event) { let hash = event.target.hash; if (hash) { hash = decodeURIComponent(hash.substring(1)); const dest = document.getElementById(hash); if (dest) { dest.classList.add('highlighted'); setTimeout(() => dest.classList.remove('highlighted'), 1000); } } } // Functions, divided by link type, that wrap an autolink's // contents with the appropriate outer syntax. // Alternately, a string naming another type they format // the same as. function needsFor(type) { switch(type) { case "descriptor": case "value": case "element-attr": case "attr-value": case "element-state": case "method": case "constructor": case "argument": case "attribute": case "const": case "dict-member": case "event": case "enum-value": case "stringifier": case "serializer": case "iterator": case "maplike": case "setlike": case "state": case "mode": case "context": case "facet": return true; default: return false; } } function refusesFor(type) { switch(type) { case "property": case "element": case "interface": case "namespace": case "callback": case "dictionary": case "enum": case "exception": case "typedef": case "http-header": case "permission": return true; default: return false; } } function linkFormatterFromType(type) { switch(type) { case 'scheme': case 'permission': case 'dfn': return (text) => \`\[=${text}=\]\`; case 'abstract-op': return (text) => \`\[\\$${text}\\$\]\`; case 'function': case 'at-rule': case 'selector': case 'value': return (text) => \`''${text}''\`; case 'http-header': return (text) => \`\[:${text}:\]\`; case 'interface': case 'constructor': case 'method': case 'argument': case 'attribute': case 'callback': case 'dictionary': case 'dict-member': case 'enum': case 'enum-value': case 'exception': case 'const': case 'typedef': case 'stringifier': case 'serializer': case 'iterator': case 'maplike': case 'setlike': case 'extended-attribute': case 'event': case 'idl': return (text) => \`{{${text}}}\`; case 'element-state': case 'element-attr': case 'attr-value': case 'element': return (element) => \`<{${element}}>\`; case 'grammar': return (text) => \`${text} (within a <pre class=prod>)\`; case 'type': return (text)=> \`<<${text}>>\`; case 'descriptor': case 'property': return (text) => \`'${text}'\`; default: return; }; }; function genLinkingSyntaxes(dfn) { if(dfn.tagName != "DFN") return; const type = dfn.getAttribute('data-dfn-type'); if(!type) { console.log(\`<dfn> doesn't have a data-dfn-type:\`, dfn); return \[\]; } // Return a function that wraps link text based on the type const linkFormatter = linkFormatterFromType(type); if(!linkFormatter) { console.log(\`<dfn> has an unknown data-dfn-type:\`, dfn); return \[\]; } let ltAlts; if(dfn.hasAttribute('data-lt')) { ltAlts = dfn.getAttribute('data-lt') .split("|") .map(x=>x.trim()); } else { ltAlts = \[dfn.textContent.trim()\]; } if(type == "type") { // lt of "<foo>", but "foo" is the interior; // <<foo/bar>> is how you write it with a for, // not <foo/<bar>> or whatever. for(var i = 0; i < ltAlts.length; i++) { const lt = ltAlts\[i\]; const match = /<(.\*)>/.exec(lt); if(match) { ltAlts\[i\] = match\[1\]; } } } let forAlts; if(dfn.hasAttribute('data-dfn-for')) { forAlts = dfn.getAttribute('data-dfn-for') .split(",") .map(x=>x.trim()); } else { forAlts = \[''\]; } let linkingSyntaxes = \[\]; if(!needsFor(type)) { for(const lt of ltAlts) { linkingSyntaxes.push(linkFormatter(lt)); } } if(!refusesFor(type)) { for(const f of forAlts) { linkingSyntaxes.push(linkFormatter(\`${f}/${ltAlts\[0\]}\`)) } } return \[ mk.b({}, 'Possible linking syntaxes:'), mk.ul({}, ...linkingSyntaxes.map(link => { const copyLink = async () => await navigator.clipboard.writeText(link); return mk.li({}, mk.div({ class: 'link-item' }, mk.button({ class: 'copy-icon', title: 'Copy', type: 'button', \_onclick: copyLink, tabindex: 0, }, mk.span({ class: 'icon' }) ), mk.span({}, link) ) ); }) ) \]; } } /\* Boilerplate: script-ref-hints \*/ "use strict"; { let refsData = { "#dictdef-opusencoderconfig": {"displayText":"OpusEncoderConfig","export":true,"for\_":\[\],"level":"","normative":true,"shortname":"webcodecs-opus-codec-registration","spec":"webcodecs-opus-codec-registration","status":"local","text":"OpusEncoderConfig","type":"dictionary","url":"#dictdef-opusencoderconfig"}, "#dom-audioencoderconfig-opus": {"displayText":"opus","export":true,"for\_":\["AudioEncoderConfig"\],"level":"","normative":true,"shortname":"webcodecs-opus-codec-registration","spec":"webcodecs-opus-codec-registration","status":"local","text":"opus","type":"dict-member","url":"#dom-audioencoderconfig-opus"}, "#dom-opusapplication-audio": {"displayText":"\\"audio\\"","export":true,"for\_":\["OpusApplication"\],"level":"","normative":true,"shortname":"webcodecs-opus-codec-registration","spec":"webcodecs-opus-codec-registration","status":"local","text":"\\"audio\\"","type":"enum-value","url":"#dom-opusapplication-audio"}, "#dom-opusapplication-lowdelay": {"displayText":"\\"lowdelay\\"","export":true,"for\_":\["OpusApplication"\],"level":"","normative":true,"shortname":"webcodecs-opus-codec-registration","spec":"webcodecs-opus-codec-registration","status":"local","text":"\\"lowdelay\\"","type":"enum-value","url":"#dom-opusapplication-lowdelay"}, "#dom-opusapplication-voip": {"displayText":"\\"voip\\"","export":true,"for\_":\["OpusApplication"\],"level":"","normative":true,"shortname":"webcodecs-opus-codec-registration","spec":"webcodecs-opus-codec-registration","status":"local","text":"\\"voip\\"","type":"enum-value","url":"#dom-opusapplication-voip"}, "#dom-opusbitstreamformat-ogg": {"displayText":"ogg","export":true,"for\_":\["OpusBitstreamFormat"\],"level":"","normative":true,"shortname":"webcodecs-opus-codec-registration","spec":"webcodecs-opus-codec-registration","status":"local","text":"ogg","type":"enum-value","url":"#dom-opusbitstreamformat-ogg"}, "#dom-opusbitstreamformat-opus": {"displayText":"opus","export":true,"for\_":\["OpusBitstreamFormat"\],"level":"","normative":true,"shortname":"webcodecs-opus-codec-registration","spec":"webcodecs-opus-codec-registration","status":"local","text":"opus","type":"enum-value","url":"#dom-opusbitstreamformat-opus"}, "#dom-opusencoderconfig-application": {"displayText":"application","export":true,"for\_":\["OpusEncoderConfig"\],"level":"","normative":true,"shortname":"webcodecs-opus-codec-registration","spec":"webcodecs-opus-codec-registration","status":"local","text":"application","type":"dict-member","url":"#dom-opusencoderconfig-application"}, "#dom-opusencoderconfig-complexity": {"displayText":"complexity","export":true,"for\_":\["OpusEncoderConfig"\],"level":"","normative":true,"shortname":"webcodecs-opus-codec-registration","spec":"webcodecs-opus-codec-registration","status":"local","text":"complexity","type":"dict-member","url":"#dom-opusencoderconfig-complexity"}, "#dom-opusencoderconfig-format": {"displayText":"format","export":true,"for\_":\["OpusEncoderConfig"\],"level":"","normative":true,"shortname":"webcodecs-opus-codec-registration","spec":"webcodecs-opus-codec-registration","status":"local","text":"format","type":"dict-member","url":"#dom-opusencoderconfig-format"}, "#dom-opusencoderconfig-frameduration": {"displayText":"frameDuration","export":true,"for\_":\["OpusEncoderConfig"\],"level":"","normative":true,"shortname":"webcodecs-opus-codec-registration","spec":"webcodecs-opus-codec-registration","status":"local","text":"frameDuration","type":"dict-member","url":"#dom-opusencoderconfig-frameduration"}, "#dom-opusencoderconfig-packetlossperc": {"displayText":"packetlossperc","export":true,"for\_":\["OpusEncoderConfig"\],"level":"","normative":true,"shortname":"webcodecs-opus-codec-registration","spec":"webcodecs-opus-codec-registration","status":"local","text":"packetlossperc","type":"dict-member","url":"#dom-opusencoderconfig-packetlossperc"}, "#dom-opusencoderconfig-signal": {"displayText":"signal","export":true,"for\_":\["OpusEncoderConfig"\],"level":"","normative":true,"shortname":"webcodecs-opus-codec-registration","spec":"webcodecs-opus-codec-registration","status":"local","text":"signal","type":"dict-member","url":"#dom-opusencoderconfig-signal"}, "#dom-opusencoderconfig-usedtx": {"displayText":"usedtx","export":true,"for\_":\["OpusEncoderConfig"\],"level":"","normative":true,"shortname":"webcodecs-opus-codec-registration","spec":"webcodecs-opus-codec-registration","status":"local","text":"usedtx","type":"dict-member","url":"#dom-opusencoderconfig-usedtx"}, "#dom-opusencoderconfig-useinbandfec": {"displayText":"useinbandfec","export":true,"for\_":\["OpusEncoderConfig"\],"level":"","normative":true,"shortname":"webcodecs-opus-codec-registration","spec":"webcodecs-opus-codec-registration","status":"local","text":"useinbandfec","type":"dict-member","url":"#dom-opusencoderconfig-useinbandfec"}, "#dom-opussignal-auto": {"displayText":"\\"auto\\"","export":true,"for\_":\["OpusSignal"\],"level":"","normative":true,"shortname":"webcodecs-opus-codec-registration","spec":"webcodecs-opus-codec-registration","status":"local","text":"\\"auto\\"","type":"enum-value","url":"#dom-opussignal-auto"}, "#dom-opussignal-music": {"displayText":"\\"music\\"","export":true,"for\_":\["OpusSignal"\],"level":"","normative":true,"shortname":"webcodecs-opus-codec-registration","spec":"webcodecs-opus-codec-registration","status":"local","text":"\\"music\\"","type":"enum-value","url":"#dom-opussignal-music"}, "#dom-opussignal-voice": {"displayText":"\\"voice\\"","export":true,"for\_":\["OpusSignal"\],"level":"","normative":true,"shortname":"webcodecs-opus-codec-registration","spec":"webcodecs-opus-codec-registration","status":"local","text":"\\"voice\\"","type":"enum-value","url":"#dom-opussignal-voice"}, "#enumdef-opusapplication": {"displayText":"OpusApplication","export":true,"for\_":\[\],"level":"","normative":true,"shortname":"webcodecs-opus-codec-registration","spec":"webcodecs-opus-codec-registration","status":"local","text":"OpusApplication","type":"enum","url":"#enumdef-opusapplication"}, "#enumdef-opusbitstreamformat": {"displayText":"OpusBitstreamFormat","export":true,"for\_":\[\],"level":"","normative":true,"shortname":"webcodecs-opus-codec-registration","spec":"webcodecs-opus-codec-registration","status":"local","text":"OpusBitstreamFormat","type":"enum","url":"#enumdef-opusbitstreamformat"}, "#enumdef-opussignal": {"displayText":"OpusSignal","export":true,"for\_":\[\],"level":"","normative":true,"shortname":"webcodecs-opus-codec-registration","spec":"webcodecs-opus-codec-registration","status":"local","text":"OpusSignal","type":"enum","url":"#enumdef-opussignal"}, "https://webidl.spec.whatwg.org/#EnforceRange": {"displayText":"EnforceRange","export":true,"for\_":\[\],"level":"1","normative":true,"shortname":"webidl","spec":"webidl","status":"current","text":"EnforceRange","type":"extended-attribute","url":"https://webidl.spec.whatwg.org/#EnforceRange"}, "https://webidl.spec.whatwg.org/#idl-boolean": {"displayText":"boolean","export":true,"for\_":\[\],"level":"1","normative":true,"shortname":"webidl","spec":"webidl","status":"current","text":"boolean","type":"interface","url":"https://webidl.spec.whatwg.org/#idl-boolean"}, "https://webidl.spec.whatwg.org/#idl-unsigned-long": {"displayText":"unsigned long","export":true,"for\_":\[\],"level":"1","normative":true,"shortname":"webidl","spec":"webidl","status":"current","text":"unsigned long","type":"interface","url":"https://webidl.spec.whatwg.org/#idl-unsigned-long"}, "https://webidl.spec.whatwg.org/#idl-unsigned-long-long": {"displayText":"unsigned long long","export":true,"for\_":\[\],"level":"1","normative":true,"shortname":"webidl","spec":"webidl","status":"current","text":"unsigned long long","type":"interface","url":"https://webidl.spec.whatwg.org/#idl-unsigned-long-long"}, "https://www.w3.org/TR/webcodecs/#dictdef-audioencoderconfig": {"displayText":"AudioEncoderConfig","export":true,"for\_":\[\],"level":"1","normative":true,"shortname":"webcodecs","spec":"webcodecs","status":"snapshot","text":"AudioEncoderConfig","type":"dictionary","url":"https://www.w3.org/TR/webcodecs/#dictdef-audioencoderconfig"}, "https://www.w3.org/TR/webcodecs/#dom-audiodecoderconfig-description": {"displayText":"description","export":true,"for\_":\["AudioDecoderConfig"\],"level":"1","normative":true,"shortname":"webcodecs","spec":"webcodecs","status":"snapshot","text":"description","type":"dict-member","url":"https://www.w3.org/TR/webcodecs/#dom-audiodecoderconfig-description"}, "https://www.w3.org/TR/webcodecs/#dom-encodedaudiochunk-internal-data-slot": {"displayText":"\[\[internal data\]\]","export":true,"for\_":\["EncodedAudioChunk"\],"level":"1","normative":true,"shortname":"webcodecs","spec":"webcodecs","status":"snapshot","text":"\[\[internal data\]\]","type":"attribute","url":"https://www.w3.org/TR/webcodecs/#dom-encodedaudiochunk-internal-data-slot"}, "https://www.w3.org/TR/webcodecs/#dom-encodedaudiochunk-type-slot": {"displayText":"\[\[type\]\]","export":true,"for\_":\["EncodedAudioChunk"\],"level":"1","normative":true,"shortname":"webcodecs","spec":"webcodecs","status":"snapshot","text":"\[\[type\]\]","type":"attribute","url":"https://www.w3.org/TR/webcodecs/#dom-encodedaudiochunk-type-slot"}, "https://www.w3.org/TR/webcodecs/#dom-encodedaudiochunktype-key": {"displayText":"\\"key\\"","export":true,"for\_":\["EncodedAudioChunkType"\],"level":"1","normative":true,"shortname":"webcodecs","spec":"webcodecs","status":"snapshot","text":"\\"key\\"","type":"enum-value","url":"https://www.w3.org/TR/webcodecs/#dom-encodedaudiochunktype-key"}, "https://www.w3.org/TR/webcodecs/#encodedaudiochunk": {"displayText":"EncodedAudioChunk","export":true,"for\_":\[\],"level":"1","normative":true,"shortname":"webcodecs","spec":"webcodecs","status":"snapshot","text":"EncodedAudioChunk","type":"interface","url":"https://www.w3.org/TR/webcodecs/#encodedaudiochunk"}, }; function mkRefHint(link, ref) { const linkText = link.textContent; let dfnTextElements = ''; if (ref.displayText.toLowerCase() != linkText.toLowerCase()) { // Give the original term if it's being displayed in a different way. // But allow casing differences, they're insignificant. dfnTextElements = mk.li({}, mk.b({}, "Term: "), mk.span({}, ref.displayText) ); } const forList = ref.for\_; let forListElements; if(forList.length == 0) { forListElements = \[\]; } else if(forList.length == 1) { forListElements = mk.li({}, mk.b({}, "For: "), mk.span({}, forList\[0\]), ); } else { forListElements = mk.li({}, mk.b({}, "For: "), mk.ul({}, ...forList.map(forItem => mk.li({}, mk.span({}, forItem) ), ), ), ); } const url = ref.url; const safeUrl = encodeURIComponent(url); const hintPanel = mk.aside({ class: "ref-hint", id: \`ref-hint-for-${safeUrl}\`, "data-for": url, "aria-labelled-by": \`ref-hint-for-${safeUrl}\`, }, mk.ul({}, dfnTextElements, mk.li({}, mk.b({}, "URL: "), mk.a({ href: url, class: "ref" }, url), ), mk.li({}, mk.b({}, "Type: "), mk.span({}, \`${ref.type}\`), ), mk.li({}, mk.b({}, "Spec: "), mk.span({}, \`${ref.spec ? ref.spec : ''}\`), ), forListElements ), ); hintPanel.forLink = link; setupRefHintEventListeners(link, hintPanel); return hintPanel; } function hideAllRefHints() { queryAll(".ref-hint").forEach(el=>hideRefHint(el)); } function hideRefHint(refHint) { const link = refHint.forLink; link.setAttribute("aria-expanded", "false"); if(refHint.teardownEventListeners) { refHint.teardownEventListeners(); } refHint.remove(); } function showRefHint(link) { if(link.classList.contains("dfn-link")) return; const url = link.getAttribute("href"); const refHintKey = link.getAttribute("data-refhint-key"); let key = url; if(refHintKey) { key = refHintKey + "\_" + url; } const ref = refsData\[key\]; if(!ref) return; hideAllRefHints(); // Only display one at this time. const refHint = mkRefHint(link, ref); append(document.body, refHint); link.setAttribute("aria-expanded", "true"); positionRefHint(refHint); } function setupRefHintEventListeners(link, refHint) { if (refHint.teardownEventListeners) return; // Add event handlers to hide the refHint after the user moves away // from both the link and refHint, if not hovering either within one second. let timeout = null; const startHidingRefHint = (event) => { if (timeout) { clearTimeout(timeout); } timeout = setTimeout(() => { hideRefHint(refHint); }, 1000); } const resetHidingRefHint = (event) => { if (timeout) clearTimeout(timeout); timeout = null; }; link.addEventListener("mouseleave", startHidingRefHint); link.addEventListener("mouseenter", resetHidingRefHint); link.addEventListener("blur", startHidingRefHint); link.addEventListener("focus", resetHidingRefHint); refHint.addEventListener("mouseleave", startHidingRefHint); refHint.addEventListener("mouseenter", resetHidingRefHint); refHint.addEventListener("blur", startHidingRefHint); refHint.addEventListener("focus", resetHidingRefHint); refHint.teardownEventListeners = () => { // remove event listeners resetHidingRefHint(); link.removeEventListener("mouseleave", startHidingRefHint); link.removeEventListener("mouseenter", resetHidingRefHint); link.removeEventListener("blur", startHidingRefHint); link.removeEventListener("focus", resetHidingRefHint); refHint.removeEventListener("mouseleave", startHidingRefHint); refHint.removeEventListener("mouseenter", resetHidingRefHint); refHint.removeEventListener("blur", startHidingRefHint); refHint.removeEventListener("focus", resetHidingRefHint); }; } function positionRefHint(refHint) { const link = refHint.forLink; const linkPos = getBounds(link); refHint.style.top = linkPos.bottom + "px"; refHint.style.left = linkPos.left + "px"; const panelPos = refHint.getBoundingClientRect(); const panelMargin = 8; const maxRight = document.body.parentNode.clientWidth - panelMargin; if (panelPos.right > maxRight) { const overflowAmount = panelPos.right - maxRight; const newLeft = Math.max(panelMargin, linkPos.left - overflowAmount); refHint.style.left = newLeft + "px"; } } // TODO: shared util // Returns the root-level absolute position {left and top} of element. function getBounds(el, relativeTo=document.body) { const relativeRect = relativeTo.getBoundingClientRect(); const elRect = el.getBoundingClientRect(); const top = elRect.top - relativeRect.top; const left = elRect.left - relativeRect.left; return { top, left, bottom: top + elRect.height, right: left + elRect.width, } } function showRefHintListener(e) { // If the target isn't in a link (or is a link), // just ignore it. let link = e.target.closest("a"); if(!link) return; // If the target is in a ref-hint panel // (aka a link in the already-open one), // also just ignore it. if(link.closest(".ref-hint")) return; // Otherwise, show the panel for the link. showRefHint(link); } function hideAllHintsListener(e) { // If the click is inside a ref-hint panel, ignore it. if(e.target.closest(".ref-hint")) return; // Otherwise, close all the current panels. hideAllRefHints(); } document.addEventListener("DOMContentLoaded", () => { document.body.addEventListener("mousedown", showRefHintListener); document.body.addEventListener("focus", showRefHintListener); document.body.addEventListener("click", hideAllHintsListener); }); window.addEventListener("resize", () => { // Hide any open ref hint. hideAllRefHints(); }); }
