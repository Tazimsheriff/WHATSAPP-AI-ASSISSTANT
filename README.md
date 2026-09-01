# 🤖 WhatsApp AI Assistant

A powerful, multi-device WhatsApp AI Assistant and Group Admin bot that links directly to your WhatsApp account. Features multimodal AI vision, voice note transcription, group moderation & community management, Google Calendar scheduling, conversation summarization, and flexible auto-reply controls.

---

## ✨ Features

- 📸 **Multimodal Vision & Image Understanding**: Send or quote any image with questions (`!ai what is this?`, `review this`, `solve this equation`, `extract text`) powered by OpenRouter, Gemini, and OpenAI.
- 🎙️ **Audio & Voice Note Transcription**: Automatically transcribes voice notes and audio messages.
- 🛡️ **Group & Community Moderation**: Add, kick, promote, demote participants, generate invite links, and manage WhatsApp Community subgroups with LID privacy support.
- 📅 **Google Meet & Calendar Scheduling**: Schedule meetings with natural language (`!meet tomorrow at 3pm with Alex`) and generate instant calendar/Meet links.
- 📝 **Group Chat Summarization**: Run `!summarize [n]` in any group to get an instant AI recap of recent conversation history.
- 🎛️ **Auto-Reply Controls**: Toggle between autonomous DM replies or tag-only mode with `!autoreply on/off`.
- 🔁 **Resilient Multi-Device Auth**: Persistent session pairing with automatic reconnection handling.

---

## 🚀 Quick Setup

### 1. Prerequisites
- **Node.js**: v18+ installed
- **Git**

### 2. Install Dependencies
```bash
git clone https://github.com/Tazimsheriff/WHATSAPP-AI-ASSISSTANT.git
cd WHATSAPP-AI-ASSISSTANT
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Edit `.env` with your API keys:
```env
# AI Provider (openrouter, gemini, or openai)
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=your_openrouter_api_key_here
AI_MODEL=google/gemini-2.5-flash

# WhatsApp Pairing (e.g. 919876543210 with country code)
PAIRING_PHONE_NUMBER=your_phone_number_here

# Bot Configuration
COMMAND_PREFIX=!ai
AUTO_TRANSCRIBE_AUDIO=true
RESPOND_ON_TAG=true
RESPOND_IN_DMS=false
```

### 4. Start the Assistant
```bash
npm run dev
```

### 5. Link with WhatsApp
1. Open WhatsApp on your phone.
2. Go to **Settings** > **Linked Devices** > **Link a Device**.
3. Choose **Link with phone number instead** and enter the 8-digit code shown in the terminal.

---

## 💬 Command Reference

### 🤖 AI & Vision Commands
| Command | Description | Example |
|---|---|---|
| `!ai <prompt>` | Ask any question | `!ai explain quantum computing simply` |
| `!ai <question>` (with image) | Analyze / review attached image | `!ai what dish is this and recipe?` |
| Quoting an image + `!ai review` | Analyze quoted image | `!ai explain this diagram` |
| `!summarize [n]` | Summarize the last `n` messages in group | `!summarize 25` |
| `!meet <details>` | Create meeting & calendar link | `!meet Project Sync tomorrow 4 PM` |
| `!autoreply on / off` | Toggle auto-answering DMs | `!autoreply on` |
| `!ping` | Check bot status & latency | `!ping` |
| `!help` | Show commands menu | `!help` |

### 🛡️ Group Moderation Commands (Admin)
| Command | Description | Example |
|---|---|---|
| `!kick @user` / `!remove @user` | Remove user from group | `!kick @919876543210` |
| `!add <phone>` | Add user by number | `!add 9876543210` |
| `!promote @user` | Make user an admin | `!promote @919876543210` |
| `!demote @user` | Remove admin privileges | `!demote @919876543210` |
| `!invite @user` | Send group invite link to user | `!invite @919876543210` |
| `!link` | Get current group invite link | `!link` |

---

## 🔒 Security & Privacy

- Authentication credentials (`auth_info_baileys/`) and `.env` secrets are strictly excluded from version control via `.gitignore`.
- Loop prevention guards protect against recursive message triggers and echoes.

---

## 📜 License
MIT License.
