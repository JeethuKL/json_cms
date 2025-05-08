import { create } from "zustand";
import { GitService } from "@/services/git";

interface EditorState {
  currentFile: string | null;
  content: string;
  isLoading: boolean;
  hasChanges: boolean;
  error: string | null;
  gitService: GitService;

  // Actions
  setCurrentFile: (file: string | null) => void;
  setContent: (content: string) => void;
  saveChanges: () => Promise<void>;
  discardChanges: () => void;
  loadFile: (path: string) => Promise<void>;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  currentFile: null,
  content: "",
  isLoading: false,
  hasChanges: false,
  error: null,
  gitService: new GitService(),

  setCurrentFile: (file) => set({ currentFile: file }),

  setContent: (content) =>
    set((state) => ({
      content,
      hasChanges: content !== state.content,
    })),

  saveChanges: async () => {
    const { currentFile, content, gitService } = get();
    if (!currentFile) return;

    set({ isLoading: true, error: null });

    try {
      await gitService.saveFile(currentFile, content);
      await gitService.commitChanges(`Update ${currentFile}`);
      set({ hasChanges: false });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ isLoading: false });
    }
  },

  discardChanges: () => {
    const { currentFile } = get();
    if (currentFile) {
      get().loadFile(currentFile);
    }
  },

  loadFile: async (path: string) => {
    set({ isLoading: true, error: null });

    try {
      const content = await get().gitService.readFile(path);
      set({
        currentFile: path,
        content,
        hasChanges: false,
      });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ isLoading: false });
    }
  },
}));
