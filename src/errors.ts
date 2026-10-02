export type BirthplaceErrorCode =
  | "BIRTHPLACE_VALIDATION_ERROR"
  | "BIRTHPLACE_COLLECTION_ERROR"
  | "BIRTHPLACE_READ_ERROR"
  | "BIRTHPLACE_WRITE_ERROR";

export class BirthplaceError extends Error {
  readonly code: BirthplaceErrorCode;
  readonly cause?: unknown;

  constructor(code: BirthplaceErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "BirthplaceError";
    this.code = code;
    this.cause = cause;
    Object.setPrototypeOf(this, BirthplaceError.prototype);
  }
}
