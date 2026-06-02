// Opérations image non-destructives via la crate `image` : crop, rotate, flip, resize,
// adjust (luminosité/contraste/saturation), convert. Chaque commande Tauri est async et
// délègue le travail bloquant à spawn_blocking. Le format de sortie est inféré de l'extension.
use image::imageops::FilterType;
use image::{DynamicImage, GenericImageView, Rgba};
use serde::Deserialize;

/// Charge une image depuis `input`, loggue et mappe l'erreur en String.
fn load(input: &str) -> Result<DynamicImage, String> {
    image::open(input).map_err(|e| {
        eprintln!("[imaging] open {input} failed: {e}");
        e.to_string()
    })
}

/// Sauvegarde `img` vers `output`, format inféré de l'extension.
fn save(img: &DynamicImage, output: &str) -> Result<(), String> {
    img.save(output).map_err(|e| {
        eprintln!("[imaging] save {output} failed: {e}");
        e.to_string()
    })
}

fn do_crop(input: &str, output: &str, x: u32, y: u32, w: u32, h: u32) -> Result<(), String> {
    let img = load(input)?;
    let (iw, ih) = img.dimensions();
    let cw = w.min(iw.saturating_sub(x));
    let ch = h.min(ih.saturating_sub(y));
    save(&img.crop_imm(x, y, cw, ch), output)
}

fn do_rotate(input: &str, output: &str, degrees: u32) -> Result<(), String> {
    let img = load(input)?;
    let rotated = match degrees {
        90 => img.rotate90(),
        180 => img.rotate180(),
        270 => img.rotate270(),
        _ => {
            eprintln!("[imaging] rotation invalide: {degrees}");
            return Err("rotation supportée: 90, 180, 270".into());
        }
    };
    save(&rotated, output)
}

fn do_flip(input: &str, output: &str, horizontal: bool) -> Result<(), String> {
    let img = load(input)?;
    let flipped = if horizontal { img.fliph() } else { img.flipv() };
    save(&flipped, output)
}

fn do_resize(input: &str, output: &str, width: u32, height: u32, keep_aspect: bool) -> Result<(), String> {
    let img = load(input)?;
    let resized = if keep_aspect {
        img.resize(width, height, FilterType::Lanczos3)
    } else {
        img.resize_exact(width, height, FilterType::Lanczos3)
    };
    save(&resized, output)
}

/// Lerp chaque canal vers la luma pondérée selon `factor` (1.0 = inchangé).
fn apply_saturation(img: DynamicImage, factor: f32) -> DynamicImage {
    let mut buf = img.to_rgba8();
    for px in buf.pixels_mut() {
        let [r, g, b, a] = px.0;
        let l = 0.299 * r as f32 + 0.587 * g as f32 + 0.114 * b as f32;
        let lerp = |c: u8| (l + (c as f32 - l) * factor).clamp(0.0, 255.0) as u8;
        *px = Rgba([lerp(r), lerp(g), lerp(b), a]);
    }
    DynamicImage::ImageRgba8(buf)
}

fn do_adjust(input: &str, output: &str, brightness: i32, contrast: f32, saturation: f32) -> Result<(), String> {
    let img = load(input)?;
    let mut out = img.brighten(brightness).adjust_contrast(contrast);
    if (saturation - 1.0).abs() >= 0.001 {
        out = apply_saturation(out, saturation);
    }
    save(&out, output)
}

/// Encode `img` en JPEG vers `output` avec la qualité donnée (0-100).
fn save_jpeg(img: &DynamicImage, output: &str, quality: u8) -> Result<(), String> {
    use image::codecs::jpeg::JpegEncoder;
    use image::ImageEncoder;
    let file = std::fs::File::create(output).map_err(|e| {
        eprintln!("[imaging] create {output} failed: {e}");
        e.to_string()
    })?;
    let rgb = img.to_rgb8();
    JpegEncoder::new_with_quality(file, quality)
        .write_image(rgb.as_raw(), rgb.width(), rgb.height(), image::ExtendedColorType::Rgb8)
        .map_err(|e| {
            eprintln!("[imaging] jpeg encode {output} failed: {e}");
            e.to_string()
        })
}

fn is_jpeg_ext(output: &str) -> bool {
    output
        .rsplit('.')
        .next()
        .map(|e| matches!(e.to_ascii_lowercase().as_str(), "jpg" | "jpeg"))
        .unwrap_or(false)
}

fn do_convert(input: &str, output: &str, quality: Option<u8>) -> Result<(), String> {
    let img = load(input)?;
    match quality {
        Some(q) if is_jpeg_ext(output) => save_jpeg(&img, output, q),
        _ => save(&img, output),
    }
}

/// Recadre `input` en (x, y, w, h) → `output`. w/h clampés aux bornes de l'image.
#[tauri::command]
pub async fn image_crop(input: String, output: String, x: u32, y: u32, w: u32, h: u32) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || do_crop(&input, &output, x, y, w, h))
        .await
        .map_err(|e| e.to_string())?
}

/// Pivote `input` de 90/180/270 degrés → `output`.
#[tauri::command]
pub async fn image_rotate(input: String, output: String, degrees: u32) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || do_rotate(&input, &output, degrees))
        .await
        .map_err(|e| e.to_string())?
}

/// Retourne `input` horizontalement ou verticalement → `output`.
#[tauri::command]
pub async fn image_flip(input: String, output: String, horizontal: bool) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || do_flip(&input, &output, horizontal))
        .await
        .map_err(|e| e.to_string())?
}

/// Redimensionne `input` → `output`. keep_aspect borne dans la box, sinon dimensions exactes.
#[tauri::command]
pub async fn image_resize(
    input: String,
    output: String,
    width: u32,
    height: u32,
    keep_aspect: bool,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || do_resize(&input, &output, width, height, keep_aspect))
        .await
        .map_err(|e| e.to_string())?
}

/// Ajuste luminosité (i32), contraste (f32) et saturation (f32, 1.0 = inchangé) → `output`.
#[tauri::command]
pub async fn image_adjust(
    input: String,
    output: String,
    brightness: i32,
    contrast: f32,
    saturation: f32,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || do_adjust(&input, &output, brightness, contrast, saturation))
        .await
        .map_err(|e| e.to_string())?
}

/// Convertit `input` → `output` (format inféré). JPEG : honore `quality` (0-100).
#[tauri::command]
pub async fn image_convert(input: String, output: String, quality: Option<u8>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || do_convert(&input, &output, quality))
        .await
        .map_err(|e| e.to_string())?
}

/// Une opération d'édition image (édition accumulée, appliquée en mémoire puis écrite une fois).
#[derive(Deserialize, Clone)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum ImageOp {
    Crop { x: u32, y: u32, w: u32, h: u32 },
    Rotate { degrees: u32 },
    Flip { horizontal: bool },
    Resize { width: u32, height: u32, keep_aspect: bool },
    Adjust { brightness: i32, contrast: f32, saturation: f32 },
}

/// Applique une opération en mémoire et retourne l'image transformée.
fn apply_op(img: DynamicImage, op: &ImageOp) -> Result<DynamicImage, String> {
    Ok(match *op {
        ImageOp::Crop { x, y, w, h } => {
            let (iw, ih) = img.dimensions();
            img.crop_imm(x, y, w.min(iw.saturating_sub(x)), h.min(ih.saturating_sub(y)))
        }
        ImageOp::Rotate { degrees } => match degrees {
            90 => img.rotate90(),
            180 => img.rotate180(),
            270 => img.rotate270(),
            _ => return Err("rotation supportée: 90, 180, 270".into()),
        },
        ImageOp::Flip { horizontal } => if horizontal { img.fliph() } else { img.flipv() },
        ImageOp::Resize { width, height, keep_aspect } => if keep_aspect {
            img.resize(width, height, FilterType::Lanczos3)
        } else {
            img.resize_exact(width, height, FilterType::Lanczos3)
        },
        ImageOp::Adjust { brightness, contrast, saturation } => {
            let out = img.brighten(brightness).adjust_contrast(contrast);
            if (saturation - 1.0).abs() >= 0.001 { apply_saturation(out, saturation) } else { out }
        }
    })
}

/// Rejoue la liste ordonnée d'ops sur `input` puis écrit une seule fois vers `output`.
fn do_apply_ops(input: &str, output: &str, ops: &[ImageOp], quality: Option<u8>) -> Result<(), String> {
    let mut img = load(input)?;
    for op in ops {
        img = apply_op(img, op)?;
    }
    match quality {
        Some(q) if is_jpeg_ext(output) => save_jpeg(&img, output, q),
        _ => save(&img, output),
    }
}

/// Applique une séquence d'éditions accumulées (rotate→crop→resize→adjust…) en un seul fichier.
#[tauri::command]
pub async fn image_apply_ops(
    input: String,
    output: String,
    ops: Vec<ImageOp>,
    quality: Option<u8>,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || do_apply_ops(&input, &output, &ops, quality))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{Rgb, RgbImage};
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn tmp_dir() -> PathBuf {
        let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let dir = std::env::temp_dir().join(format!("vela_imaging_test_{nanos}"));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn fixture(dir: &PathBuf) -> String {
        let img = RgbImage::from_fn(100, 80, |x, y| {
            Rgb([(x * 2 % 256) as u8, (y * 3 % 256) as u8, ((x + y) % 256) as u8])
        });
        let path = dir.join("src.png");
        img.save(&path).unwrap();
        path.to_string_lossy().into_owned()
    }

    fn out_path(dir: &PathBuf, name: &str) -> String {
        dir.join(name).to_string_lossy().into_owned()
    }

    fn dims(path: &str) -> (u32, u32) {
        image::open(path).unwrap().dimensions()
    }

    #[test]
    fn test_crop() {
        let dir = tmp_dir();
        let src = fixture(&dir);
        let out = out_path(&dir, "crop.png");
        do_crop(&src, &out, 10, 10, 50, 40).unwrap();
        assert_eq!(dims(&out), (50, 40));
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn test_resize_exact() {
        let dir = tmp_dir();
        let src = fixture(&dir);
        let out = out_path(&dir, "resize.png");
        do_resize(&src, &out, 40, 40, false).unwrap();
        assert_eq!(dims(&out), (40, 40));
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn test_rotate_90() {
        let dir = tmp_dir();
        let src = fixture(&dir);
        let out = out_path(&dir, "rot.png");
        do_rotate(&src, &out, 90).unwrap();
        assert_eq!(dims(&out), (80, 100));
        assert!(do_rotate(&src, &out, 45).is_err());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn test_flip_horizontal() {
        let dir = tmp_dir();
        let src = fixture(&dir);
        let out = out_path(&dir, "flip.png");
        do_flip(&src, &out, true).unwrap();
        assert_eq!(dims(&out), (100, 80));
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn test_adjust() {
        let dir = tmp_dir();
        let src = fixture(&dir);
        let out = out_path(&dir, "adjust.png");
        do_adjust(&src, &out, 20, 10.0, 1.5).unwrap();
        let meta = std::fs::metadata(&out).unwrap();
        assert!(meta.len() > 0);
        assert_eq!(dims(&out), (100, 80));
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn test_apply_ops_sequence() {
        let dir = tmp_dir();
        let src = fixture(&dir);
        let out = out_path(&dir, "edited.png");
        let ops = vec![
            ImageOp::Rotate { degrees: 90 },
            ImageOp::Resize { width: 40, height: 40, keep_aspect: false },
            ImageOp::Adjust { brightness: 10, contrast: 5.0, saturation: 1.2 },
        ];
        do_apply_ops(&src, &out, &ops, None).unwrap();
        assert_eq!(dims(&out), (40, 40));
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn test_convert_png_to_jpeg() {
        let dir = tmp_dir();
        let src = fixture(&dir);
        let out = out_path(&dir, "conv.jpg");
        do_convert(&src, &out, Some(85)).unwrap();
        let meta = std::fs::metadata(&out).unwrap();
        assert!(meta.len() > 0);
        let reader = image::ImageReader::open(&out).unwrap();
        assert_eq!(reader.format(), Some(image::ImageFormat::Jpeg));
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
