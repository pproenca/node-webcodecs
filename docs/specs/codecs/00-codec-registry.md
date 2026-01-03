---
title: 'Codec Registry'
---

> From [Codec Registry Registration](https://www.w3.org/TR/webcodecs-codec-registry/)

## Abstract

This registry is intended to enhance interoperability among implementations and users of [\[WEBCODECS\]](https://www.w3.org/TR/webcodecs-codec-registry/#biblio-webcodecs). In particular, this registry provides the means to identify and avoid collisions among codec strings and provides a mechanism to define codec-specific members of [\[WEBCODECS\]](https://www.w3.org/TR/webcodecs-codec-registry/#biblio-webcodecs) codec configuration dictionaries.

This registry is not intended to include any information on whether a codec format is encumbered by intellectual property claims. Implementers and users are advised to seek appropriate legal counsel in this matter if they intend to implement or use a specific codec format. Implementers of WebCodecs are not required to support any particular codec nor registry entry.

This registry is non-normative.

## Status of this document

_This section describes the status of this document at the time of its publication. A list of current W3C publications and the latest revision of this technical report can be found in the [W3C technical reports index](https://www.w3.org/TR/) at https://www.w3.org/TR/._

Feedback and comments on this specification are welcome. [GitHub Issues](https://github.com/w3c/webcodecs/issues) are preferred for discussion on this specification. Alternatively, you can send comments to the Media Working Group’s mailing-list, [public-media-wg@w3.org](mailto:public-media-wg@w3.org) ([archives](https://lists.w3.org/Archives/Public/public-media-wg/)). This draft highlights some of the pending issues that are still to be discussed in the working group. No decision has been taken on the outcome of these issues including whether they are valid.

This document was published by the [Media Working Group](https://www.w3.org/groups/wg/media) as a Draft Registry using the [Registry track](https://www.w3.org/policies/process/20231103/#recs-and-notes).

Publication as a Draft Registry does not imply endorsement by W3C and its Members.

This is a draft document and may be updated, replaced or obsoleted by other documents at any time. It is inappropriate to cite this document as other than work in progress.

This document was produced by a group operating under the [W3C Patent Policy](https://www.w3.org/policies/patent-policy/). W3C maintains a [public list of any patent disclosures](https://www.w3.org/groups/wg/media/ipr) made in connection with the deliverables of the group; that page also includes instructions for disclosing a patent. An individual who has actual knowledge of a patent which the individual believes contains [Essential Claim(s)](https://www.w3.org/policies/patent-policy/#def-essential) must disclose the information in accordance with [section 6 of the W3C Patent Policy](https://www.w3.org/Consortium/Patent-Policy/#sec-Disclosure).

The [W3C Patent Policy](https://www.w3.org/policies/patent-policy/) does not carry any licensing requirements or commitments on this document.

This document is governed by the [03 November 2023 W3C Process Document](https://www.w3.org/policies/process/20231103/).

## [1. Organization](https://www.w3.org/TR/webcodecs-codec-registry/#organization)

This registry maintains a mapping between codec strings and registration specifications as described below.

## [2. Registration Entry Requirements](https://www.w3.org/TR/webcodecs-codec-registry/#registration-entry-requirements)

1.  Each entry must include a unique codec string, a common name string, and a link to the codec’s specification.
2.  The codec string must be crafted as follows:
    1.  If the codec string contains a fixed prefix with variable suffix values, the suffix must be represented by an asterisk and the registration’s public specification must describe how to fully qualify the variable portion of the string.
    2.  Otherwise, if the codec is recognized by multiple strings, a single preferred string should be listed and the registration’s specification must list the other allowed strings.
    3.  Otherwise, the codec is identified by a simple fixed string.

3.  Each registration’s specification must include a sequence of sections describing:
    1.  Recognized codec strings
    2.  [EncodedAudioChunk](https://www.w3.org/TR/webcodecs/#encodedaudiochunk) or [EncodedVideoChunk](https://www.w3.org/TR/webcodecs/#encodedvideochunk) internal data
    3.  [AudioDecoderConfig](https://www.w3.org/TR/webcodecs/#dictdef-audiodecoderconfig) or [VideoDecoderConfig](https://www.w3.org/TR/webcodecs/#dictdef-videodecoderconfig) description bytes
    4.  Expectations for [EncodedAudioChunk](https://www.w3.org/TR/webcodecs/#encodedaudiochunk) or [EncodedVideoChunk](https://www.w3.org/TR/webcodecs/#encodedvideochunk) [[[type]]](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunk-type-slot)

4.  Where applicable, a registration specification may include a section describing extensions to [VideoEncoderConfig](https://www.w3.org/TR/webcodecs/#dictdef-videoencoderconfig) or [AudioEncoderConfig](https://www.w3.org/TR/webcodecs/#dictdef-audioencoderconfig) dictionaries.
5.  Candidate entries must be announced by filing an issue in the [WebCodecs GitHub issue tracker](https://github.com/w3c/webcodecs/issues/) so they can be discussed and evaluated for compliance before being added to the registry. The Media Working Group may seek expertise from outside the Working Group as part of its evaluation, e.g., from the codec specification editors or relevant standards group. If the codec specification is not publicly available, it must be made available to the Working Group for evaluation. If the Working Group reaches consensus to accept the candidate, a pull request should be drafted (either by editors or by the party requesting the candidate registration) to register the candidate. The registry editors will review and merge the pull request.
6.  Existing entries cannot be deleted or deprecated. They may be changed after being published through the same process as candidate entries. Possible changes include expansion of the codec string to better qualify the codec, adjustments to the codec name string, and modification of the link to the codec’s specification.

## [3. Audio Codec Registry](https://www.w3.org/TR/webcodecs-codec-registry/#audio-codec-registry)

**codec string**

**common name**

**public specification**

flac

Flac

[FLAC codec registration](https://www.w3.org/TR/webcodecs-flac-codec-registration/) [\[WEBCODECS-FLAC-CODEC-REGISTRATION\]](https://www.w3.org/TR/webcodecs-codec-registry/#biblio-webcodecs-flac-codec-registration)

mp3

MP3

[MP3 WebCodecs Registration](https://www.w3.org/TR/webcodecs-mp3-codec-registration/) [\[WEBCODECS-MP3-CODEC-REGISTRATION\]](https://www.w3.org/TR/webcodecs-codec-registry/#biblio-webcodecs-mp3-codec-registration)

mp4a.\*

AAC

[AAC WebCodecs Registration](https://www.w3.org/TR/webcodecs-aac-codec-registration/) [\[WEBCODECS-AAC-CODEC-REGISTRATION\]](https://www.w3.org/TR/webcodecs-codec-registry/#biblio-webcodecs-aac-codec-registration)

opus

Opus

[Opus WebCodecs Registration](https://www.w3.org/TR/webcodecs-opus-codec-registration/) [\[WEBCODECS-OPUS-CODEC-REGISTRATION\]](https://www.w3.org/TR/webcodecs-codec-registry/#biblio-webcodecs-opus-codec-registration)

vorbis

Vorbis

[Vorbis WebCodecs Registration](https://www.w3.org/TR/webcodecs-vorbis-codec-registration/) [\[WEBCODECS-VORBIS-CODEC-REGISTRATION\]](https://www.w3.org/TR/webcodecs-codec-registry/#biblio-webcodecs-vorbis-codec-registration)

ulaw

u-law PCM

[u-law PCM WebCodecs Registration](https://www.w3.org/TR/webcodecs-ulaw-codec-registration/) [\[WEBCODECS-ULAW-CODEC-REGISTRATION\]](https://www.w3.org/TR/webcodecs-codec-registry/#biblio-webcodecs-ulaw-codec-registration)

alaw

A-law PCM

[A-law PCM WebCodecs Registration](https://www.w3.org/TR/webcodecs-alaw-codec-registration/) [\[WEBCODECS-ALAW-CODEC-REGISTRATION\]](https://www.w3.org/TR/webcodecs-codec-registry/#biblio-webcodecs-alaw-codec-registration)

pcm-\*

Linear PCM

[Linear PCM WebCodecs Registration](https://www.w3.org/TR/webcodecs-pcm-codec-registration/) [\[WEBCODECS-PCM-CODEC-REGISTRATION\]](https://www.w3.org/TR/webcodecs-codec-registry/#biblio-webcodecs-pcm-codec-registration)

## [4. Video Codec Registry](https://www.w3.org/TR/webcodecs-codec-registry/#video-codec-registry)

**codec string**

**common name**

**specification**

av01.\*

AV1

[AV1 codec registration](https://www.w3.org/TR/webcodecs-av1-codec-registration/) [\[WEBCODECS-AV1-CODEC-REGISTRATION\]](https://www.w3.org/TR/webcodecs-codec-registry/#biblio-webcodecs-av1-codec-registration)

avc1.\*, avc3.\*

AVC / H.264

[AVC (H.264) WebCodecs Registration](https://www.w3.org/TR/webcodecs-avc-codec-registration/) [\[WEBCODECS-AVC-CODEC-REGISTRATION\]](https://www.w3.org/TR/webcodecs-codec-registry/#biblio-webcodecs-avc-codec-registration)

hev1.\*, hvc1.\*

HEVC / H.265

[HEVC (H.265) WebCodecs Registration](https://www.w3.org/TR/webcodecs-hevc-codec-registration/) [\[WEBCODECS-HEVC-CODEC-REGISTRATION\]](https://www.w3.org/TR/webcodecs-codec-registry/#biblio-webcodecs-hevc-codec-registration)

vp8

VP8

[VP8 codec registration](https://www.w3.org/TR/webcodecs-vp8-codec-registration/) [\[WEBCODECS-VP8-CODEC-REGISTRATION\]](https://www.w3.org/TR/webcodecs-codec-registry/#biblio-webcodecs-vp8-codec-registration)

vp09.\*

VP9

[VP9 codec registration](https://www.w3.org/TR/webcodecs-vp9-codec-registration/) [\[WEBCODECS-VP9-CODEC-REGISTRATION\]](https://www.w3.org/TR/webcodecs-codec-registry/#biblio-webcodecs-vp9-codec-registration)

## [5. Privacy Considerations](https://www.w3.org/TR/webcodecs-codec-registry/#privacy-considerations)

Please refer to the section [Privacy Considerations](https://www.w3.org/TR/webcodecs/#privacy-considerations) in [\[WEBCODECS\]](https://www.w3.org/TR/webcodecs-codec-registry/#biblio-webcodecs).

## [6. Security Considerations](https://www.w3.org/TR/webcodecs-codec-registry/#security-considerations)

Please refer to the section [Security Considerations](https://www.w3.org/TR/webcodecs/#security-considerations) in [\[WEBCODECS\]](https://www.w3.org/TR/webcodecs-codec-registry/#biblio-webcodecs).

## [Index](https://www.w3.org/TR/webcodecs-codec-registry/#index)

### [Terms defined by reference](https://www.w3.org/TR/webcodecs-codec-registry/#index-defined-elsewhere)

- \[WEBCODECS\] defines the following terms:
  - AudioDecoderConfig
  - AudioEncoderConfig
  - EncodedAudioChunk
  - EncodedVideoChunk
  - VideoDecoderConfig
  - VideoEncoderConfig
  - \[\[type\]\]

## [References](https://www.w3.org/TR/webcodecs-codec-registry/#references)

### [Normative References](https://www.w3.org/TR/webcodecs-codec-registry/#normative)

**\[WEBCODECS\]**

Paul Adenot; Bernard Aboba; Eugene Zemtsov. [WebCodecs](https://www.w3.org/TR/webcodecs/). 17 July 2024. WD. URL: [https://www.w3.org/TR/webcodecs/](https://www.w3.org/TR/webcodecs/)

### [Informative References](https://www.w3.org/TR/webcodecs-codec-registry/#informative)

**\[WEBCODECS-AAC-CODEC-REGISTRATION\]**

Paul Adenot; Bernard Aboba. [AAC WebCodecs Registration](https://www.w3.org/TR/webcodecs-aac-codec-registration/). 17 July 2024. NOTE. URL: [https://www.w3.org/TR/webcodecs-aac-codec-registration/](https://www.w3.org/TR/webcodecs-aac-codec-registration/)
**\[WEBCODECS-ALAW-CODEC-REGISTRATION\]**

Paul Adenot; Bernard Aboba. [A-law PCM WebCodecs Registration](https://www.w3.org/TR/webcodecs-alaw-codec-registration/). 17 July 2024. NOTE. URL: [https://www.w3.org/TR/webcodecs-alaw-codec-registration/](https://www.w3.org/TR/webcodecs-alaw-codec-registration/)
**\[WEBCODECS-AV1-CODEC-REGISTRATION\]**

Paul Adenot; Bernard Aboba. [AV1 WebCodecs Registration](https://www.w3.org/TR/webcodecs-av1-codec-registration/). 17 July 2024. NOTE. URL: [https://www.w3.org/TR/webcodecs-av1-codec-registration/](https://www.w3.org/TR/webcodecs-av1-codec-registration/)
**\[WEBCODECS-AVC-CODEC-REGISTRATION\]**

Paul Adenot; Bernard Aboba. [AVC (H.264) WebCodecs Registration](https://www.w3.org/TR/webcodecs-avc-codec-registration/). 17 July 2024. NOTE. URL: [https://www.w3.org/TR/webcodecs-avc-codec-registration/](https://www.w3.org/TR/webcodecs-avc-codec-registration/)
**\[WEBCODECS-FLAC-CODEC-REGISTRATION\]**

Paul Adenot; Bernard Aboba. [FLAC WebCodecs Registration](https://www.w3.org/TR/webcodecs-flac-codec-registration/). 17 July 2024. NOTE. URL: [https://www.w3.org/TR/webcodecs-flac-codec-registration/](https://www.w3.org/TR/webcodecs-flac-codec-registration/)
**\[WEBCODECS-HEVC-CODEC-REGISTRATION\]**

Paul Adenot; Bernard Aboba. [HEVC (H.265) WebCodecs Registration](https://www.w3.org/TR/webcodecs-hevc-codec-registration/). 17 July 2024. NOTE. URL: [https://www.w3.org/TR/webcodecs-hevc-codec-registration/](https://www.w3.org/TR/webcodecs-hevc-codec-registration/)
**\[WEBCODECS-MP3-CODEC-REGISTRATION\]**

Paul Adenot; Bernard Aboba. [MP3 WebCodecs Registration](https://www.w3.org/TR/webcodecs-mp3-codec-registration/). 17 July 2024. NOTE. URL: [https://www.w3.org/TR/webcodecs-mp3-codec-registration/](https://www.w3.org/TR/webcodecs-mp3-codec-registration/)
**\[WEBCODECS-OPUS-CODEC-REGISTRATION\]**

Paul Adenot; Bernard Aboba. [Opus WebCodecs Registration](https://www.w3.org/TR/webcodecs-opus-codec-registration/). 17 July 2024. NOTE. URL: [https://www.w3.org/TR/webcodecs-opus-codec-registration/](https://www.w3.org/TR/webcodecs-opus-codec-registration/)
**\[WEBCODECS-PCM-CODEC-REGISTRATION\]**

Paul Adenot; Bernard Aboba. [Linear PCM WebCodecs Registration](https://www.w3.org/TR/webcodecs-pcm-codec-registration/). 17 July 2024. NOTE. URL: [https://www.w3.org/TR/webcodecs-pcm-codec-registration/](https://www.w3.org/TR/webcodecs-pcm-codec-registration/)
**\[WEBCODECS-ULAW-CODEC-REGISTRATION\]**

Paul Adenot; Bernard Aboba. [u-law PCM WebCodecs Registration](https://www.w3.org/TR/webcodecs-ulaw-codec-registration/). 17 July 2024. NOTE. URL: [https://www.w3.org/TR/webcodecs-ulaw-codec-registration/](https://www.w3.org/TR/webcodecs-ulaw-codec-registration/)
**\[WEBCODECS-VORBIS-CODEC-REGISTRATION\]**

Paul Adenot; Bernard Aboba. [Vorbis WebCodecs Registration](https://www.w3.org/TR/webcodecs-vorbis-codec-registration/). 17 July 2024. NOTE. URL: [https://www.w3.org/TR/webcodecs-vorbis-codec-registration/](https://www.w3.org/TR/webcodecs-vorbis-codec-registration/)
**\[WEBCODECS-VP8-CODEC-REGISTRATION\]**

Paul Adenot; Bernard Aboba. [VP8 WebCodecs Registration](https://www.w3.org/TR/webcodecs-vp8-codec-registration/). 17 July 2024. NOTE. URL: [https://www.w3.org/TR/webcodecs-vp8-codec-registration/](https://www.w3.org/TR/webcodecs-vp8-codec-registration/)
**\[WEBCODECS-VP9-CODEC-REGISTRATION\]**

Paul Adenot; Bernard Aboba. [VP9 WebCodecs Registration](https://www.w3.org/TR/webcodecs-vp9-codec-registration/). 17 July 2024. NOTE. URL: [https://www.w3.org/TR/webcodecs-vp9-codec-registration/](https://www.w3.org/TR/webcodecs-vp9-codec-registration/)

/\* Boilerplate: script-dfn-panel \*/ "use strict"; { const dfnsJson = window.dfnsJson || {}; function genDfnPanel({dfnID, url, dfnText, refSections, external}) { return mk.aside({ class: "dfn-panel", id: \`infopanel-for-${dfnID}\`, "data-for": dfnID, "aria-labelled-by":\`infopaneltitle-for-${dfnID}\`, }, mk.span({id:\`infopaneltitle-for-${dfnID}\`, style:"display:none"}, \`Info about the '${dfnText}' ${external?"external":""} reference.\`), mk.a({href:url}, url), mk.b({}, "Referenced in:"), mk.ul({}, ...refSections.map(section=> mk.li({}, ...section.refs.map((ref, refI)=> \[ mk.a({ href: \`#${ref.id}\` }, (refI == 0) ? section.title : \`(${refI + 1})\` ), " ", \] ), ), ), ), ); } function genAllDfnPanels() { for(const panelData of Object.values(window.dfnpanelData)) { const dfnID = panelData.dfnID; const dfn = document.getElementById(dfnID); if(!dfn) { console.log(\`Can't find dfn#${dfnID}.\`, panelData); } else { const panel = genDfnPanel(panelData); append(document.body, panel); insertDfnPopupAction(dfn, panel) } } } document.addEventListener("DOMContentLoaded", ()=>{ genAllDfnPanels(); // Add popup behavior to all dfns to show the corresponding dfn-panel. var dfns = queryAll('.dfn-paneled'); for(let dfn of dfns) { ; } document.body.addEventListener("click", (e) => { // If not handled already, just hide all dfn panels. hideAllDfnPanels(); }); }) function hideAllDfnPanels() { // Turn off any currently "on" or "activated" panels. queryAll(".dfn-panel.on, .dfn-panel.activated").forEach(el=>hideDfnPanel(el)); } function showDfnPanel(dfnPanel, dfn) { hideAllDfnPanels(); // Only display one at this time. dfn.setAttribute("aria-expanded", "true"); dfnPanel.classList.add("on"); dfnPanel.style.left = "5px"; dfnPanel.style.top = "0px"; const panelRect = dfnPanel.getBoundingClientRect(); const panelWidth = panelRect.right - panelRect.left; if (panelRect.right > document.body.scrollWidth) { // Panel's overflowing the screen. // Just drop it below the dfn and flip it rightward instead. // This still wont' fix things if the screen is \*really\* wide, // but fixing that's a lot harder without 'anchor()'. dfnPanel.style.top = "1.5em"; dfnPanel.style.left = "auto"; dfnPanel.style.right = "0px"; } } function pinDfnPanel(dfnPanel) { // Switch it to "activated" state, which pins it. dfnPanel.classList.add("activated"); dfnPanel.style.left = null; dfnPanel.style.top = null; } function hideDfnPanel(dfnPanel, dfn) { if(!dfn) { dfn = document.getElementById(dfnPanel.getAttribute("data-for")); } dfn.setAttribute("aria-expanded", "false") dfnPanel.classList.remove("on"); dfnPanel.classList.remove("activated"); } function toggleDfnPanel(dfnPanel, dfn) { if(dfnPanel.classList.contains("on")) { hideDfnPanel(dfnPanel, dfn); } else { showDfnPanel(dfnPanel, dfn); } } function insertDfnPopupAction(dfn, dfnPanel) { // Find dfn panel const panelWrapper = document.createElement('span'); panelWrapper.appendChild(dfnPanel); panelWrapper.style.position = "relative"; panelWrapper.style.height = "0px"; dfn.insertAdjacentElement("afterend", panelWrapper); dfn.setAttribute('role', 'button'); dfn.setAttribute('aria-expanded', 'false') dfn.tabIndex = 0; dfn.classList.add('has-dfn-panel'); dfn.addEventListener('click', (event) => { showDfnPanel(dfnPanel, dfn); event.stopPropagation(); }); dfn.addEventListener('keypress', (event) => { const kc = event.keyCode; // 32->Space, 13->Enter if(kc == 32 || kc == 13) { toggleDfnPanel(dfnPanel, dfn); event.stopPropagation(); event.preventDefault(); } }); dfnPanel.addEventListener('click', (event) => { if (event.target.nodeName == 'A') { pinDfnPanel(dfnPanel); } event.stopPropagation(); }); dfnPanel.addEventListener('keydown', (event) => { if(event.keyCode == 27) { // Escape key hideDfnPanel(dfnPanel, dfn); event.stopPropagation(); event.preventDefault(); } }) } } /\* Boilerplate: script-dfn-panel-json \*/ window.dfnpanelData = {}; window.dfnpanelData\['51c408b9'\] = {"dfnID": "51c408b9", "url": "https://www.w3.org/TR/webcodecs/#dictdef-audiodecoderconfig", "dfnText": "AudioDecoderConfig", "refSections": \[{"refs": \[{"id": "ref-for-dictdef-audiodecoderconfig"}\], "title": "2. Registration Entry Requirements"}\], "external": true}; window.dfnpanelData\['94a945f4'\] = {"dfnID": "94a945f4", "url": "https://www.w3.org/TR/webcodecs/#dictdef-audioencoderconfig", "dfnText": "AudioEncoderConfig", "refSections": \[{"refs": \[{"id": "ref-for-dictdef-audioencoderconfig"}\], "title": "2. Registration Entry Requirements"}\], "external": true}; window.dfnpanelData\['3e400611'\] = {"dfnID": "3e400611", "url": "https://www.w3.org/TR/webcodecs/#encodedaudiochunk", "dfnText": "EncodedAudioChunk", "refSections": \[{"refs": \[{"id": "ref-for-encodedaudiochunk"}, {"id": "ref-for-encodedaudiochunk\\u2460"}\], "title": "2. Registration Entry Requirements"}\], "external": true}; window.dfnpanelData\['22466159'\] = {"dfnID": "22466159", "url": "https://www.w3.org/TR/webcodecs/#encodedvideochunk", "dfnText": "EncodedVideoChunk", "refSections": \[{"refs": \[{"id": "ref-for-encodedvideochunk"}, {"id": "ref-for-encodedvideochunk\\u2460"}\], "title": "2. Registration Entry Requirements"}\], "external": true}; window.dfnpanelData\['89a6ce47'\] = {"dfnID": "89a6ce47", "url": "https://www.w3.org/TR/webcodecs/#dictdef-videodecoderconfig", "dfnText": "VideoDecoderConfig", "refSections": \[{"refs": \[{"id": "ref-for-dictdef-videodecoderconfig"}\], "title": "2. Registration Entry Requirements"}\], "external": true}; window.dfnpanelData\['3aa8626d'\] = {"dfnID": "3aa8626d", "url": "https://www.w3.org/TR/webcodecs/#dictdef-videoencoderconfig", "dfnText": "VideoEncoderConfig", "refSections": \[{"refs": \[{"id": "ref-for-dictdef-videoencoderconfig"}\], "title": "2. Registration Entry Requirements"}\], "external": true}; window.dfnpanelData\['54f0e453'\] = {"dfnID": "54f0e453", "url": "https://www.w3.org/TR/webcodecs/#dom-encodedvideochunk-type-slot", "dfnText": "\[\[type\]\]", "refSections": \[{"refs": \[{"id": "ref-for-dom-encodedvideochunk-type-slot"}\], "title": "2. Registration Entry Requirements"}\], "external": true}; /\* Boilerplate: script-dom-helper \*/ function query(sel) { return document.querySelector(sel); } function queryAll(sel) { return \[...document.querySelectorAll(sel)\]; } function iter(obj) { if(!obj) return \[\]; var it = obj\[Symbol.iterator\]; if(it) return it; return Object.entries(obj); } function mk(tagname, attrs, ...children) { const el = document.createElement(tagname); for(const \[k,v\] of iter(attrs)) { if(k.slice(0,3) == "\_on") { const eventName = k.slice(3); el.addEventListener(eventName, v); } else if(k\[0\] == "\_") { // property, not attribute el\[k.slice(1)\] = v; } else { if(v === false || v == null) { continue; } else if(v === true) { el.setAttribute(k, ""); continue; } else { el.setAttribute(k, v); } } } append(el, children); return el; } /\* Create shortcuts for every known HTML element \*/ \[ "a", "abbr", "acronym", "address", "applet", "area", "article", "aside", "audio", "b", "base", "basefont", "bdo", "big", "blockquote", "body", "br", "button", "canvas", "caption", "center", "cite", "code", "col", "colgroup", "datalist", "dd", "del", "details", "dfn", "dialog", "div", "dl", "dt", "em", "embed", "fieldset", "figcaption", "figure", "font", "footer", "form", "frame", "frameset", "head", "header", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "html", "i", "iframe", "img", "input", "ins", "kbd", "label", "legend", "li", "link", "main", "map", "mark", "meta", "meter", "nav", "nobr", "noscript", "object", "ol", "optgroup", "option", "output", "p", "param", "pre", "progress", "q", "s", "samp", "script", "section", "select", "small", "source", "span", "strike", "strong", "style", "sub", "summary", "sup", "table", "tbody", "td", "template", "textarea", "tfoot", "th", "thead", "time", "title", "tr", "u", "ul", "var", "video", "wbr", "xmp", \].forEach(tagname=>{ mk\[tagname\] = (...args) => mk(tagname, ...args); }); function\* nodesFromChildList(children) { for(const child of children.flat(Infinity)) { if(child instanceof Node) { yield child; } else { yield new Text(child); } } } function append(el, ...children) { for(const child of nodesFromChildList(children)) { if(el instanceof Node) el.appendChild(child); else el.push(child); } return el; } function insertAfter(el, ...children) { for(const child of nodesFromChildList(children)) { el.parentNode.insertBefore(child, el.nextSibling); } return el; } function clearContents(el) { el.innerHTML = ""; return el; } function parseHTML(markup) { if(markup.toLowerCase().trim().indexOf('<!doctype') === 0) { const doc = document.implementation.createHTMLDocument(""); doc.documentElement.innerHTML = markup; return doc; } else { const el = mk.template({}); el.innerHTML = markup; return el.content; } }
