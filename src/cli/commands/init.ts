import fs from "fs";
import path from "path";
import { execSync } from "child_process";

interface GitConfig {
  username?: string;
  email?: string;
}

interface InitOptions {
  directory: string;
  gitConfig?: GitConfig;
}

const TEMPLATE_FILES = {
  "content/example.json": {
    title: "Example Content",
    description: "Edit this content in the CMS",
    items: [
      { id: 1, name: "Item 1" },
      { id: 2, name: "Item 2" }
    ]
  },
  "content/schema/example.schema.json": {
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "object",
    required: ["title", "description", "items"],
    properties: {
      title: {
        type: "string",
        minLength: 1
      },
      description: {
        type: "string"
      },
      items: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "name"],
          properties: {
            id: {
              type: "number"
            },
            name: {
              type: "string",
              minLength: 1
            }
          }
        }
      }
    }
  }
};

export async function initProject(options: InitOptions): Promise<void> {
  const { directory, gitConfig } = options;

  console.log("Initializing JSON CMS project...");

  // Ensure target directory exists
  const targetDir = path.resolve(directory);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Create project structure
  const directories = [
    "content",
    "content/schema",
    "src/pages",
    "src/components/editor",
    "src/services",
    "src/hooks",
    "src/store",
  ];

  directories.forEach((dir) => {
    const fullPath = path.join(targetDir, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  });

  // Create template files
  Object.entries(TEMPLATE_FILES).forEach(([filePath, content]) => {
    const fullPath = path.join(targetDir, filePath);
    fs.writeFileSync(fullPath, JSON.stringify(content, null, 2));
  });

  // Initialize Git if not already initialized
  if (!fs.existsSync(path.join(targetDir, ".git"))) {
    try {
      process.chdir(targetDir);
      execSync("git init");
      console.log("✓ Initialized Git repository");

      // Configure Git user if provided
      if (gitConfig?.username) {
        execSync(`git config user.name "${gitConfig.username}"`);
      }
      if (gitConfig?.email) {
        execSync(`git config user.email "${gitConfig.email}"`);
      }

      // Create .gitignore
      const gitignore = [
        "node_modules/",
        ".next/",
        "dist/",
        ".env",
        ".env.local",
        "*.log"
      ].join("\n");
      fs.writeFileSync(path.join(targetDir, ".gitignore"), gitignore);

      // Initial commit
      execSync("git add .");
      execSync('git commit -m "Initial commit: JSON CMS setup"');
    } catch (error) {
      console.warn("Warning: Git initialization failed:", (error as Error).message);
    }
  }

  // Create or update package.json
  const packageJsonPath = path.join(targetDir, "package.json");
  const packageJson = fs.existsSync(packageJsonPath)
    ? JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"))
    : {};

  const updatedPackageJson = {
    ...packageJson,
    scripts: {
      ...packageJson.scripts,
      "cms": "json-cms start",
      "cms:dev": "json-cms start --port 3001"
    },
    dependencies: {
      ...packageJson.dependencies,
      "json-cms": "latest"
    }
  };

  fs.writeFileSync(
    packageJsonPath,
    JSON.stringify(updatedPackageJson, null, 2)
  );

  console.log("\n✨ Project initialized successfully!");
  console.log("\nNext steps:");
  console.log("1. Run 'npm install' to install dependencies");
  console.log("2. Run 'npm run cms' to start the editor");
  console.log("\nThe CMS will be available at: http://localhost:3000/editor");
}
