// Espace disque d'un volume : statvfs(2) → (octets libres, octets totaux) pour la barre d'état.
use std::ffi::CString;
use std::path::Path;

// Vrai si un fichier ou dossier existe déjà à ce chemin (détection de conflit avant extraction).
#[tauri::command]
pub fn path_exists(path: String) -> bool {
    Path::new(&path).exists()
}

#[tauri::command]
pub fn disk_free(path: String) -> Result<(u64, u64), String> {
    let c = CString::new(path).map_err(|e| e.to_string())?;
    // SAFETY: statvfs lit le FS du chemin pointé par `c` ; `stat` est entièrement renseigné par l'appel
    // s'il réussit (retour 0). On ne déréférence aucun pointeur invalide.
    unsafe {
        let mut stat: libc::statvfs = std::mem::zeroed();
        if libc::statvfs(c.as_ptr(), &mut stat) != 0 {
            return Err(std::io::Error::last_os_error().to_string());
        }
        let block = stat.f_frsize as u64;
        let free = (stat.f_bavail as u64).saturating_mul(block);
        let total = (stat.f_blocks as u64).saturating_mul(block);
        Ok((free, total))
    }
}
