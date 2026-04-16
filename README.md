# TwinMind Copilot

TwinMind is an always-on AI meeting copilot. It listens to live audio, continuously transcribes it, and surfaces context-aware, actionable suggestions in real-time.

## Features
- **Live Audio Transcription:** Uses Whisper-large-v3 via Groq for fast transcription.
- **Context-Aware Suggestions:** Dynamically loads suggestions based on a rolling conversation window (Powered by OpenAI/GPT-OSS equivalent).
- **Detailed Chat:** Interact directly with suggestions for a deeper dive or ask free-form questions based on the meeting history.
- **Vercel Ready:** Seamless deployment as a full-stack Next/Vite application with serverless functions.

## Project Structure
The project is set up as a unified application for easy Vercel deployment:
- `src/` - React/Vite Frontend
- `api/` - Serverless Backend Functions (Transcribe, Suggestions, Chat)
- `backend/` - (Optional) Express server for local development

## Local Development (Testing limits/Prompt Engineering)

### 1. Install Dependencies
Make sure you have Node.js installed, then run from the root of the project:
```bash
npm install
```

### 2. Start the Local Backend API
The frontend needs an API to talk to. Start the local Express server:
```bash
npm run dev:backend
```
*The backend server will run on http://localhost:3001*

### 3. Start the Frontend
In a separate terminal, start the Vite development server:
```bash
npm run dev
```
*The frontend will run on http://localhost:5173*

## Configuration

### API Keys
1. Get a free API key from [Groq Console](https://console.groq.com/).
2. Open the TwinMind app in your browser.
3. Click the **"Settings" (⚙)** button in the top right.
4. Enter your Groq API key and hit **Save**. The app stores this securely in your browser's local storage.

### Custom Prompts
The Settings modal also allows you to configure:
- Custom Live Suggestion Prompts
- Detailed Answer Prompts
- Chat Prompts
- Context Windows (how many characters of the transcript are sent to the AI)

## Deployment (Vercel)

This project is pre-configured for Vercel.
1. Push your repository to GitHub.
2. Go to Vercel and import your repository.
3. Select **Vite** as the framework preset.
4. Leave root directory as `./`.
5. Deploy! Vercel will automatically build the static frontend into `dist/` and expose the `api/` directory as serverless functions.
