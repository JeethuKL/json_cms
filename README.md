# Next.js JSON CMS

A Git-based JSON CMS for Next.js projects with support for both App Router and Pages Router. Edit your JSON content files with a beautiful UI, with automatic Git versioning, schema validation, and real-time preview.

## Features

- 📝 Edit JSON files with a VS Code-like editor
- 🌳 File tree navigation with Git status indicators
- 🔄 Seamless Git integration (commit, push, pull)
- 💾 Auto-save changes with Git versioning
- 🔍 JSON schema validation
- ⚡ Real-time preview
- 🚀 Easy integration with Next.js projects
- ✨ Full support for both App Router and Pages Router

## Installation

```bash
# Create a new project (Pages Router - default)
npx next-json-cms init my-project

# Create a new project with App Router
npx next-json-cms init my-project --router app

# Or add to an existing project (Pages Router - default)
cd existing-project
npx next-json-cms init

# Or add to an existing project with App Router
cd existing-project
npx next-json-cms init --router app
```

## Quick Start

1. Initialize a new project with your preferred router type:
```bash
# For Pages Router (default)
npx next-json-cms init my-project

# For App Router
npx next-json-cms init my-project --router app

cd my-project
npm install
```

2. Start the editor:
```bash
npm run cms
# Or use npm run cms:dev for a different port
```

3. Open your browser and navigate to `http://localhost:3000/editor`

4. Edit your JSON files in the content directory - changes are automatically saved and committed!

## Project Structure

### Pages Router Structure
```
your-project/
├── content/              # Your JSON content files
│   ├── schema/           # JSON schema definitions
│   └── example.json      # Example content file
├── src/
│   ├── pages/            # Next.js pages
│   │   ├── api/          # API routes
│   │   └── editor/       # CMS editor pages
│   └── components/       # React components
└── package.json
```

### App Router Structure
```
your-project/
├── content/              # Your JSON content files
│   ├── schema/           # JSON schema definitions
│   └── example.json      # Example content file
├── src/
│   ├── app/              # Next.js app directory
│   │   ├── api/          # API routes
│   │   └── editor/       # CMS editor pages
│   └── components/       # React components
└── package.json
```

## Configuration

### Router Configuration

Specify your preferred Next.js router when initializing the project:

```bash
# For Pages Router (default)
npx next-json-cms init --router pages

# For App Router
npx next-json-cms init --router app
```

### Git Configuration

You can configure Git settings during initialization:

```bash
npx next-json-cms init --git-username "Your Name" --git-email "your@email.com"
```

Or manually in your project:

```bash
git config user.name "Your Name"
git config user.email "your@email.com"
```

### JSON Schema Validation

1. Create schema files in the `content/schema` directory
2. Name your schema files with the pattern: `{name}.schema.json`
3. The schema will automatically be applied to JSON files with matching names

Example schema (`content/schema/blog.schema.json`):
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["title", "posts"],
  "properties": {
    "title": {
      "type": "string",
      "minLength": 1
    },
    "posts": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "title", "content"],
        "properties": {
          "id": {
            "type": "number"
          },
          "title": {
            "type": "string",
            "minLength": 1
          },
          "content": {
            "type": "string"
          }
        }
      }
    }
  }
}
```

### Editor Options

Start the editor with custom options:

```bash
npx next-json-cms start --port 3001 --host 0.0.0.0
```

Available options:
- `--port`: Port number (default: 3000)
- `--host`: Host address (default: localhost)

## Usage in Next.js Projects

### Pages Router Usage

```typescript
import fs from 'fs';
import path from 'path';

// pages/blog.tsx
export async function getStaticProps() {
  const content = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'content', 'blog.json'), 'utf-8')
  );

  return {
    props: {
      content,
    },
  };
}

export default function Blog({ content }) {
  return (
    <div>
      <h1>{content.title}</h1>
      {content.posts.map(post => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.content}</p>
        </article>
      ))}
    </div>
  );
}
```

### App Router Usage

```typescript
// app/blog/page.tsx
import fs from 'fs';
import path from 'path';

async function getBlogData() {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'content', 'blog.json'), 'utf-8')
  );
}

export default async function Blog() {
  const content = await getBlogData();
  
  return (
    <div>
      <h1>{content.title}</h1>
      {content.posts.map(post => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.content}</p>
        </article>
      ))}
    </div>
  );
}
```

## Development

```bash
# Install dependencies
npm install

# Start the development server
npm run dev

# Build the CLI
npm run build:cli

# Run tests
npm test

# Format code
npm run format
```

## Publishing the Package

To publish the package to npm:

```bash
# Login to npm
npm login

# Build the CLI
npm run build:cli

# Publish the package
npm publish
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT
