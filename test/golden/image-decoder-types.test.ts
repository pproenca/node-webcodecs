import {describe, it, expect} from 'vitest';
import type {
  ImageDecoderInit,
  ImageDecodeOptions,
  ImageDecodeResult,
  ImageTrack,
  ImageTrackList,
  ImageBufferSource,
  ColorSpaceConversion,
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
    expect(init.type).toBe('image/png');
    expect(init.colorSpaceConversion).toBe('default');
    expect(init.desiredWidth).toBe(100);
    expect(init.desiredHeight).toBe(100);
    expect(init.preferAnimation).toBe(true);
  });

  it('ImageDecodeOptions has frameIndex and completeFramesOnly', () => {
    const options: ImageDecodeOptions = {
      frameIndex: 5,
      completeFramesOnly: false,
    };
    expect(options.frameIndex).toBe(5);
    expect(options.completeFramesOnly).toBe(false);
  });

  it('ImageTrack has all W3C required fields', () => {
    const track: ImageTrack = {
      animated: true,
      frameCount: 10,
      repetitionCount: Infinity,
      selected: true,
    };
    expect(track.animated).toBe(true);
    expect(track.frameCount).toBe(10);
    expect(track.repetitionCount).toBe(Infinity);
  });

  it('ImageTrackList has ready promise and index accessor', () => {
    const mockTrackList = {
      ready: Promise.resolve(),
      length: 1,
      selectedIndex: 0,
      selectedTrack: null,
      0: {animated: false, frameCount: 1, repetitionCount: 0, selected: true},
    } as ImageTrackList;

    expect(mockTrackList.length).toBe(1);
    expect(mockTrackList.selectedIndex).toBe(0);
    expect(mockTrackList[0]).toBeDefined();
  });

  it('ImageBufferSource accepts ReadableStream', () => {
    const stream = new ReadableStream<Uint8Array>();
    const bufferSource: ImageBufferSource = stream;
    expect(bufferSource).toBeInstanceOf(ReadableStream);
  });
});
