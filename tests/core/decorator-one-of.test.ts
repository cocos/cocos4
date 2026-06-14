import {
    ccclass,
    OneOf,
} from '../../cocos/core/data/decorators';
import { CCClass } from '../../cocos/core/data/class';
import { getOneOfSwitchPropertyName, ONE_OF_SWITCH_COMMAND_PREFIX } from '../../cocos/core/data/decorators/one-of';
import { property } from '../../cocos/core/data/decorators/property';
import { deserialize } from '../../cocos/serialization/deserialize';
import { captureWarns } from '../utils/log-capture';

class OneOfA {
    public kind = 'a';
}

class OneOfB {
    public kind = 'b';
}

type OneOfDuck = {
    category: 'dog';
    woof: boolean;
} | {
    category: 'cat';
    meow: string;
};

describe('@property OneOf', () => {
    test('OneOf type-id property annotation', () => {
        const oneOfType = OneOf<OneOfA | OneOfB>({
            variants: [
                OneOfA,
                {
                    type: OneOfB,
                    label: 'B',
                },
            ],
        });

        @ccclass
        class OneOfHost {
            @property(oneOfType)
            public shorthand: OneOfA | OneOfB | null = null;

            @property({
                type: oneOfType,
                userData: {
                    source: 'full',
                },
            })
            public full: OneOfA | OneOfB | null = null;
        }

        for (const propertyName of ['shorthand', 'full']) {
            const attrs = CCClass.Attr.attr(OneOfHost, propertyName);

            expect(attrs.type).toBe('OneOf');
            expect(attrs.oneOf).toBe(oneOfType);
            expect(attrs.oneOf.discriminator).toStrictEqual({
                kind: 'type-id',
            });
            expect(attrs.oneOf.variants).toStrictEqual([
                {
                    type: OneOfA,
                },
                {
                    type: OneOfB,
                    label: 'B',
                },
            ]);
            expect(attrs.userData.oneOf).toStrictEqual({
                discriminator: {
                    kind: 'type-id',
                },
                switchType: 'String',
                switchCommandPrefix: ONE_OF_SWITCH_COMMAND_PREFIX,
                switchPropertyName: getOneOfSwitchPropertyName(propertyName),
                variants: [
                    {
                        type: 'OneOfA',
                        creatable: true,
                    },
                    {
                        type: 'OneOfB',
                        label: 'B',
                        creatable: true,
                    },
                ],
            });
            if (propertyName === 'full') {
                expect(attrs.userData.source).toBe('full');
            }
        }
    });

    test('OneOf discriminated property annotation', () => {
        const getKind = (value: OneOfA | OneOfB) => value.kind;
        const createA = () => new OneOfA();
        const createB = () => new OneOfB();
        const oneOfType = OneOf<OneOfA | OneOfB>({
            discriminator: getKind,
            variants: [
                {
                    key: 'a',
                    create: createA,
                },
                {
                    key: 'b',
                    create: createB,
                    label: 'B',
                },
            ],
        });

        @ccclass
        class OneOfHost {
            @property({
                type: oneOfType,
            })
            public value: OneOfA | OneOfB | null = null;
        }

        const attrs = CCClass.Attr.attr(OneOfHost, 'value');
        expect(attrs.type).toBe('OneOf');
        expect(attrs.oneOf.discriminator).toStrictEqual({
            kind: 'function',
            get: getKind,
        });
        expect(attrs.oneOf.variants).toStrictEqual([
            {
                key: 'a',
                create: createA,
            },
            {
                key: 'b',
                create: createB,
                label: 'B',
            },
        ]);
        expect(attrs.userData.oneOf).toStrictEqual({
            discriminator: {
                kind: 'function',
            },
            switchType: 'String',
            switchCommandPrefix: ONE_OF_SWITCH_COMMAND_PREFIX,
            switchPropertyName: getOneOfSwitchPropertyName('value'),
            variants: [
                {
                    key: 'a',
                    creatable: true,
                },
                {
                    key: 'b',
                    label: 'B',
                    creatable: true,
                },
            ],
        });
    });

    test('OneOf infers discriminated object unions from the discriminator annotation', () => {
        const oneOfType = OneOf({
            discriminator: (value: OneOfDuck) => value.category,
            variants: [
                {
                    key: 'dog',
                    create: () => ({
                        category: 'dog',
                        woof: true,
                    }),
                },
                {
                    key: 'cat',
                    create: () => ({
                        category: 'cat',
                        meow: 'm',
                    }),
                },
            ],
        });

        expect(oneOfType.discriminator.kind).toBe('function');
    });

    test('OneOf dynamic attrs resolve function-discriminated instance values', () => {
        @ccclass('OneOfDynamicDog')
        class OneOfDynamicDog {
            public readonly category = 'dog';

            @property
            public woof = true;
        }

        @ccclass('OneOfDynamicCat')
        class OneOfDynamicCat {
            public readonly category = 'cat';

            @property
            public meow = '';
        }

        type OneOfDynamicDuck = OneOfDynamicDog | OneOfDynamicCat;

        const oneOfType = OneOf<OneOfDynamicDuck>({
            discriminator: (value) => value.category,
            variants: [
                {
                    key: 'dog',
                    create: () => new OneOfDynamicDog(),
                },
                {
                    key: 'cat',
                    create: () => new OneOfDynamicCat(),
                },
            ],
        });

        @ccclass('OneOfDynamicHost')
        class OneOfDynamicHost {
            @property({
                type: oneOfType,
            })
            public value: OneOfDynamicDuck = new OneOfDynamicDog();
        }

        const host = new OneOfDynamicHost();
        const staticAttrs = CCClass.Attr.attr(OneOfDynamicHost, 'value');
        const dogAttrs = CCClass.Attr.attr(host, 'value');

        expect(staticAttrs.userData.oneOf.variants[0]).not.toHaveProperty('type');
        expect(dogAttrs.ctor).toBe(OneOfDynamicDog);
        expect(dogAttrs.userData.oneOf.currentKey).toBe('dog');
        expect(dogAttrs.userData.oneOf.currentVariantIndex).toBe(0);
        expect(dogAttrs.userData.oneOf.variants).toBe(staticAttrs.userData.oneOf.variants);
        expect(dogAttrs.userData.oneOf.variants[0]).toMatchObject({
            key: 'dog',
        });
        expect(dogAttrs.userData.oneOf.variants[1]).toMatchObject({
            key: 'cat',
        });
        expect(dogAttrs.userData.oneOf.variants[0]).not.toHaveProperty('type');
        expect(dogAttrs.userData.oneOf.variants[1]).not.toHaveProperty('type');
        expect(CCClass.Attr.attr(host.value, 'woof').default).toBe(true);

        host.value = new OneOfDynamicCat();

        const catAttrs = CCClass.Attr.attr(host, 'value');
        expect(catAttrs.ctor).toBe(OneOfDynamicCat);
        expect(catAttrs.userData.oneOf.currentKey).toBe('cat');
        expect(catAttrs.userData.oneOf.currentVariantIndex).toBe(1);
        expect(catAttrs.userData.oneOf.variants).toBe(staticAttrs.userData.oneOf.variants);
        expect(CCClass.Attr.attr(host.value, 'meow').default).toBe('');
    });

    test('OneOf dynamic attrs resolve mixed object and primitive values', () => {
        @ccclass('OneOfMixedDog')
        class OneOfMixedDog {
            public readonly category = 'dog';

            @property
            public woof = true;
        }

        @ccclass('OneOfMixedCat')
        class OneOfMixedCat {
            public readonly category = 'cat';

            @property
            public meow = '';
        }

        type OneOfMixedValue = OneOfMixedDog | OneOfMixedCat | number | string;

        const oneOfType = OneOf<OneOfMixedValue>({
            discriminator: (value) => (
                typeof value === 'number' || typeof value === 'string'
                    ? typeof value
                    : value.category
            ),
            variants: [
                {
                    key: 'dog',
                    create: () => new OneOfMixedDog(),
                },
                {
                    key: 'cat',
                    create: () => new OneOfMixedCat(),
                },
                {
                    key: 'number',
                    create: () => 0,
                },
                {
                    key: 'string',
                    create: () => '',
                },
            ],
        });

        @ccclass('OneOfMixedHost')
        class OneOfMixedHost {
            @property({
                type: oneOfType,
            })
            public value: OneOfMixedValue = 0;
        }

        const host = new OneOfMixedHost();
        const staticAttrs = CCClass.Attr.attr(OneOfMixedHost, 'value');
        const switchPropertyName = getOneOfSwitchPropertyName('value');
        let attrs = CCClass.Attr.attr(host, 'value');

        expect(attrs.type).toBe('Number');
        expect(attrs).not.toHaveProperty('default');
        expect(attrs).not.toHaveProperty('ctor');
        expect(attrs.userData.oneOf.currentKey).toBe('number');
        expect(attrs.userData.oneOf.currentVariantIndex).toBe(2);
        expect(attrs.userData.oneOf.variants).toBe(staticAttrs.userData.oneOf.variants);
        expect(attrs.userData.oneOf.variants[0]).toMatchObject({
            key: 'dog',
        });
        expect(attrs.userData.oneOf.variants[2]).toMatchObject({
            key: 'number',
        });
        expect(attrs.userData.oneOf.variants[0]).not.toHaveProperty('type');
        expect(attrs.userData.oneOf.variants[2]).not.toHaveProperty('type');

        (host as Record<string, unknown>)[switchPropertyName] = `${ONE_OF_SWITCH_COMMAND_PREFIX}3`;
        attrs = CCClass.Attr.attr(host, 'value');

        expect(host.value).toBe('');
        expect(attrs.type).toBe('String');
        expect(attrs).not.toHaveProperty('default');
        expect(attrs.userData.oneOf.currentKey).toBe('string');
        expect(attrs.userData.oneOf.currentVariantIndex).toBe(3);
        expect(attrs.userData.oneOf.variants).toBe(staticAttrs.userData.oneOf.variants);
        expect(attrs.userData.oneOf.variants[3]).toMatchObject({
            key: 'string',
        });
        expect(attrs.userData.oneOf.variants[3]).not.toHaveProperty('type');

        host.value = new OneOfMixedCat();
        attrs = CCClass.Attr.attr(host, 'value');

        expect(attrs.ctor).toBe(OneOfMixedCat);
        expect(attrs).not.toHaveProperty('default');
        expect(attrs.userData.oneOf.currentKey).toBe('cat');
        expect(attrs.userData.oneOf.currentVariantIndex).toBe(1);
        expect(attrs.userData.oneOf.variants).toBe(staticAttrs.userData.oneOf.variants);
        expect(attrs.userData.oneOf.variants[1]).toMatchObject({
            key: 'cat',
        });
        expect(attrs.userData.oneOf.variants[1]).not.toHaveProperty('type');
    });

    test('OneOf dynamic attrs resolve primitive-only switch values', () => {
        type OneOfPrimitiveValue = number | string | boolean;

        const oneOfType = OneOf<OneOfPrimitiveValue>({
            discriminator: (value) => typeof value,
            variants: [
                {
                    key: 'number',
                    create: () => 123,
                },
                {
                    key: 'string',
                    create: () => 'hello',
                },
                {
                    key: 'boolean',
                    create: () => true,
                },
            ],
        });

        @ccclass('OneOfPrimitiveHost')
        class OneOfPrimitiveHost {
            @property({
                type: oneOfType,
            })
            public value: OneOfPrimitiveValue = 'hello';
        }

        const host = new OneOfPrimitiveHost();
        const staticAttrs = CCClass.Attr.attr(OneOfPrimitiveHost, 'value');
        const switchPropertyName = getOneOfSwitchPropertyName('value');
        let attrs = CCClass.Attr.attr(host, 'value');

        expect(attrs.type).toBe('String');
        expect(attrs).not.toHaveProperty('default');
        expect(attrs.userData.oneOf.currentKey).toBe('string');
        expect(attrs.userData.oneOf.currentVariantIndex).toBe(1);
        expect(attrs.userData.oneOf.variants).toBe(staticAttrs.userData.oneOf.variants);
        expect(attrs.userData.oneOf.variants[0]).toMatchObject({
            key: 'number',
        });
        expect(attrs.userData.oneOf.variants[1]).toMatchObject({
            key: 'string',
        });
        expect(attrs.userData.oneOf.variants[2]).toMatchObject({
            key: 'boolean',
        });
        expect(attrs.userData.oneOf.variants[0]).not.toHaveProperty('type');
        expect(attrs.userData.oneOf.variants[1]).not.toHaveProperty('type');
        expect(attrs.userData.oneOf.variants[2]).not.toHaveProperty('type');

        (host as Record<string, unknown>)[switchPropertyName] = `${ONE_OF_SWITCH_COMMAND_PREFIX}0`;
        attrs = CCClass.Attr.attr(host, 'value');

        expect(host.value).toBe(123);
        expect(attrs.type).toBe('Number');
        expect(attrs).not.toHaveProperty('default');
        expect(attrs.userData.oneOf.currentKey).toBe('number');
        expect(attrs.userData.oneOf.currentVariantIndex).toBe(0);
        expect(attrs.userData.oneOf.variants).toBe(staticAttrs.userData.oneOf.variants);
        expect(attrs.userData.oneOf.variants[0]).toMatchObject({
            key: 'number',
        });
        expect(attrs.userData.oneOf.variants[0]).not.toHaveProperty('type');

        (host as Record<string, unknown>)[switchPropertyName] = `${ONE_OF_SWITCH_COMMAND_PREFIX}2`;
        attrs = CCClass.Attr.attr(host, 'value');

        expect(host.value).toBe(true);
        expect(attrs.type).toBe('Boolean');
        expect(attrs).not.toHaveProperty('default');
        expect(attrs.userData.oneOf.currentKey).toBe('boolean');
        expect(attrs.userData.oneOf.currentVariantIndex).toBe(2);
        expect(attrs.userData.oneOf.variants).toBe(staticAttrs.userData.oneOf.variants);
        expect(attrs.userData.oneOf.variants[2]).toMatchObject({
            key: 'boolean',
        });
        expect(attrs.userData.oneOf.variants[2]).not.toHaveProperty('type');

        (host as Record<string, unknown>)[switchPropertyName] = `${ONE_OF_SWITCH_COMMAND_PREFIX}1`;
        attrs = CCClass.Attr.attr(host, 'value');

        expect(host.value).toBe('hello');
        expect(attrs.type).toBe('String');
        expect(attrs).not.toHaveProperty('default');
        expect(attrs.userData.oneOf.currentKey).toBe('string');
        expect(attrs.userData.oneOf.currentVariantIndex).toBe(1);
        expect(attrs.userData.oneOf.variants).toBe(staticAttrs.userData.oneOf.variants);
    });

    test('OneOf switch command creates selected variant on the original property', () => {
        @ccclass('OneOfSwitchDog')
        class OneOfSwitchDog {
            public readonly category = 'dog';

            @property
            public woof = true;
        }

        @ccclass('OneOfSwitchCat')
        class OneOfSwitchCat {
            public readonly category = 'cat';

            @property
            public meow = '';
        }

        type OneOfSwitchDuck = OneOfSwitchDog | OneOfSwitchCat;

        const oneOfType = OneOf<OneOfSwitchDuck>({
            discriminator: (value) => value.category,
            variants: [
                {
                    key: 'dog',
                    create: () => new OneOfSwitchDog(),
                },
                {
                    key: 'cat',
                    create: () => new OneOfSwitchCat(),
                    label: 'Cat',
                },
            ],
        });

        @ccclass('OneOfSwitchHost')
        class OneOfSwitchHost {
            @property({
                type: oneOfType,
            })
            public value: OneOfSwitchDuck = new OneOfSwitchDog();
        }

        const host = new OneOfSwitchHost();
        const switchPropertyName = getOneOfSwitchPropertyName('value');
        expect(CCClass.Attr.attr(host, 'value').ctor).toBe(OneOfSwitchDog);

        (host as Record<string, unknown>)[switchPropertyName] = `${ONE_OF_SWITCH_COMMAND_PREFIX}1`;

        expect(host.value).toBeInstanceOf(OneOfSwitchCat);
        expect(host.value.category).toBe('cat');
        expect(CCClass.Attr.attr(host, 'value').ctor).toBe(OneOfSwitchCat);
        expect(CCClass.Attr.attr(host, 'value').userData.oneOf.currentVariantIndex).toBe(1);

        (host as Record<string, unknown>)[switchPropertyName] = `${ONE_OF_SWITCH_COMMAND_PREFIX}100`;

        expect(host.value).toBeInstanceOf(OneOfSwitchCat);
    });

    test('OneOf switch command calls user setter with the created variant only', () => {
        @ccclass('OneOfSwitchSetterDog')
        class OneOfSwitchSetterDog {
            public readonly category = 'dog';
        }

        @ccclass('OneOfSwitchSetterCat')
        class OneOfSwitchSetterCat {
            public readonly category = 'cat';
        }

        type OneOfSwitchSetterDuck = OneOfSwitchSetterDog | OneOfSwitchSetterCat;

        const oneOfType = OneOf<OneOfSwitchSetterDuck>({
            discriminator: (value) => value.category,
            variants: [
                {
                    key: 'dog',
                    create: () => new OneOfSwitchSetterDog(),
                },
                {
                    key: 'cat',
                    create: () => new OneOfSwitchSetterCat(),
                },
            ],
        });

        @ccclass('OneOfSwitchSetterHost')
        class OneOfSwitchSetterHost {
            public readonly seen: unknown[] = [];

            private _value: OneOfSwitchSetterDuck = new OneOfSwitchSetterDog();

            @property({
                type: oneOfType,
            })
            public get value (): OneOfSwitchSetterDuck {
                return this._value;
            }

            public set value (value: OneOfSwitchSetterDuck) {
                this.seen.push(value);
                this._value = value;
            }
        }

        const host = new OneOfSwitchSetterHost();
        host.seen.length = 0;
        const command = `${ONE_OF_SWITCH_COMMAND_PREFIX}1`;

        (host as Record<string, unknown>)[getOneOfSwitchPropertyName('value')] = command;

        expect(host.seen).toHaveLength(1);
        expect(host.seen[0]).toBeInstanceOf(OneOfSwitchSetterCat);
        expect(host.seen[0]).not.toBe(command);
        expect(host.value).toBeInstanceOf(OneOfSwitchSetterCat);
    });

    test('OneOf switch command only updates the selected property', () => {
        @ccclass('OneOfSwitchIsolatedDog')
        class OneOfSwitchIsolatedDog {
            public readonly category = 'dog';
        }

        @ccclass('OneOfSwitchIsolatedCat')
        class OneOfSwitchIsolatedCat {
            public readonly category = 'cat';
        }

        type OneOfSwitchIsolatedDuck = OneOfSwitchIsolatedDog | OneOfSwitchIsolatedCat;

        const oneOfType = OneOf<OneOfSwitchIsolatedDuck>({
            discriminator: (value) => value.category,
            variants: [
                {
                    key: 'dog',
                    create: () => new OneOfSwitchIsolatedDog(),
                },
                {
                    key: 'cat',
                    create: () => new OneOfSwitchIsolatedCat(),
                },
            ],
        });

        @ccclass('OneOfSwitchIsolatedHost')
        class OneOfSwitchIsolatedHost {
            public readonly seen: string[] = [];

            private _first: OneOfSwitchIsolatedDuck = new OneOfSwitchIsolatedDog();

            private _second: OneOfSwitchIsolatedDuck = new OneOfSwitchIsolatedDog();

            @property({
                type: oneOfType,
            })
            public get first (): OneOfSwitchIsolatedDuck {
                return this._first;
            }

            public set first (value: OneOfSwitchIsolatedDuck) {
                this.seen.push('first');
                this._first = value;
            }

            @property({
                type: oneOfType,
            })
            public get second (): OneOfSwitchIsolatedDuck {
                return this._second;
            }

            public set second (value: OneOfSwitchIsolatedDuck) {
                this.seen.push('second');
                this._second = value;
            }
        }

        const host = new OneOfSwitchIsolatedHost();
        host.seen.length = 0;
        (host as Record<string, unknown>)[getOneOfSwitchPropertyName('first')] = `${ONE_OF_SWITCH_COMMAND_PREFIX}1`;

        expect(host.seen).toStrictEqual(['first']);
        expect(host.first).toBeInstanceOf(OneOfSwitchIsolatedCat);
        expect(host.second).toBeInstanceOf(OneOfSwitchIsolatedDog);

        (host as Record<string, unknown>)[getOneOfSwitchPropertyName('second')] = `${ONE_OF_SWITCH_COMMAND_PREFIX}1`;

        expect(host.seen).toStrictEqual(['first', 'second']);
        expect(host.second).toBeInstanceOf(OneOfSwitchIsolatedCat);
    });

    test('OneOf switch command recreates the current variant for root reset', () => {
        /// @case
        /// 1. A OneOf root property currently holds a modified Cat variant.
        /// 2. The Inspector resets the root by sending the current variant switch command.
        /// @expect
        /// The root property is replaced with a fresh Cat variant instead of falling back to the class default variant.
        @ccclass('OneOfResetDog')
        class OneOfResetDog {
            public readonly category = 'dog';
        }

        @ccclass('OneOfResetCat')
        class OneOfResetCat {
            public readonly category = 'cat';

            @property
            public meow = 'default';
        }

        type OneOfResetDuck = OneOfResetDog | OneOfResetCat;

        const oneOfType = OneOf<OneOfResetDuck>({
            discriminator: (value) => value.category,
            variants: [
                {
                    key: 'dog',
                    create: () => new OneOfResetDog(),
                },
                {
                    key: 'cat',
                    create: () => new OneOfResetCat(),
                },
            ],
        });

        @ccclass('OneOfResetHost')
        class OneOfResetHost {
            @property({
                type: oneOfType,
            })
            public value: OneOfResetDuck = new OneOfResetDog();
        }

        const host = new OneOfResetHost();
        const oldCat = new OneOfResetCat();
        oldCat.meow = 'edited';
        host.value = oldCat;

        (host as Record<string, unknown>)[getOneOfSwitchPropertyName('value')] = `${ONE_OF_SWITCH_COMMAND_PREFIX}1`;

        expect(host.value).toBeInstanceOf(OneOfResetCat);
        expect(host.value).not.toBe(oldCat);
        expect((host.value as OneOfResetCat).meow).toBe('default');
    });

    test('OneOf switch command supports getter-only field discriminators', () => {
        /// @case
        /// 1. A field-discriminated OneOf variant exposes its discriminator through a getter.
        /// 2. The Inspector switches the root property to that variant.
        /// @expect
        /// The switch succeeds without OneOf attempting to write the discriminator field.
        @ccclass('OneOfGetterDog')
        class OneOfGetterDog {
            public get type (): string {
                return 'dog';
            }
        }

        @ccclass('OneOfGetterCat')
        class OneOfGetterCat {
            public get type (): string {
                return 'cat';
            }
        }

        type OneOfGetterDuck = OneOfGetterDog | OneOfGetterCat;

        const oneOfType = OneOf<OneOfGetterDuck>({
            discriminator: 'type',
            variants: [
                {
                    key: 'dog',
                    type: OneOfGetterDog,
                },
                {
                    key: 'cat',
                    type: OneOfGetterCat,
                },
            ],
        });

        @ccclass('OneOfGetterHost')
        class OneOfGetterHost {
            @property({
                type: oneOfType,
            })
            public value: OneOfGetterDuck = new OneOfGetterDog();
        }

        const host = new OneOfGetterHost();
        const warnings = captureWarns();

        (host as Record<string, unknown>)[getOneOfSwitchPropertyName('value')] = `${ONE_OF_SWITCH_COMMAND_PREFIX}1`;

        expect(host.value).toBeInstanceOf(OneOfGetterCat);
        expect(host.value.type).toBe('cat');
        expect(warnings.captured).toHaveLength(0);
        warnings.stop();
    });

    test('OneOf static tag allows deserializing embedded concrete variant objects', () => {
        /// @case
        /// 1. A class declares a field-discriminated OneOf property.
        /// 2. Serialized data stores a concrete variant object in that property.
        /// @expect
        /// Deserialization restores the concrete variant instance even though the static property type tag is OneOf.
        @ccclass('OneOfDeserializeDog')
        class OneOfDeserializeDog {
            @property
            public category = 'dog';

            @property
            public woof = true;
        }

        @ccclass('OneOfDeserializeCat')
        class OneOfDeserializeCat {
            @property
            public category = 'cat';

            @property
            public meow = '';
        }

        type OneOfDeserializeDuck = OneOfDeserializeDog | OneOfDeserializeCat;

        const oneOfType = OneOf<OneOfDeserializeDuck>({
            discriminator: 'category',
            variants: [
                {
                    key: 'dog',
                    type: OneOfDeserializeDog,
                },
                {
                    key: 'cat',
                    type: OneOfDeserializeCat,
                },
            ],
        });

        @ccclass('OneOfDeserializeHost')
        class OneOfDeserializeHost {
            @property({
                type: oneOfType,
            })
            public value: OneOfDeserializeDuck = new OneOfDeserializeDog();
        }

        expect(CCClass.Attr.attr(OneOfDeserializeHost, 'value').type).toBe('OneOf');

        const deserialized = deserialize({
            __type__: 'OneOfDeserializeHost',
            value: {
                __type__: 'OneOfDeserializeCat',
                category: 'cat',
                meow: 'loaded',
            },
        }) as OneOfDeserializeHost;

        expect(deserialized).toBeInstanceOf(OneOfDeserializeHost);
        expect(deserialized.value).toBeInstanceOf(OneOfDeserializeCat);
        expect(deserialized.value.category).toBe('cat');
        expect((deserialized.value as OneOfDeserializeCat).meow).toBe('loaded');
    });

    test('OneOf dynamic attrs do not create variant defaults during metadata lookup', () => {
        /// @case
        /// 1. A OneOf variant provides both a type and a throwing create factory.
        /// 2. The Inspector asks for dynamic attrs for the current variant without resetting or switching.
        /// @expect
        /// Attribute lookup does not call the create factory and does not expose a synthesized variant default.
        class OneOfThrowingValue {
            public readonly category = 'bad';
        }

        const oneOfType = OneOf<OneOfThrowingValue>({
            discriminator: 'category',
            variants: [
                {
                    key: 'bad',
                    type: OneOfThrowingValue,
                    create: () => {
                        throw new Error('create failed');
                    },
                },
            ],
        });

        @ccclass('OneOfThrowingHost')
        class OneOfThrowingHost {
            @property({
                type: oneOfType,
            })
            public value: OneOfThrowingValue = new OneOfThrowingValue();
        }

        const warnings = captureWarns();
        const attrs = CCClass.Attr.attr(new OneOfThrowingHost(), 'value');

        expect(attrs).not.toHaveProperty('default');
        expect(attrs.ctor).toBe(OneOfThrowingValue);
        expect(warnings.captured).toHaveLength(0);
        warnings.stop();
    });

    test('OneOf switch command warns in DEV when variant creation fails', () => {
        /// @case
        /// 1. A OneOf switch command selects a variant whose create factory throws.
        /// 2. The hidden switch setter handles the command.
        /// @expect
        /// The previous value is preserved and a DEV warning reports the failed variant creation.
        class OneOfStableValue {
            public readonly category = 'stable';
        }

        class OneOfBrokenValue {
            public readonly category = 'broken';
        }

        type OneOfThrowingSwitchValue = OneOfStableValue | OneOfBrokenValue;

        const oneOfType = OneOf<OneOfThrowingSwitchValue>({
            discriminator: 'category',
            variants: [
                {
                    key: 'stable',
                    create: () => new OneOfStableValue(),
                },
                {
                    key: 'broken',
                    type: OneOfBrokenValue,
                    create: () => {
                        throw new Error('create failed');
                    },
                },
            ],
        });

        @ccclass('OneOfThrowingSwitchHost')
        class OneOfThrowingSwitchHost {
            @property({
                type: oneOfType,
            })
            public value: OneOfThrowingSwitchValue = new OneOfStableValue();
        }

        const host = new OneOfThrowingSwitchHost();
        const previous = host.value;
        const warnings = captureWarns();

        (host as Record<string, unknown>)[getOneOfSwitchPropertyName('value')] = `${ONE_OF_SWITCH_COMMAND_PREFIX}1`;

        expect(host.value).toBe(previous);
        expect(warnings.captured).toHaveLength(1);
        expect(warnings.captured[0][0]).toMatch('[OneOf] Failed to create variant 1 for property "value"');
        warnings.stop();
    });
});
