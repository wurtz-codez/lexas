# AGENTS.md - Project Tracker

> This file is auto-updated on every commit to keep an accurate snapshot of the project state.

---

## Project Overview

**Lexas** is an Electron desktop application built with TypeScript and Vite. Currently in the initial scaffold stage (Electron Forge template).

- **Author:** Koustubh Pande
- **License:** MIT
- **Current Version:** 1.0.0

---

## Tech Stack

| Layer             | Technology         | Version    |
| ----------------- | ------------------ | ---------- |
| Runtime           | Electron           | 43.1.0     |
| Desktop Framework | Electron Forge     | ^7.11.2    |
| Bundler           | Vite               | ^5.4.21    |
| Language          | TypeScript         | ~4.5.4     |
| Linting           | ESLint             | ^8.57.1    |
| Security          | Electron Fuses     | ^1.8.0     |

### Packaging Targets (configured, not yet used)
- Windows: Squirrel
- macOS: ZIP
- Linux: DEB, RPM

---

## Project Structure

```
lexas/
├── .eslintrc.json            # ESLint config
├── .gitignore                # Git ignore rules
├── forge.config.ts           # Electron Forge config (ASAR, makers, Vite, fuses)
├── forge.env.d.ts            # Forge Vite env type declarations
├── index.html                # Root HTML (renderer entry)
├── LICENSE                   # MIT License
├── package.json              # Project manifest & scripts
├── tsconfig.json             # TypeScript config
├── vite.main.config.ts       # Vite config - main process
├── vite.preload.config.ts    # Vite config - preload script
├── vite.renderer.config.ts   # Vite config - renderer process
└── src/
    ├── index.css             # Global styles
    ├── main.ts               # Electron main process entry
    ├── preload.ts            # Preload script (IPC bridge - currently empty)
    └── renderer.ts           # Renderer process entry
```

---

## Implemented Features

### Completed
- [x] Project scaffolding via Electron Forge (Vite + TypeScript template)
- [x] Main process creates BrowserWindow (800x600) and loads app content
- [x] DevTools opens automatically in development mode
- [x] macOS lifecycle handling (keep alive on window close, re-create on activate)
- [x] Security fuses configured (RunAsNode disabled, CookieEncryption enabled, ASAR integrity validation, etc.)
- [x] Cross-platform packaging configured (Squirrel, ZIP, DEB, RPM)

### Not Yet Implemented
- [ ] Application-specific UI (currently just "Hello World")
- [ ] IPC communication (preload script is empty)
- [ ] Any business logic
- [ ] Tests
- [ ] CI/CD pipeline
- [ ] Documentation / README
- [ ] CSS framework or component library

---

## Available Scripts

| Script      | Command                    | Description                        |
| ----------- | -------------------------- | ---------------------------------- |
| `start`     | `electron-forge start`     | Launch app in development mode     |
| `package`   | `electron-forge package`   | Package app for current platform    |
| `make`      | `electron-forge make`      | Create platform installers          |
| `publish`   | `electron-forge publish`   | Publish packaged app                |
| `lint`      | `eslint --ext .ts,.tsx .`  | Lint all TypeScript files           |

---

## Git State

- **Branch:** main
- **Commits:** 1 (Initial commit)
- **Last Updated:** 2026-07-14

---

## Notes

- No UI framework (React/Vue/etc.) is installed yet. Plain HTML/CSS only.
- No test framework is configured.
- No `.env` or environment-specific files exist.
- The `preload.ts` file is empty — no IPC bridge exposed to renderer yet.
