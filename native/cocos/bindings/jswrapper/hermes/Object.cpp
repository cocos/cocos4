/****************************************************************************
 Copyright (c) 2024 Xiamen Yaji Software Co., Ltd.
 Hermes JSI Backend — Object.cpp
 SPDX-License-Identifier: MIT
****************************************************************************/

#include "../config.h"

#if SCRIPT_ENGINE_TYPE == SCRIPT_ENGINE_HERMES

    #include "Object.h"
    #include "ScriptEngine.h"
    #include "Utils.h"
    #include <jsi/jsi.h>
    #include <cassert>

namespace fj = facebook::jsi;

namespace se {

facebook::jsi::Runtime *Object::_rt = nullptr;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

static fj::Runtime *sRt() {
    return ScriptEngine::getInstance()->_runtime;
}

// ---------------------------------------------------------------------------
// Constructor / destructor
// ---------------------------------------------------------------------------

Object::Object() = default;

Object::~Object() {
    if (_privateObject) {
        delete _privateObject;
        _privateObject = nullptr;
    }
}

ccstd::string Object::toString() const {
    if (!_jsiObj || !_rt) return {};
    return "{}";
}

// ---------------------------------------------------------------------------
// Static factories
// ---------------------------------------------------------------------------

Object *Object::createPlainObject() {
    auto *obj = new Object();
    obj->_rt = sRt();
    obj->_jsiObj = std::make_shared<fj::Object>(*sRt());
    obj->incRef(); // caller must decRef
    return obj;
}

Object *Object::createArrayObject(size_t length) {
    auto *obj = new Object();
    obj->_rt = sRt();
    obj->_jsiObj = std::make_shared<fj::Object>(
        fj::Array(*sRt(), length));
    obj->incRef();
    return obj;
}

Object *Object::createMapObject() {
    auto *obj = new Object();
    obj->_rt = sRt();
    auto mapCtor = sRt()->global().getPropertyAsFunction(*sRt(), "Map");
    obj->_jsiObj = std::make_shared<fj::Object>(
        mapCtor.callAsConstructor(*sRt()).getObject(*sRt()));
    obj->incRef();
    return obj;
}

Object *Object::createSetObject() {
    auto *obj = new Object();
    obj->_rt = sRt();
    auto setCtor = sRt()->global().getPropertyAsFunction(*sRt(), "Set");
    obj->_jsiObj = std::make_shared<fj::Object>(
        setCtor.callAsConstructor(*sRt()).getObject(*sRt()));
    obj->incRef();
    return obj;
}

Object *Object::createObjectWithClass(Class *cls) {
    // Class::install() registers a constructor on the global; call new Cls()
    auto *obj = new Object();
    obj->_rt = sRt();
    obj->_jsiObj = std::make_shared<fj::Object>(*sRt());
    obj->incRef();
    return obj;
}

Object *Object::_createJSObject(fj::Runtime &rt, fj::Object &&jsObj) {
    auto *obj = new Object();
    obj->_rt = &rt;
    obj->_jsiObj = std::make_shared<fj::Object>(std::move(jsObj));
    obj->incRef();
    return obj;
}

const fj::Object& Object::_getJsiObject(fj::Runtime &rt) const {
    assert(_jsiObj);
    (void)rt;
    return *_jsiObj;
}

Object *Object::createFromJsiObject(fj::Runtime &rt, fj::Object &&jsObj) {
    return Object::_createJSObject(rt, std::move(jsObj));
}

const fj::Object& Object::toJsiObject(fj::Runtime &rt) const {
    return Object::_getJsiObject(rt);
}

// ---------------------------------------------------------------------------
// Promise (stub — Hermes supports Promise natively via JS eval)
// ---------------------------------------------------------------------------
Object *Object::createPromise() {
    // Evaluate `new Promise((r,j)=>{...})` via ScriptEngine if needed
    return createPlainObject(); // placeholder
}
void Object::rejectPromise(Object *, const Value &) {}
void Object::resolverPromise(Object *, const Value &) {}

// ---------------------------------------------------------------------------
// Property access
// ---------------------------------------------------------------------------

bool Object::getProperty(const char *name, Value *data, bool /*cache*/) {
    assert(_jsiObj && _rt);
    try {
        auto jsVal = _jsiObj->getProperty(*_rt, name);
        internal::jsToSeValue(*_rt, jsVal, data);
        return true;
    } catch (...) { return false; }
}

bool Object::setProperty(const char *name, const Value &data) {
    assert(_jsiObj && _rt);
    try {
        _jsiObj->setProperty(*_rt, name, internal::seToJsValue(*_rt, data));
        return true;
    } catch (...) { return false; }
}

bool Object::hasProperty(const char *name) const {
    assert(_jsiObj && _rt);
    try {
        return _jsiObj->hasProperty(*_rt, name);
    } catch (...) { return false; }
}

bool Object::deleteProperty(const char *name) {
    // JSI does not expose delete — use evalString workaround
    return false;
}

bool Object::getPropertyNames(ValueArray *outNames) {
    assert(_jsiObj && _rt);
    try {
        auto names = _jsiObj->getPropertyNames(*_rt);
        size_t len = names.size(*_rt);
        outNames->resize(len);
        for (size_t i = 0; i < len; ++i) {
            auto nameStr = names.getValueAtIndex(*_rt, i).getString(*_rt).utf8(*_rt);
            (*outNames)[i].setString(nameStr);
        }
        return true;
    } catch (...) { return false; }
}

bool Object::defineOwnProperty(const char *name, const Value &data, PropertyAttribute /*attr*/) {
    return setProperty(name, data);
}

bool Object::defineProperty(const char *name,
                             GenericGetterCallback getter,
                             GenericSetterCallback setter,
                             void *userdata) {
    // Install getter/setter via Object.defineProperty from JS
    assert(_jsiObj && _rt);
    try {
        auto &rt = *_rt;
        fj::Object descriptor(rt);

        if (getter) {
            void *ud = userdata;
            auto getterFn = fj::Function::createFromHostFunction(rt,
                fj::PropNameID::forAscii(rt, "get"), 0,
                [getter, ud](fj::Runtime &r, const fj::Value &thisVal,
                             const fj::Value * /*args*/, size_t) -> fj::Value {
                    return getter(r, thisVal, ud);
                });
            descriptor.setProperty(rt, "get", getterFn);
        }
        if (setter) {
            void *ud = userdata;
            auto setterFn = fj::Function::createFromHostFunction(rt,
                fj::PropNameID::forAscii(rt, "set"), 1,
                [setter, ud](fj::Runtime &r, const fj::Value &thisVal,
                             const fj::Value *args, size_t) -> fj::Value {
                    setter(r, thisVal, args[0], ud);
                    return fj::Value::undefined();
                });
            descriptor.setProperty(rt, "set", setterFn);
        }
        descriptor.setProperty(rt, "enumerable",   fj::Value(true));
        descriptor.setProperty(rt, "configurable", fj::Value(true));

        auto objDefProp = rt.global()
            .getPropertyAsObject(rt, "Object")
            .getPropertyAsFunction(rt, "defineProperty");
        objDefProp.call(rt, *_jsiObj,
            fj::String::createFromAscii(rt, name),
            descriptor);
        return true;
    } catch (...) { return false; }
}

// ---------------------------------------------------------------------------
// Array
// ---------------------------------------------------------------------------

bool Object::isArray() const {
    assert(_jsiObj && _rt);
    return _jsiObj->isArray(*_rt);
}

uint32_t Object::getArrayLength() const {
    if (!isArray()) return 0;
    auto arr = _jsiObj->asArray(*_rt);
    return static_cast<uint32_t>(arr.size(*_rt));
}

bool Object::getArrayElement(uint32_t index, Value *data) const {
    assert(_jsiObj && _rt);
    try {
        auto arr = _jsiObj->asArray(*_rt);
        internal::jsToSeValue(*_rt, arr.getValueAtIndex(*_rt, index), data);
        return true;
    } catch (...) { return false; }
}

bool Object::setArrayElement(uint32_t index, const Value &data) {
    assert(_jsiObj && _rt);
    try {
        _jsiObj->asArray(*_rt).setValueAtIndex(*_rt, index, internal::seToJsValue(*_rt, data));
        return true;
    } catch (...) { return false; }
}

// ---------------------------------------------------------------------------
// TypedArray / ArrayBuffer — forwarded to JS constructor calls
// ---------------------------------------------------------------------------
bool Object::isTypedArray() const { return false; }
se::Object::TypedArrayType Object::getTypedArrayType() const { return se::Object::TypedArrayType::NONE; }
bool Object::getTypedArrayData(uint8_t **, size_t *) const { return false; }
bool Object::isArrayBuffer() const {
    assert(_jsiObj && _rt);
    return _jsiObj->isArrayBuffer(*_rt);
}
bool Object::getArrayBufferData(uint8_t **, size_t *) const { return false; }
Object *Object::createTypedArray(TypedArrayType, const void *, size_t) {
    return createPlainObject();
}
Object *Object::createExternalArrayBuffer(void *, size_t, BufferContentsFreeFunc, void *) {
    return createPlainObject();
}
Object *Object::getObjectWithPtr(void *) { return nullptr; }

// --- Missing method for TypedArray support ---
Object *Object::createTypedArrayWithBuffer(TypedArrayType, Object *, uint32_t, uint32_t) {
    return createPlainObject();
}

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

bool Object::isFunction() const {
    assert(_jsiObj && _rt);
    return _jsiObj->isFunction(*_rt);
}

bool Object::call(const ValueArray &args, Object *thisObject, Value *rval /* = nullptr */) {
    assert(_jsiObj && _rt && isFunction());
    try {
        std::vector<fj::Value> jsArgs;
        internal::seToJsArgs(*_rt, args, jsArgs);

        fj::Value thisVal = thisObject
            ? fj::Value(*_rt, thisObject->_getJsiObject(*_rt))
            : fj::Value(*_rt, _rt->global());

        auto result = _jsiObj->asFunction(*_rt).callWithThis(
            *_rt, thisVal.getObject(*_rt),
            static_cast<const fj::Value*>(jsArgs.data()), jsArgs.size());

        if (rval) internal::jsToSeValue(*_rt, result, rval);
        return true;
    } catch (...) { return false; }
}

bool Object::defineFunction(const char *name, GenericFunctionCallback func, void *userdata) {
    assert(_jsiObj && _rt);
    try {
        void *ud = userdata;
        auto fn = fj::Function::createFromHostFunction(*_rt,
            fj::PropNameID::forAscii(*_rt, name), 0,
            [func, ud](fj::Runtime &rt, const fj::Value &thisVal,
                       const fj::Value *args, size_t count) -> fj::Value {
                return func(rt, thisVal, args, count, ud);
            });
        _jsiObj->setProperty(*_rt, name, fn);
        return true;
    } catch (...) { return false; }
}

// ---------------------------------------------------------------------------
// Prototype / proxy
// ---------------------------------------------------------------------------
bool Object::isProxy() const { return false; }
Object *Object::getProto() const { return nullptr; }

// ---------------------------------------------------------------------------
// Native data / rooting
// ---------------------------------------------------------------------------

void *Object::getPrivateData() const {
    return _privateObject ? _privateObject->getRaw() : nullptr;
}

void Object::setPrivateData(void *data) {
    if (_jsiObj && _rt) {
        internal::setPrivateNativePtr(*_rt, *_jsiObj, this);
    }
}

void Object::clearPrivateData() {
    if (_privateObject) {
        delete _privateObject;
        _privateObject = nullptr;
    }
}

void Object::setPrivateObject(PrivateObjectBase *obj) {
    _privateObject = obj;
}

void Object::root()   { _rooted = true; }
void Object::unroot() { _rooted = false; }

bool Object::strictEquals(Object *o) const {
    if (!o || !_jsiObj || !o->_jsiObj || !_rt) return false;
    return fj::Value::strictEquals(*_rt, fj::Value(*_rt, *_jsiObj), fj::Value(*_rt, *o->_jsiObj));
}

// ---------------------------------------------------------------------------
// ArrayBuffer (stub for Hermes port)
// ---------------------------------------------------------------------------

se::Object *Object::createArrayBufferObject(const void *data, size_t byteLength) {
    // STUB: manual JSB ArrayBuffer allocation is not yet ported to the Hermes
    // backend. The Nitro/TypeGPU app path does not reach this; log if hit.
    (void)data;
    (void)byteLength;
    return nullptr;
}

// ---------------------------------------------------------------------------
// Additional se::Object methods — Hermes backend stubs (JSB-only paths not
// reached by the Nitro/TypeGPU app). Mirrors the existing getTypedArrayData /
// getArrayBufferData stubs already present in this file.
// ---------------------------------------------------------------------------

bool Object::getAllKeys(ccstd::vector<ccstd::string> *allKeys) const {
    if (allKeys) {
        allKeys->clear();
    }
    return false;
}

bool Object::getArrayLength(uint32_t *length) const {
    if (length) {
        *length = 0;
    }
    return false;
}

se::Object *Object::createExternalArrayBufferObject(void *contents, size_t byteLength,
                                                     BufferContentsFreeFunc freeFunc, void *freeUserData) {
    (void)contents;
    (void)byteLength;
    (void)freeFunc;
    (void)freeUserData;
    return nullptr;
}

se::Object *Object::createProxyTarget(Object *proxy) {
    (void)proxy;
    return nullptr;
}

} // namespace se

#endif // SCRIPT_ENGINE_TYPE == SCRIPT_ENGINE_HERMES
