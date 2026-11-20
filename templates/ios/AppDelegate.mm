/****************************************************************************
 Copyright (c) 2010-2013 cocos2d-x.org
 Copyright (c) 2013-2016 Chukong Technologies Inc.
 Copyright (c) 2017-2022 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated engine source code (the "Software"), a limited,
 worldwide, royalty-free, non-assignable, revocable and non-exclusive license
 to use Cocos Creator solely to develop games on your target platforms. You shall
 not use Cocos Creator software for developing other software or tools that's
 used for developing games. You are not granted to publish, distribute,
 sublicense, and/or sell copies of Cocos Creator.

 The software or tools in this License Agreement are licensed, not sold.
 Xiamen Yaji Software Co., Ltd. reserves all rights not expressly granted to you.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
****************************************************************************/

#import "AppDelegate.h"
#import "ViewController.h"
#import "View.h"

#import "platform/ios/AppDelegateBridge.h"
#import "service/SDKWrapper.h"

@interface AppDelegate () {
    NSDictionary *_launchOptions;
    BOOL _engineStarted;
    BOOL _wasInBackground;
}
@end

@implementation AppDelegate
@synthesize window;
@synthesize appDelegateBridge;

#pragma mark -
#pragma mark Application lifecycle

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {
    [[SDKWrapper shared] application:application didFinishLaunchingWithOptions:launchOptions];
    appDelegateBridge = [[AppDelegateBridge alloc] init];
    _launchOptions = [launchOptions copy];

    if (@available(iOS 13.0, *)) {
        // SceneDelegate creates the window before starting the engine.
    } else {
        UIWindow *gameWindow = [[UIWindow alloc] initWithFrame:UIScreen.mainScreen.bounds];
        [self startGameWithWindow:gameWindow];
        [gameWindow release];
    }
    return YES;
}

- (void)startGameWithWindow:(UIWindow *)gameWindow {
    // Keep the window accessible to SystemWindow, Screen and native plugins.
    self.window = gameWindow;
    if (_engineStarted) {
        // A disconnected scene can reconnect without restarting the game.
        [self.window makeKeyAndVisible];
        return;
    }

    // Should create view controller first, cc::Application will use it.
    CGRect bounds = self.window.bounds;
    _viewController                           = [[ViewController alloc] init];
    View *gameView                            = [[View alloc] initWithFrame:bounds];
    _viewController.view                      = gameView;
    [gameView release];
    _viewController.view.contentScaleFactor   = self.window.screen.nativeScale;
    _viewController.view.multipleTouchEnabled = true;
    [self.window setRootViewController:_viewController];

    [self.window makeKeyAndVisible];
    [self.window layoutIfNeeded];
    _engineStarted = YES;
    [appDelegateBridge application:UIApplication.sharedApplication didFinishLaunchingWithOptions:_launchOptions];
    [_launchOptions release];
    _launchOptions = nil;
}

- (void)applicationWillResignActive:(UIApplication *)application {
    /*
     Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
     Use this method to pause ongoing tasks, disable timers, and throttle down OpenGL ES frame rates. Games should use this method to pause the game.
     */
    [[SDKWrapper shared] applicationWillResignActive:application];
    if (_engineStarted) {
        [appDelegateBridge applicationWillResignActive:application];
    }
}

- (void)applicationDidBecomeActive:(UIApplication *)application {
    /*
     Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
     */
    [[SDKWrapper shared] applicationDidBecomeActive:application];
    if (_engineStarted) {
        [appDelegateBridge applicationDidBecomeActive:application];
    }
}

- (void)applicationDidEnterBackground:(UIApplication *)application {
    /*
     Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
     If your application supports background execution, called instead of applicationWillTerminate: when the user quits.
     */
    _wasInBackground = YES;
    [[SDKWrapper shared] applicationDidEnterBackground:application];
}

- (void)applicationWillEnterForeground:(UIApplication *)application {
    /*
     Called as part of  transition from the background to the inactive state: here you can undo many of the changes made on entering the background.
     */
    // Scenes also enter the foreground on initial connection. Preserve the
    // legacy SDK callback, which only reports a return from the background.
    // Keep this state on AppDelegate so it survives scene disconnection.
    if (@available(iOS 13.0, *)) {
        if (!_wasInBackground) {
            return;
        }
    }
    _wasInBackground = NO;
    [[SDKWrapper shared] applicationWillEnterForeground:application];
}

- (void)applicationWillTerminate:(UIApplication *)application {
    [[SDKWrapper shared] applicationWillTerminate:application];
    if (_engineStarted) {
        [appDelegateBridge applicationWillTerminate:application];
        _engineStarted = NO;
    }
}

#pragma mark -
#pragma mark Memory management

- (void)applicationDidReceiveMemoryWarning:(UIApplication *)application {
    [[SDKWrapper shared] applicationDidReceiveMemoryWarning:application];
}

- (void)dealloc {
    [_launchOptions release];
    [_viewController release];
    [appDelegateBridge release];
    [window release];
    [super dealloc];
}

@end
