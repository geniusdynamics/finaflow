// ABOUTME: Synthetic KCB online statement modelled on the real positioned-text layout.
// ABOUTME: No real customer data: account, names and transactions are fabricated.

import type { ExtractedDocument, TextLine } from "../types";

function line(page: number, y: number, cells: Array<[text: string, x: number]>): TextLine {
  return {
    page,
    y,
    cells: cells.map(([text, x]) => ({ text, x })),
  };
}

export function syntheticKcbStatement(): ExtractedDocument {
  const lines: TextLine[] = [
    line(1, 5427, [["23 October 2026", 3108]]),
    line(1, 5373, [["12:42:34", 3276]]),
    line(1, 5289, [["ACCOUNT STATEMENT", 144]]),
    line(1, 5235, [["Customer:", 144]]),
    line(1, 5181, [["Account:", 144], ["1234567890", 427], ["TEST BUSINESS LTD", 768]]),
    line(1, 5127, [["Product Name:", 144], ["Entrepreneurs Account", 569]]),
    line(1, 5073, [["Statement Period:", 144], ["01 JAN 2026", 683], ["-", 1051], ["04 JAN 2026", 1136]]),
    line(1, 5019, [
      ["Balance at Period Start", 144],
      ["100,000.00", 853],
      ["KES", 1250],
      ["Balance at Period End:", 1391],
      ["104,942.50", 2072],
      ["KES", 2468],
    ]),
    line(1, 4951, [
      ["TXN DATE", 158],
      ["DESCRIPTION", 710],
      ["VALUE DATE", 1262],
      ["MONEY OUT", 1814],
      ["MONEY IN", 2366],
      ["LEDGER BALANCE", 2918],
    ]),
    line(1, 4840, [
      ["01 JAN 2026", 158],
      ["BALANCE B/FWD", 710],
      ["01 JAN 2026", 1262],
      ["100,000.00", 3122],
    ]),
    line(1, 4758, [
      ["02 JAN 2026", 158],
      ["Transfer Charge AC-1177", 710],
      ["02 JAN 2026", 1262],
      ["-57.50", 2154],
      ["99,942.50", 3122],
    ]),
    line(1, 4676, [
      ["03 JAN 2026", 158],
      ["Cash Deposit 123", 710],
      ["03 JAN 2026", 1262],
      ["10,000", 2696],
      ["109,942.50", 3122],
    ]),
    line(1, 4594, [
      ["04 JAN 2026", 158],
      ["Transfer G COAST META", 710],
      ["04 JAN 2026", 1262],
      ["-5,000", 2041],
      ["104,942.50", 3122],
    ]),
    line(1, 4550, [["LS TRADERS LIMITED", 710]]),
    line(1, 307, [["Page 1 of 1", 3176]]),
    line(1, 290, [["BALANCE AT PERIOD E -5,057.50 10,000.00 104,942.50", 144]]),
  ];

  return {
    pages: 1,
    charCount: lines.reduce((n, l) => n + l.cells.reduce((m, c) => m + c.text.length, 0), 0),
    lines,
  };
}

/** Second-period KCB statement used to test cross-month consolidation. */
export function syntheticKcbFebruaryStatement(): ExtractedDocument {
  const lines: TextLine[] = [
    line(1, 5427, [["23 October 2026", 3108]]),
    line(1, 5373, [["13:11:02", 3276]]),
    line(1, 5289, [["ACCOUNT STATEMENT", 144]]),
    line(1, 5235, [["Customer:", 144]]),
    line(1, 5181, [["Account:", 144], ["9876543210", 427], ["FEBRUARY TRADERS LTD", 768]]),
    line(1, 5127, [["Product Name:", 144], ["Business Account", 569]]),
    line(1, 5073, [["Statement Period:", 144], ["01 FEB 2026", 683], ["-", 1051], ["28 FEB 2026", 1136]]),
    line(1, 5019, [
      ["Balance at Period Start", 144],
      ["50,000.00", 853],
      ["KES", 1250],
      ["Balance at Period End:", 1391],
      ["69,000.00", 2072],
      ["KES", 2468],
    ]),
    line(1, 4951, [
      ["TXN DATE", 158],
      ["DESCRIPTION", 710],
      ["VALUE DATE", 1262],
      ["MONEY OUT", 1814],
      ["MONEY IN", 2366],
      ["LEDGER BALANCE", 2918],
    ]),
    line(1, 4840, [
      ["01 FEB 2026", 158],
      ["BALANCE B/FWD", 710],
      ["01 FEB 2026", 1262],
      ["50,000.00", 3122],
    ]),
    line(1, 4758, [
      ["05 FEB 2026", 158],
      ["Cash Deposit 456", 710],
      ["05 FEB 2026", 1262],
      ["20,000", 2696],
      ["70,000.00", 3122],
    ]),
    line(1, 4676, [
      ["10 FEB 2026", 158],
      ["Transfer FEB SUPPLIER", 710],
      ["10 FEB 2026", 1262],
      ["-1,000", 2041],
      ["69,000.00", 3122],
    ]),
    line(1, 307, [["Page 1 of 1", 3176]]),
    line(1, 290, [["BALANCE AT PERIOD E -1,000.00 20,000.00 69,000.00", 144]]),
  ];

  return {
    pages: 1,
    charCount: lines.reduce((n, l) => n + l.cells.reduce((m, c) => m + c.text.length, 0), 0),
    lines,
  };
}
