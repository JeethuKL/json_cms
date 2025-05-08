import { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const contentDir = path.join(process.cwd(), "content");

  if (req.method === "GET") {
    try {
      const filePath = req.query.path as string;
      if (!filePath) {
        return res.status(400).json({ error: "File path is required" });
      }

      // Remove any leading 'content/' from the path since we'll add it
      const cleanPath = filePath.replace(/^content\//, "");
      const fullPath = path.join(contentDir, cleanPath);

      // Security check to prevent directory traversal
      if (!fullPath.startsWith(contentDir)) {
        return res.status(403).json({ error: "Access denied" });
      }

      console.log("Reading file from:", fullPath);
      const content = await fs.promises.readFile(fullPath, "utf8");
      res.status(200).json({ content });
    } catch (error) {
      console.error("Error reading file:", error);
      res.status(500).json({ error: "Failed to read file" });
    }
  } else if (req.method === "POST") {
    try {
      const { path: filePath, content } = req.body;
      if (!filePath || content === undefined) {
        return res
          .status(400)
          .json({ error: "File path and content are required" });
      }

      // Remove any leading 'content/' from the path since we'll add it
      const cleanPath = filePath.replace(/^content\//, "");
      const fullPath = path.join(contentDir, cleanPath);

      // Security check to prevent directory traversal
      if (!fullPath.startsWith(contentDir)) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Ensure the directory exists
      await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });

      await fs.promises.writeFile(fullPath, content, "utf8");
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error writing file:", error);
      res.status(500).json({ error: "Failed to write file" });
    }
  } else {
    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}
