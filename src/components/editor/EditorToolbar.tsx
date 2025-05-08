import { useEditorStore } from "@/store/editorStore";

export function EditorToolbar() {
  const {
    currentFile,
    hasChanges,
    isLoading,
    saveChanges,
    discardChanges,
    gitService,
  } = useEditorStore();

  const handlePush = async () => {
    try {
      await gitService.push();
    } catch (error) {
      console.error("Failed to push changes:", error);
    }
  };

  const handlePull = async () => {
    try {
      await gitService.pull();
    } catch (error) {
      console.error("Failed to pull changes:", error);
    }
  };

  return (
    <div className="flex justify-between items-center bg-white px-4 py-2 border-b">
      <div className="flex items-center space-x-2">
        <button
          className={`
            px-3 py-1 rounded
            ${
              hasChanges
                ? "bg-blue-500 text-white hover:bg-blue-600"
                : "bg-gray-100 text-gray-400"
            }
          `}
          onClick={() => saveChanges()}
          disabled={!hasChanges || isLoading}
        >
          Save
        </button>

        <button
          className={`
            px-3 py-1 rounded
            ${
              hasChanges
                ? "bg-red-100 text-red-600 hover:bg-red-200"
                : "bg-gray-100 text-gray-400"
            }
          `}
          onClick={() => discardChanges()}
          disabled={!hasChanges || isLoading}
        >
          Discard
        </button>
      </div>

      <div className="flex-1 mx-4 text-gray-500 truncate">
        {currentFile || "No file selected"}
      </div>

      <div className="flex items-center space-x-2">
        <button
          className="bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded"
          onClick={handlePull}
          disabled={isLoading}
        >
          Pull
        </button>

        <button
          className="bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded"
          onClick={handlePush}
          disabled={isLoading}
        >
          Push
        </button>
      </div>
    </div>
  );
}
