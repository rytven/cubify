import { createFileRoute } from "@tanstack/react-router";

const DIR = "/workspace/.data/cubify-exports";
const MAX_BYTES = 80 * 1024 * 1024;
const TTL_MS = 2 * 60 * 60 * 1000;

function safeName(raw: string): string {
  const trimmed = raw.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  return trimmed.slice(0, 80) || "cubify-export.bin";
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "\u0026amp;";
      case "<":
        return "\u0026lt;";
      case ">":
        return "\u0026gt;";
      case '"':
        return "\u0026quot;";
      default:
        return "\u0026#39;";
    }
  });
}

function isId(id: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(id);
}

type Fs = typeof import("node:fs/promises");
type Path = typeof import("node:path");

async function io(): Promise<{ fs: Fs; path: Path }> {
  const [fs, path] = await Promise.all([import("node:fs/promises"), import("node:path")]);
  await fs.mkdir(DIR, { recursive: true });
  return { fs, path };
}

async function prune(fs: Fs, path: Path) {
  let names: string[] = [];
  try {
    names = await fs.readdir(DIR);
  } catch {
    return;
  }
  const now = Date.now();
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(DIR, name), "utf8");
      const meta = JSON.parse(raw) as { created?: number };
      if (!meta.created || now - meta.created > TTL_MS) {
        const id = name.slice(0, -5);
        await fs.unlink(path.join(DIR, name)).catch(() => {});
        await fs.unlink(path.join(DIR, `${id}.bin`)).catch(() => {});
      }
    } catch {
      // skip unreadable meta
    }
  }
}

function landingHtml(id: string, filename: string): string {
  const safe = escapeHtml(filename);
  const dl = `/api/export?id=${encodeURIComponent(id)}&dl=1`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Download ${safe}</title>
  <style>
    :root { color-scheme: dark; }
    body { margin:0; min-height:100dvh; display:grid; place-items:center;
      background:#0c0d0c; color:#eceee9; font-family:Outfit,system-ui,sans-serif; }
    main { width:min(30rem, calc(100% - 2rem)); background:#141614; border:1px solid #2a2d2a;
      border-radius:1rem; padding:1.5rem; }
    h1 { font-family:Syne,Outfit,sans-serif; font-size:1.25rem; margin:0 0 .5rem; }
    p { color:#8d9188; font-size:.9rem; line-height:1.5; margin:0 0 1rem; }
    ol { color:#8d9188; font-size:.9rem; line-height:1.55; margin:0 0 1.25rem; padding-left:1.2rem; }
    a.btn { display:flex; align-items:center; justify-content:center; height:2.75rem;
      border-radius:.625rem; background:#d7dbd2; color:#0c0d0c; font-weight:600;
      text-decoration:none; }
    a.btn:hover { opacity:.9; }
    code { color:#eceee9; }
  </style>
</head>
<body>
  <main>
    <h1>Save ${safe}</h1>
    <p>This page will not start a download by itself — Brave blocks that. Click the button.</p>
    <ol>
      <li>Click <strong>Save file</strong> below.</li>
      <li>If Brave still blocks it, click the lion icon in the address bar and allow downloads.</li>
      <li>Or right-click the button and choose <strong>Save link as…</strong></li>
    </ol>
    <a class="btn" href="${dl}">Save file</a>
  </main>
</body>
</html>`;
}

export const Route = createFileRoute("/api/export")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { fs, path } = await io();
        await prune(fs, path);
        const filename = safeName(request.headers.get("x-filename") ?? "cubify-export.bin");
        const type = request.headers.get("content-type") || "application/octet-stream";
        const body = await request.arrayBuffer();
        if (body.byteLength === 0) return new Response("empty", { status: 400 });
        if (body.byteLength > MAX_BYTES) return new Response("too large", { status: 413 });
        const id = crypto.randomUUID();
        const bytes = new Uint8Array(body.byteLength);
        bytes.set(new Uint8Array(body));
        await fs.writeFile(path.join(DIR, `${id}.bin`), bytes);
        await fs.writeFile(
          path.join(DIR, `${id}.json`),
          JSON.stringify({ filename, type, created: Date.now() }),
        );
        return Response.json({ id, url: `/api/export?id=${id}` });
      },
      GET: async ({ request }) => {
        const { fs, path } = await io();
        await prune(fs, path);
        const url = new URL(request.url);
        const id = url.searchParams.get("id") ?? "";
        if (!isId(id)) return new Response("not found", { status: 404 });
        let metaRaw: string;
        try {
          metaRaw = await fs.readFile(path.join(DIR, `${id}.json`), "utf8");
        } catch {
          return new Response(landingMissing(), {
            status: 404,
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        }
        const meta = JSON.parse(metaRaw) as { filename: string; type: string; created: number };
        if (Date.now() - meta.created > TTL_MS) {
          return new Response(landingMissing(), {
            status: 404,
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        }
        if (url.searchParams.get("dl") !== "1") {
          return new Response(landingHtml(id, meta.filename), {
            headers: {
              "content-type": "text/html; charset=utf-8",
              "cache-control": "no-store",
            },
          });
        }
        const buf = await fs.readFile(path.join(DIR, `${id}.bin`));
        const copy = new Uint8Array(buf.byteLength);
        copy.set(buf);
        return new Response(copy.buffer, {
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": `attachment; filename="${meta.filename}"`,
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});

function landingMissing(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Download expired</title>
  <style>
    body { margin:0; min-height:100dvh; display:grid; place-items:center;
      background:#0c0d0c; color:#eceee9; font-family:Outfit,system-ui,sans-serif; }
    main { width:min(28rem, calc(100% - 2rem)); background:#141614; border:1px solid #2a2d2a;
      border-radius:1rem; padding:1.5rem; }
    h1 { font-size:1.25rem; margin:0 0 .5rem; }
    p { color:#8d9188; line-height:1.5; margin:0; }
  </style>
</head>
<body>
  <main>
    <h1>This download expired</h1>
    <p>Go back to Cubify, export again, then open the new link in this tab.</p>
  </main>
</body>
</html>`;
}
