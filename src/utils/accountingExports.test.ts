import { describe, expect, it } from 'vitest';

import {
  calculatePdfTableLayout,
  sanitizeSpreadsheetCellValue,
  serializeRowsAsCsv,
} from './accountingExports';

describe('sanitizeSpreadsheetCellValue', () => {
  it.each([
    '=1+1',
    '+SUM(A1:A2)',
    '-2+3',
    '@SUM(A1:A2)',
    '  =HYPERLINK("https://example.test")',
    '\t=1+1',
  ])('neutralizes formula-like string %j for CSV and XLSX', (value) => {
    expect(sanitizeSpreadsheetCellValue(value, 'csv')).toBe(`'${value}`);
    expect(sanitizeSpreadsheetCellValue(value, 'xlsx')).toBe(`'${value}`);
  });

  it('keeps real numbers numeric, including negative numbers', () => {
    expect(sanitizeSpreadsheetCellValue(-42, 'csv')).toBe(-42);
    expect(sanitizeSpreadsheetCellValue(12.5, 'xlsx')).toBe(12.5);
  });

  it('marks leading-zero CSV identifiers as text without altering XLSX strings', () => {
    expect(sanitizeSpreadsheetCellValue('00037', 'csv')).toBe("'00037");
    expect(sanitizeSpreadsheetCellValue('00037', 'xlsx')).toBe('00037');
    expect(sanitizeSpreadsheetCellValue('0', 'csv')).toBe('0');
  });
});

describe('serializeRowsAsCsv', () => {
  it('escapes quotes, neutralizes formulas, and preserves leading-zero invoice numbers', () => {
    const csv = serializeRowsAsCsv(
      [
        { key: 'invoice', label: 'Invoice' },
        { key: 'client', label: 'Client' },
        { key: 'amount', label: 'Amount' },
      ] as const,
      [{ invoice: '00037', client: '=2+2 "danger"', amount: 15.25 }],
    );

    expect(csv).toBe([
      '"Invoice","Client","Amount"',
      '"\'00037","\'=2+2 ""danger""","15.25"',
    ].join('\n'));
  });
});

describe('calculatePdfTableLayout', () => {
  it('keeps a wide ten-column report inside the printable page width', () => {
    const pageWidth = 842;
    const columnCount = 10;
    const layout = calculatePdfTableLayout(pageWidth, columnCount);
    const rightEdge = layout.horizontalMargin
      + (columnCount - 1) * layout.columnWidth
      + layout.cellWidth;

    expect(rightEdge).toBeLessThanOrEqual(pageWidth - layout.horizontalMargin);
    expect(layout.fontSize).toBe(8);
  });
});
