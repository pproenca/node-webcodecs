## ADDED Requirements

### Requirement: Control Message Definition

A control message SHALL define a sequence of steps corresponding to a method invocation on a codec instance (e.g., `configure()`, `encode()`, `decode()`, `flush()`, `reset()`, `close()`).

#### Scenario: Method invocation creates control message
- **WHEN** a codec method such as `encode()` or `decode()` is invoked
- **THEN** a control message representing that method's steps MUST be created

---

### Requirement: Control Message Queue Internal Slot

Each codec instance SHALL have an internal slot named [[control message queue]] that is a queue of control messages.

#### Scenario: Codec instance has control message queue
- **WHEN** a codec instance is created
- **THEN** it MUST have an internal [[control message queue]] initialized as an empty queue

---

### Requirement: Queuing Control Messages

Queuing a control message SHALL mean enqueuing the message to a codec's [[control message queue]]. Invoking codec methods SHALL queue a control message to schedule work.

#### Scenario: Method invocation enqueues message
- **WHEN** a codec method like `encode()` is called
- **THEN** a control message MUST be enqueued to the [[control message queue]]

#### Scenario: Multiple method calls queue in order
- **WHEN** `encode()` is called twice in succession
- **THEN** both control messages MUST be enqueued in FIFO order

---

### Requirement: Running Control Messages

Running a control message SHALL mean performing the sequence of steps specified by the method that enqueued the message.

#### Scenario: Message execution performs method steps
- **WHEN** a control message is run
- **THEN** the steps defined by the originating method MUST be executed

---

### Requirement: Message Queue Blocking

Each codec instance SHALL have a boolean internal slot named [[message queue blocked]] that is set to `true` when a control message blocks processing of later messages. A blocking message SHALL conclude by setting [[message queue blocked]] to `false` and rerunning the "Process the control message queue" steps.

#### Scenario: Blocking message sets blocked flag
- **WHEN** a control message needs to wait for an async operation
- **THEN** [[message queue blocked]] MUST be set to `true`

#### Scenario: Blocking message completes
- **WHEN** a blocking control message finishes its async operation
- **THEN** [[message queue blocked]] MUST be set to `false`
- **AND** the "Process the control message queue" algorithm MUST be rerun

---

### Requirement: Control Message Return Values

All control messages SHALL return either "processed" or "not processed". Returning "processed" SHALL indicate the message steps are being (or have been) executed and the message MAY be removed from the control message queue. "not processed" SHALL indicate the message must not be processed at this time and should remain in the control message queue to be retried later.

#### Scenario: Successfully processed message
- **WHEN** a control message can execute immediately
- **THEN** it MUST return "processed"
- **AND** the message MUST be dequeued

#### Scenario: Message cannot be processed yet
- **WHEN** a control message cannot execute due to blocking
- **THEN** it MUST return "not processed"
- **AND** the message MUST remain in the queue

---

### Requirement: Process Control Message Queue Algorithm

To process the control message queue, the system SHALL run the following steps:
1. While [[message queue blocked]] is `false` and [[control message queue]] is not empty:
   1. Let front message be the first message in [[control message queue]]
   2. Let outcome be the result of running the control message steps described by front message
   3. If outcome equals "not processed", break
   4. Otherwise, dequeue front message from [[control message queue]]

#### Scenario: Process messages until blocked
- **WHEN** [[message queue blocked]] is `false` and queue has messages
- **THEN** messages MUST be processed in FIFO order until one returns "not processed" or the queue is empty

#### Scenario: Stop processing when blocked
- **WHEN** [[message queue blocked]] is `true`
- **THEN** no messages SHALL be processed until [[message queue blocked]] becomes `false`

#### Scenario: Stop on "not processed" return
- **WHEN** a control message returns "not processed"
- **THEN** processing MUST stop and the message MUST remain at the front of the queue

---

### Requirement: Codec Work Queue Internal Slot

Each codec instance SHALL have an internal slot named [[codec work queue]] that is a parallel queue for executing codec operations off the main thread.

#### Scenario: Codec instance has work queue
- **WHEN** a codec instance is created
- **THEN** it MUST have an internal [[codec work queue]] initialized as a parallel queue

---

### Requirement: Codec Implementation Internal Slot

Each codec instance SHALL have an internal slot named [[codec implementation]] that refers to the underlying platform encoder or decoder. Except for the initial assignment, any steps that reference [[codec implementation]] MUST be enqueued to the [[codec work queue]].

#### Scenario: Codec implementation access via work queue
- **WHEN** codec operations need to access [[codec implementation]]
- **THEN** those operations MUST be enqueued to [[codec work queue]]
- **AND** they MUST NOT block the main thread

#### Scenario: Initial codec implementation assignment
- **WHEN** [[codec implementation]] is first assigned during configuration
- **THEN** the assignment MAY happen without using [[codec work queue]]

---

### Requirement: Codec Task Source

Each codec instance SHALL have a unique codec task source. Tasks queued from the [[codec work queue]] to the event loop MUST use the codec task source.

#### Scenario: Callback delivery uses codec task source
- **WHEN** codec work completes and needs to invoke callbacks
- **THEN** the callback task MUST be queued to the event loop using the codec task source

#### Scenario: Isolated task sources per codec
- **WHEN** multiple codec instances exist
- **THEN** each MUST have its own unique codec task source
