## ADDED Requirements

### Requirement: Codec Fingerprinting Risk Documentation

The implementation SHALL document codec fingerprinting risks for embedders who deploy Node.js WebCodecs in privacy-sensitive contexts (Electron apps, multi-tenant servers).

Documentation SHALL explain:
- Codec feature profiles can be accumulated via `isConfigSupported()` probing
- Hardware acceleration detection (via capability queries) adds to fingerprinting surface
- While most codec profiles are shared by large user groups, outliers exist (outdated software, custom hardware)
- Combining codec profiles with other metrics can enable user identification

#### Scenario: README documents fingerprinting risk

- **WHEN** a developer reads the README.md "Privacy Considerations" section
- **THEN** they find an explanation of how codec capability queries can build fingerprinting profiles
- **AND** they understand this applies primarily to embedded/multi-tenant contexts

#### Scenario: JSDoc warns about fingerprinting on isConfigSupported

- **WHEN** a developer reads JSDoc for `VideoEncoder.isConfigSupported()` or equivalent methods
- **THEN** they find a `@remarks` note explaining fingerprinting implications
- **AND** they are directed to README for mitigation strategies

### Requirement: Privacy Mitigation Guidance

The implementation SHALL document mitigation strategies for embedders who need to limit fingerprinting exposure.

Documentation SHALL include:
- Rate-limiting capability queries in multi-tenant contexts
- Returning baseline capabilities for untrusted callers
- Monitoring for exhaustive codec probing patterns
- Example code patterns for implementing mitigations

#### Scenario: Embedder implements rate limiting

- **WHEN** an embedder reads the privacy mitigation guidance
- **THEN** they find a recommended pattern for rate-limiting `isConfigSupported()` calls
- **AND** the pattern is applicable to multi-tenant server deployments

#### Scenario: Embedder implements capability baseline

- **WHEN** an embedder reads the privacy mitigation guidance
- **THEN** they find a recommended pattern for returning a common capability baseline
- **AND** the pattern allows distinguishing trusted vs untrusted callers

### Requirement: Worker Thread Best Practices Documentation

The implementation SHALL document worker thread recommendations per W3C WebCodecs Section 14 for realtime media pipelines.

Documentation SHALL explain:
- Realtime media processing SHOULD occur in worker contexts (Node.js `worker_threads`)
- Main thread contention degrades user experience unpredictably across devices
- Target frame rates and device class determine acceptable main thread usage
- Example demonstrating worker thread media pipeline

#### Scenario: Developer finds worker thread guidance

- **WHEN** a developer reads the README.md "Best Practices" section
- **THEN** they find guidance on using worker threads for realtime media
- **AND** they understand why main thread processing can cause jank

#### Scenario: Example demonstrates worker pattern

- **WHEN** a developer looks in `examples/` directory
- **THEN** they find an example demonstrating video encoding in a worker thread
- **AND** the example shows proper frame transfer between threads

#### Scenario: JSDoc recommends worker usage

- **WHEN** a developer reads JSDoc for `VideoEncoder` or `VideoDecoder` classes
- **THEN** they find a `@remarks` note recommending worker usage for realtime processing
- **AND** they are directed to the worker example
