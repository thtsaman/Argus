"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader, SectionHeader } from "@/components/ui/common";

interface Message {
  role: "user" | "assistant";
  content: string;
  error?: string;
}

const SUGGESTED_QUERIES = [
  "Why are these entities connected?",
  "Which entity connects separate groups?",
  "What should be reviewed next?",
  "Summarize the evidence in this investigation.",
];

export default function AssistantPage() {
  const { id } = useParams<{ id: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const sendQuery = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setQuery("");

    try {
      const res = await fetch(`/api/investigations/${id}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
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
    <div className="max-w-[900px] mx-auto px-6 py-8">
      <PageHeader
        title="Investigation assistant"
        description="Evidence-grounded analysis. Responses are based on retrieved investigation data, not unrestricted knowledge."
      />

      <div className="surface-elevated min-h-[400px] flex flex-col">
        <div className="flex-1 p-4 space-y-4 overflow-y-auto max-h-[500px]">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <p className="text-sm text-text-muted mb-4">Ask questions about this investigation</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {SUGGESTED_QUERIES.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendQuery(q)}
                    className="text-xs px-3 py-1.5 border border-border rounded hover:border-border-strong transition-colors"
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
              className={`p-3 rounded ${
                msg.role === "user" ? "bg-surface ml-12" : "bg-background mr-12 border border-border"
              }`}
            >
              <p className="text-xs text-text-muted mb-1">{msg.role === "user" ? "You" : "Assistant"}</p>
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              {msg.error && (
                <p className="text-xs text-status-review mt-1">Note: {msg.error}</p>
              )}
            </div>
          ))}
          {loading && <p className="text-sm text-text-muted">Analyzing investigation context...</p>}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); sendQuery(query); }}
          className="border-t border-border p-4 flex gap-2"
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask about evidence, relationships, or connections..."
            className="flex-1 text-sm border border-border rounded px-3 py-2 bg-surface"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="text-sm px-4 py-2 bg-accent text-surface-elevated rounded hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
