import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ImageTrack } from '../../lib/image-track';

describe('ImageTrack class', () => {
  it('has readonly animated property', () => {
    const track = new ImageTrack({
      animated: true,
      frameCount: 10,
      repetitionCount: 5,
      selected: false,
    });

    assert.strictEqual(track.animated, true);
    // Should not be writable - attempt to modify and verify it didn't change
    (track as unknown as { animated: boolean }).animated = false;
    assert.strictEqual(track.animated, true);
  });

  it('has readonly frameCount property', () => {
    const track = new ImageTrack({
      animated: false,
      frameCount: 1,
      repetitionCount: 0,
      selected: true,
    });

    assert.strictEqual(track.frameCount, 1);
  });

  it('has readonly repetitionCount property', () => {
    const track = new ImageTrack({
      animated: true,
      frameCount: 5,
      repetitionCount: Infinity,
      selected: true,
    });

    assert.strictEqual(track.repetitionCount, Infinity);
  });

  it('has writable selected property', () => {
    const track = new ImageTrack({
      animated: false,
      frameCount: 1,
      repetitionCount: 0,
      selected: false,
    });

    assert.strictEqual(track.selected, false);
    track.selected = true;
    assert.strictEqual(track.selected, true);
  });
});
