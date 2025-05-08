import { useEffect, useState } from "react";
import { useEditorStore } from "@/store/editorStore";

interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
}

export function FileTree() {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { currentFile, loadFile } = useEditorStore();

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const response = await fetch("/api/files");
        if (!response.ok) {
          throw new Error("Failed to fetch files");
        }
        const data = await response.json();
        setTree(data);
      } catch (err) {
        console.error("Error fetching files:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    };

    fetchFiles();
  }, []);

  const renderNode = (node: FileNode, level: number = 0) => {
    const paddingLeft = `${level * 1.5}rem`;

    return (
      <div key={node.path}>
        <div
          className={`
            flex items-center px-4 py-2 cursor-pointer hover:bg-gray-100
            ${currentFile === node.path ? "bg-blue-50 text-blue-600" : ""}
          `}
          style={{ paddingLeft }}
          onClick={() => !node.isDirectory && loadFile(node.path)}
        >
          <span className="mr-2">{node.isDirectory ? "📁" : "📄"}</span>
          {node.name}
        </div>
        {node.children?.map((child) => renderNode(child, level + 1))}
      </div>
    );
  };

  return (
    <div className="h-full overflow-auto">
      <div className="p-4 border-b font-semibold">Content Files</div>
      {error ? (
        <div className="p-4 text-red-600">Error: {error}</div>
      ) : tree.length === 0 ? (
        <div className="p-4 text-gray-500">
          No files found in content directory
        </div>
      ) : (
        <div>{tree.map((node) => renderNode(node))}</div>
      )}
    </div>
  );
}
