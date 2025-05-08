#!/usr/bin/env node
import { Command } from "commander";
import { initProject } from "./commands/init";
import { startEditor } from "./commands/start";
import fs from "fs";
import path from "path";

interface InitOptions {
  dir: string;
  gitUsername?: string;
  gitEmail?: string;
}

interface StartOptions {
  port: string;
  host: string;
}

const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../package.json"), "utf-8")
);

const program = new Command();

program
  .name("json-cms")
  .description("Git-based JSON CMS for Next.js projects")
  .version(packageJson.version);

program
  .command("init")
  .description("Initialize a new JSON CMS project")
  .option("-d, --dir <directory>", "Target directory", ".")
  .option("--git-username <username>", "Git username for commits")
  .option("--git-email <email>", "Git email for commits")
  .action(async (options: InitOptions) => {
    try {
      await initProject({
        directory: options.dir,
        gitConfig: {
          username: options.gitUsername,
          email: options.gitEmail,
        },
      });
    } catch (error) {
      console.error("Failed to initialize project:", (error as Error).message);
      process.exit(1);
    }
  });

program
  .command("start")
  .description("Start the JSON CMS editor")
  .option("-p, --port <number>", "Port number", "3000")
  .option("--host <hostname>", "Host address", "localhost")
  .action(async (options: StartOptions) => {
    try {
      await startEditor({
        port: parseInt(options.port, 10),
        host: options.host,
      });
    } catch (error) {
      console.error("Failed to start editor:", (error as Error).message);
      process.exit(1);
    }
  });

program.parse();
