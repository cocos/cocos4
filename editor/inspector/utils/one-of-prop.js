const oneOfSwitchCommandPrefix = '__cc_oneof_switch__:';

exports.isOneOfDump = function(info) {
    return !!info
        && !!info.userData
        && !!info.userData.oneOf
        && Array.isArray(info.userData.oneOf.variants);
};

exports.normalizeOneOfDumpForRender = function(info) {
    if (!exports.isOneOfDump(info)) {
        return info;
    }

    const oneOf = info.userData.oneOf;
    const currentIndex = Number.isInteger(oneOf.currentVariantIndex) ? oneOf.currentVariantIndex : -1;
    const currentVariant = currentIndex >= 0 ? oneOf.variants[currentIndex] : undefined;
    const type = currentVariant && currentVariant.type || getOneOfPrimitiveDumpTypeFromValue(info.value);
    if (!isOneOfPrimitiveDumpType(type)) {
        return info;
    }

    const normalized = {
        ...info,
        type,
    };
    if (
        Object.prototype.hasOwnProperty.call(normalized, 'default')
        && !isOneOfPrimitiveValueOfType(normalized.default, type)
    ) {
        delete normalized.default;
    }
    return normalized;
};

exports.decorateOneOfPropElement = function(propUtils, $prop, info) {
    if (!exports.isOneOfDump(info)) {
        exports.clearOneOfPropElement($prop);
        return;
    }

    const $select = getOrCreateOneOfSelect($prop);
    renderOneOfSelect(propUtils, $select, info);
    installOneOfLayoutObserver($prop);
    placeOneOfSelect($prop, $select);
};

exports.clearOneOfPropElement = function($prop) {
    if (!$prop) {
        return;
    }

    uninstallOneOfLayoutObserver($prop);
    if (!$prop.$oneOfSelect) {
        return;
    }

    restoreOneOfAnchorFlex($prop.$oneOfSelect);
    $prop.$oneOfSelect.remove();
    delete $prop.$oneOfSelect;
    uninstallOneOfSelectEvents($prop);
};

function getOrCreateOneOfSelect($prop) {
    if ($prop.$oneOfSelect) {
        return $prop.$oneOfSelect;
    }

    const $select = document.createElement('ui-select');
    $select.classList.add('one-of-select');
    $select.style.cssText = 'flex: none; width: 96px; min-width: 72px; margin-left: 6px; margin-right: 4px;';
    ['click', 'mousedown', 'mouseup'].forEach((eventName) => {
        $select.addEventListener(eventName, (event) => {
            event.stopPropagation();
        });
    });
    $prop.$oneOfSelect = $select;
    installOneOfSelectEvents($prop);
    return $select;
}

function renderOneOfSelect(propUtils, $select, info) {
    const oneOf = info.userData.oneOf;
    const variants = oneOf.variants || [];
    const currentIndex = Number.isInteger(oneOf.currentVariantIndex) ? oneOf.currentVariantIndex : -1;
    $select.$oneOfDump = info;
    $select.innerHTML = variants.map((variant, index) => {
        const label = escapeHtml(getOneOfVariantLabel(variant, index));
        return `<option value="${index}">${label}</option>`;
    }).join('');
    $select.value = currentIndex >= 0 ? `${currentIndex}` : '';
    propUtils.setReadonly(!!info.readonly, $select);
}

function placeOneOfSelect($prop, $select) {
    const placement = getOneOfSelectPlacement($prop, $select);

    if (placement.container === $prop) {
        $prop.removeAttribute('no-label');
        clearOneOfObjectHostStyleResidue($prop);
        $select.setAttribute('slot', 'label');
    } else {
        $select.removeAttribute('slot');
    }

    updateOneOfAnchorFlex($select, placement.anchor);

    if ($select.parentElement !== placement.container || $select.nextSibling !== placement.before) {
        placement.container.insertBefore($select, placement.before);
    }
}

function getOneOfSelectPlacement($prop, $select) {
    const header = $prop.querySelector('ui-section > [slot="header"]');
    if (header) {
        const anchor = getOneOfHeaderAnchor(header);
        return {
            container: header,
            before: anchor ? getNodeAfterAnchor(anchor, $select) : getFirstNonSelectChild(header, $select),
            anchor,
        };
    }

    const anchor = getOneOfLabelSlotAnchor($prop);
    return {
        container: $prop,
        before: anchor ? getNodeAfterAnchor(anchor, $select) : getFirstNonSelectChild($prop, $select),
        anchor,
    };
}

function getOneOfHeaderAnchor($header) {
    return $header.querySelector('ui-label[type]')
        || $header.querySelector('ui-label[name]')
        || $header.querySelector('ui-label')
        || null;
}

function getOneOfLabelSlotAnchor($prop) {
    const slottedLabels = getOneOfLabelSlotNodes($prop);
    return slottedLabels.length ? slottedLabels[slottedLabels.length - 1] : null;
}

function getOneOfLabelSlotNodes($prop) {
    return Array.from($prop.children)
        .filter(($node) => $node.getAttribute('slot') === 'label'
            && !$node.classList.contains('one-of-select'));
}

function clearOneOfObjectHostStyleResidue($prop) {
    const $style = $prop.shadowRoot && $prop.shadowRoot.querySelector('#custom-style');
    if (!$style || !/^:host\s*\{\s*margin-left:\s*0;?\s*\}$/.test($style.innerHTML.trim())) {
        return;
    }

    $style.innerHTML = '';
}

function installOneOfLayoutObserver($prop) {
    if ($prop.$oneOfLayoutObserver || typeof MutationObserver !== 'function') {
        return;
    }

    $prop.$oneOfLayoutObserver = new MutationObserver(() => {
        const $select = $prop.$oneOfSelect;
        if (!$select || !$select.$oneOfDump || !exports.isOneOfDump($select.$oneOfDump)) {
            return;
        }

        placeOneOfSelect($prop, $select);
    });
    $prop.$oneOfLayoutObserver.observe($prop, {
        childList: true,
    });
}

function uninstallOneOfLayoutObserver($prop) {
    if (!$prop.$oneOfLayoutObserver) {
        return;
    }

    $prop.$oneOfLayoutObserver.disconnect();
    delete $prop.$oneOfLayoutObserver;
}

function getFirstNonSelectChild($container, $select) {
    return Array.from($container.childNodes).find((child) => child !== $select) || null;
}

function getNodeAfterAnchor($anchor, $select) {
    return $anchor.nextSibling === $select ? $select.nextSibling : $anchor.nextSibling;
}

function updateOneOfAnchorFlex($select, $anchor) {
    if ($select.$oneOfAnchor === $anchor) {
        return;
    }

    restoreOneOfAnchorFlex($select);
    $select.$oneOfAnchor = $anchor;
    if (!$anchor || !$anchor.style || !$anchor.style.flex || $anchor.style.flex === 'none') {
        return;
    }

    $anchor.dataset.oneOfOriginalFlex = $anchor.style.flex;
    $anchor.style.flex = 'none';
}

function restoreOneOfAnchorFlex($select) {
    const $anchor = $select && $select.$oneOfAnchor;
    if (!$anchor || !$anchor.style) {
        return;
    }

    if ($anchor.dataset.oneOfOriginalFlex !== undefined) {
        $anchor.style.flex = $anchor.dataset.oneOfOriginalFlex;
        delete $anchor.dataset.oneOfOriginalFlex;
    }
    delete $select.$oneOfAnchor;
}

function installOneOfSelectEvents($prop) {
    if ($prop.$oneOfSelectEventHandler) {
        return;
    }

    // ui-prop(type=dump) treats bubbled change/confirm as edits of its own value.
    // The oneOf selector is a sibling control, so route it before dump listeners see it.
    $prop.$oneOfSelectEventHandler = (event) => {
        const $select = getEventOneOfSelect(event);
        if ($select !== $prop.$oneOfSelect) {
            return;
        }

        event.stopPropagation();
        event.preventDefault();

        if (event.type === 'change') {
            dispatchOneOfSwitch($prop, $select.value);
        }
    };
    $prop.addEventListener('change', $prop.$oneOfSelectEventHandler, true);
    $prop.addEventListener('confirm', $prop.$oneOfSelectEventHandler, true);
}

function uninstallOneOfSelectEvents($prop) {
    if (!$prop.$oneOfSelectEventHandler) {
        return;
    }

    $prop.removeEventListener('change', $prop.$oneOfSelectEventHandler, true);
    $prop.removeEventListener('confirm', $prop.$oneOfSelectEventHandler, true);
    delete $prop.$oneOfSelectEventHandler;
}

function getEventOneOfSelect(event) {
    if (event.target && event.target.classList && event.target.classList.contains('one-of-select')) {
        return event.target;
    }

    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    return path.find((node) => node && node.classList && node.classList.contains('one-of-select')) || null;
}

function dispatchOneOfSwitch($prop, rawIndex) {
    const index = Number(rawIndex);
    if (!Number.isInteger(index) || index < 0) {
        return;
    }

    const sourceDump = $prop.$oneOfSelect && $prop.$oneOfSelect.$oneOfDump || $prop.dump;
    const oneOf = sourceDump && sourceDump.userData && sourceDump.userData.oneOf;
    if (!oneOf) {
        return;
    }

    const prefix = oneOf.switchCommandPrefix || oneOfSwitchCommandPrefix;
    const value = `${prefix}${index}`;
    const switchPropertyName = oneOf.switchPropertyName;
    const switchDump = {
        name: switchPropertyName || sourceDump.name,
        path: getOneOfSwitchPath(sourceDump.path, switchPropertyName),
        type: oneOf.switchType || 'String',
        value,
    };
    if (sourceDump.values) {
        switchDump.values = sourceDump.values.map(() => value);
    }

    const originalDump = $prop.dump;
    $prop.dump = switchDump;
    $prop.dispatchEvent(new CustomEvent('change-dump', {
        bubbles: true,
        cancelable: true,
    }));
    $prop.dispatchEvent(new CustomEvent('confirm-dump', {
        bubbles: true,
        cancelable: true,
    }));
    $prop.dump = originalDump;
}

function getOneOfVariantLabel(variant, index) {
    if (variant.label) {
        return variant.label;
    }
    if (variant.key !== undefined) {
        return `${variant.key}`;
    }
    if (variant.type) {
        return variant.type;
    }
    return `Variant ${index + 1}`;
}

function isOneOfPrimitiveDumpType(type) {
    return type === 'Number'
        || type === 'String'
        || type === 'Boolean';
}

function isOneOfPrimitiveValueOfType(value, type) {
    if (value === undefined) {
        return true;
    }

    switch (type) {
    case 'Number':
        return typeof value === 'number';
    case 'String':
        return typeof value === 'string';
    case 'Boolean':
        return typeof value === 'boolean';
    default:
        return true;
    }
}

function getOneOfPrimitiveDumpTypeFromValue(value) {
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

function getOneOfSwitchPath(path, switchPropertyName) {
    if (!path || !switchPropertyName) {
        return path;
    }

    const index = path.lastIndexOf('.');
    return index === -1
        ? switchPropertyName
        : `${path.slice(0, index + 1)}${switchPropertyName}`;
}

function escapeHtml(value) {
    return `${value}`
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
