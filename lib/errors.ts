// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Structured error classes for WebCodecs operations.
// Follows patterns from sharp, node-sqlite3, and other production addons.

/**
 * Error codes for WebCodecs operations.
 * These can be used for programmatic error handling.
 */
export const ErrorCode = {
  // Configuration errors
  ERR_INVALID_CONFIG: 'ERR_INVALID_CONFIG',
  ERR_UNSUPPORTED_CODEC: 'ERR_UNSUPPORTED_CODEC',
  ERR_INVALID_STATE: 'ERR_INVALID_STATE',

  // Encoding errors
  ERR_ENCODE_FAILED: 'ERR_ENCODE_FAILED',
  ERR_ENCODER_INIT: 'ERR_ENCODER_INIT',
  ERR_ENCODER_FLUSH: 'ERR_ENCODER_FLUSH',

  // Decoding errors
  ERR_DECODE_FAILED: 'ERR_DECODE_FAILED',
  ERR_DECODER_INIT: 'ERR_DECODER_INIT',
  ERR_DECODER_FLUSH: 'ERR_DECODER_FLUSH',

  // Frame/data errors
  ERR_INVALID_FRAME: 'ERR_INVALID_FRAME',
  ERR_INVALID_CHUNK: 'ERR_INVALID_CHUNK',
  ERR_FRAME_CLOSED: 'ERR_FRAME_CLOSED',

  // Resource errors
  ERR_ALLOCATION_FAILED: 'ERR_ALLOCATION_FAILED',
  ERR_NATIVE_ERROR: 'ERR_NATIVE_ERROR',

  // I/O errors
  ERR_DEMUX_FAILED: 'ERR_DEMUX_FAILED',
  ERR_FILE_NOT_FOUND: 'ERR_FILE_NOT_FOUND',
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Base error class for all WebCodecs errors.
 * Provides structured error information for debugging and programmatic handling.
 */
export class WebCodecsError extends Error {
  /** Error code for programmatic handling */
  readonly code: ErrorCodeType;

  /** Native FFmpeg error code, if applicable */
  readonly nativeCode?: number;

  /** Additional context for debugging */
  readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code: ErrorCodeType,
    options?: {
      nativeCode?: number;
      context?: Record<string, unknown>;
      cause?: Error;
    },
  ) {
    super(message);
    this.name = 'WebCodecsError';
    this.code = code;
    this.nativeCode = options?.nativeCode;
    this.context = options?.context;

    // Set cause manually for ES2020 compatibility
    if (options?.cause) {
      (this as unknown as { cause: Error }).cause = options.cause;
    }

    // Maintains proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, WebCodecsError);
    }
  }

  /**
   * Returns a JSON-serializable representation of the error.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      nativeCode: this.nativeCode,
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * Error thrown when encoder/decoder configuration is invalid.
 */
export class ConfigurationError extends WebCodecsError {
  constructor(
    message: string,
    options?: {
      nativeCode?: number;
      context?: Record<string, unknown>;
      cause?: Error;
    },
  ) {
    super(message, ErrorCode.ERR_INVALID_CONFIG, options);
    this.name = 'ConfigurationError';
  }
}

/**
 * Error thrown when a codec is not supported.
 */
export class UnsupportedCodecError extends WebCodecsError {
  readonly codec: string;

  constructor(
    codec: string,
    options?: {
      context?: Record<string, unknown>;
    },
  ) {
    super(`Unsupported codec: ${codec}`, ErrorCode.ERR_UNSUPPORTED_CODEC, {
      context: { ...options?.context, codec },
    });
    this.name = 'UnsupportedCodecError';
    this.codec = codec;
  }
}

/**
 * Error thrown when an operation is called in an invalid state.
 */
export class InvalidStateError extends WebCodecsError {
  readonly currentState: string;
  readonly expectedStates: string[];

  constructor(operation: string, currentState: string, expectedStates: string[]) {
    super(
      `Cannot ${operation} in state "${currentState}". Expected: ${expectedStates.join(' or ')}`,
      ErrorCode.ERR_INVALID_STATE,
      { context: { operation, currentState, expectedStates } },
    );
    this.name = 'InvalidStateError';
    this.currentState = currentState;
    this.expectedStates = expectedStates;
  }
}

/**
 * Error thrown when encoding fails.
 */
export class EncodingError extends WebCodecsError {
  constructor(
    message: string,
    options?: {
      nativeCode?: number;
      context?: Record<string, unknown>;
      cause?: Error;
    },
  ) {
    super(message, ErrorCode.ERR_ENCODE_FAILED, options);
    this.name = 'EncodingError';
  }
}

/**
 * Error thrown when decoding fails.
 */
export class DecodingError extends WebCodecsError {
  constructor(
    message: string,
    options?: {
      nativeCode?: number;
      context?: Record<string, unknown>;
      cause?: Error;
    },
  ) {
    super(message, ErrorCode.ERR_DECODE_FAILED, options);
    this.name = 'DecodingError';
  }
}

/**
 * Error thrown when a frame or chunk is invalid.
 */
export class InvalidDataError extends WebCodecsError {
  constructor(
    message: string,
    code: ErrorCodeType = ErrorCode.ERR_INVALID_FRAME,
    options?: {
      context?: Record<string, unknown>;
    },
  ) {
    super(message, code, options);
    this.name = 'InvalidDataError';
  }
}

/**
 * Error thrown when native resource allocation fails.
 */
export class AllocationError extends WebCodecsError {
  constructor(
    resource: string,
    options?: {
      nativeCode?: number;
    },
  ) {
    super(`Failed to allocate ${resource}`, ErrorCode.ERR_ALLOCATION_FAILED, {
      nativeCode: options?.nativeCode,
      context: { resource },
    });
    this.name = 'AllocationError';
  }
}

/**
 * Maps FFmpeg error codes to human-readable messages.
 * See: https://ffmpeg.org/doxygen/trunk/error_8h.html
 */
export function ffmpegErrorMessage(code: number): string {
  // Common FFmpeg error codes (negated AVERROR values)
  const errors: Record<number, string> = {
    [-1]: 'Unknown error',
    [-2]: 'No such file or directory',
    [-5]: 'I/O error',
    [-12]: 'Out of memory',
    [-22]: 'Invalid argument',
    [-38]: 'Function not implemented',
    // AVERROR codes (FFERRTAG macro outputs)
    [-1094995529]: 'Invalid data found when processing input',
    [-1163346256]: 'End of file',
    [-1414092869]: 'Decoder not found',
    [-1414549496]: 'Encoder not found',
    [-1414482432]: 'Demuxer not found',
    [-1213084710]: 'Protocol not found',
    [-1128613112]: 'Bitstream filter not found',
  };

  return errors[code] ?? `FFmpeg error code: ${code}`;
}
