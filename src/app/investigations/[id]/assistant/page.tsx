"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/common";

interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
  error?: string | null;
}

interface ConversationItem {
  id: string;
  title: string;
  contextType?: string | null;
  contextId?: string | null;
  contextLabel?: string | null;
  summary?: { rawText: string; generatedAt: string } | null;
  updatedAt: string;
  messages: Message[];
}

export default function AssistantPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const queryConvId = searchParams.get("conversationId");
  const contextType = searchParams.get("contextType");
  const contextId = searchParams.get("contextId");
  const contextLabel = searchParams.get("contextLabel");

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(queryConvId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeSummary, setActiveSummary] = useState<{ rawText: string } | null>(null);

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [initLoading, setInitLoading] = useState(true);

  const loadConversations = useCallback(async () => {
    setInitLoading(true);
    try {
      let url = `/api/investigations/${id}/conversations`;
      if (contextType && contextId && !queryConvId) {
        url += `?contextType=${contextType}&contextId=${contextId}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      const list: ConversationItem[] = data.conversations || [];
      setConversations(list);

      if (queryConvId) {
        const found = list.find((c) => c.id === queryConvId);
        if (found) {
          setActiveConvId(found.id);
          setMessages(found.messages || []);
          setActiveSummary(found.summary || null);
          return;
        }
      }

      if (list.length > 0) {
        const first = list[0];
        setActiveConvId(first.id);
        setMessages(first.messages || []);
        setActiveSummary(first.summary || null);
      } else {
        // Create initial conversation
        const createRes = await fetch(`/api/investigations/${id}/conversations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contextType: contextType || null,
            contextId: contextId || null,
            contextLabel: contextLabel || null,
            title: contextLabel
              ? `${contextLabel} (${contextType || "Focus"})`
              : "Investigation Overview",
          }),
        });
        const createData = await createRes.json();
        if (createData.conversation) {
          setConversations([createData.conversation]);
          setActiveConvId(createData.conversation.id);
          setMessages([]);
          setActiveSummary(null);
        }
      }
    } catch {
      console.error("Failed to load conversations");
    } finally {
      setInitLoading(false);
    }
  }, [id, queryConvId, contextType, contextId, contextLabel]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const selectConversation = (conv: ConversationItem) => {
    setActiveConvId(conv.id);
    setMessages(conv.messages || []);
    setActiveSummary(conv.summary || null);
  };

  const createNewConversation = async () => {
    try {
      const createRes = await fetch(`/api/investigations/${id}/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contextType: contextType || null,
          contextId: contextId || null,
          contextLabel: contextLabel || null,
          forceNew: true,
          title: contextLabel
            ? `${contextLabel} Thread (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
            : `Investigation Thread (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
        }),
      });
      const data = await createRes.json();
      if (data.conversation) {
        setConversations((prev) => [data.conversation, ...prev]);
        setActiveConvId(data.conversation.id);
        setMessages([]);
        setActiveSummary(null);
      }
    } catch {
      console.error("Failed to create conversation");
    }
  };

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteConversation = async (convId: string) => {
    if (isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/investigations/${id}/conversations/${convId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const remaining = conversations.filter((c) => c.id !== convId);
        setConversations(remaining);
        if (activeConvId === convId) {
          if (remaining.length > 0) {
            selectConversation(remaining[0]);
          } else {
            setActiveConvId(null);
            setMessages([]);
            setActiveSummary(null);
          }
        }
        setDeleteConfirmId(null);
      } else {
        const errData = await res.json();
        setDeleteError(errData.error || "Failed to delete conversation thread.");
      }
    } catch {
      setDeleteError("Network error occurred while deleting conversation.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!activeConvId) return;
    setSummarizing(true);
    try {
      const res = await fetch(`/api/investigations/${id}/conversations/${activeConvId}/summary`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.summary) {
        setActiveSummary(data.summary);
      }
    } catch {
      console.error("Failed to summarize");
    } finally {
      setSummarizing(false);
    }
  };

  const sendQuery = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;

    let targetConvId = activeConvId;
    setLoading(true);

    const tempMsgId = `user-${Date.now()}`;
    const tempMsg: Message = { id: tempMsgId, role: "user", content: trimmed };
    setMessages((prev) => [...prev, tempMsg]);
    setQuery("");

    try {
      if (!targetConvId) {
        const createRes = await fetch(`/api/investigations/${id}/conversations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contextType: contextType || null,
            contextId: contextId || null,
            contextLabel: contextLabel || null,
            title: contextLabel
              ? `${contextLabel} (${contextType || "Focus"})`
              : "Investigation Overview",
          }),
        });
        const createData = await createRes.json();
        if (createData.conversation) {
          targetConvId = createData.conversation.id;
          setActiveConvId(targetConvId);
          setConversations((prev) => [createData.conversation, ...prev]);
        } else {
          throw new Error("Could not initialize thread");
        }
      }

      const res = await fetch(`/api/investigations/${id}/conversations/${targetConvId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });
      const data = await res.json();
      if (data.userMessage && data.assistantMessage) {
        setMessages((prev) => [
          ...prev.map((m) => (m.id === tempMsgId ? data.userMessage : m)),
          data.assistantMessage,
        ]);
        // Update list update timestamp
        setConversations((prev) =>
          prev.map((c) => (c.id === targetConvId ? { ...c, updatedAt: new Date().toISOString() } : c))
        );
      } else {
        throw new Error(data.error || "Invalid response");
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Failed to process query.", error: err.message || "Network error" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const getSuggestedQueries = () => {
    if (contextType === "ENTITY") {
      return [
        `Why does ${contextLabel || "this entity"} matter?`,
        `What evidence connects ${contextLabel || "this entity"}?`,
        `What facts are unverified for ${contextLabel || "this entity"}?`,
      ];
    }
    return [
      "Why are these entities connected?",
      "Which entity connects separate groups?",
      "What should be reviewed next?",
      "Summarize the evidence in this investigation.",
    ];
  };

  const activeConv = conversations.find((c) => c.id === activeConvId);

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8 space-y-6">
      <PageHeader
        title="Vyom AI Investigation & Threads"
        description="Evidence-grounded intelligence powered by Vyom AI. Context and conversation threads are automatically persisted across your workspace."
      />

      {/* Main Grid: History Drawer + Chat Space */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        {/* Conversations Drawer */}
        <div className="surface-elevated p-4 rounded-lg border border-border space-y-4 md:col-span-1">
          <div className="flex items-center justify-between">
            <h4 className="font-serif font-semibold text-xs text-foreground uppercase tracking-wider">
              Threads & History
            </h4>
            <button
              onClick={createNewConversation}
              className="text-[11px] px-2 py-1 bg-accent text-surface-elevated rounded font-medium hover:bg-accent-hover transition-colors"
            >
              + New Thread
            </button>
          </div>

          <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
            {conversations.length === 0 ? (
              <p className="text-xs text-text-muted text-center py-4">No threads created yet.</p>
            ) : (
              conversations.map((c) => {
                const isActive = c.id === activeConvId;
                return (
                  <div
                    key={c.id}
                    className={`p-2.5 rounded-md border text-xs cursor-pointer transition-all flex flex-col justify-between ${
                      isActive
                        ? "bg-accent/10 border-accent/40 text-foreground font-medium"
                        : "bg-background border-border text-text-secondary hover:border-border-strong hover:text-foreground"
                    }`}
                    onClick={() => selectConversation(c)}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="truncate font-semibold">{c.title}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(c.id);
                        }}
                        className="text-text-muted hover:text-status-rejected text-[11px] px-1"
                        title="Delete conversation thread"
                      >
                        ✕
                      </button>
                    </div>
                    {c.contextLabel && (
                      <span className="text-[9px] font-mono text-accent uppercase tracking-wider mt-1">
                        {c.contextLabel}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Chat Interface */}
        <div className="md:col-span-3 space-y-4">
          {/* Active Context Header Bar */}
          <div className="surface-elevated p-3 rounded-lg border border-border flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase text-accent font-semibold px-2.5 py-1 border border-accent/30 rounded bg-accent/10">
                Context: {contextLabel || activeConv?.contextLabel || "Investigation Global"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleGenerateSummary}
                disabled={summarizing || !activeConvId}
                className="text-xs px-2.5 py-1 border border-accent/40 bg-accent/5 text-accent rounded font-medium hover:bg-accent/10 transition-colors disabled:opacity-50"
              >
                {summarizing ? "Summarizing..." : "✨ Summarize Conversation"}
              </button>
              {(contextType || activeConv?.contextType) && (
                <a
                  href={`/investigations/${id}/assistant`}
                  className="text-xs px-2.5 py-1 text-text-muted hover:text-foreground border border-border rounded transition-colors"
                >
                  Clear Focus Filter
                </a>
              )}
            </div>
          </div>

          {/* AI Structured Summary Box */}
          {activeSummary && (
            <div className="surface-elevated p-4 rounded-lg border border-accent/40 bg-accent/5 space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-accent/20 pb-2">
                <span className="font-mono text-accent font-bold uppercase tracking-wider text-[11px]">
                  ARGUS Grounded Thread Summary (KNOWN / INFERRED / UNCERTAIN)
                </span>
                <button
                  onClick={() => setActiveSummary(null)}
                  className="text-text-muted hover:text-foreground text-[10px]"
                >
                  Close
                </button>
              </div>
              <p className="whitespace-pre-wrap font-sans text-foreground leading-relaxed">
                {activeSummary.rawText}
              </p>
            </div>
          )}

          {/* Chat Messages */}
          <div className="surface-elevated rounded-lg border border-border min-h-[450px] flex flex-col overflow-hidden shadow-2xs">
            <div className="flex-1 p-4 space-y-4 overflow-y-auto max-h-[500px]">
              {messages.length === 0 && (
                <div className="text-center py-12 space-y-4">
                  <p className="text-xs text-text-muted">
                    Ask questions grounded strictly in this investigation's evidence.
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
                  key={msg.id || i}
                  className={`p-4 rounded-lg space-y-2 text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-accent/10 border border-accent/30 ml-12 text-foreground font-medium"
                      : "bg-background mr-12 border border-border shadow-2xs"
                  }`}
                >
                  <div className="flex justify-between items-center text-[10px] text-text-muted font-mono">
                    <span>{msg.role === "user" ? "Investigator Query" : "Vyom AI Agent (Grounded)"}</span>
                  </div>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.error && <p className="text-[11px] text-status-rejected mt-1 font-mono">Note: {msg.error}</p>}
                </div>
              ))}

              {loading && (
                <div className="p-3 bg-background rounded border border-border text-xs text-text-muted flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
                  <span>Vyom AI is analyzing retrieved investigation context...</span>
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
                  contextLabel || activeConv?.contextLabel
                    ? `Ask about ${contextLabel || activeConv?.contextLabel}...`
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
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="surface-elevated p-6 rounded-lg border border-border max-w-sm w-full space-y-4 shadow-xl">
            <h4 className="font-serif font-semibold text-sm text-foreground">
              Delete Conversation Thread?
            </h4>
            <p className="text-xs text-text-muted">
              Are you sure you want to permanently delete this chat thread? This action cannot be undone. Evidence and investigation graph data will remain intact.
            </p>
            {deleteError && (
              <p className="text-xs text-status-rejected font-mono">{deleteError}</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmId(null);
                  setDeleteError(null);
                }}
                disabled={isDeleting}
                style={{
                  padding: "0.375rem 0.75rem",
                  fontSize: "0.75rem",
                  border: "1px solid var(--border)",
                  borderRadius: "0.375rem",
                  backgroundColor: "var(--surface)",
                  color: "var(--foreground)",
                  cursor: "pointer",
                  opacity: isDeleting ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteConversation(deleteConfirmId)}
                disabled={isDeleting}
                style={{
                  padding: "0.375rem 0.75rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  border: "1px solid #8b4444",
                  borderRadius: "0.375rem",
                  backgroundColor: "#8b4444",
                  color: "#ffffff",
                  cursor: "pointer",
                  opacity: isDeleting ? 0.5 : 1,
                }}
              >
                {isDeleting ? "Deleting..." : "Delete Conversation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
