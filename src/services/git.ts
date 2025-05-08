import fs from "fs";
import path from "path";
import git from "isomorphic-git";
import http from "isomorphic-git/http/node";
import { z } from "zod";

// Type definitions
const GitConfigSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  remote: z.string().default("origin"),
  branch: z.string().default("main"),
});

type GitConfig = z.infer<typeof GitConfigSchema>;

interface GitCommit {
  oid: string;
  commit: {
    message: string;
    tree: string;
    parent: string[];
    author: {
      name: string;
      email: string;
      timestamp: number;
    };
  };
}

type StatusMatrix = Array<[string, number, number, number]>;

export class GitError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "GitError";
  }
}

export class GitService {
  private baseUrl: string;
  private config: GitConfig;

  constructor(config?: Partial<GitConfig>) {
    this.baseUrl = "/api";
    // Default config will be overridden by local git config
    this.config = GitConfigSchema.parse({
      name: "JSON CMS",
      email: "json-cms@example.com",
      remote: "origin",
      branch: "main",
      ...config,
    });
  }

  private async handleRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Unknown error" }));
      throw new GitError(error.message || response.statusText, error.code || response.status.toString());
    }

    return response.json();
  }

  private ensureContentPath(filePath: string): string {
    // Remove any existing content/ prefix and leading slashes
    const cleanPath = filePath.replace(/^content\//, "").replace(/^\/+/, "");
    // Return path ensuring it's within content directory
    return cleanPath;
  }

  async readFile(filePath: string): Promise<string> {
    try {
      const contentPath = this.ensureContentPath(filePath);
      const data = await this.handleRequest<{ content: string }>(
        `/file?path=${encodeURIComponent(contentPath)}`
      );
      return data.content;
    } catch (error) {
      throw new GitError(
        `Failed to read file ${filePath}: ${(error as Error).message}`,
        "READ_ERROR"
      );
    }
  }

  async saveFile(filePath: string, content: string): Promise<void> {
    try {
      const contentPath = this.ensureContentPath(filePath);
      await this.handleRequest("/file", {
        method: "POST",
        body: JSON.stringify({ path: contentPath, content }),
      });
    } catch (error) {
      throw new GitError(
        `Failed to save file ${filePath}: ${(error as Error).message}`,
        "SAVE_ERROR"
      );
    }
  }

  async commitChanges(message: string): Promise<string> {
    try {
      const data = await this.handleRequest<{ commitId: string }>("/git/commit", {
        method: "POST",
        body: JSON.stringify({ message }),
      });
      return data.commitId;
    } catch (error) {
      throw new GitError(
        `Failed to commit changes: ${(error as Error).message}`,
        "COMMIT_ERROR"
      );
    }
  }

  async getStatus(): Promise<StatusMatrix> {
    try {
      const data = await this.handleRequest<{ status: StatusMatrix }>("/git/status");
      return data.status;
    } catch (error) {
      throw new GitError(
        `Failed to get status: ${(error as Error).message}`,
        "STATUS_ERROR"
      );
    }
  }

  async push(): Promise<void> {
    try {
      await this.handleRequest("/git/push", {
        method: "POST",
        body: JSON.stringify({
          remote: this.config.remote,
          branch: this.config.branch,
        }),
      });
    } catch (error) {
      const err = error as GitError;
      if (err.code === "AUTH_ERROR") {
        throw new GitError(
          "Git authentication failed. Please ensure you have configured Git credentials.",
          "AUTH_ERROR"
        );
      }
      throw new GitError(
        `Failed to push changes: ${err.message}`,
        "PUSH_ERROR"
      );
    }
  }

  async pull(): Promise<void> {
    try {
      await this.handleRequest("/git/pull", {
        method: "POST",
        body: JSON.stringify({
          remote: this.config.remote,
          branch: this.config.branch,
        }),
      });
    } catch (error) {
      const err = error as GitError;
      if (err.code === "AUTH_ERROR") {
        throw new GitError(
          "Git authentication failed. Please ensure you have configured Git credentials.",
          "AUTH_ERROR"
        );
      }
      throw new GitError(
        `Failed to pull changes: ${err.message}`,
        "PULL_ERROR"
      );
    }
  }

  async resolveConflicts(filePath: string, content: string): Promise<void> {
    try {
      await this.saveFile(filePath, content);
      await this.commitChanges(`Resolve conflicts in ${filePath}`);
    } catch (error) {
      throw new GitError(
        `Failed to resolve conflicts: ${(error as Error).message}`,
        "CONFLICT_ERROR"
      );
    }
  }

  async getHistory(filePath: string): Promise<GitCommit[]> {
    try {
      const data = await this.handleRequest<{ history: GitCommit[] }>(
        `/git/history?path=${encodeURIComponent(filePath)}`
      );
      return data.history;
    } catch (error) {
      throw new GitError(
        `Failed to get history: ${(error as Error).message}`,
        "HISTORY_ERROR"
      );
    }
  }

  async revertChanges(filePath: string): Promise<void> {
    try {
      await this.handleRequest("/git/revert", {
        method: "POST",
        body: JSON.stringify({ path: filePath }),
      });
    } catch (error) {
      throw new GitError(
        `Failed to revert changes: ${(error as Error).message}`,
        "REVERT_ERROR"
      );
    }
  }
}
