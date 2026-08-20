/****************************************************************************
 Copyright (c) 2024 Xiamen Yaji Software Co., Ltd.
 Hermes JSI Backend — Class.cpp
 SPDX-License-Identifier: MIT
****************************************************************************/

#include "../config.h"

#if SCRIPT_ENGINE_TYPE == SCRIPT_ENGINE_HERMES

    #include "Class.h"
    #include "Object.h"
    #include "ScriptEngine.h"
    #include "Utils.h"
    #include <jsi/jsi.h>
    #include <cassert>

namespace fj = facebook::jsi;

namespace se {

std::vector<Class *> Class::_allClasses;

// ---------------------------------------------------------------------------
// Constructor / Destructor
// ---------------------------------------------------------------------------

Class::Class() = default;

Class::~Class() {
    if (_proto) {
        _proto->decRef();
        _proto = nullptr;
    }
}

// ---------------------------------------------------------------------------
// Static factories
// ---------------------------------------------------------------------------

Class *Class::create(const ccstd::string &clsName, Object *parent, Object *parentProto,
                     GenericFunctionCallback ctor, void *data) {
    auto *cls = new Class();
    cls->_name       = clsName;
    cls->_parent     = parent;
    cls->_parentProto = parentProto;
    cls->_ctor       = ctor;
    cls->_ctorData   = data;
    _allClasses.push_back(cls);
    return cls;
}

Class *Class::create(const std::initializer_list<const char *> &classPath,
                     Object *parent, Object *parentProto,
                     GenericFunctionCallback ctor, void *data) {
    // Use last path component as the class name (mirrors v8 behaviour)
    ccstd::string name = *(classPath.end() - 1);
    return create(name, parent, parentProto, ctor, data);
}

// ---------------------------------------------------------------------------
// Definition builders (called before install())
// ---------------------------------------------------------------------------

bool Class::defineFunction(const char *name, GenericFunctionCallback func, void *data) {
    _functions.push_back({name, func, data});
    return true;
}

bool Class::defineProperty(const char *name,
                            GenericGetterCallback getter, GenericSetterCallback setter,
                            void *data) {
    _properties.push_back({name, getter, setter, data});
    return true;
}

bool Class::defineProperty(const std::initializer_list<const char *> &names,
                            GenericGetterCallback getter, GenericSetterCallback setter,
                            void *data) {
    for (const char *n : names) {
        defineProperty(n, getter, setter, data);
    }
    return true;
}

bool Class::defineStaticFunction(const char *name, GenericFunctionCallback func, void *data) {
    _staticFunctions.push_back({name, func, data});
    return true;
}

bool Class::defineStaticProperty(const char *name,
                                  GenericGetterCallback getter, GenericSetterCallback setter,
                                  void *data) {
    _staticProperties.push_back({name, getter, setter, data});
    return true;
}

bool Class::defineStaticProperty(const char *name, const Value &value, PropertyAttribute) {
    // Store as a static getter that returns the constant value
    Value captured = value;
    return defineStaticProperty(name,
        [](fj::Runtime &rt, const fj::Value &, void *ud) -> fj::Value {
            auto *v = static_cast<Value *>(ud);
            return se::internal::seToJsValue(rt, *v);
        },
        nullptr,
        new Value(captured)); // intentional leak — static lifetime
}

bool Class::defineFinalizeFunction(HermesFinalizeFunc func) {
    _finalizeFunc = func;
    return true;
}

// ---------------------------------------------------------------------------
// install() — builds the jsi::Function constructor and installs it
// ---------------------------------------------------------------------------

bool Class::install() {
    fj::Runtime *rt = ScriptEngine::getInstance()->_runtime;
    assert(rt);

    // ---- Build prototype object ----
    Object *proto = Object::createPlainObject();

    // Inherit from parentProto if provided
    if (_parentProto) {
        auto setProto = rt->global()
            .getPropertyAsObject(*rt, "Object")
            .getPropertyAsFunction(*rt, "setPrototypeOf");
        setProto.call(*rt,
            proto->_getJsiObject(*rt),
            _parentProto->_getJsiObject(*rt));
    }

    // Install instance methods on prototype
    for (auto &f : _functions) {
        void *ud = f.data;
        GenericFunctionCallback fn = f.fn;
        auto jsFn = fj::Function::createFromHostFunction(*rt,
            fj::PropNameID::forAscii(*rt, f.name), 0,
            [fn, ud](fj::Runtime &r, const fj::Value &thisVal,
                     const fj::Value *args, size_t count) -> fj::Value {
                return fn(r, thisVal, args, count, ud);
            });
        proto->_getJsiObject(*rt).setProperty(*rt, f.name.c_str(), jsFn);
    }

    // Install instance properties on prototype
    for (auto &p : _properties) {
        Value dummy;
        proto->defineProperty(p.name.c_str(), p.getter, p.setter, p.data);
    }

    _proto = proto; // Class owns proto reference

    // ---- Build constructor function ----
    GenericFunctionCallback ctorCb = _ctor;
    void *ctorData                 = _ctorData;
    auto ctorFn = fj::Function::createFromHostFunction(*rt,
        fj::PropNameID::forAscii(*rt, _name), 0,
        [ctorCb, ctorData](fj::Runtime &r, const fj::Value &thisVal,
                            const fj::Value *args, size_t count) -> fj::Value {
            if (ctorCb) {
                ctorCb(r, thisVal, args, count, ctorData);
            }
            return fj::Value::undefined();
        });

    // Attach prototype to constructor
    auto protoJsi = proto->_getJsiObject(*rt);
    ctorFn.setProperty(*rt, "prototype", protoJsi);

    // Install static members on constructor
    for (auto &sf : _staticFunctions) {
        void *ud = sf.data;
        GenericFunctionCallback fn = sf.fn;
        auto jsFn = fj::Function::createFromHostFunction(*rt,
            fj::PropNameID::forAscii(*rt, sf.name), 0,
            [fn, ud](fj::Runtime &r, const fj::Value &thisVal,
                     const fj::Value *args, size_t count) -> fj::Value {
                return fn(r, thisVal, args, count, ud);
            });
        ctorFn.setProperty(*rt, sf.name.c_str(), jsFn);
    }

    // ---- Install constructor on parent object ----
    if (_parent) {
        _parent->_getJsiObject(*rt).setProperty(*rt, _name.c_str(), ctorFn);
    } else {
        rt->global().setProperty(*rt, _name.c_str(), ctorFn);
    }

    return true;
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

void Class::cleanup() {
    for (Class *cls : _allClasses) {
        delete cls;
    }
    _allClasses.clear();
}

} // namespace se

#endif // SCRIPT_ENGINE_TYPE == SCRIPT_ENGINE_HERMES
