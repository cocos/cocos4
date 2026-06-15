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

import { DEV, EDITOR, TEST } from 'internal:constants';
import { warn } from '../../platform/debug';
import { getClassId, getClassName, isChildClassOf } from '../../utils/js';
import type { IExposedAttributesUserData } from '../utils/attribute-defines';

export const ONE_OF_TYPE_TAG = 'OneOf';

export const ONE_OF_SWITCH_COMMAND_PREFIX = '__cc_oneof_switch__:';

export const ONE_OF_SWITCH_PROPERTY_PREFIX = '__cc_oneOfSwitch_';

const ONE_OF_BRAND = '__ccOneOfPropertyType__';

type OneOfPrimitiveAttributeType = 'Number' | 'String' | 'Boolean';

const oneOfSwitchAccessorRegistry = new WeakMap<Function, Set<string>>();

export type OneOfKey = string | number | boolean | null;

type NoInferType<T> = [T][T extends unknown ? 0 : never];

// eslint-disable-next-line @typescript-eslint/ban-types
export type OneOfConstructor<T = unknown> = Function & { prototype: T };

export type OneOfDiscriminator<T = unknown>
    = string
    | ((value: T) => OneOfKey)
    | {
        kind?: 'field';
        property: string;
    }
    | {
        kind: 'type-id';
    };

export type NormalizedOneOfDiscriminator<T = unknown>
    = {
        kind: 'type-id';
    }
    | {
        kind: 'field';
        property: string;
    }
    | {
        kind: 'function';
        get: (value: T) => OneOfKey;
    };

export interface OneOfTypedVariant<T = unknown> {
    type: OneOfConstructor<T>;
    label?: string;
    key?: OneOfKey;
    create?: () => NoInferType<T>;
}

export interface OneOfKeyVariant<T = unknown> {
    key: OneOfKey;
    create: () => unknown;
    label?: string;
    type?: OneOfConstructor<T>;
}

export type OneOfVariant<T = unknown>
    = OneOfConstructor<T>
      | OneOfTypedVariant<T>
      | OneOfKeyVariant<T>;

export interface NormalizedOneOfVariant<T = unknown> {
    type?: OneOfConstructor<T>;
    label?: string;
    key?: OneOfKey;
    create?: () => unknown;
}

interface OneOfAttributeUserData {
    discriminator:
        | { kind: 'type-id'; }
        | { kind: 'field'; property: string; }
        | { kind: 'function'; };
    switchType: 'String';
    switchCommandPrefix: string;
    switchPropertyName: string;
    variants: OneOfVariantAttributeUserData[];
}

interface OneOfVariantAttributeUserData {
    type?: string;
    typeId?: string;
    label?: string;
    key?: string | number | boolean | null;
    creatable: boolean;
}

export interface OneOfOptions<T = unknown> {
    variants: readonly OneOfVariant<T>[];
    discriminator?: OneOfDiscriminator<T>;
}

export class OneOfPropertyType<T = unknown> {
    public readonly [ONE_OF_BRAND]!: true;

    public readonly discriminator: NormalizedOneOfDiscriminator<T>;

    public readonly variants: readonly NormalizedOneOfVariant<T>[];

    public constructor (options: OneOfOptions<T>) {
        Object.defineProperty(this, ONE_OF_BRAND, {
            value: true,
        });

        if (!Array.isArray(options.variants) || options.variants.length === 0) {
            throw new TypeError('OneOf variants must contain at least one variant.');
        }

        const variants: NormalizedOneOfVariant<T>[] = options.variants.map((variant) => (
            Object.freeze(normalizeVariant<T>(variant))
        ));

        this.discriminator = normalizeDiscriminator(options.discriminator);
        this.variants = Object.freeze(variants);
        validateVariants(this.discriminator, this.variants);
        Object.freeze(this);
    }
}

export function OneOf<T = unknown> (options: OneOfOptions<T>): OneOfPropertyType<T> {
    return new OneOfPropertyType(options);
}

export function isOneOfPropertyType (value: unknown): value is OneOfPropertyType {
    return typeof value === 'object'
        && value !== null
        && (value as { [ONE_OF_BRAND]?: boolean })[ONE_OF_BRAND] === true;
}

export function getOneOfSwitchCommandIndex (value: unknown): number | undefined {
    if (typeof value !== 'string' || !value.startsWith(ONE_OF_SWITCH_COMMAND_PREFIX)) {
        return undefined;
    }

    const suffix = value.slice(ONE_OF_SWITCH_COMMAND_PREFIX.length);
    if (!/^(0|[1-9]\d*)$/.test(suffix)) {
        return undefined;
    }

    const index = Number(suffix);
    return Number.isInteger(index) && index >= 0 ? index : undefined;
}

export function getOneOfSwitchPropertyName (propertyName: string): string {
    return `${ONE_OF_SWITCH_PROPERTY_PREFIX}${propertyName}`;
}

export function createOneOfVariantValue (oneOfType: OneOfPropertyType, index: number): unknown {
    const variant = oneOfType.variants[index];
    if (!variant) {
        return undefined;
    }

    let value: unknown;
    if (variant.create) {
        value = variant.create();
    } else if (variant.type) {
        value = new (variant.type as unknown as new () => unknown)();
    } else {
        return undefined;
    }

    return value;
}

export function applyOneOfPropertyAttributes (
    attrs: { [attributeName: string]: any; },
    constructor: Function,
    propertyName: string,
    propertyNamePrefix: string,
    type: unknown,
): void {
    if (!isOneOfPropertyType(type)) {
        return;
    }

    attrs[`${propertyNamePrefix}type`] = ONE_OF_TYPE_TAG;
    attrs[`${propertyNamePrefix}oneOf`] = type;

    const userDataKey = `${propertyNamePrefix}userData`;
    attrs[userDataKey] = mergeOneOfAttributeUserData(
        attrs[userDataKey],
        type,
        propertyName,
    );
    if (EDITOR || TEST) {
        installOneOfSwitchVirtualAccessor(constructor, propertyName, type);
    }
}

export function applyDynamicOneOfAttrs (
    owner: any,
    attrs: { [attributeName: string]: any; },
    propertyName: string,
): { [attributeName: string]: any; } {
    if (!owner || typeof owner === 'function' || !attrs.oneOf) {
        return attrs;
    }

    const oneOf = attrs.oneOf as OneOfPropertyType;
    const value = owner[propertyName];
    const current = findCurrentOneOfVariant(oneOf, value);
    if (!current) {
        return attrs;
    }

    const nextAttrs = { ...attrs };
    delete nextAttrs.default;
    const primitiveType = getOneOfValuePrimitiveType(value);
    let ctor: Function | undefined;
    if (primitiveType) {
        nextAttrs.type = primitiveType;
        delete nextAttrs.ctor;
    } else {
        const variantCtor = getOneOfVariantCtor(current.variant);
        ctor = getOneOfValueCtor(value)
            || (variantCtor && isOneOfValueOfCtor(value, variantCtor) ? variantCtor : undefined);
        if (ctor) {
            nextAttrs.type = 'Object';
            nextAttrs.ctor = ctor;
        }
    }

    if (attrs.userData && typeof attrs.userData === 'object') {
        nextAttrs.userData = getDynamicOneOfUserData(
            attrs.userData,
            current.index,
            current.key,
        );
    }

    return nextAttrs;
}

function installOneOfSwitchVirtualAccessor (
    constructor: Function,
    propertyName: string,
    oneOfType: OneOfPropertyType,
): void {
    let props = oneOfSwitchAccessorRegistry.get(constructor);
    if (!props) {
        props = new Set<string>();
        oneOfSwitchAccessorRegistry.set(constructor, props);
    }

    const switchPropertyName = getOneOfSwitchPropertyName(propertyName);
    if (props.has(switchPropertyName)) {
        return;
    }

    const prototype = constructor.prototype as Record<string, unknown>;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, switchPropertyName);
    if (descriptor && !descriptor.configurable) {
        return;
    }

    Object.defineProperty(prototype, switchPropertyName, {
        configurable: true,
        enumerable: false,
        set (value: unknown) {
            const index = getOneOfSwitchCommandIndex(value);
            if (index === undefined || index >= oneOfType.variants.length) {
                return;
            }
            try {
                (this as Record<string, unknown>)[propertyName] = createOneOfVariantValue(oneOfType, index);
            } catch (error) {
                if (DEV) {
                    warn(`[OneOf] Failed to create variant ${index} for property "${propertyName}":`, error);
                }
            }
        },
    });

    props.add(switchPropertyName);
}

function mergeOneOfAttributeUserData (
    userData: unknown,
    oneOfType: OneOfPropertyType,
    propertyName: string,
): IExposedAttributesUserData {
    const merged = userData && typeof userData === 'object' && !Array.isArray(userData)
        ? { ...(userData as IExposedAttributesUserData) }
        : {};
    merged.oneOf = getOneOfAttributeUserData(oneOfType, propertyName);
    return merged;
}

function getOneOfAttributeUserData (
    oneOfType: OneOfPropertyType,
    propertyName: string,
): OneOfAttributeUserData {
    const discriminator = oneOfType.discriminator.kind === 'function'
        ? { kind: 'function' as const }
        : oneOfType.discriminator;
    return {
        discriminator,
        switchType: 'String',
        switchCommandPrefix: ONE_OF_SWITCH_COMMAND_PREFIX,
        switchPropertyName: getOneOfSwitchPropertyName(propertyName),
        variants: oneOfType.variants.map((variant) => {
            const data: OneOfVariantAttributeUserData = {
                creatable: !!(variant.type || variant.create),
            };
            if (variant.type) {
                const type = getClassName(variant.type) || variant.type.name;
                if (type) {
                    data.type = type;
                }
                const typeId = getClassId(variant.type);
                if (typeId) {
                    data.typeId = typeId;
                }
            }
            if (variant.label) {
                data.label = variant.label;
            }
            if ('key' in variant) {
                data.key = variant.key;
            }
            return data;
        }),
    };
}

function findCurrentOneOfVariant (
    oneOf: OneOfPropertyType,
    value: unknown,
): { variant: NormalizedOneOfVariant; index: number; key?: OneOfKey } | undefined {
    switch (oneOf.discriminator.kind) {
    case 'field': {
        if (!value || typeof value !== 'object') {
            return undefined;
        }
        const key = (value as Record<string, unknown>)[oneOf.discriminator.property];
        return isOneOfKey(key) ? findOneOfVariantByKey(oneOf, key) : undefined;
    }
    case 'function': {
        if (value == null) {
            return undefined;
        }
        let key: unknown;
        try {
            key = oneOf.discriminator.get(value);
        } catch (error) {
            return undefined;
        }
        return isOneOfKey(key) ? findOneOfVariantByKey(oneOf, key) : undefined;
    }
    default:
        return findOneOfVariantByType(oneOf, value);
    }
}

function findOneOfVariantByKey (
    oneOf: OneOfPropertyType,
    key: OneOfKey,
): { variant: NormalizedOneOfVariant; index: number; key: OneOfKey } | undefined {
    const index = oneOf.variants.findIndex((variant) => 'key' in variant && variant.key === key);
    return index === -1
        ? undefined
        : { variant: oneOf.variants[index], index, key };
}

function findOneOfVariantByType (
    oneOf: OneOfPropertyType,
    value: unknown,
): { variant: NormalizedOneOfVariant; index: number } | undefined {
    if (!value || typeof value !== 'object') {
        return undefined;
    }

    const ctor = (value as { constructor?: Function }).constructor;
    const index = oneOf.variants.findIndex((variant) => {
        const variantCtor = getOneOfVariantCtor(variant);
        return !!variantCtor && !!ctor && (ctor === variantCtor || isChildClassOf(ctor, variantCtor as never));
    });
    return index === -1
        ? undefined
        : { variant: oneOf.variants[index], index };
}

function getOneOfValueCtor (value: unknown): Function | undefined {
    if (!value || typeof value !== 'object') {
        return undefined;
    }

    const ctor = (value as { constructor?: Function }).constructor;
    return ctor && ctor !== Object ? ctor : undefined;
}

function getOneOfValuePrimitiveType (value: unknown): OneOfPrimitiveAttributeType | undefined {
    switch (typeof value) {
    case 'number':
        return 'Number';
    case 'string':
        return 'String';
    case 'boolean':
        return 'Boolean';
    default:
        return undefined;
    }
}

function isOneOfValueOfCtor (value: unknown, ctor: Function): boolean {
    if (!value || typeof value !== 'object') {
        return false;
    }

    try {
        return value instanceof (ctor as never);
    } catch (error) {
        return false;
    }
}

function getOneOfVariantCtor (variant: NormalizedOneOfVariant): Function | undefined {
    return variant.type;
}

function getDynamicOneOfUserData (
    userData: Record<string, any>,
    variantIndex: number,
    key: OneOfKey | undefined,
): Record<string, any> {
    const oneOfUserData = userData.oneOf;
    if (!oneOfUserData || typeof oneOfUserData !== 'object') {
        return userData;
    }

    return {
        ...userData,
        oneOf: {
            ...oneOfUserData,
            currentKey: key,
            currentVariantIndex: variantIndex,
        },
    };
}

function normalizeDiscriminator<T> (discriminator: OneOfDiscriminator<T> | undefined): NormalizedOneOfDiscriminator<T> {
    if (typeof discriminator === 'undefined') {
        return {
            kind: 'type-id',
        };
    }

    if (typeof discriminator === 'string') {
        if (discriminator.length === 0) {
            throw new TypeError('OneOf discriminator property must be a non-empty string.');
        }
        return {
            kind: 'field',
            property: discriminator,
        };
    }

    if (typeof discriminator === 'function') {
        return {
            kind: 'function',
            get: discriminator,
        };
    }

    if (discriminator.kind === 'type-id') {
        return {
            kind: 'type-id',
        };
    }

    if (typeof discriminator.property !== 'string' || discriminator.property.length === 0) {
        throw new TypeError('OneOf discriminator property must be a non-empty string.');
    }

    return {
        kind: 'field',
        property: discriminator.property,
    };
}

function normalizeVariant<T> (variant: OneOfVariant<T>): NormalizedOneOfVariant<T> {
    if (typeof variant === 'function') {
        return {
            type: variant,
        };
    }

    if (typeof variant !== 'object' || variant === null) {
        throw new TypeError('OneOf variant must be a constructor or an object.');
    }

    const normalized: NormalizedOneOfVariant<T> = {};
    if ('type' in variant && typeof variant.type !== 'undefined') {
        if (typeof variant.type !== 'function') {
            throw new TypeError('OneOf variant type must be a constructor.');
        }
        normalized.type = variant.type;
    }
    if ('label' in variant && typeof variant.label !== 'undefined') {
        if (typeof variant.label !== 'string') {
            throw new TypeError('OneOf variant label must be a string.');
        }
        normalized.label = variant.label;
    }
    if ('key' in variant) {
        if (!isOneOfKey(variant.key)) {
            throw new TypeError('OneOf variant key must be a string, number, boolean, or null.');
        }
        normalized.key = variant.key;
    }
    if ('create' in variant && typeof variant.create !== 'undefined') {
        if (typeof variant.create !== 'function') {
            throw new TypeError('OneOf variant create must be a function.');
        }
        normalized.create = variant.create;
    }
    return normalized;
}

function validateVariants<T> (
    discriminator: NormalizedOneOfDiscriminator<T>,
    variants: readonly NormalizedOneOfVariant<T>[],
): void {
    if (discriminator.kind === 'type-id') {
        for (const variant of variants) {
            if (!variant.type) {
                throw new TypeError('OneOf type-id variants must specify a type.');
            }
        }
        return;
    }

    const keys = new Set<OneOfKey>();
    for (const variant of variants) {
        if (!('key' in variant)) {
            throw new TypeError('OneOf discriminated variants must specify a key.');
        }
        if (keys.has(variant.key)) {
            throw new TypeError('OneOf discriminated variants must use unique keys.');
        }
        keys.add(variant.key);
        if (!variant.type && !variant.create) {
            throw new TypeError('OneOf discriminated variants must specify a type or create function.');
        }
    }
}

function isOneOfKey (value: unknown): value is OneOfKey {
    return value === null
        || typeof value === 'string'
        || typeof value === 'number'
        || typeof value === 'boolean';
}
