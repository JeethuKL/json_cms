import fs from "fs";
import path from "path";
import { spawn } from "child_process";

interface StartOptions {
  port: number;
  host: string;
}

async function isNextProject(): Promise<boolean> {
  const packageJsonPath = path.join(process.cwd(), "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    return !!packageJson.dependencies?.next || !!packageJson.devDependencies?.next;
  } catch {
    return false;
  }
}

function runCommand(command: string, args: string[], options: { env: NodeJS.ProcessEnv }): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: options.env,
      shell: true,
    });

    child.on("error", (error) => {
      reject(new Error(`Failed to start server: ${error.message}`));
    });

    child.on("exit", (code) => {
      if (code === 0 || code === null) {
        resolve();
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });
  });
}

export async function startEditor(options: StartOptions): Promise<void> {
  const { port, host } = options;

  // Check if we're in a project directory
  if (!fs.existsSync(path.join(process.cwd(), "content"))) {
    throw new Error(
      "No content directory found. Please run this command in a JSON CMS project directory."
    );
  }

  // Set up environment variables
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: port.toString(),
    HOSTNAME: host,
    NEXT_PUBLIC_API_BASE_URL: `http://${host}:${port}`,
  };

  // Check if this is a Next.js project
  const isNext = await isNextProject();

  if (isNext) {
    console.log("📦 Starting development server...");
    await runCommand("next", ["dev", "-p", port.toString()], { env });
  } else {
    // If it's not a Next.js project, we need to install and run the standalone editor
    console.log("🚀 Starting JSON CMS editor...");

    // Create temporary next.config.js if it doesn't exist
    const nextConfigPath = path.join(process.cwd(), "next.config.js");
    if (!fs.existsSync(nextConfigPath)) {
      fs.writeFileSync(
        nextConfigPath,
        `
module.exports = {
  reactStrictMode: true,
  pageExtensions: ["tsx", "ts", "jsx", "js"],
};
`.trim()
      );
    }

    // Run the editor
    try {
      await runCommand("npx", ["next", "dev", "-p", port.toString()], { env });
    } catch (error) {
      console.error("Failed to start editor:", (error as Error).message);
      process.exit(1);
    }
  }

  console.log(`\n🌎 JSON CMS editor is running at http://${host}:${port}/editor`);
  console.log("\nPress Ctrl+C to stop the server");
}
