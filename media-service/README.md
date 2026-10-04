# Reusable social media service

This optional, standalone Node 22+ service implements the existing Seoul Pocket fetcher contract. It can be run beside another app without copying any trip data, account, or database. It uses `yt-dlp` on `PATH`; `ffmpeg` is optional for JPEG thumbnail conversion. Install and update those tools separately. No runtime npm packages are required.

## Configure and run

Set these environment variables in your process manager or secret store (not in this repository):

- `FETCH_SECRET`: random shared secret of at least 32 bytes, also configured on the calling backend.
- `MEDIA_ROOT`: absolute path to a persistent, private cache directory writable by this process. A new directory is created with mode `0700`; an existing directory with broader permissions is refused.
- `HOST`: bind address, default `127.0.0.1`. Keep the default unless you have an authenticated, HTTPS reverse proxy.
- `PORT`: TCP port, default `8791`.
- `MAX_CACHE_BYTES`: maximum persisted cache size in bytes, default 2 GiB. Completed entries and crash-abandoned staging files count toward it. Once full, new links return 503 `full`; cached links remain available. Increase the quota or curate the cache offline under your own retention policy. The service never silently removes stored media.
- `COOKIES_FILE`: optional absolute path to an owner-authorized Netscape-format cookies file. Do not commit it. Some Instagram posts require a logged-in session.

Run `node media-service/server.mjs`. The process fails at startup if the secret or cache path is missing. Run it as an unprivileged OS user. Protect the cache and cookies at the filesystem level; use a private TLS tunnel or reverse proxy for remote access. Never call the service directly from browser code or expose `FETCH_SECRET` to a client. Seoul Pocket's Pages Functions already authenticate members and forward to this service with `FETCH_ORIGIN` and `FETCH_SECRET` configured server-side.

## HTTP contract

Every request needs `X-Fetch-Secret`.

- `GET /health` returns `{ "ok": true }`.
- `POST /unfurl` with JSON `{ "url": "https://..." }` returns `id`, `provider`, `author`, `caption`, `title`, `durationS`, `kind`, `width`, `height`, `thumb`, `video`, `image`, and `url`. Media fields are relative paths such as `media/<id>/thumb.jpg`; empty strings mean unavailable.
- `GET /media/<20-hex-id>/<filename>` serves cached `thumb.jpg`, `image.jpg` (or supported image extension), or `video.mp4`. Single byte ranges, including suffix ranges, return 206; invalid ranges return 416.

Only HTTPS links on TikTok, Instagram, YouTube, Naver, X, and Twitter are accepted. The cache key is a SHA-256 prefix of the canonical URL. Concurrent requests for the same URL share one extraction. Up to four distinct extraction requests may be active or queued; additional requests return 503 `busy`. Cached metadata is reused on later requests. Errors expose only a stable code, not extractor output or paths.

Each yt-dlp invocation uses a loopback HTTPS CONNECT proxy that resolves and connects only to public IPv4 addresses. HTTP and private, loopback, link-local, metadata, and reserved IP destinations are refused, including after a provider redirect. An OS-level egress firewall is still recommended for defense in depth. The service requests a single HTTPS MP4 at no more than 720p and 45 MB; it does not let ffmpeg perform network downloads. This is deliberately narrower than yt-dlp's full format selection, so some posts will have a preview without in-app video. A TikTok extraction failure falls back to TikTok's official oEmbed metadata and, when available from an approved CDN, a thumbnail. **That fallback is a preview, not playable video.** Provider availability, login requirements, and playback vary over time; do not promise full Instagram/TikTok playback without a live test on the target host. The service does not bypass private or removed posts.

## Portable handoff

For another app, keep this service behind its own authenticated backend. Map the returned relative media paths to that app's protected media proxy, as `functions/api/unfurl.js` and `functions/api/media/[[path]].js` do here. Keep user/vote records in the other app's database, not in this service. The service only owns media extraction and cache bytes; it contains no Seoul Pocket trip model.

Run `node --test tests/media-service.test.mjs` for the local API contract test. This uses a fake extractor and requires neither cookies nor live social posts. A deployment acceptance test must separately verify a public post from each intended provider, an MP4 byte-range request, authentication failure, and a preview-only case.
