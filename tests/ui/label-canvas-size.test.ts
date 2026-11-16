/*
 Copyright (c) 2026 Xiamen Yaji Software Co., Ltd.

 https://www.cocos.com/

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
*/

/**
 * Label 文字画布的尺寸必须由引擎取整成整数。
 *
 * `HTMLCanvasElement.width/height` 是 `unsigned long`，规范要求截断小数，但宿主实现可能四舍五入。
 * 而 Label 的四边形一直使用浮点的排版尺寸（例如 56.7px），于是同一段文字在"四舍五入"的宿主上会多出
 * 一行纹理行，被拉长并整体偏移约 0.7px —— 这类差异只会出现在个别设备/宿主上，表现为截图比对失败。
 *
 * 因此 `TextProcessing`（TTF 路径）与 `LetterTexture`（CHAR 缓存路径）都在赋值前自行截断，
 * 让纹理尺寸与宿主实现无关。下面的用例用两种"宿主转换行为"跑同一条管线，结果必须一致。
 */

import { CanvasPool, LetterAtlas, shareLabelInfo } from '../../cocos/2d/assembler/label/font-utils';
import { TextLayout } from '../../cocos/2d/assembler/label/text-layout';
import { TextOutputLayoutData, TextOutputRenderData } from '../../cocos/2d/assembler/label/text-output-data';
import type { TextProcessing as TextProcessingSingleton } from '../../cocos/2d/assembler/label/text-processing';
import { TextStyle } from '../../cocos/2d/assembler/label/text-style';
import { HorizontalTextAlignment, Overflow, VerticalTextAlignment } from '../../cocos/2d/components/label';
import { DEFAULT_FONT_FAMILY } from '../../cocos/2d/utils/font-family';

/** 模拟两种宿主对 `canvas.width/height = x.y` 的转换行为。 */
type SizeConversion = 'truncate' | 'round';

interface IFakeCanvas {
    canvas: { width: number; height: number };
    context: Record<string, unknown>;
    /** 实际赋给 `canvas.width` 的值序列（宿主转换之前） */
    assignedWidths: number[];
    /** 实际赋给 `canvas.height` 的值序列（宿主转换之前） */
    assignedHeights: number[];
}

function createFakeCanvas (conversion: SizeConversion): IFakeCanvas {
    const convert = (value: number): number => (conversion === 'round' ? Math.round(value) : Math.trunc(value));
    let width = 0;
    let height = 0;
    const assignedWidths: number[] = [];
    const assignedHeights: number[] = [];
    const canvas = {
        get width (): number { return width; },
        set width (value: number) {
            assignedWidths.push(value);
            width = convert(value);
        },
        get height (): number { return height; },
        set height (value: number) {
            assignedHeights.push(value);
            height = convert(value);
        },
    };
    const context: Record<string, unknown> = {
        font: '',
        textAlign: '',
        textBaseline: '',
        lineJoin: '',
        fillStyle: '',
        strokeStyle: '',
        shadowColor: '',
        lineWidth: 1,
        shadowBlur: 0,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        // 确定性度量：每字符 20 设备像素
        measureText: (text: string): { width: number } => ({ width: 20 * text.length }),
        clearRect: (): void => {},
        fillRect: (): void => {},
        fillText: (): void => {},
        strokeText: (): void => {},
        save: (): void => {},
        restore: (): void => {},
        beginPath: (): void => {},
        moveTo: (): void => {},
        lineTo: (): void => {},
        stroke: (): void => {},
    };
    return { canvas, context, assignedWidths, assignedHeights };
}

let textProcessingCtor: typeof TextProcessingSingleton | null = null;

function getTextProcessingCtor (): typeof TextProcessingSingleton {
    if (!textProcessingCtor) {
        // text-processing 在模块加载时会创建 TextProcessing.instance（内部创建画布），
        // 先给 jsdom 一个空实现避免加载期报错。
        const getContext = jest.spyOn(HTMLCanvasElement.prototype, 'getContext')
            .mockReturnValue(createFakeCanvas('truncate').context as unknown as CanvasRenderingContext2D);
        const textProcessingModule: typeof import('../../cocos/2d/assembler/label/text-processing')
            = require('../../cocos/2d/assembler/label/text-processing');
        textProcessingCtor = textProcessingModule.TextProcessing;
        getContext.mockRestore();
    }
    return textProcessingCtor;
}

/** 跑一遍 TTF 文本处理管线（cacheMode = NONE），返回画布尺寸相关数据。 */
function renderTtfLabel (conversion: SizeConversion): {
    canvasSizeHeight: number;
    assignedHeights: number[];
    canvasHeights: number[];
    assignedWidths: number[];
} {
    const TextProcessing = getTextProcessingCtor();
    const fake = createFakeCanvas(conversion);
    const pool = jest.spyOn(CanvasPool, 'getInstance').mockReturnValue({
        get: () => ({ canvas: fake.canvas, context: fake.context }),
        put: () => {},
    } as unknown as CanvasPool);

    const processing = new TextProcessing();
    try {
        const style = new TextStyle();
        style.fontSize = 25;
        style.fontScale = 1.125; // view.getScaleX(): SHOW_ALL, 960x640 设计分辨率渲染到 1280x720
        style.fontFamily = DEFAULT_FONT_FAMILY;

        const layout = new TextLayout();
        layout.lineHeight = 40;
        layout.wrapping = false;
        layout.overFlow = Overflow.NONE;
        layout.horizontalAlign = HorizontalTextAlignment.CENTER;
        layout.verticalAlign = VerticalTextAlignment.CENTER;

        const layoutData = new TextOutputLayoutData();
        const renderData = new TextOutputRenderData();
        const text = '正确显示';

        processing.processingString(false, style, layout, layoutData, text);
        processing.generateRenderInfo(false, style, layout, layoutData, renderData, text, () => {});

        return {
            canvasSizeHeight: layoutData.canvasSize.height,
            assignedHeights: fake.assignedHeights,
            canvasHeights: [fake.canvas.height],
            assignedWidths: fake.assignedWidths,
        };
    } finally {
        pool.mockRestore();
    }
}

describe('Label 文字画布尺寸由引擎取整', () => {
    test('TTF 路径：画布高度等于 canvasSize 的整数部分（1.26 * 40 * 1.125 = 56.7 → 56）', () => {
        const result = renderTtfLabel('truncate');

        expect(result.canvasSizeHeight).toBeCloseTo(56.7, 4);
        expect(result.assignedHeights).toEqual([56]);
        expect(result.canvasHeights).toEqual([56]);
        expect(result.assignedWidths.every((value) => Number.isInteger(value))).toBe(true);
    });

    test('TTF 路径：宿主把浮点四舍五入也拿不到 57，两种宿主结果完全一致', () => {
        const truncating = renderTtfLabel('truncate');
        const rounding = renderTtfLabel('round');

        expect(rounding.assignedHeights).toEqual(truncating.assignedHeights);
        expect(rounding.canvasHeights).toEqual(truncating.canvasHeights);
        expect(rounding.canvasHeights).toEqual([56]);
    });

    test('CHAR 缓存路径：单个字形纹理的画布尺寸同样是整数，且与宿主实现无关', () => {
        const measure = (conversion: SizeConversion): { widths: number[]; heights: number[] } => {
            const fake = createFakeCanvas(conversion);
            const pool = jest.spyOn(CanvasPool, 'getInstance').mockReturnValue({
                get: () => ({ canvas: fake.canvas, context: fake.context }),
                put: () => {},
            } as unknown as CanvasPool);
            try {
                const info = {
                    ...shareLabelInfo,
                    fontFamily: DEFAULT_FONT_FAMILY,
                    fontDesc: '40px Arial',
                    fontSize: 40,
                    fontScale: 2, // (1 + 0.26) * 40 * 2 = 100.8 + bleed，非整数
                    hash: 'canvas-size',
                };
                const atlas = {
                    fontDefDictionary: { letterDefinitions: {} },
                    insertLetterTexture: jest.fn(() => null),
                } as unknown as LetterAtlas;
                LetterAtlas.prototype.getLetterDefinitionForChar.call(atlas, 'X', info);
                return { widths: fake.assignedWidths, heights: fake.assignedHeights };
            } finally {
                pool.mockRestore();
            }
        };

        const truncating = measure('truncate');
        const rounding = measure('round');

        expect(truncating.heights.length).toBeGreaterThan(0);
        expect(truncating.heights.every((value) => Number.isInteger(value))).toBe(true);
        expect(truncating.widths.every((value) => Number.isInteger(value))).toBe(true);
        expect(rounding.heights).toEqual(truncating.heights);
        expect(rounding.widths).toEqual(truncating.widths);
    });
});
