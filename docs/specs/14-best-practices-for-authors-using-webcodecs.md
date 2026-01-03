# 14. Best Practices for Authors Using WebCodecs

This section is non-normative.

While WebCodecs internally operates on background threads, authors working with realtime media or in contended main thread environments are encouraged to ensure their media pipelines operate in worker contexts entirely independent of the main thread where possible. For example, realtime media processing of [`VideoFrame`](#videoframe)s are generally to be done in a worker context.

The main thread has significant potential for high contention and jank that can go unnoticed in development, yet degrade inconsistently across devices and User Agents in the field -- potentially dramatically impacting the end user experience. Ensuring the media pipeline is decoupled from the main thread helps provide a smooth experience for end users.

Authors using the main thread for their media pipeline ought to be sure of their target frame rates, main thread workload, how their application will be embedded, and the class of devices their users will be using.

---

[← Back to Table of Contents](../TOC.md)
