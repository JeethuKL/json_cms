import { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
import git from "isomorphic-git";
import http from "isomorphic-git/http/node";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { action } = req.query;
  const dir = process.cwd();

  try {
    switch (action) {
      case "commit":
        if (req.method !== "POST") {
          return res.status(405).json({ error: "Method not allowed" });
        }
        const { message } = req.body;
        await git.add({ fs, dir, filepath: "." });
        const commitResult = await git.commit({
          fs,
          dir,
          message,
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
        const { remote = "origin", branch = "main" } = req.body;
        await git.push({
          fs,
          http,
          dir,
          remote,
          ref: branch,
        });
        return res.status(200).json({ success: true });

      case "pull":
        if (req.method !== "POST") {
          return res.status(405).json({ error: "Method not allowed" });
        }
        const pullParams = req.body;
        await git.pull({
          fs,
          http,
          dir,
          remote: pullParams.remote || "origin",
          ref: pullParams.branch || "main",
        });
        return res.status(200).json({ success: true });

      default:
        return res.status(400).json({ error: "Invalid action" });
    }
  } catch (error) {
    console.error(`Error in Git operation (${action}):`, error);
    return res.status(500).json({ error: "Git operation failed" });
  }
}
