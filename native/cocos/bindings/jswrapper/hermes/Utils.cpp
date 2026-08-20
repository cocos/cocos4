/****************************************************************************
 Copyright (c) 2024 Xiamen Yaji Software Co., Ltd.
 Hermes JSI Backend — Utils.cpp
 SPDX-License-Identifier: MIT
****************************************************************************/

#include "../config.h"

#if SCRIPT_ENGINE_TYPE == SCRIPT_ENGINE_HERMES

    #include "Utils.h"
    #include "Object.h"
    #include "../Value.h"
    #include <jsi/jsi.h>
    #include <cstring>

namespace facebook::jsi { class Runtime; }

namespace se::internal {

// ---------------------------------------------------------------------------
// jsi → se conversions
// ---------------------------------------------------------------------------

void jsToSeValue(facebook::jsi::Runtime &rt, const facebook::jsi::Value &jsVal, Value *seVal) {
    if (jsVal.isUndefined()) {
        seVal->setUndefined();
    } else if (jsVal.isNull()) {
        seVal->setNull();
    } else if (jsVal.isBool()) {
        seVal->setBoolean(jsVal.getBool());
    } else if (jsVal.isNumber()) {
        seVal->setDouble(jsVal.getNumber());
    } else if (jsVal.isString()) {
        seVal->setString(jsVal.getString(rt).utf8(rt));
    } else if (jsVal.isObject()) {
        auto jsObj = jsVal.getObject(rt);
        // Wrap inside a se::Object — takes ownership of the jsi::Object ref
        Object *seObj = Object::_createJSObject(rt, std::move(jsObj));
        seVal->setObject(seObj, true);
        seObj->decRef(); // Value holds the only ref
    }
    // BigInt not currently used by Cocos bindings — treat as number string
}

void jsToSeArgs(
        facebook::jsi::Runtime &rt,
        const facebook::jsi::Value *jsArgs,
        size_t count,
        ValueArray &outArr) {
    outArr.resize(count);
    for (size_t i = 0; i < count; ++i) {
        jsToSeValue(rt, jsArgs[i], &outArr[i]);
    }
}

// ---------------------------------------------------------------------------
// se → jsi conversions
// ---------------------------------------------------------------------------

facebook::jsi::Value seToJsValue(facebook::jsi::Runtime &rt, const Value &seVal) {
    switch (seVal.getType()) {
        case Value::Type::Undefined:
            return facebook::jsi::Value::undefined();
        case Value::Type::Null:
            return facebook::jsi::Value::null();
        case Value::Type::Boolean:
            return facebook::jsi::Value(seVal.toBoolean());
        case Value::Type::Number:
            return facebook::jsi::Value(seVal.toDouble());
        case Value::Type::String: {
            auto str = seVal.toString();
            return facebook::jsi::String::createFromUtf8(rt,
                reinterpret_cast<const uint8_t *>(str.data()), str.size());
        }
        case Value::Type::Object: {
            Object *obj = seVal.toObject();
            if (!obj) return facebook::jsi::Value::null();
            return facebook::jsi::Value(rt, obj->_getJsiObject(rt));
        }
        default:
            return facebook::jsi::Value::undefined();
    }
}

void seToJsArgs(
        facebook::jsi::Runtime &rt,
        const ValueArray &args,
        std::vector<facebook::jsi::Value> &outArr) {
    outArr.reserve(args.size());
    for (const auto &a : args) {
        outArr.push_back(seToJsValue(rt, a));
    }
}

// ---------------------------------------------------------------------------
// Native pointer embedding via jsi::NativeState
// ---------------------------------------------------------------------------

struct SeObjectNativeState : public facebook::jsi::NativeState {
    explicit SeObjectNativeState(Object *obj) : seObject(obj) {}
    ~SeObjectNativeState() override = default;
    Object *seObject{nullptr};
};

void setPrivateNativePtr(
        facebook::jsi::Runtime &rt,
        facebook::jsi::Object &jsObj,
        Object *seObj) {
    jsObj.setNativeState(rt, std::make_shared<SeObjectNativeState>(seObj));
}

void *getPrivateNativePtr(
        facebook::jsi::Runtime &rt,
        const facebook::jsi::Value &jsVal) {
    if (!jsVal.isObject()) return nullptr;
    auto jsObj = jsVal.getObject(rt);
    if (!jsObj.hasNativeState(rt)) return nullptr;
    auto state = jsObj.getNativeState(rt);
    auto *ns = dynamic_cast<SeObjectNativeState *>(state.get());
    return ns ? ns->seObject : nullptr;
}

} // namespace se::internal

#endif // SCRIPT_ENGINE_TYPE == SCRIPT_ENGINE_HERMES
