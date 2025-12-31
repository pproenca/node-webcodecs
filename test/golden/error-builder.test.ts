import { describe, expect, it } from 'vitest';

const { ErrorBuilder } = await import('../../dist/index.js');

describe('ErrorBuilder', () => {
  it('creates error with operation and FFmpeg code', () => {
    const builder = new ErrorBuilder('avcodec_send_frame');
    builder.withFFmpegCode(-22); // EINVAL

    const message = builder.build();
    expect(message).toContain('avcodec_send_frame');
    expect(message).toContain('Invalid argument');
  });

  it('chains context and values', () => {
    const message = new ErrorBuilder('encode')
      .withContext('while encoding frame')
      .withValue('pts', 12345)
      .withValue('format', 'I420')
      .build();

    expect(message).toContain('encode');
    expect(message).toContain('while encoding frame');
    expect(message).toContain('pts=12345');
    expect(message).toContain('format=I420');
  });

  it('throws as Napi::Error', () => {
    const builder = new ErrorBuilder('test_operation');
    builder.withFFmpegCode(-1);

    expect(() => builder.throwError()).toThrow(/test_operation/);
  });
});
