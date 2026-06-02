// Opérations audio non-destructives via ffmpeg (CLI externe) : trim, fade, normalize,
// convert, remove-vocals. Chaque commande Tauri est async et délègue le travail bloquant
// à spawn_blocking pour ne jamais geler l'UI. Souveraineté : aucune dépendance crate audio.
use std::process::Command;

/// Exécute ffmpeg avec `-y` + args fournis. Err (avec tail stderr + eprintln) si échec.
fn run_ffmpeg(args: &[String]) -> Result<(), String> {
    let mut full: Vec<String> = vec!["-y".into()];
    full.extend_from_slice(args);
    let output = match Command::new("ffmpeg").args(&full).output() {
        Ok(o) => o,
        Err(e) => {
            eprintln!("[audio] ffmpeg spawn failed: {e}");
            return Err(format!("ffmpeg introuvable: {e}"));
        }
    };
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let tail: String = stderr.lines().rev().take(5).collect::<Vec<_>>().into_iter().rev().collect::<Vec<_>>().join("\n");
        eprintln!("[audio] ffmpeg failed ({}): {tail}", output.status);
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
            eprintln!("[audio] ffprobe spawn failed: {e}");
            return Err(format!("ffprobe introuvable: {e}"));
        }
    };
    if !output.status.success() {
        eprintln!("[audio] ffprobe failed: {}", output.status);
        return Err("ffprobe a échoué".into());
    }
    let raw = String::from_utf8_lossy(&output.stdout);
    raw.trim().parse::<f64>().map_err(|e| {
        eprintln!("[audio] probe_duration parse error: {e}");
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

fn build_fade_filter(fade_in: f64, fade_out: f64, dur: f64) -> String {
    let mut clauses: Vec<String> = Vec::new();
    if fade_in > 0.0 {
        clauses.push(format!("afade=t=in:st=0:d={fade_in}"));
    }
    if fade_out > 0.0 {
        let st = (dur - fade_out).max(0.0);
        clauses.push(format!("afade=t=out:st={st}:d={fade_out}"));
    }
    clauses.join(",")
}

fn do_fade(input: &str, output: &str, fade_in: f64, fade_out: f64) -> Result<(), String> {
    let dur = probe_duration(input)?;
    let filter = build_fade_filter(fade_in, fade_out, dur);
    if filter.is_empty() {
        return do_convert(input, output, None);
    }
    let args = vec!["-i".into(), input.into(), "-af".into(), filter, output.into()];
    run_ffmpeg(&args)
}

fn do_normalize(input: &str, output: &str) -> Result<(), String> {
    let args = vec![
        "-i".into(), input.into(),
        "-af".into(), "loudnorm=I=-16:TP=-1.5:LRA=11".into(), output.into(),
    ];
    run_ffmpeg(&args)
}

fn do_convert(input: &str, output: &str, bitrate: Option<String>) -> Result<(), String> {
    let mut args = vec!["-i".into(), input.into()];
    if let Some(b) = bitrate {
        args.push("-b:a".into());
        args.push(b);
    }
    args.push(output.into());
    run_ffmpeg(&args)
}

// Annule les voix centrées (center-channel cancellation) en soustrayant les canaux L/R.
// Option légère et souveraine, quasi-instantanée — demucs reste l'option pro (module séparé).
fn do_remove_vocals(input: &str, output: &str) -> Result<(), String> {
    let args = vec![
        "-i".into(), input.into(),
        "-af".into(), "pan=stereo|c0=c0-c1|c1=c1-c0".into(), output.into(),
    ];
    run_ffmpeg(&args)
}

#[tauri::command]
pub async fn audio_trim(input: String, output: String, start: f64, end: f64) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || do_trim(&input, &output, start, end))
        .await
        .map_err(|e| format!("tâche audio_trim échouée: {e}"))?
}

#[tauri::command]
pub async fn audio_fade(input: String, output: String, fade_in: f64, fade_out: f64) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || do_fade(&input, &output, fade_in, fade_out))
        .await
        .map_err(|e| format!("tâche audio_fade échouée: {e}"))?
}

#[tauri::command]
pub async fn audio_normalize(input: String, output: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || do_normalize(&input, &output))
        .await
        .map_err(|e| format!("tâche audio_normalize échouée: {e}"))?
}

#[tauri::command]
pub async fn audio_convert(input: String, output: String, bitrate: Option<String>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || do_convert(&input, &output, bitrate))
        .await
        .map_err(|e| format!("tâche audio_convert échouée: {e}"))?
}

#[tauri::command]
pub async fn audio_remove_vocals(input: String, output: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || do_remove_vocals(&input, &output))
        .await
        .map_err(|e| format!("tâche audio_remove_vocals échouée: {e}"))?
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
        let dir = std::env::temp_dir().join(format!("vela_audio_test_{nanos}"));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn make_fixture(dir: &PathBuf) -> String {
        let input = dir.join("in.wav");
        let path = input.to_str().unwrap().to_string();
        let args = vec![
            "-f".into(), "lavfi".into(),
            "-i".into(), "sine=frequency=440:duration=3".into(),
            "-ac".into(), "2".into(), path.clone(),
        ];
        run_ffmpeg(&args).unwrap();
        path
    }

    fn non_empty(path: &str) -> bool {
        std::fs::metadata(path).map(|m| m.len() > 0).unwrap_or(false)
    }

    #[test]
    fn test_trim() {
        if !ffmpeg_present() {
            return;
        }
        let dir = tmp_dir();
        let input = make_fixture(&dir);
        let out = dir.join("out.wav").to_str().unwrap().to_string();
        do_trim(&input, &out, 0.5, 2.0).unwrap();
        assert!(non_empty(&out));
        let dur = probe_duration(&out).unwrap();
        assert!((dur - 1.5).abs() < 0.3, "durée {dur} hors tolérance");
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn test_convert_flac() {
        if !ffmpeg_present() {
            return;
        }
        let dir = tmp_dir();
        let input = make_fixture(&dir);
        let out = dir.join("out.flac").to_str().unwrap().to_string();
        do_convert(&input, &out, None).unwrap();
        assert!(non_empty(&out));
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn test_remove_vocals() {
        if !ffmpeg_present() {
            return;
        }
        let dir = tmp_dir();
        let input = make_fixture(&dir);
        let out = dir.join("out.wav").to_str().unwrap().to_string();
        do_remove_vocals(&input, &out).unwrap();
        assert!(non_empty(&out));
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn test_normalize() {
        if !ffmpeg_present() {
            return;
        }
        let dir = tmp_dir();
        let input = make_fixture(&dir);
        let out = dir.join("out.wav").to_str().unwrap().to_string();
        do_normalize(&input, &out).unwrap();
        assert!(non_empty(&out));
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn test_fade() {
        if !ffmpeg_present() {
            return;
        }
        let dir = tmp_dir();
        let input = make_fixture(&dir);
        let out = dir.join("out.wav").to_str().unwrap().to_string();
        do_fade(&input, &out, 0.5, 0.5).unwrap();
        assert!(non_empty(&out));
        std::fs::remove_dir_all(&dir).ok();
    }
}
