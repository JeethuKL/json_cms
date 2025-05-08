import { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
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

// Helper Functions
function getFullPath(relativePath: string): string {
  const contentDir = path.join(process.cwd(), "content");
  return path.join(contentDir, relativePath);
}

function ensureContentDirectory(): void {
  const contentDir = path.join(process.cwd(), "content");
  if (!fs.existsSync(contentDir)) {
    fs.mkdirSync(contentDir, { recursive: true });
  }
}

async function readJsonFile(filePath: string): Promise<string> {
  try {
    const content = await fs.promises.readFile(filePath, "utf-8");
    // Validate JSON syntax by trying to parse it
    JSON.parse(content);
    return content;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ValidationError("Invalid JSON file", [{
        code: "invalid_json",
        message: error.message,
        path: [],
      }]);
    }
    throw error;
  }
}

async function writeJsonFile(filePath: string, content: string): Promise<void> {
  try {
    // Validate JSON syntax and schema
    await validationService.validateJson(filePath, content);
    
    // Ensure the directory exists
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });

    // Write the file
    await fs.promises.writeFile(filePath, content, "utf-8");
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new Error(`Failed to write file: ${(error as Error).message}`);
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
      const fullPath = getFullPath(query.path);

      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: "File not found" });
      }

      const content = await readJsonFile(fullPath);
      return res.status(200).json({ content });

    } else if (req.method === "POST") {
      // Write file
      const body = WriteFileBodySchema.parse(req.body);
      const fullPath = getFullPath(body.path);

      ensureContentDirectory();
      await writeJsonFile(fullPath, body.content);
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
