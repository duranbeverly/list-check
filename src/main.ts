// Load the CSV reader and page styles.
import Papa from 'papaparse';
import { guessColumns } from './columns';
import { checkList, findDuplicates, findFatalParseError, toMembers } from './rules';
import './style.css';
import type { MemberBuckets, RawRow } from './types';

// Find the controls and result area.
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const sampleButton = document.getElementById('sample-button') as HTMLButtonElement;
const summaryParagraph = document.getElementById('summary') as HTMLParagraphElement;
const reviewList = document.getElementById('review-list') as HTMLUListElement;

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

// Show each reviewed member as safe text.
function renderReport(buckets: MemberBuckets) {
  const readyCount = buckets.ready.length;
  const reviewCount = buckets.needsReview.length;
  const optedOutCount = buckets.optedOut.length;
  const headline = document.createElement('strong');
  headline.textContent = readyCount === 0
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
    item.textContent = readyCount > 0 ? 'Everyone looks ready to import.' : 'No people need a review.';
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

// Read the selected file and share a clear result.
function handleFile(file: File) {
  reviewList.replaceChildren();

  // Let people know the file is being read.
  summaryParagraph.textContent = `Reading ${file.name}…`;

  // Keep blank lines so each member keeps their true file row.
  Papa.parse<RawRow>(file, {
    header: true,
    skipEmptyLines: false,
    encoding: 'UTF-8',

    complete: (results) => {
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
      renderReport(buckets);
    },

    // Show a helpful message if the file cannot be read.
    error: () => {
      summaryParagraph.textContent = `We couldn't read ${file.name}. Please try another CSV file.`;
    },
  });
}

// Handle a newly selected file.
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) {
    handleFile(file);
  }
});

// Load the sample list and use the same file reader.
sampleButton.addEventListener('click', async () => {
  reviewList.replaceChildren();
  summaryParagraph.textContent = 'Loading the sample list…';

  // Download the sample list and pass it to the file reader.
  try {
    const response = await fetch(import.meta.env.BASE_URL + 'sample-members.csv');
    if (!response.ok) {
      summaryParagraph.textContent = `The sample list couldn't be loaded. Please try again.`;
      return;
    }

    const contents = await response.text();
    const file = new File([contents], 'sample-members.csv', { type: 'text/csv' });
    handleFile(file);
  } catch {
    summaryParagraph.textContent = `The sample list couldn't be loaded. Please try again.`;
  }
});