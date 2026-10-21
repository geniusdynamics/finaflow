// ABOUTME: Converts positioned PDF text items into line clusters shared by the Node and browser extractors.
// ABOUTME: Sorting by y then x means merged runs and multi-cell rows produce the same lines in both runtimes.

import type { TextLine } from "../types";

export interface RawTextItem {
  str: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export function buildTextLines(
  items: RawTextItem[],
  page: number,
  tolerance = 1.5,
): TextLine[] {
  const sorted = [...items]
    .filter((item) => item.str && item.str.trim().length > 0)
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: TextLine[] = [];
  let current: TextLine | null = null;

  for (const item of sorted) {
    if (!current || Math.abs(current.y - item.y) > tolerance) {
      current = { page, y: item.y, cells: [] };
      lines.push(current);
    }
    current.cells.push({
      text: item.str,
      x: item.x,
      width: item.width,
      height: item.height,
    });
  }

  for (const line of lines) line.cells.sort((a, b) => a.x - b.x);
  return lines;
}
