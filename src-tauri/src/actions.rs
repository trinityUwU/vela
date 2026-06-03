// Actions intelligentes sur la sélection : fusion CSV, rangement de dossier (par type/date, annulable).
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Serialize)]
pub struct MoveRec {
    pub from: String,
    pub to: String,
}

fn collision_free(dir: &Path, stem: &str, ext: &str) -> PathBuf {
    let mut out = dir.join(format!("{stem}.{ext}"));
    let mut n = 1;
    while out.exists() {
        out = dir.join(format!("{stem} ({n}).{ext}"));
        n += 1;
    }
    out
}

#[tauri::command]
pub fn merge_csv(inputs: Vec<String>) -> Result<String, String> {
    let first = inputs.first().ok_or("aucun fichier")?;
    let mut result = String::new();
    for (i, input) in inputs.iter().enumerate() {
        let content = fs::read_to_string(input).map_err(|e| format!("lecture {input}: {e}"))?;
        let mut lines = content.lines();
        let header = lines.next().unwrap_or("");
        if i == 0 {
            result.push_str(header);
            result.push('\n');
        }
        for line in lines {
            result.push_str(line);
            result.push('\n');
        }
    }
    let dir = Path::new(first).parent().unwrap_or_else(|| Path::new("."));
    let out = collision_free(dir, "fusion", "csv");
    fs::write(&out, result).map_err(|e| format!("écriture: {e}"))?;
    Ok(out.to_string_lossy().into_owned())
}

fn category(ext: &str) -> &'static str {
    const IMG: &[&str] = &["png", "jpg", "jpeg", "webp", "gif", "bmp", "tiff", "tif", "ico", "svg"];
    const DOC: &[&str] = &["pdf", "md", "txt", "doc", "docx", "odt", "rtf", "tex", "epub", "html", "htm"];
    const AUD: &[&str] = &["mp3", "flac", "wav", "ogg", "m4a", "opus", "aac"];
    const VID: &[&str] = &["mp4", "mkv", "webm", "avi", "mov", "wmv", "flv"];
    const ARC: &[&str] = &["zip", "tar", "gz", "bz2", "xz", "7z", "rar", "zst"];
    const COD: &[&str] = &["rs", "ts", "tsx", "js", "jsx", "py", "go", "c", "cpp", "h", "sh", "json", "toml", "yaml", "yml", "css"];
    let e = ext.to_lowercase();
    let e = e.as_str();
    if IMG.contains(&e) { "Images" }
    else if DOC.contains(&e) { "Documents" }
    else if AUD.contains(&e) { "Audio" }
    else if VID.contains(&e) { "Vidéos" }
    else if ARC.contains(&e) { "Archives" }
    else if COD.contains(&e) { "Code" }
    else { "Autres" }
}

// Calcul Y-M depuis epoch (algo civil_from_days de H. Hinnant), sans dépendance chrono.
fn year_month(secs: u64) -> (i64, u32) {
    let z = (secs / 86400) as i64 + 719468;
    let era = (if z >= 0 { z } else { z - 146096 }) / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    (if m <= 2 { y + 1 } else { y }, m as u32)
}

fn date_bucket(meta: &fs::Metadata) -> String {
    use std::time::UNIX_EPOCH;
    let secs = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let (y, m) = year_month(secs);
    format!("{y:04}-{m:02}")
}

/// Range les fichiers directs d'un dossier dans des sous-dossiers (par type ou par date).
/// Retourne les déplacements effectués (pour annulation via la pile undo du front).
#[tauri::command]
pub fn organize_dir(path: String, by: String) -> Result<Vec<MoveRec>, String> {
    let root = Path::new(&path);
    let mut moves = Vec::new();
    for entry in fs::read_dir(root).map_err(|e| format!("lecture dossier: {e}"))?.flatten() {
        let src = entry.path();
        let name = match src.file_name().and_then(|n| n.to_str()) {
            Some(n) if !n.starts_with('.') => n.to_string(),
            _ => continue,
        };
        let meta = match entry.metadata() {
            Ok(m) if m.is_file() => m,
            _ => continue,
        };
        let bucket = if by == "date" {
            date_bucket(&meta)
        } else {
            category(src.extension().and_then(|e| e.to_str()).unwrap_or("")).to_string()
        };
        let sub = root.join(&bucket);
        fs::create_dir_all(&sub).map_err(|e| format!("création {bucket}: {e}"))?;
        let stem = src.file_stem().and_then(|s| s.to_str()).unwrap_or(&name);
        let ext = src.extension().and_then(|e| e.to_str()).unwrap_or("");
        let dest = collision_free(&sub, stem, ext);
        fs::rename(&src, &dest).map_err(|e| format!("déplacement {name}: {e}"))?;
        moves.push(MoveRec {
            from: src.to_string_lossy().into_owned(),
            to: dest.to_string_lossy().into_owned(),
        });
    }
    Ok(moves)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn category_buckets() {
        assert_eq!(category("PNG"), "Images");
        assert_eq!(category("rs"), "Code");
        assert_eq!(category("xyz"), "Autres");
    }

    #[test]
    fn year_month_known_dates() {
        // 2021-01-01 00:00:00 UTC = 1609459200
        assert_eq!(year_month(1609459200), (2021, 1));
        // 1970-01-01
        assert_eq!(year_month(0), (1970, 1));
    }

    #[test]
    fn merge_csv_keeps_single_header() {
        let dir = std::env::temp_dir().join(format!("vela_csv_{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let a = dir.join("a.csv");
        let b = dir.join("b.csv");
        fs::write(&a, "id,name\n1,alice\n").unwrap();
        fs::write(&b, "id,name\n2,bob\n").unwrap();
        let out = merge_csv(vec![a.to_string_lossy().into(), b.to_string_lossy().into()]).unwrap();
        let merged = fs::read_to_string(&out).unwrap();
        assert_eq!(merged, "id,name\n1,alice\n2,bob\n");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn organize_by_type_moves_files() {
        let dir = std::env::temp_dir().join(format!("vela_org_{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("p.png"), b"x").unwrap();
        fs::write(dir.join("n.txt"), b"x").unwrap();
        let moves = organize_dir(dir.to_string_lossy().into(), "type".into()).unwrap();
        assert_eq!(moves.len(), 2);
        assert!(dir.join("Images/p.png").exists());
        assert!(dir.join("Documents/n.txt").exists());
        let _ = fs::remove_dir_all(&dir);
    }
}
