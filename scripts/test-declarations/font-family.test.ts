import { Label } from 'cc';

// Check the bundled type through a consumer, even when skipLibCheck is enabled.
export class FontFamilyDeclarationTest extends Label {
    checkFontFamily (): void {
        const style = this._textStyle!;
        const serializedFamily = style.fontFamily;
        const familyText: string = serializedFamily;
        style.fontFamily = serializedFamily;

        // @ts-expect-error A plain string must not bypass the serialized family type.
        style.fontFamily = familyText;
    }
}
