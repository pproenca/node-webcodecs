// test/golden/types-color-space.test.ts
import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type {
  VideoColorPrimaries,
  VideoMatrixCoefficients,
  VideoTransferCharacteristics,
} from '../../lib/types.js';

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
