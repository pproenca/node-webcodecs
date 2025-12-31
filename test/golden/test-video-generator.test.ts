import { describe, expect, it } from 'vitest';

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

    expect(frames.length).toBe(30);
    expect(frames[0].codedWidth).toBe(320);
    expect(frames[0].codedHeight).toBe(240);

    // Clean up frames
    frames.forEach((f) => f.close());
    generator.close();
  });
});
