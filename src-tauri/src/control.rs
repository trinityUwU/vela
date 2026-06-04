// Control plane : socket Unix local recevant des commandes JSON (une par ligne) du bridge MCP
// lancé par Claude Code dans le terminal intégré, et les relayant à l'UI via events Tauri.
use serde::Deserialize;
use serde_json::json;
use std::io::{BufRead, BufReader, Write};
use std::os::unix::fs::PermissionsExt;
use std::os::unix::net::{UnixListener, UnixStream};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};

// Bridge MCP embarqué : écrit dans le shim dir au démarrage → app installée autonome.
const MCP_BRIDGE_SRC: &str = include_str!("../assets/mcp-bridge.ts");
// Contexte injecté dans le system prompt de Claude (via --append-system-prompt) quand lancé dans Vela.
const VELA_CONTEXT: &str = include_str!("../assets/vela-context.md");

#[derive(Clone)]
pub struct ControlPlane {
    pub sock_path: PathBuf,
    pub shim_dir: PathBuf,
    pub mcp_config: PathBuf,
}

#[derive(Deserialize)]
struct Request {
    action: String,
    #[serde(default)]
    args: serde_json::Value,
}

fn runtime_base() -> PathBuf {
    std::env::var("XDG_RUNTIME_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| std::env::temp_dir())
}

// Cherche un binaire en excluant le shim dir. Scanne le PATH puis des emplacements connus —
// le PATH est souvent appauvri quand Vela est lancé depuis un launcher graphique (sans ~/.local/bin).
fn resolve_real_bin(name: &str, exclude: &Path) -> Option<PathBuf> {
    let mut dirs: Vec<PathBuf> = std::env::var("PATH")
        .map(|p| std::env::split_paths(&p).collect())
        .unwrap_or_default();
    if let Ok(home) = std::env::var("HOME") {
        for sub in [".local/bin", ".bun/bin", ".cargo/bin"] {
            dirs.push(Path::new(&home).join(sub));
        }
    }
    dirs.extend(["/usr/local/bin", "/usr/bin", "/bin"].iter().map(PathBuf::from));
    dirs.into_iter()
        .filter(|d| d != exclude)
        .map(|d| d.join(name))
        .find(|c| c.is_file())
}

// Génère le shim dir : wrapper `claude` (PATH-shim) + config MCP + bridge. None si claude introuvable.
fn build_shim(sock_path: &Path) -> Result<ControlPlane, String> {
    let shim_dir = runtime_base().join("vela-shim");
    std::fs::create_dir_all(&shim_dir).map_err(|e| format!("shim dir : {e}"))?;

    let real_claude = resolve_real_bin("claude", &shim_dir)
        .ok_or("binaire claude introuvable dans le PATH")?;
    let bun = resolve_real_bin("bun", &shim_dir).unwrap_or_else(|| PathBuf::from("bun"));

    let bridge = shim_dir.join("mcp-bridge.ts");
    std::fs::write(&bridge, MCP_BRIDGE_SRC).map_err(|e| format!("bridge : {e}"))?;

    let mcp_config = shim_dir.join("vela-mcp.json");
    let cfg = json!({
        "mcpServers": {
            "vela": {
                "command": bun.to_string_lossy(),
                "args": [bridge.to_string_lossy()],
                "env": { "VELA_SOCK": sock_path.to_string_lossy() }
            }
        }
    });
    std::fs::write(&mcp_config, serde_json::to_vec_pretty(&cfg).unwrap_or_default())
        .map_err(|e| format!("mcp config : {e}"))?;

    let context = shim_dir.join("vela-context.md");
    std::fs::write(&context, VELA_CONTEXT).map_err(|e| format!("contexte : {e}"))?;

    write_wrapper(&shim_dir, &real_claude, &mcp_config, &context)?;
    write_rc_files(&shim_dir)?;

    Ok(ControlPlane { sock_path: sock_path.to_path_buf(), shim_dir, mcp_config })
}

// Wrapper exécutable `claude` : relance le vrai binaire avec --mcp-config + le contexte Vela injecté
// dans le system prompt (env EchoHub purgé). N'altère aucune config globale de Claude.
fn write_wrapper(shim_dir: &Path, real_claude: &Path, mcp_config: &Path, context: &Path) -> Result<(), String> {
    let wrapper = shim_dir.join("claude");
    let script = format!(
        "#!/usr/bin/env bash\n\
         exec env -u ANTHROPIC_BASE_URL -u CLAUDE_CODE_SUBAGENT_MODEL \\\n  \
         {real} --dangerously-skip-permissions --mcp-config {cfg} \\\n  \
         --append-system-prompt \"$(cat {ctx})\" \"$@\"\n",
        real = shell_quote(&real_claude.to_string_lossy()),
        cfg = shell_quote(&mcp_config.to_string_lossy()),
        ctx = shell_quote(&context.to_string_lossy()),
    );
    std::fs::write(&wrapper, script).map_err(|e| format!("wrapper : {e}"))?;
    std::fs::set_permissions(&wrapper, std::fs::Permissions::from_mode(0o755))
        .map_err(|e| format!("chmod wrapper : {e}"))
}

// rc shell qui sourcent la config utilisateur PUIS re-préfixent le shim au PATH → bat le réordering
// du PATH par ~/.zshrc/~/.bashrc. zsh via ZDOTDIR (cf. inject_control_env), bash via --rcfile.
fn write_rc_files(shim_dir: &Path) -> Result<(), String> {
    let q = shell_quote(&shim_dir.to_string_lossy());
    let zshenv = "[[ -f \"$HOME/.zshenv\" ]] && source \"$HOME/.zshenv\"\n";
    let zshrc = format!(
        "export ZDOTDIR=\"$HOME\"\n[[ -f \"$HOME/.zshrc\" ]] && source \"$HOME/.zshrc\"\nexport PATH={q}:\"$PATH\"\n"
    );
    let bashrc = format!(
        "[ -f \"$HOME/.bashrc\" ] && source \"$HOME/.bashrc\"\nexport PATH={q}:\"$PATH\"\n"
    );
    std::fs::write(shim_dir.join(".zshenv"), zshenv).map_err(|e| format!(".zshenv : {e}"))?;
    std::fs::write(shim_dir.join(".zshrc"), zshrc).map_err(|e| format!(".zshrc : {e}"))?;
    std::fs::write(shim_dir.join("bashrc"), bashrc).map_err(|e| format!("bashrc : {e}"))
}

fn shell_quote(s: &str) -> String {
    format!("'{}'", s.replace('\'', "'\\''"))
}

// Valide la commande côté Rust puis émet l'event UI. Renvoie le JSON de réponse pour le bridge.
fn handle(app: &AppHandle, req: &Request) -> serde_json::Value {
    match req.action.as_str() {
        "open_file" => {
            let path = req.args.get("path").and_then(|v| v.as_str()).unwrap_or("");
            if path.is_empty() {
                return json!({ "ok": false, "error": "path requis" });
            }
            let p = Path::new(path);
            if !p.is_file() {
                return json!({ "ok": false, "error": format!("fichier introuvable : {path}") });
            }
            if let Some(err) = require_editor_zone() {
                return err;
            }
            emit(app, "open_file", json!({ "path": path }))
        }
        "open_url" => {
            let url = req.args.get("url").and_then(|v| v.as_str()).unwrap_or("");
            if !(url.starts_with("http://") || url.starts_with("https://")) {
                return json!({ "ok": false, "error": "url http(s) requise" });
            }
            emit(app, "open_url", json!({ "url": url }))
        }
        "hide_browser" => emit(app, "hide_browser", json!({})),
        "preview_content" => {
            if let Some(err) = require_editor_zone() {
                return err;
            }
            let content = req.args.get("content").and_then(|v| v.as_str()).unwrap_or("");
            let title = req.args.get("title").and_then(|v| v.as_str()).unwrap_or("Aperçu");
            emit(app, "preview_content", json!({ "content": content, "title": title }))
        }
        other => json!({ "ok": false, "error": format!("action inconnue : {other}") }),
    }
}

// Renvoie Some(erreur) si le profil Vela actif n'a aucune zone éditeur (sinon None → on peut afficher).
// Évite de switcher de profil : on n'affiche un fichier que si le layout courant peut le montrer.
fn require_editor_zone() -> Option<serde_json::Value> {
    let (has_editor, profile) = crate::profiles::active_editor_status();
    if has_editor {
        return None;
    }
    Some(json!({
        "ok": false,
        "error": format!(
            "Le profil Vela actif « {profile} » n'a aucune zone éditeur pour afficher un fichier. \
             Demande à l'utilisateur de basculer sur un profil qui contient un éditeur (ex. « Édition »), puis réessaie."
        )
    }))
}

fn emit(app: &AppHandle, action: &str, args: serde_json::Value) -> serde_json::Value {
    match app.emit("vela-control", json!({ "action": action, "args": args })) {
        Ok(_) => json!({ "ok": true }),
        Err(e) => json!({ "ok": false, "error": e.to_string() }),
    }
}

fn serve_conn(app: AppHandle, stream: UnixStream) {
    let mut writer = match stream.try_clone() {
        Ok(w) => w,
        Err(_) => return,
    };
    let reader = BufReader::new(stream);
    for line in reader.lines() {
        let line = match line {
            Ok(l) if !l.trim().is_empty() => l,
            _ => continue,
        };
        let resp = match serde_json::from_str::<Request>(&line) {
            Ok(req) => handle(&app, &req),
            Err(e) => json!({ "ok": false, "error": format!("json invalide : {e}") }),
        };
        let mut out = resp.to_string();
        out.push('\n');
        if writer.write_all(out.as_bytes()).is_err() {
            break;
        }
        let _ = writer.flush();
    }
}

// Initialise le control plane : génère le shim, bind le socket, lance l'accept loop. À appeler au setup.
pub fn init(app: &AppHandle) -> Result<ControlPlane, String> {
    let sock_path = runtime_base().join("vela-control.sock");
    if sock_path.exists() {
        let _ = std::fs::remove_file(&sock_path);
    }
    let listener = UnixListener::bind(&sock_path).map_err(|e| format!("bind socket : {e}"))?;
    // Shim best-effort : si claude/bun introuvables, le socket reste actif (le wrapper sera absent).
    let plane = build_shim(&sock_path).unwrap_or_else(|e| {
        eprintln!("[control] shim non généré : {e}");
        let shim_dir = runtime_base().join("vela-shim");
        ControlPlane {
            sock_path: sock_path.clone(),
            mcp_config: shim_dir.join("vela-mcp.json"),
            shim_dir,
        }
    });

    let app = app.clone();
    std::thread::spawn(move || {
        for stream in listener.incoming() {
            match stream {
                Ok(s) => {
                    let app = app.clone();
                    std::thread::spawn(move || serve_conn(app, s));
                }
                Err(_) => break,
            }
        }
    });
    Ok(plane)
}
