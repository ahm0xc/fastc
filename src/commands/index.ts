import pc from "picocolors";

export async function runSpeedTest() {
  await measureDownloadRealtime();
}

const SITE_URL = "https://fast.com/";
const API_URL = "https://api.fast.com/netflix/speedtest/v2";
const FALLBACK_TOKEN = "YXNkZmFzZGxmbnNkYWZoYXNkZmhrYWxm";
const CONNECTIONS = 5;
const DURATION_MS = 10_000;
const TICK_INTERVAL_MS = 100;

class TokenRejectedError extends Error {}

async function fetchText(url: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(url, {
    signal,
    headers: { "User-Agent": "node-fast/1.0" },
  });
  if (!res.ok)
    throw new Error(`fetch ${url} failed: ${res.status} ${res.statusText}`);
  return res.text();
}

async function getTokenFromSite(signal?: AbortSignal): Promise<string> {
  const page = await fetchText(SITE_URL, signal);
  const scriptMatch = page.match(/app-[a-z0-9]+\.js/);
  if (!scriptMatch) throw new Error("fast.com script not found");
  const scriptUrl = new URL(scriptMatch[0], SITE_URL).toString();
  const scriptText = await fetchText(scriptUrl, signal);
  const tokenMatch = scriptText.match(/token:"([^"]+)"/);
  if (!tokenMatch) throw new Error("fast.com token not found in script");
  return tokenMatch[1]!;
}

async function getTargets(
  token: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const url = new URL(API_URL);
  url.searchParams.set("https", "true");
  url.searchParams.set("token", token);
  url.searchParams.set("urlCount", String(CONNECTIONS));
  const res = await fetch(url.toString(), {
    signal,
    headers: { "User-Agent": "node-fast/1.0" },
  });
  if (res.status === 401 || res.status === 403)
    throw new TokenRejectedError("token rejected");
  if (!res.ok)
    throw new Error(`api.fast.com returned ${res.status} ${res.statusText}`);
  const data = (await res.json().catch(() => ({}))) as any;
  if (
    !data.targets ||
    !Array.isArray(data.targets) ||
    data.targets.length === 0
  ) {
    throw new Error("no targets returned from fast.com API");
  }
  return data.targets.map((t: any) => t.url).filter(Boolean);
}

async function downloadWorker(
  url: string,
  signal: AbortSignal,
  addBytes: (n: number) => void,
) {
  try {
    while (!signal.aborted) {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Accept-Encoding": "identity",
          "User-Agent": "node-fast/1.0",
        },
        signal,
      });
      if (!res.ok) return;

      const body: any = res.body;
      if (body && typeof body.getReader === "function") {
        const reader = body.getReader();
        try {
          while (!signal.aborted) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) addBytes((value.byteLength ?? value.length) as number);
          }
        } finally {
        }
      } else if (body && Symbol.asyncIterator in body) {
        // @ts-ignore
        for await (const chunk of body) {
          if (signal.aborted) break;
          addBytes(chunk.length ?? 0);
        }
      } else {
        const arr = await res.arrayBuffer();
        addBytes(arr.byteLength);
      }
    }
  } catch {
    return;
  }
}

function bytesToMbps(bytes: number, seconds: number): number {
  return (bytes * 8) / (seconds * 1_000_000);
}

function formatSpeed(mbps: number): string {
  if (mbps >= 1000) return `${(mbps / 1000).toFixed(2)} Gbps`;
  return `${mbps.toFixed(2)} Mbps`;
}

function formatSpeedParts(mbps: number): [string, string] {
  if (mbps >= 1000) return [`${(mbps / 1000).toFixed(2)}`, " Gbps"];
  return [`${mbps.toFixed(2)}`, " Mbps"];
}

async function measureDownloadRealtime(): Promise<void> {
  let targets: string[] | null = null;
  try {
    targets = await getTargets(FALLBACK_TOKEN);
  } catch (err) {
    if (err instanceof TokenRejectedError) {
      try {
        const token = await getTokenFromSite();
        targets = await getTargets(token);
      } catch (inner) {
        console.error("failed to refresh token and get targets:", inner);
        return;
      }
    } else {
      console.error("failed to get targets:", err);
      return;
    }
  }

  if (!targets || targets.length === 0) {
    console.error("no targets available");
    return;
  }

  const used = targets.slice(0, CONNECTIONS);
  let totalBytes = 0;
  const addBytes = (n: number) => {
    totalBytes += n;
  };

  const controller = new AbortController();
  const { signal } = controller;

  const workerPromises = used.map((t) => downloadWorker(t, signal, addBytes));

  let prevBytes = 0;
  let peakMbps = 0;
  const startTime = Date.now();
  const BAR_WIDTH = 16;
  const speedHistory: number[] = Array(BAR_WIDTH).fill(0);
  const BAR_LEVELS = [" ", "⣀", "⣤", "⣶", "⣿"];

  const interval = setInterval(() => {
    const now = Date.now();
    const elapsedMs = now - startTime;
    const elapsedSec = Math.max(0.001, elapsedMs / 1000);

    const delta = totalBytes - prevBytes;
    prevBytes = totalBytes;

    const instantMbps = bytesToMbps(delta, TICK_INTERVAL_MS / 1000);
    if (instantMbps > peakMbps) peakMbps = instantMbps;

    speedHistory.push(instantMbps);
    if (speedHistory.length > BAR_WIDTH) speedHistory.shift();
    const windowMax = Math.max(...speedHistory, 1);
    const chart = speedHistory
      .map(
        (s) =>
          BAR_LEVELS[
            Math.min(
              Math.round((s / windowMax) * (BAR_LEVELS.length - 1)),
              BAR_LEVELS.length - 1,
            )
          ],
      )
      .join("");

    const [speedVal, speedUnit] = formatSpeedParts(instantMbps);
    const line = `\r${pc.green("↓")} ${speedVal}${pc.gray(speedUnit)}  ${pc.green(chart)}  ${pc.gray(`peak ${formatSpeed(peakMbps)}`)}`;
    process.stdout.write(line);
  }, TICK_INTERVAL_MS);

  await new Promise<void>((resolve) => {
    setTimeout(() => {
      controller.abort();
      resolve();
    }, DURATION_MS);
  });

  await Promise.allSettled(workerPromises);

  clearInterval(interval);
  const totalElapsedMs = Date.now() - startTime;
  const totalElapsedSec = Math.max(0.001, totalElapsedMs / 1000);
  const finalMbps = bytesToMbps(totalBytes, totalElapsedSec);

  process.stdout.write("\n");
  console.log(`\n${pc.green(formatSpeed(finalMbps))}`);
}
