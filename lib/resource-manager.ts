/**
 * Resource Manager per W3C WebCodecs spec section 11.
 *
 * Tracks codec instances and their activity for resource reclamation.
 * Inactive codecs (no progress in 10 seconds) may be reclaimed.
 *
 * Per spec section 11:
 * - An active codec has made progress on [[codec work queue]] in past 10 seconds
 * - An inactive codec has not made progress in past 10 seconds
 * - A background codec has ownerDocument.hidden = true
 * - MUST NOT reclaim codec that is both active AND foreground
 * - MUST NOT reclaim active background encoder
 * - To reclaim, run close algorithm with QuotaExceededError
 */

/**
 * Minimal interface for codecs managed by ResourceManager.
 */
interface ManagedCodec {
  readonly state: string;
  close(): void;
}

/**
 * Codec type for protection rules per spec section 11.
 * Encoders are protected from reclamation when active (even if background).
 */
type CodecType = 'encoder' | 'decoder';

/**
 * Error callback type for reclamation notification.
 */
type ErrorCallback = (error: DOMException) => void;

interface CodecEntry {
  codec: ManagedCodec;
  lastActivity: number;
  isBackground: boolean;
  codecType: CodecType;
  errorCallback: ErrorCallback | null;
}

export class ResourceManager {
  private static instance: ResourceManager | null = null;
  private readonly codecs: Map<symbol, CodecEntry> = new Map();
  private inactivityTimeout: number = 10000; // Spec 11: 10 seconds

  private constructor() {
    // Monitoring happens on-demand via getReclaimableCodecs()
  }

  static getInstance(): ResourceManager {
    if (!ResourceManager.instance) {
      ResourceManager.instance = new ResourceManager();
    }
    return ResourceManager.instance;
  }

  /**
   * Register a codec for tracking.
   *
   * @param codec - The codec instance to track
   * @param codecType - 'encoder' or 'decoder' for protection rules
   * @param errorCallback - Callback to invoke on reclamation with QuotaExceededError
   * @returns Symbol ID for the registered codec
   */
  register(
    codec: ManagedCodec,
    codecType: CodecType = 'encoder',
    errorCallback: ErrorCallback | null = null,
  ): symbol {
    const id = Symbol('codec');
    this.codecs.set(id, {
      codec,
      lastActivity: Date.now(),
      isBackground: false,
      codecType,
      errorCallback,
    });
    return id;
  }

  /**
   * Unregister a codec (on close).
   */
  unregister(id: symbol): void {
    this.codecs.delete(id);
  }

  /**
   * Record activity on a codec.
   * Per spec 11: A reliable sign of working queue progress is a call to output() callback.
   */
  recordActivity(id: symbol): void {
    const entry = this.codecs.get(id);
    if (entry) {
      entry.lastActivity = Date.now();
    }
  }

  /**
   * Mark codec as background (tab hidden).
   * Per spec 11: Background codec has ownerDocument.hidden = true.
   */
  setBackground(id: symbol, isBackground: boolean): void {
    const entry = this.codecs.get(id);
    if (entry) {
      entry.isBackground = isBackground;
    }
  }

  /**
   * Get count of active codecs.
   */
  getActiveCodecCount(): number {
    return this.codecs.size;
  }

  /**
   * Check if a codec entry is reclaimable per spec section 11.
   *
   * Spec rules:
   * - MUST NOT reclaim codec that is both active AND foreground
   * - MUST NOT reclaim active background encoder
   * - CAN reclaim inactive codecs (foreground or background)
   * - CAN reclaim inactive background decoders
   */
  private isReclaimable(entry: CodecEntry, now: number): boolean {
    const isActive = now - entry.lastActivity <= this.inactivityTimeout;
    const isForeground = !entry.isBackground;

    // Spec 11: MUST NOT reclaim codec that is both active AND foreground
    if (isActive && isForeground) {
      return false;
    }

    // Spec 11: MUST NOT reclaim active background encoder
    // (prevents interrupting long running encode tasks)
    if (isActive && entry.isBackground && entry.codecType === 'encoder') {
      return false;
    }

    // All other cases: inactive codecs can be reclaimed
    return !isActive;
  }

  /**
   * Get codecs eligible for reclamation.
   * Per spec section 11: Only inactive codecs are reclaimable,
   * with additional protections for active background encoders.
   */
  getReclaimableCodecs(): ManagedCodec[] {
    const now = Date.now();
    const reclaimable: ManagedCodec[] = [];

    for (const [, entry] of this.codecs) {
      if (this.isReclaimable(entry, now)) {
        reclaimable.push(entry.codec);
      }
    }

    return reclaimable;
  }

  /**
   * Reclaim resources from inactive codecs.
   * Per spec 11: To reclaim, run close algorithm with QuotaExceededError.
   *
   * @returns Number of codecs reclaimed
   */
  reclaimInactive(): number {
    const now = Date.now();
    let reclaimed = 0;

    // Collect entries to reclaim (can't modify map while iterating)
    const toReclaim: Array<{ id: symbol; entry: CodecEntry }> = [];

    for (const [id, entry] of this.codecs) {
      if (this.isReclaimable(entry, now)) {
        toReclaim.push({ id, entry });
      }
    }

    for (const { id, entry } of toReclaim) {
      const { codec, errorCallback } = entry;

      // Skip already closed codecs
      if (codec.state === 'closed') {
        continue;
      }

      try {
        // Spec 11: To reclaim, run close algorithm with QuotaExceededError
        const quotaError = new DOMException(
          'Codec reclaimed due to resource constraints',
          'QuotaExceededError',
        );

        // Invoke error callback first per spec (before close)
        if (errorCallback) {
          errorCallback(quotaError);
        }

        // Close the codec
        codec.close();

        // Unregister after successful close
        this.codecs.delete(id);

        reclaimed++;
      } catch {
        // Spec says to ignore errors during reclamation
        // but still unregister to prevent retry loops
        this.codecs.delete(id);
      }
    }

    return reclaimed;
  }

  /**
   * Set inactivity timeout (for testing).
   */
  setInactivityTimeout(ms: number): void {
    this.inactivityTimeout = ms;
  }

  /**
   * Stop monitoring (for cleanup).
   * @deprecated No longer needed - monitoring happens on-demand via getReclaimableCodecs()
   */
  stopMonitoring(): void {
    // No-op: monitoring now happens on-demand
  }

  /**
   * Reset for testing - clears all tracked codecs.
   * @internal
   */
  _resetForTesting(): void {
    this.codecs.clear();
    this.inactivityTimeout = 10000;
  }
}
