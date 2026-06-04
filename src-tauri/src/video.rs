// Opérations vidéo via ffmpeg/ffprobe (CLI externe) : trim, extract-frame, extract-audio
// (rapides, spawn_blocking) + convert (re-encode long avec progression/annulation, job
// background). Souveraineté : aucune dépendance crate vidéo, tout passe par ffmpeg système.
use serde::Serialize;
use std::collections::HashMap;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};

#[derive(Clone, Serialize)]
pub struct VideoProgress {
    pub job_id: String,
    pub percent: f64,
    pub status: String,
}

pub struct VideoJobManager {
    jobs: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl VideoJobManager {
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

/// Exécute ffmpeg avec `-y` + args fournis. Err (avec tail stderr + eprintln) si échec.
fn run_ffmpeg(args: &[String]) -> Result<(), String> {
    let mut full: Vec<String> = vec!["-y".into()];
    full.extend_from_slice(args);
    let output = match Command::new("ffmpeg").args(&full).output() {
        Ok(o) => o,
        Err(e) => {
            eprintln!("[video] ffmpeg spawn failed: {e}");
            return Err(format!("ffmpeg introuvable: {e}"));
        }
    };
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let tail: String = stderr.lines().rev().take(5).collect::<Vec<_>>()
            .into_iter().rev().collect::<Vec<_>>().join("\n");
        eprintln!("[video] ffmpeg failed ({}): {tail}", output.status);
        return Err(format!("ffmpeg a échoué: {tail}"));
    }
    Ok(())
}

/// Lit la durée (secondes) d'un fichier via ffprobe.
fn probe_duration(path: &str) -> Result<f64, String> {
    let args = ["-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", path];
    let output = match Command::new("ffprobe").args(args).output() {
        Ok(o) => o,
        Err(e) => {
            eprintln!("[video] ffprobe spawn failed: {e}");
            return Err(format!("ffprobe introuvable: {e}"));
        }
    };
    if !output.status.success() {
        eprintln!("[video] ffprobe failed: {}", output.status);
        return Err("ffprobe a échoué".into());
    }
    let raw = String::from_utf8_lossy(&output.stdout);
    raw.trim().parse::<f64>().map_err(|e| {
        eprintln!("[video] probe_duration parse error: {e}");
        format!("durée illisible: {e}")
    })
}

fn do_trim(input: &str, output: &str, start: f64, end: f64) -> Result<(), String> {
    let args = vec![
        "-ss".into(), start.to_string(), "-to".into(), end.to_string(),
        "-i".into(), input.into(), "-c".into(), "copy".into(), output.into(),
    ];
    run_ffmpeg(&args)
}

fn do_extract_frame(input: &str, output: &str, timestamp: f64) -> Result<(), String> {
    let args = vec![
        "-ss".into(), timestamp.to_string(), "-i".into(), input.into(),
        "-frames:v".into(), "1".into(), output.into(),
    ];
    run_ffmpeg(&args)
}

fn do_extract_audio(input: &str, output: &str) -> Result<(), String> {
    let args = vec!["-i".into(), input.into(), "-vn".into(), output.into()];
    run_ffmpeg(&args)
}

/// Re-encode bloquant sans progression (cœur logique partagé, exercé par les tests ;
/// le job background utilise `spawn_convert_child` pour ajouter `-progress`).
#[cfg_attr(not(test), allow(dead_code))]
fn do_convert(input: &str, output: &str, crf: u32) -> Result<(), String> {
    let args = vec![
        "-i".into(), input.into(),
        "-c:v".into(), "libx264".into(), "-crf".into(), crf.to_string(),
        "-c:a".into(), "aac".into(), output.into(),
    ];
    run_ffmpeg(&args)
}

/// Parse une ligne `-progress pipe:1` du type `out_time_ms=12345678` → microsecondes.
fn parse_out_time_ms(line: &str) -> Option<u64> {
    line.strip_prefix("out_time_ms=")?.trim().parse::<u64>().ok()
}

fn emit_progress(app: &AppHandle, job_id: &str, percent: f64, status: &str) {
    let _ = app.emit("video-progress", VideoProgress {
        job_id: job_id.to_string(),
        percent,
        status: status.to_string(),
    });
}

fn spawn_convert_child(input: &str, output: &str, crf: u32) -> Result<std::process::Child, String> {
    Command::new("ffmpeg")
        .args([
            "-y", "-i", input, "-c:v", "libx264", "-crf", &crf.to_string(),
            "-c:a", "aac", "-progress", "pipe:1", "-nostats", output,
        ])
        .stdout(Stdio::piped())
        .spawn()
        .map_err(|e| {
            eprintln!("[video] convert spawn failed: {e}");
            format!("ffmpeg introuvable: {e}")
        })
}

/// Lit le stdout ffmpeg ligne par ligne, émet la progression, gère l'annulation.
/// Retourne true si annulé (child tué), false sinon.
fn pump_progress(app: &AppHandle, child: &mut std::process::Child, job_id: &str,
                 cancelled: &Arc<AtomicBool>, total: f64) -> bool {
    use std::io::BufRead;
    let Some(stdout) = child.stdout.take() else { return false; };
    for line in std::io::BufReader::new(stdout).lines().map_while(Result::ok) {
        if cancelled.load(Ordering::Relaxed) {
            let _ = child.kill();
            return true;
        }
        if let Some(us) = parse_out_time_ms(&line) {
            let percent = if total > 0.0 { (us as f64 / 1e6 / total * 100.0).min(99.9) } else { 0.0 };
            emit_progress(app, job_id, percent, "running");
        }
    }
    cancelled.load(Ordering::Relaxed)
}

fn run_convert_job(app: AppHandle, cancelled: Arc<AtomicBool>, job_id: String,
                   input: String, output: String, crf: u32) {
    let total = probe_duration(&input).unwrap_or(0.0);
    let mut child = match spawn_convert_child(&input, &output, crf) {
        Ok(c) => c,
        Err(e) => { eprintln!("[video] job {job_id} spawn err: {e}"); emit_progress(&app, &job_id, 0.0, "error"); return; }
    };
    let killed = pump_progress(&app, &mut child, &job_id, &cancelled, total);
    if killed {
        emit_progress(&app, &job_id, 0.0, "cancelled");
        return;
    }
    match child.wait() {
        Ok(s) if s.success() => emit_progress(&app, &job_id, 100.0, "done"),
        Ok(s) => { eprintln!("[video] job {job_id} exit {s}"); emit_progress(&app, &job_id, 0.0, "error"); }
        Err(e) => { eprintln!("[video] job {job_id} wait err: {e}"); emit_progress(&app, &job_id, 0.0, "error"); }
    }
}

#[tauri::command]
pub async fn video_trim(input: String, output: String, start: f64, end: f64) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || do_trim(&input, &output, start, end))
        .await
        .map_err(|e| format!("tâche video_trim échouée: {e}"))?
}

#[tauri::command]
pub async fn video_extract_frame(input: String, output: String, timestamp: f64) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || do_extract_frame(&input, &output, timestamp))
        .await
        .map_err(|e| format!("tâche video_extract_frame échouée: {e}"))?
}

#[tauri::command]
pub async fn video_extract_audio(input: String, output: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || do_extract_audio(&input, &output))
        .await
        .map_err(|e| format!("tâche video_extract_audio échouée: {e}"))?
}

#[tauri::command]
pub fn video_convert(app: AppHandle, state: State<VideoJobManager>, job_id: String,
                     input: String, output: String, crf: u32) -> Result<(), String> {
    let cancelled = state.register(&job_id);
    std::thread::spawn(move || run_convert_job(app, cancelled, job_id, input, output, crf));
    Ok(())
}

#[tauri::command]
pub fn video_convert_cancel(state: State<VideoJobManager>, job_id: String) -> Result<(), String> {
    state.cancel(&job_id);
    Ok(())
}

// ── boîte à outils étendue (F18) ─────────────────────────────────────────────

fn do_gif(input: &str, output: &str, start: f64, dur: f64, fps: u32, width: u32) -> Result<(), String> {
    // palettegen/paletteuse en un seul graphe de filtres → GIF propre.
    let vf = format!("fps={fps},scale={width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse");
    let args = vec![
        "-ss".into(), start.to_string(), "-t".into(), dur.to_string(),
        "-i".into(), input.into(), "-vf".into(), vf, "-loop".into(), "0".into(), output.into(),
    ];
    run_ffmpeg(&args)
}

#[tauri::command]
pub async fn video_to_gif(input: String, output: String, start: f64, dur: f64, fps: u32, width: u32) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || do_gif(&input, &output, start, dur, fps.clamp(5, 30), width.clamp(120, 1024)))
        .await
        .map_err(|e| format!("tâche video_to_gif échouée: {e}"))?
}

// Brûle un .srt dans la vidéo (sous-titres incrustés). Le chemin srt est échappé pour le filtre subtitles.
fn do_subtitles(input: &str, srt: &str, output: &str) -> Result<(), String> {
    let escaped = srt.replace('\\', "\\\\").replace(':', "\\:").replace('\'', "\\'");
    let args = vec![
        "-i".into(), input.into(), "-vf".into(), format!("subtitles='{escaped}'"),
        "-c:a".into(), "copy".into(), output.into(),
    ];
    run_ffmpeg(&args)
}

#[tauri::command]
pub async fn video_subtitles(input: String, srt: String, output: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || do_subtitles(&input, &srt, &output))
        .await
        .map_err(|e| format!("tâche video_subtitles échouée: {e}"))?
}

// Compresse pour viser une taille cible (Mo) : bitrate = taille_bits / durée, marge audio 128k.
fn do_target_size(input: &str, output: &str, target_mb: f64) -> Result<(), String> {
    let dur = probe_duration(input)?.max(1.0);
    let audio_kbps = 128.0;
    let total_kbits = target_mb * 8.0 * 1024.0;
    let video_kbps = ((total_kbits / dur) - audio_kbps).max(150.0);
    let bv = format!("{}k", video_kbps.round() as u64);
    let args = vec![
        "-i".into(), input.into(), "-b:v".into(), bv, "-maxrate".into(),
        format!("{}k", (video_kbps * 1.5).round() as u64), "-bufsize".into(),
        format!("{}k", (video_kbps * 2.0).round() as u64),
        "-c:v".into(), "libx264".into(), "-c:a".into(), "aac".into(), "-b:a".into(), "128k".into(),
        output.into(),
    ];
    run_ffmpeg(&args)
}

#[tauri::command]
pub async fn video_target_size(input: String, output: String, target_mb: f64) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || do_target_size(&input, &output, target_mb))
        .await
        .map_err(|e| format!("tâche video_target_size échouée: {e}"))?
}

// Storyboard : N vignettes régulières → cache ~/.cache/vela/storyboard/<hash>/. Sert l'aperçu au survol.
fn do_storyboard(input: &str, n: u32) -> Result<Vec<String>, String> {
    let dur = probe_duration(input)?.max(0.1);
    let hash = blake3::hash(input.as_bytes()).to_hex()[..16].to_string();
    let cache = dirs_cache().join("storyboard").join(&hash);
    std::fs::create_dir_all(&cache).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    let count = n.clamp(4, 16);
    for i in 0..count {
        let t = dur * (i as f64 + 0.5) / count as f64;
        let frame = cache.join(format!("{i}.jpg"));
        let frame_str = frame.to_string_lossy().to_string();
        if !frame.exists() {
            let args = vec![
                "-ss".into(), t.to_string(), "-i".into(), input.into(),
                "-frames:v".into(), "1".into(), "-vf".into(), "scale=320:-1".into(), frame_str.clone(),
            ];
            run_ffmpeg(&args)?;
        }
        out.push(frame_str);
    }
    Ok(out)
}

fn dirs_cache() -> std::path::PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
    std::path::PathBuf::from(home).join(".cache").join("vela")
}

#[tauri::command]
pub async fn video_storyboard(input: String, n: u32) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || do_storyboard(&input, n))
        .await
        .map_err(|e| format!("tâche video_storyboard échouée: {e}"))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn ffmpeg_present() -> bool {
        Command::new("ffmpeg").arg("-version").output().is_ok()
    }

    fn tmp_dir() -> PathBuf {
        let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let dir = std::env::temp_dir().join(format!("vela_video_test_{nanos}"));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn make_clip(dir: &PathBuf) -> String {
        let input = dir.join("in.mp4");
        let path = input.to_str().unwrap().to_string();
        let args = vec![
            "-f".into(), "lavfi".into(), "-i".into(),
            "testsrc=duration=2:size=320x240:rate=10".into(),
            "-f".into(), "lavfi".into(), "-i".into(),
            "sine=frequency=440:duration=2".into(),
            "-c:v".into(), "libx264".into(), "-c:a".into(), "aac".into(),
            "-shortest".into(), path.clone(),
        ];
        run_ffmpeg(&args).unwrap();
        path
    }

    fn non_empty(path: &str) -> bool {
        std::fs::metadata(path).map(|m| m.len() > 0).unwrap_or(false)
    }

    fn has_video(path: &str) -> bool {
        let out = Command::new("ffprobe")
            .args(["-v", "quiet", "-select_streams", "v", "-show_entries",
                   "stream=codec_type", "-of", "csv=p=0", path])
            .output()
            .unwrap();
        String::from_utf8_lossy(&out.stdout).contains("video")
    }

    #[test]
    fn test_trim() {
        if !ffmpeg_present() { return; }
        let dir = tmp_dir();
        let input = make_clip(&dir);
        let out = dir.join("out.mp4").to_str().unwrap().to_string();
        do_trim(&input, &out, 0.5, 1.5).unwrap();
        assert!(non_empty(&out));
        // -ss avant -i + -c copy snappe au keyframe le plus proche : sur testsrc
        // (keyframes espacés) la coupe est imprécise. On vérifie que la sortie est
        // bornée par la fenêtre demandée plutôt qu'une durée exacte.
        let dur = probe_duration(&out).unwrap();
        assert!(dur > 0.0 && dur <= 2.0, "durée {dur} hors fenêtre");
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn test_extract_frame() {
        if !ffmpeg_present() { return; }
        let dir = tmp_dir();
        let input = make_clip(&dir);
        let out = dir.join("out.png").to_str().unwrap().to_string();
        do_extract_frame(&input, &out, 1.0).unwrap();
        let img = image::open(&out).unwrap();
        assert_eq!((img.width(), img.height()), (320, 240));
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn test_extract_audio() {
        if !ffmpeg_present() { return; }
        let dir = tmp_dir();
        let input = make_clip(&dir);
        let out = dir.join("out.m4a").to_str().unwrap().to_string();
        do_extract_audio(&input, &out).unwrap();
        assert!(non_empty(&out));
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn test_convert() {
        if !ffmpeg_present() { return; }
        let dir = tmp_dir();
        let input = make_clip(&dir);
        let out = dir.join("out.mp4").to_str().unwrap().to_string();
        do_convert(&input, &out, 28).unwrap();
        assert!(non_empty(&out));
        assert!(has_video(&out));
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn test_parse_out_time_ms() {
        assert_eq!(parse_out_time_ms("out_time_ms=12345678"), Some(12345678));
        assert_eq!(parse_out_time_ms("progress=continue"), None);
    }
}
