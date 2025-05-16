import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { default as inquirer } from "inquirer";
import { simpleGit } from "simple-git";

interface GitConfig {
  username?: string;
  email?: string;
}

interface InitOptions {
  directory: string;
  gitConfig?: GitConfig;
  router?: "app" | "pages";
  useSrc?: boolean;
}

const TEMPLATE_FILES = {
  "content/example.json": {
    title: "Welcome to JSON CMS",
    description:
      "This is a dynamic content management system for your Next.js application. Edit the content below using the CMS editor.",
    features: [
      {
        id: 1,
        title: "Easy Content Management",
        description: "Edit your JSON content through a user-friendly interface",
      },
      {
        id: 2,
        title: "Real-time Updates",
        description: "See your changes instantly on the website",
      },
      {
        id: 3,
        title: "Git Integration",
        description: "Track content changes with built-in version control",
      },
      {
        id: 4,
        title: "Schema Validation",
        description: "Ensure content structure remains consistent",
      },
    ],
    cta: {
      text: "Start Editing",
      link: "/editor",
    },
  },
  "content/schema/example.schema.json": {
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "object",
    required: ["title", "description", "items"],
    properties: {
      title: {
        type: "string",
        minLength: 1,
      },
      description: {
        type: "string",
      },
      items: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "name"],
          properties: {
            id: {
              type: "number",
            },
            name: {
              type: "string",
              minLength: 1,
            },
          },
        },
      },
    },
  },
};

// Editor component templates - updated with 'use client'
const EDITOR_COMPONENT = `'use client';

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useEditorStore } from "@/store/editorStore";
import { FileTree } from "@/components/editor/FileTree";
import { EditorToolbar } from "@/components/editor/EditorToolbar";

// Dynamically import Monaco editor to avoid SSR issues
const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((mod) => mod.default),
  { ssr: false }
);

export function EditorPage() {
  const {
    currentFile,
    content,
    isLoading,
    hasChanges,
    error,
    setContent,
  } = useEditorStore();

  return (
    <div className="flex bg-gray-100 h-screen">
      {/* Sidebar */}
      <div className="bg-white border-r w-64">
        <FileTree />
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1">
        <EditorToolbar />

        <div className="relative flex-1">
          {isLoading ? (
            <div className="absolute inset-0 flex justify-center items-center bg-white bg-opacity-75">
              Loading...
            </div>
          ) : currentFile ? (
            <MonacoEditor
              height="100%"
              language="json"
              theme="vs-light"
              value={content}
              onChange={(value) => setContent(value || "")}
              options={{
                minimap: { enabled: false },
                formatOnPaste: true,
                formatOnType: true,
                automaticLayout: true,
              }}
            />
          ) : (
            <div className="flex justify-center items-center h-full text-gray-500">
              Select a file to edit
            </div>
          )}

          {error && (
            <div className="right-0 bottom-0 left-0 absolute bg-red-100 p-4 text-red-700">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}`;

// File tree component
const FILE_TREE_COMPONENT = `'use client';

import { useEffect, useState, useCallback } from "react";
import { useEditorStore } from "@/store/editorStore";
import { contentService } from "@/services/contentService";
import { gitService } from "@/services/gitService";

interface FileItem {
  name: string;
  path: string;
  status?: string;
}

export function FileTree() {
  const { 
    setCurrentFile, 
    currentFile, 
    loadContent,
    isLoading,
    hasChanges 
  } = useEditorStore();
  const [files, setFiles] = useState<FileItem[]>([]);

  const loadFiles = useCallback(async () => {
    try {
      // Load files from content directory
      const contentFiles = await contentService.listContentFiles();
      
      // Get Git status for each file
      const filesWithStatus = await Promise.all(
        contentFiles.map(async (file) => {
          const status = await gitService.getFileStatus(file.path);
          return {
            ...file,
            status,
          };
        })
      );
      
      setFiles(filesWithStatus);
    } catch (error) {
      console.error("Error loading files:", error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  // Refresh when changes are made
  useEffect(() => {
    if (!hasChanges) {
      loadFiles();
    }
  }, [hasChanges, loadFiles]);

  function handleFileClick(file: FileItem) {
    if (isLoading) return;
    setCurrentFile(file.name);
    loadContent(file.name);
  }

  // Helper to render status icon
  function getStatusIcon(status?: string) {
    if (!status || status === "unmodified") return null;
    
    if (status === "modified") {
      return <span className="h-2 w-2 rounded-full bg-yellow-500 inline-block mr-1" title="Modified" />;
    }
    
    if (status === "added") {
      return <span className="h-2 w-2 rounded-full bg-green-500 inline-block mr-1" title="Added" />;
    }
    
    return <span className="h-2 w-2 rounded-full bg-gray-500 inline-block mr-1" title={status} />;
  }

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">Content Files</h2>
      
      <div className="space-y-1">
        {files.map((file) => (
          <div
            key={file.name}
            className={\`flex items-center p-2 rounded hover:bg-gray-100 cursor-pointer \${
              currentFile === file.name ? "bg-blue-50 border-l-4 border-blue-500" : ""
            }\`}
            onClick={() => handleFileClick(file)}
          >
            {getStatusIcon(file.status)}
            <span className="truncate">{file.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}`;

// Editor toolbar component
const EDITOR_TOOLBAR_COMPONENT = `'use client';

import { useState } from "react";
import { useEditorStore } from "@/store/editorStore";
import { gitService } from "@/services/gitService";

export function EditorToolbar() {
  const { 
    currentFile, 
    hasChanges, 
    saveContent,
    refreshContent 
  } = useEditorStore();
  const [commitMessage, setCommitMessage] = useState("");
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitError, setCommitError] = useState("");

  async function handleSave() {
    if (!currentFile) return;
    await saveContent();
  }

  async function handleCommit() {
    if (!currentFile || !commitMessage.trim()) return;
    
    setIsCommitting(true);
    setCommitError("");
    
    try {
      // First save any pending changes
      await saveContent();
      
      // Then commit to Git
      await gitService.commitChanges(commitMessage);
      
      // Clear commit message after successful commit
      setCommitMessage("");
      
      // Refresh content to update Git status
      refreshContent();
    } catch (error) {
      console.error("Error committing changes:", error);
      setCommitError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsCommitting(false);
    }
  }

  return (
    <div className="bg-white border-b p-4 flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <h1 className="text-xl font-semibold">
          {currentFile || "JSON CMS Editor"}
        </h1>
        {currentFile && hasChanges && (
          <span className="text-yellow-500 text-sm">(unsaved changes)</span>
        )}
      </div>
      
      <div className="flex items-center space-x-4">
        {currentFile && (
          <>
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className={\`px-3 py-1 rounded \${
                hasChanges
                  ? "bg-blue-500 text-white hover:bg-blue-600"
                  : "bg-gray-200 text-gray-500 cursor-not-allowed"
              }\`}
            >
              Save
            </button>
            
            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Commit message"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                className="border rounded px-2 py-1 w-48"
              />
              <button
                onClick={handleCommit}
                disabled={isCommitting || !commitMessage.trim()}
                className={\`px-3 py-1 rounded \${
                  isCommitting || !commitMessage.trim()
                    ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                    : "bg-green-500 text-white hover:bg-green-600"
                }\`}
              >
                {isCommitting ? "Committing..." : "Commit"}
              </button>
            </div>
          </>
        )}
      </div>
      
      {commitError && (
        <div className="absolute top-16 right-4 bg-red-100 text-red-700 p-2 rounded">
          {commitError}
        </div>
      )}
    </div>
  );
}`;

// Advanced editor store
const EDITOR_STORE = `'use client';

import { create } from 'zustand';
import { contentService } from '@/services/contentService';

interface EditorState {
  currentFile: string | null;
  content: string;
  originalContent: string;
  isLoading: boolean;
  error: string | null;
  hasChanges: boolean;
  
  setCurrentFile: (file: string | null) => void;
  setContent: (content: string) => void;
  loadContent: (filename: string) => Promise<void>;
  saveContent: () => Promise<void>;
  refreshContent: () => Promise<void>;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  currentFile: null,
  content: "",
  originalContent: "",
  isLoading: false,
  error: null,
  hasChanges: false,
  
  setCurrentFile: (file) => set({ currentFile: file }),
  
  setContent: (content) => {
    set(state => ({ 
      content, 
      hasChanges: content !== state.originalContent 
    }));
  },
  
  loadContent: async (filename) => {
    set({ isLoading: true, error: null });
    
    try {
      const content = await contentService.getContent(filename);
      const contentStr = JSON.stringify(content, null, 2);
      
      set({ 
        content: contentStr,
        originalContent: contentStr,
        currentFile: filename,
        hasChanges: false
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : String(error) 
      });
    } finally {
      set({ isLoading: false });
    }
  },
  
  saveContent: async () => {
    const { currentFile, content } = get();
    
    if (!currentFile) return;
    
    set({ isLoading: true, error: null });
    
    try {
      // Parse JSON to validate and format
      const parsedContent = JSON.parse(content);
      
      // Save content
      await contentService.saveContent(currentFile, parsedContent);
      
      // Update original content to mark as saved
      set({ 
        originalContent: content,
        hasChanges: false
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : String(error) 
      });
    } finally {
      set({ isLoading: false });
    }
  },
  
  refreshContent: async () => {
    const { currentFile } = get();
    if (currentFile) {
      await get().loadContent(currentFile);
    }
  }
}));`;

// Content service that uses API calls instead of direct fs access
const SERVICE_TEMPLATE = `/**
 * ContentService - Handles content operations through API calls
 */
class ContentService {
  private apiBase: string;

  constructor() {
    // Use relative URL for API endpoints
    this.apiBase = '/api/content';
  }

  /**
   * Get a list of all content files
   */
  async listContentFiles() {
    try {
      const response = await fetch(this.apiBase);
      if (!response.ok) throw new Error('Failed to fetch content files');
      return await response.json();
    } catch (error) {
      console.error('Error listing content files:', error);
      return [];
    }
  }

  /**
   * Read content from a file
   */
  async getContent(filename: string) {
    try {
      const response = await fetch(\`\${this.apiBase}?file=\${encodeURIComponent(filename)}\`);
      if (!response.ok) throw new Error(\`Failed to fetch content: \${filename}\`);
      return await response.json();
    } catch (error) {
      console.error(\`Error reading content file \${filename}:\`, error);
      throw new Error(\`Failed to read content file \${filename}\`);
    }
  }

  /**
   * Write content to a file
   */
  async saveContent(filename: string, content: any) {
    try {
      const response = await fetch(this.apiBase, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename, content }),
      });
      
      if (!response.ok) throw new Error('Failed to save content');
      return await response.json();
    } catch (error) {
      console.error(\`Error saving content file \${filename}:\`, error);
      throw new Error(\`Failed to save content file \${filename}\`);
    }
  }
}

export const contentService = new ContentService();
export default contentService;
`;

// Git service that uses API calls instead of direct Git operations
const GIT_SERVICE_TEMPLATE = `/**
 * GitService - Handles Git operations through API calls
 */
class GitService {
  private apiBase: string;
  
  constructor() {
    // Use relative URL for API endpoints
    this.apiBase = '/api/git';
  }
  
  /**
   * Get the status of a specific file
   */
  async getFileStatus(filePath: string): Promise<string> {
    try {
      const response = await fetch(\`\${this.apiBase}/status?path=\${encodeURIComponent(filePath)}\`);
      if (!response.ok) throw new Error('Failed to get file status');
      const data = await response.json();
      return data.status;
    } catch (error) {
      console.error('Error getting file status:', error);
      return 'unknown';
    }
  }
  
  /**
   * Stage and commit changes
   */
  async commitChanges(message: string): Promise<void> {
    try {
      const response = await fetch(\`\${this.apiBase}/commit\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to commit changes');
      }
    } catch (error) {
      console.error('Error committing changes:', error);
      throw new Error('Failed to commit changes: ' + (error instanceof Error ? error.message : String(error)));
    }
  }
  
  /**
   * Push commits to remote
   */
  async pushChanges(): Promise<void> {
    try {
      const response = await fetch(\`\${this.apiBase}/push\`, { method: 'POST' });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to push changes');
      }
    } catch (error) {
      console.error('Error pushing changes:', error);
      throw new Error('Failed to push changes: ' + (error instanceof Error ? error.message : String(error)));
    }
  }
  
  /**
   * Pull changes from remote
   */
  async pullChanges(): Promise<void> {
    try {
      const response = await fetch(\`\${this.apiBase}/pull\`, { method: 'POST' });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to pull changes');
      }
    } catch (error) {
      console.error('Error pulling changes:', error);
      throw new Error('Failed to pull changes: ' + (error instanceof Error ? error.message : String(error)));
    }
  }
  
  /**
   * Get the commit history for a file
   */
  async getFileHistory(filePath: string, maxCount = 10): Promise<any[]> {
    try {
      const response = await fetch(
        \`\${this.apiBase}/history?path=\${encodeURIComponent(filePath)}&count=\${maxCount}\`
      );
      
      if (!response.ok) throw new Error('Failed to get file history');
      
      const data = await response.json();
      return data.history;
    } catch (error) {
      console.error('Error getting file history:', error);
      return [];
    }
  }
}

export const gitService = new GitService();
export default gitService;
`;

// Server-side implementation for Git API (Pages Router)
const GIT_API_PAGES = `import { NextApiRequest, NextApiResponse } from 'next';
import { simpleGit } from 'simple-git';
import path from 'path';

const git = simpleGit({ baseDir: process.cwd() });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { action } = req.query;
  
  try {
    switch (action) {
      case 'status':
        await handleStatus(req, res);
        break;
      case 'commit':
        await handleCommit(req, res);
        break;
      case 'push':
        await handlePush(req, res);
        break;
      case 'pull':
        await handlePull(req, res);
        break;
      case 'history':
        await handleHistory(req, res);
        break;
      default:
        res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Git API error:', error);
    res.status(500).json({ 
      error: 'Git operation failed',
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

async function handleStatus(req: NextApiRequest, res: NextApiResponse) {
  const { path: filePath } = req.query;
  
  if (!filePath || typeof filePath !== 'string') {
    return res.status(400).json({ error: 'File path is required' });
  }
  
  const status = await git.status();
  const relativePath = path.relative(process.cwd(), filePath);
  
  let fileStatus = 'unmodified';
  
  if (status.not_added.includes(relativePath)) {
    fileStatus = 'untracked';
  } else if (status.modified.includes(relativePath)) {
    fileStatus = 'modified';
  } else if (status.created.includes(relativePath)) {
    fileStatus = 'added';
  } else if (status.deleted.includes(relativePath)) {
    fileStatus = 'deleted';
  }
  
  res.status(200).json({ status: fileStatus });
}

async function handleCommit(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { message } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Commit message is required' });
  }
  
  await git.add('.');
  const result = await git.commit(message);
  
  res.status(200).json({ 
    success: true, 
    result 
  });
}

async function handlePush(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const result = await git.push();
  res.status(200).json({ success: true, result });
}

async function handlePull(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const result = await git.pull();
  res.status(200).json({ success: true, result });
}

async function handleHistory(req: NextApiRequest, res: NextApiResponse) {
  const { path: filePath, count } = req.query;
  
  if (!filePath || typeof filePath !== 'string') {
    return res.status(400).json({ error: 'File path is required' });
  }
  
  const maxCount = count ? parseInt(count as string, 10) : 10;
  const relativePath = path.relative(process.cwd(), filePath);
  
  const log = await git.log({ 
    file: relativePath,
    maxCount
  });
  
  res.status(200).json({ history: log.all });
}`;

// Server-side implementation for Git API (App Router)
const GIT_API_APP = `import { NextResponse } from 'next/server';
import { simpleGit } from 'simple-git';
import path from 'path';

const git = simpleGit({ baseDir: process.cwd() });

export async function GET(request: Request) {
  const url = new URL(request.url);
  const action = url.pathname.split('/').pop();
  
  try {
    switch (action) {
      case 'status':
        return handleStatus(url);
      case 'history':
        return handleHistory(url);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Git API error:', error);
    return NextResponse.json({ 
      error: 'Git operation failed',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const action = url.pathname.split('/').pop();
  
  try {
    switch (action) {
      case 'commit':
        return handleCommit(request);
      case 'push':
        return handlePush();
      case 'pull':
        return handlePull();
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Git API error:', error);
    return NextResponse.json({ 
      error: 'Git operation failed',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

async function handleStatus(url: URL) {
  const filePath = url.searchParams.get('path');
  
  if (!filePath) {
    return NextResponse.json({ error: 'File path is required' }, { status: 400 });
  }
  
  const status = await git.status();
  const relativePath = path.relative(process.cwd(), filePath);
  
  let fileStatus = 'unmodified';
  
  if (status.not_added.includes(relativePath)) {
    fileStatus = 'untracked';
  } else if (status.modified.includes(relativePath)) {
    fileStatus = 'modified';
  } else if (status.created.includes(relativePath)) {
    fileStatus = 'added';
  } else if (status.deleted.includes(relativePath)) {
    fileStatus = 'deleted';
  }
  
  return NextResponse.json({ status: fileStatus });
}

async function handleCommit(request: Request) {
  const { message } = await request.json();
  
  if (!message) {
    return NextResponse.json({ error: 'Commit message is required' }, { status: 400 });
  }
  
  await git.add('.');
  const result = await git.commit(message);
  
  return NextResponse.json({ success: true, result });
}

async function handlePush() {
  const result = await git.push();
  return NextResponse.json({ success: true, result });
}

async function handlePull() {
  const result = await git.pull();
  return NextResponse.json({ success: true, result });
}

async function handleHistory(url: URL) {
  const filePath = url.searchParams.get('path');
  const countParam = url.searchParams.get('count');
  
  if (!filePath) {
    return NextResponse.json({ error: 'File path is required' }, { status: 400 });
  }
  
  const maxCount = countParam ? parseInt(countParam, 10) : 10;
  const relativePath = path.relative(process.cwd(), filePath);
  
  const log = await git.log({ 
    file: relativePath,
    maxCount
  });
  
  return NextResponse.json({ history: log.all });
}`;

// Server-side implementation for Content API with file system operations (Pages Router)
const CONTENT_API_PAGES = `import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

const contentDir = path.join(process.cwd(), 'content');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const { file } = req.query;
    
    if (!file || typeof file !== 'string') {
      // Return list of files if no filename provided
      const files = await listContentFiles();
      return res.status(200).json(files);
    }
    
    try {
      const content = await getContent(file);
      return res.status(200).json(content);
    } catch (error) {
      return res.status(404).json({ 
        error: \`Failed to read file: \${file}\`,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  } else if (req.method === 'POST') {
    try {
      const { filename, content } = req.body;
      
      if (!filename || !content) {
        return res.status(400).json({ error: 'Filename and content are required' });
      }
      
      const result = await saveContent(filename, content);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({
        error: 'Failed to save content',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}

// Helper function to list content files
async function listContentFiles() {
  try {
    const files = await fs.promises.readdir(contentDir);
    return files
      .filter(file => file.endsWith('.json') && !file.includes('.schema.'))
      .map(file => ({
        name: file,
        path: path.join(contentDir, file),
      }));
  } catch (error) {
    console.error('Error listing content files:', error);
    return [];
  }
}

// Helper function to read content
async function getContent(filename: string) {
  try {
    const filePath = path.join(contentDir, filename);
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(\`Error reading content file \${filename}:\`, error);
    throw new Error(\`Failed to read content file \${filename}\`);
  }
}

// Helper function to save content
async function saveContent(filename: string, content: any) {
  try {
    const filePath = path.join(contentDir, filename);
    await fs.promises.writeFile(
      filePath, 
      JSON.stringify(content, null, 2),
      'utf-8'
    );
    return { success: true, file: filename };
  } catch (error) {
    console.error(\`Error saving content file \${filename}:\`, error);
    throw new Error(\`Failed to save content file \${filename}\`);
  }
}`;

// Server-side implementation for Content API (App Router)
const CONTENT_API_APP = `import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const contentDir = path.join(process.cwd(), 'content');

export async function GET(request: Request) {
  const url = new URL(request.url);
  const filename = url.searchParams.get('file');
  
  if (!filename) {
    // Return list of files if no filename provided
    const files = await listContentFiles();
    return NextResponse.json(files);
  }
  
  try {
    const content = await getContent(filename);
    return NextResponse.json(content);
  } catch (error) {
    return NextResponse.json(
      { error: \`Failed to read file: \${filename}\` }, 
      { status: 404 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { filename, content } = await request.json();
    
    if (!filename || !content) {
      return NextResponse.json(
        { error: 'Filename and content are required' }, 
        { status: 400 }
      );
    }
    
    const result = await saveContent(filename, content);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to save content',
        message: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// Helper function to list content files
async function listContentFiles() {
  try {
    const files = await fs.promises.readdir(contentDir);
    return files
      .filter(file => file.endsWith('.json') && !file.includes('.schema.'))
      .map(file => ({
        name: file,
        path: path.join(contentDir, file),
      }));
  } catch (error) {
    console.error('Error listing content files:', error);
    return [];
  }
}

// Helper function to read content
async function getContent(filename: string) {
  try {
    const filePath = path.join(contentDir, filename);
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(\`Error reading content file \${filename}:\`, error);
    throw new Error(\`Failed to read content file \${filename}\`);
  }
}

// Helper function to save content
async function saveContent(filename: string, content: any) {
  try {
    const filePath = path.join(contentDir, filename);
    await fs.promises.writeFile(
      filePath, 
      JSON.stringify(content, null, 2),
      'utf-8'
    );
    return { success: true, file: filename };
  } catch (error) {
    console.error(\`Error saving content file \${filename}:\`, error);
    throw new Error(\`Failed to save content file \${filename}\`);
  }
}`;

// Tailwind CSS config
const TAILWIND_CONFIG = `module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`;

// PostCSS config
const POSTCSS_CONFIG = `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`;

// Global CSS with Tailwind
const GLOBAL_CSS = `@import "tailwindcss"`;

// Update the layout file content
const LAYOUT_CONTENT = `import './globals.css';

export const metadata = {
  title: 'JSON CMS',
  description: 'A headless CMS for managing JSON content',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}`;

// Update the _app.tsx content
const APP_CONTENT = `import '../styles/globals.css';
import type { AppProps } from 'next/app';

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}`;

// Components
const CONTENT_DISPLAY_COMPONENT = `'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Feature {
  id: number;
  title: string;
  description: string;
}

interface CTA {
  text: string;
  link: string;
}

interface ContentData {
  title: string;
  description: string;
  features: Feature[];
  cta: CTA;
}

export function ContentDisplay() {
  const [content, setContent] = useState<ContentData | null>(null);

  useEffect(() => {
    fetch('/api/content?file=example.json')
      .then(res => res.json())
      .then(data => setContent(data))
      .catch(err => console.error('Error loading content:', err));
  }, []);

  if (!content) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
          {content.title}
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
          {content.description}
        </p>
        <Link 
          href={content.cta.link}
          className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
        >
          {content.cta.text}
        </Link>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {content.features.map((feature) => (
          <div 
            key={feature.id}
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
          >
            <h3 className="text-xl font-semibold text-gray-900 mb-3">
              {feature.title}
            </h3>
            <p className="text-gray-600">
              {feature.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}`;

// Add home page content
const HOME_PAGE_CONTENT = `'use client';

import { ContentDisplay } from '@/components/home/ContentDisplay';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="py-8">
        <ContentDisplay />
      </div>
    </main>
  );
}`;

// Update the editor page content
const EDITOR_PAGE_CONTENT = `'use client';

import { EditorPage } from '@/components/editor/EditorPage';

export default function Editor() {
  return <EditorPage />;
}`;

async function promptForOptions(): Promise<{
  router: "app" | "pages";
  useSrc: boolean;
}> {
  const answers = await inquirer.prompt([
    {
      type: "list",
      name: "router",
      message: "Which Next.js router would you like to use?",
      choices: [
        {
          name: "App Router (recommended)",
          value: "app",
          description: "Use the new App Router (app directory)",
        },
        {
          name: "Pages Router",
          value: "pages",
          description: "Use the Pages Router (pages directory)",
        },
      ],
      default: "app",
    },
    {
      type: "list",
      name: "useSrc",
      message: "Would you like to use the src directory?",
      choices: [
        {
          name: "Yes (recommended)",
          value: true,
          description: "Create a src directory for your code",
        },
        {
          name: "No",
          value: false,
          description: "Keep all code in the root directory",
        },
      ],
      default: true,
    },
  ]);

  return {
    router: answers.router,
    useSrc: answers.useSrc,
  };
}

export async function initProject(options: InitOptions): Promise<void> {
  const { directory, gitConfig } = options;

  // Prompt for options if not provided
  const { router, useSrc } =
    options.router && options.useSrc !== undefined
      ? { router: options.router, useSrc: options.useSrc }
      : await promptForOptions();

  console.log(
    "\n✨ Creating a new JSON CMS project with the following configuration:"
  );
  console.log(
    `\n📦 Router: ${router === "app" ? "App Router" : "Pages Router"}`
  );
  console.log(
    `📁 Directory Structure: ${useSrc ? "src directory" : "no src directory"}`
  );
  console.log("\n🚀 Let's get started!\n");

  // Get absolute path for target directory
  const targetDir = path.resolve(directory);
  const originalDir = process.cwd();

  try {
    // Create Next.js project using create-next-app
    console.log("Creating Next.js project...");
    
    // For Pages Router, we use traditional flags
    // For App Router, we include the --app flag
    let createNextAppCommand = "npx create-next-app@latest";
    createNextAppCommand += ` ${directory}`;
    createNextAppCommand += " --typescript --tailwind --eslint";
    if (router === "app") {
      createNextAppCommand += " --app";
    } else {
      createNextAppCommand += " --no-app";  // Explicitly disable app directory
    }
    if (useSrc) {
      createNextAppCommand += " --src-dir";
    }

    execSync(createNextAppCommand, { stdio: "inherit" });

    // Change to target directory
    process.chdir(targetDir);

    // Create additional CMS-specific directories
    console.log("Adding CMS-specific files...");

    const baseDir = useSrc ? "src" : "";
    const cmsDirectories = [
      "content",
      "content/schema",
      `${baseDir}/components/editor`,
      `${baseDir}/services`,
      `${baseDir}/store`,
    ];

    // Create CMS directories
    cmsDirectories.forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // Create JSON content files
    Object.entries(TEMPLATE_FILES).forEach(([filePath, content]) => {
      fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
    });

    // Create the EditorPage component and related components
    fs.writeFileSync(
      path.join(targetDir, `${baseDir}/components/editor/EditorPage.tsx`),
      EDITOR_COMPONENT
    );

    fs.writeFileSync(
      path.join(targetDir, `${baseDir}/components/editor/FileTree.tsx`),
      FILE_TREE_COMPONENT
    );

    fs.writeFileSync(
      path.join(targetDir, `${baseDir}/components/editor/EditorToolbar.tsx`),
      EDITOR_TOOLBAR_COMPONENT
    );

    // Create CMS components and services
    const componentsToCreate = [
      {
        dir: `${baseDir}/components/editor`,
        files: [
          { name: "EditorPage.tsx", content: EDITOR_COMPONENT },
          { name: "FileTree.tsx", content: FILE_TREE_COMPONENT },
          { name: "EditorToolbar.tsx", content: EDITOR_TOOLBAR_COMPONENT },
        ],
      },
      {
        dir: `${baseDir}/components/home`,
        files: [
          { name: "ContentDisplay.tsx", content: CONTENT_DISPLAY_COMPONENT },
        ],
      },
    ];

    // Create component directories and files
    componentsToCreate.forEach(({ dir, files }) => {
      fs.mkdirSync(dir, { recursive: true });
      files.forEach(({ name, content }) => {
        fs.writeFileSync(path.join(dir, name), content);
      });
    });

    fs.writeFileSync(`${baseDir}/services/contentService.ts`, SERVICE_TEMPLATE);

    fs.writeFileSync(`${baseDir}/services/gitService.ts`, GIT_SERVICE_TEMPLATE);

    fs.writeFileSync(`${baseDir}/store/editorStore.ts`, EDITOR_STORE);

    // Create API routes and pages based on router type
    if (router === "app") {
      // Create app directory structure
      fs.mkdirSync(`${baseDir}/app`, { recursive: true });
      fs.mkdirSync(`${baseDir}/app/api/content`, { recursive: true });
      fs.mkdirSync(`${baseDir}/app/api/git/[action]`, { recursive: true });
      fs.mkdirSync(`${baseDir}/app/editor`, { recursive: true });

      // Create API routes
      fs.writeFileSync(`${baseDir}/app/api/content/route.ts`, CONTENT_API_APP);
      fs.writeFileSync(`${baseDir}/app/api/git/[action]/route.ts`, GIT_API_APP);

      // Create app pages
      fs.writeFileSync(`${baseDir}/app/globals.css`, GLOBAL_CSS);
      fs.writeFileSync(`${baseDir}/app/page.tsx`, HOME_PAGE_CONTENT);
      fs.writeFileSync(`${baseDir}/app/layout.tsx`, LAYOUT_CONTENT);
      fs.writeFileSync(`${baseDir}/app/editor/page.tsx`, EDITOR_PAGE_CONTENT);
    } else {
      // Create pages directory structure
      fs.mkdirSync(`${baseDir}/pages`, { recursive: true });
      fs.mkdirSync(`${baseDir}/pages/api`, { recursive: true });
      fs.mkdirSync(`${baseDir}/pages/api/git`, { recursive: true });
      fs.mkdirSync(`${baseDir}/pages/editor`, { recursive: true });
      fs.mkdirSync(`${baseDir}/styles`, { recursive: true });

      // Create API routes
      fs.writeFileSync(`${baseDir}/pages/api/content.ts`, CONTENT_API_PAGES);
      fs.writeFileSync(`${baseDir}/pages/api/git/[action].ts`, GIT_API_PAGES);

      // Create pages
      fs.writeFileSync(`${baseDir}/styles/globals.css`, GLOBAL_CSS);
      fs.writeFileSync(`${baseDir}/pages/index.tsx`, HOME_PAGE_CONTENT);
      fs.writeFileSync(`${baseDir}/pages/_app.tsx`, APP_CONTENT);
      fs.writeFileSync(`${baseDir}/pages/editor/index.tsx`, EDITOR_PAGE_CONTENT);
    }

    // Create shared components directory
    fs.mkdirSync(`${baseDir}/components/home`, { recursive: true });
    fs.writeFileSync(
      `${baseDir}/components/home/ContentDisplay.tsx`,
      CONTENT_DISPLAY_COMPONENT
    );

    // Update package.json to add CMS dependencies
    const packageJson = JSON.parse(fs.readFileSync("package.json", "utf-8"));
    const cmsPackages = {
      "@monaco-editor/react": "^4.6.0",
      "simple-git": "^3.22.0",
      zustand: "^4.5.1",
    };

    packageJson.dependencies = {
      ...packageJson.dependencies,
      ...cmsPackages,
    };

    fs.writeFileSync("package.json", JSON.stringify(packageJson, null, 2));

    // Install the new dependencies
    console.log("Installing additional dependencies...");
    execSync("npm install", { stdio: "inherit" });

    console.log("\n✨ Project initialized successfully!");
    console.log("\nNext steps:");
    console.log(`1. cd "${directory}"`);
    console.log("2. Run 'npm run dev' to start the development server");
    console.log("\nThe CMS will be available at: http://localhost:3000/editor");

    // Return to original directory
    process.chdir(originalDir);
  } catch (error) {
    // Return to original directory in case of error
    process.chdir(originalDir);
    throw new Error(
      `Failed to initialize project: ${(error as Error).message}`
    );
  }
}
