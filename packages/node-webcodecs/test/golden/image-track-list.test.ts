import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ImageTrack } from '../../lib/image-track';
import { ImageTrackList } from '../../lib/image-track-list';

describe('ImageTrackList class', () => {
  function createMockTrack(selected = true): ImageTrack {
    return new ImageTrack({
      animated: false,
      frameCount: 1,
      repetitionCount: 0,
      selected,
    });
  }

  it('has length property', () => {
    const track = createMockTrack();
    const list = new ImageTrackList([track]);

    assert.strictEqual(list.length, 1);
  });

  it('has selectedIndex property', () => {
    const track1 = createMockTrack(false);
    const track2 = createMockTrack(true);
    const list = new ImageTrackList([track1, track2]);

    assert.strictEqual(list.selectedIndex, 1);
  });

  it('has selectedTrack property', () => {
    const track = createMockTrack(true);
    const list = new ImageTrackList([track]);

    assert.strictEqual(list.selectedTrack, track);
  });

  it('returns null selectedTrack when none selected', () => {
    const track = createMockTrack(false);
    const list = new ImageTrackList([track]);

    assert.strictEqual(list.selectedTrack, null);
  });

  it('supports index accessor', () => {
    const track1 = createMockTrack();
    const track2 = createMockTrack();
    const list = new ImageTrackList([track1, track2]);

    assert.strictEqual(list[0], track1);
    assert.strictEqual(list[1], track2);
    assert.strictEqual(list[2], undefined);
  });

  it('has ready promise that resolves', async () => {
    const track = createMockTrack();
    const list = new ImageTrackList([track]);

    const result = await list.ready;
    assert.strictEqual(result, undefined);
  });

  it('is iterable', () => {
    const track1 = createMockTrack();
    const track2 = createMockTrack();
    const list = new ImageTrackList([track1, track2]);

    const tracks = [...list];
    assert.strictEqual(tracks.length, 2);
    assert.strictEqual(tracks[0], track1);
    assert.strictEqual(tracks[1], track2);
  });
});
