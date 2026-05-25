mod app_data;
mod apps;
mod cleanup;
mod schedule;
mod updates;

pub use cleanup::run_elevated_delete;
pub use schedule::run_scheduled_clean;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            apps::list_installed_apps,
            apps::uninstall_app,
            apps::open_install_location,
            apps::app_icons,
            updates::list_updates,
            updates::update_app,
            updates::list_windows_updates,
            updates::open_windows_update_settings,
            cleanup::scan_residuals,
            cleanup::delete_residuals,
            cleanup::list_ignored,
            cleanup::add_ignored,
            cleanup::clear_ignored,
            app_data::list_app_data,
            app_data::delete_app_data,
            app_data::open_app_data,
            schedule::get_schedule,
            schedule::set_schedule,
            schedule::get_last_scheduled_run,
            schedule::quick_sweep,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
