// ABOUTME: Synthetic M-PESA statement text lines modelled on the validated real layout.
// ABOUTME: No real customer data: every name, phone and receipt here is fabricated.

import type { ExtractedDocument, TextLine } from "../types";

type Cell = [text: string, x: number];

function line(page: number, y: number, cells: Cell[]): TextLine {
  return {
    page,
    y,
    cells: cells.map(([text, x]) => ({ text, x })),
  };
}

function rowStart(
  page: number,
  y: number,
  values: { receipt: string; date: string; details: string; status?: string; paidIn?: string; withdrawn?: string; balance: string },
): TextLine {
  return line(page, y, [
    [values.receipt, 39],
    [values.date, 108.7],
    [values.details, 178.5],
    [values.status ?? "Completed", 283.1],
    [values.paidIn ?? "0.00", 403],
    [values.withdrawn ?? "0.00", 464.9],
    [values.balance, 528.9],
  ]);
}

function continuation(page: number, y: number, time: string, details?: string): TextLine {
  const cells: Cell[] = [[time, 108.7]];
  if (details) cells.push([details, 178.5]);
  return line(page, y, cells);
}

function footer(page: number, totalPages: number): TextLine[] {
  return [
    line(page, 798, [[`Page ${page} of ${totalPages}`, 50.9]]),
    line(page, 90, [["Disclaimer: This record is produced for your personal use and is not transferable.", 38]]),
    line(page, 82, [["guidance.", 38]]),
    line(page, 65, [["Statement Verification Code", 38]]),
    line(page, 54, [["To verify the validity of this M-PESA statement dial *334#", 38]]),
    line(page, 16, [["For self-help dial *334# | Web: www.safaricom.co.ke", 38]]),
  ];
}

export function syntheticMpesaDocument(): ExtractedDocument {
  const lines: TextLine[] = [
    line(1, 767, [["M-PESA STATEMENT", 38]]),
    line(1, 740, [["Customer Name: TEST CUSTOMER", 38]]),
    line(1, 723, [["Mobile Number: 0700 000 000", 38]]),
    line(1, 706, [["Statement Period: 1st January 2026 - 2nd July 2026", 38]]),
    line(1, 689, [["Request Date: 2nd July 2026", 38]]),
    line(1, 630.5, [["SUMMARY", 38]]),
    line(1, 616.5, [["TRANSACTION TYPE PAID IN PAID OUT", 38]]),
    line(1, 605.5, [["Send Money 0.00 657.00", 38]]),
    line(1, 594.5, [["Received Money 1,500.00 0.00", 38]]),
    line(1, 583.5, [["Fuliza 251.37 0.00", 38]]),
    line(1, 572.5, [["Total 1,751.37 657.00", 38]]),
    line(1, 500, [["DETAILED STATEMENT", 38]]),
    line(1, 487.5, [["Total Transactions: 5", 38]]),
    line(1, 473.5, [["Receipt No. Completion Time Details Transaction Status Paid In Withdrawn Balance", 50.9]]),

    rowStart(1, 462.5, { receipt: "UG12KA80PR", date: "2026-07-01", details: "Customer Transfer of Funds", withdrawn: "7.00", balance: "3,650.23" }),
    continuation(1, 455.5, "20:52:29", "Charge"),
    rowStart(1, 437.5, { receipt: "UG12KA80PR", date: "2026-07-01", details: "Customer Transfer to", withdrawn: "400.00", balance: "3,657.23" }),
    continuation(1, 430.5, "20:52:29", "254*****8959 - salim mwazumi"),

    rowStart(1, 412.5, { receipt: "UG12KA6JPI", date: "2026-07-01", details: "Merchant Payment Fuliza M-", withdrawn: "250.00", balance: "0.00" }),
    continuation(1, 405.5, "17:20:21", "Pesa Online to 915251 - Total"),
    line(1, 398.5, [["New Ukunda Service Station", 178.5]]),
    rowStart(1, 380.5, { receipt: "UG12KA6JPI", date: "2026-07-01", details: "OverDraft of Credit Party", paidIn: "251.37", balance: "251.37" }),
    continuation(1, 373.5, "17:20:21"),

    ...footer(1, 2),

    line(2, 779, [["UG12KA6YJA", 39], ["2026-07-01", 108.7], ["Business Payment from", 178.5], ["Completed", 283.1], ["1,500.00", 403], ["0.00", 464.9], ["1,500.00", 528.9]]),
    continuation(2, 772, "18:27:16", "4133807 - ZENKA DIGITAL"),
    line(2, 765, [["LIMITED - KORO via API.", 178.5]]),
    line(2, 758, [["Original conversation ID is abc-123.", 178.5]]),
    ...footer(2, 2),
  ];

  return {
    pages: 2,
    charCount: lines.reduce((n, l) => n + l.cells.reduce((m, c) => m + c.text.length, 0), 0),
    lines,
  };
}

/** Paybill-owner layout: 9 columns with Transaction Type and Other Party after the balance. */
export function syntheticMpesaPaybillDocument(): ExtractedDocument {
  const lines: TextLine[] = [
    line(1, 767, [["M-PESA STATEMENT", 38]]),
    line(1, 740, [["Customer Name: TEST BUSINESS", 38]]),
    line(1, 706, [["Statement Period: 1st July 2026 - 2nd July 2026", 38]]),
    line(1, 500, [["DETAILED STATEMENT", 38]]),
    line(1, 473.5, [["Receipt No. Completion Time Details Transaction Status Paid In Withdrawn Balance Transaction Type Other Party", 50.9]]),
    line(1, 462.5, [
      ["UG12KAPB01", 39],
      ["2026-07-01", 108.7],
      ["Pay Bill Online to 888880 - KPLC PREPAID", 178.5],
      ["Completed", 283.1],
      ["0.00", 403],
      ["500.00", 464.9],
      ["4,500.00", 528.9],
      ["Pay Bill", 610],
      ["KPLC PREPAID", 700],
    ]),
    continuation(1, 455.5, "20:00:00"),
    line(1, 437.5, [
      ["UG12KAPB02", 39],
      ["2026-07-01", 108.7],
      ["Funds received from 254*****0000 - SAMPLE SENDER", 178.5],
      ["Completed", 283.1],
      ["1,000.00", 403],
      ["0.00", 464.9],
      ["5,500.00", 528.9],
      ["Funds received", 610],
      ["SAMPLE SENDER", 700],
    ]),
    continuation(1, 430.5, "19:00:00"),
    ...footer(1, 1),
  ];

  return {
    pages: 1,
    charCount: lines.reduce((n, l) => n + l.cells.reduce((m, c) => m + c.text.length, 0), 0),
    lines,
  };
}
