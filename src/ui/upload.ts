// Own file-picker, drag-and-drop, selection status, and cancellable progress controls.
import { getRequiredElement } from './dom';

type StatusState = 'error' | 'loading' | undefined;

export interface UploadActions {
  file: (file: File) => void;
  sample: () => void;
  cancel: () => void;
}

export function connectUpload(actions: UploadActions) {
  const fileInput = getRequiredElement('file-input', HTMLInputElement);
  const uploadZone = getRequiredElement('upload-zone', HTMLDivElement);
  const uploadPrompt = getRequiredElement('upload-prompt', HTMLElement);
  const dropInstruction = getRequiredElement('drop-instruction', HTMLElement);
  const sampleButton = getRequiredElement('sample-button', HTMLButtonElement);
  const chooseDifferentFile = getRequiredElement('choose-different-file', HTMLButtonElement);
  const selectedFile = getRequiredElement('selected-file', HTMLParagraphElement);
  const fileStatus = getRequiredElement('file-status', HTMLParagraphElement);
  const fileStatusIcon = getRequiredElement('file-status-icon', SVGSVGElement);
  const loadingSpinner = getRequiredElement('loading-spinner', SVGSVGElement);
  const statusMessage = getRequiredElement('file-status-message', HTMLSpanElement);
  const cancelButton = getRequiredElement('cancel-check', HTMLButtonElement);
  const examplePreview = getRequiredElement('example-preview', HTMLElement);
  let dragDepth = 0;

  function setStatus(message: string, state?: StatusState) {
    statusMessage.textContent = message;
    fileStatus.hidden = message.length === 0;
    fileStatus.classList.toggle('file-status--error', state === 'error');
    fileStatus.classList.toggle('file-status--loading', state === 'loading');
    fileStatusIcon.toggleAttribute('hidden', state !== 'error');
    loadingSpinner.toggleAttribute('hidden', state !== 'loading');
  }

  function processFile(file: File) {
    actions.file(file);
    fileInput.value = '';
  }

  function setSelectedFile(fileName: string | null) {
    selectedFile.textContent = fileName ? `Selected file: ${fileName}` : '';
    selectedFile.hidden = !fileName;
    chooseDifferentFile.hidden = !fileName;
  }

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) processFile(file);
  });
  chooseDifferentFile.addEventListener('click', () => fileInput.click());
  sampleButton.addEventListener('click', actions.sample);
  cancelButton.addEventListener('click', actions.cancel);

  uploadZone.addEventListener('dragenter', (event) => {
    event.preventDefault();
    dragDepth += 1;
    setDragState(true);
  });
  uploadZone.addEventListener('dragover', (event) => {
    event.preventDefault();
    setDragState(true);
  });
  uploadZone.addEventListener('dragleave', (event) => {
    event.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) setDragState(false);
  });
  uploadZone.addEventListener('drop', (event) => {
    event.preventDefault();
    dragDepth = 0;
    setDragState(false);
    const file = event.dataTransfer?.files[0];
    if (file) processFile(file);
  });

  function setDragState(active: boolean) {
    uploadZone.classList.toggle('is-drag-over', active);
    uploadPrompt.hidden = active;
    dropInstruction.hidden = !active;
  }

  return {
    setStatus,
    setSelectedFile,
    setCancelVisible(visible: boolean) {
      cancelButton.hidden = !visible;
    },
    showExample(visible: boolean) {
      examplePreview.hidden = !visible;
    },
    focusStatus() {
      fileStatus.focus();
    },
    reset() {
      fileInput.value = '';
      setSelectedFile(null);
      setStatus('');
      cancelButton.hidden = true;
      examplePreview.hidden = false;
    },
  };
}
