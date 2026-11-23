// Coordinate report state, opt-out changes, and result/download presentation.
import { downloads } from './downloads';
import type { OptOutPanel } from './optOutPanel';
import { resultsView } from './results';
import type { connectNavigation } from './navigation';
import type { connectUpload } from './upload';
import type { WorkerMetadata, WorkerResponse } from '../workerProtocol';

type ReportResponse = Exclude<WorkerResponse, { type: 'error' }>;

export function connectReportController({
  upload,
  optOutPanel,
  navigation,
}: {
  upload: ReturnType<typeof connectUpload>;
  optOutPanel: OptOutPanel;
  navigation: ReturnType<typeof connectNavigation>;
}) {
  let currentMetadata: WorkerMetadata | null = null;

  return {
    clear() {
      currentMetadata = null;
      resultsView.clear();
      downloads.clear();
      optOutPanel.clear();
    },
    handleResponse(response: ReportResponse) {
      currentMetadata = response.metadata;
      if (response.type === 'opt-out-needed') {
        upload.setStatus('');
        optOutPanel.show(response.metadata.headers, response.metadata.columns);
        return;
      }

      optOutPanel.hide();
      optOutPanel.showChangeButton(true);
      upload.setStatus('');
      resultsView.render({
        fileName: response.metadata.fileName,
        buckets: response.buckets,
        mappingMessage: response.mappingMessage,
        phoneNote: response.metadata.columns.phone
          ? ''
          : 'No phone column, so we checked emails only.',
        encodingNote: response.metadata.encodingNote,
      });
      downloads.setReport({
        fileName: response.metadata.fileName,
        headers: response.metadata.headers,
        buckets: response.buckets,
      });
      navigation.showResults();
    },
    changeOptOut() {
      if (!currentMetadata) return;
      resultsView.clear();
      downloads.clear();
      navigation.showOptOutPanel();
      optOutPanel.show(currentMetadata.headers, currentMetadata.columns);
    },
  };
}
