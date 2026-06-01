// Point d'entrée Tauri : enregistre les commandes filesystem exposées au front.
mod fs_ops;
mod places;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            fs_ops::list_dir,
            fs_ops::read_file,
            fs_ops::read_file_chunk,
            fs_ops::write_file,
            fs_ops::rename_entry,
            fs_ops::delete_entry,
            fs_ops::create_dir,
            places::home_dir,
            places::list_places,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
