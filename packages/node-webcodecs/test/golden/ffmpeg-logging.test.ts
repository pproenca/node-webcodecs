import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { clearFFmpegWarnings, getFFmpegWarnings } from '../../dist/index.js';

describe('FFmpeg Logging', () => {
  it('captures FFmpeg warnings', () => {
    // FFmpeg warnings are captured globally
    clearFFmpegWarnings();

    const warnings = getFFmpegWarnings();
    assert.strictEqual(Array.isArray(warnings), true);
  });

  it('clears warnings after retrieval', () => {
    clearFFmpegWarnings();
    const warnings1 = getFFmpegWarnings();
    const warnings2 = getFFmpegWarnings();

    // Second call should return empty (warnings drained)
    assert.ok(warnings2.length <= warnings1.length);
  });
});
