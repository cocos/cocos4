/****************************************************************************
 Copyright (c) 2024 Xiamen Yaji Software Co., Ltd.
 Hermes JSI Backend — ScriptEngine.h
 Maps se::ScriptEngine lifecycle to a facebook::jsi::Runtime* provided
 by the React Native Hermes runtime.
 SPDX-License-Identifier: MIT
****************************************************************************/

#pragma once

#include "../config.h"

#if SCRIPT_ENGINE_TYPE == SCRIPT_ENGINE_HERMES

    #include "../Value.h"
    #include "Base.h"
    #include <jsi/jsi.h>
    #include <functional>
    #include <mutex>
    #include <string>
    #include <vector>

namespace se {

class Object;
class Class;
class Value;

/**
 * AutoHandleScope — no-op for JSI (no handle scope concept in JSI).
 */
class AutoHandleScope {
public:
    AutoHandleScope()  = default;
    ~AutoHandleScope() = default;
};

/**
 * ScriptEngine — singleton that wraps a jsi::Runtime* supplied by the
 * React Native Hermes runtime.  The runtime pointer is injected once via
 * initWithRuntime() and is never owned by this class.
 */
class ScriptEngine final {
public:
    static ScriptEngine *getInstance();
    void clearException();
    CC_DEPRECATED(3.6.0)
    static void destroyInstance();

    ScriptEngine();
    ~ScriptEngine();

    // ---- Initialisation ----

    /**
     * Inject the host Hermes jsi::Runtime*.
     * Must be called BEFORE start() or any JSB registration.
     * The runtime pointer must remain valid for the lifetime of the engine.
     */
    bool initWithRuntime(facebook::jsi::Runtime *rt);

    /** Legacy init — creates an internal Hermes runtime if one isn't injected. */
    bool init();

    /** Registers native modules and invokes all addRegisterCallback callbacks. */
    bool start();

    /** Resets all state; called on scene restart. */
    void cleanup();

    // ---- Callbacks ----
    using RegisterCallback = bool (*)(Object *);
    void addRegisterCallback(RegisterCallback cb);
    void addPermanentRegisterCallback(RegisterCallback cb);
    void addBeforeInitHook(const std::function<void()> &hook);
    void addAfterInitHook(const std::function<void()> &hook);
    void addBeforeCleanupHook(const std::function<void()> &hook);
    void addAfterCleanupHook(const std::function<void()> &hook);

    // ---- Execution ----
    bool evalString(const char *script, uint32_t length = 0,
                    Value *ret = nullptr, const char *fileName = nullptr);
    bool runScript(const ccstd::string &path, Value *ret = nullptr);
    ccstd::string getCurrentStackTrace();

    // ---- File operation delegate (mirrors v8 API) ----
    class FileOperationDelegate {
    public:
        FileOperationDelegate()
        : onGetDataFromFile(nullptr), onGetStringFromFile(nullptr),
          onCheckFileExist(nullptr), onGetFullPath(nullptr) {}

        bool isValid() const {
            return onGetDataFromFile != nullptr && onGetStringFromFile != nullptr
                && onCheckFileExist != nullptr && onGetFullPath != nullptr;
        }

        std::function<void(const ccstd::string &, const std::function<void(const uint8_t *, size_t)> &)> onGetDataFromFile;
        std::function<ccstd::string(const ccstd::string &)> onGetStringFromFile;
        std::function<bool(const ccstd::string &)> onCheckFileExist;
        std::function<ccstd::string(const ccstd::string &)> onGetFullPath;
    };

    void setFileOperationDelegate(const FileOperationDelegate &delegate);
    const FileOperationDelegate &getFileOperationDelegate() const;

    // ---- State queries ----
    Object       *getGlobalObject() const;
    bool          isGarbageCollecting() const { return false; }
    void          garbageCollect();
    bool          isInCleanup() const { return _isInCleanup; }
    bool          isValid() const { return _runtime != nullptr; }
    bool          isRunning() const { return _isRunning; }

    // ---- Missing methods for engine integration ----
    using ExceptionCallback = std::function<void(const char *, const char *, const char *)>; // location, message, stack
    void setExceptionCallback(const ExceptionCallback &cb);
    void setJSExceptionCallback(const ExceptionCallback &cb);
    void handlePromiseExceptions();
    void mainLoopUpdate();

    // --- Internal — accessible by Object / Class ---
    facebook::jsi::Runtime *_runtime{nullptr};

private:
    static ScriptEngine    *_instance;

    Object                 *_globalObj{nullptr};
    bool                    _isRunning{false};
    bool                    _isInCleanup{false};
    bool                    _isGC{false};
    FileOperationDelegate   _fileDelegate;
    std::mutex              _mutex;

    std::vector<RegisterCallback> _registerCallbacks;
    std::vector<RegisterCallback> _permanentRegisterCallbacks;
    std::vector<std::function<void()>> _beforeInitHooks;
    std::vector<std::function<void()>> _afterInitHooks;
    std::vector<std::function<void()>> _beforeCleanupHooks;
    std::vector<std::function<void()>> _afterCleanupHooks;
};

} // namespace se

#endif // SCRIPT_ENGINE_TYPE == SCRIPT_ENGINE_HERMES
