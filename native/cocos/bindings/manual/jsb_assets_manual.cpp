/****************************************************************************
 Copyright (c) 2021-2023 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights to
 use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 of the Software, and to permit persons to whom the Software is furnished to do so,
 subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
****************************************************************************/

#include "bindings/auto/jsb_assets_auto.h"
#include "core/assets/Material.h"
#include "core/assets/SimpleTexture.h"
#include "core/assets/TextureBase.h"
#include "core/data/JSBNativeDataHolder.h"
#include "jsb_scene_manual.h"

#ifndef JSB_ALLOC
    #define JSB_ALLOC(kls, ...) new (std::nothrow) kls(__VA_ARGS__)
#endif

#ifndef JSB_FREE
    #define JSB_FREE(ptr) delete ptr
#endif

static bool js_assets_ImageAsset_setData(se::State &s) // NOLINT(readability-identifier-naming)
{
    auto *cobj = SE_THIS_OBJECT<cc::ImageAsset>(s);
    SE_PRECONDITION2(cobj, false, "Invalid Native Object");
    const auto &args = s.args();
    size_t argc = args.size();
    if (argc == 1) {
        uint8_t *data{nullptr};
        if (args[0].isObject()) {
            if (args[0].toObject()->isTypedArray()) {
                args[0].toObject()->getTypedArrayData(&data, nullptr);
            } else if (args[0].toObject()->isArrayBuffer()) {
                args[0].toObject()->getArrayBufferData(&data, nullptr);
            } else {
                auto *dataHolder = static_cast<cc::JSBNativeDataHolder *>(args[0].toObject()->getPrivateData());
                CC_ASSERT_NOT_NULL(dataHolder);
                data = dataHolder->getData();
            }
        } else {
            CC_ABORTF("setData with '%s'", args[0].toStringForce().c_str());
        }
        cobj->setData(data);
        return true;
    }
    SE_REPORT_ERROR("wrong number of arguments: %d, was expecting %d", (int)argc, 0);
    return false;
}
SE_BIND_FUNC(js_assets_ImageAsset_setData) // NOLINT(readability-identifier-naming)

static bool js_assets_SimpleTexture_registerListeners(se::State &s) // NOLINT(readability-identifier-naming)
{
    auto *cobj = SE_THIS_OBJECT<cc::SimpleTexture>(s);
    SE_PRECONDITION2(cobj, false, "Invalid Native Object");

    // NOTE: resolve the live JS wrapper from the native pointer at emit time instead of capturing
    // `s.thisObject()`. A native texture can outlive its JS wrapper (e.g. builtin textures kept alive
    // by builtinResMgr), so a captured raw se::Object* would dangle and a later event would call into a
    // dead object. Skip when no live wrapper exists. See registerPassesUpdatedListener below for details.
    cobj->on<cc::SimpleTexture::TextureUpdated>([](cc::SimpleTexture *emitter, cc::gfx::Texture *texture) {
        auto *se = se::ScriptEngine::getInstance();
        if (se == nullptr || !se->isValid() || se->isInCleanup() || se->isGarbageCollecting()) {
            return;
        }
        se::AutoHandleScope hs;
        se::Object *jsObject = se::NativePtrToObjectMap::findFirst(emitter);
        if (jsObject != nullptr) {
            se::Value arg0;
            nativevalue_to_se(texture, arg0, nullptr);
            se->callFunction(jsObject, "_onGFXTextureUpdated", 1, &arg0);
        }
    });

    cobj->on<cc::SimpleTexture::AfterAssignImage>([](cc::SimpleTexture *emitter, cc::ImageAsset *image) {
        auto *se = se::ScriptEngine::getInstance();
        if (se == nullptr || !se->isValid() || se->isInCleanup() || se->isGarbageCollecting()) {
            return;
        }
        se::AutoHandleScope hs;
        se::Object *jsObject = se::NativePtrToObjectMap::findFirst(emitter);
        if (jsObject != nullptr) {
            se::Value arg0;
            nativevalue_to_se(image, arg0, nullptr);
            se->callFunction(jsObject, "_onAfterAssignImage", 1, &arg0);
        }
    });

    return true;
}
SE_BIND_FUNC(js_assets_SimpleTexture_registerListeners) // NOLINT(readability-identifier-naming)

static bool js_assets_TextureBase_registerGFXSamplerUpdatedListener(se::State &s) // NOLINT(readability-identifier-naming)
{
    auto *cobj = SE_THIS_OBJECT<cc::TextureBase>(s);
    SE_PRECONDITION2(cobj, false, "Invalid Native Object");
    // Resolve the live JS wrapper at emit time (see SimpleTexture/Material listeners above) so the
    // callback never targets a wrapper that has already been GC'd while the native object lives on.
    cobj->on<cc::TextureBase::SamplerUpdated>([](cc::TextureBase *emitter, cc::gfx::Sampler *sampler) {
        auto *se = se::ScriptEngine::getInstance();
        if (se == nullptr || !se->isValid() || se->isInCleanup() || se->isGarbageCollecting()) {
            return;
        }
        se::AutoHandleScope hs;
        se::Object *jsObject = se::NativePtrToObjectMap::findFirst(emitter);
        if (jsObject != nullptr) {
            se::Value arg0;
            nativevalue_to_se(sampler, arg0, nullptr);
            se->callFunction(jsObject, "_onGFXSamplerUpdated", 1, &arg0);
        }
    });

    return true;
}
SE_BIND_FUNC(js_assets_TextureBase_registerGFXSamplerUpdatedListener) // NOLINT(readability-identifier-naming)

static bool js_assets_Material_registerPassesUpdatedListener(se::State &s) // NOLINT(readability-identifier-naming)
{
    auto *cobj = SE_THIS_OBJECT<cc::Material>(s);
    SE_PRECONDITION2(cobj, false, "Invalid Native Object");
    // NOTE: Do NOT capture the JS wrapper (`s.thisObject()`) here. A native Material can outlive
    // its JS wrapper -- e.g. builtin "rt-*" materials are kept alive by builtinResMgr's IntrusivePtr
    // while their JS wrapper is GC'd after the owning sprite is destroyed. A captured raw se::Object*
    // would then dangle, and a later PassesUpdated (emitted from Material::update()/doDestroy()) would
    // invoke `_onPassesUpdated` on a dead object, producing:
    //   [SE_ERROR] _onPassesUpdated is not a function: undefined
    // Instead resolve the *current* live JS wrapper from the native pointer at emit time, and skip
    // when none exists (a freshly recreated wrapper syncs passes lazily via its `passes` getter).
    //
    // The engine-state guard below is also mandatory: PassesUpdated can be emitted from
    // Material::update()/copy()/doDestroy() while the script engine is being torn down (editor
    // engine restart / scene reload) or while a GC is in progress. In those windows `findFirst`
    // may still return an se::Object whose V8 persistent now points at a freed object, and calling
    // into it crashes inside ObjectWrap::handle() (`Local<Object>::New` on a dangling handle).
    // Never touch JS during cleanup or GC -- see native/cocos/bindings/docs/JSB2.0-learning.
    cobj->on<cc::Material::PassesUpdated>([](cc::Material *emitter) {
        auto *se = se::ScriptEngine::getInstance();
        if (se == nullptr || !se->isValid() || se->isInCleanup() || se->isGarbageCollecting()) {
            return;
        }
        se::AutoHandleScope hs;
        se::Object *jsObject = se::NativePtrToObjectMap::findFirst(emitter);
        if (jsObject != nullptr) {
            se->callFunction(jsObject, "_onPassesUpdated", 0, nullptr);
        }
    });

    return true;
}
SE_BIND_FUNC(js_assets_Material_registerPassesUpdatedListener) // NOLINT(readability-identifier-naming)

bool register_all_assets_manual(se::Object *obj) // NOLINT(readability-identifier-naming)
{
    // Get the ns
    se::Value nsVal;
    if (!obj->getProperty("jsb", &nsVal)) {
        se::HandleObject jsobj(se::Object::createPlainObject());
        nsVal.setObject(jsobj);
        obj->setProperty("jsb", nsVal);
    }

    __jsb_cc_ImageAsset_proto->defineFunction("setData", _SE(js_assets_ImageAsset_setData));
    __jsb_cc_SimpleTexture_proto->defineFunction("_registerListeners", _SE(js_assets_SimpleTexture_registerListeners));
    __jsb_cc_TextureBase_proto->defineFunction("_registerGFXSamplerUpdatedListener", _SE(js_assets_TextureBase_registerGFXSamplerUpdatedListener));
    __jsb_cc_Material_proto->defineFunction("_registerPassesUpdatedListener", _SE(js_assets_Material_registerPassesUpdatedListener));

    return true;
}
