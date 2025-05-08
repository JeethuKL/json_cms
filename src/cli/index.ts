#!/usr/bin/env node

import { Command } from "commander";
import { initProject } from "./commands/init";
import { startEditor } from "./commands/start";

const program = new Command();

program
  .name("json-cms")
  .description("Git-based JSON CMS for Next.js projects")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize a new JSON CMS project")
  .action(initProject);

program
  .command("start")
  .description("Start the JSON CMS editor")
  .option("-p, --port <port>", "port to run the editor on", "3000")
  .action(startEditor);

program.parse();
