# JSON CMS

A Git-based JSON content management system for Next.js projects. Edit your JSON content files with a beautiful UI, with automatic Git versioning and real-time preview.

## Features

- 📝 Edit JSON files with a VS Code-like editor
- 🌳 File tree navigation
- 🔄 Git integration (commit, push, pull)
- 💾 Auto-save changes
- 🔍 Real-time JSON validation
- 🚀 Easy integration with Next.js projects

## Installation

```bash
# Create a new project
npx json-cms init

# Or add to an existing project
npm install json-cms
```

## Usage

1. Start the editor:

```bash
npx json-cms start
```

2. Open your browser and navigate to `http://localhost:3000/editor`

3. Edit your JSON files in the content directory

4. Changes are automatically saved and committed to Git

## Project Structure

```
your-project/
├── content/          # Your JSON content files
├── src/
│   ├── pages/       # Next.js pages
│   └── components/  # React components
└── package.json
```

## Configuration

The CMS will automatically:
- Initialize a Git repository if one doesn't exist
- Create a `content` directory for your JSON files
- Set up Git hooks for automatic commits

## Development

```bash
# Install dependencies
npm install

# Start the development server
npm run dev

# Build for production
npm run build
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT 