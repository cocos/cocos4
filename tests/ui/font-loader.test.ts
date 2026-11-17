import { TTFFont } from '../../cocos/2d/assets/ttf-font';
import { TTFUtils } from '../../cocos/2d/assembler/label/ttfUtils';
import type { Label } from '../../cocos/2d/components/label';
import { buildFontDesc } from '../../cocos/2d/utils/font-family';
import { getFontFamily, loadFont } from '../../cocos/2d/utils/font-loader';
import factory from '../../cocos/asset/asset-manager/factory';

test.each([
    ['fonts/Alibaba PuHuiTi 3.0.ttf', 'Alibaba PuHuiTi 3.0_LABEL'],
    ['fonts/Font3.0.ttf', 'Font3.0_LABEL'],
    ['fonts/A,B.ttf', 'A,B_LABEL'],
])('Web loader returns a raw alias for %s', (url, expected) => {
    expect(getFontFamily(url)).toBe(expected);
});

test.each([
    // URL, raw asset alias, expected CSS family for registration and drawing.
    ['fonts/Web Family 3.0.ttf', 'Web Family 3.0_LABEL', '"Web Family 3.0_LABEL"'],
    ['fonts/KenneyPixel.ttf', 'KenneyPixel_LABEL', 'KenneyPixel_LABEL'],
    ['fonts/sans-serif.ttf', 'sans-serif_LABEL', 'sans-serif_LABEL'],
    ['fonts/My Font.ttf', 'My Font_LABEL', '"My Font_LABEL"'],
    ['fonts/中文字体.ttf', '中文字体_LABEL', '"中文字体_LABEL"'],
])('Web registration, font loading and the TTF Label descriptor agree for %s', async (url, alias, familyCss) => {
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
        const font = await new Promise<TTFFont>((resolve, reject) => {
            loadFont(url, {}, (error, family) => {
                if (error) {
                    reject(error);
                    return;
                }
                callback(family);
                factory.create(url, family, '.ttf', { cacheAsset: false }, (err, asset) => {
                    if (err) reject(err);
                    else if (asset instanceof TTFFont) resolve(asset);
                    else reject(new Error('Expected the font factory to return a TTFFont'));
                });
            });
        });
        const style = nodes.find((node) => node.tagName === 'STYLE')!;
        const preload = nodes.find((node) => node.tagName === 'DIV')!;
        expect(style.textContent).toBe(`@font-face { font-family:${familyCss}; src:url("${url}");}`);
        expect(preload.style.fontFamily).toBe(familyCss);
        expect(load).toHaveBeenCalledWith(`40px ${familyCss}`);
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith(alias);
        expect(font._nativeAsset).toBe(alias);
        const label: Pick<Label, 'font' | 'useSystemFont' | 'fontFamily'> = { font, useSystemFont: false, fontFamily: 'Arial' };
        expect(buildFontDesc(40, new TTFUtils()._updateFontFamily(label as Label))).toBe(`40px ${familyCss}`);
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
