import { describe, expect, it } from 'vitest';

const { createEncoderConfigDescriptor } = await import('../../dist/index.js');

describe('VideoEncoderConfigDescriptor', () => {
  it('extracts config with defaults', () => {
    const config = {
      codec: 'avc1.42E01E',
      width: 1920,
      height: 1080,
    };

    const desc = createEncoderConfigDescriptor(config);

    expect(desc.codec).toBe('avc1.42E01E');
    expect(desc.width).toBe(1920);
    expect(desc.height).toBe(1080);
    expect(desc.displayWidth).toBe(1920); // Defaults to width
    expect(desc.displayHeight).toBe(1080); // Defaults to height
    expect(desc.latencyMode).toBe('quality'); // Default
    expect(desc.bitrateMode).toBe('variable'); // Default
  });

  it('uses provided display dimensions', () => {
    const config = {
      codec: 'avc1.42E01E',
      width: 1920,
      height: 1080,
      displayWidth: 1280,
      displayHeight: 720,
    };

    const desc = createEncoderConfigDescriptor(config);
    expect(desc.displayWidth).toBe(1280);
    expect(desc.displayHeight).toBe(720);
  });
});
