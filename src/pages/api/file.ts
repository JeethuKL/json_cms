import { NextApiRequest, NextApiResponse } from "next";
import path from "path";
import { z } from "zod";
import { ValidationService, ValidationError } from "@/services/validation";

const validationService = new ValidationService();

// Request validation schemas
const ReadFileQuerySchema = z.object({
  path: z.string().min(1),
});

const WriteFileBodySchema = z.object({
  path: z.string().min(1),
  content: z.string(),
});

interface ErrorResponse {
  error: string;
  details?: unknown;
}

import fs from "fs/promises";

function ensureContentPath(filePath: string): string {
  // Remove any existing content/ prefix and leading slashes
  const cleanPath = filePath.replace(/^content\//, "").replace(/^\/+/, "");
  // Ensure path is within content directory
  return path.join('content', cleanPath);
}

async function readFile(filePath: string): Promise<string> {
  try {
    // Try to read from local content directory first (which should be part of deployment)
    const contentPath = ensureContentPath(filePath);
    const localPath = path.join(process.cwd(), contentPath);
    const content = await fs.readFile(localPath, 'utf-8');
    return content;
  } catch (error) {
    // If local file doesn't exist, try GitHub if configured
    const token = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPO;
    const owner = process.env.GITHUB_OWNER;
    const branch = process.env.GITHUB_BRANCH || 'main';

    if (!token || !repo || !owner) {
      throw new Error('File not found locally and GitHub is not configured');
    }

    // Ensure consistent path handling
    const contentPath = ensureContentPath(filePath);
    
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${contentPath}?ref=${branch}`,
      {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3.raw',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('File not found in both local and GitHub');
      }
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    return response.text();
  }
}

async function writeFileToGitHub(filePath: string, content: string): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const owner = process.env.GITHUB_OWNER;
  const branch = process.env.GITHUB_BRANCH || 'main';

  if (!token || !repo || !owner) {
    throw new Error('GitHub configuration is required for writing files. Please set GITHUB_TOKEN, GITHUB_REPO, and GITHUB_OWNER in .env.local');
  }

  // Ensure file is in content directory
  const contentPath = ensureContentPath(filePath);

  // Get current file SHA if it exists
  const currentFileResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${contentPath}?ref=${branch}`,
    {
      headers: {
        Authorization: `token ${token}`,
      },
    }
  );

  let sha: string | undefined;
  if (currentFileResponse.ok) {
    const currentFile = await currentFileResponse.json();
    sha = currentFile.sha;
  }

  // Update file in GitHub
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${contentPath}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `token ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Update ${contentPath}`,
        content: Buffer.from(content).toString('base64'),
        branch,
        ...(sha ? { sha } : {}),
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.statusText}`);
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ content: string } | ErrorResponse>
) {
  try {
    if (req.method === "GET") {
      // Read file
      const query = ReadFileQuerySchema.parse(req.query);
      const content = await readFile(query.path);
      
      // Validate JSON syntax by trying to parse it
      JSON.parse(content);
      
      return res.status(200).json({ content });

    } else if (req.method === "POST") {
      // Write file
      const body = WriteFileBodySchema.parse(req.body);
      
      // Validate JSON before saving
      await validationService.validateJson(body.path, body.content);
      
      await writeFileToGitHub(body.path, body.content);
      return res.status(200).json({ content: body.content });

    } else {
      return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("File operation error:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid request",
        details: error.errors,
      });
    }

    if (error instanceof ValidationError) {
      return res.status(400).json({
        error: error.message,
        details: error.errors,
      });
    }

    return res.status(500).json({
      error: "Internal server error",
      details: (error as Error).message,
    });
  }
}
