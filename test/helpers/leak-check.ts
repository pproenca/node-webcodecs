// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

/**
 * Leak detection helper using native instance counters.
 *
 * This provides deterministic leak detection without requiring Valgrind.
 * Works by comparing counter snapshots before and after test execution.
 */

import { binding } from '../../dist/binding.js';

const native = binding as { getCounters: () => Record<string, number> };

export function forceGC(): void {
  if (global.gc) {
    global.gc();
  }
}

export async function waitForGC(cycles = 3): Promise<void> {
  for (let i = 0; i < cycles; i++) {
    forceGC();
    await new Promise((r) => setTimeout(r, 10));
  }
}

export interface CounterSnapshot {
  videoFrames: number;
  audioData: number;
  videoEncoders: number;
  videoDecoders: number;
  audioEncoders: number;
  audioDecoders: number;
}

export function getCounters(): CounterSnapshot {
  return native.getCounters();
}

export function assertNoLeaks(
  before: CounterSnapshot,
  after: CounterSnapshot,
  context = ''
): void {
  const prefix = context ? '[' + context + '] ' : '';
  const leaks: string[] = [];

  if (after.videoFrames !== before.videoFrames) {
    leaks.push(
      'VideoFrame leak detected: ' +
        (after.videoFrames - before.videoFrames) +
        ' instances not released'
    );
  }
  if (after.audioData !== before.audioData) {
    leaks.push(
      'AudioData leak detected: ' +
        (after.audioData - before.audioData) +
        ' instances not released'
    );
  }
  if (after.videoEncoders !== before.videoEncoders) {
    leaks.push(
      'VideoEncoder leak detected: ' +
        (after.videoEncoders - before.videoEncoders) +
        ' instances not released'
    );
  }
  if (after.videoDecoders !== before.videoDecoders) {
    leaks.push(
      'VideoDecoder leak detected: ' +
        (after.videoDecoders - before.videoDecoders) +
        ' instances not released'
    );
  }
  if (after.audioEncoders !== before.audioEncoders) {
    leaks.push(
      'AudioEncoder leak detected: ' +
        (after.audioEncoders - before.audioEncoders) +
        ' instances not released'
    );
  }
  if (after.audioDecoders !== before.audioDecoders) {
    leaks.push(
      'AudioDecoder leak detected: ' +
        (after.audioDecoders - before.audioDecoders) +
        ' instances not released'
    );
  }

  if (leaks.length > 0) {
    throw new Error(prefix + leaks.join('; '));
  }
}
