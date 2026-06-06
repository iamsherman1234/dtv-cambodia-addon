const http = require("http");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 7000);
const ADDON_ID = "org.dtv.cambodia";
const ADDON_NAME = "DTV Cambodia";
const ADDON_VERSION = "1.0.0";
const ADDON_LOGO =
  "https://github.com/iamsherman1234/aria2tor/raw/refs/heads/main/raw/main/dtv.png";

const CACHE_TTL_MS = 10 * 60 * 1000;

const dtvFailedNames = new Set([
  "Town HD",
  "NTV",
  "PP Digital TV",
  "ARDB TV",
  "Cartoon Network",
  "NAT GEO",
  "Premier League",
  "beIN Sports 1",
  "TSport",
  "History",
  "Rock Entertainment",
  "RT News",
  "CNBC",
  "BlackCinema",
  "CCTV7",
  "HTVKey",
  "HTV4",
  "DienBienTV",
  "DongThapTV",
  "HanoiTV2",
]);

const man1tedChannels = [
  ["beee1", "beIN SPORTS 1"],
  ["beee2", "beIN SPORTS 2"],
  ["beee3", "beIN SPORTS 3"],
  ["beee4", "beIN SPORTS 4"],
  ["beee5", "beIN SPORTS 5"],
  ["beee6", "beIN SPORTS 6"],
  ["beee7", "beIN SPORTS 7"],
  ["beee8", "beIN SPORTS 8"],
  ["beee9", "beIN SPORTS 9"],
  ["beemax1", "beIN SPORTS MAX 1"],
  ["beemax2", "beIN SPORTS MAX 2"],
  ["beemax3", "beIN SPORTS MAX 3"],
  ["beemax4", "beIN SPORTS MAX 4"],
  ["beemax5", "beIN SPORTS MAX 5"],
  ["beemax6", "beIN SPORTS MAX 6"],
  ["th1", "ثمانية 1"],
  ["th2", "ثمانية 2"],
  ["th3", "ثمانية 3"],
  ["mbc2", "MBC 2"],
];

const staticStreams = [
  {
    id: "bozz_giatv_208314",
    name: "BozzTV 208314",
    url: "https://live20.bozztv.com/giatvplayout7/giatv-208314/tracks-v1a1/mono.ts.m3u8",
  },
  {
    id: "roya_kids",
    name: "Roya Kids",
    url: "https://playlist.fasttvcdn.com/pl/ptllxjd03j6g9oxxjdfapg/roya-kids/playlist/0.m3u8",
  },
  {
    id: "periscope_480p",
    name: "Periscope 480p",
    url: "https://prod-fastly-eu-west-1.video.pscp.tv/Transcoding/v1/hls/xbSjrc-YLxrFRibGjuNsYDE3uzCBkiJ-RibFrfzej03JCw1EdTnWxlnMpB5rsBSLRfIgGm-iZ43v6wgPxiLJpA/transcode/eu-west-1/periscope-replay-direct-prod-eu-west-1-public/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsInZlcnNpb24iOiIyIn0.eyJFbmNvZGVyU2V0dGluZyI6ImVuY29kZXJfc2V0dGluZ180ODBwMzBfMTAiLCJIZWlnaHQiOjQ4MCwiS2JwcyI6MTIwMCwiV2lkdGgiOjg0OH0.0LJi1usWbiPqp0QIcpq7Md5g1WxvJcPqVWNqsKw5nhA/dynamic_delta.m3u8?type=live&_HLS_skip=YES",
  },
  {
    id: "ppctv_free_user",
    name: "PPCTV Free User",
    url: "https://edge-kh3a.ppctvhd.com:443/pstream-b7702975-51c6-4eba-9624-ade1e2040ddd/hd/b7702975-51c6-4eba-9624-ade1e2040ddd.m3u8?session=NemEQm8Z65YuvazZLESfTA&wmsAuthSign=c2VydmVyX3RpbWU9Ni82LzIwMjYgMzo1NDo0OCBQTSZoYXNoX3ZhbHVlPWNGWHhieXlFSzRjL1JESU9Nck5od1E9PSZ2YWxpZG1pbnV0ZXM9MjAmaWQ9RlJFRV9VU0VSJnN0cm1fbGVuPTQ0",
  },
  {
    id: "hangmeas_5cents",
    name: "Hang Meas",
    url: "https://9b6lez5elpxw-hls-live.5centscdn.com/hangmeas/0c00b89a106bb365ec031b28fa3ae499.sdp/chunks.m3u8",
  },
];

const cache = new Map();

function jsonResponse(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "content-type": "application/json; charset=utf-8",
  });
  res.end(payload);
}

function textResponse(res, status, body) {
  res.writeHead(status, {
    "access-control-allow-origin": "*",
    "content-type": "text/html; charset=utf-8",
  });
  res.end(body);
}

async function fetchText(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0",
        accept: "*/*",
      },
    });
    return {
      ok: response.ok,
      status: response.status,
      url: response.url,
      text: await response.text(),
      contentType: response.headers.get("content-type") || "",
    };
  } finally {
    clearTimeout(timer);
  }
}

async function cached(key, loader, ttlMs = CACHE_TTL_MS) {
  const existing = cache.get(key);
  if (existing && Date.now() - existing.time < ttlMs) return existing.value;
  const value = await loader();
  cache.set(key, { time: Date.now(), value });
  return value;
}

function cleanIdPart(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function makeMeta(source, sourceId, name, logo, extra = {}) {
  const id = `${source}:${sourceId}`;
  return {
    id,
    type: "tv",
    name,
    poster: logo || ADDON_LOGO,
    logo: logo || ADDON_LOGO,
    background: ADDON_LOGO,
    description: extra.description || `${name} live stream`,
    genres: extra.genres || ["Live TV"],
  };
}

async function getDtvChannels() {
  return cached("dtv", async () => {
    const page = await fetchText("https://www.dtvhd.com/");
    const channels = [];
    const re = /\{\s*n:\s*"([^"]+)"\s*,\s*u:\s*"([\s\S]*?)"\s*,\s*l:\s*"([^"]*)"\s*\}/g;
    let index = 0;
    for (const match of page.text.matchAll(re)) {
      index += 1;
      const name = match[1].trim();
      const url = match[2].replace(/\s+/g, "").trim();
      const logo = match[3].trim();
      if (!name || !url || dtvFailedNames.has(name.trim())) continue;
      channels.push({
        source: "dtv",
        sourceId: String(index) + "_" + cleanIdPart(name),
        name,
        url,
        logo,
      });
    }
    return channels;
  });
}

async function getMekongChannels() {
  return cached("mekong", async () => {
    const page = await fetchText("https://www.mekongtv.net/channels");
    const bySlug = new Map();
    const re =
      /<a\b([^>]*class="panel2"[^>]*)>([^<]+)<\/a>/g;

    for (const match of page.text.matchAll(re)) {
      const attrs = Object.fromEntries(
        [...match[1].matchAll(/([a-zA-Z0-9_-]+)="([^"]*)"/g)].map((m) => [
          m[1],
          m[2],
        ]),
      );
      const slug = (attrs.href || "").split("/").filter(Boolean).pop();
      const name = match[2].trim();
      if (!slug || !name || slug === "apsaratv") continue;
      bySlug.set(slug, { slug, name });
    }

    return [...bySlug.values()].map((channel) => ({
      source: "mekong",
      sourceId: channel.slug,
      name: channel.name,
      url: null,
      logo: ADDON_LOGO,
    }));
  });
}

function getMan1tedChannels() {
  return man1tedChannels.map(([id, name]) => ({
    source: "man1ted",
    sourceId: id,
    name,
    url: null,
    logo: ADDON_LOGO,
  }));
}

function getStaticChannels() {
  return staticStreams.map((channel) => ({
    source: "static",
    sourceId: channel.id,
    name: channel.name,
    url: channel.url,
    logo: ADDON_LOGO,
  }));
}

async function getAllChannels() {
  const [dtv, mekong] = await Promise.all([getDtvChannels(), getMekongChannels()]);
  return [...dtv, ...mekong, ...getMan1tedChannels(), ...getStaticChannels()];
}

async function resolveStream(source, sourceId) {
  if (source === "dtv") {
    const channel = (await getDtvChannels()).find((item) => item.sourceId === sourceId);
    return channel?.url || null;
  }

  if (source === "mekong") {
    const page = await fetchText(`https://www.mekongtv.net/channels/${sourceId}`);
    const src = (page.text.match(/<source\b[^>]*src="([^"]+)"/i) || [])[1];
    return src || null;
  }

  if (source === "man1ted") {
    const api = await fetchText(`https://man1ted.com/get.php?ch=${encodeURIComponent(sourceId)}`);
    const data = JSON.parse(api.text);
    return data?.ok && data?.stream_url ? data.stream_url : null;
  }

  if (source === "static") {
    return staticStreams.find((item) => item.id === sourceId)?.url || null;
  }

  return null;
}

async function getMetas() {
  const channels = await getAllChannels();
  const seen = new Set();
  return channels
    .map((channel) =>
      makeMeta(channel.source, channel.sourceId, channel.name, channel.logo, {
        description: `${channel.name} via ${ADDON_NAME}`,
      }),
    )
    .filter((meta) => {
      if (seen.has(meta.id)) return false;
      seen.add(meta.id);
      return true;
    });
}

function manifest() {
  return {
    id: ADDON_ID,
    version: ADDON_VERSION,
    name: ADDON_NAME,
    description: "Cambodian live TV streams for Stremio.",
    logo: ADDON_LOGO,
    background: ADDON_LOGO,
    resources: ["catalog", "meta", "stream"],
    types: ["tv"],
    catalogs: [
      {
        type: "tv",
        id: "dtv-cambodia",
        name: ADDON_NAME,
      },
    ],
    behaviorHints: {
      configurable: false,
      configurationRequired: false,
    },
  };
}

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = decodeURIComponent(url.pathname);

  if (req.method === "OPTIONS") return jsonResponse(res, 200, {});

  if (path === "/" || path === "/configure") {
    return textResponse(
      res,
      200,
      `<h1>${ADDON_NAME}</h1><p>Install in Stremio using <code>${url.origin}/manifest.json</code></p>`,
    );
  }

  if (path === "/manifest.json") return jsonResponse(res, 200, manifest());

  if (path === "/catalog/tv/dtv-cambodia.json") {
    const metas = await getMetas();
    return jsonResponse(res, 200, { metas });
  }

  const metaMatch = path.match(/^\/meta\/tv\/(.+)\.json$/);
  if (metaMatch) {
    const id = metaMatch[1];
    const meta = (await getMetas()).find((item) => item.id === id);
    return jsonResponse(res, 200, { meta: meta || null });
  }

  const streamMatch = path.match(/^\/stream\/tv\/(.+)\.json$/);
  if (streamMatch) {
    const [source, sourceId] = streamMatch[1].split(":");
    const meta = (await getMetas()).find((item) => item.id === streamMatch[1]);
    const streamUrl = source && sourceId ? await resolveStream(source, sourceId) : null;
    const streams = streamUrl
      ? [
          {
            name: ADDON_NAME,
            title: meta?.name || sourceId,
            url: streamUrl,
            behaviorHints: {
              notWebReady: false,
            },
          },
        ]
      : [];
    return jsonResponse(res, 200, { streams });
  }

  return jsonResponse(res, 404, { error: "not found" });
}

const server = http.createServer((req, res) => {
  route(req, res).catch((error) => {
    console.error(error);
    jsonResponse(res, 500, { error: error.message });
  });
});

server.listen(PORT, () => {
  console.log(`${ADDON_NAME} v${ADDON_VERSION} listening on http://127.0.0.1:${PORT}`);
});
