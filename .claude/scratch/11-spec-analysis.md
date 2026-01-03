# Spec Analysis: 11 - Resource Reclamation

## Algorithms to Implement

### ResourceManager - Reclaim Algorithm
**Spec Section:** 11
**Algorithm Steps:**
1. When resources are constrained, a User Agent MAY proactively reclaim codecs
2. To reclaim a codec, run the appropriate close algorithm with a `QuotaExceededError`
3. Only reclaim codecs that are either inactive OR background (or both)
4. MUST NOT reclaim a codec that is both active AND in the foreground

### Active Codec Definition
**Spec Section:** 11
**Algorithm Steps:**
1. An active codec is one that has made progress on [[codec work queue]] in past 10 seconds
2. NOTE: A reliable sign of working queue progress is a call to output() callback

### Inactive Codec Definition
**Spec Section:** 11
**Algorithm Steps:**
1. An inactive codec is any codec that does not meet the definition of an active codec
2. I.e., no progress on [[codec work queue]] in past 10 seconds

### Background Codec Definition
**Spec Section:** 11
**Algorithm Steps:**
1. A background codec is one whose ownerDocument has hidden attribute equal to true
2. For codecs in workers: owner set's Document has hidden=true
3. (In Node.js context: no document concept, so background is application-defined)

### Protected Background Codecs
**Spec Section:** 11
**Algorithm Steps:**
User Agents MUST NOT reclaim an active background codec if it is:
1. An encoder (AudioEncoder or VideoEncoder) - prevents interrupting long encode tasks
2. An AudioDecoder/VideoDecoder when there is an active AudioEncoder/VideoEncoder in same global object - prevents breaking transcoding
3. An AudioDecoder when its tab is audibly playing audio

**Error Conditions (spec-mandated):**
- Reclamation MUST call close algorithm with `QuotaExceededError` DOMException
- Error callback MUST be invoked with this error

**Edge Cases (from spec):**
- Codec becomes active just before reclamation (activity recorded) - should NOT be reclaimed
- Multiple inactive codecs exist - all should be eligible for reclamation
- Codec already closed - reclamation should be no-op
- Background codec with active encoder in same context - decoder protected from reclamation

## Inputs NOT in Test Requirements (Must Still Work)

- Reclamation with various inactivity timeout values (not just 10s)
- Rapid register/unregister cycles
- Concurrent activity recording from multiple codecs
- Reclamation during pending async operations
- Very large number of tracked codecs (stress scenario)

## Current Implementation Gaps

1. **Missing QuotaExceededError on reclamation**: Current `reclaimInactive()` calls `codec.close()` directly without passing error. Spec requires close to be called with `QuotaExceededError`.

2. **getReclaimableCodecs logic incorrect**: Current logic says `if (inactive || entry.isBackground)` but spec says:
   - MUST NOT reclaim codec that is BOTH active AND foreground
   - Therefore: CAN reclaim if inactive OR if (background AND NOT protected)
   - Current logic would reclaim active background codecs (wrong for encoders)

3. **No encoder/decoder protection**: Spec says active background encoders and active decoders with active encoder pair should be protected. Not implemented.

4. **No error callback integration**: When reclaiming, should invoke codec's error callback with QuotaExceededError.

5. **Missing codec type tracking**: To protect encoders/decoders correctly, need to track codec type.

## Implementation Plan

1. Add `codecType: 'encoder' | 'decoder'` to CodecEntry
2. Modify `register()` to accept codec type
3. Create `closeWithError(codec, error)` method that invokes error callback
4. Fix `getReclaimableCodecs()` to properly implement protection rules
5. Update `reclaimInactive()` to use `QuotaExceededError` via close algorithm
