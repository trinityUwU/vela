// OCR local via tesseract (optionnel). Image directe ; PDF scanné via pdftoppm → tesseract.
// Progression émise par page (event ocr-progress) ; écrit un sidecar .ocr.txt et retourne son chemin.
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::{AppHandle, Emitter};

#[derive(Serialize)]
pub struct OcrCapabilities {
    pub tesseract: bool,
    pub langs: Vec<String>,
}

fn binary_exists(name: &str, arg: &str) -> bool {
    match Command::new(name).arg(arg).output() {
        Ok(out) => out.status.success(),
        Err(e) => {
            eprintln!("[ocr] {name} {arg} failed: {e}");
            false
        }
    }
}

fn parse_langs(stdout: &str) -> Vec<String> {
    stdout.lines().skip(1).map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect()
}

fn tesseract_langs() -> Vec<String> {
    match Command::new("tesseract").arg("--list-langs").output() {
        Ok(out) => parse_langs(&String::from_utf8_lossy(&out.stdout)),
        Err(_) => Vec::new(),
    }
}

#[tauri::command]
pub fn ocr_capabilities() -> OcrCapabilities {
    let tesseract = binary_exists("tesseract", "--version");
    OcrCapabilities {
        langs: if tesseract { tesseract_langs() } else { Vec::new() },
        tesseract,
    }
}

#[derive(Serialize, Clone)]
struct OcrProgress {
    id: String,
    name: String,
    dest: String,
    current: usize,
    total: usize,
    status: String,
    error: Option<String>,
}

fn emit(app: &AppHandle, p: OcrProgress) {
    let _ = app.emit("ocr-progress", p);
}

fn basename(path: &str) -> String {
    Path::new(path).file_name().and_then(|n| n.to_str()).unwrap_or(path).to_string()
}

fn out_path(input: &str) -> PathBuf {
    let p = Path::new(input);
    let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("ocr");
    let dir = p.parent().unwrap_or_else(|| Path::new("."));
    let mut out = dir.join(format!("{stem}.ocr.txt"));
    let mut n = 1;
    while out.exists() {
        out = dir.join(format!("{stem}.ocr ({n}).txt"));
        n += 1;
    }
    out
}

fn ocr_image(input: &str, lang: &str) -> Result<String, String> {
    let out = Command::new("tesseract")
        .arg(input)
        .arg("stdout")
        .args(["-l", lang])
        .output()
        .map_err(|e| format!("tesseract introuvable: {e}"))?;
    if !out.status.success() {
        return Err(format!("tesseract a échoué: {}", String::from_utf8_lossy(&out.stderr)));
    }
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

fn ocr_pdf(app: &AppHandle, id: &str, name: &str, dest: &str, input: &str, lang: &str) -> Result<String, String> {
    let tmp = std::env::temp_dir().join(format!("vela_ocr_{}", std::process::id()));
    std::fs::create_dir_all(&tmp).map_err(|e| format!("tmp: {e}"))?;
    let prefix = tmp.join("page");
    let status = Command::new("pdftoppm")
        .args(["-png", "-r", "150"])
        .arg(input)
        .arg(&prefix)
        .status()
        .map_err(|e| format!("pdftoppm introuvable (poppler): {e}"))?;
    if !status.success() {
        let _ = std::fs::remove_dir_all(&tmp);
        return Err("pdftoppm a échoué".into());
    }
    let mut pages: Vec<_> = std::fs::read_dir(&tmp)
        .map_err(|e| e.to_string())?
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.extension().and_then(|x| x.to_str()) == Some("png"))
        .collect();
    pages.sort();
    let total = pages.len().max(1);
    let mut text = String::new();
    for (i, page) in pages.iter().enumerate() {
        emit(app, OcrProgress {
            id: id.into(), name: name.into(), dest: dest.into(),
            current: i, total, status: "running".into(), error: None,
        });
        text.push_str(&ocr_image(&page.to_string_lossy(), lang)?);
        text.push('\n');
    }
    let _ = std::fs::remove_dir_all(&tmp);
    Ok(text)
}

fn millis() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

// Async + spawn_blocking : l'OCR peut être long (PDF multi-pages), ne doit pas bloquer le main thread.
// Émet ocr-progress (running par page / done / error) et écrit le sidecar .ocr.txt.
#[tauri::command]
pub async fn ocr_extract(app: AppHandle, path: String, lang: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let id = format!("ocr-{}", millis());
        let name = basename(&path);
        let dest = out_path(&path);
        let dest_s = dest.to_string_lossy().into_owned();
        let l = if lang.is_empty() { "eng".to_string() } else { lang };
        emit(&app, OcrProgress {
            id: id.clone(), name: name.clone(), dest: dest_s.clone(),
            current: 0, total: 1, status: "running".into(), error: None,
        });
        let produced = if path.to_lowercase().ends_with(".pdf") {
            ocr_pdf(&app, &id, &name, &dest_s, &path, &l)
        } else {
            ocr_image(&path, &l)
        };
        match produced.and_then(|text| std::fs::write(&dest, text).map_err(|e| format!("écriture: {e}"))) {
            Ok(()) => {
                emit(&app, OcrProgress {
                    id, name, dest: dest_s.clone(), current: 1, total: 1, status: "done".into(), error: None,
                });
                Ok(dest_s)
            }
            Err(e) => {
                emit(&app, OcrProgress {
                    id, name, dest: dest_s, current: 0, total: 1, status: "error".into(), error: Some(e.clone()),
                });
                Err(e)
            }
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_langs_skips_header() {
        let out = "List of available languages (3):\neng\nfra\nosd\n";
        assert_eq!(parse_langs(out), vec!["eng", "fra", "osd"]);
    }

    #[test]
    fn out_path_uses_ocr_suffix() {
        let p = out_path("/x/rapport.pdf");
        assert_eq!(p.file_name().unwrap().to_str().unwrap(), "rapport.ocr.txt");
    }

    #[test]
    fn capabilities_invariant() {
        let c = ocr_capabilities();
        assert_eq!(c.langs.is_empty() || c.tesseract, true);
    }
}
