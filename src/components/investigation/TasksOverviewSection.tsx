"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SectionHeader } from "@/components/ui/common";
import { InvestigationTaskCard, type InvestigationTaskItem } from "./InvestigationTaskCard";
import { CreateTaskDialog } from "./CreateTaskDialog";
import { CompleteTaskDialog } from "./CompleteTaskDialog";

interface TasksOverviewSectionProps {
  investigationId: string;
}

export function TasksOverviewSection({ investigationId }: TasksOverviewSectionProps) {
  const [tasks, setTasks] = useState<InvestigationTaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("OPEN_ACTIVE");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [taskToComplete, setTaskToComplete] = useState<InvestigationTaskItem | null>(null);
  const [followUpPrefill, setFollowUpPrefill] = useState<any>(null);

  async function loadTasks() {
    try {
      setLoading(true);
      const res = await fetch(`/api/investigations/${investigationId}/tasks`);
      const data = await res.json();
      if (res.ok && data.tasks) {
        setTasks(data.tasks);
      }
    } catch (err) {
      console.error("Failed to load tasks:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
  }, [investigationId]);

  async function handleStatusChange(taskId: string, newStatus: InvestigationTaskItem["status"]) {
    try {
      const res = await fetch(`/api/investigations/${investigationId}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        loadTasks();
      }
    } catch (err) {
      console.error("Failed to update task status:", err);
    }
  }

  function handleCreateFollowUp(parentTask: InvestigationTaskItem) {
    setFollowUpPrefill({
      title: `Follow-up: ${parentTask.title}`,
      description: `Targeted follow-up based on finding: "${parentTask.investigatorConclusion || ""}"`,
      whyItMatters: parentTask.whyItMatters || "",
      expectedOutcome: "Establish remaining operational details identified during primary task completion.",
      entityId: parentTask.entityId || undefined,
      relationshipId: parentTask.relationshipId || undefined,
      evidenceId: parentTask.evidenceId || undefined,
      parentTaskId: parentTask.id,
      sourceType: "INVESTIGATOR_CREATED",
    });
    setIsCreateOpen(true);
  }

  const openCount = tasks.filter((t) => t.status === "OPEN").length;
  const inProgressCount = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const blockedCount = tasks.filter((t) => t.status === "BLOCKED").length;
  const completedCount = tasks.filter((t) => t.status === "COMPLETED").length;

  const filteredTasks = tasks.filter((t) => {
    if (filter === "OPEN_ACTIVE") return t.status === "OPEN" || t.status === "IN_PROGRESS" || t.status === "BLOCKED";
    if (filter === "COMPLETED") return t.status === "COMPLETED";
    if (filter === "DISMISSED") return t.status === "DISMISSED";
    return true;
  });

  return (
    <div className="mb-8 surface-elevated p-6 rounded-lg border border-border">
      <SectionHeader
        title="Investigation Tasks / Attention"
        subtitle="Evidence-grounded action plan and task lifecycle tracking"
        action={
          <button
            onClick={() => {
              setFollowUpPrefill(null);
              setIsCreateOpen(true);
            }}
            className="text-xs px-3 py-1.5 rounded bg-accent text-surface-elevated font-medium hover:bg-accent-hover transition-colors flex items-center gap-1 shadow-sm"
          >
            <span>+ Create Task</span>
          </button>
        }
      />

      {/* Task Summary Badges */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-border text-xs">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 bg-red-500/10 text-red-500 border border-red-500/20 font-semibold rounded font-mono">
            {openCount} Open
          </span>
          <span className="px-2.5 py-1 bg-accent/10 text-accent border border-accent/20 font-semibold rounded font-mono">
            {inProgressCount} In Progress
          </span>
          <span className="px-2.5 py-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 font-semibold rounded font-mono">
            {blockedCount} Blocked
          </span>
          <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-semibold rounded font-mono">
            {completedCount} Completed
          </span>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1 font-medium">
          {[
            { id: "OPEN_ACTIVE", label: "Active Tasks" },
            { id: "ALL", label: "All History" },
            { id: "COMPLETED", label: "Completed" },
            { id: "DISMISSED", label: "Dismissed" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id)}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                filter === item.id
                  ? "bg-accent text-surface-elevated font-semibold"
                  : "bg-background border border-border text-text-secondary hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Task List Container */}
      {loading ? (
        <div className="p-8 text-center text-xs text-text-muted">Loading investigation tasks...</div>
      ) : filteredTasks.length === 0 ? (
        <div className="p-8 text-center text-xs text-text-muted surface rounded border border-border">
          No tasks match the selected filter. Click "+ Create Task" to record a new investigative action item.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTasks.map((t) => (
            <InvestigationTaskCard
              key={t.id}
              task={t}
              investigationId={investigationId}
              onStatusChange={handleStatusChange}
              onCompleteTask={(task) => setTaskToComplete(task)}
              onCreateFollowUp={handleCreateFollowUp}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <CreateTaskDialog
        investigationId={investigationId}
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onTaskCreated={() => loadTasks()}
        prefill={followUpPrefill}
      />

      {taskToComplete && (
        <CompleteTaskDialog
          task={taskToComplete}
          investigationId={investigationId}
          isOpen={Boolean(taskToComplete)}
          onClose={() => setTaskToComplete(null)}
          onTaskCompleted={() => loadTasks()}
        />
      )}
    </div>
  );
}
