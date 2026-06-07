# UltimateTV

Version 1 Stremio addon for live TV streams.

## Run

```bash
npm start
```

Default port is `7000`. Override with:

```bash
PORT=7015 npm start
```

Stremio manifest:

```txt
http://127.0.0.1:7000/manifest.json
```

Hosted manifest:

```txt
https://ultimatetv.sudolocal.qzz.io/manifest.json
```

## Catalogs

UltimateTV exposes the full channel list plus category catalogs for easier TV browsing:

- Sports
- Movies
- Kids & Cartoon
- News
- Music
- Religion
- Khmer / Cambodia
- Bangla / Bangladesh
- India / Hindi
- Pakistan
- International
- Xtream

## Performance

Catalog responses are paginated to keep TV clients responsive with large providers. The default page size is `500` items and can be changed with `CATALOG_PAGE_SIZE`. Stremio clients can request more with `skip`, and all catalogs support `search`. Stream and meta lookups resolve by channel ID directly instead of rebuilding the full catalog.

## Sources

- DTVHD channels are parsed dynamically from `https://www.dtvhd.com/`.
- MekongTV channels are parsed dynamically from `https://www.mekongtv.net/channels`.
- Signed/resolver streams are refreshed where an upstream resolver is available.
- Local M3U channels can be loaded from `EXTRA_M3U_PATH` or `manual.m3u`.
- Remote M3U playlists can be loaded with `REMOTE_M3U_SOURCES_JSON`.
- Xtream live channels can be loaded with `XTREAM_SOURCES_JSON`.
- Stream URLs can be wrapped through MediaFlow with `MEDIAFLOW_PROXY_URL` and `MEDIAFLOW_PROXY_PASSWORD`.

The addon filters out channels that failed during the initial scan for version 1.

## Private Source Config

Keep provider credentials and private playlists in `.env`; this file is ignored and must not be committed. Example:

```bash
EXTRA_M3U_PATH=/root/dtv-cambodia-addon/manual.m3u
REMOTE_M3U_SOURCES_JSON=[{"name":"Sport","url":"https://example.com/sport.m3u"}]
XTREAM_SOURCES_JSON=[{"name":"Xtream 01","server":"https://example.com:443","username":"user","password":"pass"}]
MEDIAFLOW_PROXY_URL=https://proxy.sudolocal.qzz.io
MEDIAFLOW_PROXY_PASSWORD=your_mediaflow_password
```

Both `/catalog/tv/ultimate-tv.json` and the old `/catalog/tv/dtv-cambodia.json` route are supported for compatibility.
