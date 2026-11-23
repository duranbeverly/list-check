// Load the CSV reader and page styles.
import Papa from 'papaparse';
import { guessColumns } from './columns';
import { checkList, findDuplicates, findFatalParseError, toCsv, toMembers } from './rules';
import './style.css';
import type { MemberBuckets, RawRow } from './types';

// Find the controls and result area.
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const sampleButton = document.getElementById('sample-button') as HTMLButtonElement;
const summaryParagraph = document.getElementById('summary') as HTMLParagraphElement;
const reviewList = document.getElementById('review-list') as HTMLUListElement;
const downloadReadyButton = document.getElementById('download-ready') as HTMLButtonElement;
const downloadReviewButton = document.getElementById('download-review') as HTMLButtonElement;
const downloadOptedOutButton = document.getElementById('download-opted-out') as HTMLButtonElement;

// Keep the checked report ready for the download buttons.
let currentReport: { headers: string[]; buckets: MemberBuckets; baseName: string } | null = null;
let runCounter = 0;

// Make sure the upload control is on the page.
if (!fileInput) {
  throw new Error('File input element not found');
}

// Make sure the sample-list button is on the page.
if (!sampleButton) {
  throw new Error('Sample button element not found');
}

// Make sure the result area is on the page.
if (!summaryParagraph) {
  throw new Error('Summary paragraph element not found');
}

// Make sure the review list is on the page.
if (!reviewList) {
  throw new Error('Review list element not found');
}

// Make sure all download buttons are on the page.
if (!downloadReadyButton || !downloadReviewButton || !downloadOptedOutButton) {
  throw new Error('Download button not found');
}

// Disable downloads until a file has been checked.
function clearDownloads() {
  currentReport = null;
  downloadReadyButton.disabled = true;
  downloadReviewButton.disabled = true;
  downloadOptedOutButton.disabled = true;
}

// Show each reviewed member as safe text.
function renderReport(buckets: MemberBuckets) {
  const readyCount = buckets.ready.length;
  const reviewCount = buckets.needsReview.length;
  const optedOutCount = buckets.optedOut.length;
  const headline = document.createElement('strong');
  headline.textContent = readyCount === 0 && reviewCount === 0 && optedOutCount > 0
    ? 'Everyone on this list has opted out. No one is ready to import.'
    : readyCount === 0
      ? 'No one is ready yet. Check the people to review below.'
      : `${readyCount} ${readyCount === 1 ? 'person is' : 'people are'} ready to import.`;
  const reviewSummary = reviewCount === 1 ? '1 person needs a quick look' : `${reviewCount} need a quick look`;

  summaryParagraph.replaceChildren(
    headline,
    document.createElement('br'),
    document.createTextNode(`⚠ ${reviewSummary} · 🚫 ${optedOutCount} opted out (kept out of the import file)`),
  );

  reviewList.replaceChildren();
  if (reviewCount === 0) {
    const item = document.createElement('li');
    item.textContent = readyCount > 0
      ? 'Everyone looks ready to import.'
      : optedOutCount > 0
        ? 'Everyone on this list opted out.'
        : 'No people need a review.';
    reviewList.append(item);
    return;
  }

  for (const member of buckets.needsReview.slice(0, 10)) {
    const item = document.createElement('li');
    const name = [member.firstName, member.lastName].filter(Boolean).join(' ') || 'Name not provided';
    item.textContent = `⚠ Needs review: Row ${member.row} · ${name}: ${member.reasons.join('; ')}`;
    reviewList.append(item);
  }

  if (reviewCount > 10) {
    const item = document.createElement('li');
    item.textContent = `⚠ Needs review: and ${reviewCount - 10} more in the download.`;
    reviewList.append(item);
  }
}

// Turn one checked bucket into a CSV download.
function downloadBucket(bucketName: keyof MemberBuckets) {
  const report = currentReport;
  if (!report) {
    return;
  }

  const bucket = report.buckets[bucketName];
  if (bucket.length === 0) {
    return;
  }

  const csv = toCsv(bucket, report.headers);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const suffix = bucketName === 'needsReview' ? 'needs-review' : bucketName === 'optedOut' ? 'opted-out' : 'ready';

  link.href = url;
  link.download = `${report.baseName}-${suffix}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

// Read the selected file and share a clear result.
function handleFile(file: File, runId = ++runCounter) {
  if (runId !== runCounter) {
    return;
  }

  clearDownloads();
  reviewList.replaceChildren();

  // Let people know the file is being read.
  summaryParagraph.textContent = `Reading ${file.name}…`;

  // Keep blank lines so each member keeps their true file row.
  Papa.parse<RawRow>(file, {
    header: true,
    skipEmptyLines: false,
    encoding: 'UTF-8',

    complete: (results) => {
      if (runId !== runCounter) {
        return;
      }

      // Ignore blank-line warnings but explain real row problems.
      const fatalError = findFatalParseError(results.errors, results.data);
      if (fatalError) {
        const hasFieldMismatch = fatalError.code === 'TooFewFields' || fatalError.code === 'TooManyFields';
        summaryParagraph.textContent = hasFieldMismatch && fatalError.row !== undefined
          ? `Row ${fatalError.row + 2} in ${file.name} doesn't match the header. Check that each row has the same number of columns as the first row.`
          : hasFieldMismatch
            ? `A row in ${file.name} doesn't match the header. Check that each row has the same number of columns as the first row.`
            : `We couldn't read ${file.name} correctly. Please check that it's a valid CSV file.`;
        return;
      }

      // Check for a contact column and prepare the summary.
      const headers = results.meta.fields ?? [];
      const guessedColumns = guessColumns(headers);
      if (!guessedColumns.phone && !guessedColumns.email) {
        summaryParagraph.textContent = `No phone or email column was found in ${file.name}. Check that the first row has a phone or email column header.`;
        return;
      }

      const members = toMembers(results.data, guessedColumns);
      const groups = findDuplicates(members);
      const buckets = checkList(members, groups);
      currentReport = {
        headers,
        buckets,
        baseName: file.name.replace(/\.csv$/i, ''),
      };
      downloadReadyButton.disabled = buckets.ready.length === 0;
      downloadReviewButton.disabled = buckets.needsReview.length === 0;
      downloadOptedOutButton.disabled = buckets.optedOut.length === 0;
      renderReport(buckets);
    },

    // Show a helpful message if the file cannot be read.
    error: () => {
      if (runId !== runCounter) {
        return;
      }

      summaryParagraph.textContent = `We couldn't read ${file.name}. Please try another CSV file.`;
    },
  });
}

// Handle a newly selected file.
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) {
    handleFile(file);
    fileInput.value = '';
  }
});

// Load the sample list and use the same file reader.
sampleButton.addEventListener('click', async () => {
  const runId = ++runCounter;
  clearDownloads();
  reviewList.replaceChildren();
  summaryParagraph.textContent = 'Loading the sample list…';

  // Download the sample list and pass it to the file reader.
  try {
    const response = await fetch(import.meta.env.BASE_URL + 'sample-members.csv');
    if (runId !== runCounter) {
      return;
    }

    if (!response.ok) {
      summaryParagraph.textContent = `The sample list couldn't be loaded. Please try again.`;
      return;
    }

    const contents = await response.text();
    if (runId !== runCounter) {
      return;
    }

    const file = new File([contents], 'sample-members.csv', { type: 'text/csv' });
    handleFile(file, runId);
  } catch {
    if (runId === runCounter) {
      summaryParagraph.textContent = `The sample list couldn't be loaded. Please try again.`;
    }
  }
});

// Download the selected report bucket as a CSV file.
downloadReadyButton.addEventListener('click', () => downloadBucket('ready'));
downloadReviewButton.addEventListener('click', () => downloadBucket('needsReview'));
downloadOptedOutButton.addEventListener('click', () => downloadBucket('optedOut'));