# Delta, snapshot 001

Baseline, no previous snapshot.

## Counts

- Tokens: 247 (see design.md, per-group tables)
- Components: 43 (12 clay, 1 ktp shared, 19 ktp admin, 9 ktp patient, 2 ktp signin; `.tsx` files bound in bindings.md)
- Screens captured: 5 (`/preview/system`, `/preview/sign-in`, `/preview/admin`, `/preview/me`, `/preview/patient`) at 1440x900 and 390x844, 10 PNGs
- Preview routes registered: 6 (adds `/preview/motion`, not captured)

## Notes for the next snapshot

- Color tokens with no direct component use: coral, focus, focus-ring, lilac, mauve, series-1, series-3, series-4, series-5 (chart series may be read through shadcn `--chart-N` in chart code).
- Legacy `.dark` block still present in `client/src/index.css`, unused.
- Screenshots taken from the dev server (`vite --port 5173`), viewport only, after a scroll pass so count-ups finish.
