// Validate a selected file before reading it into the processing Worker.
import { MAX_FILE_BYTES } from './limits';

export function getFileError(file: File): string | null {
  const csvByName = file.name.toLowerCase().endsWith('.csv');
  const csvByType = file.type.split(';', 1)[0].trim().toLowerCase() === 'text/csv';

  if (/\.(?:xls|xlsx|xlsm|xlsb)$/i.test(file.name)) {
    return 'This looks like an Excel file. Save it as CSV and try again.';
  }
  if (!csvByName && !csvByType) {
    return 'Choose a .csv file to continue.';
  }
  if (file.size > MAX_FILE_BYTES) {
    return 'This file is too big for your browser. Split it in two and try again.';
  }

  return null;
}
