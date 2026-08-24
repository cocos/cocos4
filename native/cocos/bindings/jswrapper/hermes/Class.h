/****************************************************************************\
 Copyright (c) 2024 Xiamen Yaji Software Co., Ltd.
 Hermes JSI Backend — Class.h
 Maps se::Class prototype registration to jsi::Function constructors.
 SPDX-License-Identifier: MIT
\****************************************************************************/

#pragma once

#include "../config.h"

#if SCRIPT_ENGINE_TYPE == SCRIPT_ENGINE_HERMES

    #include "../Define.h"
    #include "../Value.h"
    #include "Base.h"
    #include "HelperMacros.h"
    #include <jsi/jsi.h>
    #include <string>
    #include <vector>
    #include <initializer_list>
    #include <optional>

namespace se {

class Object;

/**
 * se::Class represents a definition of how to create a native binding object.
 * This Hermes backend registers classes as jsi::Function constructors installed
 * on a parent jsi::Object (usually the global or a namespace object).
 */
class Class final {
public:
    static Class *create(const ccstd::string &clsName,
                         Object *parent,
                         Object *parentProto,
                         GenericFunctionCallback ctor,
                         void *data = nullptr);

    static Class *create(const std::initializer_list<const char *> &classPath,
                         Object *parent,
                         Object *parentProto,
                         GenericFunctionCallback ctor,
                         void *data = nullptr);

    bool defineFunction(const char *name, GenericFunctionCallback func, void *data = nullptr);
    bool defineProperty(const char *name,
                        GenericGetterCallback getter,
                        GenericSetterCallback setter,
                        void *data = nullptr);
    bool defineProperty(const std::initializer_list<const char *> &names,
                        GenericGetterCallback getter,
                        GenericSetterCallback setter,
                        void *data = nullptr);
    bool defineStaticFunction(const char *name, GenericFunctionCallback func, void *data = nullptr);
    bool defineStaticProperty(const char *name,
                              GenericGetterCallback getter,
                              GenericSetterCallback setter,
                              void *data = nullptr);
    bool defineStaticProperty(const char *name, const Value &value,
                              PropertyAttribute attribute = PropertyAttribute::NONE);
    bool defineFinalizeFunction(HermesFinalizeFunc func);

    /**
     * Installs the class constructor function on the parent object.
     * After this, `new ClassName()` in JS invokes the native ctor callback.
     */
    bool install();

    Object *getProto() const { return _proto; }
    const char *getName() const { return _name.c_str(); }

    // Private API used in wrapper
    HermesFinalizeFunc _getFinalizeFunction() const;
    void _setCtor(Object *obj);
    inline const std::optional<Object *> &_getCtor() const { return _ctorObj; }
    void setCreateProto(bool createProto);

private:
    Class();
    ~Class();

    bool init(const ccstd::string &clsName, Object *parent, Object *parentProto, GenericFunctionCallback ctor, void *data = nullptr);
    void destroy();

    static void cleanup();

    ccstd::string           _name;
    Object                 *_parent{nullptr};
    Object                 *_parentProto{nullptr};
    Object                 *_proto{nullptr};       // prototype object installed on the ctor
    GenericFunctionCallback _ctor{nullptr};
    void                   *_ctorData{nullptr};
    HermesFinalizeFunc      _finalizeFunc{nullptr};
    std::optional<Object *> _ctorObj;
    bool _createProto{true};

    struct FunctionEntry {
        ccstd::string         name;
        GenericFunctionCallback fn{nullptr};
        void *data{nullptr};
    };

    struct PropertyEntry {
        ccstd::string        name;
        GenericGetterCallback getter{nullptr};
        GenericSetterCallback setter{nullptr};
        void *data{nullptr};
    };

    std::vector<FunctionEntry> _functions;
    std::vector<FunctionEntry> _staticFunctions;
    std::vector<PropertyEntry> _properties;
    std::vector<PropertyEntry> _staticProperties;

    static std::vector<Class *> _allClasses; // for cleanup

    friend class ScriptEngine;
    friend class Object;
};

} // namespace se

#endif // SCRIPT_ENGINE_TYPE == SCRIPT_ENGINE_HERMES
