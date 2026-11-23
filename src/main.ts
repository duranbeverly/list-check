// Connect upload, worker processing, and the focused UI modules.
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import './style.css';
import { getFileError } from './fileValidation';
import { connectProcessing } from './processing';
import { connectNavigation } from './ui/navigation';
import { connectOptOutPanel } from './ui/optOutPanel';
import { connectReportController } from './ui/reportController';
import { connectUpload } from './ui/upload';
import type { WorkerRequest, WorkerResponse } from './workerProtocol';

let requestId = 0;

const upload = connectUpload({
  file: processFile,
  sample: loadSample,
  cancel: cancelCheck,
});
let reportController: ReturnType<typeof connectReportController>;
const optOutPanel = connectOptOutPanel({
  useColumn: (column, mode) => resolveOptOut({ column, mode }),
  confirmNone: () => resolveOptOut({ column: null, mode: 'none' }),
  change: () => reportController.changeOptOut(),
});
const navigation = connectNavigation(resetToStepOne);
reportController = connectReportController({ upload, optOutPanel, navigation });
const processing = connectProcessing({
  progress(id) {
    if (id !== requestId || !processing.isActive()) return;
    upload.setStatus('Still checking your list…', 'loading');
    upload.setCancelVisible(true);
  },
  response: handleWorkerResponse,
  error(id, message) {
    if (id === requestId) showFileError(message);
  },
});

function stopWorker() {
  processing.stop();
  upload.setCancelVisible(false);
}

function resetToStepOne() {
  requestId += 1;
  stopWorker();
  reportController.clear();
  upload.reset();
}

function showFileError(message: string) {
  stopWorker();
  reportController.clear();
  upload.setStatus(message, 'error');
  upload.focusStatus();
}

function handleWorkerResponse(response: WorkerResponse) {
  if (response.id !== requestId) return;
  upload.setCancelVisible(false);
  if (response.type === 'error') {
    showFileError(response.message);
    return;
  }
  reportController.handleResponse(response);
}

function processFile(file: File) {
  requestId += 1;
  stopWorker();
  reportController.clear();
  upload.showExample(false);
  upload.setSelectedFile(file.name);
  const fileError = getFileError(file);
  if (fileError) {
    showFileError(fileError);
    return;
  }

  const id = requestId;
  upload.setStatus('Checking your list…', 'loading');
  processing.start(id, file);
}

function resolveOptOut(resolution: Extract<WorkerRequest, { type: 'resolve-opt-out' }>['resolution']) {
  if (!processing.isActive()) return;
  upload.setStatus('Checking your list…', 'loading');
  processing.resolve(requestId, resolution);
}

function cancelCheck() {
  if (!processing.isActive()) return;
  requestId += 1;
  stopWorker();
  reportController.clear();
  upload.setStatus('Check canceled. Choose a file to try again.');
  upload.focusStatus();
}

async function loadSample() {
  requestId += 1;
  stopWorker();
  reportController.clear();
  upload.showExample(false);
  upload.setStatus('Loading the sample list…', 'loading');
  const id = requestId;
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}sample-members.csv`);
    if (id !== requestId) return;
    if (!response.ok) {
      showFileError('Could not load the sample. Choose a CSV file instead.');
      return;
    }
    const sample = new File([await response.text()], 'sample-members.csv', { type: 'text/csv' });
    if (id === requestId) processFile(sample);
  } catch {
    if (id === requestId) showFileError('Could not load the sample. Choose a CSV file instead.');
  }
}

if (document.readyState === 'complete') {
  document.documentElement.classList.add('app-ready');
} else {
  window.addEventListener('load', () => document.documentElement.classList.add('app-ready'), { once: true });
}
