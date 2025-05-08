import { NextApiRequest, NextApiResponse } from "next";
import fs from "fs/promises";
import path from "path";
import { ValidationError } from "@/services/validation";

interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

interface ErrorResponse {
  error: string;
  details?: unknown;
}

function getContentDirectory(): string {
  return path.join(process.cwd(), "content");
}

function isJsonFile(filename: string): boolean {
  return filename.toLowerCase().endsWith(".json");
}

async function getGitHubContents(path: string = ''): Promise<FileNode[]> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const owner = process.env.GITHUB_OWNER;
  const branch = process.env.GITHUB_BRANCH || 'main';

  if (!token || !repo || !owner) {
    return [];
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  );

  if (!response.ok) {
    if (response.status === 404) {
      return [];
    }
    throw new Error(`GitHub API error: ${response.statusText}`);
  }

  const contents = await response.json();
  const nodes: FileNode[] = [];

  for (const item of contents) {
    // Skip hidden files and non-JSON files
    if (item.name.startsWith(".") || (item.type === "file" && !isJsonFile(item.name))) {
      continue;
    }

    if (item.type === "dir") {
      const children = await getGitHubContents(item.path);
      if (children.length > 0) {
        nodes.push({
          name: item.name,
          path: item.path,
          type: "directory",
          children,
        });
      }
    } else {
      nodes.push({
        name: item.name,
        path: item.path,
        type: "file",
      });
    }
  }

  // Sort: directories first, then files, both alphabetically
  return nodes.sort((a, b) => {
    if (a.type === b.type) {
      return a.name.localeCompare(b.name);
    }
    return a.type === "directory" ? -1 : 1;
  });
}

async function buildFileTree(dir: string): Promise<FileNode[]> {
  try {
    // Try to read from local content directory first
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const nodes: FileNode[] = [];

    for (const entry of entries) {
      // Skip hidden files and non-JSON files
      if (entry.name.startsWith(".") || (!entry.isDirectory() && !isJsonFile(entry.name))) {
        continue;
      }

      if (entry.isDirectory()) {
        const children = await buildFileTree(path.join(dir, entry.name));
        if (children.length > 0) {
          nodes.push({
            name: entry.name,
            path: entry.name,
            type: "directory",
            children,
          });
        }
      } else {
        nodes.push({
          name: entry.name,
          path: entry.name,
          type: "file",
        });
      }
    }

    // Sort: directories first, then files, both alphabetically
    const sortedNodes = nodes.sort((a, b) => {
      if (a.type === b.type) {
        return a.name.localeCompare(b.name);
      }
      return a.type === "directory" ? -1 : 1;
    });

    // If no local files found, try GitHub
    if (sortedNodes.length === 0) {
      return await getGitHubContents();
    }

    return sortedNodes;

  } catch (error) {
    // If local read fails, try GitHub
    console.warn("Failed to read local directory, trying GitHub:", error);
    return await getGitHubContents();
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<FileNode[] | ErrorResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const contentDir = getContentDirectory();
    const fileTree = await buildFileTree(contentDir);
    return res.status(200).json(fileTree);

  } catch (error) {
    console.error("Failed to list files:", error);

    if (error instanceof ValidationError) {
      return res.status(400).json({
        error: error.message,
        details: error.errors,
      });
    }

    return res.status(500).json({
      error: "Failed to list files",
      details: (error as Error).message,
    });
  }
}
