describe('Web ScreenAdapter resize detection', () => {
    it('emits one resize when the SubFrame client size changes without inline style changes', () => {
        /// @case
        /// 1. A SubFrame uses unchanged 100% inline dimensions.
        /// 2. Its actual client size changes during a browser resize.
        /// @expect
        /// The new physical size is emitted exactly once, and duplicate resize events are ignored.
        document.body.innerHTML = `
            <div id="GameDiv" style="width: 100%; height: 100%;">
                <div id="Cocos3dGameContainer">
                    <canvas id="GameCanvas"></canvas>
                </div>
            </div>
        `;

        const gameFrame = document.getElementById('GameDiv') as HTMLDivElement;
        let frameWidth = 800;
        let frameHeight = 600;
        Object.defineProperties(gameFrame, {
            clientWidth: {
                configurable: true,
                get: (): number => frameWidth,
            },
            clientHeight: {
                configurable: true,
                get: (): number => frameHeight,
            },
        });

        jest.resetModules();
        jest.doMock('internal:constants', () => ({
            ...jest.requireActual('../constants-for-test'),
            TEST: false,
        }), { virtual: true });
        jest.doMock('pal/system-info', () => ({
            systemInfo: {
                isMobile: false,
                os: '',
            },
        }), { virtual: true });

        jest.isolateModules(() => {
            const { screenAdapter } = require('../../pal/screen-adapter/web/screen-adapter') as
                typeof import('../../pal/screen-adapter/web/screen-adapter');
            screenAdapter.init({
                configOrientation: 'auto',
                exactFitScreen: false,
                isHeadlessMode: false,
            }, jest.fn());

            const onWindowResize = jest.fn();
            screenAdapter.on('window-resize', onWindowResize);

            frameWidth = 640;
            frameHeight = 360;
            window.dispatchEvent(new Event('resize'));

            const dpr = screenAdapter.devicePixelRatio;
            expect(gameFrame.style.width).toBe('100%');
            expect(gameFrame.style.height).toBe('100%');
            expect(screenAdapter.windowSize.width).toBe(640 * dpr);
            expect(screenAdapter.windowSize.height).toBe(360 * dpr);
            expect(onWindowResize).toHaveBeenCalledTimes(1);
            expect(onWindowResize.mock.calls[0].slice(0, 2)).toEqual([640 * dpr, 360 * dpr]);

            window.dispatchEvent(new Event('resize'));
            expect(onWindowResize).toHaveBeenCalledTimes(1);

            screenAdapter.off('window-resize', onWindowResize);
        });
    });
});
