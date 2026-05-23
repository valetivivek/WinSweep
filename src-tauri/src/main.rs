// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // When relaunched elevated for a guarded delete, do that work headlessly
    // (no window) and exit. Args: --elevated-delete <targets.json> <report.json>
    let args: Vec<String> = std::env::args().collect();
    if args.len() >= 4 && args[1] == "--elevated-delete" {
        winsweep_lib::run_elevated_delete(&args[2], &args[3]);
        return;
    }

    // Task Scheduler fires the binary with this flag at the user's chosen
    // weekly time. Run the configured sweep with no window and exit.
    if args.len() >= 2 && args[1] == "--scheduled-clean" {
        winsweep_lib::run_scheduled_clean();
        return;
    }

    winsweep_lib::run()
}
