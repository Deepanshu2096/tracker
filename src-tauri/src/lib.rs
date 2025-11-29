mod activity_tracker;

use activity_tracker::ActivityTracker;
use std::sync::Mutex;
use tauri::State;

#[derive(Default)]
struct TrackerState {
    tracker: Mutex<Option<ActivityTracker>>,
}

#[tauri::command]
fn start_activity_tracking(
    app: tauri::AppHandle,
    idle_threshold_ms: u64,
    tracking_interval_ms: u64,
    state: State<'_, TrackerState>,
) -> Result<(), String> {
    let mut tracker_guard = state.tracker.lock().map_err(|e| format!("Lock error: {}", e))?;
    
    let tracker = ActivityTracker::new(app.clone(), idle_threshold_ms, tracking_interval_ms);
    tracker.start_tracking();
    
    *tracker_guard = Some(tracker);
    Ok(())
}

#[tauri::command]
fn stop_activity_tracking(state: State<'_, TrackerState>) -> Result<(), String> {
    let mut tracker_guard = state.tracker.lock().map_err(|e| format!("Lock error: {}", e))?;
    
    if let Some(tracker) = tracker_guard.take() {
        tracker.stop_tracking();
    }
    
    Ok(())
}

#[tauri::command]
fn reset_activity_tracking(state: State<'_, TrackerState>) -> Result<(), String> {
    let tracker_guard = state.tracker.lock().map_err(|e| format!("Lock error: {}", e))?;
    
    if let Some(tracker) = tracker_guard.as_ref() {
        tracker.reset();
    }
    
    Ok(())
}

#[tauri::command]
fn get_activity_state(state: State<'_, TrackerState>) -> Result<activity_tracker::ActivityState, String> {
    let tracker_guard = state.tracker.lock().map_err(|e| format!("Lock error: {}", e))?;
    
    if let Some(tracker) = tracker_guard.as_ref() {
        Ok(tracker.get_state())
    } else {
        Ok(activity_tracker::ActivityState::default())
    }
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(TrackerState::default())
    .invoke_handler(tauri::generate_handler![
      start_activity_tracking,
      stop_activity_tracking,
      reset_activity_tracking,
      get_activity_state,
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
