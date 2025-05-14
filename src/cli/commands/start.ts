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
    return (
      !!packageJson.dependencies?.next || !!packageJson.devDependencies?.next
    );
  } catch {
    return false;
  }
}

async function runCommand(
  command: string,
  args: string[],
  options: { env?: NodeJS.ProcessEnv } = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: true,
      env: options.env,
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });

    child.on("error", (error) => {
      reject(error);
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
  };

  // Check if this is a Next.js project
  const isNext = await isNextProject();

  if (isNext) {
    console.log("📦 Starting development server...");
    console.log(
      `\nThe CMS will be available at: http://${host}:${port}/editor`
    );
    console.log(`The home page will be available at: http://${host}:${port}`);
    await runCommand("npm", ["run", "dev"], { env });
  } else {
    throw new Error(
      "This is not a Next.js project. Please run this command in a valid Next.js project directory."
    );
  }
}
