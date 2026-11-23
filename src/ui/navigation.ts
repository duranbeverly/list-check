// Own step visibility, browser history, scroll position, and focus handoffs.
import { getRequiredElement } from './dom';

const wordmark = getRequiredElement('wordmark', HTMLAnchorElement);
const checkAnother = getRequiredElement('check-another', HTMLAnchorElement);
const stepOneHeading = getRequiredElement('hero-title', HTMLHeadingElement);
const resultsHeading = getRequiredElement('results-title', HTMLHeadingElement);
const stepAnnouncement = getRequiredElement('step-announcement', HTMLParagraphElement);
const chooseCard = getRequiredElement('choose-card', HTMLElement);
const resultsCard = getRequiredElement('results-card', HTMLElement);
let hasResultsHistoryEntry = false;

function isModifiedClick(event: MouseEvent): boolean {
  return event.button !== 0
    || event.ctrlKey
    || event.metaKey
    || event.shiftKey
    || event.altKey;
}

function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  });
}

export function connectNavigation(reset: () => void) {
  function showStepOne() {
    hasResultsHistoryEntry = false;
    reset();
    resultsCard.hidden = true;
    chooseCard.hidden = false;
    stepAnnouncement.textContent = 'Started over. Choose a file to check.';
    scrollToTop();
    stepOneHeading.focus({ preventScroll: true });
  }

  function showResults() {
    chooseCard.hidden = true;
    resultsCard.hidden = false;
    if (!hasResultsHistoryEntry) {
      window.history.pushState({ listCheckStep: 'results' }, '', window.location.href);
      hasResultsHistoryEntry = true;
    }
    resultsHeading.focus({ preventScroll: true });
    resultsHeading.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
  }

  wordmark.addEventListener('click', (event) => {
    if (isModifiedClick(event)) return;
    event.preventDefault();
    if (resultsCard.hidden) scrollToTop();
    else showStepOne();
  });
  checkAnother.addEventListener('click', (event) => {
    if (isModifiedClick(event)) return;
    event.preventDefault();
    showStepOne();
  });
  window.addEventListener('popstate', () => {
    if (hasResultsHistoryEntry) showStepOne();
  });

  return {
    showResults,
    showOptOutPanel() {
      resultsCard.hidden = true;
      chooseCard.hidden = false;
    },
    showStepOne,
  };
}
