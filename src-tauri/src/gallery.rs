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
