# Share card fonts

The fonts of the share cards (`src/lib/og.tsx`), as static TTF instances: the same files Google
Fonts serves for the queries in `og.tsx` (fetched without a browser User-Agent). They ship with the
site so a card never waits on the network for its fonts; `next.config.js` includes them in the
server functions (`outputFileTracingIncludes`).

| File | Family | License |
|---|---|---|
| `bricolage-grotesque-display-800.ttf` | Bricolage Grotesque (opsz 96, wdth 75, wght 800) | SIL Open Font License 1.1 |
| `readex-pro-400-latin.ttf`, `readex-pro-600-latin.ttf` | Readex Pro, Latin subset | SIL Open Font License 1.1 |
| `alexandria-400.ttf`, `alexandria-700.ttf` | Alexandria | SIL Open Font License 1.1 |

To change a font, change its query in `og.tsx` and download the matching file here again.
