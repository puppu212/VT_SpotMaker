import { saveAutosave } from "./autosave.js";

export function createAutosaveManager({
  capture,
  onError,
  delay = 1500,
  save = saveAutosave,
}) {
  let enabled = false;
  let timer = null;
  let queue = Promise.resolve();

  function enable() {
    enabled = true;
  }

  function schedule() {
    if (!enabled) return;
    clearTimeout(timer);
    timer = setTimeout(flush, delay);
  }

  function flush() {
    if (!enabled) return queue;
    clearTimeout(timer);
    timer = null;
    const statePromise = Promise.resolve().then(capture);
    queue = queue
      .then(async () => save(await statePromise))
      .catch(onError);
    return queue;
  }

  return { enable, schedule, flush };
}
