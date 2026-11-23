// Load the CSV reader and page styles.
import Papa from 'papaparse';
import { guessColumns } from './columns';
import './style.css';

// Find the controls and result area.
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const sampleButton = document.getElementById('sample-button') as HTMLButtonElement;
const summaryParagraph = document.getElementById('summary') as HTMLParagraphElement;

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

// Read the selected file and share a clear result.
function handleFile(file: File) {
  // Let people know the file is being read.
  summaryParagraph.textContent = `Reading ${file.name}…`;

  // Use the first row as column names and ignore blank lines.
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    encoding: 'UTF-8',

    complete: (results) => {
      // Explain any issues found in the file.
      if (results.errors.length > 0) {
        summaryParagraph.textContent = `We couldn't read ${file.name} correctly. Please check that it's a valid CSV file.`;
        return;
      }

      // Check for a contact column and prepare the summary.
      const headers = results.meta.fields ?? [];
      const guessedColumns = guessColumns(headers);
      if (!guessedColumns.phone && !guessedColumns.email) {
        summaryParagraph.textContent = `No phone or email column was found in ${file.name}. Check that the first row has a phone or email column header.`;
        return;
      }

      const count = results.data.length;
      const message = count === 0
        ? `No people found in ${file.name}.`
        : `${count} ${count === 1 ? 'person' : 'people'} found in ${file.name}.`;
      const columns = headers.join(', ') || 'none';
      const matches = [
        `Phone: ${guessedColumns.phone ?? 'not found'}`,
        `Email: ${guessedColumns.email ?? 'not found'}`,
        `Opt-out: ${guessedColumns.optOut ?? 'not found'}`,
        `First name: ${guessedColumns.firstName ?? 'not found'}`,
        `Last name: ${guessedColumns.lastName ?? 'not found'}`,
      ].join(' · ');

      summaryParagraph.replaceChildren(
        document.createTextNode(message),
        document.createElement('br'),
        document.createTextNode(`Columns: ${columns}`),
        document.createElement('br'),
        document.createTextNode(`Matches: ${matches}`),
      );
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