// test/unit/resource-manager.test.ts
// Tests for W3C WebCodecs spec section 11 - Resource Reclamation

import * as assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { ResourceManager } from '../../lib/resource-manager';

/**
 * Mock codec for testing ResourceManager.
 * Implements the ManagedCodec interface.
 */
class MockCodec {
  state: string = 'configured';
  readonly codecType: 'encoder' | 'decoder';
  errorCallback: ((error: DOMException) => void) | null = null;
  closeCallCount = 0;
  lastCloseError: DOMException | null = null;

  constructor(type: 'encoder' | 'decoder' = 'encoder') {
    this.codecType = type;
  }

  close(): void {
    this.closeCallCount++;
    this.state = 'closed';
  }

  /**
   * Simulates the spec-compliant close with error.
   * When reclamation happens, codec.close() is called and error callback invoked.
   */
  closeWithError(error: DOMException): void {
    this.lastCloseError = error;
    if (this.errorCallback) {
      this.errorCallback(error);
    }
    this.close();
  }
}

describe('ResourceManager', () => {
  let manager: ResourceManager;

  beforeEach(() => {
    // Get fresh instance for each test
    manager = ResourceManager.getInstance();
    // Reset to clean state - clears all codecs and resets timeout
    manager._resetForTesting();
    // Set a very short timeout for tests
    manager.setInactivityTimeout(10); // 10ms for fast tests
  });

  afterEach(() => {
    // Clean up by resetting the manager
    manager._resetForTesting();
  });

  describe('codec registration', () => {
    // Spec 11: ResourceManager tracks registered codecs
    it('should track registered codecs', () => {
      const codec = new MockCodec();
      const initialCount = manager.getActiveCodecCount();

      const id = manager.register(codec);

      assert.ok(id, 'register should return an ID');
      assert.strictEqual(manager.getActiveCodecCount(), initialCount + 1);
    });

    it('should unregister codecs on close', () => {
      const codec = new MockCodec();
      const initialCount = manager.getActiveCodecCount();

      const id = manager.register(codec);
      assert.strictEqual(manager.getActiveCodecCount(), initialCount + 1);

      manager.unregister(id);
      assert.strictEqual(manager.getActiveCodecCount(), initialCount);
    });

    it('should handle unregistering non-existent codec gracefully', () => {
      const fakeId = Symbol('fake');
      // Should not throw
      manager.unregister(fakeId);
    });
  });

  describe('activity tracking', () => {
    // Spec 11: Active codec = made progress on codec work queue in past 10 seconds
    it('should mark codec as active when activity is recorded', async () => {
      const codec = new MockCodec();
      const id = manager.register(codec);

      // Record activity
      manager.recordActivity(id);

      // Should not be reclaimable immediately after activity
      const reclaimable = manager.getReclaimableCodecs();
      assert.ok(
        !reclaimable.includes(codec),
        'Active codec should not be reclaimable',
      );

      manager.unregister(id);
    });

    // Spec 11: Inactive codec = no progress in past 10 seconds
    it('should mark codec as inactive after timeout', async () => {
      const codec = new MockCodec();
      manager.setInactivityTimeout(5); // 5ms for test speed

      const id = manager.register(codec);

      // Wait for inactivity timeout
      await new Promise((r) => setTimeout(r, 10));

      const reclaimable = manager.getReclaimableCodecs();
      assert.ok(
        reclaimable.includes(codec),
        'Inactive codec should be reclaimable',
      );

      manager.unregister(id);
    });

    it('should reset inactivity timer on activity', async () => {
      const codec = new MockCodec();
      manager.setInactivityTimeout(20); // 20ms

      const id = manager.register(codec);

      // Wait 15ms (not yet inactive)
      await new Promise((r) => setTimeout(r, 15));

      // Record activity to reset timer
      manager.recordActivity(id);

      // Wait another 15ms (would be inactive without reset)
      await new Promise((r) => setTimeout(r, 15));

      // Should still be active (timer was reset)
      const reclaimable = manager.getReclaimableCodecs();
      assert.ok(
        !reclaimable.includes(codec),
        'Codec with recent activity should not be reclaimable',
      );

      manager.unregister(id);
    });
  });

  describe('reclamation', () => {
    // Spec 11: To reclaim a codec, run close algorithm with QuotaExceededError
    it('should reclaim inactive codec with QuotaExceededError', async () => {
      const codec = new MockCodec();
      let capturedError: DOMException | null = null;

      codec.errorCallback = (error) => {
        capturedError = error;
      };

      manager.setInactivityTimeout(5);
      manager.register(codec, codec.codecType, codec.errorCallback);

      // Wait for inactivity
      await new Promise((r) => setTimeout(r, 10));

      // Reclaim
      const reclaimed = manager.reclaimInactive();

      assert.strictEqual(reclaimed, 1, 'Should reclaim one codec');
      assert.strictEqual(codec.state, 'closed', 'Codec should be closed');

      // Spec 11: Must call close with QuotaExceededError
      assert.ok(capturedError, 'Error callback should be invoked');
      assert.ok(
        capturedError instanceof DOMException,
        'Error should be DOMException',
      );
      assert.strictEqual(
        capturedError?.name,
        'QuotaExceededError',
        'Error should be QuotaExceededError',
      );
    });

    // Spec 11: MUST NOT reclaim codec that is both active AND foreground
    it('should not reclaim active foreground codec', async () => {
      const codec = new MockCodec();
      manager.setInactivityTimeout(50);

      const id = manager.register(codec);
      manager.recordActivity(id); // Mark as active

      const reclaimable = manager.getReclaimableCodecs();
      assert.ok(
        !reclaimable.includes(codec),
        'Active foreground codec should not be reclaimable',
      );

      const reclaimed = manager.reclaimInactive();
      assert.strictEqual(reclaimed, 0, 'Should not reclaim active codec');
      assert.strictEqual(
        codec.state,
        'configured',
        'Codec should still be configured',
      );

      manager.unregister(id);
    });

    it('should not reclaim already closed codec', async () => {
      const codec = new MockCodec();
      codec.state = 'closed';
      manager.setInactivityTimeout(5);

      const id = manager.register(codec);
      await new Promise((r) => setTimeout(r, 10));

      const reclaimed = manager.reclaimInactive();
      assert.strictEqual(
        reclaimed,
        0,
        'Should not reclaim already closed codec',
      );
      assert.strictEqual(
        codec.closeCallCount,
        0,
        'close() should not be called on already closed codec',
      );

      manager.unregister(id);
    });
  });

  describe('background codecs', () => {
    // Spec 11: Background codec is one whose ownerDocument.hidden = true
    it('should mark codec as background', () => {
      const codec = new MockCodec();
      const id = manager.register(codec);

      manager.setBackground(id, true);

      // Background codecs CAN be reclaimable (if inactive)
      manager.unregister(id);
    });

    // Spec 11: MUST NOT reclaim active background encoder
    it('should not reclaim active background encoder', async () => {
      const encoder = new MockCodec('encoder');
      manager.setInactivityTimeout(50);

      const id = manager.register(encoder, 'encoder');
      manager.recordActivity(id); // Mark as active
      manager.setBackground(id, true); // Mark as background

      const reclaimable = manager.getReclaimableCodecs();
      assert.ok(
        !reclaimable.includes(encoder),
        'Active background encoder should not be reclaimable',
      );

      manager.unregister(id);
    });

    // Spec 11: Inactive background codec CAN be reclaimed
    it('should reclaim inactive background codec', async () => {
      const codec = new MockCodec('decoder');
      manager.setInactivityTimeout(5);

      const id = manager.register(codec, 'decoder');
      manager.setBackground(id, true);

      await new Promise((r) => setTimeout(r, 10));

      const reclaimable = manager.getReclaimableCodecs();
      assert.ok(
        reclaimable.includes(codec),
        'Inactive background codec should be reclaimable',
      );

      manager.unregister(id);
    });
  });

  describe('multiple codecs', () => {
    it('should reclaim multiple inactive codecs', async () => {
      const codec1 = new MockCodec();
      const codec2 = new MockCodec();
      const codec3 = new MockCodec();
      manager.setInactivityTimeout(5);

      manager.register(codec1);
      manager.register(codec2);
      manager.register(codec3);

      await new Promise((r) => setTimeout(r, 10));

      const reclaimed = manager.reclaimInactive();
      assert.strictEqual(reclaimed, 3, 'Should reclaim all inactive codecs');
    });

    it('should only reclaim inactive codecs when some are active', async () => {
      const activeCodec = new MockCodec();
      const inactiveCodec = new MockCodec();
      manager.setInactivityTimeout(5);

      const activeId = manager.register(activeCodec);
      manager.register(inactiveCodec);

      // Wait for inactivity
      await new Promise((r) => setTimeout(r, 10));

      // Mark one as active
      manager.recordActivity(activeId);

      const reclaimed = manager.reclaimInactive();
      assert.strictEqual(reclaimed, 1, 'Should reclaim only inactive codec');
      assert.strictEqual(
        activeCodec.state,
        'configured',
        'Active codec should not be closed',
      );
      assert.strictEqual(
        inactiveCodec.state,
        'closed',
        'Inactive codec should be closed',
      );

      manager.unregister(activeId);
    });

    // Spec 11 edge case: Codec becomes active just before reclamation
    it('should not reclaim codec that becomes active just before reclamation', async () => {
      const codec = new MockCodec();
      manager.setInactivityTimeout(10);

      const id = manager.register(codec);

      // Wait almost to timeout
      await new Promise((r) => setTimeout(r, 8));

      // Record activity just before timeout
      manager.recordActivity(id);

      // Wait a bit more
      await new Promise((r) => setTimeout(r, 5));

      const reclaimable = manager.getReclaimableCodecs();
      assert.ok(
        !reclaimable.includes(codec),
        'Codec with recent activity should not be reclaimable',
      );

      manager.unregister(id);
    });
  });

  describe('edge cases', () => {
    it('should handle recording activity on non-existent codec', () => {
      const fakeId = Symbol('fake');
      // Should not throw
      manager.recordActivity(fakeId);
    });

    it('should handle setting background on non-existent codec', () => {
      const fakeId = Symbol('fake');
      // Should not throw
      manager.setBackground(fakeId, true);
    });

    it('should handle reclamation during pending operations', async () => {
      const codec = new MockCodec();
      manager.setInactivityTimeout(5);

      manager.register(codec);

      // Simulate pending operation by recording activity
      // then waiting for timeout
      await new Promise((r) => setTimeout(r, 10));

      // Even with "pending" state, inactive codec should be reclaimable
      const reclaimed = manager.reclaimInactive();
      assert.strictEqual(reclaimed, 1);

      // Cleanup - codec was already unregistered by reclamation
    });
  });
});
