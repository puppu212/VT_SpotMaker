import { dataUrlToBlob, fileToDataUrl, loadImage } from "./media.js";

const TYPES = ["spot", "route", "escape"];
const DEFAULT_NAME = "標準画像";

export function createMaterialStore(defaultUrls) {
  let urls = { ...defaultUrls };
  let names = defaultNames();
  let images = emptyImages();

  return {
    async reset() {
      urls = { ...defaultUrls };
      names = defaultNames();
      images = await loadEntries(urls);
    },

    async replace(type, file) {
      assertType(type);
      urls[type] = await fileToDataUrl(file);
      images[type] = await loadImage(urls[type]);
      names[type] = file.name;
    },

    async restore(saved = {}) {
      urls = { ...defaultUrls };
      names = defaultNames();
      for (const type of TYPES) {
        const material = saved[type];
        if (!material) continue;
        urls[type] = material.blob
          ? await fileToDataUrl(material.blob)
          : material.url || defaultUrls[type];
        names[type] = material.name || DEFAULT_NAME;
      }
      for (const type of TYPES) {
        try {
          images[type] = await loadImage(urls[type]);
        } catch {
          urls[type] = defaultUrls[type];
          names[type] = DEFAULT_NAME;
          images[type] = await loadImage(defaultUrls[type]);
        }
      }
    },

    snapshot() {
      return Object.fromEntries(TYPES.map(type => {
        const blob = dataUrlToBlob(urls[type]);
        return [type, {
          name: names[type],
          blob,
          url: blob ? "" : urls[type],
        }];
      }));
    },

    image(type) {
      assertType(type);
      return images[type];
    },

    url(type) {
      assertType(type);
      return urls[type];
    },

    name(type) {
      assertType(type);
      return names[type];
    },
  };
}

export const MATERIAL_TYPES = TYPES;

function defaultNames() {
  return Object.fromEntries(TYPES.map(type => [type, DEFAULT_NAME]));
}

function emptyImages() {
  return Object.fromEntries(TYPES.map(type => [type, null]));
}

async function loadEntries(urls) {
  return Object.fromEntries(await Promise.all(
    TYPES.map(async type => [type, await loadImage(urls[type])])
  ));
}

function assertType(type) {
  if (!TYPES.includes(type)) throw new Error(`不明な素材種別です: ${type}`);
}
