"use client";

import { useState, useRef } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/ui/common";
import { APP_CONFIG } from "@/lib/config";

interface FileItemState {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: "UPLOADING" | "PROCESSING" | "READY" | "FAILED";
  statusText?: string;
  error?: string;
}

export default function IntakePage() {
  const { id } = useParams<{ id: string }>();
  const [selectedFiles, setSelectedFiles] = useState<FileItemState[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allowedExtensionsText = APP_CONFIG.allowedExtensions
    .map((e) => e.replace(".", "").toUpperCase())
    .join(", ");
  const limitMb = (APP_CONFIG.maxFileSizeBytes / (1024 * 1024)).toFixed(0);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    setGlobalError(null);
    const filesArray = Array.from(e.target.files);

    const newItems: FileItemState[] = filesArray.map((f, idx) => {
      const ext = "." + f.name.split(".").pop()?.toLowerCase();
      const isAllowed = (APP_CONFIG.allowedExtensions as readonly string[]).includes(ext);
      const isOverSize = f.size > APP_CONFIG.maxFileSizeBytes;

      let initialStatus: FileItemState["status"] = "UPLOADING";
      let initialError: string | undefined = undefined;

      if (!isAllowed) {
        initialStatus = "FAILED";
        initialError = `Unsupported format '${ext}'. Accepted: ${allowedExtensionsText}`;
      } else if (isOverSize) {
        initialStatus = "FAILED";
        initialError = `File exceeds max size limit of ${limitMb}MB.`;
      }

      return {
        id: `${Date.now()}-${idx}-${f.name}`,
        file: f,
        name: f.name,
        size: f.size,
        type: f.type || ext.toUpperCase(),
        status: initialStatus,
        error: initialError,
      };
    });

    setSelectedFiles((prev) => [...prev, ...newItems]);
    // Reset file input value so re-selecting same file works
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFileItem = (idToRemove: string) => {
    setSelectedFiles((prev) => prev.filter((item) => item.id !== idToRemove));
  };

  const handleUploadAll = async () => {
    const validItems = selectedFiles.filter((item) => item.status !== "FAILED");
    if (validItems.length === 0) {
      setGlobalError("No valid files to upload. Please select supported files.");
      return;
    }

    setIsUploading(true);
    setGlobalError(null);

    // Set valid files to UPLOADING then PROCESSING state
    setSelectedFiles((prev) =>
      prev.map((item) =>
        item.status !== "FAILED"
          ? { ...item, status: "UPLOADING", statusText: "Uploading to secure server..." }
          : item
      )
    );

    try {
      const formData = new FormData();
      validItems.forEach((item) => {
        formData.append("files", item.file);
      });

      // Update UI to PROCESSING state right before network response handling
      setTimeout(() => {
        setSelectedFiles((prev) =>
          prev.map((item) =>
            item.status === "UPLOADING"
              ? { ...item, status: "PROCESSING", statusText: "Preparing evidence for analysis..." }
              : item
          )
        );
      }, 400);

      const res = await fetch(`/api/investigations/${id}/evidence`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Upload operation failed");
      }

      const resultsList: Array<{
        fileName: string;
        status: "READY" | "FAILED";
        error?: string;
      }> = data.results || [];

      // Update each file's final status based on server response
      setSelectedFiles((prev) =>
        prev.map((item) => {
          const resItem = resultsList.find((r) => r.fileName === item.name);
          if (resItem) {
            if (resItem.status === "READY") {
              return {
                ...item,
                status: "READY",
                statusText: "Evidence is ready for analysis.",
                error: undefined,
              };
            } else {
              return {
                ...item,
                status: "FAILED",
                error: resItem.error || "Processing failed",
              };
            }
          }
          return item;
        })
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Upload failed";
      setGlobalError(errMsg);
      setSelectedFiles((prev) =>
        prev.map((item) =>
          item.status === "UPLOADING" || item.status === "PROCESSING"
            ? { ...item, status: "FAILED", error: errMsg }
            : item
        )
      );
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="max-w-[800px] mx-auto px-6 py-8 space-y-6" suppressHydrationWarning>
      <PageHeader
        title="EVIDENCE INTAKE"
        description="Upload documents or records to add them to this investigation."
      />

      <div className="surface-elevated p-6 border border-border rounded-lg space-y-6">
        <div>
          <h3 className="text-base font-semibold text-foreground mb-1">Upload investigation evidence</h3>
          <p className="text-xs text-text-muted">
            Select single or multiple investigation files to ingest into ARGUS.
          </p>
        </div>

        {/* Custom Upload Box */}
        <div className="border-2 border-dashed border-border/80 hover:border-accent/60 transition-colors rounded-lg p-6 text-center bg-background/50 space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.txt,.md,.csv"
            onChange={handleFileSelect}
            className="hidden"
            id="evidence-file-input"
          />
          <label
            htmlFor="evidence-file-input"
            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 bg-accent text-surface-elevated rounded cursor-pointer hover:bg-accent-hover transition-colors"
          >
            Choose files
          </label>

          <div className="text-xs text-text-secondary space-y-0.5">
            <p className="font-medium text-foreground">Accepted formats: {allowedExtensionsText}</p>
            <p className="text-text-muted">Maximum file size: {limitMb}MB per file</p>
          </div>
        </div>

        {/* Global Error Banner */}
        {globalError && (
          <div className="p-3.5 bg-status-rejected/10 border border-status-rejected/30 rounded text-xs text-status-rejected font-medium">
            {globalError}
          </div>
        )}

        {/* Selected Files Listing */}
        {selectedFiles.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                {selectedFiles.length} {selectedFiles.length === 1 ? "file" : "files"} selected
              </span>
              {!isUploading && (
                <button
                  onClick={() => setSelectedFiles([])}
                  className="text-xs text-text-muted hover:text-foreground transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>

            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
              {selectedFiles.map((fileItem) => (
                <div
                  key={fileItem.id}
                  className={`p-3 border rounded text-xs transition-all ${
                    fileItem.status === "FAILED"
                      ? "border-status-rejected/40 bg-status-rejected/5"
                      : fileItem.status === "READY"
                      ? "border-status-verified/40 bg-status-verified/5"
                      : "border-border bg-surface"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="font-mono text-[11px] px-2 py-0.5 border border-border rounded uppercase bg-background text-text-secondary shrink-0">
                        {fileItem.name.split(".").pop()?.toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground truncate" title={fileItem.name}>
                          {fileItem.name}
                        </p>
                        <p className="text-[11px] text-text-muted mt-0.5">
                          {formatFileSize(fileItem.size)}
                        </p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center gap-2 shrink-0">
                      {fileItem.status === "UPLOADING" && (
                        <span className="px-2 py-0.5 bg-accent/20 text-accent font-semibold rounded text-[11px] uppercase tracking-wider">
                          UPLOADING
                        </span>
                      )}
                      {fileItem.status === "PROCESSING" && (
                        <span className="px-2 py-0.5 bg-accent/20 text-accent font-semibold rounded text-[11px] uppercase tracking-wider animate-pulse">
                          PROCESSING
                        </span>
                      )}
                      {fileItem.status === "READY" && (
                        <span className="px-2 py-0.5 bg-status-verified/20 text-status-verified font-semibold rounded text-[11px] uppercase tracking-wider">
                          READY
                        </span>
                      )}
                      {fileItem.status === "FAILED" && (
                        <span className="px-2 py-0.5 bg-status-rejected/20 text-status-rejected font-semibold rounded text-[11px] uppercase tracking-wider">
                          FAILED
                        </span>
                      )}

                      {!isUploading && fileItem.status !== "READY" && (
                        <button
                          onClick={() => removeFileItem(fileItem.id)}
                          className="text-text-muted hover:text-status-rejected px-1 text-sm font-bold"
                          title="Remove file"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Subtext / Error Message */}
                  {fileItem.statusText && fileItem.status !== "FAILED" && (
                    <p className="text-[11px] text-text-muted mt-1.5 italic">
                      "{fileItem.statusText}"
                    </p>
                  )}

                  {fileItem.error && (
                    <p className="text-[11px] text-status-rejected mt-1.5 font-medium">
                      {fileItem.error}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-border flex items-center justify-between">
              <span className="text-xs text-text-muted">
                Ready files will be stored in investigation evidence library.
              </span>
              <button
                onClick={handleUploadAll}
                disabled={isUploading || selectedFiles.every((f) => f.status === "FAILED" || f.status === "READY")}
                className="px-5 py-2 text-xs font-semibold bg-accent text-surface-elevated rounded hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                {isUploading ? "Uploading & Processing..." : "Upload Evidence"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
