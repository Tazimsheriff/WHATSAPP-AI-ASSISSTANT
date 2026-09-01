# ☁️ Cloud Deployment Guide (Run 24/7)

Running your WhatsApp AI Assistant in the cloud allows it to stay online 24/7 even when your PC is turned off.

---

## 🔑 Crucial Concept: Session Persistence

WhatsApp connects via session tokens stored in the `auth_info_baileys/` directory.
When running on the cloud, **this folder must be preserved across restarts** so you don't have to re-scan the QR code every time the server boots.

---

## 🌟 Method 1: Cloud VPS with PM2 (Recommended — Simplest & 100% Free / Cheap)

Works on any Linux VPS (e.g., **Oracle Cloud Free Tier** (free forever), **DigitalOcean $4 Droplet**, **AWS EC2 t4g/t3.micro**, **Hetzner**, **Linode**).

### Steps:
1. **Connect to your VPS via SSH**:
   ```bash
   ssh root@your_server_ip
   ```

2. **Install Node.js & PM2**:
   ```bash
   # Install Node.js 22
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt-get install -y nodejs git

   # Install PM2 process manager
   sudo npm install -g pm2
   ```

3. **Upload or Clone your code**:
   ```bash
   git clone <your-repo-url> whatsapp-bot
   cd whatsapp-bot
   npm install
   ```

4. **Set up `.env`**:
   ```bash
   nano .env
   # Paste your OPENROUTER_API_KEY / settings and save (Ctrl+O, Enter, Ctrl+X)
   ```

5. **Initial QR Code Scan (Run once interactively)**:
   ```bash
   npm start
   ```
   - Scan the QR code in your terminal with WhatsApp.
   - Once connected (`🚀 Successfully connected to WhatsApp!`), press `Ctrl + C`.

6. **Start 24/7 with PM2**:
   ```bash
   pm2 start ecosystem.config.cjs
   pm2 save
   pm2 startup
   ```
   > PM2 will now automatically keep the bot running and restart it if the server ever reboots.
   > To view live logs anytime: `pm2 logs whatsapp-ai-bot`

---

## 🐳 Method 2: Docker / Docker Compose (Any Cloud / VPS)

If your server has Docker installed:

1. Copy the project folder to the server.
2. Edit `.env` with your API keys.
3. Run:
   ```bash
   # Build and start container with volume mounted
   docker compose up -d
   ```
4. View the QR code in the logs to scan:
   ```bash
   docker logs -f whatsapp-ai-bot
   ```

---

## 🚂 Method 3: Railway.app / Fly.io (PaaS)

### Railway:
1. Create a new project on [Railway.app](https://railway.app).
2. Deploy from your GitHub repository.
3. Add environment variables in the Railway dashboard (`OPENROUTER_API_KEY`, etc.).
4. **Important**: Attach a **Persistent Volume** mounted at `/app/auth_info_baileys`.
5. Open the **Deploy Logs** in Railway dashboard to scan the QR code displayed on first boot.

### Fly.io:
1. Install `flyctl`.
2. Run `fly launch` in this directory.
3. Create a storage volume for the session:
   ```bash
   fly volumes create wa_session_data --size 1
   ```
4. Mount the volume to `/app/auth_info_baileys` in `fly.toml`.
5. Deploy with `fly deploy` and check `fly logs`.

---

## 📱 Pairing Code Alternative (No QR Code Needed)

If terminal QR formatting is distorted in web cloud logs:
1. In `.env`, set:
   ```env
   PAIRING_PHONE_NUMBER=919876543210
   ```
   *(Your phone number with country code, no + or spaces)*
2. Start the bot on the cloud.
3. It will print an 8-character code (e.g. `ABC1-23YZ`).
4. On your phone: Open **WhatsApp** > **Linked Devices** > **Link with Phone Number** > Enter the 8-character code.
