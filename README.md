# GOXMR 🟠

**GOXMR** is a privacy-first, open-source "link-in-bio" solution designed for the Monero ecosystem. It allows users to create a sovereign landing page to accept donations and showcase their digital identity without centralized tracking or censorship.

## 🚀 Features

- **Monero First**: Built-in support for XMR status tracking and donation goals.
- **WebAuthn/Passkeys**: Modern, biometric-ready security. No passwords, no seed phrases.
- **Privacy Core**: 0% tracking, 0% analytics, 100% sovereign.
- **Cypherpunk Industrial Aesthetic**: Dark mode, glitch effects, and high-contrast design.
- **Responsive**: Works perfectly on mobile and desktop.

## 🛠 Tech Stack

- **Frontend**: Vite + React + Tailwind CSS
- **Backend**: Node.js + Express
- **Database**: SQLite (Sovereign & Portable)
- **Monero Integration**: `monero-ts` (Scanner logic via View Key)

## 📦 Installation & Local Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/USER/GOXMR.git
   cd GOXMR
   ```

2. **Install dependencies**:
   ```bash
   npm install
   cd server && npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the `server/` directory (Refer to `.env.example` if available).

4. **Run Dev Server**:
   ```bash
   # From root
   npm run dev
   ```

## 🛡 Security

- Uses **WebAuthn (FIDO2)** for hardware-level security (YubiKey, Biometrics).
- Hardened CSP and Helmet headers.
- Rate limiting and bot protection.
- Proxy-ready (configured for Namecheap Node.js environments).

## ☕ Support the Project

If you find this project useful, consider contributing to the **Dev Fund**. These funds help cover hosting, domain renewals, and development infrastructure.

**Monero Address:**
`42EDsE43TWaNxWcN77DZ3oNPkmxC9zsfg9L8Bb6KkwKyTqNng7AsJpuRM1oh8UpkiyfkGLok5ePAMS4miPpXPw8oCKtqwrV`

**Goal:** 5.00 XMR (Infrastructure & Hosting)

## 📜 License

MIT License. Free as in Sovereign.
