import React, { useEffect, useState } from "react";
import { useEditorStore } from "@/store/editorStore";

interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
  status?: {
    isModified: boolean;
    isNew: boolean;
    isDeleted: boolean;
  };
}

interface FileTreeNodeProps {
  node: FileNode;
  level: number;
  onSelect: (path: string) => void;
  selectedPath: string | null;
}

function FileTreeNode({ node, level, onSelect, selectedPath }: FileTreeNodeProps) {
  const [isOpen, setIsOpen] = useState(true);
  const isSelected = selectedPath === node.path;

  const handleClick = () => {
    if (node.type === "directory") {
      setIsOpen(!isOpen);
    } else {
      onSelect(node.path);
    }
  };

  const statusColor = node.status
    ? node.status.isNew
      ? "text-green-500"
      : node.status.isModified
      ? "text-yellow-500"
      : node.status.isDeleted
      ? "text-red-500"
      : ""
    : "";

  return (
    <div>
      <div
        className={`flex items-center px-2 py-1 cursor-pointer hover:bg-gray-100 ${
          isSelected ? "bg-blue-100" : ""
        }`}
        style={{ paddingLeft: `${level * 1.5}rem` }}
        onClick={handleClick}
      >
        <span className="mr-2">
          {node.type === "directory" ? (
            isOpen ? (
              "📂"
            ) : (
              "📁"
            )
          ) : node.name.endsWith(".json") ? (
            "📄"
          ) : (
            "📝"
          )}
        </span>
        <span className={statusColor}>{node.name}</span>
        {node.status?.isModified && (
          <span className="ml-2 text-xs text-yellow-500">Modified</span>
        )}
        {node.status?.isNew && (
          <span className="ml-2 text-xs text-green-500">New</span>
        )}
        {node.status?.isDeleted && (
          <span className="ml-2 text-xs text-red-500">Deleted</span>
        )}
      </div>
      {node.type === "directory" &&
        isOpen &&
        node.children?.map((child) => (
          <FileTreeNode
            key={child.path}
            node={child}
            level={level + 1}
            onSelect={onSelect}
            selectedPath={selectedPath}
          />
        ))}
    </div>
  );
}

export function FileTree() {
  const { currentFile, loadFile, gitService } = useEditorStore();
  const [files, setFiles] = useState<FileNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadFiles() {
      try {
        setIsLoading(true);
        setError(null);

        // Get file tree
        const response = await fetch("/api/files");
        if (!response.ok) throw new Error("Failed to load files");
        const fileTree = await response.json();

        // Get git status
        const status = await gitService.getStatus();
        const statusMap = new Map(
          status.map(([filepath, head, workdir, stage]) => [
            filepath,
            {
              isNew: head === 0,
              isModified: workdir === 2,
              isDeleted: workdir === 0 && head === 1,
            },
          ])
        );

        // Merge git status into file tree
        function addGitStatus(node: FileNode): FileNode {
          const newNode = { ...node };
          if (node.type === "file") {
            newNode.status = statusMap.get(node.path) || {
              isModified: false,
              isNew: false,
              isDeleted: false,
            };
          }
          if (node.children) {
            newNode.children = node.children.map(addGitStatus);
          }
          return newNode;
        }

        setFiles(fileTree.map(addGitStatus));
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    }

    loadFiles();
  }, [gitService]);

  if (isLoading) {
    return (
      <div className="p-4 text-gray-500">
        Loading files...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-500">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="p-4 border-b">
        <h2 className="font-semibold">Files</h2>
      </div>
      <div className="py-2">
        {files.map((file) => (
          <FileTreeNode
            key={file.path}
            node={file}
            level={0}
            onSelect={loadFile}
            selectedPath={currentFile}
          />
        ))}
      </div>
    </div>
  );
}
