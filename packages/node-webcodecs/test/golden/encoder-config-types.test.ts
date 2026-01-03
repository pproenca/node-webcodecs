import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AacEncoderConfig, AvcEncoderConfig, HevcEncoderConfig } from '../../lib/types';

describe('Encoder Config Types', () => {
  describe('AvcEncoderConfig', () => {
    it('should accept valid AVC config with annexb format', () => {
      const config: AvcEncoderConfig = {
        format: 'annexb',
      };
      assert.strictEqual(config.format, 'annexb');
    });

    it('should accept valid AVC config with avc format', () => {
      const config: AvcEncoderConfig = {
        format: 'avc',
      };
      assert.strictEqual(config.format, 'avc');
    });

    it('should allow format to be optional', () => {
      const config: AvcEncoderConfig = {};
      assert.strictEqual(config.format, undefined); // Runtime default is annexb for backwards compat
    });
  });

  describe('HevcEncoderConfig', () => {
    it('should accept valid HEVC config with annexb format', () => {
      const config: HevcEncoderConfig = {
        format: 'annexb',
      };
      assert.strictEqual(config.format, 'annexb');
    });

    it('should accept valid HEVC config with hevc format', () => {
      const config: HevcEncoderConfig = {
        format: 'hevc',
      };
      assert.strictEqual(config.format, 'hevc');
    });
  });

  describe('AacEncoderConfig', () => {
    it('should accept valid AAC config with aac format', () => {
      const config: AacEncoderConfig = {
        format: 'aac',
      };
      assert.strictEqual(config.format, 'aac');
    });

    it('should accept valid AAC config with adts format', () => {
      const config: AacEncoderConfig = {
        format: 'adts',
      };
      assert.strictEqual(config.format, 'adts');
    });
  });
});
