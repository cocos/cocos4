const oneOfProp = require('../../../editor/inspector/utils/one-of-prop');
const propUtils = require('../../../editor/inspector/utils/prop');

describe('inspector oneOf prop', () => {
    test('normalizes primitive oneOf dumps before rendering', () => {
        const dump = {
            name: 'mixed',
            path: '__comps__.0.mixed',
            type: 'OneOf',
            value: '',
            userData: {
                oneOf: {
                    currentVariantIndex: 3,
                    switchCommandPrefix: '__cc_oneof_switch__:',
                    switchPropertyName: '__cc_oneOfSwitch_mixed',
                    switchType: 'String',
                    variants: [
                        { key: 'dog', type: 'Dog', creatable: true },
                        { key: 'cat', type: 'Cat', creatable: true },
                        { key: 'number', type: 'Number', creatable: true },
                        { key: 'string', type: 'String', creatable: true },
                    ],
                },
            },
        };

        const normalized = oneOfProp.normalizeOneOfDumpForRender(dump);

        expect(normalized).not.toBe(dump);
        expect(normalized.type).toBe('String');
        expect(normalized.value).toBe('');
        expect(normalized.userData).toBe(dump.userData);
    });

    test('normalizes switched primitive oneOf dumps from their runtime value', () => {
        const dump = {
            name: 'mixed',
            path: '__comps__.0.mixed',
            type: 'Unknown',
            value: 0,
            userData: {
                oneOf: {
                    currentVariantIndex: 2,
                    switchCommandPrefix: '__cc_oneof_switch__:',
                    switchPropertyName: '__cc_oneOfSwitch_mixed',
                    switchType: 'String',
                    variants: [
                        { key: 'dog', label: 'Dog', creatable: true },
                        { key: 'cat', label: 'Cat', creatable: true },
                        { key: 'number', label: 'Number', creatable: true },
                    ],
                },
            },
        };

        const normalized = oneOfProp.normalizeOneOfDumpForRender(dump);

        expect(normalized).not.toBe(dump);
        expect(normalized.type).toBe('Number');
        expect(normalized.value).toBe(0);
    });

    test('drops stale primitive oneOf defaults when normalizing type from runtime value', () => {
        const dump = {
            name: 'primitive',
            path: '__comps__.0.primitive',
            type: 'Unknown',
            value: 123,
            default: 'hello',
            userData: {
                oneOf: {
                    currentVariantIndex: 0,
                    switchCommandPrefix: '__cc_oneof_switch__:',
                    switchPropertyName: '__cc_oneOfSwitch_primitive',
                    switchType: 'String',
                    variants: [
                        { key: 'number', label: 'Number', creatable: true },
                        { key: 'string', label: 'String', creatable: true },
                        { key: 'boolean', label: 'Boolean', creatable: true },
                    ],
                },
            },
        };

        const normalized = oneOfProp.normalizeOneOfDumpForRender(dump);

        expect(normalized).not.toBe(dump);
        expect(normalized.type).toBe('Number');
        expect(normalized.value).toBe(123);
        expect(normalized).not.toHaveProperty('default');
    });

    test('shared dump renderer normalizes and decorates oneOf props', () => {
        /// @case
        /// 1. A custom inspector path renders a primitive OneOf dump through the shared dump renderer.
        /// 2. The dump still carries the static OneOf type tag before rendering.
        /// @expect
        /// The renderer receives the normalized primitive type and the OneOf selector is attached.
        const dump = {
            name: 'primitive',
            path: '__comps__.0.primitive',
            type: 'OneOf',
            value: 123,
            userData: {
                oneOf: {
                    currentVariantIndex: 0,
                    switchCommandPrefix: '__cc_oneof_switch__:',
                    switchPropertyName: '__cc_oneOfSwitch_primitive',
                    switchType: 'String',
                    variants: [
                        { key: 'number', label: 'Number', creatable: true },
                        { key: 'string', label: 'String', creatable: true },
                    ],
                },
            },
        };
        const $prop = document.createElement('ui-prop');
        const rendered: unknown[] = [];
        $prop.render = (info: unknown) => {
            rendered.push(info);
        };

        propUtils.renderDumpProp($prop, dump);

        expect(rendered).toHaveLength(1);
        expect(rendered[0]).not.toBe(dump);
        expect((rendered[0] as { type?: string }).type).toBe('Number');
        expect($prop.$oneOfSelect).toBeTruthy();
        expect($prop.$oneOfSelect.value).toBe('0');
    });

    test('switching oneOf duck does not submit the sibling complex oneOf value', () => {
        const outerPanel = document.createElement('ui-panel');
        const outerShadow = outerPanel.attachShadow({ mode: 'open' });
        const componentPanel = document.createElement('ui-panel');
        const componentShadow = componentPanel.attachShadow({ mode: 'open' });
        const events: string[] = [];
        const duckDump = {
            name: 'oneOfDuck',
            path: '__comps__.0.oneOfDuck',
            type: 'OneOf',
            value: {},
            userData: {
                oneOf: {
                    currentVariantIndex: 0,
                    switchCommandPrefix: '__cc_oneof_switch__:',
                    switchPropertyName: '__cc_oneOfSwitch_oneOfDuck',
                    switchType: 'String',
                    variants: [
                        { key: 'dog', creatable: true },
                        { key: 'cat', creatable: true },
                    ],
                },
            },
        };
        const complexDump = {
            name: 'complexOneOf',
            path: '__comps__.0.complexOneOf',
            type: 'Number',
            value: 0,
            userData: {
                oneOf: {
                    currentVariantIndex: 2,
                    switchCommandPrefix: '__cc_oneof_switch__:',
                    switchPropertyName: '__cc_oneOfSwitch_complexOneOf',
                    switchType: 'String',
                    variants: [
                        { key: 'dog', type: 'Dog', creatable: true },
                        { key: 'cat', type: 'Cat', creatable: true },
                        { key: 'number', type: 'Number', creatable: true },
                        { key: 'string', type: 'String', creatable: true },
                    ],
                },
            },
        };
        const $duckProp = document.createElement('ui-prop');
        const $complexProp = document.createElement('ui-prop');

        componentPanel.dump = {
            path: '__comps__.0',
            value: {
                oneOfDuck: duckDump,
                complexOneOf: complexDump,
            },
        };
        $duckProp.dump = duckDump;
        $complexProp.dump = complexDump;

        componentShadow.appendChild($duckProp);
        componentShadow.appendChild($complexProp);
        outerShadow.appendChild(componentPanel);
        document.body.appendChild(outerPanel);

        componentShadow.addEventListener('change-dump', (event) => {
            events.push((event.target as HTMLElement & { dump?: { path?: string } }).dump?.path || '');
        });
        outerShadow.addEventListener('change-dump', (event) => {
            events.push((event.target as HTMLElement & { dump?: { path?: string } }).dump?.path || '');
        });

        oneOfProp.decorateOneOfPropElement({
            setReadonly () {},
        }, $duckProp, duckDump);
        oneOfProp.decorateOneOfPropElement({
            setReadonly () {},
        }, $complexProp, complexDump);

        $duckProp.$oneOfSelect.value = '1';
        $duckProp.$oneOfSelect.dispatchEvent(new CustomEvent('change', {
            bubbles: true,
            cancelable: true,
        }));

        expect(events).toStrictEqual([
            '__comps__.0.__cc_oneOfSwitch_oneOfDuck',
        ]);
    });

    test('switching an unresolved oneOf selection does not dispatch a switch command', () => {
        /// @case
        /// 1. A OneOf root has no currentVariantIndex, so the selector has no selected option.
        /// 2. The empty selector value emits a change event.
        /// @expect
        /// No switch dump is dispatched and the empty value is not coerced to variant 0.
        const outerPanel = document.createElement('ui-panel');
        const outerShadow = outerPanel.attachShadow({ mode: 'open' });
        const events: string[] = [];
        const duckDump = {
            name: 'oneOfDuck',
            path: '__comps__.0.oneOfDuck',
            type: 'OneOf',
            value: {},
            userData: {
                oneOf: {
                    switchCommandPrefix: '__cc_oneof_switch__:',
                    switchPropertyName: '__cc_oneOfSwitch_oneOfDuck',
                    switchType: 'String',
                    variants: [
                        { key: 'dog', creatable: true },
                        { key: 'cat', creatable: true },
                    ],
                },
            },
        };
        const $duckProp = document.createElement('ui-prop');

        $duckProp.dump = duckDump;
        outerShadow.appendChild($duckProp);
        document.body.appendChild(outerPanel);

        outerShadow.addEventListener('change-dump', (event) => {
            events.push((event.target as HTMLElement & { dump?: { path?: string } }).dump?.path || '');
        });

        oneOfProp.decorateOneOfPropElement({
            setReadonly () {},
        }, $duckProp, duckDump);

        expect($duckProp.$oneOfSelect.value).toBe('');

        $duckProp.$oneOfSelect.dispatchEvent(new CustomEvent('change', {
            bubbles: true,
            cancelable: true,
        }));

        expect(events).toHaveLength(0);
    });

    test('resetting oneOf root dispatches the current variant switch command', () => {
        const outerPanel = document.createElement('ui-panel');
        const outerShadow = outerPanel.attachShadow({ mode: 'open' });
        const events: string[] = [];
        const resetEvents: string[] = [];
        const duckDump = {
            name: 'oneOfDuck',
            path: '__comps__.0.oneOfDuck',
            type: 'OneOf',
            value: {},
            userData: {
                oneOf: {
                    currentVariantIndex: 1,
                    switchCommandPrefix: '__cc_oneof_switch__:',
                    switchPropertyName: '__cc_oneOfSwitch_oneOfDuck',
                    switchType: 'String',
                    variants: [
                        { key: 'dog', creatable: true },
                        { key: 'cat', creatable: true },
                    ],
                },
            },
        };
        const $duckProp = document.createElement('ui-prop');

        $duckProp.dump = duckDump;
        outerShadow.appendChild($duckProp);
        document.body.appendChild(outerPanel);

        outerShadow.addEventListener('reset-dump', (event) => {
            resetEvents.push((event.target as HTMLElement & { dump?: { path?: string } }).dump?.path || '');
        });
        outerShadow.addEventListener('change-dump', (event) => {
            events.push(`change:${(event.target as HTMLElement & { dump?: { path?: string; value?: string } }).dump?.path || ''}:${
                (event.target as HTMLElement & { dump?: { value?: string } }).dump?.value || ''
            }`);
        });
        outerShadow.addEventListener('confirm-dump', (event) => {
            events.push(`confirm:${(event.target as HTMLElement & { dump?: { path?: string; value?: string } }).dump?.path || ''}:${
                (event.target as HTMLElement & { dump?: { value?: string } }).dump?.value || ''
            }`);
        });

        oneOfProp.decorateOneOfPropElement({
            setReadonly () {},
        }, $duckProp, duckDump);

        const resetCancelled = !$duckProp.dispatchEvent(new CustomEvent('reset-dump', {
            bubbles: true,
            cancelable: true,
        }));

        expect(resetCancelled).toBe(true);
        expect(resetEvents).toHaveLength(0);
        expect(events).toStrictEqual([
            'change:__comps__.0.__cc_oneOfSwitch_oneOfDuck:__cc_oneof_switch__:1',
            'confirm:__comps__.0.__cc_oneOfSwitch_oneOfDuck:__cc_oneof_switch__:1',
        ]);
    });

    test('resetting an unresolved oneOf root falls through without switching to the first variant', () => {
        /// @case
        /// 1. A OneOf root has no currentVariantIndex, so the selector value is empty.
        /// 2. The root reset event reaches the OneOf decoration handler.
        /// @expect
        /// The reset is not consumed as a variant switch and no switch command for variant 0 is emitted.
        const outerPanel = document.createElement('ui-panel');
        const outerShadow = outerPanel.attachShadow({ mode: 'open' });
        const events: string[] = [];
        const resetEvents: string[] = [];
        const duckDump = {
            name: 'oneOfDuck',
            path: '__comps__.0.oneOfDuck',
            type: 'OneOf',
            value: {},
            userData: {
                oneOf: {
                    switchCommandPrefix: '__cc_oneof_switch__:',
                    switchPropertyName: '__cc_oneOfSwitch_oneOfDuck',
                    switchType: 'String',
                    variants: [
                        { key: 'dog', creatable: true },
                        { key: 'cat', creatable: true },
                    ],
                },
            },
        };
        const $duckProp = document.createElement('ui-prop');

        $duckProp.dump = duckDump;
        outerShadow.appendChild($duckProp);
        document.body.appendChild(outerPanel);

        outerShadow.addEventListener('reset-dump', (event) => {
            resetEvents.push((event.target as HTMLElement & { dump?: { path?: string } }).dump?.path || '');
        });
        outerShadow.addEventListener('change-dump', (event) => {
            events.push((event.target as HTMLElement & { dump?: { path?: string } }).dump?.path || '');
        });

        oneOfProp.decorateOneOfPropElement({
            setReadonly () {},
        }, $duckProp, duckDump);

        const resetCancelled = !$duckProp.dispatchEvent(new CustomEvent('reset-dump', {
            bubbles: true,
            cancelable: true,
        }));

        expect(resetCancelled).toBe(false);
        expect(resetEvents).toStrictEqual([
            '__comps__.0.oneOfDuck',
        ]);
        expect(events).toHaveLength(0);
    });

    test('resetting a child under oneOf root still bubbles as a normal reset', () => {
        const outerPanel = document.createElement('ui-panel');
        const outerShadow = outerPanel.attachShadow({ mode: 'open' });
        const resetEvents: string[] = [];
        const duckDump = {
            name: 'oneOfDuck',
            path: '__comps__.0.oneOfDuck',
            type: 'OneOf',
            value: {},
            userData: {
                oneOf: {
                    currentVariantIndex: 1,
                    switchCommandPrefix: '__cc_oneof_switch__:',
                    switchPropertyName: '__cc_oneOfSwitch_oneOfDuck',
                    switchType: 'String',
                    variants: [
                        { key: 'dog', creatable: true },
                        { key: 'cat', creatable: true },
                    ],
                },
            },
        };
        const childDump = {
            name: 'meow',
            path: '__comps__.0.oneOfDuck.meow',
            type: 'String',
            value: 'edited',
        };
        const $duckProp = document.createElement('ui-prop');
        const $childProp = document.createElement('ui-prop');

        $duckProp.dump = duckDump;
        $childProp.dump = childDump;
        $duckProp.appendChild($childProp);
        outerShadow.appendChild($duckProp);
        document.body.appendChild(outerPanel);

        outerShadow.addEventListener('reset-dump', (event) => {
            resetEvents.push((event.target as HTMLElement & { dump?: { path?: string } }).dump?.path || '');
        });

        oneOfProp.decorateOneOfPropElement({
            setReadonly () {},
        }, $duckProp, duckDump);

        const resetCancelled = !$childProp.dispatchEvent(new CustomEvent('reset-dump', {
            bubbles: true,
            cancelable: true,
        }));

        expect(resetCancelled).toBe(false);
        expect(resetEvents).toStrictEqual([
            '__comps__.0.oneOfDuck.meow',
        ]);
    });

    test('restores the label slot when a oneOf object renderer switches to a primitive renderer', () => {
        const numberDump = {
            name: 'complexOneOf',
            path: '__comps__.0.complexOneOf',
            type: 'Number',
            value: 0,
            userData: {
                oneOf: {
                    currentVariantIndex: 2,
                    switchCommandPrefix: '__cc_oneof_switch__:',
                    switchPropertyName: '__cc_oneOfSwitch_complexOneOf',
                    switchType: 'String',
                    variants: [
                        { key: 'dog', type: 'Dog', creatable: true },
                        { key: 'cat', type: 'Cat', creatable: true },
                        { key: 'number', type: 'Number', creatable: true },
                        { key: 'string', type: 'String', creatable: true },
                    ],
                },
            },
        };
        const $prop = document.createElement('ui-prop');

        $prop.setAttribute('no-label', '');
        $prop.innerHTML = `
            <ui-label slot="label" style="flex: 1;"></ui-label>
            <ui-num-input slot="content"></ui-num-input>
        `;

        oneOfProp.decorateOneOfPropElement({
            setReadonly () {},
        }, $prop, numberDump);

        expect($prop.hasAttribute('no-label')).toBe(false);
        expect($prop.$oneOfSelect.getAttribute('slot')).toBe('label');
    });

    test('keeps oneOf root label placement aligned with normal prop rows', () => {
        const dump = {
            name: 'complexOneOf',
            path: '__comps__.0.complexOneOf',
            type: 'Custom',
            value: 0,
            userData: {
                oneOf: {
                    currentVariantIndex: 2,
                    switchCommandPrefix: '__cc_oneof_switch__:',
                    switchPropertyName: '__cc_oneOfSwitch_complexOneOf',
                    switchType: 'String',
                    variants: [
                        { key: 'dog', type: 'Dog', creatable: true },
                        { key: 'cat', type: 'Cat', creatable: true },
                        { key: 'number', type: 'Number', creatable: true },
                    ],
                },
            },
        };
        const $prop = document.createElement('ui-prop');

        $prop.innerHTML = `
            <ui-label slot="label"></ui-label>
            <custom-renderer-value slot="content"></custom-renderer-value>
        `;

        oneOfProp.decorateOneOfPropElement({
            setReadonly () {},
        }, $prop, dump);

        expect($prop.$oneOfLabelGutter).toBeUndefined();
        expect($prop.firstElementChild?.tagName).toBe('UI-LABEL');
        expect($prop.$oneOfSelect.previousElementSibling?.tagName).toBe('UI-LABEL');

        $prop.innerHTML = `
            <ui-section expand>
                <div slot="header">
                    <ui-label name></ui-label>
                    <ui-label type></ui-label>
                </div>
            </ui-section>
        `;

        oneOfProp.decorateOneOfPropElement({
            setReadonly () {},
        }, $prop, dump);

        expect($prop.$oneOfSelect.getAttribute('slot')).toBeNull();
    });

    test('reapplies oneOf placement when the current renderer remounts after decoration', async () => {
        const dump = {
            name: 'complexOneOf',
            path: '__comps__.0.complexOneOf',
            type: 'Custom',
            value: 0,
            userData: {
                oneOf: {
                    currentVariantIndex: 2,
                    switchCommandPrefix: '__cc_oneof_switch__:',
                    switchPropertyName: '__cc_oneOfSwitch_complexOneOf',
                    switchType: 'String',
                    variants: [
                        { key: 'dog', type: 'Dog', creatable: true },
                        { key: 'cat', type: 'Cat', creatable: true },
                        { key: 'number', type: 'Number', creatable: true },
                    ],
                },
            },
        };
        const $prop = document.createElement('ui-prop');

        oneOfProp.decorateOneOfPropElement({
            setReadonly () {},
        }, $prop, dump);

        $prop.innerHTML = `
            <ui-label slot="label"></ui-label>
            <custom-renderer-value slot="content"></custom-renderer-value>
        `;
        await Promise.resolve();

        expect($prop.$oneOfLabelGutter).toBeUndefined();
        expect($prop.$oneOfSelect.parentElement).toBe($prop);
        expect($prop.$oneOfSelect.previousElementSibling?.tagName).toBe('UI-LABEL');
        expect($prop.$oneOfSelect.getAttribute('slot')).toBe('label');
    });

    test('clears object-renderer host style when switching back to a root-label oneOf renderer', () => {
        const dump = {
            name: 'complexOneOf',
            path: '__comps__.0.complexOneOf',
            type: 'Custom',
            value: 0,
            userData: {
                oneOf: {
                    currentVariantIndex: 2,
                    switchCommandPrefix: '__cc_oneof_switch__:',
                    switchPropertyName: '__cc_oneOfSwitch_complexOneOf',
                    switchType: 'String',
                    variants: [
                        { key: 'dog', type: 'Dog', creatable: true },
                        { key: 'cat', type: 'Cat', creatable: true },
                        { key: 'number', type: 'Number', creatable: true },
                    ],
                },
            },
        };
        const $prop = document.createElement('ui-prop');
        $prop.attachShadow({ mode: 'open' }).innerHTML = '<style id="custom-style"></style>';

        $prop.innerHTML = `
            <ui-label slot="label"></ui-label>
            <custom-renderer-value slot="content"></custom-renderer-value>
        `;
        oneOfProp.decorateOneOfPropElement({
            setReadonly () {},
        }, $prop, dump);

        $prop.shadowRoot.querySelector('#custom-style').innerHTML = ':host { margin-left: 0; }';
        $prop.innerHTML = `
            <ui-section expand>
                <div slot="header">
                    <ui-label name></ui-label>
                    <ui-label type></ui-label>
                </div>
            </ui-section>
        `;
        oneOfProp.decorateOneOfPropElement({
            setReadonly () {},
        }, $prop, dump);

        $prop.innerHTML = `
            <ui-label slot="label"></ui-label>
            <custom-renderer-value slot="content"></custom-renderer-value>
        `;
        oneOfProp.decorateOneOfPropElement({
            setReadonly () {},
        }, $prop, dump);

        expect($prop.shadowRoot.querySelector('#custom-style').innerHTML).toBe('');
        expect($prop.$oneOfSelect.previousElementSibling?.tagName).toBe('UI-LABEL');
    });
});
