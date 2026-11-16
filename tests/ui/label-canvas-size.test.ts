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
 * Label 文字画布：尺寸必须由引擎取整成整数，且纹理与四边形必须严格 1:1。
 *
 * 1. `HTMLCanvasElement.width/height` 是 `unsigned long`，规范要求截断小数，但宿主实现可能四舍五入。
 *    同一段文字因此在"四舍五入"的宿主上会多出一行纹理（例如 56.7px 画布 → 56 行 vs 57 行）。
 * 2. 更根本的是：四边形一直使用浮点的 `nodeContentSize`，于是纹理到四边形存在 `k = 四边形高 / 行数`
 *    的非 1 比例，文字被拉伸并整体偏移最多约 1px —— 这类差异只会在个别设备/宿主上暴露，
 *    表现为像素比对失败，且和宿主实现相关。
 *
 * `TextProcessing._snapCanvasSize` 在排版结束后把画布尺寸取整，并把同样的差值带入内容尺寸，
 * 使 `nodeContentSize * fontScale === canvas 行数`（k ≡ 1）；`LetterTexture`（CHAR 缓存路径）
 * 也把画布尺寸取整。下面的用例分别验证：画布尺寸与宿主转换无关、纹理与四边形 1:1。
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

const FONT_SIZE = 25;
const LINE_HEIGHT = 40;

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

interface ITtfRenderResult {
    canvasSizeWidth: number;
    canvasSizeHeight: number;
    nodeContentHeight: number;
    nodeContentWidth: number;
    baselineY: number;
    actualFontSize: number;
    assignedHeights: number[];
    assignedWidths: number[];
    canvasWidth: number;
    canvasHeight: number;
}

/** 跑一遍 TTF 文本处理管线（cacheMode = NONE）。 */
function renderTtfLabel (conversion: SizeConversion, fontScale = 1.125): ITtfRenderResult {
    const TextProcessing = getTextProcessingCtor();
    const fake = createFakeCanvas(conversion);
    const pool = jest.spyOn(CanvasPool, 'getInstance').mockReturnValue({
        get: () => ({ canvas: fake.canvas, context: fake.context }),
        put: () => {},
    } as unknown as CanvasPool);

    const processing = new TextProcessing();
    try {
        const style = new TextStyle();
        style.fontSize = FONT_SIZE;
        style.fontScale = fontScale;
        style.fontFamily = DEFAULT_FONT_FAMILY;

        const layout = new TextLayout();
        layout.lineHeight = LINE_HEIGHT;
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
            canvasSizeWidth: layoutData.canvasSize.width,
            canvasSizeHeight: layoutData.canvasSize.height,
            nodeContentHeight: layoutData.nodeContentSize.height,
            nodeContentWidth: layoutData.nodeContentSize.width,
            baselineY: layoutData.startPosition.y,
            actualFontSize: style.actualFontSize,
            assignedHeights: fake.assignedHeights,
            assignedWidths: fake.assignedWidths,
            canvasWidth: fake.canvas.width,
            canvasHeight: fake.canvas.height,
        };
    } finally {
        pool.mockRestore();
    }
}

describe('Label 文字画布尺寸由引擎取整', () => {
    test('TTF 路径：画布尺寸是整数（1.26 * 40 * 1.125 = 56.7 → 56 行）', () => {
        const result = renderTtfLabel('truncate');

        expect(result.assignedHeights).toEqual([56]);
        expect(result.canvasHeight).toBe(56);
        expect(result.assignedWidths.every((value) => Number.isInteger(value))).toBe(true);
        expect(result.canvasSizeHeight).toBe(56);
    });

    test('TTF 路径：宿主把浮点四舍五入也拿不到 57，两种宿主结果完全一致', () => {
        const truncating = renderTtfLabel('truncate');
        const rounding = renderTtfLabel('round');

        expect(rounding.assignedHeights).toEqual(truncating.assignedHeights);
        expect(rounding.canvasHeight).toBe(truncating.canvasHeight);
        expect(rounding.canvasHeight).toBe(56);
    });
});

describe('Label 纹理与四边形严格 1:1（不再有亚像素拉伸）', () => {
    test.each([1, 1.125, 1.5, 1.875, 2])('fontScale = %p 时 nodeContentHeight * fontScale === 纹理行数', (fontScale) => {
        const result = renderTtfLabel('truncate', fontScale);

        expect(result.canvasHeight).toBeGreaterThan(0);
        expect(result.nodeContentHeight * fontScale).toBeCloseTo(result.canvasHeight, 6);
    });

    test.each([1, 1.125, 1.5, 1.875, 2])('fontScale = %p 时四舍五入的宿主也得到同样的 1:1 映射', (fontScale) => {
        const truncating = renderTtfLabel('truncate', fontScale);
        const rounding = renderTtfLabel('round', fontScale);

        expect(rounding.nodeContentHeight).toBeCloseTo(truncating.nodeContentHeight, 6);
        expect(rounding.nodeContentHeight * fontScale).toBeCloseTo(rounding.canvasHeight, 6);
    });

    test('基线相对节点中心恒为 0.37 * actualFontSize（与画布高度无关）', () => {
        const result = renderTtfLabel('truncate');

        // firstLinelabelY = actualFontSize * (1 - BASELINE_RATIO / 2) - (actualFontSize - canvasHeight) / 2
        //                 = 0.37 * actualFontSize + canvasHeight / 2
        expect(result.baselineY - result.canvasHeight / 2).toBeCloseTo(result.actualFontSize * 0.37, 6);
    });
});

describe('CHAR 缓存路径', () => {
    test('单个字形纹理的画布尺寸同样是整数，且与宿主实现无关', () => {
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
