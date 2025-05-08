import { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const contentDir = path.join(process.cwd(), "content");

  try {
    const files = await fs.promises.readdir(contentDir, {
      withFileTypes: true,
    });
    const fileTree = await Promise.all(
      files.map(async (entry) => {
        const fullPath = path.join(contentDir, entry.name);
        const relativePath = path.relative(process.cwd(), fullPath);

        if (entry.isDirectory()) {
          const children = await fs.promises.readdir(fullPath);
          return {
            name: entry.name,
            path: relativePath,
            isDirectory: true,
            children: children.map((child) => ({
              name: child,
              path: path.join(relativePath, child),
              isDirectory: false,
            })),
          };
        }

        return {
          name: entry.name,
          path: relativePath,
          isDirectory: false,
        };
      })
    );

    res.status(200).json(fileTree);
  } catch (error) {
    console.error("Error reading files:", error);
    res.status(500).json({ error: "Failed to read files" });
  }
}
