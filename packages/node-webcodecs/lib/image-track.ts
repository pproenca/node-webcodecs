/**
 * ImageTrack represents a single track in an image.
 * Per W3C WebCodecs ImageTrack interface.
 *
 * WebIDL:
 * interface ImageTrack {
 *   readonly attribute boolean animated;
 *   readonly attribute unsigned long frameCount;
 *   readonly attribute unrestricted float repetitionCount;
 *   attribute boolean selected;
 * };
 */

export interface ImageTrackInit {
  animated: boolean;
  frameCount: number;
  repetitionCount: number;
  selected?: boolean;
}

export class ImageTrack {
  private _animated: boolean;
  private _frameCount: number;
  private _repetitionCount: number;
  private _selected: boolean;

  constructor(init: ImageTrackInit) {
    this._animated = init.animated;
    this._frameCount = init.frameCount;
    this._repetitionCount = init.repetitionCount;
    this._selected = init.selected ?? true;
  }

  get animated(): boolean {
    return this._animated;
  }

  get frameCount(): number {
    return this._frameCount;
  }

  get repetitionCount(): number {
    return this._repetitionCount;
  }

  get selected(): boolean {
    return this._selected;
  }

  set selected(value: boolean) {
    this._selected = value;
  }
}
