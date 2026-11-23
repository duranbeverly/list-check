import Papa from 'papaparse';
import './style.css';

const fileInput = document.getElementById('file-input') as HTMLInputElement;

// Throw an error if the file input element is not found
if (!fileInput) {
  throw new Error('File input element not found');
}

function handleFile(file: File) {
  const summaryParagraph = document.getElementById('summary') as HTMLParagraphElement;
  if (!summaryParagraph) {
    throw new Error('Summary paragraph element not found');
  }

  summaryParagraph.textContent = `Reading ${file.name}…`;
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    encoding: 'UTF-8',
    complete: (results) => {
      if (results.errors.length > 0) {
        summaryParagraph.textContent = `We couldn't read ${file.name} correctly. Please check that it's a valid CSV file.`;
        return;
      }

      const count = results.data.length;
      const message = count === 0
        ? `No people found in ${file.name}.`
        : `${count} ${count === 1 ? 'person' : 'people'} found in ${file.name}.`;
      const columns = (results.meta.fields ?? []).join(', ') || 'none';

      summaryParagraph.replaceChildren(
        document.createTextNode(message),
        document.createElement('br'),
        document.createTextNode(`Columns: ${columns}`),
      );
    },
    error: () => {
      summaryParagraph.textContent = `We couldn't read ${file.name}. Please try another CSV file.`;
    },
  });
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) {
    handleFile(file);
  }
});