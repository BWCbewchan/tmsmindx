/**
 * Removes `.next/dev` before `next build`.
 *
 * Turbopack dev can leave `.next/dev/types/routes.d.ts` out of sync with
 * `.next/dev/types/validator.ts` (e.g. empty AppRoutes, missing AppRouteHandlerRoutes),
 * which breaks the production TypeScript pass. Production route types live under
 * `.next/types/`; dev types are recreated on the next `next dev` run.
 */
const fs = require("fs");
const net = require("net");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const NEXT_DEV = path.join(ROOT, ".next", "dev");
const DEV_PORT = Number(process.env.DEV_PREP_PORT || process.env.PORT || 3000);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isPortInUse(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const finish = (inUse) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(inUse);
    };

    socket.setTimeout(500);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function main() {
  if (!fs.existsSync(NEXT_DEV)) return;

  if (await isPortInUse(DEV_PORT)) {
    console.warn(
      `[prebuild-clean-next-dev] skipped: port ${DEV_PORT} is active. Stop the dev server before building to avoid corrupting .next/dev.`
    );
    return;
  }

  for (let i = 0; i <= 3; i++) {
    try {
      fs.rmSync(NEXT_DEV, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
      console.log("[prebuild-clean-next-dev] removed .next/dev");
      return;
    } catch (err) {
      if (i < 3) {
        console.log(`[prebuild-clean-next-dev] removal attempt ${i + 1} failed, retrying...`);
        await sleep(500);
      } else {
        console.warn("[prebuild-clean-next-dev] could not remove .next/dev:", err.message);
      }
    }
  }
}

main();
