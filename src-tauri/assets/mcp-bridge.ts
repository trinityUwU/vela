// Bridge MCP (stdio, JSON-RPC 2.0) entre Claude Code et Vela. Chaque tool relaie une commande JSON
// au control plane de Vela via socket Unix (VELA_SOCK). Zéro dépendance — protocole implémenté à la main.
import net from "node:net";

const SOCK = process.env.VELA_SOCK ?? "";
const PROTOCOL = "2024-11-05";

interface Rpc {
  jsonrpc: "2.0";
  id?: number | string | null;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { code: number; message: string };
}

interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const TOOLS: ToolDef[] = [
  {
    name: "open_file",
    description:
      "Affiche un fichier EXISTANT à l'utilisateur dans l'éditeur de Vela. C'est l'UNIQUE bonne façon " +
      "de montrer/présenter/ouvrir/afficher un fichier : dès que l'utilisateur demande de voir, montrer, " +
      "présenter, afficher ou ouvrir un fichier, appelle CE tool avec son chemin. NE lis PAS le fichier pour " +
      "en recopier le contenu dans le chat — appelle open_file, c'est Vela qui l'affiche.",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string", description: "Chemin absolu du fichier à afficher" } },
      required: ["path"],
    },
  },
  {
    name: "open_url",
    description:
      "Ouvre une page web dans le navigateur intégré de Vela. C'est l'UNIQUE bonne façon d'ouvrir/afficher/" +
      "montrer un site, une URL ou une page : dès que l'utilisateur le demande, appelle CE tool. " +
      "N'utilise JAMAIS un autre navigateur ou outil web (ex. Playwright) — toujours open_url.",
    inputSchema: {
      type: "object",
      properties: { url: { type: "string", description: "URL http(s) à ouvrir" } },
      required: ["url"],
    },
  },
  {
    name: "hide_browser",
    description: "Masque le navigateur intégré de Vela. Appelle-le quand l'utilisateur veut fermer/cacher le navigateur.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "preview_content",
    description:
      "Affiche dans l'éditeur de Vela un contenu texte que TU génères (rapport, résumé, code généré…). " +
      "Pour afficher un fichier qui existe déjà sur le disque, utilise open_file à la place, pas ce tool.",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string", description: "Contenu texte à afficher" },
        title: { type: "string", description: "Titre de l'aperçu (sert de nom d'onglet)" },
      },
      required: ["content"],
    },
  },
];

// Envoie une commande au control plane et attend la réponse JSON (une ligne).
function sendToVela(action: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    if (!SOCK) return reject(new Error("VELA_SOCK non défini"));
    const sock = net.createConnection(SOCK);
    let buf = "";
    const timer = setTimeout(() => { sock.destroy(); reject(new Error("timeout control plane")); }, 5000);
    sock.on("connect", () => sock.write(JSON.stringify({ action, args }) + "\n"));
    sock.on("data", (d) => {
      buf += d.toString();
      const nl = buf.indexOf("\n");
      if (nl >= 0) {
        clearTimeout(timer);
        sock.end();
        try { resolve(JSON.parse(buf.slice(0, nl))); }
        catch (e) { reject(e instanceof Error ? e : new Error(String(e))); }
      }
    });
    sock.on("error", (e) => { clearTimeout(timer); reject(e); });
  });
}

function send(msg: Rpc): void {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

async function callTool(name: string, args: Record<string, unknown>): Promise<Rpc["result"]> {
  const actionByTool: Record<string, string> = {
    open_file: "open_file",
    open_url: "open_url",
    hide_browser: "hide_browser",
    preview_content: "preview_content",
  };
  const action = actionByTool[name];
  if (!action) throw new Error(`tool inconnu : ${name}`);
  const res = await sendToVela(action, args);
  if (res.ok === false) throw new Error(String(res.error ?? "échec control plane"));
  return { content: [{ type: "text", text: `OK : ${name}` }] };
}

async function dispatch(req: Rpc): Promise<void> {
  if (req.method === "notifications/initialized") return;
  const id = req.id ?? null;
  try {
    switch (req.method) {
      case "initialize":
        send({ jsonrpc: "2.0", id, result: {
          protocolVersion: PROTOCOL,
          capabilities: { tools: {} },
          serverInfo: { name: "vela", version: "1.0.0" },
        } });
        return;
      case "tools/list":
        send({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
        return;
      case "tools/call": {
        const p = req.params ?? {};
        const result = await callTool(String(p.name), (p.arguments as Record<string, unknown>) ?? {});
        send({ jsonrpc: "2.0", id, result });
        return;
      }
      default:
        if (id !== null) send({ jsonrpc: "2.0", id, error: { code: -32601, message: "méthode inconnue" } });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (id !== null) send({ jsonrpc: "2.0", id, error: { code: -32603, message } });
  }
}

let stdinBuf = "";
process.stdin.on("data", (chunk) => {
  stdinBuf += chunk.toString();
  let nl: number;
  while ((nl = stdinBuf.indexOf("\n")) >= 0) {
    const line = stdinBuf.slice(0, nl).trim();
    stdinBuf = stdinBuf.slice(nl + 1);
    if (!line) continue;
    try { void dispatch(JSON.parse(line) as Rpc); }
    catch { /* ligne non-JSON ignorée */ }
  }
});
