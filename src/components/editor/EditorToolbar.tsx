import React, { useState } from "react";
import { useEditorStore } from "@/store/editorStore";

interface GitStatus {
  isLoading: boolean;
  message: string | null;
}

export function EditorToolbar() {
  const {
    currentFile,
    hasChanges,
    isLoading,
    gitService,
    saveChanges,
    discardChanges,
  } = useEditorStore();

  const [gitStatus, setGitStatus] = useState<GitStatus>({
    isLoading: false,
    message: null,
  });

  const handleSave = async () => {
    if (!currentFile || !hasChanges) return;
    await saveChanges();
  };

  const handlePush = async () => {
    try {
      setGitStatus({ isLoading: true, message: "Pushing changes..." });
      await gitService.push();
      setGitStatus({ isLoading: false, message: "Changes pushed successfully" });
      setTimeout(() => setGitStatus({ isLoading: false, message: null }), 3000);
    } catch (error) {
      setGitStatus({
        isLoading: false,
        message: `Push failed: ${(error as Error).message}`,
      });
    }
  };

  const handlePull = async () => {
    try {
      setGitStatus({ isLoading: true, message: "Pulling changes..." });
      await gitService.pull();
      setGitStatus({ isLoading: false, message: "Changes pulled successfully" });
      setTimeout(() => setGitStatus({ isLoading: false, message: null }), 3000);
    } catch (error) {
      setGitStatus({
        isLoading: false,
        message: `Pull failed: ${(error as Error).message}`,
      });
    }
  };

  const handleDiscard = () => {
    if (!currentFile || !hasChanges) return;
    if (window.confirm("Are you sure you want to discard your changes?")) {
      discardChanges();
    }
  };

  return (
    <div className="flex items-center justify-between p-4 border-b bg-white">
      <div className="flex items-center space-x-4">
        <button
          onClick={handleSave}
          disabled={!currentFile || !hasChanges || isLoading}
          className={`px-4 py-2 rounded-md transition-colors ${
            !currentFile || !hasChanges || isLoading
              ? "bg-gray-200 text-gray-500 cursor-not-allowed"
              : "bg-blue-500 text-white hover:bg-blue-600"
          }`}
        >
          {isLoading ? "Saving..." : "Save"}
        </button>

        <button
          onClick={handleDiscard}
          disabled={!currentFile || !hasChanges || isLoading}
          className={`px-4 py-2 rounded-md transition-colors ${
            !currentFile || !hasChanges || isLoading
              ? "bg-gray-200 text-gray-500 cursor-not-allowed"
              : "bg-red-500 text-white hover:bg-red-600"
          }`}
        >
          Discard
        </button>
      </div>

      <div className="flex items-center space-x-4">
        {gitStatus.message && (
          <span
            className={`text-sm ${
              gitStatus.message.includes("failed")
                ? "text-red-500"
                : "text-green-500"
            }`}
          >
            {gitStatus.message}
          </span>
        )}

        <button
          onClick={handlePull}
          disabled={gitStatus.isLoading}
          className={`px-4 py-2 rounded-md transition-colors ${
            gitStatus.isLoading
              ? "bg-gray-200 text-gray-500 cursor-not-allowed"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          {gitStatus.isLoading && gitStatus.message?.includes("Pulling")
            ? "Pulling..."
            : "Pull"}
        </button>

        <button
          onClick={handlePush}
          disabled={gitStatus.isLoading}
          className={`px-4 py-2 rounded-md transition-colors ${
            gitStatus.isLoading
              ? "bg-gray-200 text-gray-500 cursor-not-allowed"
              : "bg-green-500 text-white hover:bg-green-600"
          }`}
        >
          {gitStatus.isLoading && gitStatus.message?.includes("Pushing")
            ? "Pushing..."
            : "Push"}
        </button>
      </div>

      {currentFile && (
        <div className="ml-4 text-sm text-gray-500">
          Current file: {currentFile}
        </div>
      )}
    </div>
  );
}
