---
name: check-compliance
description: Analyze WebCodecs implementation compliance against W3C specs. Spawns 5 parallel agents to check 12 interfaces, generates docs/compliance.md report.
---

# WebCodecs Compliance Checker

## Overview

This skill analyzes the node-webcodecs implementation against W3C WebCodecs specifications from MDN. It spawns 5 parallel Task agents to check 12 interfaces, then writes an atomic compliance report.

## Prerequisites

Run `npm run compliance` first to fetch latest specs to `docs/specs/`.

## Execution Steps

### Step 1: Launch 5 Parallel Analysis Agents

Spawn these agents using Task tool with `run_in_background: true`:

**Agent 1 - Video Codecs:**
- Interfaces: `videoencoder`, `videodecoder`
- Specs: `docs/specs/videoencoder/`, `docs/specs/videodecoder/`
- Implementation: `lib/video-encoder.ts`, `lib/video-decoder.ts`

**Agent 2 - Audio Codecs:**
- Interfaces: `audioencoder`, `audiodecoder`
- Specs: `docs/specs/audioencoder/`, `docs/specs/audiodecoder/`
- Implementation: `lib/audio-encoder.ts`, `lib/audio-decoder.ts`

**Agent 3 - Media Data:**
- Interfaces: `videoframe`, `audiodata`, `videocolorspace`
- Specs: `docs/specs/videoframe/`, `docs/specs/audiodata/`, `docs/specs/videocolorspace/`
- Implementation: `lib/video-frame.ts`, `lib/audio-data.ts`

**Agent 4 - Encoded Chunks:**
- Interfaces: `encodedvideochunk`, `encodedaudiochunk`
- Specs: `docs/specs/encodedvideochunk/`, `docs/specs/encodedaudiochunk/`
- Implementation: `lib/encoded-chunks.ts`

**Agent 5 - Image Processing:**
- Interfaces: `imagedecoder`, `imagetrack`, `imagetracklist`
- Specs: `docs/specs/imagedecoder/`, `docs/specs/imagetrack/`, `docs/specs/imagetracklist/`
- Implementation: `lib/image-decoder.ts`, `lib/image-track.ts`, `lib/image-track-list.ts`

### Step 2: Agent Prompt Template

Each agent receives this prompt (customize INTERFACE_LIST and FILES):

```
You are analyzing WebCodecs spec compliance.

## Your Task
Analyze these interfaces: {INTERFACE_LIST}

For each interface:
1. Read the spec index.md at docs/specs/{interface}/index.md
2. Read method/property specs at docs/specs/{interface}/{member}/index.md
3. Read the implementation at {IMPLEMENTATION_FILE}
4. Compare and report compliance

## Spec Parsing
From each spec index.md, extract:
- Constructor section (## Constructor)
- Instance properties section (## Instance properties)
- Instance methods section (## Instance methods)
- Static methods section (## Static methods)
- Events (look for onX callbacks or addEventListener)

## Output Format
Return markdown for each interface in this exact format:

### {InterfaceName}

**Spec:** `docs/specs/{interface}/index.md`
**Implementation:** `{file}`

#### Constructor
- [x] or [ ] `ConstructorName(params)` - Notes

#### Instance Properties
- [x] or [ ] `propertyName: type` (readonly if applicable)

#### Instance Methods
- [x] or [ ] `methodName(params): returnType`

#### Static Methods
- [x] or [ ] `ClassName.staticMethod(params): returnType`

#### Events
- [x] or [ ] `eventname` / `oneventname` handler

#### Extensions (Non-Spec)
- Any properties/methods in implementation not in spec

#### Gaps
- List any spec items NOT implemented
- If none: "None"

---

Use [x] when fully implemented, [ ] when missing or partially implemented.
```

### Step 3: Collect Results

Wait for all 5 agents using TaskOutput with block=true.

### Step 4: Assemble Report

Build the complete report:

```markdown
# WebCodecs Compliance Report

> **Generated:** {ISO_DATE}
> **Spec Source:** [MDN WebCodecs](https://developer.mozilla.org/docs/Web/API/WebCodecs_API)
> **Implementation:** node-webcodecs

## Summary

| Interface | Constructor | Properties | Methods | Static | Events | Status |
|-----------|-------------|------------|---------|--------|--------|--------|
{SUMMARY_TABLE_ROWS}

## Detailed Compliance

{AGENT_1_RESULTS}

{AGENT_2_RESULTS}

{AGENT_3_RESULTS}

{AGENT_4_RESULTS}

{AGENT_5_RESULTS}

---

## Legend

- [x] Fully implemented and compliant
- [ ] Not implemented (gap)

## Notes

Extensions beyond W3C spec are marked under "Extensions (Non-Spec)" sections.
```

### Step 5: Atomic Write

Write the complete report to `docs/compliance.md` using a single Write tool call.

## Interface Mapping Reference

| Interface | Spec Directory | Implementation |
|-----------|----------------|----------------|
| VideoEncoder | `docs/specs/videoencoder/` | `lib/video-encoder.ts` |
| VideoDecoder | `docs/specs/videodecoder/` | `lib/video-decoder.ts` |
| AudioEncoder | `docs/specs/audioencoder/` | `lib/audio-encoder.ts` |
| AudioDecoder | `docs/specs/audiodecoder/` | `lib/audio-decoder.ts` |
| VideoFrame | `docs/specs/videoframe/` | `lib/video-frame.ts` |
| AudioData | `docs/specs/audiodata/` | `lib/audio-data.ts` |
| VideoColorSpace | `docs/specs/videocolorspace/` | `lib/video-frame.ts` |
| EncodedVideoChunk | `docs/specs/encodedvideochunk/` | `lib/encoded-chunks.ts` |
| EncodedAudioChunk | `docs/specs/encodedaudiochunk/` | `lib/encoded-chunks.ts` |
| ImageDecoder | `docs/specs/imagedecoder/` | `lib/image-decoder.ts` |
| ImageTrack | `docs/specs/imagetrack/` | `lib/image-track.ts` |
| ImageTrackList | `docs/specs/imagetracklist/` | `lib/image-track-list.ts` |

## Error Handling

If an agent fails:
1. Log the error
2. Mark that interface section as "ANALYSIS FAILED: {error}"
3. Continue with other results
4. Include error in final report
