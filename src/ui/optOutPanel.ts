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
  const column = getRequiredElement('opt-out-column', HTMLSelectElement);
  const modeControls = getRequiredElement('opt-out-mode-controls', HTMLDivElement);
  const mode = getRequiredElement('opt-out-mode', HTMLSelectElement);
  const useColumn = getRequiredElement('use-opt-out-column', HTMLButtonElement);
  const confirmCheck = getRequiredElement('confirm-no-opt-outs-check', HTMLInputElement);
  const confirmNone = getRequiredElement('confirm-no-opt-outs', HTMLButtonElement);
  const change = getRequiredElement('change-opt-out', HTMLButtonElement);

  column.addEventListener('change', () => {
    const selected = column.value !== '';
    modeControls.hidden = !selected;
    useColumn.disabled = !selected;
    if (selected) mode.value = inferOptOutMode(column.value);
  });
  mode.addEventListener('change', () => {
    useColumn.disabled = !column.value;
  });
  confirmCheck.addEventListener('change', () => {
    confirmNone.disabled = !confirmCheck.checked;
  });
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
    column.replaceChildren(new Option('Choose a column', ''));
    mode.value = 'flag';
    modeControls.hidden = true;
    useColumn.disabled = true;
    confirmCheck.checked = false;
    confirmNone.disabled = true;
    change.hidden = true;
  }

  return {
    show(headers, columns) {
      column.replaceChildren(new Option('Choose a column', ''));
      for (const header of headers) column.add(new Option(header, header));
      column.value = '';
      mode.value = 'flag';
      modeControls.hidden = true;
      useColumn.disabled = true;
      confirmCheck.checked = false;
      confirmNone.disabled = true;
      warning.textContent = columns.optOut
        ? `Possible opt-out column: ${columns.optOut}. Choose it below if it records opt-outs.`
        : 'We could not identify an opt-out column. Choose one below, or deliberately confirm that this list has no opt-out information.';
      panel.hidden = false;
      column.focus();
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
