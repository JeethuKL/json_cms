import { useEffect, useState } from "react";
import fs from "fs";
import path from "path";
import { useEditorStore } from "@/store/editorStore";

interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
}

export function FileTree() {
  const [tree, setTree] = useState<FileNode[]>([]);
  const { currentFile, loadFile } = useEditorStore();

  useEffect(() => {
    const buildTree = async (dir: string): Promise<FileNode[]> => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      const nodes: FileNode[] = [];

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(process.cwd(), fullPath);

        if (entry.isDirectory()) {
          const children = await buildTree(fullPath);
          nodes.push({
            name: entry.name,
            path: relativePath,
            isDirectory: true,
            children,
          });
        } else if (entry.name.endsWith(".json")) {
          nodes.push({
            name: entry.name,
            path: relativePath,
            isDirectory: false,
          });
        }
      }

      return nodes.sort((a, b) => {
        if (a.isDirectory === b.isDirectory) {
          return a.name.localeCompare(b.name);
        }
        return a.isDirectory ? -1 : 1;
      });
    };

    buildTree(path.join(process.cwd(), "content"))
      .then(setTree)
      .catch(console.error);
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
      <div>{tree.map((node) => renderNode(node))}</div>
    </div>
  );
}
