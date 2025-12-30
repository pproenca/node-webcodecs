import {expect, it, describe} from 'vitest';
import type {
  AvcEncoderConfig,
  HevcEncoderConfig,
  AvcBitstreamFormat,
  HevcBitstreamFormat,
  AacEncoderConfig,
  AacBitstreamFormat,
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

    it('should allow format to be optional', () => {
      const config: AvcEncoderConfig = {};
      expect(config.format).toBeUndefined(); // Runtime default is annexb for backwards compat
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

  describe('AacEncoderConfig', () => {
    it('should accept valid AAC config with aac format', () => {
      const config: AacEncoderConfig = {
        format: 'aac',
      };
      expect(config.format).toBe('aac');
    });

    it('should accept valid AAC config with adts format', () => {
      const config: AacEncoderConfig = {
        format: 'adts',
      };
      expect(config.format).toBe('adts');
    });
  });
});
