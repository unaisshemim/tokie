<p align="center">
  <img src="src/assets/logo.png" alt="Tokie Logo" width="200" />
</p>

<h1 align="center">🧠 <span style="color:#4CAF50">Tokie</span> — <span style="color:#FF5722">Know When ChatGPT Is Reaching Its Limit</span></h1>

<p align="center">
  <em>Ever felt like ChatGPT was "forgetting" what you said earlier? Or giving weird, short, or off-topic answers? Chances are…<br>
  <strong style="color:#FF9800">you ran out of tokens.</strong></em>
</p>

---

## 🧩 <span style="color:#2196F3">The Problem</span>
ChatGPT has a limit on how much it can "remember" in a single conversation. It’s not about how long the chat looks — it’s about tokens. Tokens are chunks of words, and once a session reaches the limit (like 128,000 tokens for GPT-4), things start breaking:

- ❌ <span style="color:#F44336">It stops remembering earlier parts of your chat.</span>
- ❌ <span style="color:#F44336">Answers get confusing or off-topic.</span>
- ❌ <span style="color:#F44336">You lose context, continuity, and quality.</span>

The problem?
You never know when you're about to hit that limit.

---

## 🚀 <span style="color:#4CAF50">The Solution: Tokie</span>
Tokie is a lightweight browser extension that gives you real-time awareness of your token usage while chatting with ChatGPT.

Whether you’re a casual user or a power user writing long prompts, Tokie helps you stay in control.

---

## 🔍 <span style="color:#FF9800">What Tokie Does</span>

- 🧮 **<span style="color:#4CAF50">Live Token Tracker</span>**: Displays how many tokens you've used in your current session.
- 💬 **<span style="color:#2196F3">Session-Aware</span>**: Tracks usage per conversation window.
- 🧷 **<span style="color:#FF5722">Overlay Widget</span>**: Floating progress bar that lives on your ChatGPT screen.
- 🧠 **<span style="color:#9C27B0">Network Smart</span>**: Intercepts ChatGPT traffic and intelligently calculates token usage, even for streamed responses.
- 🧪 **<span style="color:#FFC107">Accurate & Transparent</span>**: Know the limits. Plan your prompts. Never be surprised again.

---
## 📊 <span style="color:#4CAF50">Token Limits Table</span>
| Model               | Token Limit      | Approx. Word Count |
|---------------------|------------------|---------------------|
| Free GPT-3.5        | ~16K tokens      | ~12K words          |
| GPT-4 (Free/Plus)   | ~128K tokens     | ~96K words          |
| GPT-4.1 (Plus/Pro)  | Up to 1M tokens  | ~750K words         |

---


## ⚙️ <span style="color:#FF5722">Getting Started</span>

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

---


## 🤝 <span style="color:#2196F3">Contribute</span>
Pull requests are welcome! Have an idea to improve Tokie? Open an issue or start a discussion.

---

## 📄 <span style="color:#FF9800">License</span>
[MIT](LICENSE)
