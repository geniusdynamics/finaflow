// ABOUTME: Maps pdf.js failures to typed statement errors without importing pdf.js itself.
// ABOUTME: Shared by the Node and browser extractors so password handling is identical.

import {
  PasswordIncorrectError,
  PasswordRequiredError,
  StatementError,
} from "../errors";

export function isPdfBytes(bytes: Uint8Array): boolean {
  return bytes.length >= 5
    && bytes[0] === 0x25 // %
    && bytes[1] === 0x50 // P
    && bytes[2] === 0x44 // D
    && bytes[3] === 0x46 // F
    && bytes[4] === 0x2d; // -
}

export function mapPdfError(error: unknown): Error {
  const e = error as { name?: string; code?: number; message?: string };
  const message = e?.message ?? String(error);
  const isPassword = e?.name === "PasswordException" || /password/i.test(message);

  if (isPassword) {
    if (e?.code === 1 || /no password given|password required/i.test(message)) {
      return new PasswordRequiredError();
    }
    return new PasswordIncorrectError();
  }
  if (e?.name === "InvalidPDFException" || /invalid pdf/i.test(message)) {
    return new StatementError("INVALID_FILE", "This file is not a valid PDF.");
  }
  return new StatementError("PARSE_FAILED", `Could not read the PDF: ${message}`);
}
