#include "spine-wasm.h"
#include "AtlasAttachmentLoaderExtension.h"
#include "spine-mesh-data.h"
#include "util-function.h"
#include "wasmSpineExtension.h"

#include <emscripten/emscripten.h>
#include <emscripten/val.h>
#include <unordered_map>
#include <vector>
#include <utility>

#include "spine/HashMap.h"

using namespace spine;

extern "C" void spineScheduleRelease();

HashMap<SkeletonData *, HashMap<Attachment *, AttachmentVertices *>*> spineAttachmentVerticesMap{};
HashMap<SkeletonData *, HashMap<spine::String, spine::String>*> spineTexturesMap{};

#ifdef CC_SPINE_VERSION_4_2
HashMap<SkeletonData *, Atlas*> spineAtlasMap{};
#endif


static const uint16_t quadTriangles[6] = {0, 1, 2, 2, 3, 0};

extern "C" AttachmentVertices* generateAttachmentVertices(Attachment* attachment) {
    AttachmentVertices* attachmentVertices = nullptr;
    if (attachment->getRTTI().isExactly(RegionAttachment::rtti)) {
        auto* regionAttachment = static_cast<RegionAttachment*>(attachment);
#ifdef CC_SPINE_VERSION_3_8
        auto* region = static_cast<AtlasRegion*>(regionAttachment->getRendererObject());
#else
        auto* region = static_cast<AtlasRegion*>(regionAttachment->getRegion());
#endif
        if (!region) return nullptr;
        attachmentVertices = new AttachmentVertices(4, const_cast<uint16_t*>(quadTriangles), 6, region->page->name);
        V3F_T2F_C4B* vertices = attachmentVertices->_triangles->verts;
        const auto& uvs = regionAttachment->getUVs();
        for (int i = 0, ii = 0; i < 4; ++i, ii += 2) {
            vertices[i].texCoord.u = uvs[ii];
            vertices[i].texCoord.v = uvs[ii + 1];
        }

    } else if (attachment->getRTTI().isExactly(MeshAttachment::rtti)) {
        auto* meshAttachment = static_cast<MeshAttachment*>(attachment);
#ifdef CC_SPINE_VERSION_3_8
        auto* region = static_cast<AtlasRegion*>(meshAttachment->getRendererObject());
#else
        auto* region = static_cast<AtlasRegion*>(meshAttachment->getRegion());
#endif
        if (!region) return nullptr;
        attachmentVertices = new AttachmentVertices(
            static_cast<int32_t>(meshAttachment->getWorldVerticesLength() >> 1), meshAttachment->getTriangles().buffer(), static_cast<int32_t>(meshAttachment->getTriangles().size()), region->page->name);
        V3F_T2F_C4B* vertices = attachmentVertices->_triangles->verts;
        const auto& uvs = meshAttachment->getUVs();
        for (size_t i = 0, ii = 0, nn = meshAttachment->getWorldVerticesLength(); ii < nn; ++i, ii += 2) {
            vertices[i].texCoord.u = uvs[ii];
            vertices[i].texCoord.v = uvs[ii + 1];
        }
    }
    return attachmentVertices;
}

namespace {
const int LOG_LEVEL_ERROR = 3;
const int LOG_LEVEL_WARN = 2;
const int LOG_LEVEL_INFO = 1;

void logToConsole(const char* message, int logLevel = LOG_LEVEL_INFO) {
    if (logLevel == LOG_LEVEL_INFO) {
        EM_ASM({
            console.log('[Spine]', UTF8ToString($0));
        }, message);
    } else if (logLevel == LOG_LEVEL_WARN) {
        EM_ASM({
            console.warn('[Spine]', UTF8ToString($0));
        }, message);
    } else if (logLevel == LOG_LEVEL_ERROR) {
        EM_ASM({
            console.error('[Spine]', UTF8ToString($0));
        }, message);
    }
}

HashMap<String, SkeletonData*> skeletonDataMap{};

struct SkeletonDataUsage {
    size_t references = 0;
    bool pendingDestroy = false;
};
std::unordered_map<SkeletonData*, SkeletonDataUsage> skeletonDataUsage;
std::vector<std::function<void()>> pendingReleases;

void releaseSkeletonData(SkeletonData* data) {
    if (spineAttachmentVerticesMap.containsKey(data)) {
        auto* vertices = spineAttachmentVerticesMap[data];
        auto entries = vertices->getEntries();
        while (entries.hasNext()) delete entries.next().value;
        delete vertices;
        spineAttachmentVerticesMap.remove(data);
    }
#ifdef CC_SPINE_VERSION_4_2
    if (spineAtlasMap.containsKey(data)) {
        delete spineAtlasMap[data];
        spineAtlasMap.remove(data);
    }
#endif
    if (spineTexturesMap.containsKey(data)) {
        delete spineTexturesMap[data];
        spineTexturesMap.remove(data);
    }
    skeletonDataUsage.erase(data);
    delete data;
}

// This base is destroyed AFTER Skeleton, whose slots still refer to the data.
class SkeletonDataLease {
public:
    explicit SkeletonDataLease(SkeletonData* data) : _data(data) {
        ++skeletonDataUsage[data].references;
    }
    ~SkeletonDataLease() {
        auto found = skeletonDataUsage.find(_data);
        if (found != skeletonDataUsage.end() && --found->second.references == 0) {
            if (found->second.pendingDestroy) releaseSkeletonData(_data);
            else skeletonDataUsage.erase(found);
        }
    }
private:
    SkeletonData* _data;
};

class RetainedSkeleton final : private SkeletonDataLease, public Skeleton {
public:
    explicit RetainedSkeleton(SkeletonData* data) : SkeletonDataLease(data), Skeleton(data) {}
};

void saveAttachmentVertices(SkeletonData* skeletonData, const spine::Vector<spine::String>& textureNames, const spine::Vector<spine::String>& textureUUIDs) {
    spine::HashMap<spine::String, spine::String> textureMap{};
    spine::HashMap<spine::String, spine::String>* texturesMap = nullptr;
#ifdef CC_SPINE_VERSION_3_8
    // Attachment can not switch pages in 3.8
    texturesMap = &textureMap;
#else
    if (!spineTexturesMap.containsKey(skeletonData)) {
        texturesMap = new HashMap<spine::String, spine::String>();
        spineTexturesMap.put(skeletonData, texturesMap);
    } else {
        texturesMap = spineTexturesMap[skeletonData];
    }
#endif

    int textureSize = textureNames.size();
    for (int i = 0; i < textureSize; ++i) {
        texturesMap->put(textureNames[i], textureUUIDs[i]);
    }
    HashMap<Attachment*, AttachmentVertices*>* attachmentVerticesMap = nullptr;
    if (!spineAttachmentVerticesMap.containsKey(skeletonData)) {
        attachmentVerticesMap = new HashMap<Attachment*, AttachmentVertices*>();
        spineAttachmentVerticesMap.put(skeletonData, attachmentVerticesMap);
    } else {
        attachmentVerticesMap = spineAttachmentVerticesMap[skeletonData];
    }

    auto& skins = skeletonData->getSkins();
    auto skinSize = skins.size();
    for (int i = 0; i < skinSize; ++i) {
        auto* skin = skins[i];
        auto entries = skin->getAttachments();
        while (entries.hasNext()) {
            Skin::AttachmentMap::Entry& entry = entries.next();
            AttachmentVertices* attachmentVertices = nullptr;
            auto* attachment = entry._attachment;
            if (attachmentVerticesMap->containsKey(attachment)) {
                attachmentVertices = (*attachmentVerticesMap)[attachment];
            } else {
                attachmentVertices = generateAttachmentVertices(attachment);
                if (attachmentVertices) {
                    attachmentVerticesMap->put(attachment, attachmentVertices);
                }
            }

            if (attachmentVertices) {
                auto& textureName = attachmentVertices->_textureName;
                if (texturesMap->containsKey(textureName)) {
                    attachmentVertices->_textureUUID = (*texturesMap)[textureName];
                } else {
                    spine::String logInfo(textureName);
                    logInfo.append(" attachment's texture doesn`t exist ");
                    logInfo.append(textureName);
                    logToConsole(logInfo.buffer(), LOG_LEVEL_WARN);
                }
            }
        }
    }
}
} // namespace

uint32_t SpineWasmUtil::s_listenerID = 0;
EventType SpineWasmUtil::s_currentType = EventType_Event;
TrackEntry* SpineWasmUtil::s_currentEntry = nullptr;
Event* SpineWasmUtil::s_currentEvent = nullptr;
uint8_t* SpineWasmUtil::s_mem = nullptr;

void SpineWasmUtil::spineWasmInit() {
    // LogUtil::Initialize();
    SpineExtension* extension = new WasmSpineExtension();
    SpineExtension::setInstance(extension);

    SpineMeshData::initMeshMemory();

    //LogUtil::PrintToJs("spineWasmInit");
}

void SpineWasmUtil::spineWasmDestroy() {
    collectGarbage();
    auto* extension = SpineExtension::getInstance();
    delete extension;
    freeStoreMemory();
    SpineMeshData::releaseMeshMemory();
    // LogUtil::ReleaseBuffer();
}

SkeletonData* SpineWasmUtil::querySpineSkeletonDataByUUID(const String& uuid) {
    if (!skeletonDataMap.containsKey(uuid)) {
        return nullptr;
    }
    return skeletonDataMap[uuid];
}

SkeletonData* SpineWasmUtil::createSpineSkeletonDataWithJson(const String& jsonStr, const String& altasStr, const spine::Vector<spine::String>& textureNames, const spine::Vector<spine::String>& textureUUIDs) {
    SkeletonData* skeletonData = nullptr;
#if ENABLE_JSON_PARSER
    auto* atlas = new Atlas(altasStr.buffer(), altasStr.length(), "", nullptr, false);
    if (!atlas) {
        return nullptr;
    }
    {
        AttachmentLoader* attachmentLoader = new AtlasAttachmentLoaderExtension(atlas);
        #ifdef CC_SPINE_VERSION_3_8
        SkeletonJson json(attachmentLoader);
        #else
        SkeletonJson json(attachmentLoader, true);
        #endif
        json.setScale(1.0F);
        skeletonData = json.readSkeletonData(jsonStr.buffer());
        auto& errorMsg = json.getError();
        if (!errorMsg.isEmpty()) {
            logToConsole(errorMsg.buffer(), LOG_LEVEL_WARN);
        }

        saveAttachmentVertices(skeletonData, textureNames, textureUUIDs);
    }
#ifdef CC_SPINE_VERSION_3_8
    delete atlas;
#else
    spineAtlasMap.put(skeletonData, atlas);
#endif

#endif

    return skeletonData;
}

SkeletonData* SpineWasmUtil::createSpineSkeletonDataWithBinary(uint32_t byteSize, const String& altasStr, const spine::Vector<spine::String>& textureNames, const spine::Vector<spine::String>& textureUUIDs) {
    SkeletonData* skeletonData = nullptr;
#if ENABLE_BINARY_PARSER
    auto* atlas = new Atlas(altasStr.buffer(), altasStr.length(), "", nullptr, false);
    if (!atlas) {
        return nullptr;
    }
    {
        AttachmentLoader* attachmentLoader = new AtlasAttachmentLoaderExtension(atlas);
        #ifdef CC_SPINE_VERSION_3_8
        SkeletonBinary binary(attachmentLoader);
        #else
        SkeletonBinary binary(attachmentLoader, true);
        #endif
        binary.setScale(1.0F);
        skeletonData = binary.readSkeletonData(s_mem, byteSize);
        auto& errorMsg = binary.getError();
        if (!errorMsg.isEmpty()) {
            logToConsole(errorMsg.buffer(), LOG_LEVEL_WARN);
        }

        saveAttachmentVertices(skeletonData, textureNames, textureUUIDs);
    }
#ifdef CC_SPINE_VERSION_3_8
    delete atlas;
#else
    spineAtlasMap.put(skeletonData, atlas);
#endif

#endif
    return skeletonData;
}

void SpineWasmUtil::registerSpineSkeletonDataWithUUID(SkeletonData* data, const String& uuid) {
    if (!skeletonDataMap.containsKey(uuid)) {
        skeletonDataMap.put(uuid, data);
    }
}

void SpineWasmUtil::destroySpineSkeletonDataWithUUID(const String& uuid) {
    if (skeletonDataMap.containsKey(uuid)) {
        auto* data = skeletonDataMap[uuid];
        skeletonDataMap.remove(uuid);
        auto& usage = skeletonDataUsage[data];
        usage.pendingDestroy = true;
        if (usage.references == 0) releaseSkeletonData(data);
    }
}

Skeleton* SpineWasmUtil::createSpineSkeleton(SkeletonData* data) {
    return data ? new RetainedSkeleton(data) : nullptr;
}

void SpineWasmUtil::deferRelease(std::function<void()> release) {
    const bool needsSchedule = pendingReleases.empty();
    pendingReleases.emplace_back(std::move(release));
    if (needsSchedule) spineScheduleRelease();
}

void SpineWasmUtil::collectGarbage() {
    // Detach the batch so releases cannot invalidate the iteration.
    auto releases = std::move(pendingReleases);
    pendingReleases.clear();
    for (auto& release : releases) release();
}

void SpineWasmUtil::destroySpineSkeleton(Skeleton* skeleton) {
    if (skeleton) {
        delete skeleton;
    }
}

uint32_t SpineWasmUtil::createStoreMemory(uint32_t size) {
    s_mem = new uint8_t[size];

    return (uint32_t)s_mem;
}

void SpineWasmUtil::freeStoreMemory() {
    if (s_mem) {
        delete[] s_mem;
        s_mem = nullptr;
    }
}

uint32_t SpineWasmUtil::getCurrentListenerID() {
    return s_listenerID;
}

EventType SpineWasmUtil::getCurrentEventType() {
    return s_currentType;
}

TrackEntry* SpineWasmUtil::getCurrentTrackEntry() {
    return s_currentEntry;
}

Event* SpineWasmUtil::getCurrentEvent() {
    return s_currentEvent;
}
