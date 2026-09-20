export type NgrvErrorCode =
  | 'NGRV_VALIDATION_ERROR'
  | 'NGRV_COLLECTION_ERROR'
  | 'NGRV_READ_ERROR'
  | 'NGRV_WRITE_ERROR';

export class NgrvError extends Error {
  readonly code: NgrvErrorCode;
  readonly cause?: unknown;

  constructor(code: NgrvErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'NgrvError';
    this.code = code;
    this.cause = cause;
    Object.setPrototypeOf(this, NgrvError.prototype);
  }
}
