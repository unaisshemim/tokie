import React, { useState, useEffect } from "react";
import { TokenUsage } from "./tokeUsage";
import "./widget.css";

interface WidgetProps {
  usage: TokenUsage;
  onReset: () => void;
  onNewSession: () => void;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export const Widget: React.FC<WidgetProps> = ({
  usage,
  onReset,
  onNewSession,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [sessionAge, setSessionAge] = useState(
    formatDuration(Date.now() - usage.sessionStart)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setSessionAge(formatDuration(Date.now() - usage.sessionStart));
    }, 1000);
    return () => clearInterval(interval);
  }, [usage.sessionStart]);

  const progressPercentage = Math.min(
    (usage.totalTokens / usage.maxTokens) * 100,
    100
  );

  return (
    <div
      className="token-tracker-widget"
      style={{ position: "fixed", right: 20, bottom: 20, zIndex: 999999 }}
    >
      <div className="widget-header">
        <span className="widget-title">Token Usage</span>
        <button
          className="widget-toggle"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? "+" : "−"}
        </button>
      </div>
      {!collapsed && (
        <div className="widget-content">
          <div className="progress-container">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${progressPercentage}%`,
                  backgroundColor:
                    progressPercentage > 90
                      ? "#ef4444"
                      : progressPercentage > 70
                      ? "#f59e0b"
                      : "#10b981",
                }}
              ></div>
            </div>
            <span className="progress-text">
              {usage.totalTokens.toLocaleString()} /{" "}
              {usage.maxTokens.toLocaleString()}
            </span>
          </div>

          <div className="token-details">
            <div className="token-row">
              <span>Input:</span>
              <span>{usage.inputTokens.toLocaleString()}</span>
            </div>
            <div className="token-row">
              <span>Output:</span>
              <span>{usage.outputTokens.toLocaleString()}</span>
            </div>
            <div className="token-row">
              <span>Session:</span>
              <span>{sessionAge}</span>
            </div>
            {usage.syncing && <div className="sync-status">Syncing...</div>}
          </div>

          <div className="widget-actions">
            <button onClick={onNewSession}>New Session</button>
            <button onClick={onReset}>Reset</button>
          </div>
        </div>
      )}
    </div>
  );
};
