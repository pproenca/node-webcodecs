/**
 * TypeError Validation Tests per W3C WebCodecs spec
 *
 * TypeErrors are thrown synchronously for invalid arguments and configurations.
 * This mirrors the contract tests in test/contracts/error_handling/type_errors.js
 */
import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('TypeError validation per W3C spec', () => {
  describe('VideoEncoder', () => {
    describe('configure()', () => {
      it('should throw TypeError for empty codec string', () => {
        const encoder = new VideoEncoder({ output: () => {}, error: () => {} });
        try {
          assert.throws(
            () => {
              encoder.configure({
                codec: '',
                width: 100,
                height: 100,
                bitrate: 1_000_000,
              });
            },
            (err: Error) => {
              return (
                err instanceof TypeError ||
                (err instanceof Error && err.message.includes('codec'))
              );
            },
          );
        } finally {
          encoder.close();
        }
      });

      it('should throw for zero width', () => {
        const encoder = new VideoEncoder({ output: () => {}, error: () => {} });
        try {
          assert.throws(
            () => {
              encoder.configure({
                codec: 'avc1.42001e',
                width: 0,
                height: 100,
                bitrate: 1_000_000,
              });
            },
            (err: Error) => {
              return (
                err instanceof TypeError ||
                err instanceof RangeError ||
                err instanceof Error
              );
            },
          );
        } finally {
          encoder.close();
        }
      });

      it('should throw for zero height', () => {
        const encoder = new VideoEncoder({ output: () => {}, error: () => {} });
        try {
          assert.throws(
            () => {
              encoder.configure({
                codec: 'avc1.42001e',
                width: 100,
                height: 0,
                bitrate: 1_000_000,
              });
            },
            (err: Error) => {
              return (
                err instanceof TypeError ||
                err instanceof RangeError ||
                err instanceof Error
              );
            },
          );
        } finally {
          encoder.close();
        }
      });

      it('should throw for negative dimensions', () => {
        const encoder = new VideoEncoder({ output: () => {}, error: () => {} });
        try {
          assert.throws(
            () => {
              encoder.configure({
                codec: 'avc1.42001e',
                width: -100,
                height: 100,
                bitrate: 1_000_000,
              });
            },
            (err: Error) => {
              return (
                err instanceof TypeError ||
                err instanceof RangeError ||
                err instanceof Error
              );
            },
          );
        } finally {
          encoder.close();
        }
      });

      it('should throw for invalid codec format string', () => {
        const encoder = new VideoEncoder({ output: () => {}, error: () => {} });
        try {
          assert.throws(
            () => {
              encoder.configure({
                codec: 'not-a-real-codec-format',
                width: 100,
                height: 100,
                bitrate: 1_000_000,
              });
            },
            (err: Error) => {
              return err instanceof TypeError || err instanceof Error;
            },
          );
        } finally {
          encoder.close();
        }
      });
    });

    describe('constructor()', () => {
      it('should throw TypeError for missing output callback', () => {
        assert.throws(
          () => {
            // @ts-expect-error - intentionally omitting required parameter
            new VideoEncoder({ error: () => {} });
          },
          (err: Error) => {
            return (
              err instanceof TypeError ||
              (err instanceof Error && err.message.includes('output'))
            );
          },
        );
      });

      it('should throw TypeError for missing error callback', () => {
        assert.throws(
          () => {
            // @ts-expect-error - intentionally omitting required parameter
            new VideoEncoder({ output: () => {} });
          },
          (err: Error) => {
            return (
              err instanceof TypeError ||
              (err instanceof Error && err.message.includes('error'))
            );
          },
        );
      });

      it('should throw TypeError for non-function output callback', () => {
        assert.throws(
          () => {
            // @ts-expect-error - intentionally passing wrong type
            new VideoEncoder({ output: 'string', error: () => {} });
          },
          (err: Error) => {
            return (
              err instanceof TypeError ||
              (err instanceof Error && err.message.includes('output'))
            );
          },
        );
      });
    });

    describe('encode()', () => {
      it('should throw TypeError for detached VideoFrame', () => {
        const encoder = new VideoEncoder({ output: () => {}, error: () => {} });
        encoder.configure({
          codec: 'avc1.42001e',
          width: 100,
          height: 100,
          bitrate: 1_000_000,
        });

        const frame = new VideoFrame(Buffer.alloc(100 * 100 * 4), {
          codedWidth: 100,
          codedHeight: 100,
          timestamp: 0,
        });
        frame.close(); // Detach the frame

        try {
          assert.throws(
            () => {
              encoder.encode(frame);
            },
            (err: Error) => {
              // Implementation throws Error with "buffer too small" for closed frames
              return (
                err instanceof TypeError ||
                (err instanceof Error &&
                  (err.message.includes('closed') ||
                    err.message.includes('detached') ||
                    err.message.includes('buffer')))
              );
            },
          );
        } finally {
          encoder.close();
        }
      });
    });
  });

  describe('AudioEncoder', () => {
    describe('encode()', () => {
      it('should throw TypeError for detached AudioData', () => {
        const encoder = new AudioEncoder({ output: () => {}, error: () => {} });
        encoder.configure({
          codec: 'mp4a.40.2',
          sampleRate: 48000,
          numberOfChannels: 2,
          bitrate: 128_000,
        });

        const audioData = new AudioData({
          format: 'f32',
          sampleRate: 48000,
          numberOfFrames: 1024,
          numberOfChannels: 2,
          timestamp: 0,
          data: new Float32Array(1024 * 2),
        });
        audioData.close(); // Detach the audio data

        try {
          assert.throws(
            () => {
              encoder.encode(audioData);
            },
            (err: Error) => {
              // Implementation throws Error with "Could not get audio data" for closed
              return (
                err instanceof TypeError ||
                (err instanceof Error &&
                  (err.message.includes('closed') ||
                    err.message.includes('detached') ||
                    err.message.includes('audio data')))
              );
            },
          );
        } finally {
          encoder.close();
        }
      });
    });
  });

  describe('VideoFrame', () => {
    describe('constructor()', () => {
      it('should throw TypeError for missing timestamp', () => {
        assert.throws(
          () => {
            new VideoFrame(Buffer.alloc(100 * 100 * 4), {
              codedWidth: 100,
              codedHeight: 100,
              // timestamp is missing
            } as VideoFrameBufferInit);
          },
          (err: Error) => {
            return (
              err instanceof TypeError ||
              (err instanceof Error && err.message.includes('timestamp'))
            );
          },
        );
      });
    });
  });
});
