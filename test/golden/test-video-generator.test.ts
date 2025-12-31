import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('TestVideoGenerator', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-video-gen-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, {recursive: true, force: true});
  });

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
    frames.forEach(f => f.close());
    generator.close();
  });
});
