# 🦁 Carnivore – WhatsApp AI Assistant
> **Created & Developed with ❤️ by Tazim**

An enterprise-grade, multi-device WhatsApp AI Assistant and Executive Productivity suite named **Carnivore**, created by **Tazim**, that runs directly on your WhatsApp account. Features multimodal AI vision, long-term memory, proactive scheduled reminders, real-time web search, receipt & expense ledger tracking, voice note transcription & speech generation, PDF/document intelligence, Google Calendar scheduling, group administration, and master kill-switch & member access control.

---

## ✨ Full Feature Overview

- 🛑 **Master Kill Switch**: Instantly pause/halt the entire AI assistant anytime (`!kill`, `!resume`, `!status`). Only the owner can reactivate it.
- 🛡️ **Granular Member Access Control**: Restrict AI usage to specific whitelisted members, group admins only, block specific users, or toggle chat-level AI access (`!allow @user`, `!block @user`, `!members <mode>`, `!chat on/off`).
- 🧠 **Long-Term Memory Engine**: Automatically remembers personal facts, preferences, dates, and instructions across chats (`!remember`, `!memories`, `!forget`).
- ⏰ **Proactive Scheduled Reminders**: Set natural language reminders (`!remind in 30 mins to take medicine`, `!remind tomorrow 9am to call client`). Proactively alerts you on WhatsApp!
- 🌐 **Real-Time Web Search**: Fetch live news, scores, stock prices, and weather (`!search latest AI breakthrough`).
- 💰 **Expense & Receipt Tracker**: Log expenses via text (`!expense 450 lunch`) or snap a photo of any receipt. View budget breakdowns and export full `.CSV` spreadsheets (`!expenses`, `!export expenses`).
- 🎨 **AI Image Generation**: Generate stunning 1024x1024 images on demand via Flux / SDXL (`!imagine futuristic cyberpunk car`).
- 🎙️ **Voice Notes & Text-to-Speech**: Transcribes incoming audio notes to text and generates realistic voice audio replies (`!speak <text>`).
- 📄 **Document & PDF Intelligence**: Send any PDF, Word document, or CSV to summarize, extract tables, and answer in-depth questions.
- 📸 **Multimodal Vision**: Send or quote photos with questions (`!ai what is this?`, `review this`, `solve this`).
- 📅 **Google Meet & Calendar**: Natural language meeting scheduler (`!meet Tomorrow 3 PM with client@gmail.com`).
- 🛡️ **Group Moderation & Community Manager**: Moderation tools (`!kick`, `!add`, `!promote`, `!demote`, `!invite`, `!summarize`).
- 💾 **Volume-backed Persistence**: Database, settings, and session keys persist across Railway and Docker restarts.

---

## 💬 Command Reference

### 🛑 Kill Switch & Master Control (Owner Only)
| Command | Description | Example |
|---|---|---|
| `!kill` / `!pause` / `!ai off` | Completely turns OFF all AI features | `!kill` |
| `!resume` / `!start` / `!ai on` | Resumes AI features back to ONLINE | `!resume` |
| `!status` / `!aistatus` | View Kill Switch, member mode & active counts | `!status` |

### 🛡️ Member Access Control & Permissions
| Command | Description | Example |
|---|---|---|
| `!allow @user` / `!whitelist @user` | Allow / whitelist user to use AI | `!allow @919876543210` or `!allow +919876543210` |
| `!block @user` / `!deny @user` | Disallow / block user from using AI | `!block @919876543210` |
| `!unblock @user` | Remove user from block list | `!unblock @919876543210` |
| `!members <mode>` | Set access mode (`all`, `whitelist`, `admins`, `off`) | `!members whitelist` or `!members admins` |
| `!chat on / off` | Toggle AI in the current chat/group | `!chat off` |
| `!permissions` / `!access` | View full whitelist, blocklist & active settings | `!permissions` |

### 🧠 Long-Term Memory
| Command | Description | Example |
|---|---|---|
| `!remember <fact>` | Save a personal fact or preference | `!remember my passport number is A1234567` |
| `!memories` | View all stored facts & preferences | `!memories` |
| `!forget <ID>` | Delete a stored fact | `!forget AB12CD` |

### ⏰ Proactive Reminders
| Command | Description | Example |
|---|---|---|
| `!remind in <time> to <task>` | Relative time reminder | `!remind in 45 mins to submit report` |
| `!remind tomorrow at <time> to <task>` | Future day reminder | `!remind tomorrow at 9:00 AM to call John` |
| `!reminders` | List all active pending reminders | `!reminders` |
| `!delreminder <ID>` | Cancel a scheduled reminder | `!delreminder K9L2M` |

### 🌐 Real-Time Web Search
| Command | Description | Example |
|---|---|---|
| `!search <query>` / `!google <query>` | Live web research & summary | `!search latest tech headlines today` |

### 💰 Expense & Receipt Tracker
| Command | Description | Example |
|---|---|---|
| `!expense <amount> <desc>` | Log an expense manually | `!expense 450 Dinner with friends` |
| *Send Photo of Receipt* | Automatic AI OCR extraction & logging | *(Send photo of bill)* |
| `!expenses` | View total spend & category breakdown | `!expenses` |
| `!export expenses` | Download complete `.CSV` ledger | `!export expenses` |

### 🎨 AI Image Generation
| Command | Description | Example |
|---|---|---|
| `!imagine <prompt>` | Generate high-resolution AI artwork | `!imagine cyberpunk street in neon rain 4k` |

### 🎙️ Audio & Voice Notes
| Command | Description | Example |
|---|---|---|
| `!speak <text>` / `!tts <text>` | Generate a voice audio note | `!speak Meeting starts in 10 minutes` |
| *Send Voice Note* | Transcribe and summarize audio | *(Send/forward voice note)* |

### 📄 Document Analysis
| Command | Description | Example |
|---|---|---|
| *Send PDF / CSV / Doc* | AI reads, summarizes, and answers Q&A | *(Attach document with optional question)* |

### 📅 Google Calendar & Meet
| Command | Description | Example |
|---|---|---|
| `!meet <details>` | Create event, Meet link & email invites | `!meet Friday 3:00 PM with alex@gmail.com` |

### 🛡️ Group Moderation
| Command | Description | Example |
|---|---|---|
| `!kick @user` / `!remove @user` | Remove member from group | `!kick @919876543210` |
| `!add <phone>` | Add user by number | `!add 9876543210` |
| `!promote @user` / `!demote @user` | Change admin status | `!promote @919876543210` |
| `!invite` / `!link` | Get group invite link | `!link` |
| `!summarize [n]` | Summarize last [n] group messages | `!summarize 30` |

### ⚙️ General & Settings
| Command | Description | Example |
|---|---|---|
| `!ai <question>` | Ask any general question | `!ai explain quantum physics simply` |
| `!autoreply on / off` | Toggle auto-answering DMs | `!autoreply on` |
| `!ping` | Check bot connection & latency | `!ping` |
| `!help` | Display full help menu | `!help` |

---

## 🚀 Deployment on Railway

1. Push to GitHub (`main`).
2. Create project on [Railway.com](https://railway.com/) > **Deploy from GitHub repo**.
3. Attach **Volume** with mount path `/app/auth_info_baileys`.
4. Add environment variables (`OPENROUTER_API_KEY`, `AI_MODEL=google/gemini-2.5-flash`, `PAIRING_PHONE_NUMBER=919677054449`).
5. Open Railway logs and link WhatsApp via pairing code.

---

## 📜 License
MIT License.
