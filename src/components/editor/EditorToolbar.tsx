import React, { useState } from "react";
import { useEditorStore } from "@/store/editorStore";
import classNames from "classnames";

interface ToolbarButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  variant?: "primary" | "secondary" | "danger" | "success";
  children: React.ReactNode;
}

function ToolbarButton({
  onClick,
  disabled,
  isLoading,
  variant = "primary",
  children,
}: ToolbarButtonProps) {
  const baseClasses = "px-4 py-2 rounded-md transition-colors";
  const variantClasses = {
    primary: "bg-blue-500 text-white hover:bg-blue-600",
    secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200",
    danger: "bg-red-500 text-white hover:bg-red-600",
    success: "bg-green-500 text-white hover:bg-green-600",
  };
  const disabledClasses = "bg-gray-200 text-gray-500 cursor-not-allowed hover:bg-gray-200";

  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className={classNames(
        baseClasses,
        disabled || isLoading ? disabledClasses : variantClasses[variant]
      )}
    >
      {children}
    </button>
  );
}

export function EditorToolbar() {
  const {
    currentFile,
    hasChanges,
    isLoading,
    error,
    saveChanges,
    commitAndPush,
    discardChanges,
    pullChanges,
  } = useEditorStore();

  const [gitMessage, setGitMessage] = useState<string | null>(null);

  const handleCommitAndPush = async () => {
    setGitMessage("Committing and pushing changes...");
    await commitAndPush();
    setGitMessage("Changes pushed successfully");
    setTimeout(() => setGitMessage(null), 3000);
  };

  const handlePull = async () => {
    setGitMessage("Pulling changes...");
    await pullChanges();
    setGitMessage("Changes pulled successfully");
    setTimeout(() => setGitMessage(null), 3000);
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
        <ToolbarButton
          onClick={() => saveChanges()}
          disabled={!currentFile || !hasChanges}
          isLoading={isLoading}
          variant="primary"
        >
          {isLoading ? "Saving..." : "Save"}
        </ToolbarButton>

        <ToolbarButton
          onClick={handleDiscard}
          disabled={!currentFile || !hasChanges}
          variant="danger"
        >
          Discard
        </ToolbarButton>
      </div>

      <div className="flex items-center space-x-4">
        {error && (
          <span className="text-sm text-red-500">
            {error}
          </span>
        )}
        
        {gitMessage && !error && (
          <span className="text-sm text-green-500">
            {gitMessage}
          </span>
        )}

        <ToolbarButton
          onClick={handlePull}
          disabled={isLoading}
          variant="secondary"
        >
          Pull Changes
        </ToolbarButton>

        <ToolbarButton
          onClick={handleCommitAndPush}
          disabled={isLoading || !hasChanges}
          variant="success"
        >
          Commit & Push
        </ToolbarButton>
      </div>

      {currentFile && (
        <div className="ml-4 text-sm text-gray-500">
          Current file: {currentFile}
        </div>
      )}
    </div>
  );
}
