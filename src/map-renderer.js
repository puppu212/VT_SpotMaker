export function renderMap({
  ctx,
  canvas,
  project,
  worldImage,
  imageMap,
  materials,
  selectedSpot,
  selectedRoute,
  routeWidth,
}) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#26313d";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (worldImage) ctx.drawImage(worldImage, 0, 0, canvas.width, canvas.height);

  for (const route of project.routes) {
    drawRoute(ctx, project, route, selectedRoute, materials, routeWidth);
  }
  for (const spot of project.spots) {
    drawSpot(ctx, spot, selectedSpot, imageMap, materials);
  }
}

function drawRoute(ctx, project, route, selectedRoute, materials, routeWidth) {
  const from = project.spots.find(spot => spot.uid === route.from);
  const to = project.spots.find(spot => spot.uid === route.to);
  if (!from || !to) return;
  const selected = selectedRoute?.uid === route.uid;
  const image = materials.image(route.type === "escape" ? "escape" : "route");
  ctx.save();
  ctx.globalAlpha = route.alpha / 255;
  drawRouteImage(ctx, image, from, to, routeWidth);
  if (selected) {
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRouteImage(ctx, image, from, to, routeWidth) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (!image || length === 0) return;
  ctx.save();
  ctx.translate(from.x, from.y);
  ctx.rotate(Math.atan2(dy, dx));
  ctx.drawImage(image, 0, -routeWidth / 2, length, routeWidth);
  ctx.restore();
}

function drawSpot(ctx, spot, selectedSpot, imageMap, materials) {
  const selected = selectedSpot?.uid === spot.uid;
  const image = imageMap.get(spot.image) ?? materials.image("spot");
  const x = spot.x - spot.width / 2;
  const y = spot.y - spot.height / 2;
  if (image) {
    ctx.drawImage(image, x, y, spot.width, spot.height);
  } else {
    ctx.fillStyle = "#e6a94b";
    ctx.beginPath();
    ctx.arc(spot.x, spot.y, Math.max(7, Math.min(spot.width, spot.height) / 2), 0, Math.PI * 2);
    ctx.fill();
  }
  if (selected) {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.strokeRect(x - 3, y - 3, spot.width + 6, spot.height + 6);
  }
  ctx.font = "600 13px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#000";
  ctx.strokeText(spot.name || spot.id, spot.x, y + spot.height + 5);
  ctx.fillStyle = "#fff";
  ctx.fillText(spot.name || spot.id, spot.x, y + spot.height + 5);
}
