/****************************************************************************
 Copyright (c) 2024 Xiamen Yaji Software Co., Ltd.
 Hermes JSI Backend — Utils.h
 Bidirectional conversion helpers between se::Value / se::ValueArray and
 facebook::jsi::Value / jsi::Array.
 SPDX-License-Identifier: MIT
****************************************************************************/

#pragma once

#include "../config.h"

#if SCRIPT_ENGINE_TYPE == SCRIPT_ENGINE_HERMES

    #include <jsi/jsi.h>
    #include "../Value.h"
    #include "Base.h"

namespace facebook { namespace jsi { class Runtime; } }

namespace se {

namespace internal {

/**
 * Convert an array of jsi::Value arguments into a se::ValueArray.
 * Used inside JSI host function callbacks to populate se::State.
 */
void jsToSeArgs(
    facebook::jsi::Runtime &rt,
    const facebook::jsi::Value *jsArgs,
    size_t count,
    ValueArray &outArr);

/**
 * Convert a single jsi::Value to a se::Value.
 */
void jsToSeValue(
    facebook::jsi::Runtime &rt,
    const facebook::jsi::Value &jsVal,
    Value *seVal);

/**
 * Convert a se::ValueArray into a std::vector<jsi::Value>.
 */
void seToJsArgs(
    facebook::jsi::Runtime &rt,
    const ValueArray &args,
    std::vector<facebook::jsi::Value> &outArr);

/**
 * Convert a single se::Value to a jsi::Value.
 */
facebook::jsi::Value seToJsValue(
    facebook::jsi::Runtime &rt,
    const Value &seVal);

/**
 * Retrieve the native C++ pointer embedded in a jsi::Object via the
 * "__nativePtr__" internal field (set as an ExternalObject / NativeState).
 */
void *getPrivateNativePtr(
    facebook::jsi::Runtime &rt,
    const facebook::jsi::Value &jsVal);

/**
 * Embed a native C++ pointer in a jsi::Object using NativeState.
 */
void setPrivateNativePtr(
    facebook::jsi::Runtime &rt,
    facebook::jsi::Object &jsObj,
    Object *seObj);

} // namespace internal
} // namespace se

#endif // SCRIPT_ENGINE_TYPE == SCRIPT_ENGINE_HERMES
