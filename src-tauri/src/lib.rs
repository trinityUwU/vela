// Point d'entrée Tauri : enregistre les commandes filesystem exposées au front.
mod actions;
mod analyze;
mod apps;
mod archive;
mod browser;
mod audio;
mod convert;
mod dircmp;
mod download_job;
mod downloader;
mod favorites;
mod fs_ops;
mod git;
mod index;
mod imaging;
mod media_probe;
mod ocr;
mod ops;
mod places;
mod player;
mod profiles;
mod stems;
mod tags;
mod terminal;
mod thumbs;
mod video;
mod watcher;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    player::init();
    tauri::Builder::default()
        .manage(archive::ExtractionManager::new())
        .manage(watcher::DirWatcher::new())
        .manage(ops::TransferManager::new())
        .manage(terminal::TerminalManager::new())
        .manage(player::PlayerManager::new())
        .manage(video::VideoJobManager::new())
        .manage(stems::StemsManager::new())
        .manage(download_job::DownloadManager::new())
        .manage(index::SearchIndex::new())
        .setup(|app| {
            use tauri::Manager;
            let idx = app.state::<index::SearchIndex>().inner().clone();
            std::thread::spawn(move || idx.rebuild_from_home());
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            fs_ops::list_dir,
            fs_ops::read_file,
            fs_ops::read_file_chunk,
            fs_ops::write_file,
            fs_ops::rename_entry,
            fs_ops::delete_entry,
            fs_ops::create_dir,
            fs_ops::search_dir,
            fs_ops::read_file_base64,
            fs_ops::open_native,
            fs_ops::move_entry,
            fs_ops::get_entry_props,
            ops::trash_entries,
            ops::delete_entries,
            ops::copy_entries,
            ops::move_entries,
            ops::transfer_pause,
            ops::transfer_resume,
            ops::transfer_cancel,
            archive::start_compression,
            ops::search_content,
            ops::trash_dir,
            ops::trash_count,
            ops::empty_trash,
            ops::restore_trash,
            watcher::watch_dir,
            thumbs::thumbnail,
            terminal::available_shells,
            terminal::term_open,
            terminal::term_input,
            terminal::term_resize,
            terminal::term_close,
            places::home_dir,
            places::list_places,
            favorites::load_favorites,
            favorites::save_favorites,
            profiles::load_profiles,
            profiles::save_profiles,
            browser::browser_create,
            browser::browser_navigate,
            browser::browser_show,
            browser::browser_hide,
            browser::browser_eval,
            browser::browser_close,
            browser::browser_reset,
            tags::load_tags,
            tags::set_tag,
            analyze::analyze_disk,
            dircmp::compare_dirs,
            player::player_open,
            player::player_open_audio,
            player::player_position,
            player::player_pause,
            player::player_resume,
            player::player_seek,
            player::player_set_volume,
            player::player_close,
            archive::list_archive,
            archive::start_extraction,
            archive::extraction_pause,
            archive::extraction_resume,
            archive::extraction_cancel,
            archive::extraction_provide_password,
            apps::get_apps_for_file,
            apps::search_path_bins,
            apps::set_default_app,
            apps::set_custom_command,
            media_probe::media_capabilities,
            media_probe::media_probe,
            downloader::download_capabilities,
            downloader::download_probe,
            download_job::download_start,
            download_job::download_cancel,
            audio::audio_trim,
            audio::audio_fade,
            audio::audio_normalize,
            audio::audio_convert,
            audio::audio_remove_vocals,
            imaging::image_crop,
            imaging::image_rotate,
            imaging::image_flip,
            imaging::image_resize,
            imaging::image_adjust,
            imaging::image_convert,
            imaging::image_apply_ops,
            video::video_trim,
            video::video_extract_frame,
            video::video_extract_audio,
            video::video_convert,
            video::video_convert_cancel,
            stems::stems_status,
            stems::stems_separate,
            stems::stems_install,
            stems::stems_cancel,
            convert::convert_capabilities,
            convert::convert_targets,
            convert::convert_file,
            convert::images_to_pdf,
            actions::merge_csv,
            actions::organize_dir,
            git::git_repo_root,
            git::git_status,
            git::git_current_branch,
            git::git_branches,
            git::git_log,
            git::git_stage,
            git::git_unstage,
            git::git_commit,
            git::git_checkout_branch,
            git::git_diff_file,
            index::index_refresh,
            index::global_search,
            ocr::ocr_capabilities,
            ocr::ocr_extract,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
