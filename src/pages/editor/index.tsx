import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useEditorStore } from "@/store/editorStore";
import { FileTree } from "@/components/editor/FileTree";
import { EditorToolbar } from "@/components/editor/EditorToolbar";

// Dynamically import Monaco editor to avoid SSR issues
const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((mod) => mod.default),
  { ssr: false }
);

export default function EditorPage() {
  const {
    currentFile,
    content,
    isLoading,
    hasChanges,
    error,
    setContent,
    saveChanges,
  } = useEditorStore();

  useEffect(() => {
    // Auto-save changes after 1 second of inactivity
    if (hasChanges) {
      const timer = setTimeout(() => {
        saveChanges();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [hasChanges, saveChanges]);

  return (
    <div className="flex bg-gray-100 h-screen">
      {/* Sidebar */}
      <div className="bg-white border-r w-64">
        <FileTree />
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1">
        <EditorToolbar />

        <div className="relative flex-1">
          {isLoading ? (
            <div className="absolute inset-0 flex justify-center items-center bg-white bg-opacity-75">
              Loading...
            </div>
          ) : currentFile ? (
            <MonacoEditor
              height="100%"
              language="json"
              theme="vs-light"
              value={content}
              onChange={(value) => setContent(value || "")}
              options={{
                minimap: { enabled: false },
                formatOnPaste: true,
                formatOnType: true,
                automaticLayout: true,
              }}
            />
          ) : (
            <div className="flex justify-center items-center h-full text-gray-500">
              Select a file to edit
            </div>
          )}

          {error && (
            <div className="right-0 bottom-0 left-0 absolute bg-red-100 p-4 text-red-700">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
