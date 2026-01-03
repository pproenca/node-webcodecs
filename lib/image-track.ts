import type { ImageTrackList } from './image-track-list';

/**
 * Function type for checking if the parent ImageDecoder is closed.
 * @internal
 */
export type DecoderClosedChecker = () => boolean;

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
 *
 * Internal Slots (Spec 10.7.1):
 * - [[ImageDecoder]]: Checked via _isDecoderClosed callback
 * - [[ImageTrackList]]: Reference to parent list
 * - [[animated]], [[frame count]], [[repetition count]], [[selected]]: Data
 */

export interface ImageTrackInit {
  animated: boolean;
  frameCount: number;
  repetitionCount: number;
  selected?: boolean;
}

export class ImageTrack {
  // Spec 10.7.1: [[animated]]
  private _animated: boolean;
  // Spec 10.7.1: [[frame count]]
  private _frameCount: number;
  // Spec 10.7.1: [[repetition count]]
  private _repetitionCount: number;
  // Spec 10.7.1: [[selected]]
  private _selected: boolean;
  // Spec 10.7.1: [[ImageDecoder]] - checked via callback
  private _isDecoderClosed: DecoderClosedChecker | null = null;
  // Spec 10.7.1: [[ImageTrackList]]
  private _trackList: ImageTrackList | null = null;

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

  /**
   * Spec 10.7.2: The selected setter steps.
   */
  set selected(value: boolean) {
    // Spec 10.7.2 step 1: If [[ImageDecoder]]'s [[closed]] slot is true, abort
    if (this._isDecoderClosed?.()) {
      return;
    }

    // Spec 10.7.2 step 2: Let newValue be the given value
    const newValue = value;

    // Spec 10.7.2 step 3: If newValue equals [[selected]], abort
    if (newValue === this._selected) {
      return;
    }

    // Spec 10.7.2 step 4: Assign newValue to [[selected]]
    this._selected = newValue;

    // Steps 5-9: Update parent trackList selectedIndex
    // (Steps 10-12 involve control messages which are internal to native layer)
  }

  /**
   * Set the decoder closed checker callback.
   * @internal
   */
  _setDecoderClosedChecker(checker: DecoderClosedChecker): void {
    this._isDecoderClosed = checker;
  }

  /**
   * Set the parent ImageTrackList reference.
   * @internal
   */
  _setTrackList(trackList: ImageTrackList): void {
    this._trackList = trackList;
  }

  /**
   * Get the parent ImageTrackList reference.
   * @internal
   */
  _getTrackList(): ImageTrackList | null {
    return this._trackList;
  }
}
