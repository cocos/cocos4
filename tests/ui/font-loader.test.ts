import { getFontFamily, loadFont } from '../../cocos/2d/utils/font-loader';

test.each([
    ['fonts/Alibaba PuHuiTi 3.0.ttf', 'Alibaba PuHuiTi 3.0_LABEL'],
    ['fonts/Font3.0.ttf', 'Font3.0_LABEL'],
    ['fonts/A,B.ttf', 'A,B_LABEL'],
])('Web loader returns a raw alias for %s', (url, expected) => {
    expect(getFontFamily(url)).toBe(expected);
});

test.each([
    ['fonts/Web Family 3.0.ttf', '"Web Family 3.0_LABEL"'],
    ['fonts/KenneyPixel.ttf', 'KenneyPixel_LABEL'],
])('Web registration and FontFaceSet loading agree for %s', async (url, familyCss) => {
    jest.useFakeTimers();
    const faceDescriptor = Object.getOwnPropertyDescriptor(window, 'FontFace');
    const fontsDescriptor = Object.getOwnPropertyDescriptor(document, 'fonts');
    const load = jest.fn().mockResolvedValue([{}]);
    Object.defineProperty(window, 'FontFace', { value: class {}, configurable: true });
    Object.defineProperty(document, 'fonts', { value: { load }, configurable: true });
    const callback = jest.fn();
    const createElement = document.createElement.bind(document);
    const nodes: HTMLElement[] = [];
    const canvas = createElement('canvas');
    const getContext = jest.spyOn(canvas, 'getContext').mockImplementation((() => ({})) as unknown as typeof canvas.getContext);
    const create = jest.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
        if (tag === 'canvas') return canvas;
        const element = createElement(tag);
        nodes.push(element);
        return element;
    }) as typeof document.createElement);

    try {
        await new Promise<void>((resolve, reject) => {
            loadFont(url, {}, (error, family) => {
                if (error) {
                    reject(error);
                    return;
                }
                callback(family);
                resolve();
            });
        });
        const style = nodes.find((node) => node.tagName === 'STYLE')!;
        const preload = nodes.find((node) => node.tagName === 'DIV')!;
        expect(style.textContent).toBe(`@font-face { font-family:${familyCss}; src:url("${url}");}`);
        expect(preload.style.fontFamily).toBe(familyCss);
        expect(load).toHaveBeenCalledWith(`40px ${familyCss}`);
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith(getFontFamily(url));
        expect(jest.getTimerCount()).toBe(0);
    } finally {
        create.mockRestore();
        getContext.mockRestore();
        nodes.forEach((node) => node.remove());
        if (faceDescriptor) Object.defineProperty(window, 'FontFace', faceDescriptor);
        else Reflect.deleteProperty(window, 'FontFace');
        if (fontsDescriptor) Object.defineProperty(document, 'fonts', fontsDescriptor);
        else Reflect.deleteProperty(document, 'fonts');
        jest.useRealTimers();
    }
});
