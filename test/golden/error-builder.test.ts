import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ErrorBuilder } from '../../dist/index.js';

describe('ErrorBuilder', () => {
  it('creates error with operation and FFmpeg code', () => {
    const builder = new ErrorBuilder('avcodec_send_frame');
    builder.withFFmpegCode(-22); // EINVAL

    const message = builder.build();
    assert.ok(message.includes('avcodec_send_frame'));
    // glibc: "Invalid argument", musl: "Error number -22 occurred"
    assert.match(message, /Invalid argument|(-22|EINVAL)/);
  });

  it('chains context and values', () => {
    const message = new ErrorBuilder('encode')
      .withContext('while encoding frame')
      .withValue('pts', 12345)
      .withValue('format', 'I420')
      .build();

    assert.ok(message.includes('encode'));
    assert.ok(message.includes('while encoding frame'));
    assert.ok(message.includes('pts=12345'));
    assert.ok(message.includes('format=I420'));
  });

  it('throws as Napi::Error', () => {
    const builder = new ErrorBuilder('test_operation');
    builder.withFFmpegCode(-1);

    assert.throws(() => { builder.throwError(); }, /test_operation/);
  });
});
