import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('TestVideoGenerator', () => {
  it('should generate test video frames', async () => {
    const generator = new TestVideoGenerator();

    generator.configure({
      width: 320,
      height: 240,
      frameRate: 30,
      duration: 1, // 1 second = 30 frames
      pattern: 'testsrc',
    });

    const frames: VideoFrame[] = [];

    await generator.generate((frame: VideoFrame) => {
      frames.push(frame);
    });

    assert.strictEqual(frames.length, 30);
    assert.strictEqual(frames[0].codedWidth, 320);
    assert.strictEqual(frames[0].codedHeight, 240);

    // Clean up frames
    frames.forEach((f) => {
      f.close();
    });
    generator.close();
  });
});
