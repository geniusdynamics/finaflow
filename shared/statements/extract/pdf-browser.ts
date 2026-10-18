// ABOUTME: Browser-side PDF text extraction with pdf.js, used by the public no-upload converter.
// ABOUTME: The worker URL is supplied by the page so this module stays bundler-agnostic.

import * as pdfjs from "pdfjs-dist";
import type { ExtractedDocument, TextLine } from "../types";
import { NoTextLayerError, StatementError } from "../errors";
import { buildTextLines, type RawTextItem } from "./build-lines";
import { isPdfBytes, mapPdfError } from "./pdf-errors";

export interface BrowserExtractOptions {
  password?: string;
  /** URL of pdfjs-dist/build/pdf.worker.min.mjs, resolved by the bundler. */
  workerSrc: string;
  maxPages?: number;
  maxChars?: number;
}

const DEFAULT_MAX_PAGES = 300;
const DEFAULT_MAX_CHARS = 5_000_000;

export async function extractPdfDocumentInBrowser(
  bytes: Uint8Array,
  options: BrowserExtractOptions,
): Promise<ExtractedDocument> {
  if (!isPdfBytes(bytes)) {
    throw new StatementError("INVALID_FILE", "This file is not a PDF.");
  }
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;

  pdfjs.GlobalWorkerOptions.workerSrc = options.workerSrc;

  const loadingTask = pdfjs.getDocument({
    data: bytes,
    password: options.password,
    isEvalSupported: false,
    disableFontFace: true,
    verbosity: 0,
  });

  let pdf;
  try {
    pdf = await loadingTask.promise;
  } catch (error) {
    throw mapPdfError(error);
  }

  if (pdf.numPages > maxPages) {
    await pdf.destroy();
    throw new StatementError(
      "TOO_MANY_PAGES",
      `This statement has ${pdf.numPages} pages; the limit is ${maxPages}. Split it into smaller files.`,
    );
  }

  const pageCount = pdf.numPages;
  const lines: TextLine[] = [];
  let charCount = 0;

  try {
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const items: RawTextItem[] = [];
      for (const raw of content.items) {
        if (!("str" in raw)) continue;
        const text = raw.str;
        if (!text || !text.trim()) continue;
        items.push({
          str: text,
          x: raw.transform[4],
          y: raw.transform[5],
          width: typeof raw.width === "number" ? raw.width : undefined,
          height: typeof raw.height === "number" ? raw.height : undefined,
        });
        charCount += text.length;
      }
      lines.push(...buildTextLines(items, pageNumber));
    }
  } finally {
    await pdf.destroy();
  }

  if (charCount === 0) throw new NoTextLayerError();
  if (charCount > maxChars) {
    throw new StatementError(
      "TOO_MANY_PAGES",
      `This statement contains too much text (${charCount} characters). Split it into smaller files.`,
    );
  }

  return { pages: pageCount, lines, charCount };
}
