/****************************************************************************
 Copyright (c) 2024 Xiamen Yaji Software Co., Ltd.
 Hermes JSI Backend — HelperMacros
 SPDX-License-Identifier: MIT
****************************************************************************/

#pragma once

#include "../config.h"

#if SCRIPT_ENGINE_TYPE == SCRIPT_ENGINE_HERMES

    #include <jsi/jsi.h>
    #include <algorithm>
    #include <chrono>
    #include <type_traits>
    #include <typeinfo>
    #include "../config.h"
    #include "base/Log.h"
    #include "base/Macros.h"
    #include "base/std/container/string.h"

namespace se {

class State;
class Object;

// Callback type for JSI: all JSB callbacks share this signature.
using GenericFunctionCallback = facebook::jsi::Value (*)(
    facebook::jsi::Runtime &rt,
    const facebook::jsi::Value &thisVal,
    const facebook::jsi::Value *args,
    size_t count,
    void *userData);

using GenericGetterCallback = facebook::jsi::Value (*)(
    facebook::jsi::Runtime &rt,
    const facebook::jsi::Value &thisVal,
    void *userData);

using GenericSetterCallback = void (*)(
    facebook::jsi::Runtime &rt,
    const facebook::jsi::Value &thisVal,
    const facebook::jsi::Value &newVal,
    void *userData);

} // namespace se

// ---- Convenience macros (mirror the v8 HelperMacros pattern) ----

#define SE_DECLARE_FUNC(funcName)                                         \
    facebook::jsi::Value funcName(                                        \
        facebook::jsi::Runtime &,                                         \
        const facebook::jsi::Value &,                                     \
        const facebook::jsi::Value *,                                     \
        size_t,                                                            \
        void *)

#define SE_BIND_FUNC(funcName)                                                           \
    facebook::jsi::Value funcName(                                                       \
        facebook::jsi::Runtime &_rt,                                                     \
        const facebook::jsi::Value &_thisVal,                                            \
        const facebook::jsi::Value *_argv,                                               \
        size_t _argc,                                                                    \
        void *_userdata) {                                                               \
        se::State _state(&_rt, &_thisVal, _argv, _argc);                                \
        bool _ok = funcName##Impl(_state);                                              \
        if (!_ok) { SE_LOGE("[ERROR] Failed to invoke " #funcName "\n"); }              \
        return _state.rval().toJsiValue(_rt);                                           \
    }

#define SE_BIND_PROP_GET(funcName)                                                       \
    facebook::jsi::Value funcName(                                                       \
        facebook::jsi::Runtime &_rt,                                                     \
        const facebook::jsi::Value &_thisVal,                                            \
        void *_userdata) {                                                               \
        se::State _state(&_rt, &_thisVal, nullptr, 0);                                  \
        funcName##Impl(_state);                                                          \
        return _state.rval().toJsiValue(_rt);                                           \
    }

#define SE_BIND_PROP_SET(funcName)                                                       \
    void funcName(                                                                       \
        facebook::jsi::Runtime &_rt,                                                    \
        const facebook::jsi::Value &_thisVal,                                           \
        const facebook::jsi::Value &_newVal,                                            \
        void *_userdata) {                                                               \
        se::Value _seVal;                                                                \
        _seVal.fromJsiValue(_rt, _newVal);                                              \
        se::State _state(&_rt, &_thisVal, nullptr, 0);                                  \
        funcName##Impl(_state);                                                          \
    }

template <typename T, typename STATE>
constexpr inline T *SE_THIS_OBJECT(STATE &s) { // NOLINT
    return reinterpret_cast<T *>(s.nativeThisObject());
}

#define SAFE_INC_REF(obj) \
    if (obj != nullptr) obj->incRef()
#define SAFE_DEC_REF(obj)   \
    if ((obj) != nullptr) { \
        (obj)->decRef();    \
        (obj) = nullptr;    \
    }

#endif // SCRIPT_ENGINE_TYPE == SCRIPT_ENGINE_HERMES
