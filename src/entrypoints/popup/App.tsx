import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [tokens, setTokens] = useState(0);
  const [model, setModel] = useState("GPT-4 (Plus)");
  const limit = 140000;

  const getStatusColor = (tokens: number) => {
    if (tokens > limit * 0.9) return "#e74c3c"; // red
    if (tokens > limit * 0.6) return "#f39c12"; // orange
    return "#2ecc71"; // green
  };

  const getStatusText = (tokens: number) => {
    if (tokens > limit * 0.9) return "⚠️ Critical: Start a new chat!";
    if (tokens > limit * 0.6) return "🔶 Moderate: Consider restarting";
    return "✅ Safe: Continue chatting";
  };

  useEffect(() => {
    // Receive token data from content script (assuming it sends messages)
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === "TOKENS_UPDATE") {
        setTokens(message.tokens);
      }
      return true;
    });
  }, []);

  const handleRefresh = () => {
    chrome.runtime.sendMessage({ type: "REQUEST_TOKEN_COUNT" });
  };

  return (
    <div className="popup-container">
      <h2>🧠 ChatGPT Token Tracker</h2>

      <div className="info">
        <p>
          <strong>Model:</strong> {model}
        </p>
        <p>
          <strong>Token Limit:</strong> {limit.toLocaleString()}
        </p>
      </div>

      <div className="progress-container">
        <div
          className="progress-bar"
          style={{
            width: `${(tokens / limit) * 100}%`,
            background: getStatusColor(tokens),
          }}
        />
      </div>

      <div className="token-count">
        <strong>{tokens.toLocaleString()}</strong> tokens used
      </div>

      <p className="status">{getStatusText(tokens)}</p>

      <button className="refresh-btn" onClick={handleRefresh}>
        🔄 Refresh
      </button>
    </div>
  );
}

export default App;
