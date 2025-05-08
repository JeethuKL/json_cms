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

async function getGitCredentials() {
  try {
    // Try to get credentials from git config
    const username = await git.getConfig({ fs, dir, path: "credential.username" });
    const token = await git.getConfig({ fs, dir, path: "credential.helper" });

    if (username && token) {
      return { username, password: token };
    }

    // Check for GIT_TOKEN environment variable
    if (process.env.GIT_TOKEN) {
      return {
        username: process.env.GIT_USERNAME || "git",
        password: process.env.GIT_TOKEN,
      };
    }

    // Check for SSH key
    const sshDir = path.join(process.env.HOME || process.env.USERPROFILE || "", ".ssh");
    if (fs.existsSync(path.join(sshDir, "id_rsa"))) {
      return { useSSH: true };
    }

    return null;
  } catch (error) {
    console.warn("Failed to get git credentials:", error);
    return null;
  }
}

// Error handling
function handleGitError(error: unknown) {
  console.error("Git operation failed:", error);
  if (error instanceof Error) {
    const gitError = error as any;
    
    if (gitError.code === 'HttpError' && gitError.data?.statusCode === 401) {
      return {
        message: "Git authentication failed. Please configure Git credentials using one of these methods:\n" +
                "1. Set GIT_TOKEN environment variable\n" +
                "2. Configure SSH key\n" +
                "3. Use git config to store credentials",
        code: "AUTH_ERROR",
      };
    }

    if (gitError.code === 'MissingNameError' || gitError.code === 'MissingEmailError') {
      return {
        message: "Git user not configured. Please run:\n" +
                "git config --global user.name 'Your Name'\n" +
                "git config --global user.email 'your@email.com'",
        code: "CONFIG_ERROR",
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
    const credentials = await getGitCredentials();

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

      case "push":
        if (req.method !== "POST") {
          return res.status(405).json({ error: "Method not allowed" });
        }
        const pushData = GitOperationSchema.parse(req.body);
        
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
          onAuth: () => credentials || { cancel: true },
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
          onAuth: () => credentials || { cancel: true },
          author: {
            name: config.name,
            email: config.email,
          },
        });
        return res.status(200).json({ success: true });

      case "status":
        if (req.method !== "GET") {
          return res.status(405).json({ error: "Method not allowed" });
        }
        const status = await git.statusMatrix({ fs, dir });
        return res.status(200).json({ status });

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
