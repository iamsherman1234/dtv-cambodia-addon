# DTV Cambodia

Version 1 Stremio addon for Cambodian live TV streams.

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

## Sources

- DTVHD channels are parsed dynamically from `https://www.dtvhd.com/`.
- MekongTV channels are parsed dynamically from `https://www.mekongtv.net/channels`.
- Signed/resolver streams are refreshed where an upstream resolver is available.

The addon filters out channels that failed during the initial scan for version 1.
