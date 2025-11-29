# System-Wide Activity Tracking Permissions

## macOS

For system-wide mouse and keyboard tracking to work on macOS, you need to grant **Accessibility permissions** to the app.

### How to Grant Permissions:

1. Open **System Settings** (or System Preferences on older macOS)
2. Go to **Privacy & Security** > **Accessibility**
3. Find your app (it should appear as "Anvesana" or "my-tauri-app")
4. Toggle the switch to enable it

### What Happens Without Permissions:

Without Accessibility permissions, activity tracking will only work within the app window. Mouse movements and keyboard input in other applications won't be detected.

### Alternative:

If the app doesn't appear in the Accessibility list automatically, you may need to:
1. Run the app once
2. macOS will prompt you to grant permissions
3. Or manually add it via the "+" button in System Settings

## Windows & Linux

On Windows and Linux, system-wide tracking should work without additional permissions, though administrative privileges may be required in some cases.

