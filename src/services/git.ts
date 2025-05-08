import fs from "fs";
import path from "path";
import git from "isomorphic-git";
import http from "isomorphic-git/http/node";

type StatusMatrix = Array<[string, number, number, number]>;
type CommitResult = {
  oid: string;
  commit: { message: string; tree: string; parent: string[] };
};

type LogEntry = {
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
};

export class GitService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = "/api";
  }

  async readFile(filePath: string): Promise<string> {
    const cleanPath = filePath.replace(/^content\//, "");
    const response = await fetch(
      `${this.baseUrl}/file?path=${encodeURIComponent(cleanPath)}`
    );
    if (!response.ok) {
      throw new Error(`Failed to read file: ${response.statusText}`);
    }
    const data = await response.json();
    return data.content;
  }

  async saveFile(filePath: string, content: string): Promise<void> {
    const cleanPath = filePath.replace(/^content\//, "");
    const response = await fetch(`${this.baseUrl}/file`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path: cleanPath, content }),
    });
    if (!response.ok) {
      throw new Error(`Failed to save file: ${response.statusText}`);
    }
  }

  async commitChanges(message: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/git/commit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    });
    if (!response.ok) {
      throw new Error(`Failed to commit changes: ${response.statusText}`);
    }
    const data = await response.json();
    return data.commitId;
  }

  async getStatus(): Promise<Array<[string, number, number, number]>> {
    const response = await fetch(`${this.baseUrl}/git/status`);
    if (!response.ok) {
      throw new Error(`Failed to get status: ${response.statusText}`);
    }
    const data = await response.json();
    return data.status;
  }

  async getHistory(filepath: string): Promise<Array<LogEntry>> {
    const commits = await git.log({
      fs,
      dir: this.dir,
      filepath,
    });

    return commits;
  }

  async checkout(ref: string): Promise<void> {
    await git.checkout({
      fs,
      dir: this.dir,
      ref,
    });
  }

  async push(
    remote: string = "origin",
    branch: string = "main"
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/git/push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ remote, branch }),
    });
    if (!response.ok) {
      throw new Error(`Failed to push changes: ${response.statusText}`);
    }
  }

  async pull(
    remote: string = "origin",
    branch: string = "main"
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/git/pull`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ remote, branch }),
    });
    if (!response.ok) {
      throw new Error(`Failed to pull changes: ${response.statusText}`);
    }
  }
}
