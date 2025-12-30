/**
 * Resource Manager per W3C WebCodecs spec.
 *
 * Tracks codec instances and their activity for resource reclamation.
 * Inactive codecs (no progress in 10 seconds) may be reclaimed.
 */

interface CodecEntry {
  codec: any;
  lastActivity: number;
  isBackground: boolean;
}

export class ResourceManager {
  private static instance: ResourceManager | null = null;
  private codecs: Map<symbol, CodecEntry> = new Map();
  private inactivityTimeout: number = 10000; // 10 seconds per spec
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  private constructor() {
    this.startMonitoring();
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
  register(codec: any): symbol {
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
  getReclaimableCodecs(): any[] {
    const now = Date.now();
    const reclaimable: any[] = [];

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
      } catch (e) {
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

  private startMonitoring(): void {
    // Check every 5 seconds
    this.checkInterval = setInterval(() => {
      // Just track, don't auto-reclaim
      // Actual reclamation would be triggered by memory pressure
    }, 5000);

    // Don't keep process alive
    if (this.checkInterval.unref) {
      this.checkInterval.unref();
    }
  }

  /**
   * Stop monitoring (for cleanup).
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}
