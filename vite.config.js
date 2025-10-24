import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    https: {
      key: fs.readFileSync(path.resolve(__dirname, "certs/172.29.176.1+3-key.pem")),
      cert: fs.readFileSync(path.resolve(__dirname, "certs/172.29.176.1+3.pem")),
    },
  },
})
