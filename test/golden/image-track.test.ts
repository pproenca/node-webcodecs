import { describe, expect, it } from 'vitest';
import { ImageTrack } from '../../lib/image-track';

describe('ImageTrack class', () => {
  it('has readonly animated property', () => {
    const track = new ImageTrack({
      animated: true,
      frameCount: 10,
      repetitionCount: 5,
      selected: false,
    });

    expect(track.animated).toBe(true);
    // Should not be writable
    expect(() => {
      (track as any).animated = false;
    }).toThrow();
  });

  it('has readonly frameCount property', () => {
    const track = new ImageTrack({
      animated: false,
      frameCount: 1,
      repetitionCount: 0,
      selected: true,
    });

    expect(track.frameCount).toBe(1);
  });

  it('has readonly repetitionCount property', () => {
    const track = new ImageTrack({
      animated: true,
      frameCount: 5,
      repetitionCount: Infinity,
      selected: true,
    });

    expect(track.repetitionCount).toBe(Infinity);
  });

  it('has writable selected property', () => {
    const track = new ImageTrack({
      animated: false,
      frameCount: 1,
      repetitionCount: 0,
      selected: false,
    });

    expect(track.selected).toBe(false);
    track.selected = true;
    expect(track.selected).toBe(true);
  });
});
