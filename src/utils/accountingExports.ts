export interface ExportColumn<Row extends Record<string, unknown>> {
  key: keyof Row;
  label: string;
}

type SpreadsheetExportTarget = 'csv' | 'xlsx';

const DANGEROUS_SPREADSHEET_PREFIX = /^[\s\u200B\uFEFF]*[=+\-@]/u;
const LEADING_ZERO_IDENTIFIER = /^0\d+$/;

const normalizeValue = (value: unknown): string | number => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
};

/**
 * Make user-controlled strings inert when a report is opened in spreadsheet
 * software. CSV imports also need an explicit text marker for digit-only IDs
 * with leading zeroes, otherwise Excel commonly turns invoice `00037` into 37.
 */
export const sanitizeSpreadsheetCellValue = (
  value: unknown,
  target: SpreadsheetExportTarget = 'xlsx',
): string | number => {
  const normalized = normalizeValue(value);

  if (typeof normalized !== 'string') {
    return normalized;
  }

  if (
    DANGEROUS_SPREADSHEET_PREFIX.test(normalized)
    || (target === 'csv' && LEADING_ZERO_IDENTIFIER.test(normalized))
  ) {
    return `'${normalized}`;
  }

  return normalized;
};

const quoteCsvCell = (value: unknown) =>
  `"${String(sanitizeSpreadsheetCellValue(value, 'csv')).replace(/"/g, '""')}"`;

export const serializeRowsAsCsv = <Row extends Record<string, unknown>>(
  columns: ReadonlyArray<ExportColumn<Row>>,
  rows: Row[],
) => [
  columns.map((column) => quoteCsvCell(column.label)).join(','),
  ...rows.map((row) => columns.map((column) => quoteCsvCell(row[column.key])).join(',')),
].join('\n');

const downloadBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const exportRowsAsCsv = <Row extends Record<string, unknown>>(
  fileName: string,
  columns: ReadonlyArray<ExportColumn<Row>>,
  rows: Row[],
) => {
  downloadBlob(new Blob([serializeRowsAsCsv(columns, rows)], { type: 'text/csv;charset=utf-8;' }), `${fileName}.csv`);
};

export const exportRowsAsExcel = <Row extends Record<string, unknown>>(
  fileName: string,
  sheetName: string,
  columns: ReadonlyArray<ExportColumn<Row>>,
  rows: Row[],
) => {
  return import('write-excel-file/browser').then(({ default: writeExcelFile }) => {
    const data = [
      columns.map((column) => ({
        value: sanitizeSpreadsheetCellValue(column.label, 'xlsx'),
        fontWeight: 'bold' as const,
      })),
      ...rows.map((row) =>
        columns.map((column) => sanitizeSpreadsheetCellValue(row[column.key], 'xlsx')),
      ),
    ];

    return writeExcelFile(data, {
      sheet: sheetName,
      columns: columns.map(() => ({ width: 24 })),
    }).toFile(`${fileName}.xlsx`);
  });
};

export const calculatePdfTableLayout = (pageWidth: number, columnCount: number) => {
  const horizontalMargin = 30;
  const tableWidth = Math.max(pageWidth - horizontalMargin * 2, 1);
  const safeColumnCount = Math.max(columnCount, 1);
  const columnWidth = tableWidth / safeColumnCount;

  return {
    horizontalMargin,
    columnWidth,
    cellWidth: Math.max(columnWidth - 10, 4),
    fontSize: columnCount >= 9 ? 8 : 10,
  };
};

export const exportRowsAsPdf = <Row extends Record<string, unknown>>(
  fileName: string,
  title: string,
  columns: ReadonlyArray<ExportColumn<Row>>,
  rows: Row[],
) => {
  return import('jspdf').then(({ jsPDF }) => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const startY = 44;
    const lineHeight = 18;
    const wrappedLineHeight = 12;
    const {
      horizontalMargin,
      columnWidth,
      cellWidth,
      fontSize,
    } = calculatePdfTableLayout(pageWidth, columns.length);
    const pageBottom = doc.internal.pageSize.getHeight() - 40;

    doc.setFontSize(18);
    doc.text(title, horizontalMargin, startY);
    doc.setFontSize(fontSize);

  const wrapCell = (value: unknown): string[] => {
    const lines = doc.splitTextToSize(String(normalizeValue(value)), cellWidth) as string[];
    return lines.length > 0 ? lines : [''];
  };

  const drawTableHeader = (headerY: number): number => {
    const headerLines = columns.map((column) => wrapCell(column.label));
    const headerHeight = Math.max(
      lineHeight,
      ...headerLines.map((lines) => lines.length * wrappedLineHeight),
    );

    headerLines.forEach((lines, index) => {
      doc.text(lines, horizontalMargin + index * columnWidth, headerY, {
        maxWidth: cellWidth,
        lineHeightFactor: 1.2,
      });
    });

    const separatorY = headerY + headerHeight;
    doc.line(horizontalMargin, separatorY, pageWidth - horizontalMargin, separatorY);
    return separatorY + lineHeight;
  };

  let y = drawTableHeader(startY + 28);

  rows.forEach((row) => {
    const cellLines = columns.map((column) => wrapCell(row[column.key]));
    const rowHeight = Math.max(
      lineHeight,
      ...cellLines.map((lines) => lines.length * wrappedLineHeight + 6),
    );

    if (y + rowHeight > pageBottom) {
      doc.addPage();
      doc.setFontSize(fontSize);
      doc.text(`${title} (continued)`, horizontalMargin, 30);
      y = drawTableHeader(50);
    }

    cellLines.forEach((lines, index) => {
      doc.text(lines, horizontalMargin + index * columnWidth, y, {
        maxWidth: cellWidth,
        lineHeightFactor: 1.2,
      });
    });

    y += rowHeight;
  });

    doc.save(`${fileName}.pdf`);
  });
};
