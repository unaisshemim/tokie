import React, { useState, useEffect, JSX } from "react";
import HappyCat from "../../assets/happyCat.png";
import SadCat from "../../assets/sadCat.png";
import SleepingCat from "../../assets/sleepingCat.png";
import "@/assets/tailwind.css";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import { RateLimitInfo, formatTimeUntilReset } from "./rateLimits";

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  maxTokens: number;
  sessionStart: number;
  planType?: "free" | "plus" | "pro";
  rateLimit?: RateLimitInfo;
  isDowngraded?: boolean;
  actualModel?: string;
  displayedModel?: string;
}
interface WidgetProps {
  usage: TokenUsage;
  onReset: () => void;
}

type FloatingType = "heart" | "bubble" | "smoke";

export const Widget: React.FC<WidgetProps> = ({ usage, onReset }) => {
  // const [currentUsage, setCurrentUsage] = useState<TokenUsage>(defaultUsage);

  const [sessionAge, setSessionAge] = useState(
    formatDuration(Date.now() - usage.sessionStart)
  );

  const [floatingItems, setFloatingItems] = useState<JSX.Element[]>([]);

  // 🟡 Live update time display
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionAge(formatDuration(Date.now() - usage.sessionStart));
    }, 1000);
    return () => clearInterval(interval);
  }, [usage.sessionStart]);

  const usedTokens = usage.inputTokens + usage.outputTokens;
  const progressPercentage = Math.min(
    (usedTokens / usage.maxTokens) * 100,
    150
  );

  // Update image based on token usage and rate limit status
  const getCurrentImage = () => {
    if (usage.isDowngraded) return SadCat;
    if (usage.rateLimit?.isExceeded) return SadCat;
    if (progressPercentage >= 100) return SleepingCat;
    if (progressPercentage >= 50) return SadCat;
    return HappyCat;
  };

  const currentImage = getCurrentImage();

  const getProgressColor = (percentage: number) => {
    if (usage.isDowngraded || usage.rateLimit?.isExceeded) return "#ef4444"; // Red for downgrade/rate limit
    if (percentage > 100) return "#ef4444"; // Red
    if (percentage > 75) return "#f59e0b"; // Orange
    return "#10b981"; // Green
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setSessionAge(formatDuration(Date.now() - usage.sessionStart));
    }, 1000);
    return () => clearInterval(interval);
  }, [usage.sessionStart]);

  useEffect(() => {}, [usage.outputTokens]);

  return (
    <div className="group fixed right-5 bottom-5 z-[999999]">
      <div className="relative flex flex-col items-center">
        {/* Progress bar */}
        <div className="w-24 h-4 bg-gray-200 rounded-full mb-1 relative">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(progressPercentage, 100)}%`,
              backgroundColor: getProgressColor(progressPercentage),
            }}
          ></div>

          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 text-[10px] font-medium text-gray-700">
            {Math.round(progressPercentage)}%
          </div>
        </div>

        {/* Trigger Image */}
        <img
          src={currentImage}
          alt="Tokie Logo"
          className="w-[90px] h-[90px] cursor-pointer"
        />
        {floatingItems}

        {/* Hover Card */}
        <div className="absolute bottom-full mb-2 right-0 w-60 rounded-xl shadow-lg bg-white p-4 border border-gray-200 z-10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
          <span className="text-sm font-semibold text-gray-800 mb-2 block">
            Token Usage
          </span>

          <div className="w-20 h-20 mx-auto mb-2">
            <CircularProgressbar
              value={progressPercentage}
              maxValue={100}
              text={`${Math.round(progressPercentage)}%`}
              styles={buildStyles({
                pathColor: getProgressColor(progressPercentage),
                textColor: "#374151",
                trailColor: "#e5e7eb",
                textSize: "16px",
              })}
            />
          </div>

          <div className="text-xs text-center text-gray-600 mb-1">
            Used: {usedTokens.toLocaleString()}
          </div>
          <div className="text-xs text-center text-gray-600 mb-2">
            Max: {usage.maxTokens.toLocaleString()}
          </div>

          {/* Plan Type Display */}
          {usage.planType && (
            <div className="text-[10px] text-center text-gray-500 mb-2">
              Plan:{" "}
              <span className="font-semibold capitalize">{usage.planType}</span>
            </div>
          )}

          {/* Model Downgrade Warning */}
          {usage.isDowngraded && (
            <div className="mb-2 p-2 bg-orange-50 border border-orange-200 rounded text-[10px]">
              <div className="font-semibold text-orange-800 mb-1">
                ⚠️ Model Downgraded
              </div>
              <div className="text-orange-700">
                {usage.displayedModel && (
                  <div>Showing: {usage.displayedModel}</div>
                )}
                {usage.actualModel && (
                  <div>Actually using: {usage.actualModel}</div>
                )}
              </div>
            </div>
          )}

          {/* Rate Limit Status */}
          {usage.rateLimit && (
            <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded text-[10px]">
              <div className="font-semibold text-blue-800 mb-1">Rate Limit</div>
              <div className="text-blue-700">
                <div>
                  Messages: {usage.rateLimit.used} / {usage.rateLimit.limit}
                </div>
                <div>Remaining: {usage.rateLimit.remaining}</div>
                {usage.rateLimit.isExceeded ? (
                  <div className="text-red-600 font-semibold mt-1">
                    Limit exceeded
                  </div>
                ) : (
                  <div className="text-gray-600 mt-1">
                    Resets in: {formatTimeUntilReset(usage.rateLimit.resetTime)}
                  </div>
                )}
              </div>
            </div>
          )}

          <button
            onClick={onReset}
            className="w-full px-3 py-1 text-xs rounded bg-amber-400 hover:bg-amber-500 text-white font-medium"
          >
            Reset Usage
          </button>
        </div>
      </div>
    </div>
  );
};

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
