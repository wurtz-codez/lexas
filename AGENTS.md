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

| Layer             | Technology             | Version    |
| ----------------- | ---------------------- | ---------- |
| Runtime           | Electron               | 43.1.0     |
| Desktop Framework | Electron Forge         | ^7.11.2    |
| Bundler           | Vite                   | ^5.4.21    |
| Language          | TypeScript             | ^5.9.3     |
| UI Framework      | React                  | ^19.2.7    |
| Styling           | Tailwind CSS           | ^4.3.2     |
| UI Components     | shadcn/ui              | latest     |
| Icons             | Lucide React           | ^1.24.0    |
| Animations        | Motion (motion/react)  | ^12.42.2   |
| Routing           | React Router           | ^7.18.1    |
| Data Fetching     | TanStack Query         | ^5.101.2   |
| State Management  | Zustand                | ^5.0.14    |
| Linting           | ESLint                 | ^8.57.1    |
| Security          | Electron Fuses         | ^1.8.0     |

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
├── AGENTS.md                 # Project tracker (auto-updated)
├── components.json           # shadcn/ui config
├── postcss.config.mjs        # PostCSS config (Tailwind CSS v4)
├── forge.config.ts           # Electron Forge config (ASAR, makers, Vite, fuses)
├── forge.env.d.ts            # Forge Vite env type declarations
├── index.html                # Root HTML (renderer entry for React)
├── LICENSE                   # MIT License
├── package.json              # Project manifest & scripts
├── tsconfig.json             # TypeScript config
├── vite.main.config.ts       # Vite config - main process
├── vite.preload.config.ts    # Vite config - preload script
├── vite.renderer.config.ts   # Vite config - renderer (React + Tailwind)
└── src/
    ├── main.ts               # Electron main process entry
    ├── main.tsx              # React renderer entry point
    ├── App.tsx               # Root React component (providers + layout)
    ├── preload.ts            # Preload script (IPC bridge - empty)
    ├── assets/               # Static assets (images, fonts, etc.)
    ├── components/
    │   ├── ui/               # shadcn/ui components (Button, etc.)
    │   ├── common/           # Shared/common components
    │   └── layout/           # Layout components (RootLayout)
    ├── features/
    │   ├── auth/             # Authentication feature
    │   ├── chat/             # Chat feature
    │   ├── settings/         # Settings feature
    │   ├── memory/           # Memory feature
    │   └── onboarding/       # Onboarding feature
    ├── hooks/                # Shared React hooks
    ├── lib/                  # Utilities (utils, theme-provider)
    ├── services/             # API/backend service layer
    ├── store/                # Zustand stores
    ├── styles/
    │   └── globals.css       # Global styles (Tailwind + shadcn CSS vars)
    ├── types/                # TypeScript type definitions
    └── utils/                # Helper functions
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
- [x] React 19 + TypeScript renderer with Vite
- [x] Tailwind CSS v4 with `@tailwindcss/postcss` plugin
- [x] shadcn/ui configured (components.json, cn() utility, CSS variables)
- [x] Light/dark theme via ThemeProvider (localStorage-persisted)
- [x] Lucide React icons (Sun, Moon in theme toggle)
- [x] Motion (motion/react) installed and ready
- [x] TanStack Query provider configured in App
- [x] Zustand installed and ready
- [x] React Router (BrowserRouter) configured in App
- [x] Basic UI components: Button (shadcn-style with variants)
- [x] Root layout with header and theme toggle
- [x] Feature folders (auth, chat, settings, memory, onboarding) scaffolded

### Not Yet Implemented
- [ ] Application-specific business logic
- [ ] IPC communication (preload script is empty)
- [ ] Feature implementations (auth, chat, settings, memory, onboarding)
- [ ] Tests
- [ ] CI/CD pipeline
- [ ] README / user documentation
- [ ] Store implementations (Zustand stores empty)

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
- **Commits:** 2 (SETUP: Initializing the application) [latest: `bddd03a`]
- **Last Updated:** 2026-07-14

---

## Notes

- shadcn/components are in `src/components/ui/` — add more via `npx shadcn@latest add <component-name>`
- The theme provider supports `light`, `dark`, and `system` modes with localStorage persistence
- Preload script is empty — no IPC bridge exposed to renderer yet
- No test framework is configured
- No `.env` or environment-specific files exist
