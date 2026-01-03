/**
 * Tests for W3C WebCodecs spec sections 9.9-9.12:
 * - 9.9 VideoColorSpace Interface
 * - 9.10 VideoColorPrimaries
 * - 9.11 VideoTransferCharacteristics
 * - 9.12 VideoMatrixCoefficients
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { VideoColorSpace } from '../../lib';
import type {
  VideoColorPrimaries,
  VideoColorSpaceInit,
  VideoMatrixCoefficients,
  VideoTransferCharacteristics,
} from '../../lib/types';

describe('VideoColorSpace: 9.9-9.12', () => {
  // =========================================================================
  // 9.9 VideoColorSpace Interface
  // =========================================================================

  describe('9.9 VideoColorSpace Interface', () => {
    describe('9.9.2 Constructor', () => {
      it('should construct with no arguments', () => {
        const colorSpace = new VideoColorSpace();

        // All properties default to null
        assert.strictEqual(colorSpace.primaries, null);
        assert.strictEqual(colorSpace.transfer, null);
        assert.strictEqual(colorSpace.matrix, null);
        assert.strictEqual(colorSpace.fullRange, null);
      });

      it('should construct with full init object', () => {
        const init: VideoColorSpaceInit = {
          primaries: 'bt709',
          transfer: 'bt709',
          matrix: 'bt709',
          fullRange: true,
        };
        const colorSpace = new VideoColorSpace(init);

        assert.strictEqual(colorSpace.primaries, 'bt709');
        assert.strictEqual(colorSpace.transfer, 'bt709');
        assert.strictEqual(colorSpace.matrix, 'bt709');
        assert.strictEqual(colorSpace.fullRange, true);
      });

      it('should construct with partial init object', () => {
        const colorSpace = new VideoColorSpace({
          primaries: 'bt2020',
          // other properties undefined
        });

        assert.strictEqual(colorSpace.primaries, 'bt2020');
        assert.strictEqual(colorSpace.transfer, null);
        assert.strictEqual(colorSpace.matrix, null);
        assert.strictEqual(colorSpace.fullRange, null);
      });

      it('should handle null values in init', () => {
        const colorSpace = new VideoColorSpace({
          primaries: null,
          transfer: null,
          matrix: null,
          fullRange: null,
        });

        assert.strictEqual(colorSpace.primaries, null);
        assert.strictEqual(colorSpace.transfer, null);
        assert.strictEqual(colorSpace.matrix, null);
        assert.strictEqual(colorSpace.fullRange, null);
      });
    });

    describe('9.9.3 Attributes', () => {
      it('should have readonly primaries attribute', () => {
        const colorSpace = new VideoColorSpace({ primaries: 'bt709' });
        assert.strictEqual(colorSpace.primaries, 'bt709');
      });

      it('should have readonly transfer attribute', () => {
        const colorSpace = new VideoColorSpace({ transfer: 'iec61966-2-1' });
        assert.strictEqual(colorSpace.transfer, 'iec61966-2-1');
      });

      it('should have readonly matrix attribute', () => {
        const colorSpace = new VideoColorSpace({ matrix: 'rgb' });
        assert.strictEqual(colorSpace.matrix, 'rgb');
      });

      it('should have readonly fullRange attribute', () => {
        const colorSpace = new VideoColorSpace({ fullRange: false });
        assert.strictEqual(colorSpace.fullRange, false);
      });
    });

    describe('toJSON()', () => {
      it('should return VideoColorSpaceInit object', () => {
        const init: VideoColorSpaceInit = {
          primaries: 'bt709',
          transfer: 'bt709',
          matrix: 'bt709',
          fullRange: true,
        };
        const colorSpace = new VideoColorSpace(init);
        const json = colorSpace.toJSON();

        assert.deepStrictEqual(json, init);
      });

      it('should return object with null values for empty init', () => {
        const colorSpace = new VideoColorSpace();
        const json = colorSpace.toJSON();

        assert.strictEqual(json.primaries, null);
        assert.strictEqual(json.transfer, null);
        assert.strictEqual(json.matrix, null);
        assert.strictEqual(json.fullRange, null);
      });

      it('should be round-trip compatible', () => {
        const init: VideoColorSpaceInit = {
          primaries: 'smpte432',
          transfer: 'pq',
          matrix: 'bt2020-ncl',
          fullRange: false,
        };
        const colorSpace1 = new VideoColorSpace(init);
        const colorSpace2 = new VideoColorSpace(colorSpace1.toJSON());

        assert.strictEqual(colorSpace2.primaries, init.primaries);
        assert.strictEqual(colorSpace2.transfer, init.transfer);
        assert.strictEqual(colorSpace2.matrix, init.matrix);
        assert.strictEqual(colorSpace2.fullRange, init.fullRange);
      });
    });
  });

  // =========================================================================
  // 9.10 VideoColorPrimaries
  // =========================================================================

  describe('9.10 VideoColorPrimaries', () => {
    // All 5 spec-defined primaries
    const specPrimaries: VideoColorPrimaries[] = [
      'bt709',
      'bt470bg',
      'smpte170m',
      'bt2020',
      'smpte432',
    ];

    it('should accept all 5 spec-defined primaries values', () => {
      for (const primaries of specPrimaries) {
        const colorSpace = new VideoColorSpace({ primaries });
        assert.strictEqual(colorSpace.primaries, primaries);
      }
    });

    it('should accept bt709 (BT.709, sRGB)', () => {
      const colorSpace = new VideoColorSpace({ primaries: 'bt709' });
      assert.strictEqual(colorSpace.primaries, 'bt709');
    });

    it('should accept bt470bg (BT.601 PAL)', () => {
      const colorSpace = new VideoColorSpace({ primaries: 'bt470bg' });
      assert.strictEqual(colorSpace.primaries, 'bt470bg');
    });

    it('should accept smpte170m (BT.601 NTSC)', () => {
      const colorSpace = new VideoColorSpace({ primaries: 'smpte170m' });
      assert.strictEqual(colorSpace.primaries, 'smpte170m');
    });

    it('should accept bt2020 (BT.2020, BT.2100)', () => {
      const colorSpace = new VideoColorSpace({ primaries: 'bt2020' });
      assert.strictEqual(colorSpace.primaries, 'bt2020');
    });

    it('should accept smpte432 (Display P3)', () => {
      const colorSpace = new VideoColorSpace({ primaries: 'smpte432' });
      assert.strictEqual(colorSpace.primaries, 'smpte432');
    });
  });

  // =========================================================================
  // 9.11 VideoTransferCharacteristics
  // =========================================================================

  describe('9.11 VideoTransferCharacteristics', () => {
    // All 6 spec-defined transfer characteristics
    const specTransfers: VideoTransferCharacteristics[] = [
      'bt709',
      'smpte170m',
      'iec61966-2-1',
      'linear',
      'pq',
      'hlg',
    ];

    it('should accept all 6 spec-defined transfer values', () => {
      for (const transfer of specTransfers) {
        const colorSpace = new VideoColorSpace({ transfer });
        assert.strictEqual(colorSpace.transfer, transfer);
      }
    });

    it('should accept bt709 (BT.709)', () => {
      const colorSpace = new VideoColorSpace({ transfer: 'bt709' });
      assert.strictEqual(colorSpace.transfer, 'bt709');
    });

    it('should accept smpte170m (BT.601)', () => {
      const colorSpace = new VideoColorSpace({ transfer: 'smpte170m' });
      assert.strictEqual(colorSpace.transfer, 'smpte170m');
    });

    it('should accept iec61966-2-1 (sRGB)', () => {
      const colorSpace = new VideoColorSpace({ transfer: 'iec61966-2-1' });
      assert.strictEqual(colorSpace.transfer, 'iec61966-2-1');
    });

    it('should accept linear (Linear RGB)', () => {
      const colorSpace = new VideoColorSpace({ transfer: 'linear' });
      assert.strictEqual(colorSpace.transfer, 'linear');
    });

    it('should accept pq (BT.2100 PQ HDR)', () => {
      const colorSpace = new VideoColorSpace({ transfer: 'pq' });
      assert.strictEqual(colorSpace.transfer, 'pq');
    });

    it('should accept hlg (BT.2100 HLG HDR)', () => {
      const colorSpace = new VideoColorSpace({ transfer: 'hlg' });
      assert.strictEqual(colorSpace.transfer, 'hlg');
    });
  });

  // =========================================================================
  // 9.12 VideoMatrixCoefficients
  // =========================================================================

  describe('9.12 VideoMatrixCoefficients', () => {
    // All 5 spec-defined matrix coefficients
    const specMatrices: VideoMatrixCoefficients[] = [
      'rgb',
      'bt709',
      'bt470bg',
      'smpte170m',
      'bt2020-ncl',
    ];

    it('should accept all 5 spec-defined matrix values', () => {
      for (const matrix of specMatrices) {
        const colorSpace = new VideoColorSpace({ matrix });
        assert.strictEqual(colorSpace.matrix, matrix);
      }
    });

    it('should accept rgb (Identity, RGB)', () => {
      const colorSpace = new VideoColorSpace({ matrix: 'rgb' });
      assert.strictEqual(colorSpace.matrix, 'rgb');
    });

    it('should accept bt709', () => {
      const colorSpace = new VideoColorSpace({ matrix: 'bt709' });
      assert.strictEqual(colorSpace.matrix, 'bt709');
    });

    it('should accept bt470bg (BT.601 PAL)', () => {
      const colorSpace = new VideoColorSpace({ matrix: 'bt470bg' });
      assert.strictEqual(colorSpace.matrix, 'bt470bg');
    });

    it('should accept smpte170m (BT.601 NTSC)', () => {
      const colorSpace = new VideoColorSpace({ matrix: 'smpte170m' });
      assert.strictEqual(colorSpace.matrix, 'smpte170m');
    });

    it('should accept bt2020-ncl (BT.2020 NCL)', () => {
      const colorSpace = new VideoColorSpace({ matrix: 'bt2020-ncl' });
      assert.strictEqual(colorSpace.matrix, 'bt2020-ncl');
    });
  });

  // =========================================================================
  // Common Color Space Configurations
  // =========================================================================

  describe('Common Color Space Configurations', () => {
    it('should represent sRGB color space', () => {
      const srgb = new VideoColorSpace({
        primaries: 'bt709',
        transfer: 'iec61966-2-1',
        matrix: 'rgb',
        fullRange: true,
      });

      assert.strictEqual(srgb.primaries, 'bt709');
      assert.strictEqual(srgb.transfer, 'iec61966-2-1');
      assert.strictEqual(srgb.matrix, 'rgb');
      assert.strictEqual(srgb.fullRange, true);
    });

    it('should represent Display P3 color space', () => {
      const displayP3 = new VideoColorSpace({
        primaries: 'smpte432',
        transfer: 'iec61966-2-1',
        matrix: 'rgb',
        fullRange: true,
      });

      assert.strictEqual(displayP3.primaries, 'smpte432');
      assert.strictEqual(displayP3.transfer, 'iec61966-2-1');
    });

    it('should represent BT.709 (REC709) color space', () => {
      const rec709 = new VideoColorSpace({
        primaries: 'bt709',
        transfer: 'bt709',
        matrix: 'bt709',
        fullRange: false,
      });

      assert.strictEqual(rec709.primaries, 'bt709');
      assert.strictEqual(rec709.transfer, 'bt709');
      assert.strictEqual(rec709.matrix, 'bt709');
      assert.strictEqual(rec709.fullRange, false);
    });

    it('should represent BT.2020 HDR PQ color space', () => {
      const bt2020Pq = new VideoColorSpace({
        primaries: 'bt2020',
        transfer: 'pq',
        matrix: 'bt2020-ncl',
        fullRange: false,
      });

      assert.strictEqual(bt2020Pq.primaries, 'bt2020');
      assert.strictEqual(bt2020Pq.transfer, 'pq');
      assert.strictEqual(bt2020Pq.matrix, 'bt2020-ncl');
    });

    it('should represent BT.2020 HDR HLG color space', () => {
      const bt2020Hlg = new VideoColorSpace({
        primaries: 'bt2020',
        transfer: 'hlg',
        matrix: 'bt2020-ncl',
        fullRange: false,
      });

      assert.strictEqual(bt2020Hlg.primaries, 'bt2020');
      assert.strictEqual(bt2020Hlg.transfer, 'hlg');
    });
  });

  // =========================================================================
  // fullRange Attribute
  // =========================================================================

  describe('fullRange Attribute', () => {
    it('should accept true', () => {
      const colorSpace = new VideoColorSpace({ fullRange: true });
      assert.strictEqual(colorSpace.fullRange, true);
    });

    it('should accept false', () => {
      const colorSpace = new VideoColorSpace({ fullRange: false });
      assert.strictEqual(colorSpace.fullRange, false);
    });

    it('should accept null', () => {
      const colorSpace = new VideoColorSpace({ fullRange: null });
      assert.strictEqual(colorSpace.fullRange, null);
    });

    it('should default to null when not provided', () => {
      const colorSpace = new VideoColorSpace({});
      assert.strictEqual(colorSpace.fullRange, null);
    });
  });

  // =========================================================================
  // Type exports
  // =========================================================================

  describe('Type exports', () => {
    it('should export VideoColorSpace class', () => {
      assert.ok(VideoColorSpace);
      assert.strictEqual(typeof VideoColorSpace, 'function');
    });

    it('should export VideoColorSpaceInit type', () => {
      // Type check - if this compiles, the type is exported
      const init: VideoColorSpaceInit = {
        primaries: 'bt709',
        transfer: 'bt709',
        matrix: 'bt709',
        fullRange: true,
      };
      assert.ok(init);
    });

    it('should export VideoColorPrimaries type', () => {
      const primaries: VideoColorPrimaries = 'bt709';
      assert.strictEqual(primaries, 'bt709');
    });

    it('should export VideoTransferCharacteristics type', () => {
      const transfer: VideoTransferCharacteristics = 'iec61966-2-1';
      assert.strictEqual(transfer, 'iec61966-2-1');
    });

    it('should export VideoMatrixCoefficients type', () => {
      const matrix: VideoMatrixCoefficients = 'rgb';
      assert.strictEqual(matrix, 'rgb');
    });
  });
});
