// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Tests for ImageDecoder configuration options per W3C spec.

import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ImageDecoder } from '../../lib';

describe('ImageDecoder Configuration Options', () => {
  // Helper to create minimal valid PNG
  function createMinimalPNG(): Buffer {
    return Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
      0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90,
      0x77, 0x53, 0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8,
      0xcf, 0xc0, 0x00, 0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x18, 0xdd, 0x8d, 0xb4, 0x00, 0x00,
      0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
  }

  describe('colorSpaceConversion', () => {
    it('accepts "default" value', () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data,
        colorSpaceConversion: 'default',
      });
      assert.strictEqual(decoder.type, 'image/png');
      decoder.close();
    });

    it('accepts "none" value', () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data,
        colorSpaceConversion: 'none',
      });
      assert.strictEqual(decoder.type, 'image/png');
      decoder.close();
    });
  });

  describe('desiredWidth and desiredHeight', () => {
    // W3C Spec 10.3 - valid ImageDecoderInit validation steps 4-5:
    // "If desiredWidth exists and desiredHeight does not exist, return false."
    // "If desiredHeight exists and desiredWidth does not exist, return false."
    // Both must be present together or neither should be present.

    it('accepts desiredWidth/desiredHeight options together', async () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data,
        desiredWidth: 50,
        desiredHeight: 50,
      });

      assert.strictEqual(decoder.type, 'image/png');
      decoder.close();
    });

    it('accepts neither desiredWidth nor desiredHeight', async () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data,
        // No desiredWidth or desiredHeight
      });

      assert.strictEqual(decoder.type, 'image/png');
      decoder.close();
    });

    // W3C Spec 10.3 step 4: desiredWidth without desiredHeight is INVALID
    it('throws TypeError for desiredWidth without desiredHeight (spec 10.3 step 4)', () => {
      const data = createMinimalPNG();
      assert.throws(
        () =>
          new ImageDecoder({
            type: 'image/png',
            data,
            desiredWidth: 100,
            // No desiredHeight - violates spec step 4
          }),
        TypeError,
      );
    });

    // W3C Spec 10.3 step 5: desiredHeight without desiredWidth is INVALID
    it('throws TypeError for desiredHeight without desiredWidth (spec 10.3 step 5)', () => {
      const data = createMinimalPNG();
      assert.throws(
        () =>
          new ImageDecoder({
            type: 'image/png',
            data,
            desiredHeight: 100,
            // No desiredWidth - violates spec step 5
          }),
        TypeError,
      );
    });
  });

  describe('preferAnimation', () => {
    it('accepts preferAnimation option', () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data,
        preferAnimation: true,
      });
      assert.strictEqual(decoder.type, 'image/png');
      decoder.close();
    });

    it('accepts preferAnimation: false', () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data,
        preferAnimation: false,
      });
      assert.strictEqual(decoder.type, 'image/png');
      decoder.close();
    });
  });

  describe('transfer', () => {
    it('accepts transfer option with empty array', () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data,
        transfer: [],
      });
      assert.strictEqual(decoder.type, 'image/png');
      decoder.close();
    });

    it('detaches ArrayBuffers specified in transfer', () => {
      // Create a copy of the data in an ArrayBuffer
      const pngData = createMinimalPNG();
      const arrayBuffer = pngData.buffer.slice(
        pngData.byteOffset,
        pngData.byteOffset + pngData.byteLength,
      );

      const decoder = new ImageDecoder({
        type: 'image/png',
        data: new Uint8Array(arrayBuffer),
        transfer: [arrayBuffer],
      });

      // The ArrayBuffer should be detached (byteLength becomes 0)
      assert.strictEqual(arrayBuffer.byteLength, 0);
      assert.strictEqual(decoder.type, 'image/png');
      decoder.close();
    });
  });

  describe('combined options', () => {
    it('accepts all options together', () => {
      const data = createMinimalPNG();
      const decoder = new ImageDecoder({
        type: 'image/png',
        data,
        colorSpaceConversion: 'none',
        desiredWidth: 100,
        desiredHeight: 100,
        preferAnimation: false,
        transfer: [],
      });
      assert.strictEqual(decoder.type, 'image/png');
      // Note: complete may be false if the minimal PNG fails FFmpeg validation
      // The important thing is that all options are accepted without throwing
      decoder.close();
    });
  });

  describe('premultiplyAlpha option', () => {
    it('accepts premultiplyAlpha: premultiply', () => {
      const data = createMinimalPNG();

      const decoder = new ImageDecoder({
        type: 'image/png',
        data,
        premultiplyAlpha: 'premultiply',
      });

      assert.strictEqual(decoder.type, 'image/png');
      // Note: complete may be false if the minimal PNG fails FFmpeg validation
      // The important thing is that the option is accepted without throwing
      decoder.close();
    });

    it('accepts premultiplyAlpha: none', () => {
      const data = createMinimalPNG();

      const decoder = new ImageDecoder({
        type: 'image/png',
        data,
        premultiplyAlpha: 'none',
      });

      assert.strictEqual(decoder.type, 'image/png');
      decoder.close();
    });

    it('accepts premultiplyAlpha: default', () => {
      const data = createMinimalPNG();

      const decoder = new ImageDecoder({
        type: 'image/png',
        data,
        premultiplyAlpha: 'default',
      });

      assert.strictEqual(decoder.type, 'image/png');
      decoder.close();
    });

    it('throws TypeError for invalid value', () => {
      const data = createMinimalPNG();

      assert.throws(
        () =>
          new ImageDecoder({
            type: 'image/png',
            data,
            premultiplyAlpha: 'invalid' as 'none' | 'premultiply' | 'default',
          }),
        TypeError,
      );
    });
  });
});
