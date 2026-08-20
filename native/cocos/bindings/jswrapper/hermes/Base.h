/****************************************************************************
 Copyright (c) 2024 Xiamen Yaji Software Co., Ltd.
 Hermes JSI Backend — mirrors v8/Base.h for the Hermes script engine adapter.
 SPDX-License-Identifier: MIT
****************************************************************************/

#pragma once

#include "../config.h"

#if SCRIPT_ENGINE_TYPE == SCRIPT_ENGINE_HERMES

    // React Native / Hermes JSI headers (provided by hermes-engine AAR / framework)
    #include <jsi/jsi.h>

    #include <algorithm>
    #include <functional>
    #include <memory>
    #include <string>
    #include <unordered_map>
    #include <unordered_set>

    #include "../PrivateObject.h"
    #include "base/std/container/string.h"
    #include "base/std/container/unordered_map.h"
    #include "base/std/container/unordered_set.h"
    #include "HelperMacros.h"

namespace se {
using HermesFinalizeFunc = void (*)(Object *seObj);
} // namespace se

#endif // SCRIPT_ENGINE_TYPE == SCRIPT_ENGINE_HERMES
