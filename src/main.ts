import './style.css';

// Your code starts here.
// Add an event listener to the file input element to handle file selection
const fileInput = document.getElementById('file-input') as HTMLInputElement;

// Throw an error if the file input element is not found
if (!fileInput) {
  throw new Error('File input element not found');
}

fileInput.addEventListener('change', (event) => {
  const file = (fileInput.files?.[0]);
  if (file) {
    // Handle the selected CSV file here
    console.log(`Selected file: ${file.name}`);

    // Add the result paragraph to display the selected file name, people found in csv, and count of people found in csv
    const summaryParagraph = document.getElementById('summary') as HTMLParagraphElement;
    if (summaryParagraph) {
      summaryParagraph.textContent = `Selected file: ${file.name} has been processed. People found in CSV: [List of people]. Count of people found in CSV: [Count]`;
    } else {
      throw new Error('Summary paragraph element not found');
    }
   
   
  }
}); 

// 