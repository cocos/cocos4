import { screenAdapter } from 'pal/screen-adapter';
import * as constants from 'internal:constants';
import { Screen } from '../../cocos/core/platform/screen';
import { MaxDPR } from '../../cocos/core/platform';
import { Settings, settings, SettingsCategory } from '../../cocos/core/settings';
import { AsyncDelegate } from '../../cocos/core/event/async-delegate';
import * as debug from '../../cocos/core/platform/debug';

const adapter = screenAdapter as unknown as {
    maxDevicePixelRatio?: number | null;
    init: jest.Mock;
};
const originalAdapterPrototype = Object.getPrototypeOf(screenAdapter);
const flags = constants as unknown as Record<string, boolean | undefined>;
const platformKeys = ['HTML5', 'NATIVE', 'MINIGAME', 'RUNTIME_BASED', 'NODEJS'];
const originalFlags: typeof flags = {};
for (const key of platformKeys) originalFlags[key] = flags[key];

describe('Screen startup maximum DPR setting', () => {
    let startupSettings: Settings;
    let querySpy: jest.SpyInstance;
    let initSpy: jest.SpyInstance;
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
        Object.assign(flags, { HTML5: true, NATIVE: false, MINIGAME: false, RUNTIME_BASED: false, NODEJS: false });
        startupSettings = new Settings();
        // Exercise real Settings precedence without modifying the bootstrapped engine's settings.
        querySpy = jest.spyOn(settings, 'querySettings').mockImplementation(startupSettings.querySettings.bind(startupSettings));
        warnSpy = jest.spyOn(debug, 'warnID').mockImplementation(() => {});
        Object.defineProperty(adapter, 'maxDevicePixelRatio', { value: null, writable: true, configurable: true });
        initSpy = jest.spyOn(screenAdapter, 'init').mockImplementation(options => {
            adapter.maxDevicePixelRatio = options.maxDevicePixelRatio ?? null;
        });
    });

    afterEach(() => {
        Object.assign(flags, originalFlags);
        Object.setPrototypeOf(screenAdapter, originalAdapterPrototype);
        querySpy.mockRestore();
        initSpy.mockRestore();
        warnSpy.mockRestore();
        delete adapter.maxDevicePixelRatio;
    });

    function useAdapterWithoutDprCapability (): void {
        const descriptors = Object.getOwnPropertyDescriptors(originalAdapterPrototype);
        delete descriptors.maxDevicePixelRatio;
        Object.setPrototypeOf(screenAdapter, Object.create(Object.getPrototypeOf(originalAdapterPrototype), descriptors));
        delete adapter.maxDevicePixelRatio;
        initSpy.mockImplementation(() => {});
        expect('maxDevicePixelRatio' in screenAdapter).toBe(false);
    }

    test('omitted setting preserves the adapter default without injecting a cap', () => {
        new Screen().init();
        expect(adapter.init.mock.calls[0][0]).not.toHaveProperty('maxDevicePixelRatio');
        expect(warnSpy).not.toHaveBeenCalled();
    });

    test.each([null, undefined])('treats %s as the platform default', value => {
        startupSettings.overrideSettings(SettingsCategory.SCREEN, 'maxDevicePixelRatio', value);
        new Screen().init();
        expect(adapter.init.mock.calls[0][0]).not.toHaveProperty('maxDevicePixelRatio');
        expect(warnSpy).not.toHaveBeenCalled();
    });

    test.each([
        [MaxDPR.Performance, 1],
        [MaxDPR.Balanced, 2],
        [MaxDPR.Quality, 4],
    ])('passes public preset %s as the serialized numeric cap %s', async (preset, expected) => {
        await startupSettings.init('', { screen: { maxDevicePixelRatio: preset } });
        expect(adapter.init).not.toHaveBeenCalled();
        new Screen().init();
        expect(adapter.init.mock.calls[0][0].maxDevicePixelRatio).toBe(expected);
        expect(adapter.maxDevicePixelRatio).toBe(expected);
    });

    test.each([2.5, 3.25])('continues to accept custom cap %s outside the presets', maximum => {
        startupSettings.overrideSettings(SettingsCategory.SCREEN, 'maxDevicePixelRatio', maximum);
        new Screen().init();
        expect(adapter.init.mock.calls[0][0].maxDevicePixelRatio).toBe(maximum);
    });

    test('reads an exported screen setting', () => {
        // Simulate the settings.json data loaded by Settings.init.
        Object.assign(startupSettings, { _settings: { screen: { maxDevicePixelRatio: 2.5 } } });
        new Screen().init();
        expect(adapter.init.mock.calls[0][0].maxDevicePixelRatio).toBe(2.5);
    });

    test('code overrides take priority without discarding other exported settings', async () => {
        Object.assign(startupSettings, {
            _settings: {
                screen: { maxDevicePixelRatio: 2, exactFitScreen: false, orientation: 'landscape' },
                rendering: { renderMode: 3 },
            },
        });
        await startupSettings.init('', { screen: { maxDevicePixelRatio: MaxDPR.Quality } });
        new Screen().init();
        expect(adapter.init.mock.calls[0][0]).toEqual({
            exactFitScreen: false, configOrientation: 'landscape', isHeadlessMode: true, maxDevicePixelRatio: 4,
        });
    });

    test('a null code override clears an exported cap and retains the default strategy', async () => {
        Object.assign(startupSettings, { _settings: { screen: { maxDevicePixelRatio: 4 } } });
        await startupSettings.init('', { screen: { maxDevicePixelRatio: null } });
        new Screen().init();
        expect(adapter.init.mock.calls[0][0]).not.toHaveProperty('maxDevicePixelRatio');
    });

    test('a post-base startup delegate can override the setting before Screen.init', async () => {
        await startupSettings.init('', { screen: { maxDevicePixelRatio: 2 } });
        const startupDelegate = new AsyncDelegate();
        startupDelegate.add(() => {
            startupSettings.overrideSettings(SettingsCategory.SCREEN, 'maxDevicePixelRatio', 3.25);
        });
        await Promise.resolve().then(() => startupDelegate.dispatch()).then(() => new Screen().init());
        expect(adapter.init.mock.calls[0][0].maxDevicePixelRatio).toBe(3.25);
    });

    test.each([0, -1, 0.5, NaN, Infinity, -Infinity, '3', false, {}, []])('forwards %s unchanged and propagates PAL validation errors', value => {
        const validationError = new RangeError(debug.getError(9204));
        initSpy.mockImplementation(() => { throw validationError; });
        startupSettings.overrideSettings(SettingsCategory.SCREEN, 'maxDevicePixelRatio', value);
        let caught: unknown;
        try { new Screen().init(); } catch (error) { caught = error; }
        expect(caught).toBe(validationError);
        expect(adapter.init).toHaveBeenCalledTimes(1);
        expect(adapter.init.mock.calls[0][0].maxDevicePixelRatio).toBe(value);
        expect(adapter.maxDevicePixelRatio).toBeNull();
    });

    test('changing Settings after initialization does not reconfigure PAL', () => {
        startupSettings.overrideSettings(SettingsCategory.SCREEN, 'maxDevicePixelRatio', 3.25);
        new Screen().init();
        startupSettings.overrideSettings(SettingsCategory.SCREEN, 'maxDevicePixelRatio', 4);
        expect(settings.querySettings(SettingsCategory.SCREEN, 'maxDevicePixelRatio')).toBe(4);
        expect(adapter.init).toHaveBeenCalledTimes(1);
        expect(adapter.maxDevicePixelRatio).toBe(3.25);
    });

    test('allows adapters without the DPR capability to ignore the setting', () => {
        useAdapterWithoutDprCapability();
        startupSettings.overrideSettings(SettingsCategory.SCREEN, 'maxDevicePixelRatio', 3);
        expect(() => new Screen().init()).not.toThrow();
        expect(adapter.init).toHaveBeenCalledTimes(1);
        expect(adapter.init.mock.calls[0][0].maxDevicePixelRatio).toBe(3);
        expect(warnSpy).not.toHaveBeenCalled();
    });

    test('default startup does not require a configured cap readback', () => {
        adapter.maxDevicePixelRatio = undefined;
        expect(() => new Screen().init()).not.toThrow();
    });

    test('rejects PAL that advertises properties but ignores the setting', () => {
        adapter.init.mockImplementation(() => {});
        startupSettings.overrideSettings(SettingsCategory.SCREEN, 'maxDevicePixelRatio', 3);
        expect(() => new Screen().init()).toThrow(debug.getError(9205));
    });

    test.each([
        ['non-HTML5', { HTML5: false }],
        ['Native', { NATIVE: true }],
        ['mini game', { MINIGAME: true }],
        ['runtime-based mini game', { RUNTIME_BASED: true }],
        ['Node.js', { NODEJS: true }],
    ])('passes the startup cap to a supporting PAL on %s without platform filtering', async (_name, overrides) => {
        Object.assign(flags, overrides);
        const originalDpr = new Screen().devicePixelRatio;
        await startupSettings.init('', { screen: { maxDevicePixelRatio: 3.25 } });
        const screen = new Screen();
        expect(() => screen.init()).not.toThrow();
        expect(warnSpy).not.toHaveBeenCalled();
        expect(screen.devicePixelRatio).toBe(originalDpr);
        expect(adapter.init.mock.calls[0][0].maxDevicePixelRatio).toBe(3.25);
        expect(adapter.maxDevicePixelRatio).toBe(3.25);
    });

    test('does not warn for an unconfigured non-Web platform', () => {
        flags.NATIVE = true;
        new Screen().init();
        expect(warnSpy).not.toHaveBeenCalled();
        expect(adapter.init.mock.calls[0][0]).not.toHaveProperty('maxDevicePixelRatio');
    });

    test('an unsupported PAL can ignore invalid input without engine validation or warnings', () => {
        flags.NATIVE = true;
        useAdapterWithoutDprCapability();
        startupSettings.overrideSettings(SettingsCategory.SCREEN, 'maxDevicePixelRatio', NaN);
        expect(() => new Screen().init()).not.toThrow();
        expect(adapter.init.mock.calls[0][0].maxDevicePixelRatio).toBeNaN();
        expect(warnSpy).not.toHaveBeenCalled();
    });
});
