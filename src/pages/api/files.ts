import { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
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

async function buildFileTree(dir: string, basePath: string = ""): Promise<FileNode[]> {
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    const nodes: FileNode[] = [];

    for (const entry of entries) {
      // Skip hidden files and non-JSON files
      if (entry.name.startsWith(".") || (!entry.isDirectory() && !isJsonFile(entry.name))) {
        continue;
      }

      const relativePath = path.join(basePath, entry.name);
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const children = await buildFileTree(fullPath, relativePath);
        if (children.length > 0) {
          nodes.push({
            name: entry.name,
            path: relativePath,
            type: "directory",
            children,
          });
        }
      } else {
        nodes.push({
          name: entry.name,
          path: relativePath,
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
  } catch (error) {
    console.error("Error building file tree:", error);
    throw new Error(`Failed to read directory: ${(error as Error).message}`);
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

    // Create content directory if it doesn't exist
    if (!fs.existsSync(contentDir)) {
      fs.mkdirSync(contentDir, { recursive: true });
    }

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
