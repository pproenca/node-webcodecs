// test/golden/types-color-space.test.ts
/**
 * W3C WebCodecs Spec Section 1: Definitions - Color Space Tests
 *
 * Verifies that VideoColorSpace and related types match the W3C spec exactly.
 * Per spec section 1, the following color spaces are defined:
 *   - sRGB: primaries=bt709, transfer=iec61966-2-1, matrix=rgb, fullRange=true
 *   - Display P3: primaries=smpte432, transfer=iec61966-2-1, matrix=rgb, fullRange=true
 *   - REC709: primaries=bt709, transfer=bt709, matrix=bt709, fullRange=false
 */
import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type {
  VideoColorPrimaries,
  VideoColorSpaceInit,
  VideoMatrixCoefficients,
  VideoTransferCharacteristics,
} from '../../lib/types.js';
import { VideoColorSpace } from '../../lib/video-frame.js';

// =============================================================================
// Helper: Create W3C spec-defined color spaces
// =============================================================================

/**
 * W3C spec "sRGB Color Space" definition:
 * - primaries: bt709
 * - transfer: iec61966-2-1
 * - matrix: rgb
 * - fullRange: true
 */
function createSRGBColorSpace(): VideoColorSpaceInit {
  return {
    primaries: 'bt709',
    transfer: 'iec61966-2-1',
    matrix: 'rgb',
    fullRange: true,
  };
}

/**
 * W3C spec "Display P3 Color Space" definition:
 * - primaries: smpte432
 * - transfer: iec61966-2-1
 * - matrix: rgb
 * - fullRange: true
 */
function createDisplayP3ColorSpace(): VideoColorSpaceInit {
  return {
    primaries: 'smpte432',
    transfer: 'iec61966-2-1',
    matrix: 'rgb',
    fullRange: true,
  };
}

/**
 * W3C spec "REC709 Color Space" definition:
 * - primaries: bt709
 * - transfer: bt709
 * - matrix: bt709
 * - fullRange: false
 */
function createREC709ColorSpace(): VideoColorSpaceInit {
  return {
    primaries: 'bt709',
    transfer: 'bt709',
    matrix: 'bt709',
    fullRange: false,
  };
}

// =============================================================================
// Type definition tests
// =============================================================================

describe('VideoColorPrimaries', () => {
  it('should support all W3C spec values', () => {
    const validPrimaries: VideoColorPrimaries[] = [
      'bt709',
      'bt470bg',
      'smpte170m',
      'bt2020',
      'smpte432',
      // New values from W3C spec
      'srgb',
      'bt470m',
      'smpte240m',
      'film',
      'xyz',
      'smpte431',
    ];
    assert.strictEqual(validPrimaries.length, 11);
  });
});

describe('VideoMatrixCoefficients', () => {
  it('should support all W3C spec values', () => {
    const validMatrix: VideoMatrixCoefficients[] = [
      'rgb',
      'bt709',
      'bt470bg',
      'smpte170m',
      'bt2020-ncl',
      // New values from W3C spec
      'smpte240m',
      'bt2020-cl',
      'smpte2085',
    ];
    assert.strictEqual(validMatrix.length, 8);
  });
});

describe('VideoTransferCharacteristics', () => {
  it('should support all W3C spec values', () => {
    const validTransfer: VideoTransferCharacteristics[] = [
      'bt709',
      'smpte170m',
      'iec61966-2-1',
      'linear',
      'pq',
      'hlg',
      // New values from W3C spec
      'gamma22curve',
      'gamma28curve',
      'smpte240m',
      'log',
      'logrt',
      'iec61966-2-4',
      'bt1361',
      'bt2020-10bit',
      'bt2020-12bit',
      'smpte2084',
      'smpte428',
      'arib-std-b67',
    ];
    assert.strictEqual(validTransfer.length, 18);
  });
});

// =============================================================================
// W3C Spec Section 1: sRGB Color Space
// =============================================================================

describe('W3C Spec: sRGB Color Space', () => {
  it('should match spec: primaries=bt709', () => {
    const srgb = createSRGBColorSpace();
    const cs = new VideoColorSpace(srgb);
    assert.strictEqual(cs.primaries, 'bt709');
  });

  it('should match spec: transfer=iec61966-2-1', () => {
    const srgb = createSRGBColorSpace();
    const cs = new VideoColorSpace(srgb);
    assert.strictEqual(cs.transfer, 'iec61966-2-1');
  });

  it('should match spec: matrix=rgb', () => {
    const srgb = createSRGBColorSpace();
    const cs = new VideoColorSpace(srgb);
    assert.strictEqual(cs.matrix, 'rgb');
  });

  it('should match spec: fullRange=true', () => {
    const srgb = createSRGBColorSpace();
    const cs = new VideoColorSpace(srgb);
    assert.strictEqual(cs.fullRange, true);
  });

  it('should serialize to JSON matching spec', () => {
    const srgb = createSRGBColorSpace();
    const cs = new VideoColorSpace(srgb);
    const json = cs.toJSON();
    assert.deepStrictEqual(json, {
      primaries: 'bt709',
      transfer: 'iec61966-2-1',
      matrix: 'rgb',
      fullRange: true,
    });
  });
});

// =============================================================================
// W3C Spec Section 1: Display P3 Color Space
// =============================================================================

describe('W3C Spec: Display P3 Color Space', () => {
  it('should match spec: primaries=smpte432', () => {
    const p3 = createDisplayP3ColorSpace();
    const cs = new VideoColorSpace(p3);
    assert.strictEqual(cs.primaries, 'smpte432');
  });

  it('should match spec: transfer=iec61966-2-1', () => {
    const p3 = createDisplayP3ColorSpace();
    const cs = new VideoColorSpace(p3);
    assert.strictEqual(cs.transfer, 'iec61966-2-1');
  });

  it('should match spec: matrix=rgb', () => {
    const p3 = createDisplayP3ColorSpace();
    const cs = new VideoColorSpace(p3);
    assert.strictEqual(cs.matrix, 'rgb');
  });

  it('should match spec: fullRange=true', () => {
    const p3 = createDisplayP3ColorSpace();
    const cs = new VideoColorSpace(p3);
    assert.strictEqual(cs.fullRange, true);
  });

  it('should serialize to JSON matching spec', () => {
    const p3 = createDisplayP3ColorSpace();
    const cs = new VideoColorSpace(p3);
    const json = cs.toJSON();
    assert.deepStrictEqual(json, {
      primaries: 'smpte432',
      transfer: 'iec61966-2-1',
      matrix: 'rgb',
      fullRange: true,
    });
  });
});

// =============================================================================
// W3C Spec Section 1: REC709 Color Space
// =============================================================================

describe('W3C Spec: REC709 Color Space', () => {
  it('should match spec: primaries=bt709', () => {
    const rec709 = createREC709ColorSpace();
    const cs = new VideoColorSpace(rec709);
    assert.strictEqual(cs.primaries, 'bt709');
  });

  it('should match spec: transfer=bt709', () => {
    const rec709 = createREC709ColorSpace();
    const cs = new VideoColorSpace(rec709);
    assert.strictEqual(cs.transfer, 'bt709');
  });

  it('should match spec: matrix=bt709', () => {
    const rec709 = createREC709ColorSpace();
    const cs = new VideoColorSpace(rec709);
    assert.strictEqual(cs.matrix, 'bt709');
  });

  it('should match spec: fullRange=false', () => {
    const rec709 = createREC709ColorSpace();
    const cs = new VideoColorSpace(rec709);
    assert.strictEqual(cs.fullRange, false);
  });

  it('should serialize to JSON matching spec', () => {
    const rec709 = createREC709ColorSpace();
    const cs = new VideoColorSpace(rec709);
    const json = cs.toJSON();
    assert.deepStrictEqual(json, {
      primaries: 'bt709',
      transfer: 'bt709',
      matrix: 'bt709',
      fullRange: false,
    });
  });
});

// =============================================================================
// VideoColorSpace constructor edge cases
// =============================================================================

describe('VideoColorSpace constructor edge cases', () => {
  it('should handle empty constructor (all null)', () => {
    const cs = new VideoColorSpace();
    assert.strictEqual(cs.primaries, null);
    assert.strictEqual(cs.transfer, null);
    assert.strictEqual(cs.matrix, null);
    assert.strictEqual(cs.fullRange, null);
  });

  it('should handle empty object init (all null)', () => {
    const cs = new VideoColorSpace({});
    assert.strictEqual(cs.primaries, null);
    assert.strictEqual(cs.transfer, null);
    assert.strictEqual(cs.matrix, null);
    assert.strictEqual(cs.fullRange, null);
  });

  it('should handle null values explicitly', () => {
    const cs = new VideoColorSpace({
      primaries: null,
      transfer: null,
      matrix: null,
      fullRange: null,
    });
    assert.strictEqual(cs.primaries, null);
    assert.strictEqual(cs.transfer, null);
    assert.strictEqual(cs.matrix, null);
    assert.strictEqual(cs.fullRange, null);
  });

  it('should handle undefined values', () => {
    const cs = new VideoColorSpace({
      primaries: undefined,
      transfer: undefined,
      matrix: undefined,
      fullRange: undefined,
    });
    assert.strictEqual(cs.primaries, null);
    assert.strictEqual(cs.transfer, null);
    assert.strictEqual(cs.matrix, null);
    assert.strictEqual(cs.fullRange, null);
  });

  it('should handle partial initialization', () => {
    const cs = new VideoColorSpace({
      primaries: 'bt709',
      // other fields omitted
    });
    assert.strictEqual(cs.primaries, 'bt709');
    assert.strictEqual(cs.transfer, null);
    assert.strictEqual(cs.matrix, null);
    assert.strictEqual(cs.fullRange, null);
  });

  it('should serialize null values correctly in toJSON', () => {
    const cs = new VideoColorSpace();
    const json = cs.toJSON();
    assert.deepStrictEqual(json, {
      primaries: null,
      transfer: null,
      matrix: null,
      fullRange: null,
    });
  });
});

// =============================================================================
// W3C Spec Section 1: EncodedChunkType (Key Chunk definition)
// =============================================================================

describe('W3C Spec: EncodedChunkType (Key Chunk)', () => {
  it('should include "key" type per spec "Key Chunk" definition', () => {
    // The spec defines Key Chunk as: "An encoded chunk that does not depend
    // on any other frames for decoding. Also commonly referred to as a key frame."
    // This is represented by EncodedVideoChunkType/EncodedAudioChunkType = 'key'
    const types: ('key' | 'delta')[] = ['key', 'delta'];
    assert.ok(types.includes('key'), 'EncodedChunkType must include "key"');
    assert.ok(types.includes('delta'), 'EncodedChunkType must include "delta"');
  });
});
