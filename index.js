const fs = require("fs");
const http = require("http");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 7000);
const ADDON_ID = "org.ultimate.tv";
const ADDON_NAME = "UltimateTV";
const ADDON_VERSION = "1.0.0";
const ADDON_LOGO =
  "https://github.com/iamsherman1234/aria2tor/raw/refs/heads/main/raw/main/dtv.png";

const CACHE_TTL_MS = 10 * 60 * 1000;
const XTREAM_CACHE_TTL_MS = 15 * 60 * 1000;
const CATEGORY_CATALOGS = [
  { id: "ultimate-tv", name: "All Channels", genres: ["Live TV"] },
  { id: "ultimate-tv-sports", name: "Sports", genres: ["Sports"] },
  { id: "ultimate-tv-movies", name: "Movies", genres: ["Movies"] },
  { id: "ultimate-tv-kids", name: "Kids & Cartoon", genres: ["Kids", "Cartoon"] },
  { id: "ultimate-tv-news", name: "News", genres: ["News"] },
  { id: "ultimate-tv-music", name: "Music", genres: ["Music"] },
  { id: "ultimate-tv-religion", name: "Religion", genres: ["Religion"] },
  { id: "ultimate-tv-khmer", name: "Khmer / Cambodia", genres: ["Khmer", "Cambodia"] },
  { id: "ultimate-tv-bangla", name: "Bangla / Bangladesh", genres: ["Bangla", "Bangladesh"] },
  { id: "ultimate-tv-india", name: "India / Hindi", genres: ["India", "Hindi"] },
  { id: "ultimate-tv-pakistan", name: "Pakistan", genres: ["Pakistan"] },
  { id: "ultimate-tv-international", name: "International", genres: ["International"] },
  { id: "ultimate-tv-xtream", name: "Xtream", genres: ["Xtream"] },
];
const CATALOG_IDS = new Set([...CATEGORY_CATALOGS.map((catalog) => catalog.id), "dtv-cambodia"]);

loadEnvFile();

function loadEnvFile() {
  const envPath = process.env.ENV_FILE || ".env";
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
  }
}

function parseJsonEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (error) {
    console.error(`Invalid ${name}: ${error.message}`);
    return fallback;
  }
}

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


function textHas(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function getChannelCategories(channel) {
  const haystack = [
    channel.name,
    channel.description,
    channel.source,
    channel.sourceId,
    channel.url,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const categories = new Set(["ultimate-tv"]);

  if (channel.source === "xtream") categories.add("ultimate-tv-xtream");
  if (["dtv", "mekong"].includes(channel.source) || textHas(haystack, [/khmer|cambodia|bayon|tvk|ctn|cnc|hang meas|rhm|mytv|ppctv|metfone|sastra|kps|apsara|dtvhd/])) categories.add("ultimate-tv-khmer");
  if (textHas(haystack, [/sport|bein|beinsports|tsport|t-sports|willow|cricket|football|laliga|liga|premier|espn|tsn|nfl|golf|racing|real madrid|dd sports|a sports|ptv sports|fox sports|ipl|euro sports/])) categories.add("ultimate-tv-sports");
  if (textHas(haystack, [/movie|cinema|film|bollywood|hollywood|hbo|action|moviesphere|my cinema|blackcinema|sastra|kix|cineedge/])) categories.add("ultimate-tv-movies");
  if (textHas(haystack, [/cartoon|kids|kid|junior|disney|nickelodeon|pbs kids|tom|jerry|jungle book|buddy star|funny junior|nikky/])) categories.add("ultimate-tv-kids");
  if (textHas(haystack, [/news|cnn|bbc world|bbc news|cctv plus|cctv|dw|cgtn|wion|al jazeera|bloomberg|rt news|republic|ndtv|somoy|jamuna|ekattor|dbc|channel 24|city news|star news/])) categories.add("ultimate-tv-news");
  if (textHas(haystack, [/music|\bmtv\b|balle|yrf|jalwa|dance|biz music|top music|9x/])) categories.add("ultimate-tv-music");
  if (textHas(haystack, [/islam|makkah|quran|sunnah|deen|peace tv|religion/])) categories.add("ultimate-tv-religion");
  if (textHas(haystack, [/bangla|bangladesh|zee bangla|jalsha|boishakhi|ekushey|gazi tv|atn bangla|\bntv\b|\brtv\b|nexus tv|deepto|bijoy|desh tv|banglavision|maasranga|kolkata|ananda|ghanta|rongeen/])) categories.add("ultimate-tv-bangla");
  if (textHas(haystack, [/india|hindi|sony sab|star sports|\bzee\b|z news|dangal|dd national|dd bangla|abp|ndtv|republic|colors bangla|colors hd|jalsha|enterr10|shemaroo|bollywood/])) categories.add("ultimate-tv-india");
  if (textHas(haystack, [/pakistan|ary digital|geo entertainment|hum tv|aaj entertainment|ptv sports|green entertainment|green ent/])) categories.add("ultimate-tv-pakistan");
  if (textHas(haystack, [/usa|uk|europe|world|international|earth|nature|wild|discovery|animal planet|rakuten|red bull|axs|house of crime|intelligence|xxtreme|america|american|denmark|france|germany|spain|italy|arabic|saudi/])) categories.add("ultimate-tv-international");

  return [...categories];
}

function getCatalogGenres(catalogId, channel) {
  const catalog = CATEGORY_CATALOGS.find((item) => item.id === catalogId);
  if (!catalog || catalog.id === "ultimate-tv") {
    return [
      "Live TV",
      ...getChannelCategories(channel)
        .filter((id) => id !== "ultimate-tv")
        .map((id) => CATEGORY_CATALOGS.find((item) => item.id === id)?.name)
        .filter(Boolean),
    ];
  }
  return catalog.genres;
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


function parseM3u(text, sourceName = "M3U") {
  const channels = [];
  let pending = null;

  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("#EXTINF")) {
      const commaIndex = line.lastIndexOf(",");
      const name = commaIndex >= 0 ? line.slice(commaIndex + 1).trim() : "Live TV";
      const logo = (line.match(/tvg-logo=["']([^"']+)["']/i) || [])[1] || ADDON_LOGO;
      const group = (line.match(/group-title=["']([^"']+)["']/i) || [])[1];
      pending = { name, logo, group };
      continue;
    }

    if (/^https?:\/\//i.test(line)) {
      const info = pending || { name: sourceName, logo: ADDON_LOGO };
      channels.push({
        name: info.name || sourceName,
        logo: info.logo || ADDON_LOGO,
        group: info.group,
        url: line,
      });
      pending = null;
    }
  }

  return channels;
}

function makeM3uChannels(entries, source, sourceLabel) {
  return entries.map((channel, index) => ({
    source,
    sourceId: String(index + 1) + "_" + cleanIdPart(channel.name || sourceLabel),
    name: channel.name,
    url: channel.url,
    logo: channel.logo || ADDON_LOGO,
    description: channel.group ? channel.group + " via " + sourceLabel : sourceLabel,
  }));
}

function getManualM3uChannels() {
  const filePath = process.env.EXTRA_M3U_PATH || "manual.m3u";
  if (!fs.existsSync(filePath)) return [];
  const entries = parseM3u(fs.readFileSync(filePath, "utf8"), "Manual M3U");
  return makeM3uChannels(entries, "m3u", "Manual M3U");
}

function getRemoteM3uSources() {
  return parseJsonEnv("REMOTE_M3U_SOURCES_JSON", []).filter((source) => source && source.url);
}

async function getRemoteM3uChannels() {
  return cached(
    "remote-m3u",
    async () => {
      const results = await Promise.all(
        getRemoteM3uSources().map(async (source, sourceIndex) => {
          try {
            const response = await fetchText(source.url, 20000);
            if (!response.ok) return [];
            return parseM3u(response.text, source.name || "Remote M3U").map((channel, index) => ({
              source: "remote_m3u",
              sourceId:
                String(sourceIndex + 1) +
                "_" +
                String(index + 1) +
                "_" +
                cleanIdPart(channel.name || source.name || "remote"),
              name: channel.name,
              url: channel.url,
              logo: channel.logo || ADDON_LOGO,
              description: (source.name || "Remote M3U") + " playlist",
            }));
          } catch (error) {
            console.error(`Remote M3U failed for ${source.name || source.url}: ${error.message}`);
            return [];
          }
        }),
      );
      return results.flat();
    },
    CACHE_TTL_MS,
  );
}

function getXtreamSources() {
  return parseJsonEnv("XTREAM_SOURCES_JSON", []).filter(
    (source) => source && source.server && source.username && source.password,
  );
}

function mediaflowProxyUrl(streamUrl) {
  const base = (process.env.MEDIAFLOW_PROXY_URL || process.env.ULTIMATETV_MEDIAFLOW_PROXY_URL || "").replace(/\/+$/, "");
  const password = process.env.MEDIAFLOW_PROXY_PASSWORD || process.env.MEDIAFLOW_PASSWORD || process.env.ULTIMATETV_MEDIAFLOW_PROXY_PASSWORD || "";
  if (!base || !password || !streamUrl) return streamUrl;
  if (streamUrl.startsWith(base + "/")) return streamUrl;

  const isHls = /\.m3u8?(?:[?#]|$)/i.test(streamUrl);
  const path = isHls ? "/proxy/hls/manifest.m3u8?d=" : "/proxy/stream?url=";
  return base + path + encodeURIComponent(streamUrl) + "&api_password=" + encodeURIComponent(password);
}

function xtreamStreamUrl(source, streamId, containerExtension = "m3u8") {
  const server = String(source.server).replace(/\/+$/, "");
  const ext = cleanIdPart(containerExtension || "m3u8") || "m3u8";
  return (
    server +
    "/live/" +
    encodeURIComponent(source.username) +
    "/" +
    encodeURIComponent(source.password) +
    "/" +
    encodeURIComponent(streamId) +
    "." +
    ext
  );
}

async function getXtreamChannels() {
  return cached(
    "xtream",
    async () => {
      const results = await Promise.all(
        getXtreamSources().map(async (source, sourceIndex) => {
          try {
            const server = String(source.server).replace(/\/+$/, "");
            const api =
              server +
              "/player_api.php?username=" +
              encodeURIComponent(source.username) +
              "&password=" +
              encodeURIComponent(source.password) +
              "&action=get_live_streams";
            const response = await fetchText(api, 25000);
            if (!response.ok) return [];
            const items = JSON.parse(response.text);
            if (!Array.isArray(items)) return [];
            return items
              .filter((item) => item && item.stream_id && item.name)
              .map((item) => ({
                source: "xtream",
                sourceId:
                  String(sourceIndex + 1) +
                  "_" +
                  String(item.stream_id) +
                  "_" +
                  cleanIdPart(item.name),
                xtreamSourceIndex: sourceIndex,
                xtreamStreamId: String(item.stream_id),
                xtreamExtension: item.container_extension || "m3u8",
                name: item.name,
                url: null,
                logo: item.stream_icon || ADDON_LOGO,
                description: source.name ? source.name + " Xtream" : "Xtream",
              }));
          } catch (error) {
            console.error(`Xtream failed for ${source.name || source.server}: ${error.message}`);
            return [];
          }
        }),
      );
      return results.flat();
    },
    XTREAM_CACHE_TTL_MS,
  );
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
  const [dtv, mekong, remoteM3u, xtream] = await Promise.all([
    getDtvChannels(),
    getMekongChannels(),
    getRemoteM3uChannels(),
    getXtreamChannels(),
  ]);
  return [
    ...dtv,
    ...mekong,
    ...getMan1tedChannels(),
    ...getStaticChannels(),
    ...getManualM3uChannels(),
    ...remoteM3u,
    ...xtream,
  ];
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

  if (source === "m3u") {
    return getManualM3uChannels().find((item) => item.sourceId === sourceId)?.url || null;
  }

  if (source === "remote_m3u") {
    return (await getRemoteM3uChannels()).find((item) => item.sourceId === sourceId)?.url || null;
  }

  if (source === "xtream") {
    const channel = (await getXtreamChannels()).find((item) => item.sourceId === sourceId);
    const xtreamSource = channel ? getXtreamSources()[channel.xtreamSourceIndex] : null;
    return xtreamSource ? xtreamStreamUrl(xtreamSource, channel.xtreamStreamId, channel.xtreamExtension) : null;
  }

  return null;
}

async function getMetas(catalogId = "ultimate-tv") {
  const normalizedCatalogId = catalogId === "dtv-cambodia" ? "ultimate-tv" : catalogId;
  const channels = await getAllChannels();
  const seen = new Set();
  return channels
    .filter((channel) => getChannelCategories(channel).includes(normalizedCatalogId))
    .map((channel) =>
      makeMeta(channel.source, channel.sourceId, channel.name, channel.logo, {
        description: channel.description || channel.name + " via " + ADDON_NAME,
        genres: getCatalogGenres(normalizedCatalogId, channel),
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
    description: "Live TV streams for Stremio.",
    logo: ADDON_LOGO,
    background: ADDON_LOGO,
    resources: ["catalog", "meta", "stream"],
    types: ["tv"],
    catalogs: CATEGORY_CATALOGS.map((catalog) => ({
      type: "tv",
      id: catalog.id,
      name: catalog.id === "ultimate-tv" ? ADDON_NAME : catalog.name,
    })),
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

  const catalogMatch = path.match(/^\/catalog\/tv\/([^/]+)\.json$/);
  if (catalogMatch && CATALOG_IDS.has(catalogMatch[1])) {
    const metas = await getMetas(catalogMatch[1]);
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
    const [source, ...sourceIdParts] = streamMatch[1].split(":");
    const sourceId = sourceIdParts.join(":");
    const meta = (await getMetas()).find((item) => item.id === streamMatch[1]);
    const streamUrl = source && sourceId ? await resolveStream(source, sourceId) : null;
    const proxiedStreamUrl = streamUrl ? mediaflowProxyUrl(streamUrl) : null;
    const streams = proxiedStreamUrl
      ? [
          {
            name: ADDON_NAME,
            title: meta?.name || sourceId,
            url: proxiedStreamUrl,
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
