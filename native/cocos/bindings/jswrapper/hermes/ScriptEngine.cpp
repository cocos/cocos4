/****************************************************************************
 Copyright (c) 2024 Xiamen Yaji Software Co., Ltd.
 Hermes JSI Backend — ScriptEngine.cpp
 SPDX-License-Identifier: MIT
****************************************************************************/

#include "../config.h"

#if SCRIPT_ENGINE_TYPE == SCRIPT_ENGINE_HERMES

    #include "ScriptEngine.h"
    #include "Class.h"
    #include "Object.h"
    #include "Utils.h"
    #include <jsi/jsi.h>
    #include <cassert>
    #include <stdexcept>
    #include "base/Log.h"

namespace fj = facebook::jsi;

namespace se {

ScriptEngine *ScriptEngine::_instance = nullptr;

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

ScriptEngine *ScriptEngine::getInstance() {
    if (!_instance) {
        _instance = new ScriptEngine();
    }
    return _instance;
}

void ScriptEngine::destroyInstance() {
    if (_instance) {
        _instance->cleanup();
        delete _instance;
        _instance = nullptr;
    }
}

// ---------------------------------------------------------------------------
// Constructor / Destructor
// ---------------------------------------------------------------------------

ScriptEngine::ScriptEngine() = default;

ScriptEngine::~ScriptEngine() {
    cleanup();
}

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

bool ScriptEngine::initWithRuntime(fj::Runtime *rt) {
    std::lock_guard<std::mutex> lock(_mutex);
    if (!rt) {
        SE_LOGE("[ScriptEngine/Hermes] initWithRuntime: null runtime!\n");
        return false;
    }
    _runtime = rt;
    CC_LOG_INFO("[ScriptEngine/Hermes] Runtime injected: %p", rt);

    // Invoke pre-init hooks
    for (auto &hook : _beforeInitHooks) hook();

    // Wrap the JSI global object as a se::Object
    if (_globalObj) { _globalObj->decRef(); }
    _globalObj = Object::_createJSObject(*rt, rt->global());

    // Invoke post-init hooks
    for (auto &hook : _afterInitHooks) hook();

    return true;
}

bool ScriptEngine::init() {
    // If a runtime was injected via initWithRuntime, we're already initialised.
    if (_runtime) return true;
    SE_LOGE("[ScriptEngine/Hermes] init() called without a runtime — call initWithRuntime(jsi::Runtime*) first.\n");
    return false;
}

// ---------------------------------------------------------------------------
// Start — register all JSB modules
// ---------------------------------------------------------------------------

bool ScriptEngine::start() {
    assert(_runtime && "start() called before initWithRuntime()");

    // Permanent callbacks first (not cleared on cleanup)
    for (auto &cb : _permanentRegisterCallbacks) {
        if (!cb(_globalObj)) {
            SE_LOGE("[ScriptEngine/Hermes] Permanent register callback failed!\n");
            return false;
        }
    }

    // Session callbacks
    for (auto &cb : _registerCallbacks) {
        if (!cb(_globalObj)) {
            SE_LOGE("[ScriptEngine/Hermes] Register callback failed!\n");
            return false;
        }
    }

    _isRunning = true;
    CC_LOG_INFO("[ScriptEngine/Hermes] Started — %zu modules registered.",
                _registerCallbacks.size() + _permanentRegisterCallbacks.size());
    return true;
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

void ScriptEngine::cleanup() {
    _isInCleanup = true;

    for (auto &hook : _beforeCleanupHooks) hook();

    _isRunning = false;
    _registerCallbacks.clear();

    if (_globalObj) {
        _globalObj->decRef();
        _globalObj = nullptr;
    }

    Class::cleanup();

    for (auto &hook : _afterCleanupHooks) hook();
    _isInCleanup = false;

    // Do NOT null _runtime — it is owned by React Native
}

// ---------------------------------------------------------------------------
// Callbacks registration
// ---------------------------------------------------------------------------

void ScriptEngine::addRegisterCallback(RegisterCallback cb) {
    _registerCallbacks.push_back(cb);
}

void ScriptEngine::addPermanentRegisterCallback(RegisterCallback cb) {
    _permanentRegisterCallbacks.push_back(cb);
}

void ScriptEngine::addBeforeInitHook(const std::function<void()> &hook)    { _beforeInitHooks.push_back(hook); }
void ScriptEngine::addAfterInitHook(const std::function<void()> &hook)     { _afterInitHooks.push_back(hook); }
void ScriptEngine::addBeforeCleanupHook(const std::function<void()> &hook) { _beforeCleanupHooks.push_back(hook); }
void ScriptEngine::addAfterCleanupHook(const std::function<void()> &hook)  { _afterCleanupHooks.push_back(hook); }

// ---------------------------------------------------------------------------
// Script evaluation
// ---------------------------------------------------------------------------

bool ScriptEngine::evalString(const char *script, uint32_t length,
                               Value *ret, const char *fileName) {
    assert(_runtime);
    try {
        std::string src(script, length > 0 ? length : strlen(script));
        std::string url = fileName ? fileName : "<eval>";

        auto result = _runtime->evaluateJavaScript(
            std::make_unique<fj::StringBuffer>(src), url);

        if (ret) {
            internal::jsToSeValue(*_runtime, result, ret);
        }
        return true;
    } catch (const fj::JSError &e) {
        SE_LOGE("[ScriptEngine/Hermes] JS error in evalString: %s\n", e.getMessage().c_str());
        return false;
    } catch (const std::exception &e) {
        SE_LOGE("[ScriptEngine/Hermes] Exception in evalString: %s\n", e.what());
        return false;
    }
}

bool ScriptEngine::runScript(const ccstd::string &path, Value *ret) {
    if (!_fileDelegate.isValid()) {
        SE_LOGE("[ScriptEngine/Hermes] runScript: no FileOperationDelegate set.\n");
        return false;
    }
    ccstd::string source = _fileDelegate.onGetStringFromFile(path);
    if (source.empty()) {
        SE_LOGE("[ScriptEngine/Hermes] runScript: empty file: %s\n", path.c_str());
        return false;
    }
    return evalString(source.c_str(), static_cast<uint32_t>(source.size()),
                      ret, path.c_str());
}

ccstd::string ScriptEngine::getCurrentStackTrace() {
    // JSI doesn't expose stack trace API directly — return placeholder
    return "<hermes stack trace unavailable>";
}

// ---------------------------------------------------------------------------
// GC / global
// ---------------------------------------------------------------------------

Object *ScriptEngine::getGlobalObject() const { return _globalObj; }

void ScriptEngine::garbageCollect() {
    // Hermes runs GC automatically; no manual trigger in JSI
}

// ---------------------------------------------------------------------------
// File delegate
// ---------------------------------------------------------------------------

void ScriptEngine::setFileOperationDelegate(const FileOperationDelegate &delegate) {
    _fileDelegate = delegate;
}

const ScriptEngine::FileOperationDelegate &ScriptEngine::getFileOperationDelegate() const {
    return _fileDelegate;
}

} // namespace se

#endif // SCRIPT_ENGINE_TYPE == SCRIPT_ENGINE_HERMES
