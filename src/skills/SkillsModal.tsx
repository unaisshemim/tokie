import React, { useEffect, useRef, useState, useCallback } from "react";
import { searchSkillsDirectory, getSkillBodyForHit } from "./skillsRegistry";
import { stripFrontmatter } from "./frontmatter";
import { injectSkillText } from "./injector";
import type { SkillsShHit } from "./messages";

interface SkillsModalProps {
  onClose: () => void;
}

function ShimmerLoader() {
  return (
    <>
      <style>{`
        @keyframes tokie-shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>
      <div
        style={{
          display: "grid",
          gap: 10,
          width: "100%",
          padding: 6,
        }}
      >
        {Array.from({ length: 5 }).map((_, idx) => (
          <div
            key={idx}
            style={{
              position: "relative",
              overflow: "hidden",
              borderRadius: 12,
              border: "1px solid #eef1f6",
              background: "#f7f9fc",
              padding: "12px 14px",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                transform: "translateX(-100%)",
                background:
                  "linear-gradient(90deg, rgba(255,255,255,0) 20%, rgba(255,255,255,0.85) 50%, rgba(255,255,255,0) 80%)",
                animation: "tokie-shimmer 1.35s ease-in-out infinite",
              }}
            />
            <div
              style={{
                width: idx % 2 === 0 ? "42%" : "55%",
                height: 11,
                borderRadius: 999,
                background: "#e2e8f0",
                marginBottom: 9,
              }}
            />
            <div
              style={{
                width: "72%",
                height: 9,
                borderRadius: 999,
                background: "#edf2f8",
              }}
            />
          </div>
        ))}
      </div>
    </>
  );
}

export const SkillsModal: React.FC<SkillsModalProps> = ({ onClose }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SkillsShHit[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [inserting, setInserting] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => searchRef.current?.focus(), 10);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    setSearchError(null);
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void searchSkillsDirectory(q)
        .then((hits) => {
          if (!cancelled) setResults(hits);
        })
        .catch((e) => {
          if (!cancelled) {
            setResults([]);
            setSearchError(e instanceof Error ? e.message : String(e));
          }
        })
        .finally(() => {
          if (!cancelled) setSearchLoading(false);
        });
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query, results.length]);

  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(
      `[data-idx="${activeIdx}"]`,
    );
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIdx, results.length]);

  const handleSelect = useCallback(
    async (hit: SkillsShHit) => {
      if (inserting) return;
      setInserting(hit.id);
      setToast(null);
      try {
        const raw = await getSkillBodyForHit(hit);
        const body = stripFrontmatter(raw).trim();
        const res = injectSkillText(body);
        if (!res.ok) {
          setToast(
            res.reason === "no_composer"
              ? "Could not find the chat input on this page."
              : "Failed to insert into the chat input."
          );
          setInserting(null);
          return;
        }
        onClose();
      } catch (e) {
        setToast(e instanceof Error ? e.message : String(e));
        setInserting(null);
      }
    },
    [inserting, onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, Math.max(0, results.length - 1)));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const hit = results[activeIdx];
        if (hit) void handleSelect(hit);
      }
    },
    [
      activeIdx,
      results,
      handleSelect,
      onClose,
    ],
  );

  const q = query.trim();
  const showTooShort = q.length > 0 && q.length < 2;
  const showEmpty =
    q.length >= 2 && !searchLoading && results.length === 0 && !searchError;

  return (
    <div
      onMouseDown={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.16)",
        zIndex: 2147483647,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "10vh",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
      onKeyDown={handleKeyDown}
      onKeyUp={(e) => e.stopPropagation()}
      onKeyPress={(e) => e.stopPropagation()}
    >
      <div
        role="dialog"
        aria-label="Insert agent skill"
        style={{
          width: "min(640px, 92vw)",
          maxHeight: "75vh",
          display: "flex",
          flexDirection: "column",
          background: "#ffffff",
          color: "#0f172a",
          border: "1px solid #e6ebf2",
          borderRadius: 14,
          boxShadow: "0 26px 70px rgba(15, 23, 42, 0.18)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid #eef1f6",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <img
            src={browser.runtime.getURL(
              "icon/96.png" as Parameters<typeof browser.runtime.getURL>[0]
            )}
            alt="Tokie"
            width={28}
            height={28}
            style={{ display: "block", borderRadius: 7 }}
          />
          <span style={{ fontSize: 14, fontWeight: 600, color: "#334155" }}>
            Tokie · Skills
          </span>
          <a
            href="https://tokie.space"
            target="_blank"
            rel="noreferrer"
            style={{ color: "#2563eb", fontSize: 12, textDecoration: "none" }}
          >
            tokie.space
          </a>
          <span
            style={{
              fontSize: 11,
              color: "#64748b",
              padding: "2px 8px",
              borderRadius: 999,
              border: "1px solid #e3e8ef",
              background: "#f8fafc",
            }}
          >
            skills.sh
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              marginLeft: "auto",
              background: "#f8fafc",
              color: "#475569",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: "4px 10px",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Esc
          </button>
        </div>

        <div style={{ padding: 12, borderBottom: "1px solid #eef1f6" }}>
          <input
            ref={searchRef}
            type="text"
            placeholder="Search skills.sh (2+ characters)…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "11px 12px",
              borderRadius: 11,
              border: "1px solid #dbe3ed",
              background: "#f8fafc",
              color: "#0f172a",
              outline: "none",
              fontSize: 14,
            }}
          />
        </div>

        <div
          ref={listRef}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 8,
            minHeight: 120,
            position: "relative",
          }}
        >
          {searchLoading && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 3,
                background: "rgba(255,255,255,0.82)",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "stretch",
                borderRadius: 8,
                pointerEvents: "none",
                padding: 8,
              }}
            >
              <ShimmerLoader />
            </div>
          )}
          {showTooShort && (
            <div
              style={{
                padding: 24,
                textAlign: "center",
                color: "#64748b",
                fontSize: 13,
              }}
            >
              Enter at least <strong>2 characters</strong> — searches use the
              same directory as{" "}
              <a
                href="https://skills.sh"
                target="_blank"
                rel="noreferrer"
                style={{ color: "#2563eb" }}
              >
                skills.sh
              </a>
              .
            </div>
          )}
          {!showTooShort && q.length === 0 && (
            <div
              style={{
                padding: 24,
                textAlign: "center",
                color: "#64748b",
                fontSize: 13,
              }}
            >
              Type a keyword (e.g. <strong>dotnet</strong>,{" "}
              <strong>react</strong>) to search the public skills directory.
            </div>
          )}
          {searchError && (
            <div style={{ padding: 24, textAlign: "center", color: "#dc2626" }}>
              {searchError}
            </div>
          )}
          {showEmpty && (
            <div
              style={{
                padding: 24,
                textAlign: "center",
                color: "#64748b",
                fontSize: 13,
              }}
            >
              No skills match &quot;{query.trim()}&quot; on skills.sh.
            </div>
          )}
          {results.map((hit, idx) => {
            const isActive = idx === activeIdx;
            const isIns = inserting === hit.id;
            return (
              <div
                key={hit.id}
                data-idx={idx}
                onMouseEnter={() => setActiveIdx(idx)}
                onClick={() => void handleSelect(hit)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  cursor: "pointer",
                  background: isActive ? "#f4f8ff" : "transparent",
                  border: isActive
                    ? "1px solid #cfe0ff"
                    : "1px solid transparent",
                  marginBottom: 4,
                  opacity: isIns ? 0.6 : 1,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 600 }}>
                    {hit.name}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: "#64748b",
                      padding: "1px 8px",
                      borderRadius: 6,
                      background: "#eef3fa",
                    }}
                  >
                    {hit.installs.toLocaleString()} installs
                  </span>
                  {isIns && (
                    <span style={{ fontSize: 11, color: "#2563eb" }}>
                      inserting…
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#64748b",
                    marginTop: 4,
                    lineHeight: 1.4,
                  }}
                >
                  <code style={{ fontSize: 11 }}>{hit.source}</code>
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            padding: "10px 14px",
            borderTop: "1px solid #eef1f6",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            fontSize: 11,
            color: "#64748b",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <span>
              ↑ ↓ navigate · Enter insert · Esc close
            </span>
            {toast && <span style={{ color: "#dc2626" }}>{toast}</span>}
          </div>
          <div style={{ lineHeight: 1.45 }}>
            Search matches the public{" "}
            <a
              href="https://skills.sh"
              target="_blank"
              rel="noreferrer"
              style={{ color: "#475569" }}
            >
              skills.sh
            </a>{" "}
            index; skill text is loaded from GitHub (
            <code>skills/…/SKILL.md</code>
            ).
          </div>
        </div>
      </div>
    </div>
  );
};
