export function createProject() {
  return {
    version: 1,
    scenarioId: "sc",
    scenarioExtra: "",
    scenarioSource: "",
    world: { name: "", dataUrl: "", width: 1000, height: 1000 },
    images: [],
    spots: [],
    routes: [],
  };
}

export function createSpot(project, x, y) {
  const used = new Set(project.spots.map(spot => spot.id));
  let number = project.spots.length + 1;
  while (used.has(`spot${number}`)) number++;
  return {
    uid: crypto.randomUUID(),
    id: `spot${number}`,
    name: `spot${number}`,
    image: "spot",
    inherits: "",
    x: Math.round(x),
    y: Math.round(y),
    width: 32,
    height: 32,
    extra: "",
  };
}

export function addRoute(project, from, to, type) {
  if (!from || !to || from === to) return false;
  const existing = project.routes.find(route =>
    route.type === type &&
    ((route.from === from && route.to === to) || (route.from === to && route.to === from))
  );
  if (existing) return false;
  project.routes.push({ uid: crypto.randomUUID(), from, to, type, image: "", alpha: 255 });
  return true;
}

export function removeSpot(project, uid) {
  const before = project.spots.length;
  project.spots = project.spots.filter(spot => spot.uid !== uid);
  project.routes = project.routes.filter(route => route.from !== uid && route.to !== uid);
  return project.spots.length !== before;
}

export function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const ratio = Math.max(0, Math.min(1,
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)
  ));
  const x = start.x + ratio * dx;
  const y = start.y + ratio * dy;
  return Math.hypot(point.x - x, point.y - y);
}
