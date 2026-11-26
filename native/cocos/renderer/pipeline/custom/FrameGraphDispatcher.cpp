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
#ifdef __clang__
    #pragma clang diagnostic ignored "-Wshorten-64-to-32"
#endif
#include <algorithm>
#include <cstdint>
#include <functional>
#include <iterator>
#include <limits>
#include <numeric>
#include <queue>
#include <stack>
#include <stdexcept>
#include <tuple>
#include <vector>
#include "FGDispatcherTypes.h"
#include "LayoutGraphTypes.h"
#include "cocos/renderer/pipeline/custom/NativeRenderGraphUtils.h"
#include "cocos/base/GraphDFS.h"
#include "cocos/base/GraphView.h"
#include "cocos/scene/RenderWindow.h"
#include "gfx-base/GFXBarrier.h"
#include "gfx-base/GFXDef-common.h"
#include "gfx-base/GFXDef.h"
#include "gfx-base/GFXDevice.h"
#include "math/Vec2.h"
#include "cocos/renderer/pipeline/custom/details/GslUtils.h"

#ifndef BRANCH_CULLING
    #define BRANCH_CULLING 0
#endif

#define ENABLE_FGD_WARNNING 1

#ifdef ENABLE_FGD_WARNNING
    #define FGD_WARNING(...) printf(##__VA_ARGS__)
#else
    #define FGD_WARNING(...)
#endif

namespace cc {

namespace render {

static constexpr bool ENABLE_BRANCH_CULLING = BRANCH_CULLING;

void passReorder(FrameGraphDispatcher &fgDispatcher);
void memoryAliasing(FrameGraphDispatcher &fgDispatcher);
void buildBarriers(FrameGraphDispatcher &fgDispatcher);

void FrameGraphDispatcher::run() {
    if (_enablePassReorder) {
        passReorder(*this);
    }
    if (_enableMemoryAliasing) {
        memoryAliasing(*this);
    }
    buildBarriers(*this);
}

void FrameGraphDispatcher::enablePassReorder(bool enable) {
    _enablePassReorder = enable;
}

void FrameGraphDispatcher::enableMemoryAliasing(bool enable) {
    _enableMemoryAliasing = enable;
}

void FrameGraphDispatcher::setParalellWeight(float paralellExecWeight) {
    _paralellExecWeight = clampf(paralellExecWeight, 0.0F, 1.0F);
}

const BarrierNode &FrameGraphDispatcher::getBarrier(RenderGraph::vertex_descriptor u) const {
    auto ragVertID = resourceAccessGraph.vertex(u);
    return resourceAccessGraph.getBarrier(ragVertID);
}

const ResourceAccessNode &FrameGraphDispatcher::getAccessNode(RenderGraph::vertex_descriptor u) const {
    auto ragVertID = resourceAccessGraph.vertex(u);
    return resourceAccessGraph.getPassNode(ragVertID);
}

const gfx::RenderPassInfo &FrameGraphDispatcher::getRenderPassInfo(RenderGraph::vertex_descriptor u) const {
    CC_EXPECTS(renderGraph.holds<RasterPassTag>(u));
    auto ragVertID = resourceAccessGraph.vertex(u);
    return resourceAccessGraph.getRenderPassInfo(ragVertID).rpInfo;
}

ResourceGraph::vertex_descriptor FrameGraphDispatcher::realResourceID(const ccstd::pmr::string &name) const {
    return resourceAccessGraph.resourceIndex.at(name);
}

[[nodiscard]] ccstd::pmr::string concatResName(
    std::string_view name0,
    std::string_view name1,
    boost::container::pmr::memory_resource *scratch) {
    ccstd::pmr::string name(name0, scratch);
    name += "/";
    name += name1;
    return name;
}

[[nodiscard]] ccstd::pmr::string getSubresNameByPlane(const ccstd::pmr::string &resName,
                                                      uint32_t planeID, const ResourceGraph &resg,
                                                      boost::container::pmr::memory_resource *scratch) {
    const auto &desc = resg.getDesc(resg.vertex(resName));
    // depth stencil
    if (desc.format == gfx::Format::DEPTH_STENCIL) {
        auto nameView = planeID == 0 ? DEPTH_PLANE_NAME : STENCIL_PLANE_NAME;
        const auto &subresName = concatResName(resName, nameView, scratch);
        return subresName;
    }

    auto namedID = resg.find(resName);
    if (resg.get_parent(namedID) == ResourceGraph::null_vertex()) {
        return resName;
    }

    // array
    if (desc.dimension == ResourceDimension::TEXTURE2D && desc.depthOrArraySize > 1) {
        ccstd::pmr::set<ccstd::pmr::string> leaves(scratch);
        auto resID = resg.vertex(resName);

        using LeafGatherFunc = std::function<void(ResourceGraph::vertex_descriptor, const ResourceGraph &, ccstd::pmr::set<ccstd::pmr::string> &)>;
        LeafGatherFunc leafGather = [&](ResourceGraph::vertex_descriptor v, const ResourceGraph &resg, ccstd::pmr::set<ccstd::pmr::string> &names) {
            for (const auto &e : resg.child_links(v)) {
                if (!resg.num_children(e.target)) {
                    const auto &rName = resg.getName(e.target);
                    names.emplace(rName);
                } else {
                    leafGather(e.target, resg, names);
                }
            }
        };
        leafGather(resID, resg, leaves);

        auto iter = leaves.begin();
        std::advance(iter, planeID);
        return (*iter);
    }

    // cube

    // UNREACHABLE
    CC_ASSERT(false);
    return "";
}

ResourceGraph::vertex_descriptor locateSubres(ResourceGraph::vertex_descriptor resID, const ResourceGraph &resg, std::string_view name) {
    auto resName = resg.getName(resID);
    resName += "/";
    resName += name;
    return resg.find(resName);
}

ResourceGraph::vertex_descriptor locateSubres(const ccstd::pmr::string &originName,
                                              const ResourceGraph &resg,
                                              uint32_t basePlane,
                                              boost::container::pmr::memory_resource *scratch) {
    if (basePlane == 0xFFFFFFFF) {
        return resg.find(originName);
    }
    const auto &resName = getSubresNameByPlane(originName, basePlane, resg, scratch);
    return resg.find(resName);
}

ResourceGraph::vertex_descriptor locateSubres(const ccstd::pmr::string &originName,
                                              const ResourceGraph &resg,
                                              uint32_t basePlane,
                                              const ResourceAccessGraph &rag,
                                              boost::container::pmr::memory_resource *scratch) {
    auto originID = resg.find(originName);
    if (rag.movedSourceStatus.find(originName) != rag.movedSourceStatus.end()) {
        return rag.resourceIndex.at(originName);
    }

    const auto &resName = getSubresNameByPlane(originName, basePlane, resg, scratch);
    return resg.find(resName);
}

void FrameGraphDispatcher::buildDescriptorIndex(
    const PmrTransparentMap<ccstd::pmr::string, ccstd::pmr::vector<ComputeView>> &computeViews,
    const PmrTransparentMap<ccstd::pmr::string, RasterView> &rasterViews,
    PmrFlatMap<NameLocalID, ResourceGraph::vertex_descriptor> &resourceIndex) const {
    buildDescriptorIndex(computeViews, resourceIndex);
    if (!rasterViews.empty()) {
        NameLocalID unused{128};
        // input sort by slot name
        ccstd::pmr::map<std::string_view, std::pair<std::string_view, std::string_view>> inputs(scratch);
        for (const auto &[resourceName, rasterView] : rasterViews) {
            if (rasterView.accessType != AccessType::WRITE) {
                if (!defaultAttachment(rasterView.slotName)) {
                    std::string_view suffix = rasterView.attachmentType == AttachmentType::DEPTH_STENCIL ? DEPTH_PLANE_NAME : "";
                    inputs.emplace(std::piecewise_construct,
                                   std::forward_as_tuple(rasterView.slotName),
                                   std::forward_as_tuple(resourceName, suffix));
                }
                if (!defaultAttachment(rasterView.slotName1)) {
                    CC_EXPECTS(rasterView.attachmentType == AttachmentType::DEPTH_STENCIL);
                    std::string_view suffix = STENCIL_PLANE_NAME;
                    inputs.emplace(std::piecewise_construct,
                                   std::forward_as_tuple(rasterView.slotName1),
                                   std::forward_as_tuple(resourceName, suffix));
                }
            }
        }
        // build pass resources
        for (const auto &[slotName, nameInfo] : inputs) {
            auto resID = realResourceID(nameInfo.first.data());
            if (!nameInfo.second.empty()) {
                resID = locateSubres(resID, resourceGraph, nameInfo.second);
            }
            resourceIndex.emplace(unused, resID);
            unused.value++;
        }
    }
}

void FrameGraphDispatcher::buildDescriptorIndex(
    const PmrTransparentMap<ccstd::pmr::string, ccstd::pmr::vector<ComputeView>> &computeViews,
    PmrFlatMap<NameLocalID, ResourceGraph::vertex_descriptor> &resourceIndex) const {
    CC_EXPECTS(resourceIndex.empty());
    resourceIndex.reserve(computeViews.size() * 2);
    if (!computeViews.empty()) {
        for (const auto &[resName, computeViews] : computeViews) {
            auto resID = realResourceID(resName);
            for (const auto &computeView : computeViews) {
                const auto &name = computeView.name;
                CC_EXPECTS(!name.empty());
                const auto nameID = layoutGraph.attributeIndex.at(name);
                auto subresID = locateSubres(resName, resourceGraph, computeView.plane, resourceAccessGraph, scratch);
                resourceIndex.emplace(nameID, subresID);
            }
        }
    }
}

PmrFlatMap<NameLocalID, ResourceGraph::vertex_descriptor> FrameGraphDispatcher::buildDescriptorIndex(
    const PmrTransparentMap<ccstd::pmr::string, ccstd::pmr::vector<ComputeView>> &computeViews,
    boost::container::pmr::memory_resource *scratch) const {
    PmrFlatMap<NameLocalID, ResourceGraph::vertex_descriptor> resourceIndex(scratch);
    buildDescriptorIndex(computeViews, resourceIndex);
    return resourceIndex;
}

PmrFlatMap<NameLocalID, ResourceGraph::vertex_descriptor> FrameGraphDispatcher::buildDescriptorIndex(
    const PmrTransparentMap<ccstd::pmr::string, ccstd::pmr::vector<ComputeView>> &computeViews,
    const PmrTransparentMap<ccstd::pmr::string, RasterView> &rasterViews,
    boost::container::pmr::memory_resource *scratch) const {
    PmrFlatMap<NameLocalID, ResourceGraph::vertex_descriptor> resourceIndex(scratch);
    buildDescriptorIndex(computeViews, rasterViews, resourceIndex);
    return resourceIndex;
}

RenderingInfo FrameGraphDispatcher::getRenderPassAndFrameBuffer(RenderGraph::vertex_descriptor u, const ResourceGraph &resg) const {
    auto ragVertID = resourceAccessGraph.vertex(u);
    const auto &fgRenderPassInfo = resourceAccessGraph.getRenderPassInfo(ragVertID);
    const auto &orderedViews = fgRenderPassInfo.orderedViews;
    const auto &viewIndex = fgRenderPassInfo.viewIndex;

    RenderingInfo renderingInfo(scratch);
    renderingInfo.renderpassInfo = getRenderPassInfo(u);
    gfx::FramebufferInfo fbInfo{
        nullptr,
    };

    CC_ENSURES(renderGraph.holds<RasterPassTag>(u));
    const RasterPass &pass = renderGraph.value(RasterPassTag{}, u);

    for (const auto &viewName : orderedViews) {
        const auto &info = viewIndex.at(viewName);
        auto attachmentIndex = info.attachmentIndex;
        gfx::Color clearColor{};
        if (!info.isResolveView) {
            const auto &rasterView = pass.rasterViews.at(viewName);
            clearColor = rasterView.clearColor;
        }
        if (info.attachmentIndex != gfx::INVALID_BINDING) {
            // colorLike
            renderingInfo.clearColors.emplace_back(clearColor);

            auto resID = resourceAccessGraph.resourceIndex.at(viewName);
            resg.visit_vertex(
                resID,
                [&](const ManagedResource &res) {
                    std::ignore = res;
                    CC_EXPECTS(false);
                },
                [&](const ManagedBuffer &res) {
                    std::ignore = res;
                    CC_EXPECTS(false);
                },
                [&](const ManagedTexture &tex) {
                    CC_EXPECTS(tex.texture);
                    fbInfo.colorTextures.emplace_back(tex.texture);
                },
                [&](const PersistentBuffer &res) {
                    std::ignore = res;
                    CC_EXPECTS(false);
                },
                [&](const PersistentTexture &tex) {
                    fbInfo.colorTextures.emplace_back(tex.texture);
                },
                [&](const IntrusivePtr<gfx::Framebuffer> &fb) {
                    CC_EXPECTS(fb->getColorTextures().size() == 1);
                    CC_EXPECTS(fb->getColorTextures().at(0));
                    // render window attaches a depthStencil by default, which may differs from renderpassInfo here.
                    // data.framebuffer = fb;
                    fbInfo.colorTextures.emplace_back(fb->getColorTextures().at(0));
                },
                [&](const RenderSwapchain &sc) {
                    CC_EXPECTS(!sc.isDepthStencil);
                    if (sc.swapchain) {
                        fbInfo.colorTextures.emplace_back(sc.swapchain->getColorTexture());
                    } else {
                        CC_EXPECTS(sc.renderWindow);
                        fbInfo.colorTextures.emplace_back(sc.renderWindow->getFramebuffer()->getColorTextures().front());
                    }
                },
                [&](const FormatView &view) {
                    // TODO(zhouzhenglong): add ImageView support
                    std::ignore = view;
                    CC_EXPECTS(false);
                },
                [&](const SubresourceView &view) {
                    fbInfo.colorTextures.emplace_back(view.textureView);
                });
            CC_EXPECTS(!fbInfo.colorTextures.empty());
        } else {
            // ds or ds resolve
            if (!info.isResolveView) {
                renderingInfo.clearDepth = clearColor.x;
                renderingInfo.clearStencil = static_cast<uint8_t>(clearColor.y);
            }

            auto &dsAttachment = info.isResolveView ? fbInfo.depthStencilResolveTexture : fbInfo.depthStencilTexture;

            auto resID = resourceAccessGraph.resourceIndex.at(viewName);
            resg.visit_vertex(
                resID,
                [&](const ManagedTexture &tex) {
                    CC_EXPECTS(tex.texture);
                    dsAttachment = tex.texture.get();
                },
                [&](const PersistentTexture &tex) {
                    dsAttachment = tex.texture.get();
                },
                [&](const RenderSwapchain &sc) {
                    CC_EXPECTS(sc.isDepthStencil);
                    CC_EXPECTS(sc.swapchain);
                    CC_EXPECTS(sc.swapchain->getDepthStencilTexture());
                    dsAttachment = sc.swapchain->getDepthStencilTexture();
                },
                [&](const FormatView &view) {
                    std::ignore = view;
                    CC_EXPECTS(false);
                },
                [&](const SubresourceView &view) {
                    std::ignore = view;
                    CC_EXPECTS(false);
                },
                [](const auto & /*unused*/) {
                    CC_EXPECTS(false);
                });
        }
    }
    renderingInfo.framebufferInfo = fbInfo;

    return renderingInfo;
}

LayoutAccess FrameGraphDispatcher::getResourceAccess(
    // NOLINTNEXTLINE(bugprone-easily-swappable-parameters)
    ResourceGraph::vertex_descriptor r,
    RenderGraph::vertex_descriptor p) const {
    auto ragVertID = resourceAccessGraph.vertex(p);
    const auto &resName = resourceGraph.getName(r);
    auto range = resourceAccessGraph.resourceAccess.at(resName).equal_range(ragVertID);
    return {range.first->second.accessFlag, range.second->second.accessFlag};
}

/////////////////////////////////////////////////////////////////////////////////////INTERNAL⚡IMPLEMENTATION/////////////////////////////////////////////////////////////////////////////////////////////

//---------------------------------------------------------------predefine------------------------------------------------------------------
using PmrString = ccstd::pmr::string;
using RelationVert = RelationGraph::vertex_descriptor;
using RasterViewsMap = PmrTransparentMap<ccstd::pmr::string, RasterView>;
using ComputeViewsMap = PmrTransparentMap<ccstd::pmr::string, ccstd::pmr::vector<ComputeView>>;
using ResourceLifeRecordMap = PmrFlatMap<PmrString, ResourceLifeRecord>;

struct Graphs {
    const RenderGraph &renderGraph;
    const LayoutGraphData &layoutGraphData;
    ResourceGraph &resourceGraph;
    ResourceAccessGraph &resourceAccessGraph;
    RelationGraph &relationGraph;
};

struct ViewStatus {
    const ccstd::pmr::string &name;
    const AccessType access;
    const gfx::ShaderStageFlagBit visibility;
    const gfx::AccessFlags accessFlag;
    const gfx::ResourceRange &range;
};

constexpr uint32_t EXPECT_START_ID = 0;
constexpr uint32_t INVALID_ID = 0xFFFFFFFF;

// for scoped enum only
template <typename From, typename To>
class GfxTypeConverter {
public:
    To operator()(From from) {
        return static_cast<To>(
            static_cast<std::underlying_type_t<From>>(from));
    }
};

// TODO(Zeqiang): remove barrier in renderpassinfo
gfx::GeneralBarrier *getGeneralBarrier(gfx::Device *device, gfx::AccessFlagBit prevAccess, gfx::AccessFlagBit nextAccess) {
    return device->getGeneralBarrier({prevAccess, nextAccess});
}

// execution order BUT NOT LOGICALLY
bool isPassExecAdjecent(uint32_t passLID, uint32_t passRID) {
    return std::abs(static_cast<int>(passLID) - static_cast<int>(passRID)) <= 1;
}

template <uint32_t N>
constexpr uint8_t highestBitPos() {
    return highestBitPos<(N >> 1)>() + 1;
}

template <>
constexpr uint8_t highestBitPos<0>() {
    return 0;
}

constexpr uint32_t filledShift(uint8_t pos) {
    return 0xFFFFFFFF >> (32 - pos);
}

constexpr uint8_t HIGHEST_READ_POS = highestBitPos<static_cast<uint32_t>(gfx::AccessFlagBit::PRESENT)>() - 1;
constexpr uint32_t READ_ACCESS = filledShift(HIGHEST_READ_POS) | static_cast<uint32_t>(gfx::AccessFlagBit::SHADING_RATE);

inline bool hasReadAccess(gfx::AccessFlagBit flag) {
    return (static_cast<uint32_t>(flag) & READ_ACCESS) != 0;
}

inline bool isAttachmentAccess(gfx::AccessFlagBit flag) {
    return hasAnyFlags(flag, gfx::AccessFlagBit::FRAGMENT_SHADER_READ_COLOR_INPUT_ATTACHMENT |
                                 gfx::AccessFlagBit::FRAGMENT_SHADER_READ_DEPTH_STENCIL_INPUT_ATTACHMENT |
                                 gfx::AccessFlagBit::COLOR_ATTACHMENT_READ |
                                 gfx::AccessFlagBit::COLOR_ATTACHMENT_WRITE |
                                 gfx::AccessFlagBit::DEPTH_STENCIL_ATTACHMENT_WRITE);
}

// SHADING_RATE may be ambiguos
inline bool isReadOnlyAccess(gfx::AccessFlagBit flag) {
    return static_cast<uint32_t>(flag) < static_cast<uint32_t>(gfx::AccessFlagBit::PRESENT) || flag == gfx::AccessFlagBit::SHADING_RATE;
}

bool accessDependent(const gfx::AccessFlagBit lhs, const gfx::AccessFlagBit &rhs, bool buffer) {
    bool dep{false};
    if (buffer) {
        dep = !isReadOnlyAccess(lhs) || !isReadOnlyAccess(rhs);
    } else {
        dep = (!isReadOnlyAccess(lhs) || !isReadOnlyAccess(rhs)) || (lhs != rhs);
    }
    return dep;
}

template <typename Graph>
void tryAddEdge(uint32_t src, uint32_t dst, Graph &graph) {
    if (src != dst && !graph.edge(src, dst).second) {
        graph.add_edge(src, dst);
    }
}

bool isResourceView(const ResourceGraph::vertex_descriptor v, const ResourceGraph &resg) {
    return resg.isTextureView(v); // || isBufferView
}

gfx::ResourceRange getResourceRange(const ResourceGraph::vertex_descriptor v,
                                    const ResourceGraph &resg) {
    const auto &desc = resg.getDesc(v);
    gfx::ResourceRange range{
        desc.width,
        desc.height,
        desc.depthOrArraySize,
    };

    if (isResourceView(v, resg)) {
        const auto &subResView = resg.value(SubresourceView_{}, v);
        range.firstSlice = subResView.firstArraySlice;
        range.numSlices = subResView.numArraySlices;
        range.mipLevel = subResView.indexOrFirstMipLevel;
        range.levelCount = subResView.numMipLevels;
        range.basePlane = subResView.firstPlane;
        range.planeCount = subResView.numPlanes;
    } else {
        range.numSlices = desc.depthOrArraySize;
        range.levelCount = desc.mipLevels;
    }

    return range;
}

ResourceGraph::vertex_descriptor realID(const ccstd::pmr::string &name, const ResourceGraph &resg) {
    auto resID = resg.vertex(name);
    while (resg.get_parent(resID) != ResourceGraph::null_vertex()) {
        resID = resg.get_parent(resID);
    }
    return resID;
}

bool depthStencil(gfx::Format format) {
    return format == gfx::Format::DEPTH_STENCIL || format == gfx::Format::DEPTH;
}

void subResourceFeedback(ResourceGraph &resg, ResourceGraph::vertex_descriptor parentID, gfx::Format subFormat) {
    auto &parentDesc = resg.getDesc(parentID);
    if (depthStencil(subFormat) || parentDesc.format != subFormat) {
        parentDesc.textureFlags |= gfx::TextureFlagBit::MUTABLE_VIEW_FORMAT;
    }
}

auto dependencyCheck(ResourceAccessGraph &rag, ResourceAccessGraph::vertex_descriptor curVertID, ResourceGraph &resourceGraph, const ViewStatus &viewStatus) {
    auto &accessRecord = rag.resourceAccess;
    const auto &[name, access, visibility, accessFlag, originRange] = viewStatus;
    auto resourceID = rag.resourceIndex.at(name);
    const auto &states = resourceGraph.getStates(resourceID);
    const auto &desc = resourceGraph.getDesc(resourceID);

    auto range = originRange;
    if (rag.movedSourceStatus.find(name) != rag.movedSourceStatus.end()) {
        range = rag.movedSourceStatus.at(name).range;
    }

    bool isExternalPass = resourceGraph.getTraits(resourceID).hasSideEffects();
    if (isExternalPass) {
        auto status = rag.leafPasses.emplace(curVertID, LeafStatus{true, true}).first;
        status->second.needCulling &= access == AccessType::READ;
    }
    auto iter = accessRecord.find(name);
    ResourceAccessGraph::vertex_descriptor lastVertID{EXPECT_START_ID};
    gfx::AccessFlagBit lastAccess{gfx::AccessFlagBit::NONE};

    if (iter == accessRecord.end()) {
        accessRecord[name].emplace(curVertID, AccessStatus{accessFlag, range});
        if (isExternalPass) {
            lastAccess = states.states;
        }

        // update parent
        auto parentID = realID(name, resourceGraph);
        if (parentID != resourceID) {
            const auto &realName = resourceGraph.getName(parentID);
            auto lastIter = accessRecord[realName].rbegin();
            if (lastIter->first == curVertID) {
                // in case more than 1 view of same resource in a renderpass
                ++lastIter;
            }
            accessRecord[name].emplace(*lastIter);
            accessRecord[realName][curVertID] = AccessStatus{accessFlag, range};
            subResourceFeedback(resourceGraph, parentID, desc.format);
        } else {
            accessRecord[name].emplace(0, AccessStatus{lastAccess, range});
        }
    } else {
        auto &transMap = iter->second;
        CC_ASSERT(!transMap.empty());

        const auto lastRecordIter = (--transMap.end());
        const auto &lastStatus = lastRecordIter->second;
        lastAccess = lastStatus.accessFlag;
        bool isBuffer = desc.dimension == ResourceDimension::BUFFER;
        bool dependent = accessDependent(lastAccess, accessFlag, isBuffer);

        if (!dependent) {
            for (auto recordIter = transMap.rbegin(); recordIter != transMap.rend(); ++recordIter) {
                if (accessDependent(recordIter->second.accessFlag, accessFlag, isBuffer)) {
                    lastVertID = recordIter->first;
                    break;
                }
            }
            if (isExternalPass) {
                lastAccess = states.states;
            }
            transMap[curVertID] = {accessFlag, range};
        } else {
            lastVertID = lastRecordIter->first;
            transMap[curVertID] = {accessFlag, range};
        }

        if (viewStatus.access != AccessType::WRITE) {
            subResourceFeedback(resourceGraph, resourceID, desc.format);
        }
    }
    auto lastDependentVert = lastVertID; // last dependent vert, WAW/WAR/RAW
    auto nearestAccess = lastAccess;     // last access, maybe RAR
    return std::make_tuple(lastDependentVert, nearestAccess);
}

ResourceGraph::vertex_descriptor parentResource(ResourceGraph::vertex_descriptor vert, const ResourceGraph &resg) {
    const auto &desc = resg.getDesc(vert);
    auto ret = vert;
    if (desc.dimension == ResourceDimension::BUFFER) {
        // TODO(Zeqaing): bufferview
    } else {
        auto srcParentID = vert;
        while (resg.isTextureView(srcParentID)) {
            srcParentID = resg.get_parent(srcParentID);
        }
        ret = srcParentID;
    }
    return ret;
}

gfx::ShaderStageFlagBit getVisibility(const RenderGraph &renderGraph, const LayoutGraphData &lgd, uint32_t passID, const PmrString &resName) { // NOLINT
    auto iter = lgd.attributeIndex.find(resName);
    if (iter == lgd.attributeIndex.end()) {
        iter = lgd.constantIndex.find(resName);
        if (iter == lgd.constantIndex.end()) {
            // resource not in descriptor: eg. input or output attachment.
            return gfx::ShaderStageFlagBit::NONE;
        }
    }
    auto slotID = iter->second;

    auto layoutID = LayoutGraphData::null_vertex();
    const auto &layoutName = renderGraph.getLayout(passID);
    if (layoutName.empty()) { // must be single subpass
        auto parentID = renderGraph.get_parent(passID);
        CC_EXPECTS(parentID != RenderGraph::null_vertex() &&
                   renderGraph.get_parent(parentID) == RenderGraph::null_vertex());
        const auto &layoutName2 = renderGraph.getLayout(parentID);
        CC_EXPECTS(!layoutName2.empty());
        layoutID = lgd.locate(layoutName2);
    } else {
        layoutID = lgd.locate(layoutName);
    }
    CC_ENSURES(layoutID != LayoutGraphData::null_vertex());

    const auto &layout = lgd.getLayout(layoutID);
    for (const auto &pair : layout.descriptorSets) {
        for (const auto &block : pair.second.descriptorSetLayoutData.descriptorBlocks) {
            for (const auto &descriptor : block.descriptors) {
                if (descriptor.descriptorID.value == slotID.value) {
                    return block.visibility;
                }
            }
        }
    }
    // unreachable
    CC_EXPECTS(false);

    return gfx::ShaderStageFlagBit::NONE;
};

gfx::MemoryAccessBit toGfxAccess(AccessType type) {
    switch (type) {
        case AccessType::READ:
            return gfx::MemoryAccessBit::READ_ONLY;
        case AccessType::WRITE:
            return gfx::MemoryAccessBit::WRITE_ONLY;
        case AccessType::READ_WRITE:
            return gfx::MemoryAccessBit::READ_WRITE;
        default:
            return gfx::MemoryAccessBit::NONE;
    }
};

auto mapTextureFlags(ResourceFlags flags) {
    gfx::TextureUsage usage = gfx::TextureUsage::NONE;
    if ((flags & ResourceFlags::SAMPLED) != ResourceFlags::NONE) {
        usage |= gfx::TextureUsage::SAMPLED;
    }
    if ((flags & ResourceFlags::STORAGE) != ResourceFlags::NONE) {
        usage |= gfx::TextureUsage::STORAGE;
    }
    if ((flags & ResourceFlags::SHADING_RATE) != ResourceFlags::NONE) {
        usage |= gfx::TextureUsage::SHADING_RATE;
    }
    if ((flags & ResourceFlags::COLOR_ATTACHMENT) != ResourceFlags::NONE) {
        usage |= gfx::TextureUsage::COLOR_ATTACHMENT;
    }
    if ((flags & ResourceFlags::DEPTH_STENCIL_ATTACHMENT) != ResourceFlags::NONE) {
        usage |= gfx::TextureUsage::DEPTH_STENCIL_ATTACHMENT;
    }
    if ((flags & ResourceFlags::INPUT_ATTACHMENT) != ResourceFlags::NONE) {
        usage |= gfx::TextureUsage::INPUT_ATTACHMENT;
    }
    return usage;
}

auto getTextureStatus(std::string_view name, AccessType access, gfx::ShaderStageFlags visibility, const ResourceGraph &resourceGraph, bool rasterized) {
    gfx::ShaderStageFlags vis{visibility};
    if (vis == gfx::ShaderStageFlags::NONE) {
        // attachment
        vis = gfx::ShaderStageFlagBit::FRAGMENT;
    }
    gfx::AccessFlags accesFlag;
    auto vertex = resourceGraph.vertex(name);

    const auto &desc = resourceGraph.getDesc(vertex);

    // can't find this resource in layoutdata, should be output attachment.
    gfx::TextureUsage texUsage = gfx::TextureUsage::NONE;
    if (access != AccessType::WRITE) {
        if ((desc.flags & ResourceFlags::INPUT_ATTACHMENT) != ResourceFlags::NONE && rasterized) {
            texUsage |= (mapTextureFlags(desc.flags) & (gfx::TextureUsage::COLOR_ATTACHMENT | gfx::TextureUsage::DEPTH_STENCIL_ATTACHMENT | gfx::TextureUsage::INPUT_ATTACHMENT));
        } else {
            texUsage |= (mapTextureFlags(desc.flags) & (gfx::TextureUsage::SAMPLED | gfx::TextureUsage::STORAGE | gfx::TextureUsage::SHADING_RATE | gfx::TextureUsage::DEPTH_STENCIL_ATTACHMENT));
        }
    }

    if (access != AccessType::READ) {
        texUsage |= (mapTextureFlags(desc.flags) & (gfx::TextureUsage::COLOR_ATTACHMENT | gfx::TextureUsage::DEPTH_STENCIL_ATTACHMENT | gfx::TextureUsage::STORAGE));
    }
    accesFlag = gfx::getAccessFlags(texUsage, toGfxAccess(access), vis);

    return std::make_tuple(vis, accesFlag);
};

auto getBufferStatus(const PmrString &name, AccessType access, gfx::ShaderStageFlags visibility, const ResourceGraph &resourceGraph) {
    gfx::AccessFlags accesFlag;
    auto vertex = resourceGraph.vertex(name);
    const auto &desc = resourceGraph.getDesc(vertex);

    gfx::BufferUsage bufferUsage{gfx::BufferUsage::NONE};
    // copy is not included in this logic because copy can be set TRANSFER_xxx directly.
    if (access != AccessType::READ) {
        bufferUsage = gfx::BufferUsage::STORAGE;
    }

    if (access != AccessType::WRITE) {
        bool uniformFlag = (desc.flags & ResourceFlags::UNIFORM) != ResourceFlags::NONE;
        bool storageFlag = (desc.flags & ResourceFlags::STORAGE) != ResourceFlags::NONE;

        // CC_EXPECTS(uniformFlag ^ storageFlag);
        //  uniform or read-only storage buffer
        bufferUsage = uniformFlag ? gfx::BufferUsage::UNIFORM : gfx::BufferUsage::STORAGE;
    }

    // those buffers not found in descriptorlayout but appear here,
    // can and only can be VERTEX/INDEX/INDIRECT BUFFER,
    // only copy pass is allowed.

    auto memAccess = toGfxAccess(access);
    accesFlag = gfx::getAccessFlags(bufferUsage, gfx::MemoryUsage::DEVICE, memAccess, visibility);
    return std::make_tuple(visibility, accesFlag);
};

void addAccessStatus(ResourceAccessGraph &rag, const ResourceGraph &rg, ResourceAccessNode &node, const ViewStatus &status) {
    const auto &[name, access, visibility, accessFlag, range] = status;
    uint32_t rescID = rg.vertex(name);
    const auto &resourceDesc = rg.getDesc(rescID);
    const auto &traits = rg.getTraits(rescID);

    if (std::find(rag.resourceNames.begin(), rag.resourceNames.end(), name) == rag.resourceNames.end()) {
        rag.resourceIndex.emplace(name, rescID);
        rag.resourceNames.emplace_back(name);
    }

    node.resourceStatus.emplace(name, AccessStatus{
                                          accessFlag,
                                          range,
                                      });
}

namespace {
const uint32_t ATTACHMENT_TYPE_WEIGHT[] = {0, 2, 1};

struct AttachmentSortKey {
    gfx::SampleCount samples;
    AccessType accessType;
    uint32_t attachmentWeight;
    uint32_t slotID;
    const ccstd::pmr::string &slotName;
    const ccstd::pmr::string &name;
};

struct SubpassComparator {
    bool operator()(const AttachmentSortKey &lhs, const AttachmentSortKey &rhs) const {
        return std::tie(rhs.samples, lhs.accessType, lhs.attachmentWeight, lhs.name) < std::tie(lhs.samples, rhs.accessType, rhs.attachmentWeight, rhs.name);
    }
};

struct PassComparator {
    bool operator()(const AttachmentSortKey &lhs, const AttachmentSortKey &rhs) const {
        return lhs.slotID < rhs.slotID;
    }
};

struct ViewInfo {
    gfx::Format format{gfx::Format::UNKNOWN};
    LayoutAccess access;
    gfx::LoadOp loadOp;
    gfx::StoreOp storeOp;
    AttachmentType attachmentType;
};

template <typename Comp>
using AttachmentMap = ccstd::pmr::map<AttachmentSortKey, ViewInfo, Comp>;
} // namespace

template <typename Comp>
void fillRenderPassInfo(const AttachmentMap<Comp> &colorMap,
                        FGRenderPassInfo &fgRenderpassInfo,
                        const ResourceGraph &resg) {
    for (const auto &pair : colorMap) {
        const auto &key = pair.first;
        const auto &viewInfo = pair.second;
        if (viewInfo.attachmentType == AttachmentType::DEPTH_STENCIL) {
            // put ds[sample > 1] to ds, ds[sample == 1] to dsResolve, swap them if not a ms pass in endRenderPass.
            bool ms = key.samples != gfx::SampleCount::X1;
            auto &ds = ms ? fgRenderpassInfo.rpInfo.depthStencilAttachment
                          : fgRenderpassInfo.rpInfo.depthStencilResolveAttachment;
            auto &dsAccess = ms ? fgRenderpassInfo.dsAccess : fgRenderpassInfo.dsResolveAccess;
            if (ds.format == gfx::Format::UNKNOWN) {
                ds.depthLoadOp = viewInfo.loadOp;
                ds.stencilLoadOp = viewInfo.loadOp;
                ds.sampleCount = key.samples;
                ds.format = viewInfo.format;
                dsAccess.prevAccess = viewInfo.access.prevAccess;
            }
            ds.depthStoreOp = viewInfo.storeOp;
            ds.stencilStoreOp = viewInfo.storeOp;
            dsAccess.nextAccess = viewInfo.access.nextAccess;

            auto iter = fgRenderpassInfo.viewIndex.find(key.name.c_str());
            if (iter == fgRenderpassInfo.viewIndex.end()) {
                auto parentID = realID(key.name, resg);
                const auto &parentName = resg.getName(parentID);
                AttachmentInfo attachmentInfo(fgRenderpassInfo.get_allocator());
                attachmentInfo.parentName = parentName;
                attachmentInfo.attachmentIndex = gfx::INVALID_BINDING;
                attachmentInfo.isResolveView = fgRenderpassInfo.resolveCount && key.samples == gfx::SampleCount::X1;
                fgRenderpassInfo.viewIndex.emplace(key.name, attachmentInfo);
            }
        } else {
            auto iter = fgRenderpassInfo.viewIndex.find(key.name.c_str());
            auto &colors = fgRenderpassInfo.rpInfo.colorAttachments;
            if (iter == fgRenderpassInfo.viewIndex.end()) {
                auto colorIndex = fgRenderpassInfo.orderedViews.size();
                auto &color = colors.emplace_back();
                color.format = viewInfo.format;
                color.sampleCount = key.samples;
                color.storeOp = viewInfo.storeOp;
                color.loadOp = viewInfo.loadOp;
                fgRenderpassInfo.colorAccesses.emplace_back(LayoutAccess{viewInfo.access.prevAccess, viewInfo.access.nextAccess});
                fgRenderpassInfo.colorAccesses[colorIndex].nextAccess = viewInfo.access.nextAccess;

                auto parentID = realID(key.name, resg);
                const auto &parentName = resg.getName(parentID);
                AttachmentInfo attachmentInfo(fgRenderpassInfo.get_allocator());
                attachmentInfo.parentName = parentName;
                attachmentInfo.attachmentIndex = static_cast<uint32_t>(fgRenderpassInfo.orderedViews.size());
                attachmentInfo.isResolveView = fgRenderpassInfo.resolveCount && key.samples == gfx::SampleCount::X1;

                fgRenderpassInfo.viewIndex.emplace(key.name, attachmentInfo);
                fgRenderpassInfo.orderedViews.emplace_back(key.name);
            } else {
                const auto &attachmentInfo = fgRenderpassInfo.viewIndex.at(key.name);
                auto cIndex = attachmentInfo.attachmentIndex;
                if (cIndex == gfx::INVALID_BINDING) {
                    bool ms = key.samples == gfx::SampleCount::X1;
                    auto &ds = ms ? fgRenderpassInfo.rpInfo.depthStencilAttachment : fgRenderpassInfo.rpInfo.depthStencilResolveAttachment;
                    ds.depthStoreOp = viewInfo.storeOp;
                    ds.stencilStoreOp = viewInfo.storeOp;
                    auto &access = ms ? fgRenderpassInfo.dsAccess : fgRenderpassInfo.dsResolveAccess;
                    access.nextAccess = viewInfo.access.nextAccess;
                } else {
                    auto &color = fgRenderpassInfo.rpInfo.colorAttachments[cIndex];
                    color.storeOp = viewInfo.storeOp;
                    fgRenderpassInfo.colorAccesses[cIndex].nextAccess = viewInfo.access.nextAccess;
                }
            }
        }
    }
};

void extractNames(const ccstd::pmr::string &resName,
                  const RasterView &view,
                  ccstd::pmr::vector<std::pair<ccstd::pmr::string, uint32_t>> &names) {
    // depth_stencil
    if (view.attachmentType == AttachmentType::DEPTH_STENCIL) {
        if (!defaultAttachment(view.slotName)) {
            if (strstr(resName.c_str(), "/")) {
                names.emplace_back(resName, 0);
            } else {
                auto &subresName = names.emplace_back();
                subresName.first = concatResName(resName, DEPTH_PLANE_NAME, names.get_allocator().resource());
                subresName.second = 0;
            }
        }
        if (!defaultAttachment(view.slotName1)) {
            if (strstr(resName.c_str(), "/")) {
                names.emplace_back(resName, 1);
            } else {
                auto &subresName = names.emplace_back();
                subresName.first = concatResName(resName, STENCIL_PLANE_NAME, names.get_allocator().resource());
                subresName.second = 1;
            }
        }
    }

    // cube

    // array

    if (names.empty()) {
        names.emplace_back(resName, 0);
    }
}

template <typename Comp>
auto checkRasterViews(const Graphs &graphs,
                      ResourceAccessGraph::vertex_descriptor ragVertID,
                      ResourceAccessNode &node,
                      const RasterViewsMap &rasterViews,
                      AttachmentMap<Comp> &colorMap) {
    const auto &[renderGraph, layoutGraphData, resourceGraph, resourceAccessGraph, relationGraph] = graphs;
    const auto passID = resourceAccessGraph.getPassID(ragVertID);
    bool dependent = false;
    bool hasDS = false;

    auto explicitVis = gfx::ShaderStageFlagBit::NONE;
    if (renderGraph.holds<ComputeTag>(passID)) {
        explicitVis |= gfx::ShaderStageFlagBit::COMPUTE;
    }

    for (const auto &pair : rasterViews) {
        const auto &rasterView = pair.second;
        const auto &resName = pair.first;
        const auto resID = resourceGraph.vertex(resName);
        auto access = rasterView.accessType;
        gfx::ShaderStageFlagBit originVis = getVisibility(renderGraph, layoutGraphData, passID, pair.second.slotName) | explicitVis | pair.second.shaderStageFlags;
        const auto &[vis, accessFlag] = getTextureStatus(resName, access, originVis, resourceGraph, true);
        auto range = getResourceRange(resID, resourceGraph);

        ViewStatus viewStatus{resName, access, vis, accessFlag, range};
        addAccessStatus(resourceAccessGraph, resourceGraph, node, viewStatus);

        const auto &[lastVertId, lastAccess] = dependencyCheck(resourceAccessGraph, ragVertID, resourceGraph, viewStatus);
        tryAddEdge(lastVertId, ragVertID, resourceAccessGraph);
        tryAddEdge(lastVertId, ragVertID, relationGraph);
        dependent |= (lastVertId != EXPECT_START_ID);

        const auto &desc = resourceGraph.getDesc(resID);
        colorMap.emplace(AttachmentSortKey{desc.sampleCount,
                                           rasterView.accessType,
                                           ATTACHMENT_TYPE_WEIGHT[static_cast<uint32_t>(rasterView.attachmentType)],
                                           rasterView.slotID,
                                           rasterView.slotName1.empty() ? rasterView.slotName : rasterView.slotName1,
                                           resName},
                         ViewInfo{desc.format,
                                  LayoutAccess{lastAccess, accessFlag},
                                  rasterView.loadOp,
                                  rasterView.storeOp,
                                  rasterView.attachmentType});
        hasDS |= rasterView.attachmentType == AttachmentType::DEPTH_STENCIL;

        ccstd::pmr::vector<std::pair<ccstd::pmr::string, uint32_t>> names(resourceAccessGraph.get_allocator());
        extractNames(resName, rasterView, names);
        for (const auto &[subresFullName, plane] : names) {
            resourceAccessGraph.resourceIndex.emplace(subresFullName, resourceGraph.vertex(subresFullName));
        }
    }
    return std::make_tuple(dependent, hasDS);
}

bool checkComputeViews(const Graphs &graphs, ResourceAccessGraph::vertex_descriptor ragVertID, ResourceAccessNode &node, const ComputeViewsMap &computeViews) {
    const auto &[renderGraph, layoutGraphData, resourceGraph, resourceAccessGraph, relationGraph] = graphs;
    const auto passID = resourceAccessGraph.getPassID(ragVertID);
    bool dependent = false;

    for (const auto &pair : computeViews) {
        const auto &values = pair.second;
        const auto &resName = pair.first;
        const auto resID = resourceGraph.vertex(resName);
        auto range = getResourceRange(resID, resourceGraph);
        for (const auto &computeView : values) {
            gfx::ShaderStageFlagBit vis = gfx::ShaderStageFlagBit::NONE;
            for (const auto &view : pair.second) {
                vis |= getVisibility(renderGraph, layoutGraphData, passID, view.name);
                vis |= view.shaderStageFlags;
            }
            const auto &desc = resourceGraph.getDesc(resID);
            gfx::AccessFlagBit accessFlag{gfx::AccessFlagBit::NONE};
            if (desc.dimension == ResourceDimension::BUFFER) {
                const auto &[ignore0, access] = getBufferStatus(pair.first, computeView.accessType, vis, resourceGraph);
                accessFlag = access;
            } else {
                const auto &[ignore0, access] = getTextureStatus(pair.first, computeView.accessType, vis, resourceGraph, false);
                accessFlag = access;
            }
            range.firstSlice = computeView.plane;
            range.numSlices = 1;
            ViewStatus viewStatus{pair.first, computeView.accessType, vis, accessFlag, range};
            addAccessStatus(resourceAccessGraph, resourceGraph, node, viewStatus);
            auto [lastVertId, neareastAccess] = dependencyCheck(resourceAccessGraph, ragVertID, resourceGraph, viewStatus);

            tryAddEdge(lastVertId, ragVertID, resourceAccessGraph);
            tryAddEdge(lastVertId, ragVertID, relationGraph);
            dependent = lastVertId != EXPECT_START_ID;

            if (resourceGraph.num_children(resID) && (computeView.plane != 0xFFFFFFFF)) {
                const auto &subresFullName = getSubresNameByPlane(resName, computeView.plane, resourceGraph, resourceAccessGraph.resource());
                resourceAccessGraph.resourceIndex.emplace(subresFullName, resourceGraph.vertex(subresFullName));
            }
        }
    }

    return dependent;
}

template <typename Comp>
bool checkResolveResource(const Graphs &graphs,
                          uint32_t ragVertID,
                          ResourceAccessNode &node,
                          const ccstd::pmr::vector<ResolvePair> &resolves,
                          AttachmentMap<Comp> &colorMap) {
    const auto &[renderGraph, layoutGraphData, resourceGraph, resourceAccessGraph, relationGraph] = graphs;
    const auto passID = resourceAccessGraph.getPassID(ragVertID);
    bool dependent = false;

    for (const auto &pair : resolves) {
        const auto &resolveTargetName = pair.target;

        const auto &resID = resourceGraph.vertex(resolveTargetName);
        const auto &desc = resourceGraph.getDesc(resID);

        bool isDS = desc.format == gfx::Format::DEPTH_STENCIL;
        auto accessFlag = isDS ? gfx::AccessFlagBit::DEPTH_STENCIL_ATTACHMENT_WRITE : gfx::AccessFlagBit::COLOR_ATTACHMENT_WRITE;

        gfx::ShaderStageFlagBit vis = gfx::ShaderStageFlagBit::FRAGMENT;
        auto range = getResourceRange(resID, resourceGraph);

        ViewStatus viewStatus{resolveTargetName, AccessType::WRITE, vis, accessFlag, range};
        addAccessStatus(resourceAccessGraph, resourceGraph, node, viewStatus);

        const auto &[lastVertId, lastAccess] = dependencyCheck(resourceAccessGraph, ragVertID, resourceGraph, viewStatus);
        tryAddEdge(lastVertId, ragVertID, resourceAccessGraph);
        tryAddEdge(lastVertId, ragVertID, relationGraph);
        dependent = lastVertId != EXPECT_START_ID;

        AttachmentType attachmentType = isDS ? AttachmentType::DEPTH_STENCIL : AttachmentType::RENDER_TARGET;
        colorMap.emplace(AttachmentSortKey{desc.sampleCount,
                                           AccessType::WRITE,
                                           ATTACHMENT_TYPE_WEIGHT[static_cast<uint32_t>(attachmentType)],
                                           static_cast<uint32_t>(colorMap.size()),
                                           "",
                                           resolveTargetName},
                         ViewInfo{desc.format,
                                  LayoutAccess{lastAccess, accessFlag},
                                  gfx::LoadOp::DISCARD,
                                  gfx::StoreOp::STORE,
                                  attachmentType});
    }
    return dependent;
}

uint32_t record(uint32_t index) {
    uint32_t res = 1 << index;
    return res;
}

uint32_t record(const ccstd::vector<uint32_t> &indices) {
    uint32_t res = 0;
    for (auto attachmentIndex : indices) {
        res |= 1 << attachmentIndex;
    }
    return res;
}

void extract(uint32_t val, ccstd::vector<uint32_t> &preserves) {
    uint32_t index = 0;
    while (val) {
        if (val & 0x1) {
            preserves.emplace_back(index);
        }
        val = val >> 1;
        ++index;
    }
}

void getPreserves(gfx::RenderPassInfo &rpInfo) {
    std::stack<gfx::SubpassInfo *> stack;
    for (auto &info : rpInfo.subpasses) {
        stack.push(&info);
    }

    auto dsIndex = record(rpInfo.colorAttachments.size());
    auto dsMask = record(rpInfo.colorAttachments.size()) | record(rpInfo.colorAttachments.size() + 1);

    uint32_t laterRead{0};
    while (!stack.empty()) {
        auto *tail = stack.top();
        stack.pop();

        auto readRecord = record(tail->inputs);
        auto writeRecord = record(tail->colors);
        auto resolveRecord = record(tail->resolves);

        uint32_t dsRecord = 0;
        if (tail->depthStencil != INVALID_ID) {
            dsRecord |= record(tail->depthStencil);
        }
        if (tail->depthStencilResolve != INVALID_ID) {
            dsRecord |= record(tail->depthStencilResolve);
        }
        auto shown = readRecord | writeRecord | resolveRecord | dsRecord;
        auto needPreserve = (shown | laterRead) ^ shown;
        needPreserve = (needPreserve & dsMask) == dsMask ? (needPreserve & ~dsMask) | dsIndex : (needPreserve & ~dsMask);
        extract(needPreserve, tail->preserves);
        laterRead |= readRecord;
    }
}

uint32_t getDepthStencilSlot(uint32_t uniqueResourceCount, uint32_t resolveCount, bool hasDS) {
    auto dsSlot = uniqueResourceCount - hasDS + resolveCount;
    return dsSlot;
}

void startRenderPass(const Graphs &graphs, uint32_t passID, const RasterPass &pass) {
    const auto &[renderGraph, layoutGraphData, resourceGraph, resourceAccessGraph, relationGraph] = graphs;

    auto vertID = resourceAccessGraph.add_vertex(passID);
    auto rlgVertID = relationGraph.add_vertex(vertID);
    CC_EXPECTS(static_cast<uint32_t>(rlgVertID) == static_cast<uint32_t>(vertID));

    auto &fgRenderPassInfo = resourceAccessGraph.getRenderPassInfo(vertID);
    if (pass.subpassGraph.subpasses.empty()) {
        AttachmentMap<PassComparator> colorMap(resourceAccessGraph.get_allocator());
        auto &accessNode = resourceAccessGraph.getPassNode(vertID);
        std::ignore = checkRasterViews(graphs, rlgVertID, accessNode, pass.rasterViews, colorMap);
        std::ignore = checkComputeViews(graphs, rlgVertID, accessNode, pass.computeViews);
        fillRenderPassInfo(colorMap, fgRenderPassInfo, resourceGraph);
    } else {
        const auto &subpasses = pass.subpassGraph.subpasses;
        uint32_t initVal{0};
        fgRenderPassInfo.resolveCount = std::accumulate(subpasses.begin(), subpasses.end(), initVal, [](uint32_t ct, const Subpass &subpass) {
            return ct + subpass.resolvePairs.size();
        });
    }

    const auto &subpasses = pass.subpassGraph.subpasses;
    uint32_t initVal{0};
    ccstd::pmr::set<ResourceGraph::vertex_descriptor> resSet{resourceAccessGraph.get_allocator()};
    for (const auto &subpass : subpasses) {
        for (const auto &view : subpass.rasterViews) {
            resSet.emplace(realID(view.first, resourceGraph));
        }
        auto &dsResolveAttachment = fgRenderPassInfo.rpInfo.depthStencilResolveAttachment;
        if (dsResolveAttachment.format != gfx::Format::UNKNOWN) {
            const auto &dsAccess = fgRenderPassInfo.dsResolveAccess;
            dsResolveAttachment.barrier = getGeneralBarrier(cc::gfx::Device::getInstance(), dsAccess.prevAccess, dsAccess.nextAccess);
        }
    }
    fgRenderPassInfo.uniqueRasterViewCount = resSet.size();
}

void endRenderPass(const Graphs &graphs, uint32_t passID, const RasterPass &pass) {
    const auto &[renderGraph, layoutGraphData, resourceGraph, resourceAccessGraph, relationGraph] = graphs;

    auto vertID = resourceAccessGraph.vertex(passID);
    auto rlgVertID = relationGraph.vertex(vertID);

    auto &node = resourceAccessGraph.getPassNode(vertID);
    auto &fgRenderpassInfo = resourceAccessGraph.getRenderPassInfo(vertID);

    bool filledDS{fgRenderpassInfo.dsAccess.nextAccess != gfx::AccessFlags::NONE};
    bool filledDSResolve{fgRenderpassInfo.dsResolveAccess.nextAccess != gfx::AccessFlags::NONE};
    if (filledDSResolve && !filledDS) {
        CC_ASSERT(fgRenderpassInfo.rpInfo.depthStencilAttachment.format == gfx::Format::UNKNOWN);
        std::swap(fgRenderpassInfo.rpInfo.depthStencilAttachment, fgRenderpassInfo.rpInfo.depthStencilResolveAttachment);
        std::swap(fgRenderpassInfo.dsAccess, fgRenderpassInfo.dsResolveAccess);
    }

    auto colorSize = fgRenderpassInfo.orderedViews.size();
    for (auto dsIter = fgRenderpassInfo.viewIndex.begin(); dsIter != fgRenderpassInfo.viewIndex.end(); ++dsIter) {
        const auto &resName = dsIter->first;
        const auto &parentName = dsIter->second.parentName;
        if ((dsIter->second.attachmentIndex == gfx::INVALID_BINDING) && (resName == parentName)) {
            fgRenderpassInfo.orderedViews.emplace_back(dsIter->first);
        }
    }

    if (!pass.subpassGraph.subpasses.empty()) {
        // for (auto &subpassInfo : fgRenderpassInfo.rpInfo.subpasses) {
        //     if (subpassInfo.depthStencil != gfx::INVALID_BINDING) {
        //         if (subpassInfo.depthStencil != gfx::INVALID_BINDING) {
        //             subpassInfo.depthStencil = colorSize;
        //         }
        //         if (subpassInfo.depthStencilResolve != gfx::INVALID_BINDING) {
        //             subpassInfo.depthStencilResolve = colorSize + 1;
        //         }
        //     }
        // }
        getPreserves(fgRenderpassInfo.rpInfo);
    }
}

void startRenderSubpass(const Graphs &graphs, uint32_t passID, const RasterSubpass &pass) {
    const auto &[renderGraph, layoutGraphData, resourceGraph, resourceAccessGraph, relationGraph] = graphs;

    auto vertID = resourceAccessGraph.add_vertex(passID);
    auto rlgVertID = relationGraph.add_vertex(vertID);
    CC_EXPECTS(static_cast<uint32_t>(rlgVertID) == static_cast<uint32_t>(vertID));

    auto &accessNode = resourceAccessGraph.getPassNode(rlgVertID);

    auto parentID = renderGraph.get_parent(passID);
    auto parentRagVertID = resourceAccessGraph.vertex(parentID);
    auto &fgRenderpassInfo = resourceAccessGraph.getRenderPassInfo(parentRagVertID);

    const auto &rg = renderGraph;
    auto &rag = resourceAccessGraph;
    auto &resg = resourceGraph;

    auto process = [&](auto &colorMap) {
        auto [hasDep, hasDS] = checkRasterViews(graphs, rlgVertID, accessNode, pass.rasterViews, colorMap);
        hasDep |= checkComputeViews(graphs, rlgVertID, accessNode, pass.computeViews);
        hasDep |= checkResolveResource(graphs, rlgVertID, accessNode, pass.resolvePairs, colorMap);
        fillRenderPassInfo(colorMap, fgRenderpassInfo, resg);

        auto &subpassInfo = fgRenderpassInfo.rpInfo.subpasses.emplace_back();
        auto &dependencies = fgRenderpassInfo.rpInfo.dependencies;

        // subpass info & subpass dependencies
        for (const auto &pair : colorMap) {
            const auto &sortKey = pair.first;
            const std::string_view name = sortKey.name;
            auto resID = resg.vertex(sortKey.name);
            const auto &desc = resg.getDesc(resID);
            const auto &[ignored, cIndex, isResolveView] = fgRenderpassInfo.viewIndex.at(name.data());
            if (isResolveView) {
                auto resolveIter = std::find_if(pass.resolvePairs.begin(), pass.resolvePairs.end(), [&name](const ResolvePair &resolve) {
                    return strcmp(resolve.target.c_str(), name.data()) == 0;
                });
                if (desc.format == gfx::Format::DEPTH_STENCIL) {
                    subpassInfo.depthStencilResolve = getDepthStencilSlot(fgRenderpassInfo.uniqueRasterViewCount, fgRenderpassInfo.resolveCount, hasDS) + 1;
                    if (resolveIter->mode != gfx::ResolveMode::NONE) {
                        subpassInfo.depthResolveMode = resolveIter->mode;
                    }
                    if (resolveIter->mode1 != gfx::ResolveMode::NONE) {
                        subpassInfo.stencilResolveMode = resolveIter->mode1;
                    }
                } else {
                    if (subpassInfo.resolves.empty()) {
                        subpassInfo.resolves.resize(pass.rasterViews.size() - hasDS, gfx::INVALID_BINDING);
                    }
                    const auto &resolveSrc = resolveIter->source;
                    const auto &resourceSrcInfo = fgRenderpassInfo.viewIndex.at(resolveSrc);
                    subpassInfo.resolves[resourceSrcInfo.attachmentIndex] = cIndex;
                }
            } else {
                if (desc.format == gfx::Format::DEPTH_STENCIL) {
                    auto dsSlot = getDepthStencilSlot(fgRenderpassInfo.uniqueRasterViewCount, fgRenderpassInfo.resolveCount, hasDS);
                    if (sortKey.accessType != AccessType::WRITE) {
                        subpassInfo.inputs.emplace_back(dsSlot);
                    }
                    if (sortKey.accessType != AccessType::READ) {
                        subpassInfo.depthStencil = dsSlot;
                    }
                } else {
                    if (sortKey.accessType != AccessType::WRITE) {
                        subpassInfo.inputs.emplace_back(cIndex);
                    }
                    if (sortKey.accessType != AccessType::READ) {
                        subpassInfo.colors.emplace_back(cIndex);
                    }

                    if (sortKey.accessType == AccessType::READ_WRITE) {
                        auto &selfDependency = dependencies.emplace_back();
                        selfDependency.srcSubpass = pass.subpassID;
                        selfDependency.dstSubpass = pass.subpassID;
                        selfDependency.prevAccesses = pair.second.access.nextAccess;
                        selfDependency.nextAccesses = pair.second.access.nextAccess;
                    }
                }
            }

            if (hasDep) {
                auto &dependency = dependencies.emplace_back();
                auto lastIter = ++rag.resourceAccess[name.data()].rbegin();
                bool isBuffer = desc.dimension == ResourceDimension::BUFFER;
                if (accessDependent(lastIter->second.accessFlag, accessNode.resourceStatus.at(name.data()).accessFlag, isBuffer) && lastIter->second.accessFlag != gfx::AccessFlagBit::NONE) {
                    auto lastVert = lastIter->first;
                    auto lastPassID = rag.getPassID(lastVert);
                    auto lastPassIndex = INVALID_ID;
                    if (rg.holds<RasterSubpassTag>(lastPassID) && (rg.get_parent(lastPassID) == parentID)) {
                        lastPassIndex = rg.value(RasterSubpassTag{}, lastPassID).subpassID;
                    }

                    auto &dependency = dependencies.emplace_back();
                    dependency.srcSubpass = lastPassIndex;
                    dependency.dstSubpass = pass.subpassID;
                    dependency.prevAccesses = lastIter->second.accessFlag;
                    dependency.nextAccesses = pair.second.access.nextAccess;
                }
            }
        }
    };

    const auto &parentPass = renderGraph.value(RasterPassTag{}, parentID);

    if (parentPass.subpassGraph.subpasses.size() == 1) {
        // for those renderpass which consist of only 1 subpass
        AttachmentMap<PassComparator> colorMap(resourceAccessGraph.get_allocator());
        process(colorMap);
    } else {
        AttachmentMap<SubpassComparator> colorMap(resourceAccessGraph.get_allocator());
        process(colorMap);
    }
}

void startComputeSubpass(const Graphs &graphs, uint32_t passID, const ComputeSubpass &pass) {
    const auto &[renderGraph, layoutGraphData, resourceGraph, resourceAccessGraph, relationGraph] = graphs;

    auto vertID = resourceAccessGraph.add_vertex(passID);
    auto rlgVertID = relationGraph.add_vertex(vertID);
    CC_EXPECTS(static_cast<uint32_t>(rlgVertID) == static_cast<uint32_t>(vertID));

    auto &accessNode = resourceAccessGraph.getPassNode(rlgVertID);
    AttachmentMap<SubpassComparator> colorMap(resourceAccessGraph.get_allocator());

    auto parentID = renderGraph.get_parent(passID);
    auto parentRagVertID = resourceAccessGraph.vertex(parentID);
    auto &fgRenderpassInfo = resourceAccessGraph.getRenderPassInfo(parentRagVertID);

    std::ignore = checkRasterViews(graphs, rlgVertID, accessNode, pass.rasterViews, colorMap);
    std::ignore = checkComputeViews(graphs, rlgVertID, accessNode, pass.computeViews);

    fillRenderPassInfo(colorMap, fgRenderpassInfo, resourceGraph);
}

void startComputePass(const Graphs &graphs, uint32_t passID, const ComputePass &pass) {
    const auto &[renderGraph, layoutGraphData, resourceGraph, resourceAccessGraph, relationGraph] = graphs;

    auto vertID = resourceAccessGraph.add_vertex(passID);
    auto rlgVertID = relationGraph.add_vertex(vertID);
    CC_EXPECTS(static_cast<uint32_t>(rlgVertID) == static_cast<uint32_t>(vertID));

    auto &accessNode = resourceAccessGraph.getPassNode(rlgVertID);
    std::ignore = checkComputeViews(graphs, rlgVertID, accessNode, pass.computeViews);
}

void startCopyPass(const Graphs &graphs, uint32_t passID, const CopyPass &pass) {
    const auto &[renderGraph, layoutGraphData, resourceGraph, resourceAccessGraph, relationGraph] = graphs;

    auto vertID = resourceAccessGraph.add_vertex(passID);
    auto rlgVertID = relationGraph.add_vertex(vertID);
    CC_EXPECTS(static_cast<uint32_t>(rlgVertID) == static_cast<uint32_t>(vertID));
    auto &accessNode = resourceAccessGraph.getPassNode(rlgVertID);

    auto &resg = resourceGraph;
    auto &rag = resourceAccessGraph;
    auto &rlg = relationGraph;
    auto checkCopy =
        [&](const ccstd::pmr::string &resName,
            // NOLINTNEXTLINE(bugprone-easily-swappable-parameters)
            uint32_t firstSlice,
            uint32_t firstMip,
            uint32_t firstPlane,
            uint32_t sliceCount,
            uint32_t mipCount,
            bool read) {
            auto srcID = resg.vertex(resName);
            auto srcRange = getResourceRange(srcID, resg);
            srcRange.firstSlice = firstSlice;
            srcRange.mipLevel = firstMip;
            srcRange.basePlane = firstPlane;
            srcRange.numSlices = sliceCount;
            srcRange.levelCount = mipCount;

            AccessType access = read ? AccessType::READ : AccessType::WRITE;
            gfx::AccessFlags accessFlag = read ? gfx::AccessFlags::TRANSFER_READ : gfx::AccessFlags::TRANSFER_WRITE;
            ViewStatus srcViewStatus{resName, access, gfx::ShaderStageFlagBit::NONE, accessFlag, srcRange};
            addAccessStatus(rag, resg, accessNode, srcViewStatus);
            const auto &[lastVertSrc, ignore1] = dependencyCheck(rag, vertID, resg, srcViewStatus);
            tryAddEdge(lastVertSrc, vertID, rag);
            tryAddEdge(lastVertSrc, rlgVertID, rlg);
        };

    for (const auto &copy : pass.copyPairs) {
        checkCopy(copy.source,
                  copy.sourceFirstSlice, copy.sourceMostDetailedMip, copy.sourcePlaneSlice,
                  copy.numSlices, copy.mipLevels, true);

        checkCopy(copy.target,
                  copy.targetFirstSlice, copy.targetMostDetailedMip, copy.targetPlaneSlice,
                  copy.numSlices, copy.mipLevels, false);
    }

    for (const auto &upload : pass.uploadPairs) {
        checkCopy(upload.target,
                  upload.targetFirstSlice, upload.targetMostDetailedMip, upload.targetPlaneSlice,
                  upload.numSlices, upload.mipLevels, false);
    }
}

void startRaytracePass(const Graphs &graphs, uint32_t passID, const RaytracePass &pass) {
    const auto &[renderGraph, layoutGraphData, resourceGraph, resourceAccessGraph, relationGraph] = graphs;

    auto vertID = resourceAccessGraph.add_vertex(passID);
    auto rlgVertID = relationGraph.add_vertex(vertID);
    CC_EXPECTS(static_cast<uint32_t>(rlgVertID) == static_cast<uint32_t>(vertID));

    auto &accessNode = resourceAccessGraph.getPassNode(rlgVertID);
    std::ignore = checkComputeViews(graphs, rlgVertID, accessNode, pass.computeViews);
}

bool rangeCheck(
    ResourceNode &status,
    const ResourceDesc & /*desc*/,
    const PmrString & /*targetName*/,
    // NOLINTNEXTLINE(bugprone-easily-swappable-parameters)
    uint32_t firstSlice, uint32_t numSlices, uint32_t firstMip, uint32_t mipLevels, uint32_t planeIndex) {
    CC_ASSERT(planeIndex < status.planes.size());
    // spare space in target
    bool check = !status.full;
    check &= !status.planes[planeIndex].full;
    if (check) {
        for (auto slice = firstSlice; slice < firstSlice + numSlices; ++slice) {
            auto &slices = status.planes[planeIndex].slices;
            // no spare space in this slice
            check &= !slices[slice].full;
            if (!check) {
                continue;
            }
            for (auto mip = firstMip; mip < firstMip + mipLevels; ++mip) {
                auto &mips = slices[slice].mips;
                // this mip has been taken
                check &= mips[mip] == std::numeric_limits<uint32_t>::max();
                if (!check) {
                    continue;
                }
                mips[mip] = mip;
                auto maxIter = std::max_element(mips.begin(), mips.end());
                if ((*maxIter) != std::numeric_limits<uint32_t>::max()) {
                    // linear increasing
                    check &= (*maxIter) == mips.size() - 1;
                    slices[slice].full = true;
                }
            }
            if (std::all_of(slices.begin(), slices.end(), [](const SliceNode &sliceNode) { return sliceNode.full; })) {
                status.planes[planeIndex].full = true;
            }
        }
    }
    return check;
}

uint32_t getPlaneCount(gfx::Format format) {
    switch (format) {
        case gfx::Format::DEPTH_STENCIL:
            return 2;
        default:
            return 1;
    }
}

bool moveValidation(const MovePass &pass, ResourceAccessGraph &rag, const ResourceGraph &resourceGraph) {
    bool check = true;
    ccstd::pmr::vector<ccstd::pmr::string> targets(rag.get_allocator());
    for (const auto &movePair : pass.movePairs) {
        const auto &fromResName = movePair.source;
        const auto fromResID = resourceGraph.vertex(fromResName);
        const auto &fromResDesc = resourceGraph.getDesc(fromResID);

        const auto &toResName = movePair.target;
        const auto toResID = resourceGraph.vertex(toResName);
        const auto &toResDesc = resourceGraph.getDesc(toResID);

        const auto &fromResTraits = resourceGraph.getTraits(fromResID);
        const auto &toResTraits = resourceGraph.getTraits(toResID);
        auto commonUsage = fromResDesc.flags | toResDesc.flags;

        targets.emplace_back(toResName);

        if (rag.movedTargetStatus.find(toResName) == rag.movedTargetStatus.end()) {
            rag.movedTargetStatus[toResName].planes.resize(getPlaneCount(toResDesc.format));
            for (auto &plane : rag.movedTargetStatus[toResName].planes) {
                plane.slices.resize(toResDesc.depthOrArraySize);
                for (auto &slice : plane.slices) {
                    slice.mips.resize(toResDesc.mipLevels, std::numeric_limits<uint32_t>::max());
                }
            }
        }

        auto safeShift = [](uint32_t num, uint8_t bit) { return std::max(1U, num >> bit); };

        rangeCheck(rag.movedTargetStatus[toResName], toResDesc, toResName, movePair.targetFirstSlice, movePair.numSlices, movePair.targetMostDetailedMip, movePair.mipLevels, movePair.targetPlaneSlice);
        uint32_t validConditions[] = {
            !fromResTraits.hasSideEffects(),
            rag.movedSourceStatus.find(toResName) == rag.movedSourceStatus.end(),
            rag.movedSourceStatus.find(fromResName) == rag.movedSourceStatus.end(),
            fromResTraits.residency != ResourceResidency::MEMORYLESS && toResTraits.residency != ResourceResidency::MEMORYLESS,
            fromResDesc.dimension == toResDesc.dimension,
            fromResDesc.width == safeShift(toResDesc.width, movePair.targetMostDetailedMip),
            fromResDesc.height == safeShift(toResDesc.height, movePair.targetMostDetailedMip),
            fromResDesc.format == toResDesc.format,
            fromResDesc.sampleCount == toResDesc.sampleCount,
            (fromResDesc.depthOrArraySize == toResDesc.depthOrArraySize) || (toResDesc.dimension != ResourceDimension::BUFFER), // full move if resource is buffer
        };
        bool val = *std::min_element(std::begin(validConditions), std::end(validConditions));
        check &= val;
    }

    // full check
    std::for_each(targets.begin(), targets.end(), [&](const ccstd::pmr::string &target) {
        ResourceNode &resNode = rag.movedTargetStatus[target];
        resNode.full |= std::all_of(resNode.planes.begin(), resNode.planes.end(), [](const auto &textureNode) {
            return textureNode.full;
        });
    });

    return check;
}

[[nodiscard]] ccstd::pmr::string getSubresourceNameByRange(
    const gfx::ResourceRange &range,
    boost::container::pmr::memory_resource *scratch) {
    ccstd::pmr::string subresName(scratch);
    // if () {
    //     switch (range.firstSlice) {
    //         case 0:
    //             return CUBE_RIGHT_NAME.data();
    //         case 1:
    //             return CUBE_LEFT_NAME.data();
    //         case 2:
    //             return CUBE_TOP_NAME.data();
    //         case 3:
    //             return CUBE_BOTTOM_NAME.data();
    //         case 4:
    //             return CUBE_FRONT_NAME.data();
    //         case 5:
    //             return CUBE_REAR_NAME.data();
    //         default:
    //             break;
    //     }
    // } else {
    std::string suffix = std::to_string(range.basePlane) + "_" + std::to_string(range.planeCount) + "_" + std::to_string(range.firstSlice) + "_" + std::to_string(range.numSlices) + "_" + std::to_string(range.mipLevel) + "_" + std::to_string(range.levelCount);
    subresName = suffix;
    // }
    return subresName;
}

gfx::SamplerInfo makePointSamplerInfo() {
    return gfx::SamplerInfo{gfx::Filter::POINT, gfx::Filter::POINT, gfx::Filter::POINT};
}

SubresourceView makeSubresourceView(const ResourceDesc &targetDesc, const gfx::ResourceRange &range) {
    SubresourceView view{};
    view.firstArraySlice = range.firstSlice;
    view.numArraySlices = range.numSlices;
    view.indexOrFirstMipLevel = range.mipLevel;
    view.numMipLevels = range.levelCount;
    view.firstPlane = range.basePlane;
    view.numPlanes = range.planeCount;
    view.format = targetDesc.format;
    view.textureView = nullptr;
    return view;
}

void startMovePass(const Graphs &graphs, uint32_t passID, const MovePass &pass) {
    const auto &[renderGraph, layoutGraphData, resourceGraph, resourceAccessGraph, relationGraph] = graphs;

    if (moveValidation(pass, resourceAccessGraph, resourceGraph)) {
        for (const auto &pair : pass.movePairs) {
            auto toleranceRange = getResourceRange(resourceGraph.vertex(pair.target), resourceGraph);
            auto srcResourceRange = getResourceRange(resourceGraph.vertex(pair.source), resourceGraph);
            srcResourceRange.firstSlice = pair.targetFirstSlice;
            srcResourceRange.mipLevel = pair.targetMostDetailedMip;
            srcResourceRange.basePlane = pair.targetPlaneSlice;

            auto lastStatusIter = resourceAccessGraph.resourceAccess.at(pair.source).rbegin();
            resourceAccessGraph.movedSourceStatus.emplace(pair.source, AccessStatus{lastStatusIter->second.accessFlag, srcResourceRange});
            resourceAccessGraph.movedTarget[pair.target].emplace(getSubresourceNameByRange(srcResourceRange, resourceAccessGraph.resource()), pair.source);

            const auto &srcAccess = resourceAccessGraph.resourceAccess.at(pair.source);
            auto &targetAccess = resourceAccessGraph.resourceAccess[pair.target];
            targetAccess.clear();
            targetAccess.emplace(*srcAccess.rbegin());

            auto targetResID = resourceGraph.find(pair.target);
            resourceAccessGraph.resourceIndex[pair.target] = targetResID;

            auto &rag = resourceAccessGraph;
            std::function<void(const ccstd::pmr::string &, ResourceGraph::vertex_descriptor)> feedBack = [&](
                                                                                                             const ccstd::pmr::string &source,
                                                                                                             ResourceGraph::vertex_descriptor v) {
                rag.resourceIndex[source] = v;

                if (rag.movedTarget.find(source) != rag.movedTarget.end()) {
                    for (const auto &[rangeStr, prt] : rag.movedTarget[source]) {
                        feedBack(prt, v);
                    }
                }
            };
            feedBack(pair.source, targetResID);
        }
    } else {
        CopyPass copyPass(resourceAccessGraph.get_allocator());
        for (const auto &pair : pass.movePairs) {
            copyPass.copyPairs.emplace_back(
                pair.source,
                pair.target,
                pair.mipLevels, pair.numSlices,
                0, 0, 0,
                pair.targetMostDetailedMip, pair.targetFirstSlice, pair.targetPlaneSlice);
        }
        startCopyPass(graphs, passID, copyPass);
    }
}

struct DependencyVisitor : graph::DefaultDfsVisitor {
    void discoverVertex(RenderGraph::vertex_descriptor passID, const graph::ReferenceGraphView<RenderGraph> & /*view*/) const {
        graphs.renderGraph.visit_vertex(
            passID,
            [&](const RasterPass &pass) {
                startRenderPass(graphs, passID, pass);
            },
            [&](const RasterSubpass &pass) {
                startRenderSubpass(graphs, passID, pass);
            },
            [&](const ComputeSubpass &pass) {
                startComputeSubpass(graphs, passID, pass);
            },
            [&](const ComputePass &pass) {
                startComputePass(graphs, passID, pass);
            },
            [&](const CopyPass &pass) {
                startCopyPass(graphs, passID, pass);
            },
            [&](const MovePass &pass) {
                startMovePass(graphs, passID, pass);
            },
            [&](const RaytracePass &pass) {
                startRaytracePass(graphs, passID, pass);
            },
            [&](const auto & /*pass*/) {
                // do nothing
            });
    }

    void finishVertex(RenderGraph::vertex_descriptor passID, const graph::ReferenceGraphView<RenderGraph> & /*view*/) const {
        graphs.renderGraph.visit_vertex(
            passID,
            [&](const RasterPass &pass) {
                endRenderPass(graphs, passID, pass);
            },
            [&](const auto & /*pass*/) {
                // do nothing
            });
    }

    const Graphs &graphs;
};

void subresourceAnalysis(ResourceAccessGraph &rag, ResourceGraph &resg) {
    using RecursiveFuncType = std::function<void(const PmrFlatMap<ccstd::pmr::string, ccstd::pmr::string> &, const ccstd::pmr::string &)>;
    RecursiveFuncType addSubres = [&](const PmrFlatMap<ccstd::pmr::string, ccstd::pmr::string> &subreses, const ccstd::pmr::string &resName) {
        if (subreses.size() == 1) {
            const auto &src = subreses.begin()->second;
            rag.resourceIndex[src] = rag.resourceIndex.at(resName);

            if (rag.movedTarget.find(src) != rag.movedTarget.end()) {
                addSubres(rag.movedTarget.at(src), src);
            }
        } else {
            for (const auto &[rangeStr, subres] : subreses) {
                auto targetResID = rag.resourceIndex.at(resName);

                const auto &targetName = resg.getName(targetResID);
                const auto &indexName = concatResName(targetName, subres, rag.resource());
                auto subresID = resg.find(indexName);
                if (subresID == ResourceGraph::null_vertex()) {
                    const auto targetDesc = resg.getDesc(targetResID);
                    const auto targetTraits = resg.getTraits(targetResID);
                    const auto &srcResourceRange = rag.movedSourceStatus.at(subres).range;
                    const auto &subView = makeSubresourceView(targetDesc, srcResourceRange);
                    // register to resourcegraph
                    subresID = resg.add_vertex(
                        SubresourceView_{}, std::piecewise_construct, std::forward_as_tuple(subView),
                        std::forward_as_tuple(indexName),
                        std::forward_as_tuple(targetDesc),
                        std::forward_as_tuple(targetTraits),
                        std::forward_as_tuple(),
                        std::forward_as_tuple(makePointSamplerInfo()),
                        targetResID);
                }
                rag.resourceIndex[subres] = subresID;

                if (rag.movedTarget.find(subres) != rag.movedTarget.end()) {
                    addSubres(rag.movedTarget.at(subres), subres);
                }
            }
        }
    };

    for (const auto &[targetName, subreses] : rag.movedTarget) {
        if (subreses.size() > 1 && rag.movedSourceStatus.find(targetName) == rag.movedSourceStatus.end()) {
            addSubres(rag.movedTarget.at(targetName), targetName);
        }
    }
}

// A render pass and its subpasses execute together. Keep their resource producers, too.
void findCulledPasses(const RenderGraph &renderGraph, ResourceAccessGraph &rag) {
    using Vertex = ResourceAccessGraph::vertex_descriptor;
    ccstd::pmr::vector<bool> retained(rag.num_vertices(), false, rag.get_allocator());
    ccstd::pmr::vector<Vertex> pending(rag.get_allocator());
    auto retain = [&](Vertex v) {
        if (!retained[v]) {
            retained[v] = true;
            pending.emplace_back(v);
        }
    };
    retain(EXPECT_START_ID);
    retain(rag.presentPassID);
    for (const auto &[v, status] : rag.leafPasses) {
        if (status.isExternal && !status.needCulling) {
            retain(v);
        }
    }

    while (!pending.empty()) {
        const auto v = pending.back();
        pending.pop_back();
        for (const auto e : rag.in_edges(v)) {
            retain(rag.source(e));
        }
        const auto pass = rag.getPassID(v);
        if (renderGraph.holds<RasterSubpassTag>(pass) || renderGraph.holds<ComputeSubpassTag>(pass)) {
            retain(rag.vertex(renderGraph.get_parent(pass)));
        } else if (renderGraph.holds<RasterPassTag>(pass)) {
            for (const auto e : renderGraph.child_links(pass)) {
                const auto child = renderGraph.target(e);
                if (renderGraph.holds<RasterSubpassTag>(child) || renderGraph.holds<ComputeSubpassTag>(child)) {
                    retain(rag.vertex(child));
                }
            }
        }
    }
    for (const auto v : rag.vertices()) {
        if (!retained[v]) {
            rag.culledPasses.emplace(v);
        }
    }
}

// status of resource access
void buildAccessGraph(Graphs &graphs) {
    // what we need:
    //  - pass dependency
    //  - pass attachment access
    // AccessTable accessRecord;

    auto &[renderGraph, layoutGraphData, resourceGraph, resourceAccessGraph, relationGraph] = graphs;
    size_t numPasses = 0;
    numPasses += renderGraph.rasterPasses.size();
    numPasses += renderGraph.rasterSubpasses.size();
    numPasses += renderGraph.computeSubpasses.size();
    numPasses += renderGraph.computePasses.size();
    numPasses += renderGraph.copyPasses.size();
    numPasses += renderGraph.raytracePasses.size();

    resourceAccessGraph.reserve(static_cast<ResourceAccessGraph::vertex_descriptor>(numPasses));
    resourceAccessGraph.resourceNames.reserve(128);
    resourceAccessGraph.resourceIndex.reserve(128);

    resourceAccessGraph.topologicalOrder.reserve(numPasses);
    resourceAccessGraph.topologicalOrder.clear();
    resourceAccessGraph.resourceLifeRecord.reserve(resourceGraph.num_vertices());

    if (!resourceAccessGraph.resourceLifeRecord.empty()) {
        resourceAccessGraph.resourceLifeRecord.clear();
    }

    if (!resourceAccessGraph.leafPasses.empty()) {
        resourceAccessGraph.leafPasses.clear();
    }
    if (!resourceAccessGraph.culledPasses.empty()) {
        resourceAccessGraph.culledPasses.clear();
    }

    auto startID = resourceAccessGraph.add_vertex(INVALID_ID - 1);
    CC_EXPECTS(startID == EXPECT_START_ID);

    relationGraph.add_vertex(startID);

    DependencyVisitor visitor{{}, graphs};
    auto *scratch = renderGraph.get_allocator().resource();
    graph::ReferenceGraphView view{renderGraph};
    ccstd::pmr::vector<graph::GraphColor> colors(renderGraph.num_vertices(), graph::GraphColor::WHITE, scratch);
    for (const auto passID : renderGraph.sortedVertices) {
        if (colors[passID] == graph::GraphColor::WHITE &&
            !renderGraph.holds<RasterSubpassTag>(passID) && !renderGraph.holds<ComputeSubpassTag>(passID)) {
            graph::depthFirstVisit(view, passID, visitor, colors, {}, scratch);
        }
    }

    // moved resource
    subresourceAnalysis(resourceAccessGraph, resourceGraph);

    auto &rag = resourceAccessGraph;

    // no present pass found, add a fake node to gather leaf node(s).
    if (resourceAccessGraph.presentPassID == 0xFFFFFFFF) {
        auto ragEndNode = rag.add_vertex(RenderGraph::null_vertex());
        auto rlgEndNode = relationGraph.add_vertex(ragEndNode);
        // keep sync before pass reorder done.
        CC_EXPECTS(ragEndNode == rlgEndNode);
        resourceAccessGraph.presentPassID = ragEndNode;
    }

    if constexpr (ENABLE_BRANCH_CULLING) {
        findCulledPasses(renderGraph, rag);
    }
    // At this point leafPasses records external accesses. Keep only actual leaves.
    for (const auto v : rag.vertices()) {
        if (v == EXPECT_START_ID || v == rag.presentPassID) {
            continue;
        }
        const auto pass = rag.getPassID(v);
        const auto status = rag.leafPasses.find(v);
        const bool writesExternal = status != rag.leafPasses.end() && !status->second.needCulling;
        const auto consumers = rag.out_edges(v);
        bool hasConsumer = consumers.begin() != consumers.end();
        if constexpr (ENABLE_BRANCH_CULLING) {
            if (writesExternal && hasConsumer) {
                hasConsumer = std::any_of(consumers.begin(), consumers.end(), [&](const auto e) {
                    return rag.culledPasses.count(rag.target(e)) == 0;
                });
            }
        }
        if (hasConsumer || (renderGraph.holds<RasterPassTag>(pass) &&
                            renderGraph.value(RasterPassTag{}, pass).subpassGraph.num_vertices() != 0)) {
            rag.leafPasses.erase(v);
            continue;
        }
        rag.leafPasses.emplace(v, LeafStatus{false, true});
        if (writesExternal) {
            rag.add_edge(v, rag.presentPassID);
            relationGraph.add_edge(relationGraph.vertex(v), relationGraph.vertex(rag.presentPassID));
        }
    }
    rag.leafPasses.emplace(rag.presentPassID, LeafStatus{true, false});
    for (auto rit = rag.culledPasses.rbegin(); rit != rag.culledPasses.rend(); ++rit) {
        rag.getPassNode(*rit).resourceStatus.clear();
        while (rag.out_degree(*rit)) {
            rag.remove_edge(*rag.out_edges(*rit).begin());
        }
        while (rag.in_degree(*rit)) {
            rag.remove_edge(*rag.in_edges(*rit).begin());
        }
        // remove culled vertices, std::less make this set ascending order, so reverse iterate
        relationGraph.remove_vertex(relationGraph.vertex(*rit));
    }

    for (auto rlgVert : relationGraph.vertices()) {
        auto ragVert = relationGraph.getDescID(rlgVert);
        rag.topologicalOrder.emplace_back(ragVert);
    }
}

#pragma region BUILD_BARRIERS
gfx::ResourceRange getOriginRange(ResourceGraph::vertex_descriptor v, const gfx::ResourceRange &currRange, const ResourceGraph &resg) {
    gfx::ResourceRange ret = currRange;
    auto resID = resg.get_parent(v);
    if (resID == ResourceGraph::null_vertex()) {
        return ret;
    }

    while (resg.isTextureView(resID)) {
        const auto &subresView = resg.value(SubresourceView_{}, resID);
        ret.firstSlice += subresView.firstArraySlice;
        ret.mipLevel += subresView.indexOrFirstMipLevel;
        ret.basePlane += subresView.firstPlane;
        resID = resg.get_parent(resID);
    }
    return ret;
}

void buildBarriers(FrameGraphDispatcher &fgDispatcher) {
    auto *scratch = fgDispatcher.scratch;
    const auto &renderGraph = fgDispatcher.renderGraph;
    const auto &layoutGraph = fgDispatcher.layoutGraph;
    auto &resourceGraph = fgDispatcher.resourceGraph;
    auto &relationGraph = fgDispatcher.relationGraph;
    auto &rag = fgDispatcher.resourceAccessGraph;

    // record resource current in-access and out-access for every single node
    if (!fgDispatcher._accessGraphBuilt) {
        Graphs graphs{renderGraph, layoutGraph, resourceGraph, rag, relationGraph};
        buildAccessGraph(graphs);
        fgDispatcher._accessGraphBuilt = true;
    }

    auto getGFXBarrier = [&resourceGraph](const Barrier &barrier) {
        gfx::GFXObject *gfxBarrier{nullptr};
        const auto &desc = resourceGraph.getDesc(barrier.resourceID);
        if (desc.dimension == ResourceDimension::BUFFER) {
            gfx::BufferBarrierInfo info;
            info.prevAccesses = barrier.beginStatus.accessFlag;
            info.nextAccesses = barrier.endStatus.accessFlag;
            const auto &range = barrier.endStatus.range;
            info.offset = 0;
            info.size = range.depthOrArraySize;
            info.type = barrier.type;
            gfxBarrier = gfx::Device::getInstance()->getBufferBarrier(info);
        } else {
            const auto &originRange = getOriginRange(barrier.resourceID, barrier.endStatus.range, resourceGraph);
            gfx::TextureBarrierInfo info;
            info.prevAccesses = barrier.beginStatus.accessFlag;
            info.nextAccesses = barrier.endStatus.accessFlag;
            info.range = originRange;
            info.type = barrier.type;
            gfxBarrier = gfx::Device::getInstance()->getTextureBarrier(info);
        }
        return gfxBarrier;
    };

    // found pass id in this map ? barriers you should commit when run into this pass
    // : or no extra barrier needed.
    for (auto &accessPair : rag.resourceAccess) {
        const auto &resName = accessPair.first;

        auto resID = resourceGraph.find(resName);
        auto realResourceID = resID;
        const auto &desc = resourceGraph.getDesc(resID);
        bool isBuffer = desc.dimension == ResourceDimension::BUFFER;

        const auto &accessRecord = accessPair.second;
        auto iter = accessRecord.begin();
        auto nextIter = iter;
        std::advance(nextIter, 1);
        for (; nextIter != accessRecord.end(); ++iter, ++nextIter) {
            auto srcRagVertID = iter->first;
            auto dstRagVertID = nextIter->first;
            auto srcPassID = rag.getPassID(srcRagVertID);
            auto dstPassID = rag.getPassID(dstRagVertID);

            if (renderGraph.holds<RasterPassTag>(dstPassID) || renderGraph.holds<RasterSubpassTag>(dstPassID)) {
                const auto &fgRenderPassInfo = rag.getRenderPassInfo(dstRagVertID);
                if (fgRenderPassInfo.viewIndex.find(resName) != fgRenderPassInfo.viewIndex.end() ||
                    rag.movedTargetStatus.find(resName) != rag.movedTargetStatus.end()) {
                    // renderpass info instead
                    continue;
                }
            }

            // subpass layout transition
            if ((srcRagVertID != 0) && (renderGraph.holds<RasterPassTag>(srcPassID) || renderGraph.holds<RasterSubpassTag>(srcPassID))) {
                auto ragVertID = srcRagVertID;
                if (renderGraph.holds<RasterSubpassTag>(srcPassID)) {
                    auto parentID = renderGraph.get_parent(srcPassID);
                    ragVertID = rag.vertex(parentID);
                }
                // RenderPass Info
                auto &fgRenderPassInfo = rag.getRenderPassInfo(ragVertID);
                std::string_view resName = resourceGraph.getName(resID);
                auto colorIter = std::find(fgRenderPassInfo.orderedViews.begin(), fgRenderPassInfo.orderedViews.end(), resName);
                auto colorIndex = std::distance(fgRenderPassInfo.orderedViews.begin(), colorIter);
                if (colorIndex < fgRenderPassInfo.colorAccesses.size()) {
                    fgRenderPassInfo.colorAccesses[colorIndex].nextAccess = nextIter->second.accessFlag;
                } else if (colorIndex == fgRenderPassInfo.colorAccesses.size()) {
                    fgRenderPassInfo.dsAccess.nextAccess = nextIter->second.accessFlag;
                } else if (colorIndex == fgRenderPassInfo.colorAccesses.size() + 1) {
                    fgRenderPassInfo.dsResolveAccess.nextAccess = nextIter->second.accessFlag;
                }

                if (renderGraph.holds<RasterSubpassTag>(srcPassID) &&
                    accessDependent(iter->second.accessFlag, nextIter->second.accessFlag, isBuffer)) {
                    const auto &subpass = renderGraph.value(RasterSubpassTag{}, srcPassID);
                    auto &dependency = fgRenderPassInfo.rpInfo.dependencies.emplace_back();
                    dependency.srcSubpass = subpass.subpassID;
                    dependency.dstSubpass = INVALID_ID;
                    dependency.prevAccesses = iter->second.accessFlag;
                    dependency.nextAccesses = nextIter->second.accessFlag;
                }
                continue;
            }

            if (rag.movedSourceStatus.find(resName) != rag.movedSourceStatus.end()) {
                realResourceID = rag.resourceIndex.at(resName);
            }

            // undefined access
            if (srcRagVertID == 0) {
                auto &dstBarrierNode = rag.getBarrier(dstRagVertID);
                auto &firstMeetBarrier = dstBarrierNode.frontBarriers.emplace_back();
                firstMeetBarrier.resourceID = realResourceID;
                firstMeetBarrier.type = gfx::BarrierType::FULL;
                firstMeetBarrier.beginVert = dstPassID;
                firstMeetBarrier.endVert = dstPassID;
                firstMeetBarrier.beginStatus = iter->second;
                firstMeetBarrier.endStatus = nextIter->second;
                firstMeetBarrier.barrier = getGFXBarrier(firstMeetBarrier);
            } else if (accessDependent(iter->second.accessFlag, nextIter->second.accessFlag, isBuffer)) {
                auto &srcBarrierNode = rag.getBarrier(srcRagVertID);
                auto &beginBarrier = srcBarrierNode.rearBarriers.emplace_back();
                beginBarrier.resourceID = realResourceID;
                beginBarrier.beginVert = srcPassID;
                beginBarrier.endVert = dstPassID;
                beginBarrier.beginStatus = iter->second;
                beginBarrier.endStatus = nextIter->second;
                if (isPassExecAdjecent(iter->first, nextIter->first)) {
                    beginBarrier.type = gfx::BarrierType::FULL;
                } else {
                    beginBarrier.type = gfx::BarrierType::SPLIT_BEGIN;

                    auto &dstBarrierNode = rag.getBarrier(dstRagVertID);
                    auto &endBarrier = dstBarrierNode.frontBarriers.emplace_back();
                    endBarrier.resourceID = realResourceID;
                    endBarrier.type = gfx::BarrierType::SPLIT_END;
                    endBarrier.beginVert = srcPassID;
                    endBarrier.endVert = dstPassID;
                    endBarrier.beginStatus = iter->second;
                    endBarrier.endStatus = nextIter->second;
                    endBarrier.barrier = getGFXBarrier(endBarrier);
                }
                beginBarrier.barrier = getGFXBarrier(beginBarrier);
            }
        }
        const auto &traits = resourceGraph.getTraits(realResourceID);
        auto &states = resourceGraph.getStates(realResourceID);
        if (traits.hasSideEffects()) {
            states.states = iter->second.accessFlag;
            if (traits.residency == ResourceResidency::BACKBUFFER) {
                auto lastAccessPassID = rag.getPassID(iter->first);
                auto &barrierNode = rag.getBarrier(iter->first);
                auto &presentBarrier = barrierNode.rearBarriers.emplace_back();
                presentBarrier.resourceID = realResourceID;
                presentBarrier.type = gfx::BarrierType::FULL;
                presentBarrier.beginVert = lastAccessPassID;
                presentBarrier.endVert = lastAccessPassID;
                presentBarrier.beginStatus = iter->second;
                presentBarrier.endStatus = {gfx::AccessFlagBit::PRESENT, iter->second.range};
                presentBarrier.barrier = getGFXBarrier(presentBarrier);

                states.states = gfx::AccessFlagBit::NONE;
            }
        }
    }

    {
        for (auto &fgRenderpassInfo : rag.rpInfo) {
            auto &colorAttachments = fgRenderpassInfo.rpInfo.colorAttachments;
            uint32_t count{0};
            for (auto &color : colorAttachments) {
                const auto &colorAccess = fgRenderpassInfo.colorAccesses[count];
                color.barrier = getGeneralBarrier(cc::gfx::Device::getInstance(),
                                                  colorAccess.prevAccess,
                                                  colorAccess.nextAccess);
                ++count;
            }
            auto &dsAttachment = fgRenderpassInfo.rpInfo.depthStencilAttachment;
            if (dsAttachment.format != gfx::Format::UNKNOWN) {
                const auto &dsAccess = fgRenderpassInfo.dsAccess;
                dsAttachment.barrier = getGeneralBarrier(cc::gfx::Device::getInstance(),
                                                         dsAccess.prevAccess,
                                                         dsAccess.nextAccess);
            }
            auto &dsResolveAttachment = fgRenderpassInfo.rpInfo.depthStencilResolveAttachment;
            if (dsResolveAttachment.format != gfx::Format::UNKNOWN) {
                const auto &dsResolveAccess = fgRenderpassInfo.dsResolveAccess;
                dsResolveAttachment.barrier = getGeneralBarrier(cc::gfx::Device::getInstance(),
                                                                dsResolveAccess.prevAccess,
                                                                dsResolveAccess.nextAccess);
            }
        }
    }
}
#pragma endregion BUILD_BARRIERS

#pragma region PASS_REORDER

namespace {

struct PassCost {
    int64_t readBytes{0};
    int64_t writtenBytes{0};
    bool readsMemoryless{false};
    bool writesMemoryless{false};
};

PassCost passCost(const ResourceAccessGraph &access, const ResourceGraph &resources, RelationVert id) {
    PassCost cost;
    for (const auto &[name, status] : access.getPassNode(id).resourceStatus) {
        const auto resource = access.resourceIndex.at(name);
        const auto &desc = resources.getDesc(resource);
        const auto size = desc.dimension == ResourceDimension::BUFFER
                              ? desc.width
                              : gfx::formatSize(desc.format, desc.width, desc.height, desc.depthOrArraySize);
        const bool memoryless = resources.getTraits(resource).residency == ResourceResidency::MEMORYLESS;
        if (isReadOnlyAccess(status.accessFlag)) {
            cost.readBytes += size;
            cost.readsMemoryless |= memoryless;
        } else {
            cost.writtenBytes += size;
            cost.writesMemoryless |= memoryless;
        }
    }
    return cost;
}

struct Branch {
    RelationVert fork;
    RelationVert first;
    RelationVert last;
};

// Collect linear arms ending at the same join. A cross dependency inside an arm
// makes its endpoint a new fork/join, so a reduction cannot split that dependency.
struct PassVisitor : graph::DefaultDfsVisitor {
    const ccstd::pmr::vector<PassCost> &costs;
    ccstd::pmr::vector<Branch> &arms;
    ccstd::pmr::vector<RelationGraph::edge_descriptor> &constraints;

    static void backEdge(RelationGraph::edge_descriptor /*edge*/, const RelationGraph & /*graph*/) {
        throw std::logic_error("cyclic pass dependencies");
    }

    void finishVertex(RelationVert join, const RelationGraph &g) const {
        if (g.in_degree(join) < 2) {
            return;
        }
        arms.clear();
        for (const auto edge : g.in_edges(join)) {
            const auto last = g.source(edge);
            auto first = last;
            while (g.in_degree(first) == 1 && g.out_degree(first) == 1) {
                const auto fork = g.source(*g.in_edges(first).begin());
                if (g.out_degree(fork) > 1) {
                    arms.push_back({fork, first, last});
                    break;
                }
                first = fork;
            }
        }
        // Consume a memoryless input next to the fork and produce a memoryless
        // output next to the join. Otherwise prefer the arm that frees more bytes.
        const auto priority = [&](const Branch &arm) {
            const auto &head = costs[arm.first];
            const auto &tail = costs[arm.last];
            return std::make_tuple(arm.fork, !head.readsMemoryless, tail.writesMemoryless,
                                   tail.writtenBytes - head.readBytes, arm.first);
        };
        std::sort(arms.begin(), arms.end(), [&](const Branch &a, const Branch &b) {
            return priority(a) < priority(b);
        });
        for (size_t i = 1; i < arms.size(); ++i) {
            if (arms[i - 1].fork == arms[i].fork) {
                constraints.push_back({arms[i - 1].last, arms[i].first});
            }
        }
    }
};

// Query the current relation graph, including constraints accepted for earlier joins.
bool reachable(const RelationGraph &g, RelationVert from, RelationVert to,
               ccstd::pmr::vector<bool> &visited, ccstd::pmr::vector<RelationVert> &pending) {
    std::fill(visited.begin(), visited.end(), false);
    pending.clear();
    pending.emplace_back(from);
    visited[from] = true;
    while (!pending.empty()) {
        const auto v = pending.back();
        pending.pop_back();
        if (v == to) {
            return true;
        }
        for (const auto next : g.adjacent_vertices(v)) {
            if (!visited[next]) {
                pending.emplace_back(next);
                visited[next] = true;
            }
        }
    }
    return false;
}

} // namespace

void passReorder(FrameGraphDispatcher &fgDispatcher) {
    auto *scratch = fgDispatcher.scratch;
    auto &relation = fgDispatcher.relationGraph;
    auto &access = fgDispatcher.resourceAccessGraph;
    if (!fgDispatcher._accessGraphBuilt) {
        Graphs graphs{fgDispatcher.renderGraph, fgDispatcher.layoutGraph, fgDispatcher.resourceGraph, access, relation};
        buildAccessGraph(graphs);
        fgDispatcher._accessGraphBuilt = true;
    }

    const auto count = relation.num_vertices();
    ccstd::pmr::vector<PassCost> costs(scratch);
    costs.reserve(count);
    for (const auto v : relation.vertices()) {
        costs.emplace_back(passCost(access, fgDispatcher.resourceGraph, relation.getDescID(v)));
    }

    const auto memoryWeight = 1.0F - fgDispatcher._paralellExecWeight;
    if (memoryWeight > 0.0F) {
        ccstd::pmr::vector<Branch> arms(scratch);
        ccstd::pmr::vector<RelationGraph::edge_descriptor> constraints(scratch);
        PassVisitor visitor{{}, costs, arms, constraints};
        ccstd::pmr::vector<graph::GraphColor> colors(count, graph::GraphColor::WHITE, scratch);
        graph::depthFirstSearch(relation, visitor, colors, std::nullopt, scratch);

        ccstd::pmr::vector<bool> visited(count, false, scratch);
        ccstd::pmr::vector<RelationVert> pending(scratch);
        size_t added = 0;
        for (const auto [before, after] : constraints) {
            if (static_cast<double>(added) >= static_cast<double>(constraints.size()) * memoryWeight) {
                break;
            }
            if (!reachable(relation, before, after, visited, pending) &&
                !reachable(relation, after, before, visited, pending)) {
                relation.add_edge(before, after);
                access.add_edge(relation.getDescID(before), relation.getDescID(after));
                ++added;
            }
        }
    }

    // Kahn's algorithm consumes temporary indegrees. Both graphs keep their edges.
    ccstd::pmr::vector<RelationGraph::vertex_descriptor> indegrees(count, 0, scratch);
    const auto priority = [&](RelationVert v) {
        const auto id = relation.getDescID(v);
        return std::make_tuple(id == access.presentPassID, id != EXPECT_START_ID,
                               costs[v].writtenBytes - costs[v].readBytes, id);
    };
    const auto later = [&](RelationVert a, RelationVert b) { return priority(a) > priority(b); };
    std::priority_queue<RelationVert, ccstd::pmr::vector<RelationVert>, decltype(later)> ready(later, ccstd::pmr::vector<RelationVert>{scratch});
    for (const auto v : relation.vertices()) {
        indegrees[v] = relation.in_degree(v);
        if (!indegrees[v]) {
            ready.push(v);
        }
    }
    access.topologicalOrder.clear();
    while (!ready.empty()) {
        const auto v = ready.top();
        ready.pop();
        access.topologicalOrder.emplace_back(relation.getDescID(v));
        for (const auto next : relation.adjacent_vertices(v)) {
            if (--indegrees[next] == 0) {
                ready.push(next);
            }
        }
    }
    if (access.topologicalOrder.size() != count) {
        throw std::logic_error("cyclic pass dependencies");
    }
}

#pragma endregion PASS_REORDER

void memoryAliasing(FrameGraphDispatcher &fgDispatcher) {
}

#pragma region assisstantFuncDefinition
bool isTransitionStatusDependent(const AccessStatus &lhs, const AccessStatus &rhs) {
    return !(isReadOnlyAccess(lhs.accessFlag) && isReadOnlyAccess(rhs.accessFlag));
}

#pragma endregion assisstantFuncDefinition

} // namespace render

} // namespace cc
