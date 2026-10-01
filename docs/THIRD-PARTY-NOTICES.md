# Third-party notices

Inventory of direct installed dependencies, 2026-09-29. Acta is licensed under AGPL-3.0-only; this inventory is not blanket permission to relicense third-party components. Preserve upstream license and notice files in distributions.

| Package                     | Version  | Declared license |
| --------------------------- | -------- | ---------------- |
| @aws-sdk/client-s3          | 3.1143.0 | Apache-2.0       |
| @axe-core/playwright        | 4.13.0   | MPL-2.0          |
| @eslint/js                  | 10.0.1   | MIT              |
| @hookform/resolvers         | 5.9.1    | MIT              |
| @nestjs/common              | 12.1.1   | MIT              |
| @nestjs/core                | 12.1.1   | MIT              |
| @nestjs/platform-express    | 12.1.1   | MIT              |
| @playwright/test            | 1.63.0   | Apache-2.0       |
| @prisma/adapter-pg          | 7.10.0   | Apache-2.0       |
| @prisma/client              | 7.10.0   | Apache-2.0       |
| @tanstack/react-query       | 5.104.0  | MIT              |
| @testing-library/jest-dom   | 7.0.1    | MIT              |
| @testing-library/react      | 16.3.3   | MIT              |
| @testing-library/user-event | 14.6.7   | MIT              |
| @types/cookie-parser        | 1.4.10   | MIT              |
| @types/express              | 5.0.6    | MIT              |
| @types/node                 | 24.19.0  | MIT              |
| @types/pg                   | 8.23.1   | MIT              |
| @types/react                | 19.3.0   | MIT              |
| @types/react-dom            | 19.3.0   | MIT              |
| @types/yauzl                | 3.4.0    | MIT              |
| @vitejs/plugin-react        | 6.1.1    | MIT              |
| argon2                      | 0.45.1   | MIT              |
| cookie-parser               | 1.4.7    | MIT              |
| dotenv                      | 18.0.4   | BSD-2-Clause     |
| eslint                      | 10.11.0  | MIT              |
| eslint-plugin-react-hooks   | 7.1.1    | MIT              |
| eslint-plugin-react-refresh | 0.5.7    | MIT              |
| fast-xml-parser             | 5.11.1   | MIT              |
| globals                     | 17.12.0  | MIT              |
| helmet                      | 8.3.0    | MIT              |
| jsdom                       | 30.1.1   | MIT              |
| pdf-lib                     | 1.17.1   | MIT              |
| pg                          | 8.23.0   | MIT              |
| prettier                    | 3.9.9    | MIT              |
| prisma                      | 7.10.0   | Apache-2.0       |
| react                       | 19.3.0   | MIT              |
| react-dom                   | 19.3.0   | MIT              |
| react-hook-form             | 7.89.0   | MIT              |
| react-router-dom            | 7.18.4   | MIT              |
| reflect-metadata            | 0.2.2    | Apache-2.0       |
| rxjs                        | 7.8.2    | Apache-2.0       |
| sharp                       | 0.35.5   | Apache-2.0       |
| typescript                  | 6.0.3    | Apache-2.0       |
| typescript-eslint           | 8.71.0   | MIT              |
| vite                        | 8.3.1    | MIT              |
| vitest                      | 5.0.2    | MIT              |
| yauzl                       | 3.4.0    | MIT              |
| zod                         | 4.6.5    | MIT              |

## Fonts

Manrope and IBM Plex Sans are distributed locally under SIL OFL 1.1. The full license/copyright notices are in `app/frontend/public/fonts/manrope-OFL.txt` and `ibm-plex-sans-OFL.txt`. Keep them with the files; do not sell fonts alone or assume modified reserved names are permitted. Font files were sourced from the official Google Fonts distribution. No external font requests at runtime. Sources: https://github.com/google/fonts/tree/main/ofl/manrope and https://github.com/google/fonts/tree/main/ofl/ibmplexsans.

## Distribution review

The project license is [AGPL-3.0-only](../LICENSE). Inventories classify third-party terms; they are not blanket legal clearance.

- **Source repository**: third-party vendored files are the eight font files with their two OFL notices and upstream VersityGW license/NOTICE. npm/Go/native binaries are installed or fetched during build, not committed here. A future image distribution has additional obligations; a source URL alone is not a completed corresponding-source offer.
- **npm**: 599 lock entries now include classification, installed license evidence (or explicit platform-not-installed limitation), registry source and integrity. 577 `ATTRIBUTION REQUIRED`, 7 `COMPATIBLE`, 15 `REVIEW REQUIRED`. No confirmed `INCOMPATIBLE` dependency is silently accepted; absence of that classification is not blanket legal clearance.
- **Frontend bundle**: the build now collects verbatim license/NOTICE texts for its 13 production dependencies into `third-party-notices.txt`. Fonts retain their own adjacent OFL notices. No application copyright/license is generated. The collector fails if a production package has no license text.
- **Storage**: [83 Go package license entries](STORAGE-DEPENDENCY-LICENSES.csv), identified by go-licenses v2.0.1 against official v1.8.0 source, cover all 72 module names recorded in the tested binary. 30 MIT, 27 Apache-2.0, 15 BSD-3-Clause, 5 BSD-2-Clause, 5 MPL-2.0, 1 ISC. Preserve all applicable notices and MPL file source. The scanner warns about assembly it cannot analyze; the binary has CGO_ENABLED=0. Its build info has vcs.modified=true: the upstream signed release/digest and build commit are verified, **bit-reproducibility/corresponding-source identity is not established by a module-name match**.
- **Container OS**: 91 Debian packages inventoried in the tested backend. Their `/usr/share/doc/*/copyright` files remain in the image; they are independent distribution components, not automatically relicensed as AGPL. A published multi-platform image requires an exact per-platform SBOM/source/notice bundle. This task does not publish images.

### License-specific decisions

| Component/terms | Classification | Required treatment |
|---|---|---|
| MIT / ISC / BSD variants | ATTRIBUTION REQUIRED | Preserve complete notices/disclaimers; BSD-3 endorsement restriction remains |
| Apache-2.0 | ATTRIBUTION REQUIRED | License, NOTICE where present, changed-file notices and patent conditions; not just a SPDX string |
| MPL-2.0 (axe/lightningcss/Go dependencies) | ATTRIBUTION REQUIRED | Keep covered source files and modifications available under MPL; evaluate any incompatible-with-secondary-license notice before combining |
| CC-BY-4.0 caniuse-lite | ATTRIBUTION REQUIRED | Dataset attribution, license link, change indication; tooling use does not imply it is in the frontend bundle |
| CC0 / Unlicense / 0BSD / MIT-0 | COMPATIBLE | Preserve upstream terms; classification does not grant rights to this application's own code |
| BlueOak-1.0.0 | ATTRIBUTION REQUIRED | Retain license with permission/disclaimer; do not infer a different grant from package name |
| `elkjs` 0.11.1 EPL-2.0 | REVIEW REQUIRED | Actual source header says EPL-2.0. The generic Exhibit A text is not a contributor's secondary-license election. No separate election was found. Used through Prisma Studio tooling, not imported by app code; runtime image still contains that tooling. Do not treat this as AGPL-relicensable code or declare container separation alone sufficient |
| sharp/libvips native packages | REVIEW REQUIRED | [29-component Linux ARM64 inventory](NATIVE-DEPENDENCY-LICENSES.csv), including native LGPL, cairo MPL-1.1, FreeType/fontconfig terms, AOM patent grant and IJG/zlib/BSD mozjpeg terms. Native bundle is not merely Apache-2.0 sharp. Exact source/patch/build mapping and replacement/relinking method must accompany any binary redistribution |

The upstream libvips package README and `versions.json` were read from the **built Linux ARM64 image**, not inferred from host macOS. Upstream [packaging notices](https://github.com/lovell/sharp-libvips/blob/main/THIRD-PARTY-NOTICES.md) describe individual terms. Cairo's stated MPL-1.1 cannot be assumed equivalent to MPL-2.0; if an alternate LGPL grant is selected, confirm it for the exact delivered source. These are concrete release-packaging/legal checks, not runtime failures. No license text was replaced or suppressed.

### Fonts and application assets

Manrope (500/600/700/800) and IBM Plex Sans (400/500/600/700) retain their SIL OFL-1.1 texts next to the unmodified TTF files. Respect reserved names on modifications. The font licenses do not license the application. Runtime font requests are local.

Ownership of Acta application code and its own assets was confirmed by Cristóbal Ruz Escobar on 2026-10-01. Application SVG and fictional product screenshots are covered by [AGPL-3.0-only](../LICENSE); third-party assets retain their original terms. Design ideas do not grant permission to copy third-party code/assets. The snapshot includes eight product screenshots, not prototype source files or third-party product logos.

Before distributing images, complete exact source/notice and replacement/relinking obligations for their Go/native/OS components. The source inventories alone do not complete that package. Only the source snapshot is under review; no images have been published.
