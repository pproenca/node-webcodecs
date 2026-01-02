import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type {
  ImageBufferSource,
  ImageDecodeOptions,
  ImageDecoderInit,
  ImageTrack,
  ImageTrackList,
} from '../../lib/types';

describe('ImageDecoder Type Definitions', () => {
  it('ImageDecoderInit has all W3C required fields', () => {
    const init: ImageDecoderInit = {
      type: 'image/png',
      data: new Uint8Array([]),
      colorSpaceConversion: 'default',
      desiredWidth: 100,
      desiredHeight: 100,
      preferAnimation: true,
      transfer: [],
    };
    assert.strictEqual(init.type, 'image/png');
    assert.strictEqual(init.colorSpaceConversion, 'default');
    assert.strictEqual(init.desiredWidth, 100);
    assert.strictEqual(init.desiredHeight, 100);
    assert.strictEqual(init.preferAnimation, true);
  });

  it('ImageDecodeOptions has frameIndex and completeFramesOnly', () => {
    const options: ImageDecodeOptions = {
      frameIndex: 5,
      completeFramesOnly: false,
    };
    assert.strictEqual(options.frameIndex, 5);
    assert.strictEqual(options.completeFramesOnly, false);
  });

  it('ImageTrack has all W3C required fields', () => {
    const track: ImageTrack = {
      animated: true,
      frameCount: 10,
      repetitionCount: Infinity,
      selected: true,
    };
    assert.strictEqual(track.animated, true);
    assert.strictEqual(track.frameCount, 10);
    assert.strictEqual(track.repetitionCount, Infinity);
  });

  it('ImageTrackList has ready promise and index accessor', () => {
    const mockTrackList = {
      ready: Promise.resolve(),
      length: 1,
      selectedIndex: 0,
      selectedTrack: null,
      0: { animated: false, frameCount: 1, repetitionCount: 0, selected: true },
    } as ImageTrackList;

    assert.strictEqual(mockTrackList.length, 1);
    assert.strictEqual(mockTrackList.selectedIndex, 0);
    assert.notStrictEqual(mockTrackList[0], undefined);
  });

  it('ImageBufferSource accepts ReadableStream', () => {
    const stream = new ReadableStream<Uint8Array>();
    const bufferSource: ImageBufferSource = stream;
    assert.ok(bufferSource instanceof ReadableStream);
  });
});
