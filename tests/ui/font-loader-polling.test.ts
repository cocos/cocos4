import { loadFont } from '../../cocos/2d/utils/font-loader';

test('Web polling observes freshly loaded font metrics', () => {
    jest.useFakeTimers();
    const callback = jest.fn();
    const createElement = document.createElement.bind(document);
    const nodes: HTMLElement[] = [];
    let loaded = false;
    const measuredFonts: string[] = [];
    const context = {
        font: '10px sans-serif',
        measureText: jest.fn(() => {
            measuredFonts.push(context.font);
            return { width: loaded ? 200 : 100 };
        }),
    };
    const canvas = createElement('canvas');
    const getContext = jest.spyOn(canvas, 'getContext').mockImplementation((() => context) as unknown as typeof canvas.getContext);
    const create = jest.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
        if (tag === 'canvas') return canvas;
        const element = createElement(tag);
        nodes.push(element);
        return element;
    }) as typeof document.createElement);

    try {
        loadFont('fonts/Web Family 3.0.ttf', {}, callback);
        const style = nodes.find((node) => node.tagName === 'STYLE')!;
        const preload = nodes.find((node) => node.tagName === 'DIV')!;
        expect(style.textContent).toBe('@font-face { font-family:"Web Family 3.0_LABEL"; src:url("fonts/Web Family 3.0.ttf");}');
        expect(preload.style.fontFamily).toBe('"Web Family 3.0_LABEL"');
        expect(measuredFonts).toEqual(['40px "Web Family 3.0_LABEL"']);
        expect(callback).not.toHaveBeenCalled();

        // Measuring again must observe the loaded font, rather than reuse a cached fallback width.
        loaded = true;
        jest.advanceTimersByTime(100);
        expect(measuredFonts).toEqual(['40px "Web Family 3.0_LABEL"', '40px "Web Family 3.0_LABEL"']);
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith(null, 'Web Family 3.0_LABEL');
        expect(jest.getTimerCount()).toBe(0);
    } finally {
        create.mockRestore();
        getContext.mockRestore();
        nodes.forEach((node) => node.remove());
        jest.useRealTimers();
    }
});
