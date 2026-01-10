# Memory Model Capability

Defines the memory management model for raw media data (VideoFrame and AudioData), including reference counting, transfer, and serialization semantics per W3C WebCodecs spec section 9.1.

## ADDED Requirements

### Requirement: Media Resource Reference Counting

The system SHALL implement reference counting for media resources, where a media resource is the underlying storage for pixel data (VideoFrame) or audio sample data (AudioData).

- The [[resource reference]] internal slot of VideoFrame and AudioData SHALL hold a reference to a media resource
- A media resource MUST remain alive as long as it is referenced by any [[resource reference]]
- When a media resource is no longer referenced, the implementation MAY destroy it to reclaim memory

#### Scenario: Clone creates shared reference

- **WHEN** clone() is called on a VideoFrame or AudioData
- **THEN** a new object is returned whose [[resource reference]] points to the same media resource as the original
- **AND** both objects can independently access the media data

#### Scenario: Close releases reference

- **WHEN** close() is called on a VideoFrame or AudioData
- **THEN** the [[resource reference]] slot is cleared
- **AND** the object becomes closed (format returns null, methods throw)
- **AND** if no other references exist, the media resource MAY be destroyed

### Requirement: Transfer Semantics

The system SHALL support transferring VideoFrame and AudioData objects between realms without copying the underlying media resource.

- Transfer MUST move the [[resource reference]] from source to destination object
- Transfer MUST close the source object (as if close() was called)
- The destination object SHALL have full access to the media resource

#### Scenario: Transfer moves ownership

- **WHEN** a VideoFrame or AudioData is transferred via postMessage with transfer list
- **THEN** the source object becomes closed
- **AND** the destination object receives the [[resource reference]]
- **AND** no copy of the media resource is made

### Requirement: Serialization Semantics

The system SHALL support serializing VideoFrame and AudioData objects, which effectively clones the reference without copying the media resource.

- Serialization MUST create a new [[resource reference]] pointing to the same media resource
- The source object SHALL remain valid after serialization
- Both source and serialized objects SHALL have access to the media data

#### Scenario: Serialization creates shared reference

- **WHEN** a VideoFrame or AudioData is serialized via structuredClone without transfer
- **THEN** both original and cloned objects have valid [[resource reference]]
- **AND** both can access the same underlying media data
- **AND** no copy of the media resource is made
