import fs from "fs";
import path from "path";
import git from "isomorphic-git";
import http from "isomorphic-git/http/node";

export class GitService {
  private dir: string;

  constructor() {
    this.dir = process.cwd();
  }

  async readFile(filePath: string): Promise<string> {
    const fullPath = path.join(this.dir, filePath);
    return fs.promises.readFile(fullPath, "utf8");
  }

  async saveFile(filePath: string, content: string): Promise<void> {
    const fullPath = path.join(this.dir, filePath);
    await fs.promises.writeFile(fullPath, content, "utf8");
  }

  async commitChanges(message: string): Promise<string> {
    await git.add({ fs, dir: this.dir, filepath: "." });

    const commitResult = await git.commit({
      fs,
      dir: this.dir,
      message,
      author: {
        name: "JSON CMS",
        email: "json-cms@example.com",
      },
    });

    return commitResult;
  }

  async getStatus(): Promise<git.StatusMatrix> {
    return git.statusMatrix({ fs, dir: this.dir });
  }

  async getHistory(filepath: string): Promise<Array<git.CommitDescription>> {
    const commits = await git.log({
      fs,
      dir: this.dir,
      filepath,
    });

    return commits;
  }

  async checkout(ref: string): Promise<void> {
    await git.checkout({
      fs,
      dir: this.dir,
      ref,
    });
  }

  async push(
    remote: string = "origin",
    branch: string = "main"
  ): Promise<void> {
    await git.push({
      fs,
      http,
      dir: this.dir,
      remote,
      ref: branch,
    });
  }

  async pull(
    remote: string = "origin",
    branch: string = "main"
  ): Promise<void> {
    await git.pull({
      fs,
      http,
      dir: this.dir,
      remote,
      ref: branch,
    });
  }
}
