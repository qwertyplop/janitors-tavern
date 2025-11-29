# Janitor's Tavern

A SillyTavern-compatible proxy UI and preset manager for JanitorAI and other LLM backends.

## Overview

Janitor's Tavern acts as a **configuration hub** and **proxy adapter** between JanitorAI (or other chat frontends) and LLM providers. It allows you to:

- Manage **Connection Presets** for different LLM APIs
- Import, edit, and export **SillyTavern Chat Completion Presets** with full fidelity
- Configure **Sampler Settings** and **Prompt Blocks** in a unified preset
- Route requests through a proxy that applies your presets before forwarding to providers

### Request Flow

```
JanitorAI → Janitor's Tavern Proxy → LLM Provider → Proxy → JanitorAI
```

The proxy receives only message content from JanitorAI, looks up all settings from your configured presets, and forwards the properly formatted request to your chosen provider.

## Features

### Chat Completion Presets (SillyTavern-Compatible)

Each preset combines **prompt blocks** and **sampler settings** into a single configuration:

- **Full SillyTavern preset import/export** - Import your existing ST presets with complete fidelity
- **Prompt Block Editor** - View, create, edit, reorder, and delete prompt blocks
- **Drag-and-drop reordering** - Easily rearrange prompt block order
- **Enable/disable toggles** - Toggle individual blocks without deleting them
- **Marker support** - Visual indicators for system markers (chatHistory, worldInfo, etc.)

### Sampler Settings (Built into Presets)

- **All ST sampling parameters** - Temperature, Top P, Top K, Top A, Min P
- **Penalty controls** - Frequency penalty, Presence penalty, Repetition penalty
- **Context limits** - Max context and max response tokens
- **Visual sliders** - Easy adjustment with range sliders and number inputs

### Connection Presets

- **Multiple provider types**:
  - OpenAI-compatible APIs
  - JanitorAI native
  - Custom HTTP endpoints
- **Flexible authentication** - Environment variables or local storage
- **Connection testing** - Verify your connections work before use
- **Extra headers/params** - Add custom headers or query parameters

### Request/Response Logging

- Toggle logging on/off from the Settings page
- Log requests, responses, or both
- View recent logs in the UI
- Clear logs when needed

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd janitors_tavern/main

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`.

### Building for Production

```bash
npm run build
npm start
```

## Project Structure

```
main/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/               # API routes
│   │   │   ├── health/        # Health check endpoint
│   │   │   ├── logs/          # Log viewing/clearing
│   │   │   ├── proxy/         # Proxy endpoints
│   │   │   │   ├── chat-completion/  # Main proxy route
│   │   │   │   └── test-connection/  # Connection testing
│   │   │   ├── settings/      # Server settings
│   │   │   └── storage/       # Vercel Blob storage API
│   │   │       ├── [key]/     # Individual data access
│   │   │       ├── all/       # Batch data operations
│   │   │       └── status/    # Storage status check
│   │   ├── connections/       # Connection presets page
│   │   ├── extensions/        # Extensions page (placeholder)
│   │   ├── presets/           # Chat Completion presets page
│   │   └── settings/          # App settings page
│   ├── components/
│   │   ├── layout/            # Layout components (Sidebar, MainLayout)
│   │   ├── presets/           # Preset editor components
│   │   │   ├── ChatCompletionPresetEditor.tsx
│   │   │   ├── PromptBlockEditor.tsx
│   │   │   ├── PromptBlockList.tsx
│   │   │   └── SamplerSettingsPanel.tsx
│   │   └── ui/                # UI primitives (Button, Card, Dialog, etc.)
│   ├── lib/
│   │   ├── janitor-parser.ts  # JanitorAI request parsing
│   │   ├── logger.ts          # Server-side logging utilities
│   │   ├── macros.ts          # STScript macro processor
│   │   ├── prompt-builder.ts  # Prompt message builder
│   │   ├── storage.ts         # Client-side storage (localStorage)
│   │   ├── storage-provider.ts # Storage abstraction layer
│   │   └── utils.ts           # Utility functions
│   ├── providers/             # LLM provider adapters
│   │   ├── base.ts            # Base ChatProvider class
│   │   ├── custom-http.ts     # Custom HTTP provider
│   │   ├── janitorai.ts       # JanitorAI provider
│   │   └── openai-compatible.ts  # OpenAI-compatible provider
│   └── types/
│       └── index.ts           # TypeScript type definitions
├── data/                      # Server-side data (settings, logs)
└── logs/                      # Log files
```

## API Endpoints

### `POST /api/proxy/chat-completion`

Main proxy endpoint. Accepts chat messages and routes them through your configured presets to the LLM provider.

**Request Body:**
```json
{
  "messages": [
    { "role": "user", "content": "Hello!" }
  ],
  "presetId": "your-preset-id",
  "connectionId": "your-connection-id",
  "metadata": {
    "characterName": "Assistant",
    "scenario": "..."
  }
}
```

### `POST /api/proxy/test-connection`

Test a connection configuration.

**Request Body:**
```json
{
  "providerType": "openai-compatible",
  "baseUrl": "https://api.example.com/v1",
  "apiKey": "your-api-key",
  "model": "gpt-4"
}
```

### `GET /api/health`

Health check endpoint.

### `GET /api/settings`

Get server settings (logging configuration).

### `PUT /api/settings`

Update server settings.

### `GET /api/logs`

Get recent log entries.

### `DELETE /api/logs`

Clear log file.

## Importing SillyTavern Presets

1. Go to the **Presets** page
2. Click **Import ST Preset**
3. Select one or more `.json` files from SillyTavern
4. Your presets will be imported with all prompt blocks, sampler settings, and ordering preserved

## Configuration

### Environment Variables

For API keys stored server-side, set environment variables:

```bash
# .env.local
OPENAI_API_KEY=sk-...
JANITORAI_API_KEY=...
CUSTOM_API_KEY=...
```

Then in your Connection Preset, set:
- `apiKeyRef`: `env`
- `apiKeyEnvVar`: `OPENAI_API_KEY` (or your variable name)

### Client-Side Storage

All presets are stored in browser localStorage under keys:
- `jt.connectionPresets`
- `jt.chatCompletionPresets`
- `jt.settings`

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Custom components inspired by shadcn/ui
- **Storage**: localStorage (client), JSON files (server)

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard with quick overview |
| `/connections` | Manage API connection presets |
| `/presets` | Manage SillyTavern Chat Completion presets |
| `/extensions` | Extensions (placeholder) |
| `/settings` | App and logging settings |

## Development

```bash
# Run development server with hot reload
npm run dev

# Type checking
npm run lint

# Build for production
npm run build
```

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new).

### Quick Deploy

1. Fork this repository to your GitHub account
2. Go to [Vercel](https://vercel.com/new) and import your forked repo
3. Deploy (no environment variables needed for basic setup)

### Enable Cloud Storage (Recommended)

By default, data is stored in browser localStorage. For persistent cloud storage:

1. Go to your Vercel project dashboard
2. Navigate to **Storage** tab
3. Click **Create** → **Blob**
4. Name it (e.g., `janitors-tavern-data`)
5. Click **Create** - the `BLOB_READ_WRITE_TOKEN` is automatically added

Your app will now detect Blob storage and show sync options in **Settings** → **Data Management**.

### User Setup Flow

Each user deploys their own instance:

```
1. Fork repo → Deploy to Vercel → Add Blob storage (optional)
2. Open app → Create connections → Import/create presets
3. Configure JanitorAI to use: https://your-app.vercel.app/api/proxy/chat-completion
```

## Data Management

### Storage Options

| Storage | Description | Setup |
|---------|-------------|-------|
| **localStorage** | Browser-based, works immediately | None |
| **Vercel Blob** | Cloud persistence, survives browser clear | Add Blob in Vercel dashboard |

### Backup & Restore

Go to **Settings** → **Data Management**:

- **Export Backup**: Download all data as JSON
- **Import Backup**: Restore from a backup file
- **Push to Cloud**: Upload local data to Vercel Blob
- **Pull from Cloud**: Download cloud data to local

This allows you to:
- Migrate between devices
- Keep backups before making changes
- Sync data when using multiple browsers

## Future Enhancements

- Extensions system for pre/post-processing
- Preset sharing and discovery
- More provider types
- Advanced prompt templating

## License

MIT
