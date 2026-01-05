# Automated Bot Testing

Automated voice-to-voice testing framework for Sarvam conversational AI agents. This tool enables testing voice bots by simulating real user interactions through another AI agent.

## Overview

The system connects two Sarvam voice agents:
- **Bot Agent**: The voice bot being tested (e.g., restaurant reservation bot)
- **Tester Agent**: A user simulator that interacts with the bot based on test scenarios

Audio is routed directly between the two agents, enabling realistic voice-to-voice testing without manual intervention.

## Features

- **Voice-to-Voice Testing**: Real audio routing between two Sarvam agents
- **Scenario-Based Testing**: Define test scenarios with goals and success criteria
- **Real-Time Monitoring**: Watch test progress and listen to conversations
- **Automatic Pass/Fail**: Tests pass when both agents complete their interaction
- **Transcript Logging**: Full text transcripts of all conversations
- **Bot Configuration Loading**: Load and test any Sarvam voice agent

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Voice SDK**: Sarvam Conv AI SDK
- **Routing**: TanStack Router
- **State Management**: Zustand
- **Styling**: Tailwind CSS

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- Sarvam API credentials

### Installation

```bash
# Clone the repository
git clone https://github.com/vishalm-sarvam/Automatic-Bot-Testing.git
cd Automatic-Bot-Testing

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env
# Edit .env with your credentials
```

### Environment Variables

```env
# Sarvam API Configuration
VITE_SARVAM_ORG_ID=your_org_id
VITE_SARVAM_WORKSPACE_ID=your_workspace_id
VITE_SARVAM_BASE_URL=https://apps.sarvam.ai/api

# Sarvam Conv AI SDK Token
VITE_SARVAM_API_TOKEN=your_api_token

# Bearer Token for app-authoring API
VITE_SARVAM_BEARER_TOKEN=your_bearer_token
```

### Running

```bash
# Development
pnpm dev

# Build
pnpm build

# Preview production build
pnpm preview
```

## Usage

1. **Load Bot Configuration**: Go to Config page and load the bot you want to test
2. **Select Scenarios**: Choose test scenarios from the Voice Testing page
3. **Run Tests**: Click "Run Voice Tests" to start automated testing
4. **Monitor Results**: Watch real-time progress and review transcripts

## Architecture

```
┌─────────────────┐         ┌─────────────────┐
│  Tester Agent   │ ──────> │   Bot Agent     │
│ (User Simulator)│ <────── │ (Being Tested)  │
└─────────────────┘  Audio  └─────────────────┘
        │                           │
        └───────────┬───────────────┘
                    │
            ┌───────▼───────┐
            │  VoiceBridge  │
            │ (Audio Router)│
            └───────────────┘
```

## Test Flow

1. Bot agent starts and plays intro message
2. Tester agent starts and begins interaction
3. Audio routes bidirectionally between agents
4. Text transcripts are captured from both sides
5. Test completes when both agents end their interaction
6. Result: PASSED if both ended normally, FAILED otherwise

## Project Structure

```
src/
├── components/      # React components
├── routes/          # Page routes (TanStack Router)
├── services/        # Core services
│   ├── voiceBridge.ts       # Audio routing between agents
│   ├── voiceTestRunner.ts   # Test orchestration
│   └── sarvamApi.ts         # Sarvam API client
├── stores/          # Zustand state stores
├── types/           # TypeScript types
└── data/            # Test scenarios and configurations
```

## License

MIT
