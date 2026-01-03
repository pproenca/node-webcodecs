# 13. Privacy Considerations

This section is non-normative.

The primary privacy impact is an increased ability to fingerprint users by querying for different codec capabilities to establish a codec feature profile. Much of this profile is already exposed by existing APIs. Such profiles are very unlikely to be uniquely identifying, but can be used with other metrics to create a fingerprint.

An attacker can accumulate a codec feature profile by calling `IsConfigSupported()` methods with a number of different configuration dictionaries. Similarly, an attacker can attempt to `configure()` a codec with different configuration dictionaries and observe which configurations are accepted.

Attackers can also use existing APIs to establish much of the codec feature profile. For example, the [\[media-capabilities\]](#biblio-media-capabilities "Media Capabilities") [`decodingInfo()`](https://www.w3.org/TR/media-capabilities/#dom-mediacapabilities-decodinginfo) API describes what types of decoders are supported and its [`powerEfficient`](https://www.w3.org/TR/media-capabilities/#dom-mediacapabilitiesinfo-powerefficient) attribute can signal when a decoder uses hardware acceleration. Similarly, the [\[WebRTC\]](#biblio-webrtc "WebRTC: Real-Time Communication in Browsers") [`getCapabilities()`](https://www.w3.org/TR/webrtc/#dom-rtcrtpsender-getcapabilities) API can be used to determine what types of encoders are supported and the [`getStats()`](https://www.w3.org/TR/webrtc/#widl-RTCPeerConnection-getStats-Promise-RTCStatsReport--MediaStreamTrack-selector) API can be used to determine when an encoder uses hardware acceleration. WebCodecs will expose some additional information in the form of low level codec features.

A codec feature profile alone is unlikely to be uniquely identifying. Underlying codecs are often implemented entirely in software (be it part of the User Agent binary or part of the operating system), such that all users who run that software will have a common set of capabilities. Additionally, underlying codecs are often implemented with hardware acceleration, but such hardware is mass produced and devices of a particular class and manufacture date (e.g. flagship phones manufactured in 2020) will often have common capabilities. There will be outliers (some users can be running outdated versions of software codecs or use a rare mix of custom assembled hardware), but most of the time a given codec feature profile is shared by a large group of users.

Segmenting groups of users by codec feature profile still amounts to a bit of entropy that can be combined with other metrics to uniquely identify a user. User Agents _MAY_ partially mitigate this by returning an error whenever a site attempts to exhaustively probe for codec capabilities. Additionally, User Agents _MAY_ implement a "privacy budget", which depletes as authors use WebCodecs and other identifying APIs. Upon exhaustion of the privacy budget, codec capabilities could be reduced to a common baseline or prompt for user approval.

## 14\. Best Practices for Authors Using WebCodecs[](./14-best-practices-for-authors-using-webcodecs.md)

This section is non-normative.

While WebCodecs internally operates on background threads, authors working with realtime media or in contended main thread environments are encouraged to ensure their media pipelines operate in worker contexts entirely independent of the main thread where possible. For example, realtime media processing of [`VideoFrame`](#videoframe)s are generally to be done in a worker context.

The main thread has significant potential for high contention and jank that can go unnoticed in development, yet degrade inconsistently across devices and User Agents in the field -- potentially dramatically impacting the end user experience. Ensuring the media pipeline is decoupled from the main thread helps provide a smooth experience for end users.

Authors using the main thread for their media pipeline ought to be sure of their target frame rates, main thread workload, how their application will be embedded, and the class of devices their users will be using.

## 15\. Acknowledgements[](./15-acknowledgements.md)

The editors would like to thank Alex Russell, Chris Needham, Dale Curtis, Dan Sanders, Eugene Zemtsov, Francois Daoust, Guido Urdaneta, Harald Alvestrand, Jan-Ivar Bruaroey, Jer Noble, Mark Foltz, Peter Thatcher, Steve Anton, Matt Wolenetz, Rijubrata Bhaumik, Thomas Guilbert, Tuukka Toivonen, and Youenn Fablet for their contributions to this specification. Thank you also to the many others who contributed to the specification, including through their participation on the mailing list and in the issues.

The Working Group dedicates this specification to our colleague Bernard Aboba.

---

[← Back to Table of Contents](../TOC.md)
