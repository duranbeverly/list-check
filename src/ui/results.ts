// Render the checked-list summary, stat tiles, and review table.
import { formatReviewReason } from '../rules';
import type { MemberBuckets } from '../types';
import { getRequiredElement } from './dom';

export interface ResultsReport {
  fileName: string;
  buckets: MemberBuckets;
  mappingMessage: string;
  phoneNote: string;
  encodingNote: string;
}

export interface ResultsView {
  render: (report: ResultsReport) => void;
  clear: () => void;
}

const readyCount = getRequiredElement('ready-count', HTMLSpanElement);
const reviewCount = getRequiredElement('review-count', HTMLSpanElement);
const optedOutCount = getRequiredElement('opted-out-count', HTMLSpanElement);
const readyTile = getRequiredElement('ready-tile', HTMLElement);
const reviewTile = getRequiredElement('review-tile', HTMLElement);
const optedOutTile = getRequiredElement('opted-out-tile', HTMLElement);
const checkedFileName = getRequiredElement('checked-file-name', HTMLParagraphElement);
const summary = getRequiredElement('summary', HTMLParagraphElement);
const optOutNote = getRequiredElement('opt-out-note-text', HTMLSpanElement);
const reviewCardHeading = getRequiredElement('review-heading', HTMLHeadingElement);
const reviewTable = getRequiredElement('review-table', HTMLTableElement);
const reviewCaption = getRequiredElement('review-caption', HTMLTableCaptionElement);
const reviewBody = getRequiredElement('review-table-body', HTMLTableSectionElement);
const reviewEmpty = getRequiredElement('review-empty', HTMLParagraphElement);
const nextStep = getRequiredElement('next-step', HTMLParagraphElement);
const resultsCard = getRequiredElement('results-card', HTMLElement);

function setEmptyMessage(message: string, state?: 'ready' | 'opted-out') {
  reviewEmpty.className = state ? `review-empty review-empty--${state}` : 'review-empty';
  reviewEmpty.replaceChildren();
  if (state) reviewEmpty.append(createStateIcon(state));
  const text = document.createElement('span');
  text.textContent = message;
  reviewEmpty.append(text);
}

function createStateIcon(state: 'ready' | 'opted-out'): SVGSVGElement {
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('class', 'review-empty-icon');
  icon.setAttribute('width', '24');
  icon.setAttribute('height', '24');
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
  path.setAttribute('d', state === 'ready' ? 'm20 6-11 11-5-5' : 'm4.9 4.9 14.2 14.2');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-width', '2');
  icon.append(path);
  return icon;
}

function appendReviewRow(member: MemberBuckets['needsReview'][number]) {
  const row = document.createElement('tr');
  const rowCell = document.createElement('td');
  rowCell.dataset.label = 'Row';
  const badge = document.createElement('span');
  badge.className = 'row-badge';
  badge.textContent = `Row ${member.row}`;
  rowCell.append(badge);

  const nameCell = document.createElement('td');
  nameCell.dataset.label = 'Name';
  nameCell.textContent = `${member.firstName} ${member.lastName}`.trim() || 'Name not provided';
  const valueCell = document.createElement('td');
  valueCell.dataset.label = 'Value';
  valueCell.textContent = getReviewValue(member);
  const reasonCell = document.createElement('td');
  reasonCell.dataset.label = 'What to check';
  reasonCell.textContent = member.reasons.map(formatReviewReason).join(' ');
  row.append(rowCell, nameCell, valueCell, reasonCell);
  reviewBody.append(row);
}

function getReviewValue(member: MemberBuckets['needsReview'][number]): string {
  if (member.phone && !member.phone.ok) return member.phoneValue || '—';
  if (member.reasons.some((reason) => (
    reason.startsWith('Opt-out value') || reason.startsWith('Subscription status')
  ))) {
    return member.optOut || '—';
  }
  if (member.reasons.some((reason) => reason.startsWith('same email'))) {
    return member.email || '—';
  }
  if (member.reasons.some((reason) => reason.includes('phone'))) {
    return member.phoneValue || '—';
  }
  return member.phoneValue || member.email || member.optOut || '—';
}

function renderReviewTable(buckets: MemberBuckets) {
  reviewBody.replaceChildren();
  const count = buckets.needsReview.length;
  if (count === 0) {
    reviewTable.hidden = true;
    reviewCardHeading.hidden = true;
    reviewEmpty.hidden = false;
    if (buckets.ready.length > 0) setEmptyMessage('Everyone looks ready.', 'ready');
    else if (buckets.optedOut.length > 0) {
      setEmptyMessage('Everyone on this list opted out. No one is ready to import.', 'opted-out');
    } else setEmptyMessage('We found the column names but no people yet.');
    return;
  }

  reviewEmpty.hidden = true;
  reviewCardHeading.hidden = false;
  reviewTable.hidden = false;
  reviewCaption.textContent = `${count} ${count === 1 ? 'person' : 'people'} to check`;
  buckets.needsReview.slice(0, 10).forEach(appendReviewRow);
  if (count > 10) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 4;
    cell.textContent = `and ${count - 10} more in the download.`;
    row.append(cell);
    reviewBody.append(row);
  }
}

function setNextStep(buckets: MemberBuckets) {
  const ready = buckets.ready.length;
  const review = buckets.needsReview.length;
  if (ready > 0 && review > 0) {
    nextStep.textContent = `Import the ${ready} ready ${ready === 1 ? 'person' : 'people'} now. Check the ${review} below.`;
  } else if (ready > 0) {
    nextStep.textContent = `Import the ${ready} ready ${ready === 1 ? 'person' : 'people'} now.`;
  } else if (review > 0) {
    nextStep.textContent = `Check the ${review} ${review === 1 ? 'person' : 'people'} below before importing.`;
  } else if (buckets.optedOut.length > 0) {
    nextStep.textContent = 'Keep these people out of the import. Download the opt-outs to save a copy.';
  } else {
    nextStep.textContent = 'Add people below the column names, then check the file again.';
  }
}

export const resultsView: ResultsView = {
  render({ fileName, buckets, mappingMessage, phoneNote, encodingNote }) {
    readyCount.textContent = String(buckets.ready.length);
    reviewCount.textContent = String(buckets.needsReview.length);
    optedOutCount.textContent = String(buckets.optedOut.length);
    readyTile.classList.toggle('stat-tile--empty', buckets.ready.length === 0);
    reviewTile.classList.toggle('stat-tile--empty', buckets.needsReview.length === 0);
    optedOutTile.classList.toggle('stat-tile--empty', buckets.optedOut.length === 0);
    checkedFileName.textContent = fileName;
    summary.textContent = `${buckets.ready.length} ready, ${buckets.needsReview.length} to review, ${buckets.optedOut.length} opted out.`;
    optOutNote.textContent = [mappingMessage, phoneNote, encodingNote].filter(Boolean).join(' ');
    setNextStep(buckets);
    renderReviewTable(buckets);
  },
  clear() {
    resultsCard.hidden = true;
    readyCount.textContent = '';
    reviewCount.textContent = '';
    optedOutCount.textContent = '';
    checkedFileName.textContent = '';
    summary.textContent = '';
    optOutNote.textContent = '';
    nextStep.textContent = '';
    reviewBody.replaceChildren();
    reviewTable.hidden = true;
    reviewEmpty.hidden = true;
    reviewCardHeading.hidden = false;
  },
};
