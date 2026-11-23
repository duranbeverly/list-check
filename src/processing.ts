// Manage the processing Worker and its delayed progress/cancel affordance.
import type { OptOutResolution, WorkerRequest, WorkerResponse } from './workerProtocol';

export interface ProcessingCallbacks {
  progress: (id: number) => void;
  response: (response: WorkerResponse) => void;
  error: (id: number, message: string) => void;
}

export function connectProcessing(callbacks: ProcessingCallbacks) {
  let worker: Worker | null = null;
  let progressTimer = 0;

  function stop() {
    window.clearTimeout(progressTimer);
    progressTimer = 0;
    worker?.terminate();
    worker = null;
  }

  function startProgress(id: number) {
    window.clearTimeout(progressTimer);
    progressTimer = window.setTimeout(() => callbacks.progress(id), 1000);
  }

  function createWorker(id: number): Worker {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      if (event.data.id !== id) return;
      window.clearTimeout(progressTimer);
      progressTimer = 0;
      callbacks.response(event.data);
    };
    worker.onerror = () => callbacks.error(id, 'Could not check this file. Try a smaller CSV.');
    worker.onmessageerror = () => callbacks.error(id, 'Could not read the file result. Try again.');
    return worker;
  }

  return {
    start(id: number, file: File) {
      stop();
      startProgress(id);
      const request: WorkerRequest = { id, type: 'process', file };
      createWorker(id).postMessage(request);
    },
    resolve(id: number, resolution: OptOutResolution) {
      if (!worker) return;
      startProgress(id);
      worker.postMessage({ id, type: 'resolve-opt-out', resolution } satisfies WorkerRequest);
    },
    stop,
    isActive() {
      return worker !== null;
    },
  };
}
