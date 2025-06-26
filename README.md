<p align="center">
  <img src="src/assets/logo.png" alt="Tokie Logo" width="200" />
</p>

# 🧠 Tokie — Know When ChatGPT Is Reaching Its Limit

Ever felt like ChatGPT was "forgetting" what you said earlier? Or giving weird, short, or off-topic answers? Chances are…
you ran out of tokens.

## 🧩 The Problem
ChatGPT has a limit on how much it can "remember" in a single conversation. It’s not about how long the chat looks — it’s about tokens. Tokens are chunks of words, and once a session reaches the limit (like 128,000 tokens for GPT-4), things start breaking:

- It stops remembering earlier parts of your chat.
- Answers get confusing or off-topic.
- You lose context, continuity, and quality.

The problem?
You never know when you're about to hit that limit.

## 🚀 The Solution: Tokie
Tokie is a lightweight browser extension that gives you real-time awareness of your token usage while chatting with ChatGPT.

Whether you’re a casual user or a power user writing long prompts, Tokie helps you stay in control.

## 🔍 What Tokie Does

- 🧮 **Live Token Tracker**: Displays how many tokens you've used in your current session.
- 💬 **Session-Aware**: Tracks usage per conversation window.
- 🧷 **Overlay Widget**: Floating progress bar that lives on your ChatGPT screen.
- 🧠 **Network Smart**: Intercepts ChatGPT traffic and intelligently calculates token usage, even for streamed responses.
- 🧪 **Accurate & Transparent**: Know the limits. Plan your prompts. Never be surprised again.

## 🧱 Project Structure
```
src/
  entrypoints/
    tracker/
      index.ts             # Main tracker logic
      networkInterceptor.ts# Network request capture
      tokenUsage.ts        # Token math + session context
      ui.tsx               # Widget mount logic
      Widget.tsx           # React token widget
      widget.css           # Styling
public/
  icon/                    # Extension icons
```

## ⚙️ Getting Started

### Requirements
- Node.js v20+
- npm or yarn

### Development
To build and run the extension in development mode:
```bash
npm install
npm run dev
```

### Production Build
To build the extension for production:
```bash
npm run build
```

### Load in Chrome
1. Build the project.
2. Visit `chrome://extensions`.
3. Enable "Developer Mode".
4. Click "Load unpacked" and choose the `dist` folder.

## 📊 Token Limits Table
| Model               | Token Limit      | Approx. Word Count |
|---------------------|------------------|---------------------|
| Free GPT-3.5        | ~16K tokens      | ~12K words          |
| GPT-4 (Free/Plus)   | ~128K tokens     | ~96K words          |
| GPT-4.1 (Plus/Pro)  | Up to 1M tokens  | ~750K words         |

## 🤝 Contribute
Pull requests are welcome! Have an idea to improve Tokie? Open an issue or start a discussion.

## 📄 License
[MIT](LICENSE)
