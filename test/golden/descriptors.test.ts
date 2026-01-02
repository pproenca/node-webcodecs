import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createEncoderConfigDescriptor } from '../../dist/index.js';

describe('VideoEncoderConfigDescriptor', () => {
  it('extracts config with defaults', () => {
    const config = {
      codec: 'avc1.42E01E',
      width: 1920,
      height: 1080,
    };

    const desc = createEncoderConfigDescriptor(config);

    assert.strictEqual(desc.codec, 'avc1.42E01E');
    assert.strictEqual(desc.width, 1920);
    assert.strictEqual(desc.height, 1080);
    assert.strictEqual(desc.displayWidth, 1920); // Defaults to width
    assert.strictEqual(desc.displayHeight, 1080); // Defaults to height
    assert.strictEqual(desc.latencyMode, 'quality'); // Default
    assert.strictEqual(desc.bitrateMode, 'variable'); // Default
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
    assert.strictEqual(desc.displayWidth, 1280);
    assert.strictEqual(desc.displayHeight, 720);
  });
});
