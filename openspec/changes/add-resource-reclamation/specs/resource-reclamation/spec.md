## ADDED Requirements

### Requirement: Codec Activity Classification

The system SHALL classify codecs as active or inactive based on work queue progress.

- An **active codec** is a codec that has made progress on the `[[codec work queue]]` in the past 10 seconds
- An **inactive codec** is any codec that does not meet the definition of an active codec
- Progress is indicated by invocation of the `output()` callback

#### Scenario: Codec becomes active on output

- **WHEN** a codec's `output()` callback is invoked
- **THEN** the codec SHALL be classified as active
- **AND** the activity timestamp SHALL be updated to the current time

#### Scenario: Codec becomes inactive after 10 seconds without output

- **GIVEN** a codec that was last active more than 10 seconds ago
- **WHEN** the system evaluates codec activity status
- **THEN** the codec SHALL be classified as inactive

---

### Requirement: Background Codec Classification

The system SHALL classify codecs as background or foreground based on their owning context visibility.

- In browsers: A **background codec** has `ownerDocument.hidden = true`
- In Node.js: The "background" concept does not apply (no document visibility). Codecs are always treated as foreground unless explicitly marked via `ResourceManager.setBackground()` for testing or advanced control.

#### Scenario: Codec is foreground by default in Node.js

- **GIVEN** a codec created in a Node.js environment
- **WHEN** the codec is registered with the ResourceManager
- **THEN** the codec SHALL be classified as foreground (not background)

#### Scenario: Codec can be explicitly marked as background

- **GIVEN** a registered codec
- **WHEN** `ResourceManager.setBackground(id, true)` is called
- **THEN** the codec SHALL be classified as background

---

### Requirement: Reclamation Algorithm

When resources are constrained, the system MAY proactively reclaim codecs. To reclaim a codec, the system MUST:

1. Invoke the codec's error callback with a `QuotaExceededError` DOMException
2. Run the codec's close algorithm

#### Scenario: Reclamation invokes error callback with QuotaExceededError

- **GIVEN** a codec eligible for reclamation
- **WHEN** the codec is reclaimed
- **THEN** the error callback SHALL be invoked with a `DOMException`
- **AND** the `DOMException.name` SHALL be `"QuotaExceededError"`
- **AND** the codec SHALL be closed after the error callback returns

---

### Requirement: Reclamation Protection Rules

The system MUST NOT reclaim certain codecs based on their activity and visibility status.

**Protected from reclamation:**
1. Active foreground codecs (active AND not background)
2. Active background encoders (`VideoEncoder` or `AudioEncoder`)
3. Active background decoders when an active encoder exists in the same global context (transcoding protection)
4. Active `AudioDecoder` when audio is being played audibly (Node.js: when audio output stream is active)

**Eligible for reclamation:**
- Inactive codecs (regardless of foreground/background status)

#### Scenario: Active foreground codec is protected

- **GIVEN** a codec that is both active AND foreground
- **WHEN** the system attempts to reclaim resources
- **THEN** this codec SHALL NOT be reclaimed

#### Scenario: Active background encoder is protected

- **GIVEN** a `VideoEncoder` or `AudioEncoder` that is active AND background
- **WHEN** the system attempts to reclaim resources
- **THEN** this encoder SHALL NOT be reclaimed
- **REASON** Prevents interrupting long-running encode tasks

#### Scenario: Inactive foreground codec is reclaimable

- **GIVEN** a codec that is inactive AND foreground
- **WHEN** the system attempts to reclaim resources
- **THEN** this codec MAY be reclaimed

#### Scenario: Inactive background codec is reclaimable

- **GIVEN** a codec that is inactive AND background
- **WHEN** the system attempts to reclaim resources
- **THEN** this codec MAY be reclaimed

#### Scenario: Active background decoder with paired encoder is protected

- **GIVEN** a `VideoDecoder` that is active AND background
- **AND** an active `VideoEncoder` exists in the same global context
- **WHEN** the system attempts to reclaim resources
- **THEN** this decoder SHALL NOT be reclaimed
- **REASON** Prevents breaking long-running transcoding tasks

---

### Requirement: ResourceManager Singleton

The system SHALL provide a singleton `ResourceManager` to track and manage codec resource reclamation.

#### Scenario: ResourceManager provides singleton access

- **WHEN** `ResourceManager.getInstance()` is called multiple times
- **THEN** the same instance SHALL be returned each time

---

### Requirement: Codec Registration and Unregistration

All codec instances MUST register with the ResourceManager on construction and unregister on close.

#### Scenario: Codec registers on construction

- **WHEN** a `VideoEncoder`, `VideoDecoder`, `AudioEncoder`, or `AudioDecoder` is constructed
- **THEN** it SHALL call `ResourceManager.register(this, codecType, errorCallback)`
- **AND** receive a unique symbol ID for tracking

#### Scenario: Codec unregisters on close

- **WHEN** a codec's `close()` method is called
- **THEN** it SHALL call `ResourceManager.unregister(id)` with its tracking ID

---

### Requirement: Activity Recording

Codecs MUST record activity with the ResourceManager when their output callback is invoked.

#### Scenario: Activity recorded on output callback

- **GIVEN** a registered codec with ID
- **WHEN** the codec's `output()` callback is invoked
- **THEN** `ResourceManager.recordActivity(id)` SHALL be called
- **AND** the codec's activity timestamp SHALL be updated

---

### Requirement: Reclaimable Codecs Query

The ResourceManager SHALL provide a method to query which codecs are currently eligible for reclamation.

#### Scenario: getReclaimableCodecs returns inactive codecs

- **GIVEN** multiple registered codecs with varying activity states
- **WHEN** `ResourceManager.getReclaimableCodecs()` is called
- **THEN** it SHALL return only codecs that are eligible for reclamation per the protection rules
- **AND** active foreground codecs SHALL NOT be included
- **AND** active background encoders SHALL NOT be included

---

### Requirement: Explicit Reclamation Trigger

The ResourceManager SHALL provide a method to explicitly trigger reclamation of inactive codecs.

#### Scenario: reclaimInactive closes eligible codecs

- **GIVEN** one or more inactive codecs registered
- **WHEN** `ResourceManager.reclaimInactive()` is called
- **THEN** all reclaimable codecs SHALL have their error callbacks invoked with `QuotaExceededError`
- **AND** all reclaimable codecs SHALL be closed
- **AND** the method SHALL return the count of reclaimed codecs

#### Scenario: reclaimInactive skips already-closed codecs

- **GIVEN** a registered codec with `state === "closed"`
- **WHEN** `ResourceManager.reclaimInactive()` is called
- **THEN** this codec SHALL NOT be reclaimed
- **AND** no error callback SHALL be invoked
