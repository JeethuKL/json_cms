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
  router?: "app" | "pages";
}

const TEMPLATE_FILES = {
  "content/example.json": {
    title: "Example Content",
    description: "Edit this content in the CMS",
    items: [
      { id: 1, name: "Item 1" },
      { id: 2, name: "Item 2" },
    ],
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

// Editor component templates - updated with advanced Monaco editor
const EDITOR_COMPONENT = `import { useEffect } from "react";
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
const FILE_TREE_COMPONENT = `import { useEffect, useState } from "react";
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
    isLoading 
  } = useEditorStore();
  const [files, setFiles] = useState<FileItem[]>([]);

  useEffect(() => {
    async function loadFiles() {
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
    }
    
    loadFiles();
    // Refresh file list every 5 seconds to update Git status
    const interval = setInterval(loadFiles, 5000);
    return () => clearInterval(interval);
  }, []);

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
const EDITOR_TOOLBAR_COMPONENT = `import { useState } from "react";
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
const EDITOR_STORE = `import { create } from 'zustand';
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
const GLOBAL_CSS = `@tailwind base;
@tailwind components;
@tailwind utilities;

html, body {
  height: 100%;
  margin: 0;
  padding: 0;
}`;

export async function initProject(options: InitOptions): Promise<void> {
  const { directory, gitConfig, router = "pages" } = options;

  console.log(`Initializing JSON CMS project with ${router} router...`);

  // Ensure target directory exists
  const targetDir = path.resolve(directory);
  if (!fs.existsSync(targetDir)) {
    console.log(`Creating directory: ${targetDir}`);
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Change to the target directory for Git operations
  const originalDir = process.cwd();
  process.chdir(targetDir);

  // Create project structure based on router type
  let directories = [
    "content",
    "content/schema",
    "src/components/editor",
    "src/services",
    "src/hooks",
    "src/store",
    "src/styles",
  ];

  // Add router-specific directories
  if (router === "pages") {
    directories = [
      ...directories,
      "src/pages",
      "src/pages/api",
      "src/pages/editor",
    ];
  } else if (router === "app") {
    directories = [...directories, "src/app", "src/app/api", "src/app/editor"];
  }

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

  // Create CSS file
  fs.writeFileSync(path.join(targetDir, "src/styles/globals.css"), GLOBAL_CSS);

  // Create Tailwind config
  fs.writeFileSync(path.join(targetDir, "tailwind.config.js"), TAILWIND_CONFIG);

  // Create PostCSS config
  fs.writeFileSync(path.join(targetDir, "postcss.config.js"), POSTCSS_CONFIG);

  // Create the EditorPage component and related components
  fs.writeFileSync(
    path.join(targetDir, "src/components/editor/EditorPage.tsx"),
    EDITOR_COMPONENT
  );

  fs.writeFileSync(
    path.join(targetDir, "src/components/editor/FileTree.tsx"),
    FILE_TREE_COMPONENT
  );

  fs.writeFileSync(
    path.join(targetDir, "src/components/editor/EditorToolbar.tsx"),
    EDITOR_TOOLBAR_COMPONENT
  );

  // Create service, store files
  fs.writeFileSync(
    path.join(targetDir, "src/services/contentService.ts"),
    SERVICE_TEMPLATE
  );

  fs.writeFileSync(
    path.join(targetDir, "src/services/gitService.ts"),
    GIT_SERVICE_TEMPLATE
  );

  fs.writeFileSync(
    path.join(targetDir, "src/store/editorStore.ts"),
    EDITOR_STORE
  );

  // Set up router-specific files
  if (router === "app") {
    // Create app router editor page
    fs.writeFileSync(
      path.join(targetDir, "src/app/editor/page.tsx"),
      `'use client';\n\nimport { EditorPage } from '@/components/editor/EditorPage';\n\nexport default function Editor() {\n  return <EditorPage />;\n}`
    );

    // Create API route for app router content
    const contentApiDirPath = path.join(
      targetDir,
      "src/app/api/content/route.ts"
    );
    fs.mkdirSync(path.dirname(contentApiDirPath), { recursive: true });
    fs.writeFileSync(contentApiDirPath, CONTENT_API_APP);

    // Create API routes for app router git operations
    const gitApiDirPath = path.join(
      targetDir,
      "src/app/api/git/[action]/route.ts"
    );
    fs.mkdirSync(path.dirname(gitApiDirPath), { recursive: true });
    fs.writeFileSync(gitApiDirPath, GIT_API_APP);

    // Create root layout file if it doesn't exist
    const layoutPath = path.join(targetDir, "src/app/layout.tsx");
    if (!fs.existsSync(layoutPath)) {
      fs.writeFileSync(
        layoutPath,
        `import '@/styles/globals.css';\n\nexport const metadata = {\n  title: 'JSON CMS',\n  description: 'A headless CMS for managing JSON content',\n};\n\nexport default function RootLayout({\n  children,\n}: {\n  children: React.ReactNode;\n}) {\n  return (\n    <html lang="en">\n      <body>{children}</body>\n    </html>\n  );\n}`
      );
    }
  } else {
    // Create pages router editor page
    fs.writeFileSync(
      path.join(targetDir, "src/pages/editor/index.tsx"),
      `import { EditorPage } from '@/components/editor/EditorPage';\n\nexport default function Editor() {\n  return <EditorPage />;\n}`
    );

    // Create API route for pages router content
    const contentApiDirPath = path.join(targetDir, "src/pages/api/content.ts");
    fs.mkdirSync(path.dirname(contentApiDirPath), { recursive: true });
    fs.writeFileSync(contentApiDirPath, CONTENT_API_PAGES);

    // Create API routes for pages router git operations
    const gitApiDirPath = path.join(targetDir, "src/pages/api/git/[action].ts");
    fs.mkdirSync(path.dirname(gitApiDirPath), { recursive: true });
    fs.writeFileSync(gitApiDirPath, GIT_API_PAGES);

    // Create _app.tsx for global CSS
    fs.writeFileSync(
      path.join(targetDir, "src/pages/_app.tsx"),
      `import '@/styles/globals.css';\nimport type { AppProps } from 'next/app';\n\nexport default function App({ Component, pageProps }: AppProps) {\n  return <Component {...pageProps} />;\n}`
    );
  }

  // Create tsconfig.json with paths alias configuration if it doesn't exist
  const tsconfigPath = path.join(targetDir, "tsconfig.json");
  if (!fs.existsSync(tsconfigPath)) {
    fs.writeFileSync(
      tsconfigPath,
      JSON.stringify(
        {
          compilerOptions: {
            target: "es5",
            lib: ["dom", "dom.iterable", "esnext"],
            allowJs: true,
            skipLibCheck: true,
            strict: true,
            forceConsistentCasingInFileNames: true,
            noEmit: true,
            esModuleInterop: true,
            module: "esnext",
            moduleResolution: "node",
            resolveJsonModule: true,
            isolatedModules: true,
            jsx: "preserve",
            incremental: true,
            plugins: [
              {
                name: "next",
              },
            ],
            paths: {
              "@/*": ["./src/*"],
            },
          },
          include: [
            "next-env.d.ts",
            "**/*.ts",
            "**/*.tsx",
            ".next/types/**/*.ts",
          ],
          exclude: ["node_modules"],
        },
        null,
        2
      )
    );
  }

  // Initialize Git if not already initialized
  if (!fs.existsSync(path.join(targetDir, ".git"))) {
    try {
      // We're already in targetDir from process.chdir above
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
        "*.log",
      ].join("\n");
      fs.writeFileSync(path.join(targetDir, ".gitignore"), gitignore);

      // Initial commit
      execSync("git add .");
      execSync('git commit -m "Initial commit: JSON CMS setup"');
    } catch (error) {
      console.warn(
        "Warning: Git initialization failed:",
        (error as Error).message
      );
    }
  }

  // Return to the original directory
  process.chdir(originalDir);

  // Create or update package.json
  const packageJsonPath = path.join(targetDir, "package.json");
  const packageJson = fs.existsSync(packageJsonPath)
    ? JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"))
    : {};

  const updatedPackageJson = {
    ...packageJson,
    scripts: {
      ...packageJson.scripts,
      cms: "next-json-cms start",
      "cms:dev": "next-json-cms start --port 3001",
      dev: "next dev",
      build: "next build",
      start: "next start",
    },
    dependencies: {
      ...packageJson.dependencies,
      "next-json-cms": "latest",
      "@monaco-editor/react": "^4.6.0",
      "simple-git": "^3.22.0",
      zustand: "^4.5.1",
      tailwindcss: "^3.4.1",
      autoprefixer: "^10.4.17",
      postcss: "^8.4.35",
      ...(router === "app"
        ? { next: "^13.4.0 || ^14.0.0" }
        : { next: "^12.0.0 || ^13.0.0 || ^14.0.0" }),
    },
    // Use overrides with explicit versions instead of $react references
    overrides: {
      "react-json-view": {
        react: "^18.2.0",
        "react-dom": "^18.2.0",
      },
    },
    // Add resolutions for Yarn users (alternative to overrides)
    resolutions: {
      "react-json-view/react": "^18.2.0",
      "react-json-view/react-dom": "^18.2.0",
    },
  };

  fs.writeFileSync(
    packageJsonPath,
    JSON.stringify(updatedPackageJson, null, 2)
  );

  // Create or update .npmrc file to force legacy peer deps
  const npmrcPath = path.join(targetDir, ".npmrc");
  fs.writeFileSync(npmrcPath, "legacy-peer-deps=true\n");

  console.log("\n✨ Project initialized successfully!");
  console.log(`\nRouter type: ${router}`);
  console.log(`\nProject created in: ${targetDir}`);
  console.log("\nNext steps:");
  console.log(`1. cd ${path.relative(originalDir, targetDir)}`);
  console.log("2. Run 'npm install' to install dependencies");
  console.log("3. Run 'npm run cms' to start the editor");
  console.log("\nThe CMS will be available at: http://localhost:3000/editor");
}
