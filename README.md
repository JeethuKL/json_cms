# JSON CMS

A Git-based JSON CMS for Next.js projects. Edit your JSON content files with a beautiful UI, with automatic Git versioning, schema validation, and real-time preview.

## Features

- 📝 Edit JSON files with a VS Code-like editor
- 🌳 File tree navigation with Git status indicators
- 🔄 Seamless Git integration (commit, push, pull)
- 💾 Auto-save changes with Git versioning
- 🔍 JSON schema validation
- ⚡ Real-time preview
- 🚀 Easy integration with Next.js projects

## Installation

```bash
# Create a new project
npx json-cms init my-project

# Or add to an existing project
cd existing-project
npx json-cms init
```

## Quick Start

1. Initialize a new project:
```bash
npx json-cms init my-project
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

```
your-project/
├── content/               # Your JSON content files
│   ├── schema/           # JSON schema definitions
│   └── example.json      # Example content file
├── src/
│   ├── pages/            # Next.js pages
│   └── components/       # React components
└── package.json
```

## Configuration

### Git Configuration

You can configure Git settings during initialization:

```bash
npx json-cms init --git-username "Your Name" --git-email "your@email.com"
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
npx json-cms start --port 3001 --host 0.0.0.0
```

Available options:
- `--port`: Port number (default: 3000)
- `--host`: Host address (default: localhost)

## Usage in Next.js Projects

1. Access your content files directly:

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
```

2. Use the content in your components:

```typescript
// pages/blog.tsx
interface BlogContent {
  title: string;
  posts: Array<{
    id: number;
    title: string;
    content: string;
  }>;
}

export default function Blog({ content }: { content: BlogContent }) {
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

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT
