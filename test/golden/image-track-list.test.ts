import { describe, expect, it } from 'vitest';
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

    expect(list.length).toBe(1);
  });

  it('has selectedIndex property', () => {
    const track1 = createMockTrack(false);
    const track2 = createMockTrack(true);
    const list = new ImageTrackList([track1, track2]);

    expect(list.selectedIndex).toBe(1);
  });

  it('has selectedTrack property', () => {
    const track = createMockTrack(true);
    const list = new ImageTrackList([track]);

    expect(list.selectedTrack).toBe(track);
  });

  it('returns null selectedTrack when none selected', () => {
    const track = createMockTrack(false);
    const list = new ImageTrackList([track]);

    expect(list.selectedTrack).toBeNull();
  });

  it('supports index accessor', () => {
    const track1 = createMockTrack();
    const track2 = createMockTrack();
    const list = new ImageTrackList([track1, track2]);

    expect(list[0]).toBe(track1);
    expect(list[1]).toBe(track2);
    expect(list[2]).toBeUndefined();
  });

  it('has ready promise that resolves', async () => {
    const track = createMockTrack();
    const list = new ImageTrackList([track]);

    await expect(list.ready).resolves.toBeUndefined();
  });

  it('is iterable', () => {
    const track1 = createMockTrack();
    const track2 = createMockTrack();
    const list = new ImageTrackList([track1, track2]);

    const tracks = [...list];
    expect(tracks).toHaveLength(2);
    expect(tracks[0]).toBe(track1);
    expect(tracks[1]).toBe(track2);
  });
});
