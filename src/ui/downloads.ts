// Build and save the selected CSV bucket without sending list data elsewhere.
import { toCsv } from '../rules';
import type { MemberBuckets } from '../types';
import { getRequiredElement } from './dom';

interface DownloadReport {
  fileName: string;
  headers: string[];
  buckets: MemberBuckets;
}

const readyButton = getRequiredElement('download-ready', HTMLButtonElement);
const reviewButton = getRequiredElement('download-review', HTMLButtonElement);
const optedOutButton = getRequiredElement('download-opted-out', HTMLButtonElement);
let currentReport: DownloadReport | null = null;

function setButton(button: HTMLButtonElement, label: string, count: number, primary: boolean) {
  button.hidden = count === 0;
  button.textContent = `${label} (${count})`;
  button.className = primary ? 'button-primary' : 'button-secondary';
}

function download(bucket: keyof MemberBuckets) {
  if (!currentReport) return;
  const rows = currentReport.buckets[bucket];
  if (rows.length === 0) return;
  const baseName = currentReport.fileName.replace(/\.csv$/i, '');
  const suffix = bucket === 'ready' ? 'ready' : bucket === 'needsReview' ? 'needs-review' : 'opted-out';
  const blob = new Blob([toCsv(rows, currentReport.headers)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${baseName}-${suffix}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

readyButton.addEventListener('click', () => download('ready'));
reviewButton.addEventListener('click', () => download('needsReview'));
optedOutButton.addEventListener('click', () => download('optedOut'));

export const downloads = {
  setReport(report: DownloadReport) {
    currentReport = report;
    const { ready, needsReview, optedOut } = report.buckets;
    setButton(readyButton, 'Download ready list', ready.length, ready.length > 0);
    setButton(reviewButton, 'Download to review', needsReview.length, ready.length === 0 && needsReview.length > 0);
    setButton(
      optedOutButton,
      'Download opt-outs',
      optedOut.length,
      ready.length === 0 && needsReview.length === 0 && optedOut.length > 0,
    );
  },
  clear() {
    currentReport = null;
    readyButton.hidden = true;
    reviewButton.hidden = true;
    optedOutButton.hidden = true;
  },
};
