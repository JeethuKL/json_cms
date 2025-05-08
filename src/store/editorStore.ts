import { create } from "zustand";
import { GitService, GitError } from "@/services/git";
import { ValidationError } from "@/services/validation";

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
  commitAndPush: () => Promise<void>;
  discardChanges: () => void;
  loadFile: (path: string) => Promise<void>;
  pullChanges: () => Promise<void>;
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
      error: null,
    })),

  saveChanges: async () => {
    const { currentFile, content, gitService } = get();
    if (!currentFile) return;

    set({ isLoading: true, error: null });

    try {
      await gitService.saveFile(currentFile, content);
      set({ hasChanges: false });
    } catch (error) {
      if (error instanceof ValidationError) {
        set({
          error: `Validation error: ${error.errors.map(e => e.message).join(", ")}`
        });
      } else {
        set({
          error: `Failed to save: ${(error as Error).message}`
        });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  commitAndPush: async () => {
    const { currentFile, gitService } = get();
    if (!currentFile) return;

    set({ isLoading: true, error: null });

    try {
      // First commit the changes
      await gitService.commitChanges(`Update ${currentFile}`);

      // Then try to push
      await gitService.push();
    } catch (error) {
      if (error instanceof GitError) {
        if (error.code === "AUTH_ERROR") {
          set({
            error: "Git authentication failed. Please configure your Git credentials."
          });
        } else {
          set({
            error: `Git operation failed: ${error.message}`
          });
        }
      } else {
        set({
          error: `Operation failed: ${(error as Error).message}`
        });
      }
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
      set({
        error: `Failed to load file: ${(error as Error).message}`,
        content: "",
        hasChanges: false,
      });
    } finally {
      set({ isLoading: false });
    }
  },

  pullChanges: async () => {
    set({ isLoading: true, error: null });

    try {
      await get().gitService.pull();
      
      // Reload current file if any
      const { currentFile } = get();
      if (currentFile) {
        const content = await get().gitService.readFile(currentFile);
        set({
          content,
          hasChanges: false,
        });
      }
    } catch (error) {
      if (error instanceof GitError) {
        if (error.code === "AUTH_ERROR") {
          set({
            error: "Git authentication failed. Please configure your Git credentials."
          });
        } else {
          set({
            error: `Git operation failed: ${error.message}`
          });
        }
      } else {
        set({
          error: `Pull failed: ${(error as Error).message}`
        });
      }
    } finally {
      set({ isLoading: false });
    }
  },
}));
