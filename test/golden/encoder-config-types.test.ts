import {expect, it, describe} from 'vitest';
import type {
  AvcEncoderConfig,
  HevcEncoderConfig,
  AvcBitstreamFormat,
  HevcBitstreamFormat,
} from '../../lib/types';

describe('Encoder Config Types', () => {
  describe('AvcEncoderConfig', () => {
    it('should accept valid AVC config with annexb format', () => {
      const config: AvcEncoderConfig = {
        format: 'annexb',
      };
      expect(config.format).toBe('annexb');
    });

    it('should accept valid AVC config with avc format', () => {
      const config: AvcEncoderConfig = {
        format: 'avc',
      };
      expect(config.format).toBe('avc');
    });

    it('should default format to avc when not specified', () => {
      const config: AvcEncoderConfig = {};
      expect(config.format).toBeUndefined();
    });
  });

  describe('HevcEncoderConfig', () => {
    it('should accept valid HEVC config with annexb format', () => {
      const config: HevcEncoderConfig = {
        format: 'annexb',
      };
      expect(config.format).toBe('annexb');
    });

    it('should accept valid HEVC config with hevc format', () => {
      const config: HevcEncoderConfig = {
        format: 'hevc',
      };
      expect(config.format).toBe('hevc');
    });
  });
});
