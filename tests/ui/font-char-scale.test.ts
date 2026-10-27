import { buildFontDesc, quoteFontFamily } from '../../cocos/2d/utils/font-family';
import { CanvasPool, LetterAtlas, shareLabelInfo } from '../../cocos/2d/assembler/label/font-utils';

test('the actual CHAR draw path scales the size, not a unit-like substring in the name', () => {
    const measuredFonts: string[] = [];
    const drawnFonts: string[] = [];
    const context: Pick<CanvasRenderingContext2D, 'font' | 'measureText' | 'clearRect' | 'fillRect' | 'fillText'> = {
        font: '',
        measureText: jest.fn(() => {
            measuredFonts.push(context.font);
            return { width: 20 } as TextMetrics;
        }),
        clearRect: jest.fn(),
        fillRect: jest.fn(),
        fillText: jest.fn(() => drawnFonts.push(context.font)),
    };
    const canvas = document.createElement('canvas');
    const pool = CanvasPool.getInstance();
    const get = jest.spyOn(pool, 'get').mockReturnValue({ canvas, context: context as unknown as CanvasRenderingContext2D });
    const put = jest.spyOn(pool, 'put').mockImplementation(() => {});
    const family = quoteFontFamily('Demo12px');
    const info = {
        ...shareLabelInfo,
        fontFamily: family,
        fontDesc: buildFontDesc(40, family),
        fontSize: 40,
        fontScale: 2,
        hash: 'unit-in-font-name',
    };
    const atlas = {
        fontDefDictionary: { letterDefinitions: {} },
        insertLetterTexture: jest.fn(() => null),
    } as unknown as LetterAtlas;
    try {
        LetterAtlas.prototype.getLetterDefinitionForChar.call(atlas, 'X', info);
        expect(measuredFonts).toEqual(['40px "Demo12px"']);
        expect(drawnFonts).toEqual(['80px "Demo12px"']);
        expect(info.fontDesc).toBe('40px "Demo12px"');
    } finally {
        get.mockRestore();
        put.mockRestore();
    }
});
