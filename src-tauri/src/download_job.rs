// Jobs de téléchargement média (yt-dlp / spotdl) : exécution background avec
// progression streamée (event "download-progress") et annulation par flag atomique.
// Souveraineté : binaires locaux résolus via downloader::{ytdlp,spotdl}_executable.
use crate::downloader::{spotdl_executable, ytdlp_executable};
use serde::Serialize;
use std::collections::HashMap;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};

pub struct DownloadManager {
    jobs: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl DownloadManager {
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

#[derive(Serialize, Clone)]
pub struct DownloadProgress {
    pub job_id: String,
    pub percent: f32,
    pub status: String,
    pub speed: String,
    pub eta: String,
    pub title: String,
    pub error: String,
}

#[allow(clippy::too_many_arguments)]
fn emit_dl(app: &AppHandle, job_id: &str, percent: f32, status: &str,
           speed: &str, eta: &str, error: &str) {
    let _ = app.emit("download-progress", DownloadProgress {
        job_id: job_id.to_string(),
        percent,
        status: status.to_string(),
        speed: speed.to_string(),
        eta: eta.to_string(),
        title: String::new(),
        error: error.to_string(),
    });
}

/// Parse une ligne de progression yt-dlp `--newline` :
/// `[download]  42.3% of  16.78MiB at  1.20MiB/s ETA 00:09`.
/// Retourne (percent, speed, eta) ; pièces manquantes → "". None si non-progression.
pub fn parse_progress_line(line: &str) -> Option<(f32, String, String)> {
    if !line.contains("[download]") {
        return None;
    }
    let tokens: Vec<&str> = line.split_whitespace().collect();
    let percent = tokens.iter().find_map(|t| {
        t.strip_suffix('%').and_then(|h| h.trim().parse::<f32>().ok())
    })?;
    let speed = find_after(&tokens, "at").filter(|s| s.ends_with("/s")).unwrap_or_default();
    let eta = find_after(&tokens, "ETA").unwrap_or_default();
    Some((percent, speed, eta))
}

fn find_after(tokens: &[&str], marker: &str) -> Option<String> {
    tokens.iter().position(|t| *t == marker)
        .and_then(|i| tokens.get(i + 1))
        .map(|s| s.to_string())
}

fn output_template(dest_dir: &str) -> String {
    format!("{dest_dir}/%(title)s.%(ext)s")
}

/// Résout le chemin de bun pour passer --js-runtimes à yt-dlp.
/// Sans JS runtime, yt-dlp utilise android_vr qui exige LOGIN_REQUIRED sur YouTube Music.
fn find_bun() -> Option<String> {
    if let Ok(home) = std::env::var("HOME") {
        let local = format!("{home}/.bun/bin/bun");
        if std::path::Path::new(&local).is_file() {
            return Some(local);
        }
    }
    let Ok(out) = std::process::Command::new("which").arg("bun").output() else { return None; };
    if out.status.success() {
        let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
        if !s.is_empty() { return Some(s); }
    }
    None
}

// ── Cookies YouTube via le navigateur intégré Vela ──────────────────────────────────────────────
// Le WebKit de Vela stocke ses cookies à ce chemin en format Netscape (lisible par yt-dlp).
// L'utilisateur se connecte à YouTube dans le navigateur Vela → cookies injectés automatiquement.

const VELA_WEBKIT_COOKIES: &str = ".local/share/com.echo.vela/cookies";

fn vela_cookie_file() -> Option<String> {
    let home = std::env::var("HOME").ok()?;
    let path = format!("{home}/{VELA_WEBKIT_COOKIES}");
    std::path::Path::new(&path).exists().then_some(path)
}

/// True si des cookies youtube.com sont présents dans le store WebKit de Vela.
/// False → l'utilisateur doit ouvrir YouTube dans le navigateur Vela et s'y connecter.
#[tauri::command]
pub fn youtube_auth_status() -> bool {
    vela_cookie_file()
        .and_then(|p| std::fs::read_to_string(p).ok())
        .map(|c| c.contains(".youtube.com"))
        .unwrap_or(false)
}

/// Fallback Chrome : extrait les cookies si le store Vela n'est pas disponible.
fn extract_chrome_cookies(ytdlp: &str) -> Option<String> {
    let home = std::env::var("HOME").ok()?;
    let dir = std::path::Path::new(&home).join(".local/share/vela");
    std::fs::create_dir_all(&dir).ok()?;
    let dest = dir.join("yt-cookies.txt").to_string_lossy().into_owned();
    for browser in ["chrome", "chromium"] {
        let ok = std::process::Command::new(ytdlp)
            .args(["--cookies-from-browser", browser, "--cookies", &dest,
                   "--skip-download", "https://www.youtube.com/"])
            .stderr(Stdio::null()).stdout(Stdio::null())
            .status().map(|s| s.success()).unwrap_or(false)
            && std::fs::metadata(&dest).map(|m| m.len() > 100).unwrap_or(false);
        if ok { return Some(dest); }
    }
    None
}

/// Injecte le fichier cookies dans les args (WebKit Vela en priorité, Chrome en fallback).
fn inject_yt_cookies(spec: &mut JobSpec) {
    let cookie_file = vela_cookie_file()
        .or_else(|| ytdlp_executable().and_then(|y| extract_chrome_cookies(&y)));
    let Some(path) = cookie_file else { return; };
    let flag = if spec.args.first().map(|a| a == "download").unwrap_or(false) {
        "--cookie-file"
    } else {
        "--cookies"
    };
    spec.args.push(flag.into());
    spec.args.push(path);
}

fn build_ytdlp_args(format_id: &Option<String>, dest_dir: &str, audio_only: bool,
                    audio_format: &Option<String>, sub_langs: &Option<Vec<String>>,
                    url: &str) -> Vec<String> {
    let mut args: Vec<String> = vec![
        "--newline".into(), "--no-warnings".into(),
        "-o".into(), output_template(dest_dir),
    ];
    // JS runtime bun : active le web player. Par défaut yt-dlp utilise android_vr/web_safari
    // (pas de POT), le web player est le seul qui utilise le PO Token bgutil.
    if let Some(bun) = find_bun() {
        args.push("--js-runtimes".into());
        args.push(format!("bun:{bun}"));
    }
    // Forcer le web player en premier pour activer le circuit POT bgutil.
    // Sans ça, android_vr tombe sur LOGIN_REQUIRED sans que le POT soit jamais tenté.
    args.push("--extractor-args".into());
    args.push("youtube:player_client=web,default".into());
    if let Some(fmt) = format_id {
        if !audio_only {
            args.push("-f".into());
            args.push(fmt.clone());
        }
    }
    if audio_only {
        args.push("-x".into());
        if let Some(af) = audio_format {
            args.push("--audio-format".into());
            args.push(af.clone());
        }
    }
    push_sub_args(&mut args, sub_langs, audio_only);
    args.push(url.into());
    args
}

fn push_sub_args(args: &mut Vec<String>, sub_langs: &Option<Vec<String>>, audio_only: bool) {
    if let Some(langs) = sub_langs {
        if !langs.is_empty() {
            args.push("--write-subs".into());
            args.push("--sub-langs".into());
            args.push(langs.join(","));
            if !audio_only {
                args.push("--embed-subs".into());
            }
        }
    }
}

fn build_spotdl_args(url: &str, dest_dir: &str, audio_format: &Option<String>) -> Vec<String> {
    let mut args: Vec<String> = vec![
        "download".into(), url.into(),
        "--output".into(), format!("{dest_dir}/{{artists}} - {{title}}.{{output-ext}}"),
        // Regular YouTube en premier : pas de LOGIN_REQUIRED, évite l'anti-bot YouTube Music.
        // youtube-music reste en fallback pour la qualité/métadonnées.
        "--audio".into(), "youtube".into(), "youtube-music".into(),
    ];
    if let Some(af) = audio_format {
        args.push("--format".into());
        args.push(af.clone());
    }
    // Passe au yt-dlp sous-jacent : web player (activer POT bgutil) + bun JS runtime.
    // --extractor-args forcé car spotdl initialise YoutubeDL sans passer les args de config yt-dlp.
    let bun_arg = find_bun().map(|b| format!(" --js-runtimes bun:{b}")).unwrap_or_default();
    args.push("--yt-dlp-args".into());
    args.push(format!("--extractor-args youtube:player_client=web,default{bun_arg}"));
    args
}

fn spawn_job(bin: &str, args: &[String]) -> Result<Child, String> {
    Command::new(bin)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            eprintln!("[downloader] job spawn failed: {e}");
            format!("lancement échoué: {e}")
        })
}

/// Draine stderr dans un thread, conserve les dernières lignes non vides (diagnostic d'échec).
/// Retourne le buffer partagé et le handle du thread (à joindre avant de lire pour éviter une race).
fn capture_stderr(child: &mut Child) -> (Arc<Mutex<Vec<String>>>, Option<std::thread::JoinHandle<()>>) {
    let buf = Arc::new(Mutex::new(Vec::<String>::new()));
    let handle = child.stderr.take().map(|stderr| {
        let buf = buf.clone();
        std::thread::spawn(move || {
            use std::io::BufRead;
            for line in std::io::BufReader::new(stderr).lines().map_while(Result::ok) {
                let t = line.trim().to_string();
                if t.is_empty() { continue; }
                let mut g = buf.lock().unwrap();
                g.push(t);
                if g.len() > 20 { g.remove(0); }
            }
        })
    });
    (buf, handle)
}

/// Message d'erreur lisible : dernière ligne `ERROR` de yt-dlp/spotdl, sinon dernière ligne.
fn last_error(buf: &Arc<Mutex<Vec<String>>>) -> String {
    let g = buf.lock().unwrap();
    g.iter().rev().find(|l| l.contains("ERROR") || l.contains("error"))
        .or_else(|| g.last())
        .cloned()
        .unwrap_or_else(|| "échec sans message (voir logs)".into())
}

// Marqueurs d'échec présents même quand le process sort avec le code 0 (spotdl ment sur son exit code).
const ERR_MARKERS: &[&str] = &[
    "AudioProviderError", "YT-DLP download error", "ERROR:", "LookupError",
    "No results found", "could not be found", "Unable to download", "Sign in to confirm",
];

/// Détecte un échec malgré exit 0 en scannant stdout + stderr. Retourne le message si trouvé.
fn detect_failure(out: &Arc<Mutex<Vec<String>>>, err: &Arc<Mutex<Vec<String>>>) -> Option<String> {
    for buf in [out, err] {
        let g = buf.lock().unwrap();
        if let Some(l) = g.iter().rev().find(|l| ERR_MARKERS.iter().any(|m| l.contains(m))) {
            return Some(l.clone());
        }
    }
    None
}

/// Lit le stdout ligne par ligne : émet la progression yt-dlp, conserve les lignes non-progression
/// (diagnostic), gère l'annulation. Retourne true si annulé (child tué).
fn pump_download(app: &AppHandle, child: &mut Child, job_id: &str,
                 cancelled: &Arc<AtomicBool>, out_buf: &Arc<Mutex<Vec<String>>>) -> bool {
    use std::io::BufRead;
    let Some(stdout) = child.stdout.take() else { return false; };
    for line in std::io::BufReader::new(stdout).lines().map_while(Result::ok) {
        if cancelled.load(Ordering::Relaxed) {
            let _ = child.kill();
            return true;
        }
        if let Some((pct, speed, eta)) = parse_progress_line(&line) {
            emit_dl(app, job_id, pct, "running", &speed, &eta, "");
        } else {
            let t = line.trim();
            if !t.is_empty() {
                let mut g = out_buf.lock().unwrap();
                g.push(t.to_string());
                if g.len() > 30 { g.remove(0); }
            }
        }
    }
    cancelled.load(Ordering::Relaxed)
}

struct JobSpec {
    bin: String,
    args: Vec<String>,
}

// Journalise une session de téléchargement dans ~/.local/share/vela/logs/downloads.log (diagnostic).
fn log_download(spec: &JobSpec, outcome: &str, out: &Arc<Mutex<Vec<String>>>, err: &Arc<Mutex<Vec<String>>>) {
    use std::io::Write;
    let Ok(home) = std::env::var("HOME") else { return; };
    let dir = std::path::Path::new(&home).join(".local/share/vela/logs");
    if std::fs::create_dir_all(&dir).is_err() { return; }
    let mut body = format!("\n=== {outcome} — {} {}\n", spec.bin, spec.args.join(" "));
    for (tag, buf) in [("OUT", out), ("ERR", err)] {
        if let Ok(g) = buf.lock() {
            for l in g.iter() { body.push_str(&format!("[{tag}] {l}\n")); }
        }
    }
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(dir.join("downloads.log")) {
        let _ = f.write_all(body.as_bytes());
    }
}

fn run_download_job(app: AppHandle, cancelled: Arc<AtomicBool>, job_id: String, mut spec: JobSpec) {
    emit_dl(&app, &job_id, 0.0, "running", "", "", "");
    inject_yt_cookies(&mut spec);
    let mut child = match spawn_job(&spec.bin, &spec.args) {
        Ok(c) => c,
        Err(e) => { eprintln!("[downloader] job {job_id} err: {e}"); emit_dl(&app, &job_id, 0.0, "error", "", "", &e); return; }
    };
    let out_buf = Arc::new(Mutex::new(Vec::<String>::new()));
    let (stderr, stderr_handle) = capture_stderr(&mut child);
    if pump_download(&app, &mut child, &job_id, &cancelled, &out_buf) {
        emit_dl(&app, &job_id, 0.0, "cancelled", "", "", "");
        return;
    }
    let result = child.wait();
    if let Some(h) = stderr_handle { let _ = h.join(); }
    // spotdl sort en 0 même en échec : on vérifie aussi les marqueurs d'erreur dans la sortie.
    let failure = detect_failure(&out_buf, &stderr);
    match result {
        Ok(s) if s.success() && failure.is_none() => {
            log_download(&spec, "OK", &out_buf, &stderr);
            emit_dl(&app, &job_id, 100.0, "done", "", "", "");
        }
        Ok(s) => {
            let msg = failure.unwrap_or_else(|| last_error(&stderr));
            eprintln!("[downloader] job {job_id} exit {s} — {msg}");
            log_download(&spec, &format!("ÉCHEC (exit {s})"), &out_buf, &stderr);
            emit_dl(&app, &job_id, 0.0, "error", "", "", &msg);
        }
        Err(e) => {
            eprintln!("[downloader] job {job_id} wait err: {e}");
            log_download(&spec, "ÉCHEC (wait)", &out_buf, &stderr);
            emit_dl(&app, &job_id, 0.0, "error", "", "", &e.to_string());
        }
    }
}

#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub fn download_start(
    app: AppHandle,
    state: State<DownloadManager>,
    job_id: String,
    url: String,
    format_id: Option<String>,
    dest_dir: String,
    audio_only: bool,
    audio_format: Option<String>,
    sub_langs: Option<Vec<String>>,
    is_spotify: bool,
) -> Result<(), String> {
    let spec = if is_spotify {
        let bin = spotdl_executable().ok_or_else(|| "spotdl requis".to_string())?;
        JobSpec { bin, args: build_spotdl_args(&url, &dest_dir, &audio_format) }
    } else {
        let bin = ytdlp_executable().ok_or_else(|| "yt-dlp requis".to_string())?;
        let args = build_ytdlp_args(&format_id, &dest_dir, audio_only, &audio_format, &sub_langs, &url);
        JobSpec { bin, args }
    };
    let cancelled = state.register(&job_id);
    std::thread::spawn(move || run_download_job(app, cancelled, job_id, spec));
    Ok(())
}

#[tauri::command]
pub fn download_cancel(state: State<DownloadManager>, job_id: String) {
    state.cancel(&job_id);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_progress_standard() {
        let line = "[download]  42.3% of 16.78MiB at 1.20MiB/s ETA 00:09";
        let (pct, speed, eta) = parse_progress_line(line).expect("parse ok");
        assert!((pct - 42.3).abs() < 0.01);
        assert_eq!(speed, "1.20MiB/s");
        assert_eq!(eta, "00:09");
    }

    #[test]
    fn parse_progress_no_speed_eta() {
        let (pct, speed, eta) = parse_progress_line("[download] 100% of 16.78MiB").expect("parse ok");
        assert_eq!(pct, 100.0);
        assert_eq!(speed, "");
        assert_eq!(eta, "");
    }

    #[test]
    fn parse_progress_non_progress() {
        assert_eq!(parse_progress_line("[info] something"), None);
    }

    #[test]
    fn build_args_audio_only() {
        let args = build_ytdlp_args(&None, "/tmp", true, &Some("mp3".into()), &None, "URL");
        assert!(args.contains(&"-x".to_string()));
        assert!(args.contains(&"mp3".to_string()));
    }

    #[test]
    fn build_args_format_id() {
        let args = build_ytdlp_args(&Some("137".into()), "/tmp", false, &None, &None, "URL");
        assert!(args.contains(&"137".to_string()));
        assert_eq!(args.last().unwrap(), "URL");
    }

    #[test]
    fn build_args_sub_langs() {
        let langs = Some(vec!["en".to_string(), "fr".to_string()]);
        let args = build_ytdlp_args(&None, "/tmp", false, &None, &langs, "URL");
        assert!(args.contains(&"--sub-langs".to_string()));
        assert!(args.contains(&"en,fr".to_string()));
        assert!(args.contains(&"--embed-subs".to_string()));
    }

    #[test]
    fn build_spotdl_format() {
        let args = build_spotdl_args("URL", "/tmp", &Some("flac".into()));
        assert_eq!(args[0], "download");
        assert!(args.contains(&"--format".to_string()));
        assert!(args.contains(&"flac".to_string()));
    }
}
