// Terminal intégré : sessions PTY réelles (portable-pty), I/O via events Tauri. Multi-onglets.
use base64::Engine;
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
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
#[tauri::command]
pub fn term_open(
    app: AppHandle,
    state: tauri::State<'_, TerminalManager>,
    cwd: String,
    cols: u16,
    rows: u16,
) -> Result<String, String> {
    let pair = native_pty_system()
        .openpty(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
        .map_err(|e| e.to_string())?;

    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".into());
    let mut cmd = CommandBuilder::new(shell);
    cmd.cwd(cwd);
    cmd.env("TERM", "xterm-256color");
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
