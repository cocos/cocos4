/****************************************************************************\
 Copyright (c) 2024 Xiamen Yaji Software Co., Ltd.
 Hermes JSI Backend — Object.h
 Maps se::Object to facebook::jsi::Object.
 SPDX-License-Identifier: MIT
\****************************************************************************/

#pragma once

#include "../config.h"
#include "../PrivateObject.h"
#include "../Define.h"

#if SCRIPT_ENGINE_TYPE == SCRIPT_ENGINE_HERMES

    #include "../RefCounter.h"
    #include "../Value.h"
    #include "Base.h"
    #include <jsi/jsi.h>
    #include <memory>
    #include <string>
    #include <vector>

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
    // --- Public type definitions (mirror v8 API) ---
    // TypedArrayType mirrors v8/Object.h enum
    enum class TypedArrayType {
        NONE,
        INT8, INT16, INT32,
        UINT8, UINT8_CLAMPED, UINT16, UINT32,
        FLOAT32, FLOAT64
    };

    using BufferContentsFreeFunc = void (*)(void *contents, size_t byteLength, void *userData);

    // PropertyAttribute is defined in Define.h (mirrors v8 PropertyAttribute)
    // enum class PropertyAttribute { NONE = 0, READ_ONLY = 1, DONT_ENUM = 2, DONT_DELETE = 4 };

    // --- Static factory methods ---
    static Object *createPlainObject();
    static Object *createArrayObject(size_t length);
    static Object *createMapObject();
    static Object *createSetObject();
    static Object *createPromise();
    static void    rejectPromise(Object *object, const Value &value);
    static void    resolverPromise(Object *object, const Value &value);
    static Object *createTypedArray(TypedArrayType type, const void *data, size_t byteLength);
    static Object *createExternalArrayBuffer(void *contents, size_t byteLength,
                                             BufferContentsFreeFunc freeFunc,
                                             void *freeUserData = nullptr);
    static Object *createObjectWithClass(Class *cls);
    static Object *getObjectWithPtr(void *ptr);

    // --- Additional static factories (match V8 API) ---
    static Object *createTypedArrayWithBuffer(TypedArrayType type,
                                              Object *arrayBuffer,
                                              uint32_t byteOffset = 0,
                                              uint32_t length = 0);
    static Object *createArrayBufferObject(const void *data, size_t byteLength);
    static Object *createExternalArrayBufferObject(void *contents, size_t byteLength,
                                                   BufferContentsFreeFunc freeFunc,
                                                   void *freeUserData = nullptr);
    static Object *createJSONObject(const ccstd::string &jsonStr);
    static Object *createObjectWithConstructor(Object *constructor);
    static Object *createObjectWithConstructor(Object *constructor, const ValueArray &args);
    static Object *createProxyTarget(Object *proxy);

    // --- Property access ---
    bool getProperty(const char *name, Value *data, bool cachePropertyName = false);
    inline bool getProperty(const ccstd::string &name, Value *value) {
        return getProperty(name.c_str(), value);
    }
    bool setProperty(const char *name, const Value &data);
    inline bool setProperty(const ccstd::string &name, const Value &value) {
        return setProperty(name.c_str(), value);
    }
    bool defineProperty(const char *name,
                        GenericGetterCallback getter, GenericSetterCallback setter,
                        void *userdata = nullptr);
    bool defineOwnProperty(const char *name, const Value &data,
                           PropertyAttribute attribute = PropertyAttribute::NONE);
    bool hasProperty(const char *name) const;
    bool deleteProperty(const char *name);
    bool getPropertyNames(ValueArray *outNames);
    bool getAllKeys(ccstd::vector<ccstd::string> *allKeys) const;

    // --- Array helpers ---
    bool isArray() const;
    uint32_t getArrayLength() const;
    bool getArrayLength(uint32_t *length) const;
    bool getArrayElement(uint32_t index, Value *data) const;
    bool setArrayElement(uint32_t index, const Value &data);

    // --- ES6 Map helpers ---
    bool isMap() const;
    bool isWeakMap() const;
    void clearMap();
    bool removeMapElement(const Value &key);
    bool getMapElement(const Value &key, Value *outValue) const;
    bool setMapElement(const Value &key, const Value &value);

    // --- ES6 Set helpers ---
    bool isSet() const;
    bool isWeakSet() const;

    // --- TypedArray helpers ---
    bool isTypedArray() const;
    TypedArrayType getTypedArrayType() const;
    bool getTypedArrayData(uint8_t **ptr, size_t *length) const;

    // --- ArrayBuffer helpers ---
    bool isArrayBuffer() const;
    bool getArrayBufferData(uint8_t **ptr, size_t *length) const;

    // --- Function call ---
    bool isFunction() const;
    bool call(const ValueArray &args, Object *thisObject, Value *rval = nullptr);
    bool defineFunction(const char *name, GenericFunctionCallback func, void *userdata = nullptr);

    // --- Prototype ---
    bool isProxy() const;
    Object *getProto() const;

    // --- Native object binding ---
    void *getPrivateData() const;
    void  setPrivateData(void *data);
    void  clearPrivateData();
    PrivateObjectBase *getPrivateObject() const { return _privateObject; }

    template <typename T>
    inline std::shared_ptr<T> getPrivateSharedPtr() const {
        assert(_privateObject->isSharedPtr());
        return static_cast<se::SharedPtrPrivateObject<T> *>(_privateObject)->getData();
    }

    template <typename T>
    inline cc::IntrusivePtr<T> getPrivateInstrusivePtr() const {
        assert(_privateObject->isCCIntrusivePtr());
        return static_cast<se::CCIntrusivePtrPrivateObject<T> *>(_privateObject)->getData();
    }
    void setPrivateObject(PrivateObjectBase *obj);

    template <typename T>
    inline void setRawPrivateData(T *data, bool tryDestroyInGC = false) {
        static_assert(!std::is_void<T>::value, "void * is not allowed for private data");
        auto *privateObject = se::rawref_private_object(data);
        if (tryDestroyInGC) {
            privateObject->tryAllowDestroyInGC();
        }
        setPrivateObject(privateObject);
    }

    Class *_getClass() const { return _cls; }
    ccstd::string toString() const;

    // --- Rooting (GC protection) ---
    void root();
    void unroot();
    bool isRooted() const { return _rooted; }

    // --- Identity ---
    bool strictEquals(Object *o) const;

    // --- JSI interop (used by se::Value Hermes shims) ---
    static Object *createFromJsiObject(facebook::jsi::Runtime &rt, facebook::jsi::Object &&jsObj);
    const facebook::jsi::Object& toJsiObject(facebook::jsi::Runtime &rt) const;

    // --- Internal (used by ScriptEngine / Class, not public JSB API) ---
    static Object *_createJSObject(facebook::jsi::Runtime &rt, facebook::jsi::Object &&jsObj);
    const facebook::jsi::Object& _getJsiObject(facebook::jsi::Runtime &rt) const;

private:
    Object();
    ~Object() override;

    // Non-owning raw runtime pointer — valid for the lifetime of se::ScriptEngine
    static facebook::jsi::Runtime *_rt;

    // The underlying JSI object handle (heap-allocated to avoid copy issues)
    std::shared_ptr<facebook::jsi::Object> _jsiObj;

    PrivateObjectBase *_privateObject{nullptr};
    Class *_cls{nullptr};
    bool _rooted{false};

    friend class ScriptEngine;
    friend class Class;
};

} // namespace se

#endif // SCRIPT_ENGINE_TYPE == SCRIPT_ENGINE_HERMES
