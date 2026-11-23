// Own opt-out column selection, deliberate no-opt-out confirmation, and Change.
import { inferOptOutMode } from '../columns';
import type { ColumnMapping } from '../types';
import { getRequiredElement } from './dom';

export interface OptOutPanelActions {
  useColumn: (column: string, mode: 'flag' | 'status') => void;
  confirmNone: () => void;
  change: () => void;
}

export interface OptOutPanel {
  show: (headers: string[], columns: ColumnMapping) => void;
  hide: () => void;
  clear: () => void;
  showChangeButton: (visible: boolean) => void;
}

export function connectOptOutPanel(actions: OptOutPanelActions): OptOutPanel {
  const panel = getRequiredElement('opt-out-setup', HTMLElement);
  const warning = getRequiredElement('opt-out-warning', HTMLParagraphElement);
  const hasColumnChoice = getRequiredElement('has-opt-out-column', HTMLInputElement);
  const noColumnChoice = getRequiredElement('has-no-opt-out-column', HTMLInputElement);
  const columnPath = getRequiredElement('opt-out-column-controls', HTMLDivElement);
  const noColumnPath = getRequiredElement('confirm-no-opt-outs-controls', HTMLDivElement);
  const column = getRequiredElement('opt-out-column', HTMLSelectElement);
  const modeControls = getRequiredElement('opt-out-mode-controls', HTMLDivElement);
  const mode = getRequiredElement('opt-out-mode', HTMLSelectElement);
  const useColumn = getRequiredElement('use-opt-out-column', HTMLButtonElement);
  const confirmCheck = getRequiredElement('confirm-no-opt-outs-check', HTMLInputElement);
  const confirmNone = getRequiredElement('confirm-no-opt-outs', HTMLButtonElement);
  const change = getRequiredElement('change-opt-out', HTMLButtonElement);

  function updateChoiceControls() {
    const usingColumn = hasColumnChoice.checked;
    const confirmingNone = noColumnChoice.checked;
    columnPath.hidden = !usingColumn;
    noColumnPath.hidden = !confirmingNone;
    useColumn.disabled = !usingColumn || !column.value;
    confirmNone.disabled = !confirmingNone || !confirmCheck.checked;
  }

  hasColumnChoice.addEventListener('change', updateChoiceControls);
  noColumnChoice.addEventListener('change', updateChoiceControls);
  column.addEventListener('change', () => {
    const selected = column.value !== '';
    modeControls.hidden = !selected;
    if (selected) mode.value = inferOptOutMode(column.value);
    updateChoiceControls();
  });
  mode.addEventListener('change', updateChoiceControls);
  confirmCheck.addEventListener('change', updateChoiceControls);
  useColumn.addEventListener('click', () => {
    if (column.value && (mode.value === 'flag' || mode.value === 'status')) {
      actions.useColumn(column.value, mode.value);
    }
  });
  confirmNone.addEventListener('click', () => {
    if (confirmCheck.checked) actions.confirmNone();
  });
  change.addEventListener('click', actions.change);

  function clear() {
    panel.hidden = true;
    warning.textContent = '';
    hasColumnChoice.checked = false;
    noColumnChoice.checked = false;
    column.replaceChildren(new Option('Choose a column', ''));
    mode.value = 'flag';
    modeControls.hidden = true;
    confirmCheck.checked = false;
    updateChoiceControls();
    change.hidden = true;
  }

  return {
    show(headers, columns) {
      column.replaceChildren(new Option('Choose a column', ''));
      for (const header of headers) column.add(new Option(header, header));
      column.value = '';
      hasColumnChoice.checked = false;
      noColumnChoice.checked = false;
      mode.value = 'flag';
      modeControls.hidden = true;
      confirmCheck.checked = false;
      updateChoiceControls();
      warning.textContent = columns.optOut
        ? `Possible opt-out column: ${columns.optOut}.`
        : "We couldn't find an opt-out column. Which is true?";
      panel.hidden = false;
      hasColumnChoice.focus();
    },
    hide() {
      panel.hidden = true;
    },
    clear,
    showChangeButton(visible) {
      change.hidden = !visible;
    },
  };
}
