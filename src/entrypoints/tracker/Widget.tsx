import React, { useState, useEffect } from "react";
import { TokenUsage } from "./tokeUsage";
import HappyCat from "../../assets/happyCat.png";
import SadCat from "../../assets/sadCat.png";
import SleepingCat from "../../assets/sleepingCat.png";
import "./widget.css";

interface WidgetProps {
  usage: TokenUsage;
  onReset: () => void;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export const Widget: React.FC<WidgetProps> = ({ usage, onReset }) => {
  const [hovered, setHovered] = useState(false);
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
    ((usage.inputTokens + usage.outputTokens) / usage.maxTokens) * 100,
    100
  );

  const currentImage =
    progressPercentage >= 100
      ? SleepingCat
      : progressPercentage >= 50
      ? SadCat
      : HappyCat;

  return (
    <div
      className="token-tracker-float-container"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: "fixed", right: 20, bottom: 20, zIndex: 999999 }}
    >
      <img
        src={currentImage}
        alt="Tokie Logo"
        className="token-tracker-logo-float"
        style={{
          cursor: "pointer",
          background: "none",
          borderRadius: 0,
          boxShadow: "none",
          width: 90,
          height: 90,
          padding: 0,
        }}
      />
      {hovered && (
        <div
          className="token-tracker-widget-float-details"
          style={{
            position: "absolute",
            bottom: "100%" /* Position the hover window on top */,
            right: "0" /* Fix syntax error */,
            marginBottom:
              "10px" /* Add some spacing between the image and the hover window */,
            animation: "fadeIn 0.3s ease-in-out" /* Add fade-in animation */,
          }}
        >
          <div className="widget-header">
            <span className="widget-title">Token Usage</span>
          </div>
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
                {(usage.inputTokens + usage.outputTokens).toLocaleString()} /{" "}
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
              <button onClick={onReset}>Reset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
