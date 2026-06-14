import { addRoute, createProject, createSpot, distanceToSegment, removeSpot } from "./model.js";
import { scenarioText, spotText } from "./exporter.js";
import { decodeDat, parseDatFiles } from "./dsl.js";
import { createHistory } from "./history.js";
import { validateDatInputs, validateProject } from "./validation.js";
import { deleteAutosave, loadAutosave, supportsAutosave } from "./autosave.js";
import { createAutosaveManager } from "./autosave-manager.js";
import { dataUrlToBlob, fileToDataUrl, loadImage } from "./media.js";
import { createMaterialStore, MATERIAL_TYPES } from "./materials.js";
import { renderMap } from "./map-renderer.js";

const ui = Object.fromEntries([
  "map-canvas", "map-scroller", "world-input", "world-name",
  "spot-material-input", "route-material-input", "escape-material-input",
  "spot-material-preview", "route-material-preview", "escape-material-preview",
  "spot-material-name", "route-material-name", "escape-material-name",
  "route-width", "route-width-value",
  "spot-list", "route-list", "spot-count", "route-count", "spot-search",
  "spot-fields", "no-selection", "spot-id", "spot-name", "spot-image",
  "spot-inherits", "spot-x", "spot-y", "spot-w", "spot-h", "spot-extra",
  "mode-label", "selection-label", "status", "empty-hint",
  "dat-dialog", "scenario-dat-input", "spot-dat-input", "scenario-dat-name",
  "spot-dat-name", "load-dat-files", "output-dialog", "output-text",
  "show-scenario-output", "show-spot-output", "save-state", "undo", "redo",
  "validation-dialog", "validation-title", "validation-content",
  "autosave-dialog", "autosave-dialog-date", "restore-autosave", "discard-autosave",
].map(id => [id.replaceAll("-", "_"), document.getElementById(id)]));

const canvas = ui.map_canvas;
const ctx = canvas.getContext("2d");
const DEFAULT_MATERIALS = {
  spot: "./assets/default/spot.png",
  route: "./assets/default/route.png",
  escape: "./assets/default/route_esc.png",
};
let project = createProject();
let worldImage = null;
let imageMap = new Map();
const materials = createMaterialStore(DEFAULT_MATERIALS);
let routeWidth = 4;
let selectedSpot = null;
let selectedRoute = null;
let dragging = null;
let scenarioFilename = "scenario.dat";
let spotFilename = "spot.dat";
let pendingScenarioDat = null;
let pendingSpotDat = null;
const history = createHistory();
let savedSignature = "";
let pendingFieldSnapshot = null;
const autosave = createAutosaveManager({
  capture: createAutosaveState,
  onError: error => setStatus(`自動保存に失敗しました: ${error.message}`, true),
});

boot().catch(error => setStatus(`起動エラー: ${error.message}`, true));

async function boot() {
  bindEvents();
  await resetDisplayMaterials(false);
  renderAll();
  markSaved();
  await initializeAutosave();
}

function bindEvents() {
  ui.world_input.addEventListener("change", loadWorld);
  ui.spot_material_input.addEventListener("change", event => loadDisplayMaterial(event, "spot"));
  ui.route_material_input.addEventListener("change", event => loadDisplayMaterial(event, "route"));
  ui.escape_material_input.addEventListener("change", event => loadDisplayMaterial(event, "escape"));
  document.getElementById("reset-materials").addEventListener("click", () => resetDisplayMaterials());
  ui.route_width.addEventListener("input", () => {
    routeWidth = Number(ui.route_width.value);
    ui.route_width_value.value = `${routeWidth}px`;
    renderCanvas();
    autosave.schedule();
  });
  document.getElementById("open-dat-dialog").addEventListener("click", openDatDialog);
  ui.scenario_dat_input.addEventListener("change", updatePendingDatFiles);
  ui.spot_dat_input.addEventListener("change", updatePendingDatFiles);
  ui.load_dat_files.addEventListener("click", openDatFiles);
  ui.spot_search.addEventListener("input", renderLists);

  for (const [element, key, numeric = false] of [
    [ui.spot_id, "id"], [ui.spot_name, "name"], [ui.spot_image, "image"],
    [ui.spot_inherits, "inherits"], [ui.spot_x, "x", true], [ui.spot_y, "y", true],
    [ui.spot_w, "width", true], [ui.spot_h, "height", true], [ui.spot_extra, "extra"],
  ]) {
    element.addEventListener("focus", () => {
      pendingFieldSnapshot = snapshotProject();
    });
    element.addEventListener("input", () => {
      if (!selectedSpot) return;
      if (pendingFieldSnapshot) {
        history.checkpoint(pendingFieldSnapshot);
        pendingFieldSnapshot = null;
      }
      selectedSpot[key] = numeric ? Number(element.value) : element.value;
      renderCanvas();
      renderLists();
      updateSelectionLabel();
      updateDocumentState();
    });
    element.addEventListener("blur", () => {
      pendingFieldSnapshot = null;
    });
  }

  ui.undo.addEventListener("click", undo);
  ui.redo.addEventListener("click", redo);
  document.getElementById("save-dat").addEventListener("click", saveDatFiles);
  document.getElementById("delete-spot").addEventListener("click", deleteSelection);
  document.getElementById("center-map").addEventListener("click", centerMap);
  document.getElementById("preview-output").addEventListener("click", () => {
    showOutput("scenario");
    ui.output_dialog.showModal();
  });
  ui.show_scenario_output.addEventListener("click", () => showOutput("scenario"));
  ui.show_spot_output.addEventListener("click", () => showOutput("spot"));

  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerup", pointerUp);
  canvas.addEventListener("pointercancel", pointerUp);
  canvas.addEventListener("contextmenu", event => event.preventDefault());
  window.addEventListener("keydown", event => {
    if (event.key === "Escape") clearSelection();
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
      event.preventDefault();
      redo();
      return;
    }
    if ((event.key === "Delete" || event.key.toLowerCase() === "d") &&
        !event.target.matches("input, textarea, select")) {
      deleteSelection();
    }
  });
  window.addEventListener("beforeunload", event => {
    if (!isUnsaved()) return;
    event.preventDefault();
    event.returnValue = "";
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") autosave.flush();
  });
}

async function loadWorld(event) {
  const file = event.target.files[0];
  if (!file) return;
  project.world = {
    name: file.name,
    dataUrl: await fileToDataUrl(file),
    width: 1000,
    height: 1000,
  };
  await restoreWorldImage();
  setStatus(`${file.name}を読み込みました`);
  autosave.schedule();
  event.target.value = "";
}

async function loadDisplayMaterial(event, type) {
  const file = event.target.files[0];
  if (!file) return;
  await materials.replace(type, file);
  updateMaterialUi();
  renderCanvas();
  setStatus(`${materialLabel(type)}を${file.name}へ変更しました`);
  autosave.schedule();
  event.target.value = "";
}

async function resetDisplayMaterials(showStatus = true) {
  await materials.reset();
  updateMaterialUi();
  renderCanvas();
  if (showStatus) {
    setStatus("表示素材を標準に戻しました");
    autosave.schedule();
  }
}

function updateMaterialUi() {
  for (const type of MATERIAL_TYPES) {
    ui[`${type}_material_preview`].src = materials.url(type);
    ui[`${type}_material_name`].textContent = materials.name(type);
  }
}

function materialLabel(type) {
  return type === "spot" ? "スポット画像" : type === "route" ? "通常連絡線画像" : "退却連絡線画像";
}

function pointerDown(event) {
  const point = eventPoint(event);
  const hit = spotAt(point.x, point.y);
  if (event.button === 2) {
    event.preventDefault();
    eraseAt(point, hit);
    return;
  }
  if (event.button !== 0) return;
  if (event.shiftKey || event.ctrlKey) {
    if (!hit) return;
    connectSpot(hit, event.ctrlKey ? "escape" : "link");
    return;
  }
  if (hit) {
    selectSpot(hit);
    dragging = {
      uid: hit.uid,
      dx: point.x - hit.x,
      dy: point.y - hit.y,
      snapshot: snapshotProject(),
      changed: false,
    };
    canvas.setPointerCapture(event.pointerId);
  } else {
    history.checkpoint(snapshotProject());
    const spot = createSpot(project, point.x, point.y);
    project.spots.push(spot);
    selectSpot(spot);
    setStatus(`${spot.id}を追加しました`);
    updateDocumentState();
  }
}

function pointerMove(event) {
  if (!dragging) return;
  const spot = project.spots.find(item => item.uid === dragging.uid);
  if (!spot) return;
  const point = eventPoint(event);
  const x = Math.round(point.x - dragging.dx);
  const y = Math.round(point.y - dragging.dy);
  if (spot.x === x && spot.y === y) return;
  if (!dragging.changed) {
    history.checkpoint(dragging.snapshot);
    dragging.changed = true;
  }
  spot.x = x;
  spot.y = y;
  syncFields();
  renderCanvas();
  updateDocumentState();
}

function pointerUp() {
  dragging = null;
}

function eventPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * canvas.width / rect.width,
    y: (event.clientY - rect.top) * canvas.height / rect.height,
  };
}

function spotAt(x, y) {
  return [...project.spots].reverse().find(spot =>
    x >= spot.x - spot.width / 2 && x <= spot.x + spot.width / 2 &&
    y >= spot.y - spot.height / 2 && y <= spot.y + spot.height / 2
  );
}

function routeAt(x, y) {
  const point = { x, y };
  return [...project.routes].reverse().find(route => {
    const from = project.spots.find(spot => spot.uid === route.from);
    const to = project.spots.find(spot => spot.uid === route.to);
    return from && to && distanceToSegment(point, from, to) <= 8;
  });
}

function selectSpot(spot) {
  selectedSpot = spot;
  selectedRoute = null;
  syncFields();
  renderAll();
}

function selectRoute(route) {
  selectedRoute = route;
  selectedSpot = null;
  syncFields();
  renderAll();
}

function clearSelection() {
  selectedSpot = null;
  selectedRoute = null;
  syncFields();
  renderAll();
}

function connectSpot(target, type) {
  if (!selectedSpot) {
    selectSpot(target);
    setStatus(`${target.id}を始点に選択しました`);
    return;
  }
  if (selectedSpot.uid === target.uid) {
    setStatus("別のスポットを選択してください", true);
    return;
  }
  const source = selectedSpot;
  const before = snapshotProject();
  const added = addRoute(project, source.uid, target.uid, type);
  if (added) history.checkpoint(before);
  selectSpot(target);
  setStatus(
    added
      ? `${source.id} と ${target.id}を${type === "escape" ? "退却連絡" : "通常連絡"}で接続しました`
      : "同じ連絡がすでに存在します",
    !added
  );
  if (added) updateDocumentState();
}

function eraseAt(point, spot) {
  if (spot) {
    history.checkpoint(snapshotProject());
    removeSpot(project, spot.uid);
    if (selectedSpot?.uid === spot.uid) selectedSpot = null;
    selectedRoute = null;
    syncFields();
    renderAll();
    setStatus(`${spot.id}を削除しました`);
    updateDocumentState();
    return;
  }
  const route = routeAt(point.x, point.y);
  if (!route) return;
  history.checkpoint(snapshotProject());
  project.routes = project.routes.filter(item => item.uid !== route.uid);
  if (selectedRoute?.uid === route.uid) selectedRoute = null;
  renderAll();
  setStatus(route.type === "escape" ? "退却連絡を削除しました" : "通常連絡を削除しました");
  updateDocumentState();
}

function deleteSelection() {
  if (selectedSpot) {
    history.checkpoint(snapshotProject());
    removeSpot(project, selectedSpot.uid);
    selectedSpot = null;
    setStatus("スポットを削除しました");
  } else if (selectedRoute) {
    history.checkpoint(snapshotProject());
    project.routes = project.routes.filter(route => route.uid !== selectedRoute.uid);
    selectedRoute = null;
    setStatus("連絡を削除しました");
  } else {
    return;
  }
  syncFields();
  renderAll();
  updateDocumentState();
}

function renderAll() {
  ui.world_name.textContent = project.world.name || "画像未選択";
  canvas.width = project.world.width || 1000;
  canvas.height = project.world.height || 1000;
  ui.empty_hint.classList.toggle("hidden", Boolean(worldImage || project.spots.length));
  renderImageOptions();
  renderCanvas();
  renderLists();
  updateSelectionLabel();
}

function renderCanvas() {
  renderMap({
    ctx,
    canvas,
    project,
    worldImage,
    imageMap,
    materials,
    selectedSpot,
    selectedRoute,
    routeWidth,
  });
}

function renderLists() {
  const query = ui.spot_search.value.trim().toLowerCase();
  ui.spot_list.textContent = "";
  for (const spot of project.spots.filter(spot =>
    !query || `${spot.id} ${spot.name}`.toLowerCase().includes(query)
  )) {
    const button = document.createElement("button");
    button.className = "item-row";
    button.classList.toggle("active", selectedSpot?.uid === spot.uid);
    button.innerHTML = `<strong>${escapeHtml(spot.id)}</strong><small>${escapeHtml(spot.name)}</small>`;
    button.addEventListener("click", () => selectSpot(spot));
    ui.spot_list.append(button);
  }

  ui.route_list.textContent = "";
  for (const route of project.routes) {
    const from = project.spots.find(spot => spot.uid === route.from);
    const to = project.spots.find(spot => spot.uid === route.to);
    if (!from || !to) continue;
    const button = document.createElement("button");
    button.className = "item-row";
    button.classList.toggle("active", selectedRoute?.uid === route.uid);
    button.innerHTML = `<strong>${escapeHtml(from.id)} → ${escapeHtml(to.id)}</strong><span class="route-mark ${route.type}">${route.type === "escape" ? "退却" : "通常"}</span>`;
    button.addEventListener("click", () => selectRoute(route));
    ui.route_list.append(button);
  }
  ui.spot_count.textContent = `${project.spots.length}件`;
  ui.route_count.textContent = `${project.routes.length}件`;
}

function syncFields() {
  ui.spot_fields.disabled = !selectedSpot;
  ui.no_selection.hidden = Boolean(selectedSpot);
  if (!selectedSpot) return;
  ui.spot_id.value = selectedSpot.id;
  ui.spot_name.value = selectedSpot.name;
  ui.spot_image.value = selectedSpot.image;
  ui.spot_inherits.value = selectedSpot.inherits;
  ui.spot_x.value = selectedSpot.x;
  ui.spot_y.value = selectedSpot.y;
  ui.spot_w.value = selectedSpot.width;
  ui.spot_h.value = selectedSpot.height;
  ui.spot_extra.value = selectedSpot.extra;
}

function renderImageOptions() {
  const current = ui.spot_image.value;
  ui.spot_image.innerHTML = '<option value="spot">標準（spot）</option>';
  for (const image of project.images) {
    const option = document.createElement("option");
    option.value = image.name;
    option.textContent = image.name;
    ui.spot_image.append(option);
  }
  if (selectedSpot) ui.spot_image.value = selectedSpot.image;
  else ui.spot_image.value = current;
}

function updateSelectionLabel() {
  ui.selection_label.textContent = selectedSpot
    ? `${selectedSpot.id} / ${selectedSpot.name}`
    : selectedRoute
      ? `${selectedRoute.type === "escape" ? "退却連絡" : "通常連絡"}を選択中`
      : "選択なし";
}

function openDatDialog() {
  pendingScenarioDat = null;
  pendingSpotDat = null;
  ui.scenario_dat_input.value = "";
  ui.spot_dat_input.value = "";
  updatePendingDatFiles();
  ui.dat_dialog.showModal();
}

function updatePendingDatFiles() {
  pendingScenarioDat = ui.scenario_dat_input.files[0] ?? pendingScenarioDat;
  pendingSpotDat = ui.spot_dat_input.files[0] ?? pendingSpotDat;
  ui.scenario_dat_name.textContent = pendingScenarioDat?.name ?? "未選択";
  ui.spot_dat_name.textContent = pendingSpotDat?.name ?? "未選択";
  ui.load_dat_files.disabled = !(pendingScenarioDat && pendingSpotDat);
}

async function openDatFiles() {
  if (!pendingScenarioDat || !pendingSpotDat) return;
  if (isUnsaved() && !window.confirm("未保存の変更があります。ファイルを開きますか？")) return;
  const files = [pendingScenarioDat, pendingSpotDat];
  try {
    const decoded = await Promise.all(files.map(async file => ({
      name: file.name,
      text: decodeDat(await file.arrayBuffer()),
    })));
    const inputValidation = validateDatInputs(decoded[0].text, decoded[1].text);
    if (inputValidation.errors.length) {
      showValidation("DATファイルを読み込めません", inputValidation);
      return;
    }
    const loaded = parseDatFiles(decoded);
    const projectValidation = validateProject(loaded.project);
    const combinedWarnings = [...inputValidation.warnings, ...loaded.warnings, ...projectValidation.warnings];
    if (projectValidation.errors.length) {
      showValidation("DATファイルに問題があります", {
        errors: projectValidation.errors,
        warnings: combinedWarnings,
      });
      return;
    }
    project = loaded.project;
    scenarioFilename = loaded.scenarioFilename;
    spotFilename = loaded.spotFilename;
    project.world = { ...project.world, name: "", dataUrl: "" };
    project.images = [];
    worldImage = null;
    imageMap = new Map();
    selectedSpot = null;
    selectedRoute = null;
    history.clear();
    syncFields();
    renderAll();
    markSaved();
    const suffix = combinedWarnings.length ? `（注意 ${combinedWarnings.length}件）` : "";
    setStatus(`${files.length}個のDATを開きました${suffix}`, combinedWarnings.length > 0);
    ui.dat_dialog.close();
    if (combinedWarnings.length) {
      showValidation("DATファイルを読み込みました", { errors: [], warnings: combinedWarnings });
    }
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function restoreWorldImage() {
  worldImage = project.world.dataUrl ? await loadImage(project.world.dataUrl) : null;
  if (worldImage) {
    project.world.width = worldImage.naturalWidth;
    project.world.height = worldImage.naturalHeight;
  }
  renderAll();
}

function centerMap() {
  ui.map_scroller.scrollLeft = Math.max(0, (canvas.offsetWidth - ui.map_scroller.clientWidth) / 2 + 24);
  ui.map_scroller.scrollTop = Math.max(0, (canvas.offsetHeight - ui.map_scroller.clientHeight) / 2 + 24);
}

function showOutput(type) {
  const scenario = type === "scenario";
  ui.output_text.value = scenario ? scenarioText(project) : spotText(project);
  ui.show_scenario_output.classList.toggle("active", scenario);
  ui.show_spot_output.classList.toggle("active", !scenario);
}

function saveDatFiles() {
  const validation = validateProject(project);
  if (validation.errors.length) {
    showValidation("保存できません", validation);
    return;
  }
  downloadShiftJis(scenarioFilename, scenarioText(project));
  window.setTimeout(() => downloadShiftJis(spotFilename, spotText(project)), 150);
  markSaved();
  setStatus(`${scenarioFilename} と ${spotFilename} を保存しました`);
  if (validation.warnings.length) {
    showValidation("保存しました（注意あり）", validation);
  }
}

function undo() {
  const previous = history.undo(snapshotProject());
  if (!previous) return;
  restoreProject(previous);
  setStatus("元に戻しました");
}

function redo() {
  const next = history.redo(snapshotProject());
  if (!next) return;
  restoreProject(next);
  setStatus("やり直しました");
}

function snapshotProject() {
  return JSON.parse(JSON.stringify(project));
}

function restoreProject(snapshot) {
  project = snapshot;
  selectedSpot = null;
  selectedRoute = null;
  pendingFieldSnapshot = null;
  syncFields();
  renderAll();
  updateDocumentState();
}

function documentSignature() {
  return `${scenarioText(project)}\n---SPOT---\n${spotText(project)}`;
}

function markSaved() {
  savedSignature = documentSignature();
  updateDocumentState();
}

function isUnsaved() {
  return documentSignature() !== savedSignature;
}

function updateDocumentState() {
  const unsaved = isUnsaved();
  ui.save_state.textContent = unsaved ? "未保存" : "保存済み";
  ui.save_state.classList.toggle("unsaved", unsaved);
  ui.undo.disabled = !history.canUndo;
  ui.redo.disabled = !history.canRedo;
  document.title = `${unsaved ? "● " : ""}VT SpotMaker`;
  autosave.schedule();
}

async function initializeAutosave() {
  if (!supportsAutosave()) {
    setStatus("このブラウザでは自動保存を利用できません", true);
    return;
  }
  try {
    const record = await loadAutosave();
    if (record?.state) {
      const restore = await askToRestoreAutosave(record.savedAt);
      if (restore) {
        await restoreAutosaveState(record.state);
        setStatus("前回の作業を復元しました");
      } else {
        await deleteAutosave();
      }
    }
    autosave.enable();
  } catch (error) {
    setStatus(`自動保存を開始できませんでした: ${error.message}`, true);
  }
}

function askToRestoreAutosave(savedAt) {
  ui.autosave_dialog_date.textContent = `保存日時: ${formatAutosaveDate(savedAt)}`;
  ui.autosave_dialog.showModal();
  return new Promise(resolve => {
    const finish = restore => {
      ui.autosave_dialog.close();
      resolve(restore);
    };
    ui.restore_autosave.addEventListener("click", () => finish(true), { once: true });
    ui.discard_autosave.addEventListener("click", () => finish(false), { once: true });
    ui.autosave_dialog.addEventListener("cancel", event => event.preventDefault(), { once: true });
  });
}

async function createAutosaveState() {
  const projectCopy = snapshotProject();
  const worldBlob = dataUrlToBlob(projectCopy.world.dataUrl);
  projectCopy.world.dataUrl = "";
  return {
    project: projectCopy,
    worldBlob,
    materials: materials.snapshot(),
    routeWidth,
    scenarioFilename,
    spotFilename,
    savedSignature,
  };
}

async function restoreAutosaveState(state) {
  project = state.project ?? createProject();
  if (state.worldBlob) project.world.dataUrl = await fileToDataUrl(state.worldBlob);
  scenarioFilename = state.scenarioFilename || "scenario.dat";
  spotFilename = state.spotFilename || "spot.dat";
  routeWidth = Math.max(1, Math.min(16, Number(state.routeWidth) || 4));
  ui.route_width.value = routeWidth;
  ui.route_width_value.value = `${routeWidth}px`;
  await materials.restore(state.materials);
  selectedSpot = null;
  selectedRoute = null;
  history.clear();
  savedSignature = state.savedSignature || documentSignature();
  await restoreWorldImage();
  updateMaterialUi();
  syncFields();
  renderAll();
  updateDocumentState();
}

function formatAutosaveDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "日時不明";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function showValidation(title, result) {
  ui.validation_title.textContent = title;
  ui.validation_content.textContent = "";
  appendValidationGroup("エラー", result.errors, "errors");
  appendValidationGroup("注意", result.warnings, "warnings");
  ui.validation_dialog.showModal();
}

function appendValidationGroup(title, messages, className) {
  if (!messages.length) return;
  const section = document.createElement("section");
  section.className = `validation-group ${className}`;
  const heading = document.createElement("strong");
  heading.textContent = `${title}（${messages.length}件）`;
  const list = document.createElement("ul");
  for (const message of messages) {
    const item = document.createElement("li");
    item.textContent = message;
    list.append(item);
  }
  section.append(heading, list);
  ui.validation_content.append(section);
}

function downloadShiftJis(filename, text) {
  if (!window.Encoding) {
    setStatus("Shift-JIS変換機能を読み込めませんでした", true);
    return;
  }
  const unicode = window.Encoding.stringToCode(text);
  const bytes = window.Encoding.convert(unicode, {
    to: "SJIS",
    from: "UNICODE",
    type: "array",
  });
  downloadBytes(filename, new Uint8Array(bytes));
}

function downloadBytes(filename, bytes) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function setStatus(message, error = false) {
  ui.status.textContent = message;
  ui.status.style.color = error ? "#f18b96" : "";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}
