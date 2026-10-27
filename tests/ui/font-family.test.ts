import { buildFontDesc, CssFontFamily, getCanvasFontFamily, quoteFontFamily } from '../../cocos/2d/utils/font-family';
import { TTFFont } from '../../cocos/2d/assets/ttf-font';
import type { Label } from '../../cocos/2d/components/label';
import { TTFUtils } from '../../cocos/2d/assembler/label/ttfUtils';
import { LetterFont } from '../../cocos/2d/assembler/label/letter-font';
import { EditBoxImpl } from '../../cocos/ui/editbox/edit-box-impl';
import { Color } from '../../cocos/core/math/color';

describe('font family serialization', () => {
    test.each([
        ['Alibaba PuHuiTi 3.0 105 Heavy', '"Alibaba PuHuiTi 3.0 105 Heavy"'],
        ['Arial', '"Arial"'],
        ['  A  B  ', '"  A  B  "'],
        ['A, B', '"A, B"'],
        ['A"B\\C', '"A\\"B\\\\C"'],
        ['"Foo"', '"\\"Foo\\""'],
        ['A\nb\r\t\x7f', '"A\\a b\\d \\9 \\7f "'],
        ['A\0B', '"A\uFFFDB"'],
        ['\ud800A\udc00', '"\uFFFDA\uFFFD"'],
        ['中文\u{1f680}', '"中文\u{1f680}"'],
    ])('serializes raw name %p using CSS string rules', (input, expected) => {
        expect(quoteFontFamily(input)).toBe(expected);
    });

    test('preserves system expressions when font sources change', () => {
        const source = {
            useSystemFont: false,
            fontFamily: 'Arial, sans-serif',
            font: { _nativeAsset: 'Alibaba PuHuiTi 3.0 105 Heavy' },
        };
        expect(getCanvasFontFamily(source)).toBe('"Alibaba PuHuiTi 3.0 105 Heavy"');
        expect(getCanvasFontFamily(source)).toBe('"Alibaba PuHuiTi 3.0 105 Heavy"');
        expect(source.font._nativeAsset).toBe('Alibaba PuHuiTi 3.0 105 Heavy');

        source.font._nativeAsset = 'sans-serif';
        expect(getCanvasFontFamily(source)).toBe('"sans-serif"');
        source.useSystemFont = true;
        expect(getCanvasFontFamily(source)).toBe('Arial, sans-serif');
        source.fontFamily = 'sans-serif';
        expect(getCanvasFontFamily(source)).toBe('sans-serif');
        source.fontFamily = '"Times New Roman", serif';
        expect(getCanvasFontFamily(source)).toBe('"Times New Roman", serif');

        source.useSystemFont = false;
        source.font = { _nativeAsset: 'Replacement 2' };
        expect(getCanvasFontFamily(source)).toBe('"Replacement 2"');
    });

    test('uses the existing Arial fallback when no usable family is available', () => {
        expect(getCanvasFontFamily({ useSystemFont: true, fontFamily: '', font: null })).toBe('Arial');
        expect(getCanvasFontFamily({ useSystemFont: false, fontFamily: 'ignored', font: null })).toBe('"Arial"');
        expect(getCanvasFontFamily({ useSystemFont: false, fontFamily: '', font: { _nativeAsset: null } })).toBe('"Arial"');
    });

    test('explicitly serializes legacy raw aliases without conflating literal quotes with CSS syntax', () => {
        const rawAliases = ['Example_LABEL', '"Example_LABEL"', '"My Font_LABEL"'];
        const descriptions = rawAliases.map((rawAlias) => {
            const source = { useSystemFont: false, fontFamily: 'Arial', font: { _nativeAsset: rawAlias } };
            // A migrated manual caller uses the original registered alias, not its old ctx.font text.
            const migrated = buildFontDesc(40, quoteFontFamily(rawAlias));
            expect(migrated).toBe(buildFontDesc(40, getCanvasFontFamily(source)));
            expect(source.font._nativeAsset).toBe(rawAlias);
            return migrated;
        });
        expect(descriptions).toEqual([
            '40px "Example_LABEL"',
            '40px "\\"Example_LABEL\\""',
            '40px "\\"My Font_LABEL\\""',
        ]);
    });

    test('size and style changes do not re-quote the family', () => {
        const family = quoteFontFamily('Demo12px');
        expect(buildFontDesc(40, family)).toBe('40px "Demo12px"');
        expect(buildFontDesc(80, family, true, true)).toBe('italic bold 80px "Demo12px"');
        expect(buildFontDesc(12.5, family)).toBe('12.5px "Demo12px"');
    });
});

describe('Label font consumers', () => {
    class ExposedLetterFont extends LetterFont {
        familyFor (label: Label): CssFontFamily {
            return this._getFontFamily(label);
        }
    }

    test('TTF and CHAR resolve the same raw asset without modifying it', () => {
        const font = new TTFFont();
        font._nativeAsset = 'Alibaba PuHuiTi 3.0 105 Heavy';
        const label = { font, useSystemFont: false, fontFamily: 'Arial' } as unknown as Label;
        const ttf = new TTFUtils();
        const char = new ExposedLetterFont();
        expect(ttf._updateFontFamily(label)).toBe('"Alibaba PuHuiTi 3.0 105 Heavy"');
        expect(char.familyFor(label)).toBe(ttf._updateFontFamily(label));
        expect(font._nativeAsset).toBe('Alibaba PuHuiTi 3.0 105 Heavy');
    });

    test('Web EditBox applies a custom family as CSS and preserves system lists', () => {
        const font = new TTFFont();
        font._nativeAsset = 'Alibaba PuHuiTi 3.0 105 Heavy';
        const label = {
            font,
            useSystemFont: false,
            fontFamily: 'Arial, sans-serif',
            fontSize: 40,
            node: { scale: { y: 1 } },
            color: Color.WHITE,
            horizontalAlign: 0,
        };
        const input = document.createElement('input');
        const impl = Object.create(EditBoxImpl.prototype) as {
            _edTxt: HTMLInputElement;
            _updateTextLabel(label: unknown): void;
        };
        impl._edTxt = input;
        impl._updateTextLabel(label);
        expect(input.style.fontFamily).toBe('"Alibaba PuHuiTi 3.0 105 Heavy"');
        expect(font._nativeAsset).toBe('Alibaba PuHuiTi 3.0 105 Heavy');
        impl._updateTextLabel({ ...label, useSystemFont: true, font: null });
        expect(input.style.fontFamily).toBe('Arial, sans-serif');
    });
});
