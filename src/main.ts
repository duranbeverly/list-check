import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import Papa from 'papaparse';
import { guessColumns } from './columns';
import { checkList, findDuplicates, findFatalParseError, toCsv, toMembers } from './rules';
import type { MemberBuckets } from './types';
import './style.css';

function getRequiredElement<T extends HTMLElement>(
  id: string,
  elementType: { new (): T },
): T {
  const element = document.getElementById(id);
  if (!(element instanceof elementType)) {
    throw new Error(`The page is missing the required #${id} control.`);
  }
  return element;
}

const fileInput = getRequiredElement('file-input', HTMLInputElement);
const uploadZone = getRequiredElement('upload-zone', HTMLLabelElement);
const chooseCard = getRequiredElement('choose-card', HTMLElement);
const resultsCard = getRequiredElement('results-card', HTMLElement);
const sampleButton = getRequiredElement('sample-button', HTMLButtonElement);
const fileStatus = getRequiredElement('file-status', HTMLParagraphElement);
const selectedFile = getRequiredElement('selected-file', HTMLParagraphElement);
const chooseDifferentFile = getRequiredElement('choose-different-file', HTMLButtonElement);
const checkedFileName = getRequiredElement('checked-file-name', HTMLParagraphElement);
const summary = getRequiredElement('summary', HTMLParagraphElement);
const readyCount = getRequiredElement('ready-count', HTMLSpanElement);
const reviewCount = getRequiredElement('review-count', HTMLSpanElement);
const optedOutCount = getRequiredElement('opted-out-count', HTMLSpanElement);
const nextStep = getRequiredElement('next-step', HTMLParagraphElement);
const reviewTable = getRequiredElement('review-table', HTMLTableElement);
const reviewHeading = getRequiredElement('review-heading', HTMLHeadingElement);
const reviewTableCaption = getRequiredElement('review-caption', HTMLTableCaptionElement);
const reviewTableBody = getRequiredElement('review-table-body', HTMLTableSectionElement);
const reviewEmpty = getRequiredElement('review-empty', HTMLParagraphElement);
const downloadReadyButton = getRequiredElement('download-ready', HTMLButtonElement);
const downloadReviewButton = getRequiredElement('download-review', HTMLButtonElement);
const downloadOptedOutButton = getRequiredElement('download-opted-out', HTMLButtonElement);
const checkAnotherButton = getRequiredElement('check-another', HTMLButtonElement);

let runCounter = 0;
let currentBuckets: MemberBuckets | null = null;
let currentFileName = '';
let currentHeaders: string[] = [];

function clearResults() {
  currentBuckets = null;
  currentFileName = '';
  currentHeaders = [];
  resultsCard.hidden = true;
  reviewTableBody.replaceChildren();
  reviewTable.hidden = true;
  reviewEmpty.hidden = true;
  downloadReadyButton.hidden = true;
  downloadReviewButton.hidden = true;
  downloadOptedOutButton.hidden = true;
}

function formatReviewReason(reason: string): string {
  if (reason === 'phone too short') return 'Phone too short. Check the number.';
  if (reason === 'phone missing') return 'Phone missing. Add the number if available.';
  if (reason === 'phone not a valid number') return 'Phone is not valid. Check the number.';

  const duplicateEmail = reason.match(/^same email as row (\d+)$/);
  if (duplicateEmail) return `Same email as row ${duplicateEmail[1]}. Keep one.`;

  const duplicatePhone = reason.match(/^same phone as row (\d+)$/);
  if (duplicatePhone) return `Same phone as row ${duplicatePhone[1]}. Confirm who uses it.`;

  const sharedOptOut = reason.match(/^shared phone with opted-out row (\d+)$/);
  if (sharedOptOut) {
    return `Phone shared with opted-out row ${sharedOptOut[1]}. Keep everyone on it out of texts.`;
  }

  const sharedPhone = reason.match(/^shared phone with row (\d+)$/);
  if (sharedPhone) return `Phone shared with row ${sharedPhone[1]}. Confirm who uses it.`;

  if (reason.startsWith('Opt-out value')) {
    return `${reason}. Confirm permission before texting.`;
  }

  return `${reason.charAt(0).toUpperCase()}${reason.slice(1)}.`;
}

function renderReviewTable(buckets: MemberBuckets) {
  reviewTableBody.replaceChildren();

  if (buckets.needsReview.length === 0) {
    reviewTable.hidden = true;
    reviewHeading.hidden = true;
    reviewEmpty.hidden = false;
    if (buckets.ready.length > 0) {
      setReviewEmptyMessage('Everyone looks ready.', 'ready');
    } else if (buckets.optedOut.length > 0) {
      setReviewEmptyMessage(
        'Everyone on this list opted out. No one is ready to import.',
        'opted-out',
      );
    } else {
      setReviewEmptyMessage('No people were found in this list.');
    }
    return;
  }

  reviewEmpty.hidden = true;
  reviewHeading.hidden = false;
  reviewTable.hidden = false;
  const count = buckets.needsReview.length;
  reviewTableCaption.textContent = `${count} ${count === 1 ? 'person' : 'people'} to check`;

  buckets.needsReview.slice(0, 10).forEach((member) => {
    const row = document.createElement('tr');
    const rowCell = document.createElement('td');
    rowCell.dataset.label = 'Row';
    const rowBadge = document.createElement('span');
    rowBadge.className = 'row-badge';
    rowBadge.textContent = `Row ${member.row}`;
    rowCell.append(rowBadge);

    const nameCell = document.createElement('td');
    nameCell.dataset.label = 'Name';
    nameCell.textContent = `${member.firstName} ${member.lastName}`.trim() || 'Name not provided';

    const reasonCell = document.createElement('td');
    reasonCell.dataset.label = 'What to check';
    reasonCell.textContent = member.reasons.map(formatReviewReason).join(' ');

    row.append(rowCell, nameCell, reasonCell);
    reviewTableBody.append(row);
  });

  if (count > 10) {
    const moreRow = document.createElement('tr');
    const moreCell = document.createElement('td');
    moreCell.colSpan = 3;
    moreCell.textContent = `and ${count - 10} more in the download.`;
    moreRow.append(moreCell);
    reviewTableBody.append(moreRow);
  }
}

function setReviewEmptyMessage(
  message: string,
  state?: 'ready' | 'opted-out',
) {
  reviewEmpty.className = state ? `review-empty review-empty--${state}` : 'review-empty';
  reviewEmpty.replaceChildren();

  if (state) {
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('class', 'review-empty-icon');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('aria-hidden', 'true');
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '12');
    circle.setAttribute('cy', '12');
    circle.setAttribute('r', '9');
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', 'currentColor');
    circle.setAttribute('stroke-width', '2');
    icon.append(circle);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute(
      'd',
      state === 'ready' ? 'm20 6-11 11-5-5' : 'm4.9 4.9 14.2 14.2',
    );
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-width', '2');
    icon.append(path);
    reviewEmpty.append(icon);
  }

  const text = document.createElement('span');
  text.textContent = message;
  reviewEmpty.append(text);
}

function setDownloadButton(
  button: HTMLElement,
  label: string,
  bucketCount: number,
  isPrimary: boolean,
) {
  button.hidden = bucketCount === 0;
  button.textContent = `${label} (${bucketCount})`;
  button.className = isPrimary ? 'button-primary' : 'button-secondary';
}

function renderReport(fileName: string, buckets: MemberBuckets, headers: string[]) {
  currentBuckets = buckets;
  currentFileName = fileName;
  currentHeaders = headers;
  const ready = buckets.ready.length;
  const review = buckets.needsReview.length;
  const optedOut = buckets.optedOut.length;

  readyCount.textContent = String(ready);
  reviewCount.textContent = String(review);
  optedOutCount.textContent = String(optedOut);
  checkedFileName.textContent = fileName;

  if (ready === 0 && review === 0 && optedOut === 0) {
    summary.textContent = 'No people were found in this list. Check the file and try again.';
  } else if (review === 0 && ready === 0 && optedOut > 0) {
    summary.textContent = 'Everyone on this list has opted out. No one is ready to import.';
  } else if (review === 0) {
    summary.textContent = 'Everyone looks ready to import.';
  } else if (ready === 0) {
    summary.textContent = 'No one is ready yet. Check the people to review below.';
  } else if (ready > 0 && review > 0) {
    summary.textContent = `${ready} ${ready === 1 ? 'person is' : 'people are'} ready to import.`;
  } else {
    summary.textContent = 'No one is ready yet. Check the people to review below.';
  }

  if (ready > 0 && review > 0) {
    nextStep.textContent = `Import the ${ready} ready ${ready === 1 ? 'person' : 'people'} now. Check the ${review} below.`;
  } else if (ready > 0) {
    nextStep.textContent = `Import the ${ready} ready ${ready === 1 ? 'person' : 'people'} now.`;
  } else if (review > 0) {
    nextStep.textContent = `Check the ${review} ${review === 1 ? 'person' : 'people'} below before importing.`;
  } else if (optedOut > 0) {
    nextStep.textContent = 'No one from this list can be imported.';
  } else {
    nextStep.textContent = 'Add people to your list and check the file again.';
  }

  renderReviewTable(buckets);

  const readyIsPrimary = ready > 0;
  const reviewIsPrimary = ready === 0 && review > 0;
  const optedOutIsPrimary = ready === 0 && review === 0 && optedOut > 0;
  setDownloadButton(downloadReadyButton, 'Download ready list', ready, readyIsPrimary);
  setDownloadButton(downloadReviewButton, 'Download to review', review, reviewIsPrimary);
  setDownloadButton(downloadOptedOutButton, 'Download opt-outs', optedOut, optedOutIsPrimary);

  chooseCard.hidden = true;
  resultsCard.hidden = false;
}

function showFileError(message: string) {
  clearResults();
  chooseCard.hidden = false;
  fileStatus.textContent = message;
  fileStatus.hidden = false;
}

function handleFile(file: File, existingRun?: number) {
  const runId = existingRun ?? ++runCounter;
  clearResults();
  chooseCard.hidden = false;
  selectedFile.textContent = `Selected file: ${file.name}`;
  selectedFile.hidden = false;
  chooseDifferentFile.hidden = false;
  fileStatus.textContent = `Reading ${file.name}…`;
  fileStatus.hidden = false;

  Papa.parse<Record<string, string>>(file, {
    header: true,
    skipEmptyLines: false,
    encoding: 'UTF-8',
    complete: (results) => {
      if (runId !== runCounter) return;

      if (findFatalParseError(results.errors, results.data)) {
        showFileError(
          'This CSV has rows that do not match its headers. Check the file and try again.',
        );
        return;
      }

      const headers = results.meta.fields ?? [];
      const columns = guessColumns(headers);
      if (!columns.phone && !columns.email) {
        showFileError('Could not find a phone or email column. Add one and try again.');
        return;
      }

      const members = toMembers(results.data, columns);
      const duplicateGroups = findDuplicates(members);
      const buckets = checkList(members, duplicateGroups);
      fileStatus.textContent = '';
      fileStatus.hidden = true;
      renderReport(file.name, buckets, headers);
    },
    error: () => {
      if (runId !== runCounter) return;
      showFileError('Could not read this file. Check that it is a valid CSV and try again.');
    },
  });
}

function processFile(file: File) {
  if (!file.name.toLowerCase().endsWith('.csv')) {
    ++runCounter;
    showFileError('Choose a CSV file to continue.');
    fileInput.value = '';
    return;
  }
  handleFile(file);
  fileInput.value = '';
}

function downloadBucket(bucket: keyof MemberBuckets) {
  if (!currentBuckets) return;
  const rows = currentBuckets[bucket];
  if (rows.length === 0) return;

  const csv = toCsv(rows, currentHeaders);
  const baseName = currentFileName.replace(/\.csv$/i, '');
  const suffix =
    bucket === 'ready' ? 'ready' : bucket === 'needsReview' ? 'needs-review' : 'opted-out';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${baseName}-${suffix}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) processFile(file);
});

chooseDifferentFile.addEventListener('click', () => fileInput.click());

sampleButton.addEventListener('click', async () => {
  const runId = ++runCounter;
  clearResults();
  chooseCard.hidden = false;
  fileStatus.textContent = 'Loading the sample list…';
  fileStatus.hidden = false;
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}sample-members.csv`);
    if (runId !== runCounter) return;
    if (!response.ok) {
      showFileError('Could not load the sample list. Please choose a CSV file instead.');
      return;
    }

    const csv = await response.text();
    if (runId !== runCounter) return;
    const sample = new File([csv], 'sample-members.csv', { type: 'text/csv' });
    handleFile(sample, runId);
  } catch {
    if (runId === runCounter) {
      showFileError('Could not load the sample list. Please choose a CSV file instead.');
    }
  }
});

downloadReadyButton.addEventListener('click', () => downloadBucket('ready'));
downloadReviewButton.addEventListener('click', () => downloadBucket('needsReview'));
downloadOptedOutButton.addEventListener('click', () => downloadBucket('optedOut'));

checkAnotherButton.addEventListener('click', (event) => {
  event.preventDefault();
  ++runCounter;
  clearResults();
  chooseCard.hidden = false;
  fileStatus.textContent = '';
  fileStatus.hidden = true;
  selectedFile.textContent = '';
  selectedFile.hidden = true;
  chooseDifferentFile.hidden = true;
  fileInput.value = '';
  fileInput.focus();
});

uploadZone.addEventListener('dragover', (event) => {
  event.preventDefault();
  uploadZone.classList.add('is-drag-over');
});

uploadZone.addEventListener('dragleave', () => {
  uploadZone.classList.remove('is-drag-over');
});

uploadZone.addEventListener('drop', (event) => {
  event.preventDefault();
  uploadZone.classList.remove('is-drag-over');
  const file = event.dataTransfer?.files[0];
  if (file) processFile(file);
});
