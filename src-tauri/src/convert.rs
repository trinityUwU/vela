// Conversion universelle locale : images (crate image), documents (pandoc), bureautique → pdf
// (libreoffice headless), image → pdf (printpdf, octets bruts pour éviter les conflits de version image).
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Command;

const IMAGE_EXTS: &[&str] = &["png", "jpg", "jpeg", "webp", "gif", "bmp", "tiff", "tif", "ico"];
const IMAGE_TARGETS: &[&str] = &["png", "jpg", "webp", "bmp", "tiff", "pdf"];
const DOC_EXTS: &[&str] = &["md", "markdown", "html", "htm", "docx", "odt", "rtf", "epub", "rst", "tex", "txt"];
const DOC_TARGETS: &[&str] = &["pdf", "docx", "odt", "html", "md", "epub", "txt"];
const OFFICE_EXTS: &[&str] = &["docx", "xlsx", "pptx", "odt", "ods", "odp", "doc", "xls", "ppt"];

#[derive(Serialize)]
pub struct ConvertCapabilities {
    pub pandoc: bool,
    pub libreoffice: bool,
}

fn binary_exists(name: &str, arg: &str) -> bool {
    match Command::new(name).arg(arg).output() {
        Ok(out) => out.status.success(),
        Err(e) => {
            eprintln!("[convert] {name} {arg} failed: {e}");
            false
        }
    }
}

fn libreoffice_bin() -> Option<String> {
    ["libreoffice", "soffice"].into_iter().find(|b| binary_exists(b, "--version")).map(String::from)
}

#[tauri::command]
pub fn convert_capabilities() -> ConvertCapabilities {
    ConvertCapabilities {
        pandoc: binary_exists("pandoc", "--version"),
        libreoffice: libreoffice_bin().is_some(),
    }
}

fn ext_of(path: &str) -> String {
    Path::new(path).extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase()
}

/// Formats cibles possibles selon l'extension source (table de routage pure).
#[tauri::command]
pub fn convert_targets(path: String) -> Vec<String> {
    let e = ext_of(&path);
    let pick = |all: &[&str]| all.iter().filter(|t| **t != e).map(|t| t.to_string()).collect::<Vec<_>>();
    if IMAGE_EXTS.contains(&e.as_str()) {
        return pick(IMAGE_TARGETS);
    }
    if DOC_EXTS.contains(&e.as_str()) {
        return pick(DOC_TARGETS);
    }
    if OFFICE_EXTS.contains(&e.as_str()) {
        return vec!["pdf".into()];
    }
    vec![]
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

fn out_path(input: &str, target: &str) -> PathBuf {
    let p = Path::new(input);
    let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("output");
    let dir = p.parent().unwrap_or_else(|| Path::new("."));
    collision_free(dir, stem, target)
}

#[tauri::command]
pub fn convert_file(input: String, target: String) -> Result<String, String> {
    let src = ext_of(&input);
    let out = out_path(&input, &target);
    let is_image = IMAGE_EXTS.contains(&src.as_str());
    let result = if is_image && target == "pdf" {
        image_to_pdf(&input, &out)
    } else if is_image {
        convert_image(&input, &out)
    } else if target == "pdf" && OFFICE_EXTS.contains(&src.as_str()) {
        convert_office(&input, &out)
    } else {
        convert_doc(&input, &out)
    };
    result.map(|_| out.to_string_lossy().into_owned())
}

fn convert_image(input: &str, out: &Path) -> Result<(), String> {
    image::open(input)
        .map_err(|e| format!("ouverture image: {e}"))?
        .save(out)
        .map_err(|e| format!("écriture image: {e}"))
}

// Moteurs PDF supportés par pandoc, du plus léger/souverain (typst) au plus lourd (TeX Live).
const PDF_ENGINES: &[&str] = &["typst", "weasyprint", "xelatex", "lualatex", "pdflatex", "tectonic"];

fn pdf_engine() -> Option<&'static str> {
    PDF_ENGINES.iter().copied().find(|e| binary_exists(e, "--version"))
}

// Police sans-serif disponible sur le système (pour le moteur typst). fc-match si présent,
// sinon DejaVu Sans (quasi universelle sous Linux). Évite l'erreur typst « font fallback empty ».
fn system_sans_font() -> String {
    Command::new("fc-match")
        .args(["-f", "%{family}", "sans"])
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "DejaVu Sans".into())
}

fn convert_doc(input: &str, out: &Path) -> Result<(), String> {
    let mut cmd = Command::new("pandoc");
    cmd.arg(input).arg("-o").arg(out);
    if out.extension().and_then(|e| e.to_str()) == Some("pdf") {
        // pandoc ne génère pas de PDF sans moteur : signaler clairement (sentinelle PDF_ENGINE_MISSING).
        match pdf_engine() {
            Some(eng) => {
                cmd.arg(format!("--pdf-engine={eng}"));
                // typst exige une police explicite (son template échoue sur une liste de fallback vide).
                if eng == "typst" {
                    cmd.arg("-V").arg(format!("mainfont={}", system_sans_font()));
                }
            }
            None => return Err("PDF_ENGINE_MISSING: moteur PDF requis (typst recommandé)".into()),
        }
    }
    let status = cmd.status().map_err(|e| format!("pandoc introuvable: {e}"))?;
    if status.success() {
        Ok(())
    } else {
        Err("pandoc a échoué".into())
    }
}

fn convert_office(input: &str, out: &Path) -> Result<(), String> {
    let bin = libreoffice_bin().ok_or("libreoffice introuvable")?;
    let tmp = std::env::temp_dir().join(format!("vela_lo_{}", std::process::id()));
    std::fs::create_dir_all(&tmp).map_err(|e| format!("tmp: {e}"))?;
    let status = Command::new(&bin)
        .args(["--headless", "--convert-to", "pdf", "--outdir"])
        .arg(&tmp)
        .arg(input)
        .status()
        .map_err(|e| format!("libreoffice spawn: {e}"))?;
    if !status.success() {
        let _ = std::fs::remove_dir_all(&tmp);
        return Err("libreoffice a échoué".into());
    }
    let stem = Path::new(input).file_stem().and_then(|s| s.to_str()).unwrap_or("output");
    let produced = tmp.join(format!("{stem}.pdf"));
    let moved = std::fs::rename(&produced, out).or_else(|_| std::fs::copy(&produced, out).map(|_| ()));
    let _ = std::fs::remove_dir_all(&tmp);
    moved.map_err(|e| format!("déplacement résultat: {e}"))
}

const PDF_DPI: f32 = 72.0;

fn pdf_mm(px: u32) -> printpdf::Mm {
    printpdf::Mm(px as f32 / PDF_DPI * 25.4)
}

fn rgb_to_xobject(rgb: ::image::RgbImage) -> printpdf::ImageXObject {
    use printpdf::*;
    let (w, h) = (rgb.width(), rgb.height());
    ImageXObject {
        width: Px(w as usize),
        height: Px(h as usize),
        color_space: ColorSpace::Rgb,
        bits_per_component: ColorBits::Bit8,
        interpolate: true,
        image_data: rgb.into_raw(),
        image_filter: None,
        clipping_bbox: None,
        smask: None,
    }
}

fn image_to_pdf(input: &str, out: &Path) -> Result<(), String> {
    use printpdf::*;
    let rgb = ::image::open(input).map_err(|e| format!("image: {e}"))?.to_rgb8();
    let (doc, page, layer) = PdfDocument::new("vela", pdf_mm(rgb.width()), pdf_mm(rgb.height()), "image");
    Image::from(rgb_to_xobject(rgb)).add_to_layer(
        doc.get_page(page).get_layer(layer),
        ImageTransform { dpi: Some(PDF_DPI), ..Default::default() },
    );
    let file = std::fs::File::create(out).map_err(|e| format!("création pdf: {e}"))?;
    doc.save(&mut std::io::BufWriter::new(file)).map_err(|e| format!("sauvegarde pdf: {e}"))
}

/// Assemble plusieurs images en un seul PDF (une image par page). Retourne le chemin de sortie.
#[tauri::command]
pub fn images_to_pdf(inputs: Vec<String>) -> Result<String, String> {
    use printpdf::*;
    let first = inputs.first().ok_or("aucune image")?;
    let rgb0 = ::image::open(first).map_err(|e| format!("image: {e}"))?.to_rgb8();
    let (doc, page, layer) = PdfDocument::new("vela", pdf_mm(rgb0.width()), pdf_mm(rgb0.height()), "p");
    Image::from(rgb_to_xobject(rgb0)).add_to_layer(
        doc.get_page(page).get_layer(layer),
        ImageTransform { dpi: Some(PDF_DPI), ..Default::default() },
    );
    for input in &inputs[1..] {
        let rgb = ::image::open(input).map_err(|e| format!("image: {e}"))?.to_rgb8();
        let (p, l) = doc.add_page(pdf_mm(rgb.width()), pdf_mm(rgb.height()), "p");
        Image::from(rgb_to_xobject(rgb)).add_to_layer(
            doc.get_page(p).get_layer(l),
            ImageTransform { dpi: Some(PDF_DPI), ..Default::default() },
        );
    }
    let dir = Path::new(first).parent().unwrap_or_else(|| Path::new("."));
    let out = collision_free(dir, "images", "pdf");
    let file = std::fs::File::create(&out).map_err(|e| format!("création pdf: {e}"))?;
    doc.save(&mut std::io::BufWriter::new(file)).map_err(|e| format!("sauvegarde pdf: {e}"))?;
    Ok(out.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn targets_image() {
        let t = convert_targets("/x/photo.png".into());
        assert!(t.contains(&"pdf".to_string()));
        assert!(t.contains(&"jpg".to_string()));
        assert!(!t.contains(&"png".to_string()));
    }

    #[test]
    fn targets_office_pdf_only() {
        assert_eq!(convert_targets("/x/rapport.xlsx".into()), vec!["pdf".to_string()]);
    }

    #[test]
    fn targets_unknown_empty() {
        assert!(convert_targets("/x/bin.dat".into()).is_empty());
    }

    #[test]
    fn out_path_avoids_collision() {
        let dir = std::env::temp_dir().join(format!("vela_conv_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let base = dir.join("a.png");
        std::fs::write(&base, b"x").unwrap();
        let taken = dir.join("a.jpg");
        std::fs::write(&taken, b"x").unwrap();
        let out = out_path(base.to_str().unwrap(), "jpg");
        assert_eq!(out.file_name().unwrap().to_str().unwrap(), "a (1).jpg");
        let _ = std::fs::remove_dir_all(&dir);
    }
}
