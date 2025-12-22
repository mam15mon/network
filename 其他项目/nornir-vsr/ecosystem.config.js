const fs = require("fs");
const path = require("path");

const envPath = path.resolve(__dirname, ".env");
if (fs.existsSync(envPath)) {
  const parseEnvLine = (line) => {
    const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);
    if (!match) {
      return null;
    }
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    return { key: match[1], value };
  };

  fs.readFileSync(envPath, "utf-8")
    .split("\n")
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return;
      }
      const parsed = parseEnvLine(trimmed);
      if (parsed) {
        process.env[parsed.key] = process.env[parsed.key] ?? parsed.value;
      }
    });
}

const backendEnv = {
  NODE_ENV: process.env.NODE_ENV || "production",
  BACKEND_CORS_ORIGINS: process.env.BACKEND_CORS_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000",
  AUTH_SECRET_KEY: process.env.AUTH_SECRET_KEY || "change-me-please",
  ACCESS_TOKEN_EXPIRE_MINUTES: process.env.ACCESS_TOKEN_EXPIRE_MINUTES || "120",
  SUPER_ADMIN_USERNAME: process.env.SUPER_ADMIN_USERNAME || "admin",
  SUPER_ADMIN_PASSWORD: process.env.SUPER_ADMIN_PASSWORD || "network123",
  TOTP_ISSUER: process.env.TOTP_ISSUER || "Nornir VSR",
};

if (process.env.NORNIR_VSR_DB_URL) {
  backendEnv.NORNIR_VSR_DB_URL = process.env.NORNIR_VSR_DB_URL;
}

if (process.env.DATABASE_URL && !backendEnv.NORNIR_VSR_DB_URL) {
  backendEnv.NORNIR_VSR_DB_URL = process.env.DATABASE_URL;
}

module.exports = {
  apps: [
    {
      name: "nornir-backend",
      cwd: "backend",
      script: "../.venv/bin/uvicorn",
      args: "main:app --host 0.0.0.0 --port 8000 --timeout-keep-alive 300",
      watch: false,
      autorestart: true,
      interpreter: "none",
      env: backendEnv,
    },
    {
      name: "nornir-frontend",
      cwd: "frontend",
      script: "npm",
      args: "run preview -- --host 127.0.0.1 --port 3000",
      watch: false,
      autorestart: true,
      env: {
        NODE_ENV: "production",
        PORT: process.env.FRONTEND_PORT || "3000",
        VITE_API_BASE: process.env.VITE_API_BASE || "/api",
      },
      interpreter: "none",
    },
  ],
};
