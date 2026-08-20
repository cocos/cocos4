/****************************************************************************
 Copyright (c) 2024 Xiamen Yaji Software Co., Ltd.
 Hermes JSI Backend — Object.h
 Maps se::Object to facebook::jsi::Object.
 SPDX-License-Identifier: MIT
****************************************************************************/

#pragma once

#include "../config.h"
#include "../PrivateObject.h"

#if SCRIPT_ENGINE_TYPE == SCRIPT_ENGINE_HERMES

    #include "../RefCounter.h"
    #include "../Value.h"
    #include "Base.h"
    #include <jsi/jsi.h>
    #include <memory>
    #include <string>

namespace se {

class Class;
class ScriptEngine;

/**
 * se::Object wraps a facebook::jsi::Object.
 * All methods mirror the v8::Object.h public API exactly so that
 * upstream JSB auto-bindings compile unchanged under -DSCRIPT_ENGINE_TYPE=7.
 */
class Object final : public RefCounter {
public:
    // --- Static factory methods ---
    static Object *createPlainObject();
    static Object *createArrayObject(size_t length);
    static Object *createMapObject();
    static Object *createSetObject();
    static Object *createPromise();
    static void    rejectPromise(Object *object, const Value &value);
    static void    resolverPromise(Object *object, const Value &value);
    static Object *createTypedArray(TypedArrayType type, void *data, size_t byteLength);
    static Object *createExternalArrayBuffer(void *contents, size_t byteLength,
                                             BufferContentsFreeFunc freeFunc,
                                             void *freeUserData = nullptr);
    static Object *createObjectWithClass(Class *cls);
    static Object *getObjectWithPtr(void *ptr);

    // --- Property access ---
    bool getProperty(const char *name, Value *data, bool cachePropertyName = false);
    bool setProperty(const char *name, const Value &data);
    bool defineProperty(const char *name,
                        GenericGetterCallback getter, GenericSetterCallback setter,
                        void *userdata = nullptr);
    bool defineOwnProperty(const char *name, const Value &data,
                           PropertyAttribute attribute = PropertyAttribute::NONE);
    bool hasProperty(const char *name) const;
    bool deleteProperty(const char *name);
    bool getPropertyNames(ValueArray *outNames);

    // --- Array helpers ---
    bool isArray() const;
    uint32_t getArrayLength() const;
    bool getArrayElement(uint32_t index, Value *data) const;
    bool setArrayElement(uint32_t index, const Value &data);

    // --- TypedArray helpers ---
    bool isTypedArray() const;
    TypedArrayType getTypedArrayType() const;
    bool getTypedArrayData(uint8_t **ptr, size_t *length) const;

    // --- ArrayBuffer helpers ---
    bool isArrayBuffer() const;
    bool getArrayBufferData(uint8_t **ptr, size_t *length) const;

    // --- Function call ---
    bool isFunction() const;
    bool call(const ValueArray &args, Object *thisObject, Value *rval);
    bool defineFunction(const char *name, GenericFunctionCallback func, void *userdata = nullptr);

    // --- Prototype ---
    bool isProxy() const;
    Object *getProto() const;

    // --- Native object binding ---
    void *getPrivateData() const;
    void  setPrivateData(void *data);
    void  clearPrivateData();
    PrivateObjectBase *getPrivateObject() const { return _privateObject; }
    void setPrivateObject(PrivateObjectBase *obj);

    // --- Rooting (GC protection) ---
    void root();
    void unroot();
    bool isRooted() const { return _rooted; }

    // --- Identity ---
    bool strictEquals(Object *o) const;

    // --- Internal (used by ScriptEngine / Class, not public JSB API) ---
    static Object *_createJSObject(facebook::jsi::Runtime &rt, facebook::jsi::Object &&jsObj);
    facebook::jsi::Object _getJsiObject(facebook::jsi::Runtime &rt) const;

    // TypedArrayType mirrors v8/Object.h enum
    enum class TypedArrayType {
        NONE,
        INT8, INT16, INT32,
        UINT8, UINT8_CLAMPED, UINT16, UINT32,
        FLOAT32, FLOAT64
    };

    using BufferContentsFreeFunc = void (*)(void *contents, size_t byteLength, void *userData);

private:
    Object();
    ~Object() override;

    // Non-owning raw runtime pointer — valid for the lifetime of se::ScriptEngine
    facebook::jsi::Runtime *_rt{nullptr};

    // The underlying JSI object handle (heap-allocated to avoid copy issues)
    std::shared_ptr<facebook::jsi::Object> _jsiObj;

    PrivateObjectBase *_privateObject{nullptr};
    bool _rooted{false};

    friend class ScriptEngine;
    friend class Class;
};

} // namespace se

#endif // SCRIPT_ENGINE_TYPE == SCRIPT_ENGINE_HERMES
