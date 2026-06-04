// Galerie / lightbox (F14) : métadonnées EXIF (kamadak-exif) + extraction de palette (color-thief).
// 100 % crates pures Rust. Le rendu/zoom/pipette est côté front.
use color_thief::ColorFormat;
use serde::Serialize;
use std::fs;
use std::io::BufReader;

#[derive(Serialize)]
pub struct ExifField {
    pub label: String,
    pub value: String,
}

#[tauri::command]
pub fn image_exif(path: String) -> Result<Vec<ExifField>, String> {
    let file = fs::File::open(&path).map_err(|e| e.to_string())?;
    let mut reader = BufReader::new(file);
    let exif = exif::Reader::new()
        .read_from_container(&mut reader)
        .map_err(|e| format!("pas d'EXIF : {e}"))?;
    let mut out = Vec::new();
    for f in exif.fields() {
        let value = f.display_value().with_unit(&exif).to_string();
        if value.is_empty() || value.len() > 120 {
            continue;
        }
        out.push(ExifField { label: format!("{}", f.tag), value });
    }
    Ok(out)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaInfo {
    pub width: u32,
    pub height: u32,
    pub duration_secs: Option<f64>,
}

const VIDEO_EXTS: &[&str] = &[
    "mp4", "mkv", "webm", "mov", "avi", "m4v", "flv", "wmv", "mpg", "mpeg", "ts",
];

// Dimensions réelles d'un média (props fichier). Image : header seul via crate `image` (rapide,
// souverain). Vidéo : ffprobe (externe, optionnel — dégrade proprement si absent).
#[tauri::command]
pub fn media_dimensions(path: String) -> Result<MediaInfo, String> {
    let ext = std::path::Path::new(&path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    if VIDEO_EXTS.contains(&ext.as_str()) {
        return probe_video_dims(&path);
    }
    let (w, h) = image::image_dimensions(&path).map_err(|e| {
        eprintln!("[media_dimensions] {path}: {e}");
        format!("dimensions illisibles : {e}")
    })?;
    Ok(MediaInfo { width: w, height: h, duration_secs: None })
}

fn probe_video_dims(path: &str) -> Result<MediaInfo, String> {
    use std::process::Command;
    let dims = Command::new("ffprobe")
        .args(["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=s=x:p=0"])
        .arg(path)
        .output()
        .map_err(|e| format!("ffprobe introuvable : {e}"))?;
    if !dims.status.success() {
        return Err("ffprobe a échoué".into());
    }
    let txt = String::from_utf8_lossy(&dims.stdout);
    let line = txt.lines().next().unwrap_or("").trim();
    let (w, h) = line.split_once('x').ok_or("dimensions vidéo illisibles")?;
    let width: u32 = w.trim().parse().map_err(|_| "largeur illisible")?;
    let height: u32 = h.trim().parse().map_err(|_| "hauteur illisible")?;
    let dur = Command::new("ffprobe")
        .args(["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0"])
        .arg(path)
        .output()
        .ok()
        .filter(|o| o.status.success())
        .and_then(|o| String::from_utf8_lossy(&o.stdout).trim().parse::<f64>().ok());
    Ok(MediaInfo { width, height, duration_secs: dur })
}

#[tauri::command]
pub fn image_palette(path: String, count: u8) -> Result<Vec<String>, String> {
    let img = image::open(&path).map_err(|e| format!("image illisible : {e}"))?;
    let rgb = img.to_rgb8();
    let pixels = rgb.as_raw();
    let n = count.clamp(2, 12);
    let palette = color_thief::get_palette(pixels, ColorFormat::Rgb, 10, n)
        .map_err(|_| "extraction impossible".to_string())?;
    Ok(palette.iter().map(|c| format!("#{:02x}{:02x}{:02x}", c.r, c.g, c.b)).collect())
}
