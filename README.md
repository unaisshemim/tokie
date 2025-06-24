<p align="center">
  <img src="src/assets/logo.png" alt="Tokie Logo" width="120" />
</p>

# Tokie: ChatGPT Token Usage Tracker

Tokie is a browser extension designed to track and visualize your token usage while interacting with ChatGPT. It provides real-time feedback on your token consumption, helping you monitor and manage your usage efficiently.

## Features
- **Token Usage Tracking:** Monitors tokens used in each ChatGPT session.
- **Session Management:** Tracks usage per session with unique session IDs.
- **Live Widget:** Displays a widget overlay with current token usage.
- **Network Interception:** Intercepts network requests to extract token data.
- **Stream Handling:** Handles streaming responses for accurate, real-time updates.

## Project Structure
```
src/
  entrypoints/
    tracker/
      index.ts            # Main tracker logic
      networkInterceptor.ts # Network interception utilities
      tokeUsage.ts        # Token usage logic and session management
      ui.tsx              # Widget UI logic
      Widget.tsx          # Widget React component
      widget.css          # Widget styles
  ...
public/
  icon/                  # Extension icons
  ...
```

## Getting Started

### Prerequisites
- Node.js (v20+ recommended)
- npm or yarn




### Development
To build and run the extension in development mode:
```sh
npm run dev
```

### Build
To build the extension for production:
```sh
npm run build
```

### Load Extension in Browser
1. Build the project.
2. Open your browser's extensions page (e.g., `chrome://extensions/`).
3. Enable "Developer mode".
4. Click "Load unpacked" and select the `dist` or `build` directory.

## Contributing
Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

## License
[MIT](LICENSE)
