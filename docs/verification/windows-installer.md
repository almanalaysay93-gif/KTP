# Windows installer verification — 2026-11-09

## Authorization and source

The user requested an installer after directing the local-password migration and
explicitly authorizing commits and pushes to main. Windows x64 was the stated
default. This task builds a per-user local desktop installer; no hosted release
or deployment was published and no hosted patient records were accessed.

Verified build source: `4bb39b3a4efc7a842beabd4638a3c37d006b5502` (clean GitHub
Actions checkout). [Source hashes](installer-source.sha256) bind 393 tracked
build inputs to that commit. The subsequent `cab88b2` changes only the CI
installation wait/logging; application and packaging inputs remain identical.

## Windows evidence

[Successful Windows run](https://github.com/almanalaysay93-gif/KTP/actions/runs/42629792584)
used Windows x64, Node 22, stable MSVC Rust and pinned embedded CPython 3.12.10.

| Check | Result |
| --- | --- |
| TypeScript and focused authentication/parser/desktop policy tests | Passed; 22 tests |
| Portable Windows Python | Exact versions, isolated paths, MSVC DLLs and three bundled ONNX models verified |
| Offline native parsers/OCR | Synthetic image, PDF, spreadsheet and CSV read with Python sockets blocked |
| Rust release | Static C runtime build passed |
| Bundled local integration | Password setup/login, authorized Rust API writes, restart persistence, local-only configuration, mock email and logout passed |
| Unpacked desktop | Password setup displayed with only System32 on PATH; clean database shutdown and lock removal passed |
| Installed desktop | Silent per-user installation and the same desktop smoke passed from the installed location |
| Uninstall | Silent uninstall passed; synthetic marker in the separate local data directory survived |

[Installed Windows password screen](desktop-installer-windows.png).

Only synthetic fixtures were used. The renderer denies remote requests and
privileged APIs. The desktop smoke runs with an unusable cloud connection URL.
Linux Electron headless startup and the local regression suite were also checked;
the Windows run above is the evidence for the actual installer.

## Artifact integrity

[Download artifact](https://github.com/almanalaysay93-gif/KTP/actions/runs/42629792584/artifacts/13681550933)
contains exactly the installer, SHA256SUMS.txt and synthetic first-run screenshot.
Archive contents and the included checksum were independently read back using
byte-range reads; no patient database or credentials appear in the archive.

- Installer: `KTP-Setup-1.0.0-x64.exe` (373,282,569 bytes).
- Installer SHA-256: `2f9348168ea01888b63c0490d0db286e42a69987c69b9faf65b9fc9551148b6d`.
- Artifact ZIP SHA-256: `f01e8d4df0a0895f9adf6b471c611cda2427c1328c270a07007ad7df62ac3f0d`.
- GitHub artifact retention ends December 9, 2026. The workflow can rebuild it.

The initial installer is unsigned; Windows may show an unknown-publisher warning.
Application runtimes are bundled, but the implementation still includes
React/Node/Python alongside Rust. Local passwords do not encrypt data files.
See [installer instructions](../installer.md) for setup, data location and backups.
