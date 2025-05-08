import { spawn } from "child_process";
import path from "path";

interface StartOptions {
  port: string;
}

export async function startEditor(options: StartOptions) {
  const port = options.port || "3000";

  console.log(`Starting JSON CMS editor on port ${port}...`);

  const nextBin = path.join(process.cwd(), "node_modules", ".bin", "next");

  const editorProcess = spawn(nextBin, ["dev", "-p", port], {
    stdio: "inherit",
    shell: true,
  });

  editorProcess.on("error", (error) => {
    console.error("Failed to start editor:", error);
    process.exit(1);
  });

  process.on("SIGINT", () => {
    editorProcess.kill();
    process.exit();
  });
}
