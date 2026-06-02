// Séparation de stems audio via demucs (Meta, PyTorch local) : détection, séparation
// avec progression/annulation, et installation managée dans un venv Vela dédié.
// Souveraineté : demucs tourne 100% local, install dans ~/.local/share/vela/demucs-venv.
use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};

#[derive(Serialize)]
pub struct StemsStatus {
    pub installed: bool,
    pub path: Option<String>,
}

#[derive(Clone, Serialize)]
pub struct StemsProgress {
    pub job_id: String,
    pub percent: f32,
    pub status: String,
}

#[derive(Clone, Serialize)]
pub struct StemsInstallProgress {
    pub job_id: String,
    pub line: String,
    pub status: String,
}

pub struct StemsManager {
    jobs: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl StemsManager {
    pub fn new() -> Self {
        Self { jobs: Mutex::new(HashMap::new()) }
    }

    fn register(&self, id: &str) -> Arc<AtomicBool> {
        let flag = Arc::new(AtomicBool::new(false));
        self.jobs.lock().unwrap().insert(id.to_string(), flag.clone());
        flag
    }

    fn cancel(&self, id: &str) {
        if let Some(flag) = self.jobs.lock().unwrap().get(id) {
            flag.store(true, Ordering::Relaxed);
        }
    }
}

/// Venv Vela managé pour demucs : $HOME/.local/share/vela/demucs-venv.
fn venv_dir() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_default();
    PathBuf::from(home).join(".local/share/vela/demucs-venv")
}

/// Parse un pourcentage depuis une ligne tqdm (` 42%|████ | 120/289`) → Some(42.0).
/// Le token peut être collé à la barre (`42%|████`) : on coupe au `%` et parse le préfixe.
fn parse_demucs_percent(line: &str) -> Option<f32> {
    for token in line.split_whitespace() {
        if let Some((head, _)) = token.split_once('%') {
            if let Ok(pct) = head.trim().parse::<f32>() {
                return Some(pct);
            }
        }
    }
    None
}

fn emit_progress(app: &AppHandle, job_id: &str, percent: f32, status: &str) {
    let _ = app.emit("stems-progress", StemsProgress {
        job_id: job_id.to_string(),
        percent,
        status: status.to_string(),
    });
}

fn emit_install(app: &AppHandle, job_id: &str, line: &str, status: &str) {
    let _ = app.emit("stems-install-progress", StemsInstallProgress {
        job_id: job_id.to_string(),
        line: line.to_string(),
        status: status.to_string(),
    });
}

fn build_separate_args(output_dir: &str, two_stems: &Option<String>) -> Vec<String> {
    let mut args: Vec<String> = vec!["-n".into(), "htdemucs".into(), "--out".into(), output_dir.into()];
    if let Some(stem) = two_stems {
        args.push("--two-stems".into());
        args.push(stem.clone());
    }
    args
}

fn spawn_demucs(demucs: &str, args: &[String], input: &str) -> Result<Child, String> {
    Command::new(demucs)
        .args(args)
        .arg(input)
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            eprintln!("[stems] demucs spawn failed: {e}");
            format!("demucs introuvable: {e}")
        })
}

/// Lit le stderr demucs ligne par ligne, émet la progression, gère l'annulation.
/// Retourne true si annulé (child tué).
fn pump_separate(app: &AppHandle, child: &mut Child, job_id: &str, cancelled: &Arc<AtomicBool>) -> bool {
    use std::io::BufRead;
    let Some(stderr) = child.stderr.take() else { return false; };
    for line in std::io::BufReader::new(stderr).lines().map_while(Result::ok) {
        if cancelled.load(Ordering::Relaxed) {
            let _ = child.kill();
            return true;
        }
        if let Some(pct) = parse_demucs_percent(&line) {
            emit_progress(app, job_id, pct, "running");
        }
    }
    cancelled.load(Ordering::Relaxed)
}

fn run_separate_job(app: AppHandle, cancelled: Arc<AtomicBool>, demucs: String,
                    job_id: String, input: String, output_dir: String, two_stems: Option<String>) {
    let args = build_separate_args(&output_dir, &two_stems);
    let mut child = match spawn_demucs(&demucs, &args, &input) {
        Ok(c) => c,
        Err(e) => { eprintln!("[stems] job {job_id} spawn err: {e}"); emit_progress(&app, &job_id, 0.0, "error"); return; }
    };
    if pump_separate(&app, &mut child, &job_id, &cancelled) {
        emit_progress(&app, &job_id, 0.0, "cancelled");
        return;
    }
    match child.wait() {
        Ok(s) if s.success() => emit_progress(&app, &job_id, 100.0, "done"),
        Ok(s) => { eprintln!("[stems] job {job_id} exit {s}"); emit_progress(&app, &job_id, 0.0, "error"); }
        Err(e) => { eprintln!("[stems] job {job_id} wait err: {e}"); emit_progress(&app, &job_id, 0.0, "error"); }
    }
}

/// Crée le venv. Err (avec log) si python3 absent ou statut non-zéro.
fn create_venv(venv: &PathBuf) -> Result<(), String> {
    if let Some(parent) = venv.parent() {
        std::fs::create_dir_all(parent).map_err(|e| {
            eprintln!("[stems] create_dir_all failed: {e}");
            format!("création répertoire venv échouée: {e}")
        })?;
    }
    let status = Command::new("python3")
        .args(["-m", "venv"])
        .arg(venv)
        .status()
        .map_err(|e| {
            eprintln!("[stems] python3 venv spawn failed: {e}");
            format!("python3 introuvable: {e}")
        })?;
    if !status.success() {
        eprintln!("[stems] venv creation exit {status}");
        return Err(format!("création venv échouée: {status}"));
    }
    Ok(())
}

fn spawn_pip_install(venv: &PathBuf) -> Result<Child, String> {
    let pip = venv.join("bin/pip");
    Command::new(&pip)
        .args(["install", "-U", "demucs"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            eprintln!("[stems] pip spawn failed: {e}");
            format!("pip introuvable: {e}")
        })
}

/// Stream le stdout pip ligne par ligne, émet chaque ligne, gère l'annulation.
/// Retourne true si annulé.
fn pump_install(app: &AppHandle, child: &mut Child, job_id: &str, cancelled: &Arc<AtomicBool>) -> bool {
    use std::io::BufRead;
    let Some(stdout) = child.stdout.take() else { return false; };
    for line in std::io::BufReader::new(stdout).lines().map_while(Result::ok) {
        if cancelled.load(Ordering::Relaxed) {
            let _ = child.kill();
            return true;
        }
        emit_install(app, job_id, &line, "running");
    }
    cancelled.load(Ordering::Relaxed)
}

fn run_install_job(app: AppHandle, cancelled: Arc<AtomicBool>, job_id: String) {
    let venv = venv_dir();
    emit_install(&app, &job_id, "création du venv...", "running");
    if let Err(e) = create_venv(&venv) {
        eprintln!("[stems] install {job_id} venv err: {e}");
        emit_install(&app, &job_id, &e, "error");
        return;
    }
    emit_install(&app, &job_id, "installation de demucs (PyTorch, multi-Go)...", "running");
    let mut child = match spawn_pip_install(&venv) {
        Ok(c) => c,
        Err(e) => { eprintln!("[stems] install {job_id} pip err: {e}"); emit_install(&app, &job_id, &e, "error"); return; }
    };
    if pump_install(&app, &mut child, &job_id, &cancelled) {
        emit_install(&app, &job_id, "annulé", "cancelled");
        return;
    }
    match child.wait() {
        Ok(s) if s.success() => emit_install(&app, &job_id, "demucs installé", "done"),
        Ok(s) => { eprintln!("[stems] install {job_id} exit {s}"); emit_install(&app, &job_id, &format!("échec: {s}"), "error"); }
        Err(e) => { eprintln!("[stems] install {job_id} wait err: {e}"); emit_install(&app, &job_id, &format!("échec: {e}"), "error"); }
    }
}

#[tauri::command]
pub fn stems_status() -> StemsStatus {
    let path = crate::media_probe::demucs_executable();
    StemsStatus { installed: path.is_some(), path }
}

#[tauri::command]
pub fn stems_separate(app: AppHandle, state: State<StemsManager>, job_id: String,
                      input: String, output_dir: String, two_stems: Option<String>) -> Result<(), String> {
    let demucs = crate::media_probe::demucs_executable().ok_or_else(|| {
        eprintln!("[stems] separate refused: demucs non installé");
        "demucs non installé".to_string()
    })?;
    let cancelled = state.register(&job_id);
    std::thread::spawn(move || {
        run_separate_job(app, cancelled, demucs, job_id, input, output_dir, two_stems)
    });
    Ok(())
}

#[tauri::command]
pub fn stems_install(app: AppHandle, state: State<StemsManager>, job_id: String) -> Result<(), String> {
    let cancelled = state.register(&job_id);
    std::thread::spawn(move || run_install_job(app, cancelled, job_id));
    Ok(())
}

#[tauri::command]
pub fn stems_cancel(state: State<StemsManager>, job_id: String) -> Result<(), String> {
    state.cancel(&job_id);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_status_not_installed() {
        let status = stems_status();
        assert!(!status.installed, "demucs ne devrait pas être installé");
        assert!(status.path.is_none(), "path devrait être None");
    }

    #[test]
    fn test_parse_demucs_percent() {
        assert_eq!(parse_demucs_percent(" 42%|████   | 120/289"), Some(42.0));
        assert_eq!(parse_demucs_percent("100%|██████| 289/289"), Some(100.0));
        assert_eq!(parse_demucs_percent("loading model"), None);
        assert_eq!(parse_demucs_percent(""), None);
    }
}
