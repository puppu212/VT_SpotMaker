export function validateProject(project) {
  const errors = [];
  const warnings = [];
  const ids = new Map();
  const uids = new Set(project.spots.map(spot => spot.uid));

  for (const [index, spot] of project.spots.entries()) {
    const label = spot.id?.trim() || `スポット${index + 1}`;
    if (!spot.id?.trim()) errors.push(`スポット${index + 1}: IDが空です`);
    if (spot.id?.trim() && ids.has(spot.id.trim())) {
      errors.push(`スポットID「${spot.id.trim()}」が重複しています`);
    }
    ids.set(spot.id?.trim(), true);
    if (!Number.isFinite(Number(spot.x)) || !Number.isFinite(Number(spot.y))) {
      errors.push(`${label}: 座標が数値ではありません`);
    }
    if (!Number.isFinite(Number(spot.width)) || Number(spot.width) < 1 ||
        !Number.isFinite(Number(spot.height)) || Number(spot.height) < 1) {
      errors.push(`${label}: 幅と高さは1以上の数値にしてください`);
    }
    if (Number(spot.x) < 0 || Number(spot.y) < 0) {
      warnings.push(`${label}: マップ外の座標です`);
    }
  }

  for (const route of project.routes) {
    if (!uids.has(route.from) || !uids.has(route.to)) {
      errors.push("接続先が存在しない連絡線があります");
    }
    if (route.from === route.to) errors.push("同じスポット同士を結ぶ連絡線があります");
    if (!Number.isFinite(Number(route.alpha)) || Number(route.alpha) < 0 || Number(route.alpha) > 255) {
      errors.push("連絡線の透明度は0〜255にしてください");
    }
  }

  if (!project.spots.length) warnings.push("スポットが1件もありません");
  return { errors: unique(errors), warnings: unique(warnings) };
}

export function validateDatInputs(scenarioText, spotText) {
  const errors = [];
  const warnings = [];
  if (!/\bscenario\s+[^\s{]+\s*\{/i.test(scenarioText)) {
    errors.push("scenario.datにシナリオ構造体が見つかりません");
  }
  if (!/^\s*spot\s+(?![=])[\w\u0080-\uFFFF]+\s*(?::[^{]+)?\s*\{/im.test(spotText)) {
    errors.push("spot.datにスポット構造体が見つかりません");
  }
  if (!/\bspot\s*=/i.test(scenarioText)) {
    warnings.push("scenario.datにspot一覧がありません。保存時に追加されます");
  }
  return { errors, warnings };
}

function unique(values) {
  return [...new Set(values)];
}
