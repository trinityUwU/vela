// Détection des outils média (ffmpeg/ffprobe/demucs) et sondage des fichiers via ffprobe JSON.
use serde::Serialize;
use serde_json::Value;
use std::path::PathBuf;
use std::process::Command;

// ── types publics ───────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct MediaCapabilities {
    pub ffmpeg: bool,
    pub ffprobe: bool,
    pub demucs: bool,
    pub demucs_path: Option<String>,
}

#[derive(Serialize)]
pub struct MediaProbe {
    pub duration: f64,
    pub width: i32,
    pub height: i32,
    pub has_video: bool,
    pub has_audio: bool,
    pub format_name: String,
    pub video_codec: Option<String>,
    pub audio_codec: Option<String>,
}

// ── détection des binaires ──────────────────────────────────────────────────

fn binary_exists(name: &str) -> bool {
    match Command::new(name).arg("-version").output() {
        Ok(out) => out.status.success(),
        Err(e) => {
            eprintln!("[media] binary_exists({name}) failed: {e}");
            false
        }
    }
}

fn vela_demucs_venv_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_default();
    PathBuf::from(home).join(".local/share/vela/demucs-venv/bin/demucs")
}

fn demucs_in_path() -> bool {
    match Command::new("demucs").arg("--help").output() {
        Ok(out) => out.status.success(),
        Err(e) => {
            eprintln!("[media] demucs --help failed: {e}");
            false
        }
    }
}

/// Résout l'exécutable demucs : venv Vela d'abord, sinon PATH. Réutilisable par le module stems.
pub fn demucs_executable() -> Option<String> {
    let venv = vela_demucs_venv_path();
    if venv.is_file() {
        return Some(venv.to_string_lossy().into_owned());
    }
    if demucs_in_path() {
        return Some("demucs".to_string());
    }
    None
}

#[tauri::command]
pub fn media_capabilities() -> MediaCapabilities {
    let demucs_path = demucs_executable();
    MediaCapabilities {
        ffmpeg: binary_exists("ffmpeg"),
        ffprobe: binary_exists("ffprobe"),
        demucs: demucs_path.is_some(),
        demucs_path,
    }
}

// ── sondage ffprobe ─────────────────────────────────────────────────────────

fn run_ffprobe(path: &str) -> Result<Value, String> {
    let output = Command::new("ffprobe")
        .args(["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", path])
        .output()
        .map_err(|e| {
            eprintln!("[media] ffprobe spawn failed for {path}: {e}");
            format!("ffprobe spawn failed: {e}")
        })?;
    if !output.status.success() {
        eprintln!("[media] ffprobe non-zero exit for {path}");
        return Err(format!("ffprobe exited with status {}", output.status));
    }
    serde_json::from_slice(&output.stdout).map_err(|e| {
        eprintln!("[media] ffprobe JSON parse failed for {path}: {e}");
        format!("ffprobe JSON parse failed: {e}")
    })
}

fn parse_duration(json: &Value) -> f64 {
    json.get("format")
        .and_then(|f| f.get("duration"))
        .and_then(|d| d.as_str())
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(0.0)
}

fn format_name(json: &Value) -> String {
    json.get("format")
        .and_then(|f| f.get("format_name"))
        .and_then(|n| n.as_str())
        .unwrap_or("")
        .to_string()
}

fn apply_video_stream(stream: &Value, probe: &mut MediaProbe) {
    probe.has_video = true;
    probe.width = stream.get("width").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
    probe.height = stream.get("height").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
    probe.video_codec = stream
        .get("codec_name")
        .and_then(|c| c.as_str())
        .map(|s| s.to_string());
}

fn apply_audio_stream(stream: &Value, probe: &mut MediaProbe) {
    probe.has_audio = true;
    probe.audio_codec = stream
        .get("codec_name")
        .and_then(|c| c.as_str())
        .map(|s| s.to_string());
}

fn parse_probe(json: &Value) -> MediaProbe {
    let mut probe = MediaProbe {
        duration: parse_duration(json),
        width: 0,
        height: 0,
        has_video: false,
        has_audio: false,
        format_name: format_name(json),
        video_codec: None,
        audio_codec: None,
    };
    if let Some(streams) = json.get("streams").and_then(|s| s.as_array()) {
        for stream in streams {
            match stream.get("codec_type").and_then(|t| t.as_str()) {
                Some("video") if !probe.has_video => apply_video_stream(stream, &mut probe),
                Some("audio") if !probe.has_audio => apply_audio_stream(stream, &mut probe),
                _ => {}
            }
        }
    }
    probe
}

#[tauri::command]
pub fn media_probe(path: String) -> Result<MediaProbe, String> {
    let json = run_ffprobe(&path)?;
    Ok(parse_probe(&json))
}

// ── tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;

    fn unique_tmp_dir() -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let dir = std::env::temp_dir().join(format!("vela_media_test_{nanos}"));
        fs::create_dir_all(&dir).expect("create tmp dir");
        dir
    }

    #[test]
    fn probe_generated_tone_wav() {
        if !binary_exists("ffmpeg") || !binary_exists("ffprobe") {
            eprintln!("[media] ffmpeg/ffprobe missing — skipping probe test");
            return;
        }
        let dir = unique_tmp_dir();
        let wav = dir.join("tone.wav");
        let gen = Command::new("ffmpeg")
            .args(["-f", "lavfi", "-i", "sine=frequency=440:duration=2", "-y"])
            .arg(&wav)
            .output()
            .expect("spawn ffmpeg");
        assert!(gen.status.success(), "ffmpeg failed to generate fixture");

        let probe = media_probe(wav.to_string_lossy().into_owned()).expect("probe ok");
        assert!(
            (probe.duration - 2.0).abs() < 0.3,
            "duration {} not ~2.0",
            probe.duration
        );
        assert!(probe.has_audio, "expected has_audio");
        assert!(!probe.has_video, "expected no video");
        assert!(probe.audio_codec.is_some(), "expected an audio codec");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn capabilities_report() {
        let caps = media_capabilities();
        assert!(caps.ffmpeg, "ffmpeg should be installed");
        assert!(caps.ffprobe, "ffprobe should be installed");
        // Invariant indépendant de l'environnement : demucs reflète la présence du chemin.
        assert_eq!(caps.demucs, caps.demucs_path.is_some());
    }
}
