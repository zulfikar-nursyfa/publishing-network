/**
 * CSV text for `rows` with the given columns ({ key, label }). Starts with a byte order mark so
 * Excel reads Arabic correctly. Text that a spreadsheet would run as a formula (=, +, -, @) is
 * prefixed with an apostrophe.
 */
const BOM = String.fromCharCode(0xfeff);

export function toCsv(columns, rows) {
  const cell = (value) => {
    if (value === null || value === undefined) return "";
    let text = String(value);
    if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [
    columns.map((column) => cell(column.label)),
    ...rows.map((row) => columns.map((c) => cell(row[c.key]))),
  ];
  return `${BOM}${lines.map((line) => line.join(",")).join("\r\n")}\r\n`;
}
