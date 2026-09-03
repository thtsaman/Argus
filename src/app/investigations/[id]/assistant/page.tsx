"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/common";

interface Message {
  role: "user" | "assistant";
  content: string;
  error?: string;
  sources?: { title: string; id?: string }[];
}

export default function AssistantPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const contextType = searchParams.get("contextType");
  const contextId = searchParams.get("contextId");
  const contextLabel = searchParams.get("contextLabel");

  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const getSuggestedQueries = () => {
    if (contextType === "ENTITY") {
      return [
        `Why does ${contextLabel || "this entity"} matter?`,
        `What evidence connects ${contextLabel || "this entity"}?`,
        `What facts are unverified for ${contextLabel || "this entity"}?`,
      ];
    }
    if (contextType === "RELATIONSHIP") {
      return [
        `Explain the relationship: ${contextLabel || "this connection"}.`,
        `What direct evidence supports ${contextLabel || "this connection"}?`,
        `Why is this relationship under review?`,
      ];
    }
    if (contextType === "LEAD") {
      return [
        `Why was lead "${contextLabel || "this lead"}" surfaced?`,
        `What evidence supports this lead?`,
        `What information gap exists for this lead?`,
      ];
    }
    return [
      "Why are these entities connected?",
      "Which entity connects separate groups?",
      "What should be reviewed next?",
      "Summarize the evidence in this investigation.",
    ];
  };

  const sendQuery = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setQuery("");

    const payload = {
      query: q,
      focusContext: contextType
        ? {
            type: contextType,
            id: contextId,
            label: contextLabel,
          }
        : null,
    };

    try {
      const res = await fetch(`/api/investigations/${id}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.response || "No response generated.",
          error: data.error,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Failed to process query.", error: "Network error" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[900px] mx-auto px-6 py-8 space-y-6">
      <PageHeader
        title="Investigation Assistant"
        description="Evidence-grounded analysis. Answers are strictly based on retrieved investigation data and facts."
      />

      {/* Context Focus Bar */}
      {contextType && (
        <div className="surface-elevated p-3 rounded-lg border border-accent/40 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase text-accent font-semibold px-2.5 py-1 border border-accent/30 rounded bg-accent/10">
              Context: {contextLabel || contextId}
            </span>
            {contextType !== "ENTITY" && (
              <span className="text-[10px] text-text-muted font-mono uppercase">({contextType})</span>
            )}
          </div>
          <a
            href={`/investigations/${id}/assistant`}
            className="text-[11px] px-2.5 py-1 text-text-muted hover:text-foreground border border-border rounded hover:bg-background transition-colors"
          >
            Clear Focus
          </a>
        </div>
      )}

      {/* Chat Container */}
      <div className="surface-elevated rounded-lg border border-border min-h-[450px] flex flex-col overflow-hidden shadow-2xs">
        <div className="flex-1 p-4 space-y-4 overflow-y-auto max-h-[520px]">
          {messages.length === 0 && (
            <div className="text-center py-12 space-y-4">
              <p className="text-xs text-text-muted">
                {contextType
                  ? `Ask ARGUS about focus item: ${contextLabel}`
                  : "Ask questions grounded strictly in this investigation's evidence."}
              </p>

              <div className="flex flex-wrap gap-2 justify-center max-w-xl mx-auto">
                {getSuggestedQueries().map((q) => (
                  <button
                    key={q}
                    onClick={() => sendQuery(q)}
                    className="text-xs px-3 py-1.5 bg-background border border-border rounded hover:border-accent text-text-secondary hover:text-foreground transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`p-4 rounded-lg space-y-2 text-xs leading-relaxed ${
                msg.role === "user"
                  ? "bg-accent/10 border border-accent/30 ml-12 text-foreground font-medium"
                  : "bg-background mr-12 border border-border shadow-2xs"
              }`}
            >
              <div className="flex justify-between items-center text-[10px] text-text-muted font-mono">
                <span>{msg.role === "user" ? "Investigator Query" : "ARGUS Assistant (Grounded)"}</span>
              </div>
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.error && <p className="text-[11px] text-status-review mt-1 font-mono">Note: {msg.error}</p>}
            </div>
          ))}

          {loading && (
            <div className="p-3 bg-background rounded border border-border text-xs text-text-muted flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
              <span>Analyzing retrieved investigation context...</span>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendQuery(query);
          }}
          className="border-t border-border p-4 flex gap-2 bg-surface"
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              contextType
                ? `Ask about ${contextLabel}...`
                : "Ask about evidence, entities, relationships, or leads..."
            }
            className="flex-1 text-xs border border-border rounded px-3 py-2 bg-background focus:border-accent"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="text-xs py-2 px-4 bg-accent text-surface-elevated rounded font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
