import { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

// Validation schemas
const CommitSchema = z.object({
  message: z.string().min(1),
});

const GitOperationSchema = z.object({
  remote: z.string().default("origin"),
  branch: z.string().default("main"),
});

const RevertOperationSchema = z.object({
  path: z.string().min(1),
  ref: z.string().optional(),
});

interface GitHubTreeResponse {
  sha: string;
  tree: Array<{
    path: string;
    mode: string;
    type: string;
    sha: string;
    url: string;
  }>;
}

interface GitHubCommitResponse {
  sha: string;
}

async function getGitHubApi() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const owner = process.env.GITHUB_OWNER;
  const branch = process.env.GITHUB_BRANCH || 'main';

  if (!token || !repo || !owner) {
    throw new Error('GitHub configuration is missing. Please set GITHUB_TOKEN, GITHUB_REPO, and GITHUB_OWNER in .env.local');
  }

  const baseUrl = `https://api.github.com/repos/${owner}/${repo}`;
  const headers = {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };

  return { baseUrl, headers, branch };
}

async function getCurrentCommit(baseUrl: string, headers: HeadersInit, branch: string) {
  const response = await fetch(`${baseUrl}/git/refs/heads/${branch}`, {
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to get current commit: ${response.statusText}`);
  }

  const data = await response.json();
  return data.object.sha;
}

async function createTree(
  baseUrl: string, 
  headers: HeadersInit, 
  files: Array<{ path: string; content: string }>,
  baseTree: string
) {
  const response = await fetch(`${baseUrl}/git/trees`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      base_tree: baseTree,
      tree: files.map(file => ({
        path: file.path,
        mode: '100644',
        type: 'blob',
        content: file.content,
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create tree: ${response.statusText}`);
  }

  return (await response.json() as GitHubTreeResponse).sha;
}

async function createCommit(
  baseUrl: string,
  headers: HeadersInit,
  message: string,
  treeSha: string,
  parentCommitSha: string
) {
  const response = await fetch(`${baseUrl}/git/commits`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message,
      tree: treeSha,
      parents: [parentCommitSha],
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create commit: ${response.statusText}`);
  }

  return (await response.json() as GitHubCommitResponse).sha;
}

async function updateRef(
  baseUrl: string,
  headers: HeadersInit,
  branch: string,
  commitSha: string
) {
  const response = await fetch(`${baseUrl}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      sha: commitSha,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update ref: ${response.statusText}`);
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { action } = req.query;

  try {
    const { baseUrl, headers, branch } = await getGitHubApi();

    switch (action) {
      case "commit":
        if (req.method !== "POST") {
          return res.status(405).json({ error: "Method not allowed" });
        }
        
        const commitData = CommitSchema.parse(req.body);
        const currentCommit = await getCurrentCommit(baseUrl, headers, branch);
        
        // In a real implementation, you'd gather all changed files here
        // For now, we're just creating an empty commit
        const treeSha = await createTree(baseUrl, headers, [], currentCommit);
        const newCommit = await createCommit(
          baseUrl,
          headers,
          commitData.message,
          treeSha,
          currentCommit
        );
        
        await updateRef(baseUrl, headers, branch, newCommit);
        return res.status(200).json({ commitId: newCommit });

      case "status":
        if (req.method !== "GET") {
          return res.status(405).json({ error: "Method not allowed" });
        }

        // Since we're now using local files, GitHub integration is optional
        // Return a status indicating GitHub configuration state
        return res.status(200).json({ 
          status: [],
          github: {
            configured: true,
            repo: process.env.GITHUB_REPO,
            owner: process.env.GITHUB_OWNER,
            branch
          }
        });

      case "branch":
        if (req.method === "GET") {
          // When GitHub isn't configured, return the default branch
          const defaultBranch = "main";
          return res.status(200).json({ 
            branch: branch || defaultBranch,
            github: {
              configured: true,
              repo: process.env.GITHUB_REPO,
              owner: process.env.GITHUB_OWNER
            }
          });
        }
        return res.status(405).json({ error: "Method not allowed" });

      default:
        return res.status(400).json({ error: "Invalid action" });
    }
    } catch (error) {
      console.error(`Error in Git operation (${action}):`, error);
      
      // Special handling for missing GitHub configuration
      if (error instanceof Error && error.message.includes('GitHub configuration is missing')) {
        if (action === "status" || action === "branch") {
          // For status and branch endpoints, return success response with GitHub unconfigured state
          return res.status(200).json({
            status: [],
            github: {
              configured: false,
              message: "GitHub integration is not configured. Set GITHUB_TOKEN, GITHUB_REPO, and GITHUB_OWNER in .env.local to enable GitHub features."
            }
          });
        }
      }

      // Handle other errors
      if (error instanceof Error) {
        if (error.message.includes('authentication') || error.message.includes('401')) {
          return res.status(401).json({
            message: "GitHub authentication failed. Please check your GITHUB_TOKEN.",
            code: "AUTH_ERROR",
          });
        }
        return res.status(500).json({
          message: error.message,
          code: "GIT_ERROR",
        });
      }
      return res.status(500).json({
        message: "Unknown error occurred",
        code: "UNKNOWN_ERROR",
      });
  }
}
