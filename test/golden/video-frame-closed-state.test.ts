// test/golden/video-frame-closed-state.test.ts
import * as assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { TEST_CONSTANTS } from '../fixtures/test-helpers';

describe('VideoFrame closed state per W3C spec', () => {
  let frame: VideoFrame;
  const { width, height } = TEST_CONSTANTS.SMALL_FRAME;

  before(() => {
    const data = new Uint8Array(width * height * TEST_CONSTANTS.RGBA_BPP);
    frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: width,
      codedHeight: height,
      timestamp: 1000,
      duration: 5000,
    });
    frame.close();
  });

  after(() => {
    // Frame already closed in before, but guard against test modifications
    if (frame.format !== null) {
      frame.close();
    }
  });

  // W3C spec: format returns null when [[Detached]] is true
  it('should return null for format when closed', () => {
    assert.strictEqual(frame.format, null);
  });

  it('should return 0 for codedWidth when closed', () => {
    assert.strictEqual(frame.codedWidth, 0);
  });

  it('should return 0 for codedHeight when closed', () => {
    assert.strictEqual(frame.codedHeight, 0);
  });

  it('should return null for codedRect when closed', () => {
    assert.strictEqual(frame.codedRect, null);
  });

  it('should return null for visibleRect when closed', () => {
    assert.strictEqual(frame.visibleRect, null);
  });

  it('should return 0 for displayWidth when closed', () => {
    assert.strictEqual(frame.displayWidth, 0);
  });

  it('should return 0 for displayHeight when closed', () => {
    assert.strictEqual(frame.displayHeight, 0);
  });

  it('should return 0 for timestamp when closed', () => {
    assert.strictEqual(frame.timestamp, 0);
  });

  it('should return null for duration when closed', () => {
    assert.strictEqual(frame.duration, null);
  });
});
