export function parseCsvRecords(content: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let insideQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (insideQuotes) {
      if (character === '"' && content[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        insideQuotes = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field.length === 0) {
      insideQuotes = true;
    } else if (character === ",") {
      record.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      record.push(field);
      if (record.some((value) => value.trim())) records.push(record);
      record = [];
      field = "";
      if (character === "\r" && content[index + 1] === "\n") index += 1;
    } else {
      field += character;
    }
  }

  if (insideQuotes) throw new Error("The CSV contains an unclosed quoted field.");
  record.push(field);
  if (record.some((value) => value.trim())) records.push(record);
  return records;
}
