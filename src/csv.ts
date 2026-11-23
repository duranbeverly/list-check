export type CsvEncoding = 'UTF-8' | 'Windows-1252';

export interface DecodedCsv {
  text: string;
  encoding: CsvEncoding;
}

export function decodeCsvBytes(bytes: Uint8Array): DecodedCsv {
  const utf8Text = new TextDecoder('utf-8').decode(bytes);
  const usedWindows1252 = utf8Text.includes('\uFFFD');
  const text = usedWindows1252
    ? new TextDecoder('windows-1252').decode(bytes)
    : utf8Text;

  return {
    text: text.replace(/\r\n?/g, '\n'),
    encoding: usedWindows1252 ? 'Windows-1252' : 'UTF-8',
  };
}
