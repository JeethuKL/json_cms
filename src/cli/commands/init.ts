import fs from "fs";
import path from "path";
import { execSync } from "child_process";

export async function initProject() {
  console.log("Initializing JSON CMS project...");

  // Create project structure
  const directories = [
    "content",
    "src/pages",
    "src/components/editor",
    "src/services",
    "src/hooks",
    "src/store",
  ];

  directories.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Initialize Git if not already initialized
  if (!fs.existsSync(".git")) {
    execSync("git init");
    console.log("Initialized Git repository");
  }

  // Create initial content directory
  const contentDir = path.join(process.cwd(), "content");
  if (!fs.existsSync(path.join(contentDir, "example.json"))) {
    fs.writeFileSync(
      path.join(contentDir, "example.json"),
      JSON.stringify(
        { title: "Example Content", body: "Edit this content in the CMS" },
        null,
        2
      )
    );
  }

  console.log("Project initialized successfully!");
  console.log("Run `npm install` to install dependencies");
  console.log("Then run `json-cms start` to launch the editor");
}
