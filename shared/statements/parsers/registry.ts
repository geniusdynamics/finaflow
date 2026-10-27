// ABOUTME: Statement parser registry: detection, selection and parsing behind one provider-agnostic entry point.
// ABOUTME: Adding a bank or wallet means registering another parser, not touching the wallet or import code.

import type { ExtractedDocument, ParsedStatement, StatementParser } from "../types";
import { UnsupportedStatementError } from "../errors";
import {
  MPESA_PARSER_ID,
  MPESA_PARSER_VERSION,
  detectMpesaStatement,
  parseMpesaStatement,
} from "./mpesa";
import {
  KCB_PARSER_ID,
  KCB_PARSER_VERSION,
  detectKcbBankStatement,
  parseKcbBankStatement,
} from "./kcb";

const mpesaParser: StatementParser = {
  id: MPESA_PARSER_ID,
  version: MPESA_PARSER_VERSION,
  provider: "mpesa",
  displayName: "M-PESA statement",
  detect: (doc) => detectMpesaStatement(doc),
  parse: (doc) => parseMpesaStatement(doc),
};

const kcbParser: StatementParser = {
  id: KCB_PARSER_ID,
  version: KCB_PARSER_VERSION,
  provider: "bank",
  displayName: "Bank statement (KCB layout)",
  detect: (doc) => detectKcbBankStatement(doc),
  parse: (doc) => parseKcbBankStatement(doc),
};

const parsers: StatementParser[] = [mpesaParser, kcbParser];

export interface DetectedParser {
  parser: StatementParser;
  confidence: number;
}

export function registerStatementParser(parser: StatementParser): void {
  const existing = parsers.findIndex((p) => p.id === parser.id);
  if (existing >= 0) parsers[existing] = parser;
  else parsers.push(parser);
}

export function listStatementParsers(): StatementParser[] {
  return [...parsers];
}

/** Returns the best parser with its confidence. Throws when nothing is recognisable. */
export function detectStatementParser(
  doc: ExtractedDocument,
  meta?: { fileName?: string },
): DetectedParser {
  let best: DetectedParser | null = null;
  for (const parser of parsers) {
    const confidence = parser.detect(doc, meta);
    if (!best || confidence > best.confidence) best = { parser, confidence };
  }
  if (!best || best.confidence < 0.3) {
    throw new UnsupportedStatementError(
      "This statement format is not recognised. Supported today: M-PESA statements and KCB bank statements (PDF).",
    );
  }
  return best;
}

/** Parses with a specific parser, or with the best detected one. */
export function parseStatement(
  doc: ExtractedDocument,
  options: { parserId?: string; fileName?: string } = {},
): ParsedStatement {
  const parser = options.parserId
    ? parsers.find((p) => p.id === options.parserId)
    : detectStatementParser(doc, { fileName: options.fileName }).parser;

  if (!parser) {
    throw new UnsupportedStatementError(`Unknown statement parser: ${options.parserId}`);
  }
  return parser.parse(doc);
}
