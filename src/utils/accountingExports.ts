export interface ExportColumn<Row extends Record<string, unknown>> {
  key: keyof Row;
  label: string;
}

const sanitizeValue = (value: unknown) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
};

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
  const lines = [
    columns.map((column) => `"${column.label.replace(/"/g, '""')}"`).join(','),
    ...rows.map((row) =>
      columns
        .map((column) => `"${String(sanitizeValue(row[column.key])).replace(/"/g, '""')}"`)
        .join(','),
    ),
  ];

  downloadBlob(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' }), `${fileName}.csv`);
};

export const exportRowsAsExcel = <Row extends Record<string, unknown>>(
  fileName: string,
  sheetName: string,
  columns: ReadonlyArray<ExportColumn<Row>>,
  rows: Row[],
) => {
  void import('xlsx').then((XLSX) => {
    const worksheet = XLSX.utils.json_to_sheet(
    rows.map((row) =>
      columns.reduce<Record<string, unknown>>((accumulator, column) => {
        accumulator[column.label] = sanitizeValue(row[column.key]);
        return accumulator;
      }, {}),
    ),
  );

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
  });
};

export const exportRowsAsPdf = <Row extends Record<string, unknown>>(
  fileName: string,
  title: string,
  columns: ReadonlyArray<ExportColumn<Row>>,
  rows: Row[],
) => {
  void import('jspdf').then(({ jsPDF }) => {
    const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const startY = 44;
  const lineHeight = 18;
  const columnWidth = Math.max(90, Math.floor((pageWidth - 60) / columns.length));

  doc.setFontSize(18);
  doc.text(title, 30, startY);
  doc.setFontSize(10);

  let y = startY + 28;
  columns.forEach((column, index) => {
    doc.text(String(column.label), 30 + index * columnWidth, y);
  });

  y += 12;
  doc.line(30, y, pageWidth - 30, y);
  y += 18;

  rows.forEach((row) => {
    if (y > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      y = 40;
    }

    columns.forEach((column, index) => {
      const value = String(sanitizeValue(row[column.key])).slice(0, 28);
      doc.text(value, 30 + index * columnWidth, y, {
        maxWidth: columnWidth - 12,
      });
    });

    y += lineHeight;
  });

  doc.save(`${fileName}.pdf`);
  });
};
