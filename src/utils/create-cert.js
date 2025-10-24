import { execSync } from "child_process";
import path from "path";

const key = path.resolve("localhost-key.pem");
const cert = path.resolve("localhost-cert.pem");

execSync(`npx mkcert localhost 127.0.0.1 ::1`, { stdio: "inherit" });
console.log("✅ Certificates generated:", key, cert);
