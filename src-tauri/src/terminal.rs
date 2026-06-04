// Terminal intégré : sessions PTY réelles (portable-pty), I/O via events Tauri. Multi-onglets.
use base64::Engine;
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::Path;
use std::sync::{Mutex, MutexGuard};
use tauri::{AppHandle, Emitter};

struct Session {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn portable_pty::Child + Send + Sync>,
}

pub struct TerminalManager {
    sessions: Mutex<HashMap<String, Session>>,
}

impl TerminalManager {
    pub fn new() -> Self {
        Self { sessions: Mutex::new(HashMap::new()) }
    }
    fn lock(&self) -> MutexGuard<'_, HashMap<String, Session>> {
        self.sessions.lock().unwrap()
    }
}

#[derive(Clone, Serialize)]
struct OutputPayload {
    id: String,
    data: String, // base64 des octets bruts du PTY
}

fn new_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let ts = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos();
    format!("term-{ts}")
}

// Boucle de lecture du PTY : émet les octets bruts (base64) puis signale la fin.
fn reader_loop(app: AppHandle, id: String, mut reader: Box<dyn Read + Send>) {
    let mut buf = [0u8; 8192];
    loop {
        match reader.read(&mut buf) {
            Ok(0) | Err(_) => break,
            Ok(n) => {
                let data = base64::engine::general_purpose::STANDARD.encode(&buf[..n]);
                if app.emit("term-output", OutputPayload { id: id.clone(), data }).is_err() {
                    break;
                }
            }
        }
    }
    let _ = app.emit("term-exit", id);
}

// Ouvre une session shell dans `cwd` et démarre le thread de lecture. Retourne l'id de session.
const SHELL_DENYLIST: &[&str] = &["nologin", "git-shell", "systemd-home-fallback-shell", "rbash"];

// Liste les shells interactifs disponibles (présents dans /etc/shells, existants, dédupliqués par nom).
#[tauri::command]
pub fn available_shells() -> Vec<String> {
    let content = std::fs::read_to_string("/etc/shells").unwrap_or_default();
    let mut seen = Vec::new();
    let mut out = Vec::new();
    for line in content.lines() {
        let p = line.trim();
        if p.is_empty() || p.starts_with('#') || !std::path::Path::new(p).exists() {
            continue;
        }
        let name = Path::new(p).file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
        if SHELL_DENYLIST.contains(&name.as_str()) || seen.contains(&name) {
            continue;
        }
        seen.push(name);
        out.push(p.to_string());
    }
    out
}

// Branche le terminal intégré au control plane : expose VELA_SOCK et fait gagner le wrapper `claude`
// du shim. Le PATH-shim seul perd contre ~/.zshrc qui re-préfixe ~/.local/bin → on re-préfixe APRÈS
// le rc utilisateur (ZDOTDIR pour zsh, --rcfile pour bash). No-op si le wrapper n'a pas été généré.
fn inject_control_env(app: &AppHandle, cmd: &mut CommandBuilder, shell: &str) {
    use tauri::Manager;
    let Some(plane) = app.try_state::<crate::control::ControlPlane>() else { return };
    if !plane.shim_dir.join("claude").is_file() {
        return;
    }
    let shim = plane.shim_dir.to_string_lossy().to_string();
    let current = std::env::var("PATH").unwrap_or_default();
    cmd.env("PATH", format!("{shim}:{current}"));
    cmd.env("VELA_SOCK", plane.sock_path.to_string_lossy().to_string());
    cmd.env("VELA_MCP_CONFIG", plane.mcp_config.to_string_lossy().to_string());

    let name = Path::new(shell).file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
    if name.contains("zsh") {
        cmd.env("ZDOTDIR", &shim);
    } else if name.contains("bash") {
        cmd.arg("--rcfile");
        cmd.arg(plane.shim_dir.join("bashrc"));
    }
}

#[tauri::command]
pub fn term_open(
    app: AppHandle,
    state: tauri::State<'_, TerminalManager>,
    cwd: String,
    cols: u16,
    rows: u16,
    shell: Option<String>,
) -> Result<String, String> {
    let pair = native_pty_system()
        .openpty(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
        .map_err(|e| e.to_string())?;

    let shell = shell
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".into()));
    let mut cmd = CommandBuilder::new(&shell);
    cmd.cwd(cwd);
    cmd.env("TERM", "xterm-256color");
    inject_control_env(&app, &mut cmd, &shell);
    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    drop(pair.slave);

    let reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    let id = new_id();
    std::thread::spawn({
        let app = app.clone();
        let id = id.clone();
        move || reader_loop(app, id, reader)
    });

    state.lock().insert(id.clone(), Session { master: pair.master, writer, child });
    Ok(id)
}

// Écrit des octets (frappes clavier) dans le PTY de la session.
#[tauri::command]
pub fn term_input(state: tauri::State<'_, TerminalManager>, id: String, data: String) -> Result<(), String> {
    let mut sessions = state.lock();
    let s = sessions.get_mut(&id).ok_or("Session introuvable")?;
    s.writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
    s.writer.flush().map_err(|e| e.to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Resolved {
    path: String,
    is_dir: bool,
}

// Résout un token affiché dans le terminal en chemin réel, relatif au cwd VIVANT du shell
// (lu via /proc/<pid>/cwd). Renvoie une erreur si le token ne correspond à rien d'existant.
#[tauri::command]
pub fn term_resolve(
    state: tauri::State<'_, TerminalManager>,
    id: String,
    token: String,
) -> Result<Resolved, String> {
    let pid = {
        let sessions = state.lock();
        let s = sessions.get(&id).ok_or("Session introuvable")?;
        s.child.process_id().ok_or("PID indisponible")?
    };

    let raw = token.trim().trim_matches(|c| matches!(c, '"' | '\'' | '`'));
    if raw.is_empty() {
        return Err("Token vide".into());
    }

    let base = std::fs::read_link(format!("/proc/{pid}/cwd"))
        .map_err(|e| format!("cwd PTY illisible : {e}"))?;

    let expanded = if let Some(rest) = raw.strip_prefix("~/") {
        std::env::var("HOME").map(|h| Path::new(&h).join(rest)).unwrap_or_else(|_| base.join(raw))
    } else if raw == "~" {
        std::env::var("HOME").map(std::path::PathBuf::from).unwrap_or_else(|_| base.clone())
    } else {
        let p = Path::new(raw);
        if p.is_absolute() { p.to_path_buf() } else { base.join(p) }
    };

    let canon = match std::fs::canonicalize(&expanded) {
        Ok(c) => c,
        // Le prompt affiche souvent juste le basename du cwd (ex. `Music`) : il pointe alors
        // sur le dossier courant lui-même, pas sur un sous-dossier homonyme inexistant.
        Err(e) => {
            if !raw.contains('/') && base.file_name().map(|n| n == raw).unwrap_or(false) {
                base.clone()
            } else {
                return Err(format!("Chemin introuvable : {e}"));
            }
        }
    };
    let is_dir = canon.is_dir();
    Ok(Resolved { path: canon.to_string_lossy().to_string(), is_dir })
}

// Redimensionne le PTY (suite à un fit côté front).
#[tauri::command]
pub fn term_resize(state: tauri::State<'_, TerminalManager>, id: String, cols: u16, rows: u16) -> Result<(), String> {
    let sessions = state.lock();
    let s = sessions.get(&id).ok_or("Session introuvable")?;
    s.master
        .resize(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
        .map_err(|e| e.to_string())
}

// Ferme la session : tue le process et libère le PTY.
#[tauri::command]
pub fn term_close(state: tauri::State<'_, TerminalManager>, id: String) -> Result<(), String> {
    if let Some(mut s) = state.lock().remove(&id) {
        let _ = s.child.kill();
    }
    Ok(())
}
