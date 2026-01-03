/**
 * Resource Manager per W3C WebCodecs spec.
 *
 * Tracks codec instances and their activity for resource reclamation.
 * Inactive codecs (no progress in 10 seconds) may be reclaimed.
 */

/**
 * Minimal interface for codecs managed by ResourceManager.
 */
interface ManagedCodec {
  readonly state: string;
  close(): void;
}

interface CodecEntry {
  codec: ManagedCodec;
  lastActivity: number;
  isBackground: boolean;
}

export class ResourceManager {
  private static instance: ResourceManager | null = null;
  private codecs: Map<symbol, CodecEntry> = new Map();
  private inactivityTimeout: number = 10000; // 10 seconds per spec

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
   */
  register(codec: ManagedCodec): symbol {
    const id = Symbol('codec');
    this.codecs.set(id, {
      codec,
      lastActivity: Date.now(),
      isBackground: false,
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
   */
  recordActivity(id: symbol): void {
    const entry = this.codecs.get(id);
    if (entry) {
      entry.lastActivity = Date.now();
    }
  }

  /**
   * Mark codec as background (eligible for reclamation).
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
   * Get codecs eligible for reclamation.
   * Per spec: inactive (no progress in 10s) OR background codecs.
   */
  getReclaimableCodecs(): ManagedCodec[] {
    const now = Date.now();
    const reclaimable: ManagedCodec[] = [];

    for (const [, entry] of this.codecs) {
      const inactive = now - entry.lastActivity > this.inactivityTimeout;

      // Only reclaim if inactive OR (background AND inactive)
      // Spec says: "You must not reclaim a codec that is both active and in the foreground"
      if (inactive || entry.isBackground) {
        reclaimable.push(entry.codec);
      }
    }

    return reclaimable;
  }

  /**
   * Reclaim resources from inactive codecs.
   */
  reclaimInactive(): number {
    const reclaimable = this.getReclaimableCodecs();
    let reclaimed = 0;

    for (const codec of reclaimable) {
      try {
        if (codec.state !== 'closed' && typeof codec.close === 'function') {
          codec.close();
          reclaimed++;
        }
      } catch {
        // Ignore errors during reclamation
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
}
