# iOS scene lifecycle

The template uses one `UIWindowScene` on iOS 13 and later. `AppDelegate` performs
process-level initialization and saves the launch options. `SceneDelegate`
creates the window, then calls `startGameWithWindow:` to create the game view
and start the engine once. `AppDelegate.window` remains available to the engine
and native plugins. A scene reconnection reuses the window and game view.

Scene activity and foreground/background callbacks forward to the existing
AppDelegate methods, preserving SDKWrapper and AppDelegateBridge integration.
UIKit no longer calls those application callbacks itself after scene adoption.
The initial scene foreground event does not forward the legacy SDK foreground
callback; that callback is sent only after entering the background. This state
survives scene reconnection. The pre-iOS-13 callbacks remain unchanged.
The legacy window-creation path remains for projects targeting iOS before 13;
the current template's minimum target is still iOS 13.

## Updating an existing exported project

Updating the engine alone does not replace a project's customized native files.
Merge these template changes into the exported project's iOS directory:

- `AppDelegate.h` and `AppDelegate.mm`: deferred engine startup and window access.
- `SceneDelegate.h` and `SceneDelegate.mm`: window creation and scene callbacks.
- `Info.plist`: merge `UIApplicationSceneManifest`, keeping the project's other keys.

Regenerate the Xcode project through the normal CMake build. The engine's
`templates/cmake/apple.cmake` includes the new scene sources when present; old
exports without those files remain buildable. A custom build system must add
both scene files to the application target.

Keep the engine changes to Screen, SystemWindow, View and AppDelegateBridge with
the template changes. Screen reads orientation from the game's window scene,
handles Unknown without aborting, and keeps the legacy lookup for old exports.
The native window size and Metal drawable follow the game view's dimensions.

Existing `application:openURL:options:` and
`application:continueUserActivity:restorationHandler:` integrations receive
forwarded scene events, including initial connection options. SDK code that
reads URLs only from `didFinishLaunchingWithOptions:` must adopt these callbacks.
Quick Actions forward to
`application:performActionForShortcutItem:completionHandler:`. Cold-start actions
are held until the scene becomes active and consumed once; warm actions forward
the system completion handler. Without an application handler, completion reports
`NO`. SDKs that only inspect the shortcut in launch options must adopt this callback.
Custom notification launch handling and other scene connection options should
be reviewed in projects that use them.

This migration does not change simulator CPU architectures. A full game still
needs launch, rotation, touch, rendering, background/resume and SDK testing on
supported devices.
