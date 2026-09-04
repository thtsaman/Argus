"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  error?: string | null;
}

interface ContextualChatWidgetProps {
  investigationId: string;
  contextType: string;
  contextId: string;
  contextLabel: string;
  onClose: () => void;
}

export function ContextualChatWidget({
  investigationId,
  contextType,
  contextId,
  contextLabel,
  onClose,
}: ContextualChatWidgetProps) {
  const router = useRouter();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadOrCreateConversation() {
      setInitLoading(true);
      try {
        const res = await fetch(
          `/api/investigations/${investigationId}/conversations?contextType=${contextType}&contextId=${contextId}`
        );
        const data = await res.json();
        if (isMounted) {
          if (data.conversations && data.conversations.length > 0) {
            const latest = data.conversations[0];
            setConversationId(latest.id);
            setMessages(latest.messages || []);
          } else {
            // Create new conversation for this context
            const createRes = await fetch(`/api/investigations/${investigationId}/conversations`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contextType,
                contextId,
                contextLabel,
                title: `${contextLabel} Chat`,
              }),
            });
            const createData = await createRes.json();
            if (createData.conversation) {
              setConversationId(createData.conversation.id);
              setMessages([]);
            }
          }
        }
      } catch {
        console.error("Failed to load contextual chat");
      } finally {
        if (isMounted) setInitLoading(false);
      }
    }
    loadOrCreateConversation();
    return () => {
      isMounted = false;
    };
  }, [investigationId, contextType, contextId, contextLabel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;

    let activeId = conversationId;
    setLoading(true);

    const userMsgId = `user-${Date.now()}`;
    const tempUserMsg: Message = { id: userMsgId, role: "user", content: trimmed };
    setMessages((prev) => [...prev, tempUserMsg]);
    setQuery("");

    try {
      if (!activeId) {
        const createRes = await fetch(`/api/investigations/${investigationId}/conversations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contextType,
            contextId,
            contextLabel,
            title: `${contextLabel} Chat`,
          }),
        });
        const createData = await createRes.json();
        if (createData.conversation) {
          activeId = createData.conversation.id;
          setConversationId(activeId);
        } else {
          throw new Error(createData.error || "Failed to start thread");
        }
      }

      const res = await fetch(
        `/api/investigations/${investigationId}/conversations/${activeId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: trimmed }),
        }
      );
      const data = await res.json();
      if (data.userMessage && data.assistantMessage) {
        setMessages((prev) => [
          ...prev.map((m) => (m.id === userMsgId ? data.userMessage : m)),
          data.assistantMessage,
        ]);
      } else {
        throw new Error(data.error || "Failed to get response");
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "Failed to process query. You can retry your message.",
          error: err.message || "Network Error",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const getSuggestedQueries = () => {
    if (contextType === "ENTITY") {
      return [
        "Why does this entity matter?",
        "What evidence supports this entity?",
        "What are its strongest connections?",
        "What is still uncertain about this entity?",
      ];
    }
    return [
      "Explain this connection.",
      "What evidence supports this?",
      "What is unverified?",
    ];
  };

  const handleOpenFullAssistant = () => {
    if (conversationId) {
      router.push(
        `/investigations/${investigationId}/assistant?conversationId=${conversationId}&contextType=${contextType}&contextId=${contextId}&contextLabel=${encodeURIComponent(contextLabel)}`
      );
    } else {
      router.push(
        `/investigations/${investigationId}/assistant?contextType=${contextType}&contextId=${contextId}&contextLabel=${encodeURIComponent(contextLabel)}`
      );
    }
  };

  return (
    <div className="fixed bottom-6 right-6 w-96 max-w-[calc(100vw-2rem)] h-[520px] surface-elevated rounded-xl border border-accent/40 shadow-2xl flex flex-col overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
      {/* Header */}
      <div className="bg-surface p-3 border-b border-border flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <h4 className="font-serif font-semibold text-xs text-foreground">ARGUS Copilot</h4>
          </div>
          <p className="text-[10px] text-accent font-mono mt-0.5 truncate max-w-[240px]">
            Context: {contextLabel}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleOpenFullAssistant}
            className="text-[10px] px-2 py-0.5 border border-border rounded bg-background hover:bg-surface text-text-secondary hover:text-foreground transition-colors"
            title="Open in Full Assistant Page"
          >
            Full View ↗
          </button>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-foreground text-xs p-1 rounded transition-colors"
            title="Close Assistant Copilot"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Message List */}
      <div className="flex-1 p-3 space-y-3 overflow-y-auto bg-background/50 text-xs">
        {initLoading ? (
          <div className="text-center py-12 text-text-muted">Loading context history...</div>
        ) : messages.length === 0 ? (
          <div className="space-y-3 py-4 text-center">
            <p className="text-[11px] text-text-muted">
              Ask ARGUS questions grounded in evidence for <span className="font-semibold text-foreground">{contextLabel}</span>.
            </p>
            <div className="space-y-1.5">
              {getSuggestedQueries().map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="w-full text-left text-[11px] p-2 bg-background border border-border/80 rounded hover:border-accent hover:bg-surface transition-all text-text-secondary"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`p-2.5 rounded-lg leading-relaxed ${
                m.role === "user"
                  ? "bg-accent/15 border border-accent/30 ml-6 text-foreground font-medium"
                  : "bg-surface mr-6 border border-border shadow-2xs"
              }`}
            >
              <div className="text-[9px] font-mono text-text-muted uppercase mb-1">
                {m.role === "user" ? "Investigator" : "ARGUS AI"}
              </div>
              <p className="whitespace-pre-wrap text-[11px]">{m.content}</p>
              {m.error && <p className="text-[10px] text-status-rejected font-mono mt-1">{m.error}</p>}
            </div>
          ))
        )}
        {loading && (
          <div className="p-2.5 bg-surface rounded border border-border text-[11px] text-text-muted flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />
            Analyzing evidence context...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(query);
        }}
        className="p-2.5 bg-surface border-t border-border flex gap-1.5"
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Ask about ${contextLabel}...`}
          className="flex-1 text-xs border border-border rounded px-2.5 py-1.5 bg-background focus:border-accent"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="text-xs px-3 py-1.5 bg-accent text-surface-elevated rounded font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
