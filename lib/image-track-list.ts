import type { ImageTrack } from './image-track';

/**
 * ImageTrackList represents a list of tracks in an image.
 * Per W3C WebCodecs ImageTrackList interface.
 *
 * WebIDL:
 * interface ImageTrackList {
 *   getter ImageTrack (unsigned long index);
 *   readonly attribute Promise<undefined> ready;
 *   readonly attribute unsigned long length;
 *   readonly attribute long selectedIndex;
 *   readonly attribute ImageTrack? selectedTrack;
 * };
 */
export class ImageTrackList {
  private _tracks: ImageTrack[];
  private _ready: Promise<void>;
  private _readyResolve!: () => void;

  constructor(tracks: ImageTrack[], ready?: Promise<void>) {
    this._tracks = tracks;

    // Create ready promise if not provided
    if (ready) {
      this._ready = ready;
    } else {
      this._ready = new Promise((resolve) => {
        this._readyResolve = resolve;
      });
      // Resolve immediately for synchronously available tracks
      this._readyResolve();
    }

    // Set up index accessors for array-like access
    for (let i = 0; i < tracks.length; i++) {
      Object.defineProperty(this, i, {
        get: () => this._tracks[i],
        enumerable: true,
        configurable: false,
      });
    }
  }

  get ready(): Promise<void> {
    return this._ready;
  }

  get length(): number {
    return this._tracks.length;
  }

  get selectedIndex(): number {
    for (let i = 0; i < this._tracks.length; i++) {
      if (this._tracks[i].selected) {
        return i;
      }
    }
    return -1;
  }

  get selectedTrack(): ImageTrack | null {
    const index = this.selectedIndex;
    return index >= 0 ? this._tracks[index] : null;
  }

  // Support for index accessor type
  [index: number]: ImageTrack;

  // Make iterable
  *[Symbol.iterator](): Iterator<ImageTrack> {
    for (const track of this._tracks) {
      yield track;
    }
  }

  /**
   * Internal method to update tracks after stream consumption.
   * @internal
   */
  _updateTracks(tracks: ImageTrack[]): void {
    this._tracks = tracks;
    // Set up index accessors for the new tracks
    for (let i = 0; i < tracks.length; i++) {
      Object.defineProperty(this, i, {
        get: () => this._tracks[i],
        enumerable: true,
        configurable: true, // Allow redefinition
      });
    }
  }
}
