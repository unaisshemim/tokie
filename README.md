# Tokie

Tokie is a browser extension that injects searchable agent skills into ChatGPT and Claude composers.

It adds a floating launcher to supported chat pages, searches the public [skills.sh](https://skills.sh) directory, loads the selected skill text from GitHub, asks for a few task-specific details, and inserts the resulting prompt into the active composer.

## Features

- Search public skills from `skills.sh` without leaving ChatGPT or Claude.
- Fetch `SKILL.md` content from the skill source repository on GitHub.
- Cache fetched skill bodies locally for 24 hours.
- Add task context before insertion with a short three-question flow.
- Insert into textarea, input, contenteditable, and ProseMirror-style composers.
- Open the skills modal from either the floating launcher or the extension action.

## Supported Sites

- `https://chatgpt.com/*`
- `https://chat.openai.com/*`
- `https://claude.ai/*`
- `https://*.claude.ai/*`

## How It Works

1. Open ChatGPT or Claude with the extension installed.
2. Click the Tokie floating launcher in the bottom-right corner, or click the browser extension action.
3. Search for a skill by keyword.
4. Select a result.
5. Answer the follow-up prompts:
   - What are you trying to build or do?
   - What issue or error are you facing?
   - Share any important context or constraints.
6. Tokie inserts the skill content plus your details into the chat composer.

Keyboard shortcuts inside the modal:

- `ArrowUp` / `ArrowDown`: move through search results
- `Enter`: select the active search result
- `Esc`: close the modal, or cancel the question flow
- `Ctrl+Enter` / `Cmd+Enter`: advance through questions or insert the skill

## Development

### Requirements

- Node.js 20+
- npm

### Install

```bash
npm install
```

### Run Locally

```bash
npm run dev
```

For Firefox:

```bash
npm run dev:firefox
```

WXT will print the browser-specific extension output path. Load that unpacked extension in your browser's extension developer mode.

### Type Check

```bash
npm run compile
```

### Build

```bash
npm run build
```

For Firefox:

```bash
npm run build:firefox
```

### Package

```bash
npm run zip
```

For Firefox:

```bash
npm run zip:firefox
```

## Project Structure

```text
src/
  entrypoints/
    background.ts      Background service worker, action handling, skills.sh search, GitHub fetches
    content.ts         Content script that mounts the launcher and listens for modal messages
  skills/
    SkillsModal.tsx    Search UI and follow-up question flow
    floatingLauncher.ts
    injector.ts        Composer detection and text insertion
    skillsRegistry.ts  Content-script API for skill search and fetch messages
    messages.ts        Shared runtime message types
  platform.ts          ChatGPT and Claude composer selector configuration
wxt.config.ts          WXT manifest, permissions, aliases, and Vite configuration
```

## Permissions

Tokie requests:

- `storage`: caches fetched skill bodies locally.
- `activeTab`: toggles the modal on the active supported chat tab.
- Host access for ChatGPT, Claude, `skills.sh`, and GitHub raw content.

## Notes

- Search results come from `https://skills.sh/api/search`.
- Skill content is resolved from GitHub repositories using common `SKILL.md`, `skill.md`, and `README.md` paths, with a repository-tree fallback.
- If the extension action is clicked outside a supported site, Tokie opens `https://chatgpt.com`.
