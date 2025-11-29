use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tokio::time::sleep;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ActivityState {
    pub is_active: bool,
    pub is_idle: bool,
    pub last_activity_time: u64,
    pub idle_time: u64,
    pub active_time: u64,
}

pub struct ActivityTracker {
    app_handle: AppHandle,
    idle_threshold_ms: u64,
    tracking_interval_ms: u64,
    state: Arc<Mutex<ActivityState>>,
    last_event_time: Arc<Mutex<Instant>>,
    is_tracking: Arc<Mutex<bool>>,
}

impl ActivityTracker {
    pub fn new(
        app_handle: AppHandle,
        idle_threshold_ms: u64,
        tracking_interval_ms: u64,
    ) -> Self {
        Self {
            app_handle,
            idle_threshold_ms,
            tracking_interval_ms,
            state: Arc::new(Mutex::new(ActivityState {
                is_active: false,
                is_idle: false,
                last_activity_time: 0,
                idle_time: 0,
                active_time: 0,
            })),
            last_event_time: Arc::new(Mutex::new(Instant::now())),
            is_tracking: Arc::new(Mutex::new(false)),
        }
    }

    pub fn start_tracking(&self) {
        let mut is_tracking = self.is_tracking.lock().unwrap();
        if *is_tracking {
            return;
        }
        *is_tracking = true;
        drop(is_tracking);

        let state = Arc::clone(&self.state);
        let last_event_time = Arc::clone(&self.last_event_time);
        let is_tracking = Arc::clone(&self.is_tracking);
        let app_handle = self.app_handle.clone();
        let idle_threshold_ms = self.idle_threshold_ms;
        let tracking_interval_ms = self.tracking_interval_ms;

        // Initialize state
        {
            let mut state_guard = state.lock().unwrap();
            *state_guard = ActivityState {
                is_active: true,
                is_idle: false,
                last_activity_time: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as u64,
                idle_time: 0,
                active_time: 0,
            };
            *last_event_time.lock().unwrap() = Instant::now();
        }

        // Start monitoring thread
        tokio::spawn(async move {
            let mut last_state_update = Instant::now();

            loop {
                // Check if tracking is still active
                {
                    let tracking_guard = is_tracking.lock().unwrap();
                    if !*tracking_guard {
                        break;
                    }
                }

                // Activity is detected by the polling thread, which updates last_event_time
                // We just need to check the time since last activity
                let now = Instant::now();

                // Calculate time since last activity (updated by polling thread)
                let time_since_last_activity = {
                    let last_event = last_event_time.lock().unwrap();
                    now.duration_since(*last_event)
                };
                
                // Determine if there was recent activity (within last 100ms)
                let has_recent_activity = time_since_last_activity.as_millis() < 100;

                let is_idle_now = time_since_last_activity.as_millis() as u64 >= idle_threshold_ms;

                // Update state
                {
                    let mut state_guard = state.lock().unwrap();
                    let time_since_last_update = now.duration_since(last_state_update).as_secs();

                    // Update idle/active time based on previous state
                    if state_guard.is_idle {
                        state_guard.idle_time += time_since_last_update;
                    } else {
                        state_guard.active_time += time_since_last_update;
                    }

                    // Update idle state if changed
                    if state_guard.is_idle != is_idle_now {
                        state_guard.is_idle = is_idle_now;
                        
                        // Emit event to frontend
                        let _ = app_handle.emit("activity-idle-change", is_idle_now);
                    }

                    if has_recent_activity {
                        state_guard.last_activity_time = std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap()
                            .as_millis() as u64;
                    }
                }

                // Emit current state to frontend
                {
                    let state_guard = state.lock().unwrap();
                    let current_state = state_guard.clone();
                    let _ = app_handle.emit("activity-state", current_state);
                }

                last_state_update = now;
                sleep(Duration::from_millis(tracking_interval_ms)).await;
            }
        });

        // Start polling mouse/keyboard position
        Self::start_polling(
            Arc::clone(&self.last_event_time),
            Arc::clone(&self.is_tracking),
        );
    }

    pub fn stop_tracking(&self) {
        let mut is_tracking = self.is_tracking.lock().unwrap();
        *is_tracking = false;

        let mut state = self.state.lock().unwrap();
        state.is_active = false;
    }

    pub fn reset(&self) {
        let mut state = self.state.lock().unwrap();
        *state = ActivityState {
            is_active: true,
            is_idle: false,
            last_activity_time: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
            idle_time: 0,
            active_time: 0,
        };
        *self.last_event_time.lock().unwrap() = Instant::now();
    }

    pub fn get_state(&self) -> ActivityState {
        self.state.lock().unwrap().clone()
    }

    fn start_polling(
        last_event_time: Arc<Mutex<Instant>>,
        is_tracking: Arc<Mutex<bool>>,
    ) {
        tokio::spawn(async move {
            use device_query::{DeviceQuery, DeviceState};
            use std::collections::HashSet;
            
            // NOTE: On macOS, system-wide input monitoring requires Accessibility permissions.
            // Users must grant these permissions in System Settings > Privacy & Security > Accessibility.
            // Without these permissions, tracking will only work within the app window.
            
            let mut last_mouse_pos: Option<(i32, i32)> = None;
            let mut last_keys: HashSet<device_query::Keycode> = HashSet::new();
            
            loop {
                {
                    let tracking_guard = is_tracking.lock().unwrap();
                    if !*tracking_guard {
                        break;
                    }
                }

                // Create a new DeviceState to get current system-wide state
                // This polls the global mouse and keyboard state across the entire system,
                // not just within the app window (requires permissions on macOS)
                let device_state = DeviceState::new();
                let mouse = device_state.get_mouse();
                let current_keys: HashSet<device_query::Keycode> = device_state.get_keys().iter().cloned().collect();

                let mut has_activity = false;

                // Check for mouse movement (system-wide, works even when app is not focused)
                match last_mouse_pos {
                    Some(last_pos) => {
                        if mouse.coords != last_pos {
                            has_activity = true;
                            last_mouse_pos = Some(mouse.coords);
                        }
                    }
                    None => {
                        // Initialize position on first run
                        last_mouse_pos = Some(mouse.coords);
                    }
                }

                // Check for keyboard activity (any key pressed)
                // This detects system-wide keyboard input, even in other apps
                if !current_keys.is_empty() && current_keys != last_keys {
                    has_activity = true;
                    last_keys = current_keys.clone();
                } else if last_keys.is_empty() && !current_keys.is_empty() {
                    // Keys just got pressed
                    has_activity = true;
                    last_keys = current_keys.clone();
                } else if !last_keys.is_empty() && current_keys.is_empty() {
                    // All keys released, update state but don't count as new activity
                    last_keys = current_keys.clone();
                } else {
                    // Update last_keys to current state
                    last_keys = current_keys.clone();
                }

                // Check for mouse button presses (system-wide)
                if mouse.button_pressed {
                    has_activity = true;
                }

                // Update last activity time if any activity was detected
                if has_activity {
                    *last_event_time.lock().unwrap() = Instant::now();
                }

                // Poll more frequently for better responsiveness
                sleep(Duration::from_millis(50)).await; // Poll every 50ms for better tracking
            }
        });
    }
}

