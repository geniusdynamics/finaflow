// ABOUTME: Typed errors for statement extraction and parsing, mapped to API responses by the service layer.
// ABOUTME: Keeps password and unsupported-format handling explicit instead of surfacing pdf.js internals.

export type StatementErrorCode =
  | "INVALID_FILE"
  | "PASSWORD_REQUIRED"
  | "PASSWORD_INCORRECT"
  | "NO_TEXT_LAYER"
  | "TOO_MANY_PAGES"
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_STATEMENT"
  | "PARSE_FAILED";

export class StatementError extends Error {
  readonly code: StatementErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: StatementErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "StatementError";
    this.code = code;
    this.details = details;
  }
}

export class PasswordRequiredError extends StatementError {
  constructor(message = "This statement is password-protected.") {
    super("PASSWORD_REQUIRED", message);
    this.name = "PasswordRequiredError";
  }
}

export class PasswordIncorrectError extends StatementError {
  constructor(message = "The password is incorrect.") {
    super("PASSWORD_INCORRECT", message);
    this.name = "PasswordIncorrectError";
  }
}

export class NoTextLayerError extends StatementError {
  constructor(message = "This PDF has no text layer. Scanned statements are not supported yet.") {
    super("NO_TEXT_LAYER", message);
    this.name = "NoTextLayerError";
  }
}

export class UnsupportedStatementError extends StatementError {
  constructor(message = "This statement format is not recognised.") {
    super("UNSUPPORTED_STATEMENT", message);
    this.name = "UnsupportedStatementError";
  }
}
