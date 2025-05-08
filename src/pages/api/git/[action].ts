import { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
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

// Git utility functions
async function getGitConfig() {
  try {
    const config = {
      name: await git.getConfig({ fs, dir, path: "user.name" }),
      email: await git.getConfig({ fs, dir, path: "user.email" }),
    };

    // If local config is missing, try global config
    if (!config.name || !config.email) {
      const globalDir = process.env.HOME || process.env.USERPROFILE;
      if (globalDir) {
        if (!config.name) {
          config.name = await git.getConfig({
            fs,
            dir: globalDir,
            path: "user.name",
          });
        }
        if (!config.email) {
          config.email = await git.getConfig({
            fs,
            dir: globalDir,
            path: "user.email",
          });
        }
      }
    }

    // Fall back to default values if still not found
    return {
      name: config.name || "JSON CMS",
      email: config.email || "json-cms@example.com",
    };
  } catch (error) {
    console.warn("Failed to get git config:", error);
    return {
      name: "JSON CMS",
      email: "json-cms@example.com",
    };
  }
}

// Error handling
function handleGitError(error: unknown) {
  console.error("Git operation failed:", error);
  if (error instanceof Error) {
    const gitError = error as any; // isomorphic-git errors have additional properties
    
    // Handle missing configuration
    if (gitError.code === 'MissingNameError') {
      return {
        message: "Git username not configured. Please run: git config --global user.name 'Your Name'",
        code: "CONFIG_ERROR",
      };
    }
    if (gitError.code === 'MissingEmailError') {
      return {
        message: "Git email not configured. Please run: git config --global user.email 'your@email.com'",
        code: "CONFIG_ERROR",
      };
    }
    
    // Handle authentication errors
    if (gitError.code === 'HttpError' && gitError.data?.statusCode === 401) {
      return {
        message: "Git authentication failed. Please ensure you have the correct credentials configured.",
        code: "AUTH_ERROR",
      };
    }

    // Handle other common git errors
    if (gitError.code === 'CheckoutConflictError') {
      return {
        message: "Git checkout conflict. Please resolve conflicts and try again.",
        code: "CONFLICT_ERROR",
      };
    }

    return {
      message: error.message,
      code: gitError.code || "GIT_ERROR",
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
    const config = await getGitConfig();

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
            name: config.name,
            email: config.email,
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
        
        // Use local git credentials
        const url = await git.getConfig({ fs, dir, path: `remote.${pushData.remote}.url` });
        if (!url) {
          throw new Error(`Remote ${pushData.remote} not found`);
        }

        await git.push({
          fs,
          http,
          dir,
          remote: pushData.remote,
          ref: pushData.branch,
          onAuth: () => ({ cancel: false }), // Use local git credentials
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
          onAuth: () => ({ cancel: false }), // Use local git credentials
          author: {
            name: config.name,
            email: config.email,
          },
        });
        return res.status(200).json({ success: true });

      case "history":
        if (req.method !== "GET") {
          return res.status(405).json({ error: "Method not allowed" });
        }
        const { path: filePath } = req.query;
        if (!filePath || typeof filePath !== "string") {
          return res.status(400).json({ error: "Path parameter is required" });
        }
        const history = await git.log({
          fs,
          dir,
          filepath: filePath,
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
