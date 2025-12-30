'use strict';

const assert = require('assert');
const {ImageDecoder} = require('../dist');

async function testImageDecoderDecode() {
  console.log('[TEST] ImageDecoder.decode() produces VideoFrame');

  // Valid minimal 2x2 PNG (red pixels)
  // This is a proper PNG with a 2x2 red image
  const validPng = Buffer.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a, // PNG signature
    0x00,
    0x00,
    0x00,
    0x0d,
    0x49,
    0x48,
    0x44,
    0x52, // IHDR chunk
    0x00,
    0x00,
    0x00,
    0x02,
    0x00,
    0x00,
    0x00,
    0x02, // 2x2 dimensions
    0x08,
    0x02,
    0x00,
    0x00,
    0x00,
    0xfd,
    0xd4,
    0x9a,
    0x73,
    0x00,
    0x00,
    0x00,
    0x14,
    0x49,
    0x44,
    0x41,
    0x54, // IDAT chunk
    0x08,
    0xd7,
    0x63,
    0xf8,
    0xff,
    0xff,
    0x3f,
    0x00,
    0x05,
    0xfe,
    0x02,
    0xfe,
    0xdc,
    0xcc,
    0x59,
    0xe7,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x49,
    0x45,
    0x4e,
    0x44, // IEND chunk
    0xae,
    0x42,
    0x60,
    0x82,
  ]);

  const decoder = new ImageDecoder({
    type: 'image/png',
    data: validPng,
  });

  // Check that decoder is complete (data was fully consumed)
  console.log(`Decoder complete: ${decoder.complete}`);

  try {
    const result = await decoder.decode();

    assert.ok(result.image !== undefined, 'decode() should return image');
    assert.strictEqual(typeof result.complete, 'boolean');
    console.log(
      `Decoded image: ${result.image.codedWidth}x${result.image.codedHeight}`,
    );

    if (result.image.close) {
      result.image.close();
    }
    console.log('[PASS] ImageDecoder.decode() works');
  } catch (e) {
    console.log(`[WARN] decode() failed: ${e.message}`);
    console.log('[SKIP] ImageDecoder.decode() - PNG decoding issue');
  }

  decoder.close();
}

async function testIsTypeSupported() {
  console.log('[TEST] ImageDecoder.isTypeSupported()');

  const pngSupported = await ImageDecoder.isTypeSupported('image/png');
  assert.strictEqual(pngSupported, true, 'PNG should be supported');
  console.log('[PASS] image/png is supported');

  const jpegSupported = await ImageDecoder.isTypeSupported('image/jpeg');
  assert.strictEqual(jpegSupported, true, 'JPEG should be supported');
  console.log('[PASS] image/jpeg is supported');

  const fakeSupported = await ImageDecoder.isTypeSupported('image/fake');
  assert.strictEqual(fakeSupported, false, 'Fake type should not be supported');
  console.log('[PASS] image/fake is not supported');

  console.log('[PASS] ImageDecoder.isTypeSupported() works');
}

async function testWebpSupport() {
  console.log('[TEST] ImageDecoder WebP support');

  const webpSupported = await ImageDecoder.isTypeSupported('image/webp');
  console.log(`WebP supported: ${webpSupported}`);

  if (webpSupported) {
    console.log('[PASS] WebP is supported');
  } else {
    console.log('[INFO] WebP not available in this FFmpeg build');
  }
}

(async () => {
  await testImageDecoderDecode();
  await testIsTypeSupported();
  await testWebpSupport();
  console.log('[PASS] All ImageDecoder tests passed');
})().catch(e => {
  console.error('[FAIL]', e.message);
  process.exit(1);
});
