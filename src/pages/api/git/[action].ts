import { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import git from "isomorphic-git";
import http from "isomorphic-git/http/node";
import { z } from "zod";

const dir = process.cwd();

// Validation schemas
const CommitSchema = z.object({
  message: z.string().min(1),
});

const GitOperationSchema = z.object({
  remote: z.string().default("origin"),
  branch: z.string().default("main"),
});

const FileOperationSchema = z.object({
  path: z.string().min(1),
});

const RevertOperationSchema = z.object({
  path: z.string().min(1),
  ref: z.string().optional(),
});

// Error handling
function handleGitError(error: unknown) {
  console.error("Git operation failed:", error);
  if (error instanceof Error) {
    return {
      message: error.message,
      code: "GIT_ERROR",
    };
  }
  return {
    message: "Unknown error occurred",
    code: "UNKNOWN_ERROR",
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { action } = req.query;

  try {
    switch (action) {
      case "commit":
        if (req.method !== "POST") {
          return res.status(405).json({ error: "Method not allowed" });
        }
        const commitData = CommitSchema.parse(req.body);
        await git.add({ fs, dir, filepath: "." });
        const commitResult = await git.commit({
          fs,
          dir,
          message: commitData.message,
          author: {
            name: "JSON CMS",
            email: "json-cms@example.com",
          },
        });
        return res.status(200).json({ commitId: commitResult });

      case "status":
        if (req.method !== "GET") {
          return res.status(405).json({ error: "Method not allowed" });
        }
        const status = await git.statusMatrix({ fs, dir });
        return res.status(200).json({ status });

      case "push":
        if (req.method !== "POST") {
          return res.status(405).json({ error: "Method not allowed" });
        }
        const pushData = GitOperationSchema.parse(req.body);
        await git.push({
          fs,
          http,
          dir,
          remote: pushData.remote,
          ref: pushData.branch,
          onAuth: () => ({
            username: process.env.GIT_USERNAME || "",
            password: process.env.GIT_TOKEN || "",
          }),
        });
        return res.status(200).json({ success: true });

      case "pull":
        if (req.method !== "POST") {
          return res.status(405).json({ error: "Method not allowed" });
        }
        const pullData = GitOperationSchema.parse(req.body);
        await git.pull({
          fs,
          http,
          dir,
          remote: pullData.remote,
          ref: pullData.branch,
          onAuth: () => ({
            username: process.env.GIT_USERNAME || "",
            password: process.env.GIT_TOKEN || "",
          }),
        });
        return res.status(200).json({ success: true });

      case "history":
        if (req.method !== "GET") {
          return res.status(405).json({ error: "Method not allowed" });
        }
        const { path } = req.query;
        if (!path || typeof path !== "string") {
          return res.status(400).json({ error: "Path parameter is required" });
        }
        const history = await git.log({
          fs,
          dir,
          filepath: path,
        });
        return res.status(200).json({ history });

      case "revert":
        if (req.method !== "POST") {
          return res.status(405).json({ error: "Method not allowed" });
        }
        const revertData = RevertOperationSchema.parse(req.body);
        await git.checkout({
          fs,
          dir,
          ref: revertData.ref || "HEAD",
          force: true,
          filepaths: [revertData.path],
        });
        return res.status(200).json({ success: true });

      case "branch":
        if (req.method === "GET") {
          const currentBranch = await git.currentBranch({
            fs,
            dir,
            fullname: false,
          });
          return res.status(200).json({ branch: currentBranch });
        }
        return res.status(405).json({ error: "Method not allowed" });

      default:
        return res.status(400).json({ error: "Invalid action" });
    }
  } catch (error) {
    console.error(`Error in Git operation (${action}):`, error);
    const gitError = handleGitError(error);
    return res.status(500).json(gitError);
  }
}
