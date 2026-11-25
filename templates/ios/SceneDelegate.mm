/****************************************************************************
 Copyright (c) 2010-2013 cocos2d-x.org
 Copyright (c) 2013-2016 Chukong Technologies Inc.
 Copyright (c) 2017-2022 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated engine source code (the "Software"), a limited,
 worldwide, royalty-free, non-assignable, revocable and non-exclusive license
 to use Cocos Creator solely to develop games on your target platforms. You
shall not use Cocos Creator software for developing other software or tools
that's used for developing games. You are not granted to publish, distribute,
 sublicense, and/or sell copies of Cocos Creator.

 The software or tools in this License Agreement are licensed, not sold.
 Xiamen Yaji Software Co., Ltd. reserves all rights not expressly granted to
you.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
****************************************************************************/

#import "SceneDelegate.h"
#import "AppDelegate.h"

@interface SceneDelegate ()
@property(nonatomic, retain) UIApplicationShortcutItem *pendingShortcutItem;
@end

@implementation SceneDelegate

- (void)scene:(UIScene *)scene willConnectToSession:(UISceneSession *)session options:(UISceneConnectionOptions *)connectionOptions {
    if (![scene isKindOfClass:UIWindowScene.class] || ![session.role isEqualToString:UIWindowSceneSessionRoleApplication]) {
        return;
    }

    AppDelegate *delegate = (AppDelegate *)UIApplication.sharedApplication.delegate;
    UIWindowScene *windowScene = (UIWindowScene *)scene;
    if (delegate.window) {
        // Retain the game's view and rendering surface across scene reconnections.
        self.window = delegate.window;
        self.window.windowScene = windowScene;
    } else {
        UIWindow *gameWindow = [[UIWindow alloc] initWithWindowScene:windowScene];
        self.window = gameWindow;
        [gameWindow release];
    }
    [delegate startGameWithWindow:self.window];
    // A cold-start shortcut is handled once the scene is active and the game is ready.
    self.pendingShortcutItem = connectionOptions.shortcutItem;

    // Scene-based launches deliver URLs and user activities here, not in launchOptions.
    [self scene:scene openURLContexts:connectionOptions.URLContexts];
    for (NSUserActivity *activity in connectionOptions.userActivities) {
        [self scene:scene continueUserActivity:activity];
    }
}

- (void)sceneDidDisconnect:(UIScene *)scene {
    // The engine is process-wide. Disconnecting a scene must not destroy it.
    self.pendingShortcutItem = nil;
    self.window.windowScene = nil;
    self.window = nil;
}

- (void)sceneDidBecomeActive:(UIScene *)scene {
    if (self.window) {
        AppDelegate *delegate = (AppDelegate *)UIApplication.sharedApplication.delegate;
        [delegate applicationDidBecomeActive:UIApplication.sharedApplication];
        if (self.pendingShortcutItem) {
            UIApplicationShortcutItem *shortcutItem = [self.pendingShortcutItem retain];
            // Clear before dispatch, so subsequent activations cannot replay the action.
            self.pendingShortcutItem = nil;
            [self windowScene:(UIWindowScene *)scene performActionForShortcutItem:shortcutItem completionHandler:^(BOOL succeeded) {
                // Initial connection options have no UIKit completion handler.
            }];
            [shortcutItem release];
        }
    }
}

- (void)sceneWillResignActive:(UIScene *)scene {
    if (self.window) {
        AppDelegate *delegate = (AppDelegate *)UIApplication.sharedApplication.delegate;
        [delegate applicationWillResignActive:UIApplication.sharedApplication];
    }
}

- (void)sceneDidEnterBackground:(UIScene *)scene {
    if (self.window) {
        AppDelegate *delegate = (AppDelegate *)UIApplication.sharedApplication.delegate;
        [delegate applicationDidEnterBackground:UIApplication.sharedApplication];
    }
}

- (void)sceneWillEnterForeground:(UIScene *)scene {
    if (self.window) {
        AppDelegate *delegate = (AppDelegate *)UIApplication.sharedApplication.delegate;
        [delegate applicationWillEnterForeground:UIApplication.sharedApplication];
    }
}

- (void)scene:(UIScene *)scene openURLContexts:(NSSet<UIOpenURLContext *> *)URLContexts {
    id<UIApplicationDelegate> delegate = UIApplication.sharedApplication.delegate;
    if (!self.window || ![delegate respondsToSelector:@selector(application:openURL:options:)]) {
        return;
    }
    for (UIOpenURLContext *context in URLContexts) {
        NSMutableDictionary *options = [NSMutableDictionary dictionary];
        options[UIApplicationOpenURLOptionsOpenInPlaceKey] = @(context.options.openInPlace);
        if (context.options.sourceApplication) {
            options[UIApplicationOpenURLOptionsSourceApplicationKey] = context.options.sourceApplication;
        }
        if (context.options.annotation) {
            options[UIApplicationOpenURLOptionsAnnotationKey] = context.options.annotation;
        }
        [delegate application:UIApplication.sharedApplication openURL:context.URL options:options];
    }
}

- (void)scene:(UIScene *)scene continueUserActivity:(NSUserActivity *)userActivity {
    id<UIApplicationDelegate> delegate = UIApplication.sharedApplication.delegate;
    if (self.window && [delegate respondsToSelector:@selector(application:continueUserActivity:restorationHandler:)]) {
        [delegate application:UIApplication.sharedApplication continueUserActivity:userActivity restorationHandler:^(NSArray<id<UIUserActivityRestoring>> *restorableObjects) {
            for (id<UIUserActivityRestoring> object in restorableObjects) {
                [object restoreUserActivityState:userActivity];
            }
        }];
    }
}

- (void)windowScene:(UIWindowScene *)windowScene performActionForShortcutItem:(UIApplicationShortcutItem *)shortcutItem completionHandler:(void (^)(BOOL succeeded))completionHandler {
    id<UIApplicationDelegate> delegate = UIApplication.sharedApplication.delegate;
    if (self.window && [delegate respondsToSelector:@selector(application:performActionForShortcutItem:completionHandler:)]) {
        [delegate application:UIApplication.sharedApplication performActionForShortcutItem:shortcutItem completionHandler:completionHandler];
    } else {
        completionHandler(NO);
    }
}

- (void)dealloc {
    [_pendingShortcutItem release];
    [_window release];
    [super dealloc];
}

@end
