---
title: 'VP8'
---

> From [VP8 Registration](https://www.w3.org/TR/webcodecs-vp8-codec-registration/)

## Abstract

This registration is entered into the [\[webcodecs-codec-registry\]](https://www.w3.org/TR/webcodecs-vp8-codec-registration/#biblio-webcodecs-codec-registry). It describes, for VP8, the (1) fully qualified codec strings, (2) the codec-specific [EncodedVideoChunk](https://www.w3.org/TR/webcodecs/#encodedvideochunk) [[[internal data]]](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunk-internal-data-slot) bytes, (3) the [VideoDecoderConfig.description](https://www.w3.org/TR/webcodecs/#dom-videodecoderconfig-description) bytes, and (4) the values of [EncodedVideoChunk](https://www.w3.org/TR/webcodecs/#encodedvideochunk) [[[type]]](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunk-type-slot).

The registration is not intended to include any information on whether a codec format is encumbered by intellectual property claims. Implementers and authors are advised to seek appropriate legal counsel in this matter if they intend to implement or use a specific codec format. Implementers of WebCodecs are not required to support the VP8 codec.

This registration is non-normative.

## Status of this document

_This section describes the status of this document at the time of its publication. A list of current W3C publications and the latest revision of this technical report can be found in the [W3C technical reports index](https://www.w3.org/TR/) at https://www.w3.org/TR/._

Feedback and comments on this specification are welcome. [GitHub Issues](https://github.com/w3c/webcodecs/issues) are preferred for discussion on this specification. Alternatively, you can send comments to the Media Working Group’s mailing-list, [public-media-wg@w3.org](mailto:public-media-wg@w3.org) ([archives](https://lists.w3.org/Archives/Public/public-media-wg/)). This draft highlights some of the pending issues that are still to be discussed in the working group. No decision has been taken on the outcome of these issues including whether they are valid.

This document was published by the [Media Working Group](https://www.w3.org/groups/wg/media) as a Group Draft Note using the [Note track](https://www.w3.org/policies/process/20231103/#recs-and-notes).

Group Draft Notes are not endorsed by W3C nor its Members.

This is a draft document and may be updated, replaced or obsoleted by other documents at any time. It is inappropriate to cite this document as other than work in progress.

The [W3C Patent Policy](https://www.w3.org/policies/patent-policy/) does not carry any licensing requirements or commitments on this document.

This document is governed by the [03 November 2023 W3C Process Document](https://www.w3.org/policies/process/20231103/).

## [1. Fully qualified codec strings](https://www.w3.org/TR/webcodecs-vp8-codec-registration/#fully-qualified-codec-strings)

The codec string is `"vp8"`.

## [2. EncodedVideoChunk data](https://www.w3.org/TR/webcodecs-vp8-codec-registration/#encodedvideochunk-data)

[EncodedVideoChunk](https://www.w3.org/TR/webcodecs/#encodedvideochunk) [[[internal data]]](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunk-internal-data-slot) is expected to be a frame as described in Section 4 and Annex A of [\[VP8\]](https://www.w3.org/TR/webcodecs-vp8-codec-registration/#biblio-vp8).

## [3. VideoDecoderConfig description](https://www.w3.org/TR/webcodecs-vp8-codec-registration/#videodecoderconfig-description)

The [description](https://www.w3.org/TR/webcodecs/#dom-videodecoderconfig-description) is not used for this codec.

## [4. EncodedVideoChunk type](https://www.w3.org/TR/webcodecs-vp8-codec-registration/#encodedvideochunk-type)

If an [EncodedVideoChunk](https://www.w3.org/TR/webcodecs/#encodedvideochunk)'s [[[type]]](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunk-type-slot) is [key](https://www.w3.org/TR/webcodecs/#dom-encodedvideochunktype-key), then the [EncodedVideoChunk](https://www.w3.org/TR/webcodecs/#encodedvideochunk) is expected to contain a frame where `key_frame` is true as defined in Section 19.1 of [\[VP8\]](https://www.w3.org/TR/webcodecs-vp8-codec-registration/#biblio-vp8).

## [5. Privacy Considerations](https://www.w3.org/TR/webcodecs-vp8-codec-registration/#privacy-considerations)

Please refer to the section [Privacy Considerations](https://www.w3.org/TR/webcodecs/#privacy-considerations) in [\[WEBCODECS\]](https://www.w3.org/TR/webcodecs-vp8-codec-registration/#biblio-webcodecs).

## [6. Security Considerations](https://www.w3.org/TR/webcodecs-vp8-codec-registration/#security-considerations)

Please refer to the section [Security Considerations](https://www.w3.org/TR/webcodecs/#security-considerations) in [\[WEBCODECS\]](https://www.w3.org/TR/webcodecs-vp8-codec-registration/#biblio-webcodecs).

## [Conformance](https://www.w3.org/TR/webcodecs-vp8-codec-registration/#w3c-conformance)

### [Document conventions](https://www.w3.org/TR/webcodecs-vp8-codec-registration/#w3c-conventions)

Conformance requirements are expressed with a combination of descriptive assertions and RFC 2119 terminology. The key words “MUST”, “MUST NOT”, “REQUIRED”, “SHALL”, “SHALL NOT”, “SHOULD”, “SHOULD NOT”, “RECOMMENDED”, “MAY”, and “OPTIONAL” in the normative parts of this document are to be interpreted as described in RFC 2119. However, for readability, these words do not appear in all uppercase letters in this specification.

All of the text of this specification is normative except sections explicitly marked as non-normative, examples, and notes. [\[RFC2119\]](https://www.w3.org/TR/webcodecs-vp8-codec-registration/#biblio-rfc2119)

Examples in this specification are introduced with the words “for example” or are set apart from the normative text with `class="example"`, like this:

[](https://www.w3.org/TR/webcodecs-vp8-codec-registration/#w3c-example)

This is an example of an informative example.

Informative notes begin with the word “Note” and are set apart from the normative text with `class="note"`, like this:

Note, this is an informative note.

## [Index](https://www.w3.org/TR/webcodecs-vp8-codec-registration/#index)

### [Terms defined by reference](https://www.w3.org/TR/webcodecs-vp8-codec-registration/#index-defined-elsewhere)

- \[WEBCODECS\] defines the following terms:
  - "key"
  - EncodedVideoChunk
  - \[\[internal data\]\]
  - \[\[type\]\]
  - description

## [References](https://www.w3.org/TR/webcodecs-vp8-codec-registration/#references)

### [Normative References](https://www.w3.org/TR/webcodecs-vp8-codec-registration/#normative)

**\[RFC2119\]**

S. Bradner. [Key words for use in RFCs to Indicate Requirement Levels](https://datatracker.ietf.org/doc/html/rfc2119). March 1997. Best Current Practice. URL: [https://datatracker.ietf.org/doc/html/rfc2119](https://datatracker.ietf.org/doc/html/rfc2119)
**\[WEBCODECS\]**

Paul Adenot; Bernard Aboba; Eugene Zemtsov. [WebCodecs](https://www.w3.org/TR/webcodecs/). 17 July 2024. WD. URL: [https://www.w3.org/TR/webcodecs/](https://www.w3.org/TR/webcodecs/)

### [Informative References](https://www.w3.org/TR/webcodecs-vp8-codec-registration/#informative)

**\[VP8\]**

[VP8 Data Format and Decoding Guide](https://datatracker.ietf.org/doc/html/rfc6386). URL: [https://datatracker.ietf.org/doc/html/rfc6386](https://datatracker.ietf.org/doc/html/rfc6386)
**\[WEBCODECS-CODEC-REGISTRY\]**

Chris Cunningham; Paul Adenot; Bernard Aboba. [WebCodecs Codec Registry](https://www.w3.org/TR/webcodecs-codec-registry/). 10 October 2022. NOTE. URL: [https://www.w3.org/TR/webcodecs-codec-registry/](https://www.w3.org/TR/webcodecs-codec-registry/)

/\* Boilerplate: script-dfn-panel \*/ "use strict"; { const dfnsJson = window.dfnsJson || {}; function genDfnPanel({dfnID, url, dfnText, refSections, external}) { return mk.aside({ class: "dfn-panel", id: \`infopanel-for-${dfnID}\`, "data-for": dfnID, "aria-labelled-by":\`infopaneltitle-for-${dfnID}\`, }, mk.span({id:\`infopaneltitle-for-${dfnID}\`, style:"display:none"}, \`Info about the '${dfnText}' ${external?"external":""} reference.\`), mk.a({href:url}, url), mk.b({}, "Referenced in:"), mk.ul({}, ...refSections.map(section=> mk.li({}, ...section.refs.map((ref, refI)=> \[ mk.a({ href: \`#${ref.id}\` }, (refI == 0) ? section.title : \`(${refI + 1})\` ), " ", \] ), ), ), ), ); } function genAllDfnPanels() { for(const panelData of Object.values(window.dfnpanelData)) { const dfnID = panelData.dfnID; const dfn = document.getElementById(dfnID); if(!dfn) { console.log(\`Can't find dfn#${dfnID}.\`, panelData); } else { const panel = genDfnPanel(panelData); append(document.body, panel); insertDfnPopupAction(dfn, panel) } } } document.addEventListener("DOMContentLoaded", ()=>{ genAllDfnPanels(); // Add popup behavior to all dfns to show the corresponding dfn-panel. var dfns = queryAll('.dfn-paneled'); for(let dfn of dfns) { ; } document.body.addEventListener("click", (e) => { // If not handled already, just hide all dfn panels. hideAllDfnPanels(); }); }) function hideAllDfnPanels() { // Turn off any currently "on" or "activated" panels. queryAll(".dfn-panel.on, .dfn-panel.activated").forEach(el=>hideDfnPanel(el)); } function showDfnPanel(dfnPanel, dfn) { hideAllDfnPanels(); // Only display one at this time. dfn.setAttribute("aria-expanded", "true"); dfnPanel.classList.add("on"); dfnPanel.style.left = "5px"; dfnPanel.style.top = "0px"; const panelRect = dfnPanel.getBoundingClientRect(); const panelWidth = panelRect.right - panelRect.left; if (panelRect.right > document.body.scrollWidth) { // Panel's overflowing the screen. // Just drop it below the dfn and flip it rightward instead. // This still wont' fix things if the screen is \*really\* wide, // but fixing that's a lot harder without 'anchor()'. dfnPanel.style.top = "1.5em"; dfnPanel.style.left = "auto"; dfnPanel.style.right = "0px"; } } function pinDfnPanel(dfnPanel) { // Switch it to "activated" state, which pins it. dfnPanel.classList.add("activated"); dfnPanel.style.left = null; dfnPanel.style.top = null; } function hideDfnPanel(dfnPanel, dfn) { if(!dfn) { dfn = document.getElementById(dfnPanel.getAttribute("data-for")); } dfn.setAttribute("aria-expanded", "false") dfnPanel.classList.remove("on"); dfnPanel.classList.remove("activated"); } function toggleDfnPanel(dfnPanel, dfn) { if(dfnPanel.classList.contains("on")) { hideDfnPanel(dfnPanel, dfn); } else { showDfnPanel(dfnPanel, dfn); } } function insertDfnPopupAction(dfn, dfnPanel) { // Find dfn panel const panelWrapper = document.createElement('span'); panelWrapper.appendChild(dfnPanel); panelWrapper.style.position = "relative"; panelWrapper.style.height = "0px"; dfn.insertAdjacentElement("afterend", panelWrapper); dfn.setAttribute('role', 'button'); dfn.setAttribute('aria-expanded', 'false') dfn.tabIndex = 0; dfn.classList.add('has-dfn-panel'); dfn.addEventListener('click', (event) => { showDfnPanel(dfnPanel, dfn); event.stopPropagation(); }); dfn.addEventListener('keypress', (event) => { const kc = event.keyCode; // 32->Space, 13->Enter if(kc == 32 || kc == 13) { toggleDfnPanel(dfnPanel, dfn); event.stopPropagation(); event.preventDefault(); } }); dfnPanel.addEventListener('click', (event) => { if (event.target.nodeName == 'A') { pinDfnPanel(dfnPanel); } event.stopPropagation(); }); dfnPanel.addEventListener('keydown', (event) => { if(event.keyCode == 27) { // Escape key hideDfnPanel(dfnPanel, dfn); event.stopPropagation(); event.preventDefault(); } }) } } /\* Boilerplate: script-dfn-panel-json \*/ window.dfnpanelData = {}; window.dfnpanelData\['d239a8c2'\] = {"dfnID": "d239a8c2", "url": "https://www.w3.org/TR/webcodecs/#dom-encodedvideochunktype-key", "dfnText": "\\"key\\"", "refSections": \[{"refs": \[{"id": "ref-for-dom-encodedvideochunktype-key"}\], "title": "4. EncodedVideoChunk type"}\], "external": true}; window.dfnpanelData\['22466159'\] = {"dfnID": "22466159", "url": "https://www.w3.org/TR/webcodecs/#encodedvideochunk", "dfnText": "EncodedVideoChunk", "refSections": \[{"refs": \[{"id": "ref-for-encodedvideochunk"}, {"id": "ref-for-encodedvideochunk\\u2460"}\], "title": "Unnumbered Section"}, {"refs": \[{"id": "ref-for-encodedvideochunk\\u2461"}\], "title": "2. EncodedVideoChunk data"}, {"refs": \[{"id": "ref-for-encodedvideochunk\\u2462"}, {"id": "ref-for-encodedvideochunk\\u2463"}\], "title": "4. EncodedVideoChunk type"}\], "external": true}; window.dfnpanelData\['9cb4afd6'\] = {"dfnID": "9cb4afd6", "url": "https://www.w3.org/TR/webcodecs/#dom-encodedvideochunk-internal-data-slot", "dfnText": "\[\[internal data\]\]", "refSections": \[{"refs": \[{"id": "ref-for-dom-encodedvideochunk-internal-data-slot"}\], "title": "Unnumbered Section"}, {"refs": \[{"id": "ref-for-dom-encodedvideochunk-internal-data-slot\\u2460"}\], "title": "2. EncodedVideoChunk data"}\], "external": true}; window.dfnpanelData\['54f0e453'\] = {"dfnID": "54f0e453", "url": "https://www.w3.org/TR/webcodecs/#dom-encodedvideochunk-type-slot", "dfnText": "\[\[type\]\]", "refSections": \[{"refs": \[{"id": "ref-for-dom-encodedvideochunk-type-slot"}\], "title": "Unnumbered Section"}, {"refs": \[{"id": "ref-for-dom-encodedvideochunk-type-slot\\u2460"}\], "title": "4. EncodedVideoChunk type"}\], "external": true}; window.dfnpanelData\['6dae30ed'\] = {"dfnID": "6dae30ed", "url": "https://www.w3.org/TR/webcodecs/#dom-videodecoderconfig-description", "dfnText": "description", "refSections": \[{"refs": \[{"id": "ref-for-dom-videodecoderconfig-description"}\], "title": "Unnumbered Section"}, {"refs": \[{"id": "ref-for-dom-videodecoderconfig-description\\u2460"}\], "title": "3. VideoDecoderConfig description"}\], "external": true}; /\* Boilerplate: script-dom-helper \*/ function query(sel) { return document.querySelector(sel); } function queryAll(sel) { return \[...document.querySelectorAll(sel)\]; } function iter(obj) { if(!obj) return \[\]; var it = obj\[Symbol.iterator\]; if(it) return it; return Object.entries(obj); } function mk(tagname, attrs, ...children) { const el = document.createElement(tagname); for(const \[k,v\] of iter(attrs)) { if(k.slice(0,3) == "\_on") { const eventName = k.slice(3); el.addEventListener(eventName, v); } else if(k\[0\] == "\_") { // property, not attribute el\[k.slice(1)\] = v; } else { if(v === false || v == null) { continue; } else if(v === true) { el.setAttribute(k, ""); continue; } else { el.setAttribute(k, v); } } } append(el, children); return el; } /\* Create shortcuts for every known HTML element \*/ \[ "a", "abbr", "acronym", "address", "applet", "area", "article", "aside", "audio", "b", "base", "basefont", "bdo", "big", "blockquote", "body", "br", "button", "canvas", "caption", "center", "cite", "code", "col", "colgroup", "datalist", "dd", "del", "details", "dfn", "dialog", "div", "dl", "dt", "em", "embed", "fieldset", "figcaption", "figure", "font", "footer", "form", "frame", "frameset", "head", "header", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "html", "i", "iframe", "img", "input", "ins", "kbd", "label", "legend", "li", "link", "main", "map", "mark", "meta", "meter", "nav", "nobr", "noscript", "object", "ol", "optgroup", "option", "output", "p", "param", "pre", "progress", "q", "s", "samp", "script", "section", "select", "small", "source", "span", "strike", "strong", "style", "sub", "summary", "sup", "table", "tbody", "td", "template", "textarea", "tfoot", "th", "thead", "time", "title", "tr", "u", "ul", "var", "video", "wbr", "xmp", \].forEach(tagname=>{ mk\[tagname\] = (...args) => mk(tagname, ...args); }); function\* nodesFromChildList(children) { for(const child of children.flat(Infinity)) { if(child instanceof Node) { yield child; } else { yield new Text(child); } } } function append(el, ...children) { for(const child of nodesFromChildList(children)) { if(el instanceof Node) el.appendChild(child); else el.push(child); } return el; } function insertAfter(el, ...children) { for(const child of nodesFromChildList(children)) { el.parentNode.insertBefore(child, el.nextSibling); } return el; } function clearContents(el) { el.innerHTML = ""; return el; } function parseHTML(markup) { if(markup.toLowerCase().trim().indexOf('<!doctype') === 0) { const doc = document.implementation.createHTMLDocument(""); doc.documentElement.innerHTML = markup; return doc; } else { const el = mk.template({}); el.innerHTML = markup; return el.content; } }
