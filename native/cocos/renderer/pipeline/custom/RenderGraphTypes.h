/*
 Copyright (c) 2021-2024 Xiamen Yaji Software Co., Ltd.

 https://www.cocos.com

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
*/

/**
 * ========================= !DO NOT CHANGE THE FOLLOWING SECTION MANUALLY! =========================
 * The following section is auto-generated.
 * ========================= !DO NOT CHANGE THE FOLLOWING SECTION MANUALLY! =========================
 */
#pragma once // NOLINT(portability-avoid-pragma-once)
#include <algorithm>
#include <cstdint>
#include <functional>
#include <limits>
#include <memory>
#include <stdexcept>
#include <string_view>
#include <tuple>
#include <type_traits>
#include <utility>
#include <variant>
#include "RenderGraphFwd.h"
#include "boost/container/pmr/memory_resource.hpp"
#include "cocos/base/GraphDescriptor.h"
#include "cocos/base/GraphEdges.h"
#include "cocos/base/GraphIterator.h"
#include "cocos/base/Ptr.h"
#include "cocos/base/TemplateUtils.h"
#include "cocos/base/std/container/map.h"
#include "cocos/base/std/container/string.h"
#include "cocos/base/std/container/unordered_map.h"
#include "cocos/base/std/container/vector.h"
#include "cocos/core/assets/Material.h"
#include "cocos/renderer/gfx-base/GFXBuffer.h"
#include "cocos/renderer/gfx-base/GFXDef-common.h"
#include "cocos/renderer/gfx-base/GFXDef.h"
#include "cocos/renderer/gfx-base/GFXDevice.h"
#include "cocos/renderer/gfx-base/GFXFramebuffer.h"
#include "cocos/renderer/gfx-base/GFXRenderPass.h"
#include "cocos/renderer/gfx-base/GFXSwapchain.h"
#include "cocos/renderer/gfx-base/GFXTexture.h"
#include "cocos/renderer/gfx-base/states/GFXSampler.h"
#include "cocos/renderer/pipeline/custom/RenderCommonTypes.h"
#include "cocos/renderer/pipeline/custom/details/Map.h"
#include "cocos/scene/Camera.h"
#include "cocos/scene/Light.h"
#include "cocos/scene/Model.h"
#include "cocos/scene/ReflectionProbe.h"
#include "cocos/scene/RenderScene.h"
#include "cocos/scene/RenderWindow.h"

namespace cc {

namespace render {

struct ClearValue {
    ClearValue(double xIn = 0, double yIn = 0, double zIn = 0, double wIn = 0) noexcept // NOLINT(google-explicit-constructor)
    : x(xIn),
      y(yIn),
      z(zIn),
      w(wIn) {}

    double x{0};
    double y{0};
    double z{0};
    double w{0};
};

inline bool operator==(const ClearValue& lhs, const ClearValue& rhs) noexcept {
    return std::forward_as_tuple(lhs.x, lhs.y, lhs.z, lhs.w) ==
           std::forward_as_tuple(rhs.x, rhs.y, rhs.z, rhs.w);
}

inline bool operator!=(const ClearValue& lhs, const ClearValue& rhs) noexcept {
    return !(lhs == rhs);
}

struct RasterView {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {slotName.get_allocator().resource()};
    }

    RasterView(const allocator_type& alloc); // NOLINT
    RasterView(const std::allocator_arg_t& /*tag*/, const allocator_type& alloc, ccstd::pmr::string slotNameIn = ccstd::pmr::string{}, AccessType accessTypeIn = AccessType::WRITE, AttachmentType attachmentTypeIn = AttachmentType::RENDER_TARGET, gfx::LoadOp loadOpIn = gfx::LoadOp::LOAD, gfx::StoreOp storeOpIn = gfx::StoreOp::STORE, gfx::ClearFlagBit clearFlagsIn = gfx::ClearFlagBit::ALL, const gfx::Color& clearColorIn = gfx::Color{}, gfx::ShaderStageFlagBit shaderStageFlagsIn = gfx::ShaderStageFlagBit::NONE);
    RasterView(ccstd::pmr::string slotNameIn, ccstd::pmr::string slotName1In, AccessType accessTypeIn, AttachmentType attachmentTypeIn, gfx::LoadOp loadOpIn, gfx::StoreOp storeOpIn, gfx::ClearFlagBit clearFlagsIn, const gfx::Color& clearColorIn, gfx::ShaderStageFlagBit shaderStageFlagsIn, const allocator_type& alloc);
    RasterView(RasterView&& rhs, const allocator_type& alloc);
    RasterView(RasterView const& rhs, const allocator_type& alloc);

    RasterView(RasterView&& rhs) noexcept = default;
    RasterView(RasterView const& rhs) = delete;
    RasterView& operator=(RasterView&& rhs) noexcept = default;
    RasterView& operator=(RasterView const& rhs) = default;

    ccstd::pmr::string slotName;
    ccstd::pmr::string slotName1;
    AccessType accessType{AccessType::WRITE};
    AttachmentType attachmentType{AttachmentType::RENDER_TARGET};
    gfx::LoadOp loadOp{gfx::LoadOp::LOAD};
    gfx::StoreOp storeOp{gfx::StoreOp::STORE};
    gfx::ClearFlagBit clearFlags{gfx::ClearFlagBit::ALL};
    gfx::Color clearColor;
    uint32_t slotID{0};
    gfx::ShaderStageFlagBit shaderStageFlags{gfx::ShaderStageFlagBit::NONE};
};

inline bool operator==(const RasterView& lhs, const RasterView& rhs) noexcept {
    return std::forward_as_tuple(lhs.slotName, lhs.slotName1, lhs.accessType, lhs.attachmentType, lhs.loadOp, lhs.storeOp, lhs.clearFlags, lhs.clearColor, lhs.shaderStageFlags) ==
           std::forward_as_tuple(rhs.slotName, rhs.slotName1, rhs.accessType, rhs.attachmentType, rhs.loadOp, rhs.storeOp, rhs.clearFlags, rhs.clearColor, rhs.shaderStageFlags);
}

inline bool operator!=(const RasterView& lhs, const RasterView& rhs) noexcept {
    return !(lhs == rhs);
}

struct ComputeView {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {name.get_allocator().resource()};
    }

    ComputeView(const allocator_type& alloc); // NOLINT
    ComputeView(const std::allocator_arg_t& /*tag*/, const allocator_type& alloc, ccstd::pmr::string nameIn = ccstd::pmr::string{}, AccessType accessTypeIn = AccessType::READ, gfx::ClearFlagBit clearFlagsIn = gfx::ClearFlagBit::NONE, ClearValueType clearValueTypeIn = ClearValueType::NONE, ClearValue clearValueIn = {}, gfx::ShaderStageFlagBit shaderStageFlagsIn = gfx::ShaderStageFlagBit::NONE);
    ComputeView(ccstd::pmr::string nameIn, AccessType accessTypeIn, uint32_t planeIn, gfx::ClearFlagBit clearFlagsIn, ClearValueType clearValueTypeIn, ClearValue clearValueIn, gfx::ShaderStageFlagBit shaderStageFlagsIn, const allocator_type& alloc);
    ComputeView(ComputeView&& rhs, const allocator_type& alloc);
    ComputeView(ComputeView const& rhs, const allocator_type& alloc);

    ComputeView(ComputeView&& rhs) noexcept = default;
    ComputeView(ComputeView const& rhs) = delete;
    ComputeView& operator=(ComputeView&& rhs) noexcept = default;
    ComputeView& operator=(ComputeView const& rhs) = default;

    bool isRead() const {
        return accessType != AccessType::WRITE;
    }
    bool isWrite() const {
        return accessType != AccessType::READ;
    }

    ccstd::pmr::string name;
    AccessType accessType{AccessType::READ};
    uint32_t plane{0};
    gfx::ClearFlagBit clearFlags{gfx::ClearFlagBit::NONE};
    ClearValueType clearValueType{ClearValueType::NONE};
    ClearValue clearValue;
    gfx::ShaderStageFlagBit shaderStageFlags{gfx::ShaderStageFlagBit::NONE};
};

inline bool operator==(const ComputeView& lhs, const ComputeView& rhs) noexcept {
    return std::forward_as_tuple(lhs.name, lhs.accessType, lhs.plane, lhs.clearFlags, lhs.clearValueType, lhs.shaderStageFlags) ==
           std::forward_as_tuple(rhs.name, rhs.accessType, rhs.plane, rhs.clearFlags, rhs.clearValueType, rhs.shaderStageFlags);
}

inline bool operator!=(const ComputeView& lhs, const ComputeView& rhs) noexcept {
    return !(lhs == rhs);
}

struct ResourceDesc {
    ResourceDimension dimension{ResourceDimension::BUFFER};
    uint32_t alignment{0};
    uint32_t width{0};
    uint32_t height{0};
    uint16_t depthOrArraySize{0};
    uint16_t mipLevels{0};
    gfx::Format format{gfx::Format::UNKNOWN};
    gfx::SampleCount sampleCount{gfx::SampleCount::X1};
    gfx::TextureFlagBit textureFlags{gfx::TextureFlagBit::NONE};
    ResourceFlags flags{ResourceFlags::NONE};
    gfx::TextureType viewType{gfx::TextureType::TEX2D};
};

struct ResourceTraits {
    ResourceTraits(ResourceResidency residencyIn = ResourceResidency::MANAGED) noexcept // NOLINT(google-explicit-constructor)
    : residency(residencyIn) {}

    bool hasSideEffects() const noexcept {
        return residency == ResourceResidency::PERSISTENT ||
               residency == ResourceResidency::EXTERNAL ||
               residency == ResourceResidency::BACKBUFFER;
    }

    ResourceResidency residency{ResourceResidency::MANAGED};
};

struct RenderSwapchain {
    RenderSwapchain(gfx::Swapchain* swapchainIn = nullptr, bool isDepthStencilIn = false) noexcept // NOLINT(google-explicit-constructor)
    : swapchain(swapchainIn),
      isDepthStencil(isDepthStencilIn) {}

    static gfx::Texture *getColorTexture(gfx::Swapchain *swapchain) noexcept;
    static gfx::Texture *getColorTexture(scene::RenderWindow *renderWindow) noexcept;
    static gfx::Texture *getDepthStencilTexture(gfx::Swapchain *swapchain) noexcept;

    gfx::Swapchain *swapchain{nullptr};
    scene::RenderWindow *renderWindow{nullptr};
    uint32_t currentID{0};
    uint32_t numBackBuffers{0};
    uint32_t generation{0xFFFFFFFF};
    bool isDepthStencil{false};
    gfx::Texture *texture{nullptr};
};

struct ResourceStates {
    gfx::AccessFlagBit states{gfx::AccessFlagBit::NONE};
};

struct ManagedBuffer {
    ManagedBuffer(IntrusivePtr<gfx::Buffer> bufferIn = IntrusivePtr<gfx::Buffer>{}) noexcept // NOLINT(google-explicit-constructor)
    : buffer(std::move(bufferIn)) {}

    IntrusivePtr<gfx::Buffer> buffer;
    uint64_t fenceValue{0ULL};
};

struct PersistentBuffer {
    PersistentBuffer(IntrusivePtr<gfx::Buffer> bufferIn = IntrusivePtr<gfx::Buffer>{}) noexcept // NOLINT(google-explicit-constructor)
    : buffer(std::move(bufferIn)) {}

    IntrusivePtr<gfx::Buffer> buffer;
    uint64_t fenceValue{0ULL};
};

struct ManagedTexture {
    ManagedTexture(IntrusivePtr<gfx::Texture> textureIn = IntrusivePtr<gfx::Texture>{}) noexcept // NOLINT(google-explicit-constructor)
    : texture(std::move(textureIn)) {}

    bool checkResource(const ResourceDesc &desc) const;

    IntrusivePtr<gfx::Texture> texture;
    uint64_t fenceValue{0ULL};
};

struct PersistentTexture {
    PersistentTexture(IntrusivePtr<gfx::Texture> textureIn = IntrusivePtr<gfx::Texture>{}) noexcept // NOLINT(google-explicit-constructor)
    : texture(std::move(textureIn)) {}

    bool checkResource(const ResourceDesc &desc) const;

    IntrusivePtr<gfx::Texture> texture;
    uint64_t fenceValue{0ULL};
};

struct ManagedResource {
    uint32_t unused{0};
};

struct Subpass {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {rasterViews.get_allocator().resource()};
    }

    Subpass(const allocator_type& alloc); // NOLINT
    Subpass(Subpass&& rhs, const allocator_type& alloc);
    Subpass(Subpass const& rhs, const allocator_type& alloc);

    Subpass(Subpass&& rhs) noexcept = default;
    Subpass(Subpass const& rhs) = delete;
    Subpass& operator=(Subpass&& rhs) noexcept = default;
    Subpass& operator=(Subpass const& rhs) = default;

    PmrTransparentMap<ccstd::pmr::string, RasterView> rasterViews;
    PmrTransparentMap<ccstd::pmr::string, ccstd::pmr::vector<ComputeView>> computeViews;
    ccstd::pmr::vector<ResolvePair> resolvePairs;
};

inline bool operator==(const Subpass& lhs, const Subpass& rhs) noexcept {
    return std::forward_as_tuple(lhs.rasterViews, lhs.computeViews, lhs.resolvePairs) ==
           std::forward_as_tuple(rhs.rasterViews, rhs.computeViews, rhs.resolvePairs);
}

inline bool operator!=(const Subpass& lhs, const Subpass& rhs) noexcept {
    return !(lhs == rhs);
}

struct Subpass_ {};

struct SubpassGraph {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { return {this->outEdges.get_allocator().resource()}; } // NOLINT(readability-identifier-naming)

    explicit SubpassGraph(const allocator_type& alloc) : outEdges(alloc), inEdges(alloc), names(alloc), subpasses(alloc) {}
    SubpassGraph(const SubpassGraph& rhs, const allocator_type& alloc);
    SubpassGraph(SubpassGraph&& rhs, const allocator_type& alloc);
    SubpassGraph(SubpassGraph&&) noexcept = default;
    SubpassGraph(const SubpassGraph&) = delete;
    SubpassGraph& operator=(SubpassGraph&&) noexcept = default;
    SubpassGraph& operator=(const SubpassGraph&) = default;

    // Graph types
    using vertex_descriptor = uint32_t;
    using edge_descriptor = graph::EdgeDescriptor<vertex_descriptor>;

    // IncidenceGraph types
    using out_edge_iterator = graph::IncidentEdgeIterator<ccstd::pmr::vector<vertex_descriptor>, false>;

    // BidirectionalGraph types
    using in_edge_iterator = graph::IncidentEdgeIterator<ccstd::pmr::vector<vertex_descriptor>, true>;

    // AdjacencyGraph types
    using adjacency_iterator = ccstd::pmr::vector<vertex_descriptor>::const_iterator;

    // VertexListGraph types
    using vertex_iterator = graph::VertexIterator<vertex_descriptor>;

    // Graph
    static constexpr vertex_descriptor null_vertex() noexcept { return (std::numeric_limits<vertex_descriptor>::max)(); } // NOLINT(readability-identifier-naming)

    // IncidenceGraph
    vertex_descriptor source(edge_descriptor e) const noexcept { return e.source; }         // NOLINT(readability-convert-member-functions-to-static)
    vertex_descriptor target(edge_descriptor e) const noexcept { return e.target; }         // NOLINT(readability-convert-member-functions-to-static)
    graph::IteratorRange<out_edge_iterator> out_edges(vertex_descriptor v) const noexcept { // NOLINT(readability-identifier-naming)
        const auto& neighbors = this->outEdges[v];
        return {{v, neighbors.begin()}, {v, neighbors.end()}};
    }
    std::size_t out_degree(vertex_descriptor v) const noexcept { return outEdges[v].size(); } // NOLINT(readability-identifier-naming)
    std::pair<edge_descriptor, bool> edge(vertex_descriptor u, vertex_descriptor v) const noexcept {
        if (u < outEdges.size()) {
            const auto& row = outEdges[u];
            if (std::find(row.begin(), row.end(), v) != row.end()) return {{u, v}, true};
        }
        return {{null_vertex(), null_vertex()}, false};
    }

    // BidirectionalGraph
    graph::IteratorRange<in_edge_iterator> in_edges(vertex_descriptor v) const noexcept { // NOLINT(readability-identifier-naming)
        const auto& neighbors = this->inEdges[v];
        return {{v, neighbors.begin()}, {v, neighbors.end()}};
    }
    std::size_t in_degree(vertex_descriptor v) const noexcept { return inEdges[v].size(); } // NOLINT(readability-identifier-naming)
    std::size_t degree(vertex_descriptor v) const noexcept { return in_degree(v) + out_degree(v); }

    // AdjacencyGraph
    const auto& adjacent_vertices(vertex_descriptor v) const noexcept { return outEdges[v]; } // NOLINT(readability-identifier-naming)

    // VertexListGraph
    graph::VertexRange<vertex_descriptor> vertices() const noexcept { return {vertex_iterator(num_vertices())}; }
    vertex_descriptor num_vertices() const noexcept { return static_cast<vertex_descriptor>(this->names.size()); } // NOLINT(readability-identifier-naming)

    // MutableGraph
    vertex_descriptor add_vertex(std::string_view value = {}); // NOLINT(readability-identifier-naming)

    template <class Args0, class Args1,
              class = std::void_t<typename std::tuple_size<std::decay_t<Args0>>::type,
                                  typename std::tuple_size<std::decay_t<Args1>>::type>>
    vertex_descriptor add_vertex(std::piecewise_construct_t /*piecewise*/, Args0&& argsName, Args1&& argsSubpass); // NOLINT(readability-identifier-naming)
    std::pair<edge_descriptor, bool> add_edge(vertex_descriptor u, vertex_descriptor v);                           // NOLINT(readability-identifier-naming)
    void remove_edge(edge_descriptor e) noexcept;                                                                  // NOLINT(readability-identifier-naming)
    void remove_edge(vertex_descriptor u, vertex_descriptor v) noexcept;                                           // NOLINT(readability-identifier-naming)

    // ComponentGraph
    ccstd::pmr::string& getName(vertex_descriptor v) noexcept { return this->names[v]; }
    ccstd::pmr::string& get(const Name_& /*tag*/, vertex_descriptor v) noexcept { return getName(v); }

    ccstd::pmr::string const& getName(vertex_descriptor v) const noexcept { return this->names[v]; }
    ccstd::pmr::string const& get(const Name_& /*tag*/, vertex_descriptor v) const noexcept { return getName(v); }

    Subpass& getSubpass(vertex_descriptor v) noexcept { return this->subpasses[v]; }
    Subpass& get(const Subpass_& /*tag*/, vertex_descriptor v) noexcept { return getSubpass(v); }

    Subpass const& getSubpass(vertex_descriptor v) const noexcept { return this->subpasses[v]; }
    Subpass const& get(const Subpass_& /*tag*/, vertex_descriptor v) const noexcept { return getSubpass(v); }

    friend bool operator==(const SubpassGraph&, const SubpassGraph&) noexcept;
    friend struct ccstd::hash<SubpassGraph>;
    ccstd::pmr::vector<ccstd::pmr::vector<vertex_descriptor>> outEdges;
    ccstd::pmr::vector<ccstd::pmr::vector<vertex_descriptor>> inEdges;
    ccstd::pmr::vector<ccstd::pmr::string> names;
    ccstd::pmr::vector<Subpass> subpasses;
};

inline bool operator==(const SubpassGraph& lhs, const SubpassGraph& rhs) noexcept {
    return std::forward_as_tuple(lhs.names, lhs.subpasses) ==
           std::forward_as_tuple(rhs.names, rhs.subpasses);
}

inline bool operator!=(const SubpassGraph& lhs, const SubpassGraph& rhs) noexcept {
    return !(lhs == rhs);
}

struct RasterSubpass {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {rasterViews.get_allocator().resource()};
    }

    RasterSubpass(const allocator_type& alloc); // NOLINT
    RasterSubpass(const std::allocator_arg_t& /*tag*/, const allocator_type& alloc, uint32_t subpassIDIn = 0xFFFFFFFF, uint32_t countIn = 1, uint32_t qualityIn = 0);
    RasterSubpass(RasterSubpass&& rhs, const allocator_type& alloc);
    RasterSubpass(RasterSubpass const& rhs, const allocator_type& alloc);

    RasterSubpass(RasterSubpass&& rhs) noexcept = default;
    RasterSubpass(RasterSubpass const& rhs) = delete;
    RasterSubpass& operator=(RasterSubpass&& rhs) noexcept = default;
    RasterSubpass& operator=(RasterSubpass const& rhs) = default;

    PmrTransparentMap<ccstd::pmr::string, RasterView> rasterViews;
    PmrTransparentMap<ccstd::pmr::string, ccstd::pmr::vector<ComputeView>> computeViews;
    ccstd::pmr::vector<ResolvePair> resolvePairs;
    gfx::Viewport viewport;
    uint32_t subpassID{0xFFFFFFFF};
    uint32_t count{1};
    uint32_t quality{0};
    bool showStatistics{false};
};

struct ComputeSubpass {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {rasterViews.get_allocator().resource()};
    }

    ComputeSubpass(const allocator_type& alloc); // NOLINT
    ComputeSubpass(const std::allocator_arg_t& /*tag*/, const allocator_type& alloc, uint32_t subpassIDIn = 0xFFFFFFFF);
    ComputeSubpass(ComputeSubpass&& rhs, const allocator_type& alloc);
    ComputeSubpass(ComputeSubpass const& rhs, const allocator_type& alloc);

    ComputeSubpass(ComputeSubpass&& rhs) noexcept = default;
    ComputeSubpass(ComputeSubpass const& rhs) = delete;
    ComputeSubpass& operator=(ComputeSubpass&& rhs) noexcept = default;
    ComputeSubpass& operator=(ComputeSubpass const& rhs) = default;

    PmrTransparentMap<ccstd::pmr::string, RasterView> rasterViews;
    PmrTransparentMap<ccstd::pmr::string, ccstd::pmr::vector<ComputeView>> computeViews;
    uint32_t subpassID{0xFFFFFFFF};
};

struct RasterPass {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {rasterViews.get_allocator().resource()};
    }

    RasterPass(const allocator_type& alloc); // NOLINT
    RasterPass(RasterPass&& rhs, const allocator_type& alloc);
    RasterPass(RasterPass const& rhs, const allocator_type& alloc);

    RasterPass(RasterPass&& rhs) noexcept = default;
    RasterPass(RasterPass const& rhs) = delete;
    RasterPass& operator=(RasterPass&& rhs) noexcept = default;
    RasterPass& operator=(RasterPass const& rhs) = default;

    PmrTransparentMap<ccstd::pmr::string, RasterView> rasterViews;
    PmrTransparentMap<ccstd::pmr::string, ccstd::pmr::vector<ComputeView>> computeViews;
    PmrTransparentMap<ccstd::pmr::string, uint32_t> attachmentIndexMap;
    PmrTransparentMap<ccstd::pmr::string, gfx::ShaderStageFlagBit> textures;
    SubpassGraph subpassGraph;
    uint32_t width{0};
    uint32_t height{0};
    uint32_t count{1};
    uint32_t quality{0};
    gfx::Viewport viewport;
    ccstd::pmr::string versionName;
    uint64_t version{0ULL};
    uint64_t hashValue{0ULL};
    bool showStatistics{false};
};

inline bool operator==(const RasterPass& lhs, const RasterPass& rhs) noexcept {
    return std::forward_as_tuple(lhs.rasterViews, lhs.computeViews, lhs.textures, lhs.subpassGraph, lhs.width, lhs.height, lhs.count, lhs.quality) ==
           std::forward_as_tuple(rhs.rasterViews, rhs.computeViews, rhs.textures, rhs.subpassGraph, rhs.width, rhs.height, rhs.count, rhs.quality);
}

inline bool operator!=(const RasterPass& lhs, const RasterPass& rhs) noexcept {
    return !(lhs == rhs);
}

struct PersistentRenderPassAndFramebuffer {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {clearColors.get_allocator().resource()};
    }

    PersistentRenderPassAndFramebuffer(const allocator_type& alloc); // NOLINT
    PersistentRenderPassAndFramebuffer(const std::allocator_arg_t& /*tag*/, const allocator_type& alloc, IntrusivePtr<gfx::RenderPass> renderPassIn = IntrusivePtr<gfx::RenderPass>{}, IntrusivePtr<gfx::Framebuffer> framebufferIn = IntrusivePtr<gfx::Framebuffer>{});
    PersistentRenderPassAndFramebuffer(PersistentRenderPassAndFramebuffer&& rhs, const allocator_type& alloc);
    PersistentRenderPassAndFramebuffer(PersistentRenderPassAndFramebuffer const& rhs, const allocator_type& alloc);

    PersistentRenderPassAndFramebuffer(PersistentRenderPassAndFramebuffer&& rhs) noexcept = default;
    PersistentRenderPassAndFramebuffer(PersistentRenderPassAndFramebuffer const& rhs) = delete;
    PersistentRenderPassAndFramebuffer& operator=(PersistentRenderPassAndFramebuffer&& rhs) noexcept = default;
    PersistentRenderPassAndFramebuffer& operator=(PersistentRenderPassAndFramebuffer const& rhs) = default;

    IntrusivePtr<gfx::RenderPass> renderPass;
    IntrusivePtr<gfx::Framebuffer> framebuffer;
    ccstd::pmr::vector<gfx::Color> clearColors;
    float clearDepth{0};
    uint8_t clearStencil{0};
};

struct Managed_ {};
struct ManagedBuffer_ {};
struct ManagedTexture_ {};
struct PersistentBuffer_ {};
struct PersistentTexture_ {};
struct Framebuffer_ {};
struct Swapchain_ {};
struct Sampler_ {};
struct FormatView_ {};
struct SubresourceView_ {};

struct FormatView {
    gfx::Format format{gfx::Format::UNKNOWN};
};

struct SubresourceView {
    IntrusivePtr<gfx::Texture> textureView;
    gfx::Format format{gfx::Format::UNKNOWN};
    uint16_t indexOrFirstMipLevel{0};
    uint16_t numMipLevels{0};
    uint16_t firstArraySlice{0};
    uint16_t numArraySlices{0};
    uint16_t firstPlane{0};
    uint16_t numPlanes{0};
};

struct Desc_ {};
struct Traits_ {};
struct States_ {};

struct ResourceGraph {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { return {this->handles.get_allocator().resource()}; } // NOLINT(readability-identifier-naming)

    explicit ResourceGraph(const allocator_type& alloc) : handles(alloc), links(alloc), names(alloc), descs(alloc), traits(alloc), states(alloc), samplerInfo(alloc), resources(alloc), managedBuffers(alloc), managedTextures(alloc), buffers(alloc), textures(alloc), framebuffers(alloc), swapchains(alloc), formatViews(alloc), subresourceViews(alloc), nameIndex_(alloc), renderPasses(alloc) {}
    ResourceGraph(ResourceGraph&&) = delete;
    ResourceGraph(const ResourceGraph&) = delete;
    ResourceGraph& operator=(ResourceGraph&&) = delete;
    ResourceGraph& operator=(const ResourceGraph&) = delete;

    // Graph types
    using vertex_descriptor = uint32_t;
    using edge_descriptor = graph::EdgeDescriptor<vertex_descriptor>;

    // IncidenceGraph types
    using TreeEdge = graph::TreeEdge<vertex_descriptor>;
    using out_edge_iterator = graph::ChildIterator<edge_descriptor, false>;

    // BidirectionalGraph types
    using in_edge_iterator = graph::ParentLinkIterator<edge_descriptor>;

    // AdjacencyGraph types
    using adjacency_iterator = graph::ChildIterator<edge_descriptor, true>;

    // VertexListGraph types
    using vertex_iterator = graph::VertexIterator<vertex_descriptor>;

    // PolymorphicGraph types
    enum class Kind : uint8_t {
        Managed,           // NOLINT(readability-identifier-naming)
        ManagedBuffer,     // NOLINT(readability-identifier-naming)
        ManagedTexture,    // NOLINT(readability-identifier-naming)
        PersistentBuffer,  // NOLINT(readability-identifier-naming)
        PersistentTexture, // NOLINT(readability-identifier-naming)
        Framebuffer,       // NOLINT(readability-identifier-naming)
        Swapchain,         // NOLINT(readability-identifier-naming)
        FormatView,        // NOLINT(readability-identifier-naming)
        SubresourceView    // NOLINT(readability-identifier-naming)
    };

    // ReferenceGraph types
    using ownership_descriptor = edge_descriptor;
    using children_iterator = out_edge_iterator;
    using parent_iterator = in_edge_iterator;

    // Graph
    static constexpr vertex_descriptor null_vertex() noexcept { return (std::numeric_limits<vertex_descriptor>::max)(); } // NOLINT(readability-identifier-naming)

    // IncidenceGraph
    vertex_descriptor source(edge_descriptor e) const noexcept { return e.source; }                                  // NOLINT(readability-convert-member-functions-to-static)
    vertex_descriptor target(edge_descriptor e) const noexcept { return e.target; }                                  // NOLINT(readability-convert-member-functions-to-static)
    graph::IteratorRange<out_edge_iterator> out_edges(vertex_descriptor v) const noexcept { return child_links(v); } // NOLINT(readability-identifier-naming)
    vertex_descriptor out_degree(vertex_descriptor v) const noexcept { return num_children(v); }                     // NOLINT(readability-identifier-naming)
    std::pair<edge_descriptor, bool> edge(vertex_descriptor u, vertex_descriptor v) const noexcept {
        if (u != null_vertex() && static_cast<std::uintmax_t>(v) < this->links.size() && get_parent(v) == u) return {{u, v}, true};
        return {{null_vertex(), null_vertex()}, false};
    }

    // BidirectionalGraph
    graph::IteratorRange<in_edge_iterator> in_edges(vertex_descriptor v) const noexcept { return parent_links(v); } // NOLINT(readability-identifier-naming)
    vertex_descriptor in_degree(vertex_descriptor v) const noexcept { return num_parents(v); }                      // NOLINT(readability-identifier-naming)
    vertex_descriptor degree(vertex_descriptor v) const noexcept { return in_degree(v) + out_degree(v); }

    // AdjacencyGraph
    graph::IteratorRange<adjacency_iterator> adjacent_vertices(vertex_descriptor v) const noexcept { // NOLINT(readability-identifier-naming)
        const auto* rows = links.data();
        return {{rows, rows[v].firstChild}, {rows, null_vertex()}};
    }

    // VertexListGraph
    graph::VertexRange<vertex_descriptor> vertices() const noexcept { return {vertex_iterator(num_vertices())}; }
    vertex_descriptor num_vertices() const noexcept { return static_cast<vertex_descriptor>(this->names.size()); } // NOLINT(readability-identifier-naming)

    // MutableGraph
    vertex_descriptor add_vertex(const Managed_& tag, std::string_view value = {}, vertex_descriptor parent = null_vertex());           // NOLINT(readability-identifier-naming)
    vertex_descriptor add_vertex(const ManagedBuffer_& tag, std::string_view value = {}, vertex_descriptor parent = null_vertex());     // NOLINT(readability-identifier-naming)
    vertex_descriptor add_vertex(const ManagedTexture_& tag, std::string_view value = {}, vertex_descriptor parent = null_vertex());    // NOLINT(readability-identifier-naming)
    vertex_descriptor add_vertex(const PersistentBuffer_& tag, std::string_view value = {}, vertex_descriptor parent = null_vertex());  // NOLINT(readability-identifier-naming)
    vertex_descriptor add_vertex(const PersistentTexture_& tag, std::string_view value = {}, vertex_descriptor parent = null_vertex()); // NOLINT(readability-identifier-naming)
    vertex_descriptor add_vertex(const Framebuffer_& tag, std::string_view value = {}, vertex_descriptor parent = null_vertex());       // NOLINT(readability-identifier-naming)
    vertex_descriptor add_vertex(const Swapchain_& tag, std::string_view value = {}, vertex_descriptor parent = null_vertex());         // NOLINT(readability-identifier-naming)
    vertex_descriptor add_vertex(const FormatView_& tag, std::string_view value = {}, vertex_descriptor parent = null_vertex());        // NOLINT(readability-identifier-naming)
    vertex_descriptor add_vertex(const SubresourceView_& tag, std::string_view value = {}, vertex_descriptor parent = null_vertex());   // NOLINT(readability-identifier-naming)

    template <class Tag, class PayloadArgs, class Args0, class Args1, class Args2, class Args3, class Args4,
              std::enable_if_t<std::is_same_v<Tag, Managed_> ||
                                   std::is_same_v<Tag, ManagedBuffer_> ||
                                   std::is_same_v<Tag, ManagedTexture_> ||
                                   std::is_same_v<Tag, PersistentBuffer_> ||
                                   std::is_same_v<Tag, PersistentTexture_> ||
                                   std::is_same_v<Tag, Framebuffer_> ||
                                   std::is_same_v<Tag, Swapchain_> ||
                                   std::is_same_v<Tag, FormatView_> ||
                                   std::is_same_v<Tag, SubresourceView_>,
                               int> = 0,
              class = std::void_t<typename std::tuple_size<std::decay_t<PayloadArgs>>::type,
                                  typename std::tuple_size<std::decay_t<Args0>>::type,
                                  typename std::tuple_size<std::decay_t<Args1>>::type,
                                  typename std::tuple_size<std::decay_t<Args2>>::type,
                                  typename std::tuple_size<std::decay_t<Args3>>::type,
                                  typename std::tuple_size<std::decay_t<Args4>>::type>>
    vertex_descriptor add_vertex(const Tag& /*tag*/, std::piecewise_construct_t /*piecewise*/, PayloadArgs&& payloadArgs, Args0&& argsName, Args1&& argsDesc, Args2&& argsTraits, Args3&& argsStates, Args4&& argsSampler, vertex_descriptor parent = null_vertex()); // NOLINT(readability-identifier-naming)
    std::pair<edge_descriptor, bool> add_edge(vertex_descriptor u, vertex_descriptor v) noexcept;                                                                                                                                                                     // NOLINT(readability-identifier-naming)
    void remove_edge(edge_descriptor e) noexcept;                                                                                                                                                                                                                     // NOLINT(readability-identifier-naming)

    // ComponentGraph
    ccstd::pmr::string const& getName(vertex_descriptor v) const noexcept { return this->names[v]; }
    ccstd::pmr::string const& get(const Name_& /*tag*/, vertex_descriptor v) const noexcept { return getName(v); }

    ResourceDesc& getDesc(vertex_descriptor v) noexcept { return this->descs[v]; }
    ResourceDesc& get(const Desc_& /*tag*/, vertex_descriptor v) noexcept { return getDesc(v); }

    ResourceDesc const& getDesc(vertex_descriptor v) const noexcept { return this->descs[v]; }
    ResourceDesc const& get(const Desc_& /*tag*/, vertex_descriptor v) const noexcept { return getDesc(v); }

    ResourceTraits& getTraits(vertex_descriptor v) noexcept { return this->traits[v]; }
    ResourceTraits& get(const Traits_& /*tag*/, vertex_descriptor v) noexcept { return getTraits(v); }

    ResourceTraits const& getTraits(vertex_descriptor v) const noexcept { return this->traits[v]; }
    ResourceTraits const& get(const Traits_& /*tag*/, vertex_descriptor v) const noexcept { return getTraits(v); }

    ResourceStates& getStates(vertex_descriptor v) noexcept { return this->states[v]; }
    ResourceStates& get(const States_& /*tag*/, vertex_descriptor v) noexcept { return getStates(v); }

    ResourceStates const& getStates(vertex_descriptor v) const noexcept { return this->states[v]; }
    ResourceStates const& get(const States_& /*tag*/, vertex_descriptor v) const noexcept { return getStates(v); }

    gfx::SamplerInfo& getSampler(vertex_descriptor v) noexcept { return this->samplerInfo[v]; }
    gfx::SamplerInfo& get(const Sampler_& /*tag*/, vertex_descriptor v) noexcept { return getSampler(v); }

    gfx::SamplerInfo const& getSampler(vertex_descriptor v) const noexcept { return this->samplerInfo[v]; }
    gfx::SamplerInfo const& get(const Sampler_& /*tag*/, vertex_descriptor v) const noexcept { return getSampler(v); }
    void setName(vertex_descriptor v, std::string_view value);

    // PolymorphicGraph
    Kind kind(vertex_descriptor v) const { return this->handles.at(v).kind; }
    template <class Tag>
    bool holds(vertex_descriptor v) const noexcept {
        if (static_cast<std::uintmax_t>(v) >= this->handles.size()) return false;
        if constexpr (std::is_same_v<Tag, Managed_>) {
            return this->handles[v].kind == Kind::Managed;
        } else if constexpr (std::is_same_v<Tag, ManagedBuffer_>) {
            return this->handles[v].kind == Kind::ManagedBuffer;
        } else if constexpr (std::is_same_v<Tag, ManagedTexture_>) {
            return this->handles[v].kind == Kind::ManagedTexture;
        } else if constexpr (std::is_same_v<Tag, PersistentBuffer_>) {
            return this->handles[v].kind == Kind::PersistentBuffer;
        } else if constexpr (std::is_same_v<Tag, PersistentTexture_>) {
            return this->handles[v].kind == Kind::PersistentTexture;
        } else if constexpr (std::is_same_v<Tag, Framebuffer_>) {
            return this->handles[v].kind == Kind::Framebuffer;
        } else if constexpr (std::is_same_v<Tag, Swapchain_>) {
            return this->handles[v].kind == Kind::Swapchain;
        } else if constexpr (std::is_same_v<Tag, FormatView_>) {
            return this->handles[v].kind == Kind::FormatView;
        } else {
            static_assert(std::is_same_v<Tag, SubresourceView_>, "unknown graph tag");
            return this->handles[v].kind == Kind::SubresourceView;
        }
    }
    ManagedResource& value(const Managed_& /*tag*/, vertex_descriptor v) {
        if (!holds<Managed_>(v)) throw std::bad_variant_access{};
        return this->resources[this->handles[v].index];
    }
    ManagedResource const& value(const Managed_& /*tag*/, vertex_descriptor v) const {
        if (!holds<Managed_>(v)) throw std::bad_variant_access{};
        return this->resources[this->handles[v].index];
    }
    ManagedBuffer& value(const ManagedBuffer_& /*tag*/, vertex_descriptor v) {
        if (!holds<ManagedBuffer_>(v)) throw std::bad_variant_access{};
        return this->managedBuffers[this->handles[v].index];
    }
    ManagedBuffer const& value(const ManagedBuffer_& /*tag*/, vertex_descriptor v) const {
        if (!holds<ManagedBuffer_>(v)) throw std::bad_variant_access{};
        return this->managedBuffers[this->handles[v].index];
    }
    ManagedTexture& value(const ManagedTexture_& /*tag*/, vertex_descriptor v) {
        if (!holds<ManagedTexture_>(v)) throw std::bad_variant_access{};
        return this->managedTextures[this->handles[v].index];
    }
    ManagedTexture const& value(const ManagedTexture_& /*tag*/, vertex_descriptor v) const {
        if (!holds<ManagedTexture_>(v)) throw std::bad_variant_access{};
        return this->managedTextures[this->handles[v].index];
    }
    PersistentBuffer& value(const PersistentBuffer_& /*tag*/, vertex_descriptor v) {
        if (!holds<PersistentBuffer_>(v)) throw std::bad_variant_access{};
        return this->buffers[this->handles[v].index];
    }
    PersistentBuffer const& value(const PersistentBuffer_& /*tag*/, vertex_descriptor v) const {
        if (!holds<PersistentBuffer_>(v)) throw std::bad_variant_access{};
        return this->buffers[this->handles[v].index];
    }
    PersistentTexture& value(const PersistentTexture_& /*tag*/, vertex_descriptor v) {
        if (!holds<PersistentTexture_>(v)) throw std::bad_variant_access{};
        return this->textures[this->handles[v].index];
    }
    PersistentTexture const& value(const PersistentTexture_& /*tag*/, vertex_descriptor v) const {
        if (!holds<PersistentTexture_>(v)) throw std::bad_variant_access{};
        return this->textures[this->handles[v].index];
    }
    IntrusivePtr<gfx::Framebuffer>& value(const Framebuffer_& /*tag*/, vertex_descriptor v) {
        if (!holds<Framebuffer_>(v)) throw std::bad_variant_access{};
        return this->framebuffers[this->handles[v].index];
    }
    IntrusivePtr<gfx::Framebuffer> const& value(const Framebuffer_& /*tag*/, vertex_descriptor v) const {
        if (!holds<Framebuffer_>(v)) throw std::bad_variant_access{};
        return this->framebuffers[this->handles[v].index];
    }
    RenderSwapchain& value(const Swapchain_& /*tag*/, vertex_descriptor v) {
        if (!holds<Swapchain_>(v)) throw std::bad_variant_access{};
        return this->swapchains[this->handles[v].index];
    }
    RenderSwapchain const& value(const Swapchain_& /*tag*/, vertex_descriptor v) const {
        if (!holds<Swapchain_>(v)) throw std::bad_variant_access{};
        return this->swapchains[this->handles[v].index];
    }
    FormatView& value(const FormatView_& /*tag*/, vertex_descriptor v) {
        if (!holds<FormatView_>(v)) throw std::bad_variant_access{};
        return this->formatViews[this->handles[v].index];
    }
    FormatView const& value(const FormatView_& /*tag*/, vertex_descriptor v) const {
        if (!holds<FormatView_>(v)) throw std::bad_variant_access{};
        return this->formatViews[this->handles[v].index];
    }
    SubresourceView& value(const SubresourceView_& /*tag*/, vertex_descriptor v) {
        if (!holds<SubresourceView_>(v)) throw std::bad_variant_access{};
        return this->subresourceViews[this->handles[v].index];
    }
    SubresourceView const& value(const SubresourceView_& /*tag*/, vertex_descriptor v) const {
        if (!holds<SubresourceView_>(v)) throw std::bad_variant_access{};
        return this->subresourceViews[this->handles[v].index];
    }

    template <class Visitor, class... Others>
    decltype(auto) visit_vertex(vertex_descriptor v, Visitor&& visitor, Others&&... others) { // NOLINT(readability-identifier-naming)
        if constexpr (sizeof...(others) > 0) {
            auto handlers = overloaded{std::forward<Visitor>(visitor), std::forward<Others>(others)...};
            return this->visit_vertex(v, handlers);
        } else {
            const auto& handle = this->handles.at(v);
            switch (handle.kind) {
                case Kind::Managed: return std::forward<Visitor>(visitor)(this->resources[handle.index]);
                case Kind::ManagedBuffer: return std::forward<Visitor>(visitor)(this->managedBuffers[handle.index]);
                case Kind::ManagedTexture: return std::forward<Visitor>(visitor)(this->managedTextures[handle.index]);
                case Kind::PersistentBuffer: return std::forward<Visitor>(visitor)(this->buffers[handle.index]);
                case Kind::PersistentTexture: return std::forward<Visitor>(visitor)(this->textures[handle.index]);
                case Kind::Framebuffer: return std::forward<Visitor>(visitor)(this->framebuffers[handle.index]);
                case Kind::Swapchain: return std::forward<Visitor>(visitor)(this->swapchains[handle.index]);
                case Kind::FormatView: return std::forward<Visitor>(visitor)(this->formatViews[handle.index]);
                case Kind::SubresourceView: return std::forward<Visitor>(visitor)(this->subresourceViews[handle.index]);
            }
            throw std::bad_variant_access{};
        }
    }

    template <class Visitor, class... Others>
    decltype(auto) visit_vertex(vertex_descriptor v, Visitor&& visitor, Others&&... others) const { // NOLINT(readability-identifier-naming)
        if constexpr (sizeof...(others) > 0) {
            auto handlers = overloaded{std::forward<Visitor>(visitor), std::forward<Others>(others)...};
            return this->visit_vertex(v, handlers);
        } else {
            const auto& handle = this->handles.at(v);
            switch (handle.kind) {
                case Kind::Managed: return std::forward<Visitor>(visitor)(this->resources[handle.index]);
                case Kind::ManagedBuffer: return std::forward<Visitor>(visitor)(this->managedBuffers[handle.index]);
                case Kind::ManagedTexture: return std::forward<Visitor>(visitor)(this->managedTextures[handle.index]);
                case Kind::PersistentBuffer: return std::forward<Visitor>(visitor)(this->buffers[handle.index]);
                case Kind::PersistentTexture: return std::forward<Visitor>(visitor)(this->textures[handle.index]);
                case Kind::Framebuffer: return std::forward<Visitor>(visitor)(this->framebuffers[handle.index]);
                case Kind::Swapchain: return std::forward<Visitor>(visitor)(this->swapchains[handle.index]);
                case Kind::FormatView: return std::forward<Visitor>(visitor)(this->formatViews[handle.index]);
                case Kind::SubresourceView: return std::forward<Visitor>(visitor)(this->subresourceViews[handle.index]);
            }
            throw std::bad_variant_access{};
        }
    }

    // ReferenceGraph
    vertex_descriptor child(ownership_descriptor link) const noexcept { return link.target; }                                   // NOLINT(readability-convert-member-functions-to-static)
    vertex_descriptor get_parent(vertex_descriptor v) const noexcept { return v == null_vertex() ? v : this->links[v].parent; } // NOLINT(readability-identifier-naming)
    vertex_descriptor num_children(vertex_descriptor v) const noexcept { return this->links[v].childCount; }                    // NOLINT(readability-identifier-naming)
    graph::IteratorRange<children_iterator> child_links(vertex_descriptor v) const noexcept {                                   // NOLINT(readability-identifier-naming)
        const auto* rows = links.data();
        return {{rows, rows[v].firstChild}, {rows, null_vertex()}};
    }
    vertex_descriptor parent(ownership_descriptor e) const noexcept { return e.source; }                                                            // NOLINT(readability-convert-member-functions-to-static)
    vertex_descriptor num_parents(vertex_descriptor v) const noexcept { return get_parent(v) != null_vertex(); }                                    // NOLINT(readability-identifier-naming)
    graph::IteratorRange<parent_iterator> parent_links(vertex_descriptor v) const noexcept { return {{{get_parent(v), v}}, {{null_vertex(), v}}}; } // NOLINT(readability-identifier-naming)
    bool has_link(vertex_descriptor u, vertex_descriptor v) const noexcept { return edge(u, v).second; }                                            // NOLINT(readability-identifier-naming)

    // UuidGraph
    bool contains(std::string_view key) const noexcept { return find(key) != null_vertex(); }
    vertex_descriptor find(std::string_view key) const noexcept {
        const auto it = this->nameIndex_.find(key);
        return it == this->nameIndex_.end() ? null_vertex() : it->second;
    }
    vertex_descriptor vertex(std::string_view key) const {
        const auto v = find(key);
        if (v == null_vertex()) throw std::out_of_range("unknown vertex name");
        return v;
    }

    void validateSwapchains();
    void mount(gfx::Device *device, ResourceGraph::vertex_descriptor vertID);
    void unmount(uint64_t completedFenceValue);
    bool isTexture(ResourceGraph::vertex_descriptor resID) const noexcept;
    bool isTextureView(ResourceGraph::vertex_descriptor resID) const noexcept;
    gfx::Texture *getTexture(ResourceGraph::vertex_descriptor resID);
    gfx::Buffer *getBuffer(ResourceGraph::vertex_descriptor resID);
    void invalidatePersistentRenderPassAndFramebuffer(gfx::Texture *pTexture);

    struct VertexHandle {
        Kind kind;
        vertex_descriptor index;
    };

    ccstd::pmr::vector<VertexHandle> handles;
    ccstd::pmr::vector<TreeEdge> links;
    ccstd::pmr::vector<ccstd::pmr::string> names;
    ccstd::pmr::vector<ResourceDesc> descs;
    ccstd::pmr::vector<ResourceTraits> traits;
    ccstd::pmr::vector<ResourceStates> states;
    ccstd::pmr::vector<gfx::SamplerInfo> samplerInfo;
    ccstd::pmr::vector<ManagedResource> resources;
    ccstd::pmr::vector<ManagedBuffer> managedBuffers;
    ccstd::pmr::vector<ManagedTexture> managedTextures;
    ccstd::pmr::vector<PersistentBuffer> buffers;
    ccstd::pmr::vector<PersistentTexture> textures;
    ccstd::pmr::vector<IntrusivePtr<gfx::Framebuffer>> framebuffers;
    ccstd::pmr::vector<RenderSwapchain> swapchains;
    ccstd::pmr::vector<FormatView> formatViews;
    ccstd::pmr::vector<SubresourceView> subresourceViews;
    ccstd::pmr::map<ccstd::pmr::string, vertex_descriptor, std::less<>> nameIndex_;
    ccstd::pmr::unordered_map<RasterPass, PersistentRenderPassAndFramebuffer> renderPasses;
    uint64_t nextFenceValue{0ULL};
    uint64_t version{0ULL};
};

struct ComputePass {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {computeViews.get_allocator().resource()};
    }

    ComputePass(const allocator_type& alloc); // NOLINT
    ComputePass(ComputePass&& rhs, const allocator_type& alloc);
    ComputePass(ComputePass const& rhs, const allocator_type& alloc);

    ComputePass(ComputePass&& rhs) noexcept = default;
    ComputePass(ComputePass const& rhs) = delete;
    ComputePass& operator=(ComputePass&& rhs) noexcept = default;
    ComputePass& operator=(ComputePass const& rhs) = default;

    PmrTransparentMap<ccstd::pmr::string, ccstd::pmr::vector<ComputeView>> computeViews;
    PmrTransparentMap<ccstd::pmr::string, gfx::ShaderStageFlagBit> textures;
};

struct ResolvePass {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {resolvePairs.get_allocator().resource()};
    }

    ResolvePass(const allocator_type& alloc); // NOLINT
    ResolvePass(ResolvePass&& rhs, const allocator_type& alloc);
    ResolvePass(ResolvePass const& rhs, const allocator_type& alloc);

    ResolvePass(ResolvePass&& rhs) noexcept = default;
    ResolvePass(ResolvePass const& rhs) = delete;
    ResolvePass& operator=(ResolvePass&& rhs) noexcept = default;
    ResolvePass& operator=(ResolvePass const& rhs) = default;

    ccstd::pmr::vector<ResolvePair> resolvePairs;
};

struct CopyPass {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {copyPairs.get_allocator().resource()};
    }

    CopyPass(const allocator_type& alloc); // NOLINT
    CopyPass(CopyPass&& rhs, const allocator_type& alloc);

    CopyPass(CopyPass&& rhs) noexcept = default;
    CopyPass(CopyPass const& rhs) = delete;
    CopyPass& operator=(CopyPass&& rhs) noexcept = default;
    CopyPass& operator=(CopyPass const& rhs) = delete;

    ccstd::pmr::vector<CopyPair> copyPairs;
    ccstd::pmr::vector<UploadPair> uploadPairs;
};

struct MovePass {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {movePairs.get_allocator().resource()};
    }

    MovePass(const allocator_type& alloc); // NOLINT
    MovePass(MovePass&& rhs, const allocator_type& alloc);
    MovePass(MovePass const& rhs, const allocator_type& alloc);

    MovePass(MovePass&& rhs) noexcept = default;
    MovePass(MovePass const& rhs) = delete;
    MovePass& operator=(MovePass&& rhs) noexcept = default;
    MovePass& operator=(MovePass const& rhs) = default;

    ccstd::pmr::vector<MovePair> movePairs;
};

struct RaytracePass {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {computeViews.get_allocator().resource()};
    }

    RaytracePass(const allocator_type& alloc); // NOLINT
    RaytracePass(RaytracePass&& rhs, const allocator_type& alloc);
    RaytracePass(RaytracePass const& rhs, const allocator_type& alloc);

    RaytracePass(RaytracePass&& rhs) noexcept = default;
    RaytracePass(RaytracePass const& rhs) = delete;
    RaytracePass& operator=(RaytracePass&& rhs) noexcept = default;
    RaytracePass& operator=(RaytracePass const& rhs) = default;

    PmrTransparentMap<ccstd::pmr::string, ccstd::pmr::vector<ComputeView>> computeViews;
};

struct Queue_ {};
struct Scene_ {};
struct Dispatch_ {};
struct Blit_ {};
struct Clear_ {};
struct Viewport_ {};

struct ClearView {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {slotName.get_allocator().resource()};
    }

    ClearView(const allocator_type& alloc); // NOLINT
    ClearView(const std::allocator_arg_t& /*tag*/, const allocator_type& alloc, ccstd::pmr::string slotNameIn = ccstd::pmr::string{}, gfx::ClearFlagBit clearFlagsIn = gfx::ClearFlagBit::ALL, const gfx::Color& clearColorIn = gfx::Color{});
    ClearView(ClearView&& rhs, const allocator_type& alloc);
    ClearView(ClearView const& rhs, const allocator_type& alloc);

    ClearView(ClearView&& rhs) noexcept = default;
    ClearView(ClearView const& rhs) = delete;
    ClearView& operator=(ClearView&& rhs) noexcept = default;
    ClearView& operator=(ClearView const& rhs) = default;

    ccstd::pmr::string slotName;
    gfx::ClearFlagBit clearFlags{gfx::ClearFlagBit::ALL};
    gfx::Color clearColor;
};

struct RenderQueue {
    RenderQueue(QueueHint hintIn = QueueHint::RENDER_OPAQUE, uint32_t phaseIDIn = 0xFFFFFFFF, uint32_t passLayoutIDIn = 0xFFFFFFFF) noexcept // NOLINT(google-explicit-constructor)
    : hint(hintIn),
      phaseID(phaseIDIn),
      passLayoutID(passLayoutIDIn) {}
    RenderQueue(uint32_t phaseIDIn, uint32_t passLayoutIDIn) noexcept
    : phaseID(phaseIDIn),
      passLayoutID(passLayoutIDIn) {}

    QueueHint hint{QueueHint::RENDER_OPAQUE};
    uint32_t phaseID{0xFFFFFFFF};
    uint32_t passLayoutID{0xFFFFFFFF};
    gfx::Viewport viewport;
};

enum class CullingFlags : uint32_t { // NOLINT(performance-enum-size)
    NONE = 0,
    CAMERA_FRUSTUM = 0x1,
    LIGHT_FRUSTUM = 0x2,
    LIGHT_BOUNDS = 0x4,
};

constexpr CullingFlags operator|(const CullingFlags lhs, const CullingFlags rhs) noexcept {
    return static_cast<CullingFlags>(static_cast<uint32_t>(lhs) | static_cast<uint32_t>(rhs));
}

constexpr CullingFlags operator&(const CullingFlags lhs, const CullingFlags rhs) noexcept {
    return static_cast<CullingFlags>(static_cast<uint32_t>(lhs) & static_cast<uint32_t>(rhs));
}

constexpr CullingFlags &operator|=(CullingFlags &lhs, const CullingFlags rhs) noexcept {
    return lhs = lhs | rhs;
}

constexpr CullingFlags &operator&=(CullingFlags &lhs, const CullingFlags rhs) noexcept {
    return lhs = lhs & rhs;
}

constexpr bool operator!(CullingFlags e) noexcept {
    return e == static_cast<CullingFlags>(0);
}

constexpr CullingFlags operator~(CullingFlags e) noexcept {
    return static_cast<CullingFlags>(~static_cast<std::underlying_type_t<CullingFlags>>(e));
}

constexpr bool any(CullingFlags e) noexcept {
    return !!e;
}

struct SceneData {
    SceneData(const scene::RenderScene* sceneIn = nullptr, const scene::Camera* cameraIn = nullptr, SceneFlags flagsIn = SceneFlags::NONE, LightInfo lightIn = {}, CullingFlags cullingFlagsIn = CullingFlags::CAMERA_FRUSTUM, IntrusivePtr<scene::Light> shadingLightIn = IntrusivePtr<scene::Light>{}) noexcept // NOLINT(google-explicit-constructor)
    : scene(sceneIn),
      camera(cameraIn),
      light(std::move(lightIn)),
      flags(flagsIn),
      cullingFlags(cullingFlagsIn),
      shadingLight(std::move(shadingLightIn)) {}

    const scene::RenderScene *scene{nullptr};
    const scene::Camera *camera{nullptr};
    LightInfo light;
    SceneFlags flags{SceneFlags::NONE};
    CullingFlags cullingFlags{CullingFlags::CAMERA_FRUSTUM};
    IntrusivePtr<scene::Light> shadingLight;
};

struct Dispatch {
    Dispatch(IntrusivePtr<Material> materialIn = IntrusivePtr<Material>{}, uint32_t passIDIn = 0, uint32_t threadGroupCountXIn = 0, uint32_t threadGroupCountYIn = 0, uint32_t threadGroupCountZIn = 0) noexcept // NOLINT(google-explicit-constructor)
    : material(std::move(materialIn)),
      passID(passIDIn),
      threadGroupCountX(threadGroupCountXIn),
      threadGroupCountY(threadGroupCountYIn),
      threadGroupCountZ(threadGroupCountZIn) {}

    IntrusivePtr<Material> material;
    uint32_t passID{0};
    uint32_t threadGroupCountX{0};
    uint32_t threadGroupCountY{0};
    uint32_t threadGroupCountZ{0};
};

enum class BlitType : uint8_t {
    FULLSCREEN_QUAD,
    DRAW_2D,
    DRAW_PROFILE,
    DRAW_3D,
};

struct Blit {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {models.get_allocator().resource()};
    }

    Blit(const allocator_type& alloc); // NOLINT
    Blit(const std::allocator_arg_t& /*tag*/, const allocator_type& alloc, IntrusivePtr<Material> materialIn = IntrusivePtr<Material>{}, uint32_t passIDIn = 0, SceneFlags sceneFlagsIn = SceneFlags::NONE, const scene::Camera* cameraIn = nullptr, BlitType blitTypeIn = BlitType::FULLSCREEN_QUAD);
    Blit(const scene::Camera* cameraIn, BlitType blitTypeIn, ccstd::pmr::vector<IntrusivePtr<scene::Model>> modelsIn, const allocator_type& alloc);
    Blit(Blit&& rhs, const allocator_type& alloc);
    Blit(Blit const& rhs, const allocator_type& alloc);

    Blit(Blit&& rhs) noexcept = default;
    Blit(Blit const& rhs) = delete;
    Blit& operator=(Blit&& rhs) noexcept = default;
    Blit& operator=(Blit const& rhs) = default;

    IntrusivePtr<Material> material;
    uint32_t passID{0};
    SceneFlags sceneFlags{SceneFlags::NONE};
    const scene::Camera *camera{nullptr};
    BlitType blitType{BlitType::FULLSCREEN_QUAD};
    ccstd::pmr::vector<IntrusivePtr<scene::Model>> models;
};

struct RenderData {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {constants.get_allocator().resource()};
    }

    RenderData(const allocator_type& alloc); // NOLINT
    RenderData(RenderData&& rhs, const allocator_type& alloc);

    RenderData(RenderData&& rhs) noexcept = default;
    RenderData(RenderData const& rhs) = delete;
    RenderData& operator=(RenderData&& rhs) noexcept = default;
    RenderData& operator=(RenderData const& rhs) = delete;

    PmrFlatMap<uint32_t, ccstd::pmr::vector<char>> constants;
    PmrFlatMap<uint32_t, IntrusivePtr<gfx::Buffer>> buffers;
    PmrFlatMap<uint32_t, IntrusivePtr<gfx::Texture>> textures;
    PmrFlatMap<uint32_t, gfx::Sampler*> samplers;
    ccstd::pmr::string custom;
};

struct Data_ {};
struct Valid_ {};

struct RenderGraph {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { return {this->handles.get_allocator().resource()}; } // NOLINT(readability-identifier-naming)

    explicit RenderGraph(const allocator_type& alloc) : handles(alloc), outEdges(alloc), inEdges(alloc), links(alloc), names(alloc), layoutNodes(alloc), data(alloc), valid(alloc), rasterPasses(alloc), rasterSubpasses(alloc), computeSubpasses(alloc), computePasses(alloc), resolvePasses(alloc), copyPasses(alloc), movePasses(alloc), raytracePasses(alloc), renderQueues(alloc), scenes(alloc), blits(alloc), dispatches(alloc), clearViews(alloc), viewports(alloc), index(alloc), sortedVertices(alloc), globalRenderData(alloc) {}
    RenderGraph(const RenderGraph& rhs, const allocator_type& alloc) = delete;
    RenderGraph(RenderGraph&& rhs, const allocator_type& alloc);
    RenderGraph(RenderGraph&&) noexcept = default;
    RenderGraph(const RenderGraph&) = delete;
    RenderGraph& operator=(RenderGraph&&) noexcept = default;
    RenderGraph& operator=(const RenderGraph&) = delete;

    // Graph types
    using vertex_descriptor = uint32_t;
    using edge_descriptor = graph::EdgeDescriptor<vertex_descriptor>;

    // IncidenceGraph types
    using out_edge_iterator = graph::IncidentEdgeIterator<ccstd::pmr::vector<vertex_descriptor>, false>;

    // BidirectionalGraph types
    using in_edge_iterator = graph::IncidentEdgeIterator<ccstd::pmr::vector<vertex_descriptor>, true>;

    // AdjacencyGraph types
    using adjacency_iterator = ccstd::pmr::vector<vertex_descriptor>::const_iterator;

    // VertexListGraph types
    using vertex_iterator = graph::VertexIterator<vertex_descriptor>;

    // PolymorphicGraph types
    enum class Kind : uint8_t {
        RasterPass,     // NOLINT(readability-identifier-naming)
        RasterSubpass,  // NOLINT(readability-identifier-naming)
        ComputeSubpass, // NOLINT(readability-identifier-naming)
        Compute,        // NOLINT(readability-identifier-naming)
        Resolve,        // NOLINT(readability-identifier-naming)
        Copy,           // NOLINT(readability-identifier-naming)
        Move,           // NOLINT(readability-identifier-naming)
        Raytrace,       // NOLINT(readability-identifier-naming)
        Queue,          // NOLINT(readability-identifier-naming)
        Scene,          // NOLINT(readability-identifier-naming)
        Blit,           // NOLINT(readability-identifier-naming)
        Dispatch,       // NOLINT(readability-identifier-naming)
        Clear,          // NOLINT(readability-identifier-naming)
        Viewport        // NOLINT(readability-identifier-naming)
    };

    // ReferenceGraph types
    using TreeEdge = graph::TreeEdge<vertex_descriptor>;
    using ownership_descriptor = graph::EdgeDescriptor<vertex_descriptor>;
    using children_iterator = graph::ChildIterator<ownership_descriptor, false>;
    using parent_iterator = graph::ParentLinkIterator<ownership_descriptor>;

    // Graph
    static constexpr vertex_descriptor null_vertex() noexcept { return (std::numeric_limits<vertex_descriptor>::max)(); } // NOLINT(readability-identifier-naming)

    // IncidenceGraph
    vertex_descriptor source(edge_descriptor e) const noexcept { return e.source; }         // NOLINT(readability-convert-member-functions-to-static)
    vertex_descriptor target(edge_descriptor e) const noexcept { return e.target; }         // NOLINT(readability-convert-member-functions-to-static)
    graph::IteratorRange<out_edge_iterator> out_edges(vertex_descriptor v) const noexcept { // NOLINT(readability-identifier-naming)
        const auto& neighbors = this->outEdges[v];
        return {{v, neighbors.begin()}, {v, neighbors.end()}};
    }
    std::size_t out_degree(vertex_descriptor v) const noexcept { return outEdges[v].size(); } // NOLINT(readability-identifier-naming)
    std::pair<edge_descriptor, bool> edge(vertex_descriptor u, vertex_descriptor v) const noexcept {
        if (u < outEdges.size()) {
            const auto& row = outEdges[u];
            if (std::find(row.begin(), row.end(), v) != row.end()) return {{u, v}, true};
        }
        return {{null_vertex(), null_vertex()}, false};
    }

    // BidirectionalGraph
    graph::IteratorRange<in_edge_iterator> in_edges(vertex_descriptor v) const noexcept { // NOLINT(readability-identifier-naming)
        const auto& neighbors = this->inEdges[v];
        return {{v, neighbors.begin()}, {v, neighbors.end()}};
    }
    std::size_t in_degree(vertex_descriptor v) const noexcept { return inEdges[v].size(); } // NOLINT(readability-identifier-naming)
    std::size_t degree(vertex_descriptor v) const noexcept { return in_degree(v) + out_degree(v); }

    // AdjacencyGraph
    const auto& adjacent_vertices(vertex_descriptor v) const noexcept { return outEdges[v]; } // NOLINT(readability-identifier-naming)

    // VertexListGraph
    graph::VertexRange<vertex_descriptor> vertices() const noexcept { return {vertex_iterator(num_vertices())}; }
    vertex_descriptor num_vertices() const noexcept { return static_cast<vertex_descriptor>(this->names.size()); } // NOLINT(readability-identifier-naming)

    // MutableGraph
    vertex_descriptor add_vertex(const RasterPassTag& tag, std::string_view value = {}, vertex_descriptor parent = null_vertex());     // NOLINT(readability-identifier-naming)
    vertex_descriptor add_vertex(const RasterSubpassTag& tag, std::string_view value = {}, vertex_descriptor parent = null_vertex());  // NOLINT(readability-identifier-naming)
    vertex_descriptor add_vertex(const ComputeSubpassTag& tag, std::string_view value = {}, vertex_descriptor parent = null_vertex()); // NOLINT(readability-identifier-naming)
    vertex_descriptor add_vertex(const ComputeTag& tag, std::string_view value = {}, vertex_descriptor parent = null_vertex());        // NOLINT(readability-identifier-naming)
    vertex_descriptor add_vertex(const ResolveTag& tag, std::string_view value = {}, vertex_descriptor parent = null_vertex());        // NOLINT(readability-identifier-naming)
    vertex_descriptor add_vertex(const CopyTag& tag, std::string_view value = {}, vertex_descriptor parent = null_vertex());           // NOLINT(readability-identifier-naming)
    vertex_descriptor add_vertex(const MoveTag& tag, std::string_view value = {}, vertex_descriptor parent = null_vertex());           // NOLINT(readability-identifier-naming)
    vertex_descriptor add_vertex(const RaytraceTag& tag, std::string_view value = {}, vertex_descriptor parent = null_vertex());       // NOLINT(readability-identifier-naming)
    vertex_descriptor add_vertex(const Queue_& tag, std::string_view value = {}, vertex_descriptor parent = null_vertex());            // NOLINT(readability-identifier-naming)
    vertex_descriptor add_vertex(const Scene_& tag, std::string_view value = {}, vertex_descriptor parent = null_vertex());            // NOLINT(readability-identifier-naming)
    vertex_descriptor add_vertex(const Blit_& tag, std::string_view value = {}, vertex_descriptor parent = null_vertex());             // NOLINT(readability-identifier-naming)
    vertex_descriptor add_vertex(const Dispatch_& tag, std::string_view value = {}, vertex_descriptor parent = null_vertex());         // NOLINT(readability-identifier-naming)
    vertex_descriptor add_vertex(const Clear_& tag, std::string_view value = {}, vertex_descriptor parent = null_vertex());            // NOLINT(readability-identifier-naming)
    vertex_descriptor add_vertex(const Viewport_& tag, std::string_view value = {}, vertex_descriptor parent = null_vertex());         // NOLINT(readability-identifier-naming)

    template <class Tag, class PayloadArgs, class Args0, class Args1, class Args2, class Args3,
              std::enable_if_t<std::is_same_v<Tag, RasterPassTag> ||
                                   std::is_same_v<Tag, RasterSubpassTag> ||
                                   std::is_same_v<Tag, ComputeSubpassTag> ||
                                   std::is_same_v<Tag, ComputeTag> ||
                                   std::is_same_v<Tag, ResolveTag> ||
                                   std::is_same_v<Tag, CopyTag> ||
                                   std::is_same_v<Tag, MoveTag> ||
                                   std::is_same_v<Tag, RaytraceTag> ||
                                   std::is_same_v<Tag, Queue_> ||
                                   std::is_same_v<Tag, Scene_> ||
                                   std::is_same_v<Tag, Blit_> ||
                                   std::is_same_v<Tag, Dispatch_> ||
                                   std::is_same_v<Tag, Clear_> ||
                                   std::is_same_v<Tag, Viewport_>,
                               int> = 0,
              class = std::void_t<typename std::tuple_size<std::decay_t<PayloadArgs>>::type,
                                  typename std::tuple_size<std::decay_t<Args0>>::type,
                                  typename std::tuple_size<std::decay_t<Args1>>::type,
                                  typename std::tuple_size<std::decay_t<Args2>>::type,
                                  typename std::tuple_size<std::decay_t<Args3>>::type>>
    vertex_descriptor add_vertex(const Tag& /*tag*/, std::piecewise_construct_t /*piecewise*/, PayloadArgs&& payloadArgs, Args0&& argsName, Args1&& argsLayout, Args2&& argsData, Args3&& argsValid, vertex_descriptor parent = null_vertex()); // NOLINT(readability-identifier-naming)
    std::pair<edge_descriptor, bool> add_edge(vertex_descriptor u, vertex_descriptor v);                                                                                                                                                        // NOLINT(readability-identifier-naming)
    void remove_edge(edge_descriptor e) noexcept;                                                                                                                                                                                               // NOLINT(readability-identifier-naming)
    void remove_edge(vertex_descriptor u, vertex_descriptor v) noexcept;                                                                                                                                                                        // NOLINT(readability-identifier-naming)

    // ComponentGraph
    ccstd::pmr::string& getName(vertex_descriptor v) noexcept { return this->names[v]; }
    ccstd::pmr::string& get(const Name_& /*tag*/, vertex_descriptor v) noexcept { return getName(v); }

    ccstd::pmr::string const& getName(vertex_descriptor v) const noexcept { return this->names[v]; }
    ccstd::pmr::string const& get(const Name_& /*tag*/, vertex_descriptor v) const noexcept { return getName(v); }

    ccstd::pmr::string& getLayout(vertex_descriptor v) noexcept { return this->layoutNodes[v]; }
    ccstd::pmr::string& get(const Layout_& /*tag*/, vertex_descriptor v) noexcept { return getLayout(v); }

    ccstd::pmr::string const& getLayout(vertex_descriptor v) const noexcept { return this->layoutNodes[v]; }
    ccstd::pmr::string const& get(const Layout_& /*tag*/, vertex_descriptor v) const noexcept { return getLayout(v); }

    RenderData& getData(vertex_descriptor v) noexcept { return this->data[v]; }
    RenderData& get(const Data_& /*tag*/, vertex_descriptor v) noexcept { return getData(v); }

    RenderData const& getData(vertex_descriptor v) const noexcept { return this->data[v]; }
    RenderData const& get(const Data_& /*tag*/, vertex_descriptor v) const noexcept { return getData(v); }

    ccstd::pmr::vector<bool>::reference getValid(vertex_descriptor v) noexcept { return this->valid[v]; }
    ccstd::pmr::vector<bool>::reference get(const Valid_& /*tag*/, vertex_descriptor v) noexcept { return getValid(v); }

    ccstd::pmr::vector<bool>::const_reference getValid(vertex_descriptor v) const noexcept { return this->valid[v]; }
    ccstd::pmr::vector<bool>::const_reference get(const Valid_& /*tag*/, vertex_descriptor v) const noexcept { return getValid(v); }

    // PolymorphicGraph
    Kind kind(vertex_descriptor v) const { return this->handles.at(v).kind; }
    template <class Tag>
    bool holds(vertex_descriptor v) const noexcept {
        if (static_cast<std::uintmax_t>(v) >= this->handles.size()) return false;
        if constexpr (std::is_same_v<Tag, RasterPassTag>) {
            return this->handles[v].kind == Kind::RasterPass;
        } else if constexpr (std::is_same_v<Tag, RasterSubpassTag>) {
            return this->handles[v].kind == Kind::RasterSubpass;
        } else if constexpr (std::is_same_v<Tag, ComputeSubpassTag>) {
            return this->handles[v].kind == Kind::ComputeSubpass;
        } else if constexpr (std::is_same_v<Tag, ComputeTag>) {
            return this->handles[v].kind == Kind::Compute;
        } else if constexpr (std::is_same_v<Tag, ResolveTag>) {
            return this->handles[v].kind == Kind::Resolve;
        } else if constexpr (std::is_same_v<Tag, CopyTag>) {
            return this->handles[v].kind == Kind::Copy;
        } else if constexpr (std::is_same_v<Tag, MoveTag>) {
            return this->handles[v].kind == Kind::Move;
        } else if constexpr (std::is_same_v<Tag, RaytraceTag>) {
            return this->handles[v].kind == Kind::Raytrace;
        } else if constexpr (std::is_same_v<Tag, Queue_>) {
            return this->handles[v].kind == Kind::Queue;
        } else if constexpr (std::is_same_v<Tag, Scene_>) {
            return this->handles[v].kind == Kind::Scene;
        } else if constexpr (std::is_same_v<Tag, Blit_>) {
            return this->handles[v].kind == Kind::Blit;
        } else if constexpr (std::is_same_v<Tag, Dispatch_>) {
            return this->handles[v].kind == Kind::Dispatch;
        } else if constexpr (std::is_same_v<Tag, Clear_>) {
            return this->handles[v].kind == Kind::Clear;
        } else {
            static_assert(std::is_same_v<Tag, Viewport_>, "unknown graph tag");
            return this->handles[v].kind == Kind::Viewport;
        }
    }
    RasterPass& value(const RasterPassTag& /*tag*/, vertex_descriptor v) {
        if (!holds<RasterPassTag>(v)) throw std::bad_variant_access{};
        return this->rasterPasses[this->handles[v].index];
    }
    RasterPass const& value(const RasterPassTag& /*tag*/, vertex_descriptor v) const {
        if (!holds<RasterPassTag>(v)) throw std::bad_variant_access{};
        return this->rasterPasses[this->handles[v].index];
    }
    RasterSubpass& value(const RasterSubpassTag& /*tag*/, vertex_descriptor v) {
        if (!holds<RasterSubpassTag>(v)) throw std::bad_variant_access{};
        return this->rasterSubpasses[this->handles[v].index];
    }
    RasterSubpass const& value(const RasterSubpassTag& /*tag*/, vertex_descriptor v) const {
        if (!holds<RasterSubpassTag>(v)) throw std::bad_variant_access{};
        return this->rasterSubpasses[this->handles[v].index];
    }
    ComputeSubpass& value(const ComputeSubpassTag& /*tag*/, vertex_descriptor v) {
        if (!holds<ComputeSubpassTag>(v)) throw std::bad_variant_access{};
        return this->computeSubpasses[this->handles[v].index];
    }
    ComputeSubpass const& value(const ComputeSubpassTag& /*tag*/, vertex_descriptor v) const {
        if (!holds<ComputeSubpassTag>(v)) throw std::bad_variant_access{};
        return this->computeSubpasses[this->handles[v].index];
    }
    ComputePass& value(const ComputeTag& /*tag*/, vertex_descriptor v) {
        if (!holds<ComputeTag>(v)) throw std::bad_variant_access{};
        return this->computePasses[this->handles[v].index];
    }
    ComputePass const& value(const ComputeTag& /*tag*/, vertex_descriptor v) const {
        if (!holds<ComputeTag>(v)) throw std::bad_variant_access{};
        return this->computePasses[this->handles[v].index];
    }
    ResolvePass& value(const ResolveTag& /*tag*/, vertex_descriptor v) {
        if (!holds<ResolveTag>(v)) throw std::bad_variant_access{};
        return this->resolvePasses[this->handles[v].index];
    }
    ResolvePass const& value(const ResolveTag& /*tag*/, vertex_descriptor v) const {
        if (!holds<ResolveTag>(v)) throw std::bad_variant_access{};
        return this->resolvePasses[this->handles[v].index];
    }
    CopyPass& value(const CopyTag& /*tag*/, vertex_descriptor v) {
        if (!holds<CopyTag>(v)) throw std::bad_variant_access{};
        return this->copyPasses[this->handles[v].index];
    }
    CopyPass const& value(const CopyTag& /*tag*/, vertex_descriptor v) const {
        if (!holds<CopyTag>(v)) throw std::bad_variant_access{};
        return this->copyPasses[this->handles[v].index];
    }
    MovePass& value(const MoveTag& /*tag*/, vertex_descriptor v) {
        if (!holds<MoveTag>(v)) throw std::bad_variant_access{};
        return this->movePasses[this->handles[v].index];
    }
    MovePass const& value(const MoveTag& /*tag*/, vertex_descriptor v) const {
        if (!holds<MoveTag>(v)) throw std::bad_variant_access{};
        return this->movePasses[this->handles[v].index];
    }
    RaytracePass& value(const RaytraceTag& /*tag*/, vertex_descriptor v) {
        if (!holds<RaytraceTag>(v)) throw std::bad_variant_access{};
        return this->raytracePasses[this->handles[v].index];
    }
    RaytracePass const& value(const RaytraceTag& /*tag*/, vertex_descriptor v) const {
        if (!holds<RaytraceTag>(v)) throw std::bad_variant_access{};
        return this->raytracePasses[this->handles[v].index];
    }
    RenderQueue& value(const Queue_& /*tag*/, vertex_descriptor v) {
        if (!holds<Queue_>(v)) throw std::bad_variant_access{};
        return this->renderQueues[this->handles[v].index];
    }
    RenderQueue const& value(const Queue_& /*tag*/, vertex_descriptor v) const {
        if (!holds<Queue_>(v)) throw std::bad_variant_access{};
        return this->renderQueues[this->handles[v].index];
    }
    SceneData& value(const Scene_& /*tag*/, vertex_descriptor v) {
        if (!holds<Scene_>(v)) throw std::bad_variant_access{};
        return this->scenes[this->handles[v].index];
    }
    SceneData const& value(const Scene_& /*tag*/, vertex_descriptor v) const {
        if (!holds<Scene_>(v)) throw std::bad_variant_access{};
        return this->scenes[this->handles[v].index];
    }
    Blit& value(const Blit_& /*tag*/, vertex_descriptor v) {
        if (!holds<Blit_>(v)) throw std::bad_variant_access{};
        return this->blits[this->handles[v].index];
    }
    Blit const& value(const Blit_& /*tag*/, vertex_descriptor v) const {
        if (!holds<Blit_>(v)) throw std::bad_variant_access{};
        return this->blits[this->handles[v].index];
    }
    Dispatch& value(const Dispatch_& /*tag*/, vertex_descriptor v) {
        if (!holds<Dispatch_>(v)) throw std::bad_variant_access{};
        return this->dispatches[this->handles[v].index];
    }
    Dispatch const& value(const Dispatch_& /*tag*/, vertex_descriptor v) const {
        if (!holds<Dispatch_>(v)) throw std::bad_variant_access{};
        return this->dispatches[this->handles[v].index];
    }
    ccstd::pmr::vector<ClearView>& value(const Clear_& /*tag*/, vertex_descriptor v) {
        if (!holds<Clear_>(v)) throw std::bad_variant_access{};
        return this->clearViews[this->handles[v].index];
    }
    ccstd::pmr::vector<ClearView> const& value(const Clear_& /*tag*/, vertex_descriptor v) const {
        if (!holds<Clear_>(v)) throw std::bad_variant_access{};
        return this->clearViews[this->handles[v].index];
    }
    gfx::Viewport& value(const Viewport_& /*tag*/, vertex_descriptor v) {
        if (!holds<Viewport_>(v)) throw std::bad_variant_access{};
        return this->viewports[this->handles[v].index];
    }
    gfx::Viewport const& value(const Viewport_& /*tag*/, vertex_descriptor v) const {
        if (!holds<Viewport_>(v)) throw std::bad_variant_access{};
        return this->viewports[this->handles[v].index];
    }

    template <class Visitor, class... Others>
    decltype(auto) visit_vertex(vertex_descriptor v, Visitor&& visitor, Others&&... others) { // NOLINT(readability-identifier-naming)
        if constexpr (sizeof...(others) > 0) {
            auto handlers = overloaded{std::forward<Visitor>(visitor), std::forward<Others>(others)...};
            return this->visit_vertex(v, handlers);
        } else {
            const auto& handle = this->handles.at(v);
            switch (handle.kind) {
                case Kind::RasterPass: return std::forward<Visitor>(visitor)(this->rasterPasses[handle.index]);
                case Kind::RasterSubpass: return std::forward<Visitor>(visitor)(this->rasterSubpasses[handle.index]);
                case Kind::ComputeSubpass: return std::forward<Visitor>(visitor)(this->computeSubpasses[handle.index]);
                case Kind::Compute: return std::forward<Visitor>(visitor)(this->computePasses[handle.index]);
                case Kind::Resolve: return std::forward<Visitor>(visitor)(this->resolvePasses[handle.index]);
                case Kind::Copy: return std::forward<Visitor>(visitor)(this->copyPasses[handle.index]);
                case Kind::Move: return std::forward<Visitor>(visitor)(this->movePasses[handle.index]);
                case Kind::Raytrace: return std::forward<Visitor>(visitor)(this->raytracePasses[handle.index]);
                case Kind::Queue: return std::forward<Visitor>(visitor)(this->renderQueues[handle.index]);
                case Kind::Scene: return std::forward<Visitor>(visitor)(this->scenes[handle.index]);
                case Kind::Blit: return std::forward<Visitor>(visitor)(this->blits[handle.index]);
                case Kind::Dispatch: return std::forward<Visitor>(visitor)(this->dispatches[handle.index]);
                case Kind::Clear: return std::forward<Visitor>(visitor)(this->clearViews[handle.index]);
                case Kind::Viewport: return std::forward<Visitor>(visitor)(this->viewports[handle.index]);
            }
            throw std::bad_variant_access{};
        }
    }

    template <class Visitor, class... Others>
    decltype(auto) visit_vertex(vertex_descriptor v, Visitor&& visitor, Others&&... others) const { // NOLINT(readability-identifier-naming)
        if constexpr (sizeof...(others) > 0) {
            auto handlers = overloaded{std::forward<Visitor>(visitor), std::forward<Others>(others)...};
            return this->visit_vertex(v, handlers);
        } else {
            const auto& handle = this->handles.at(v);
            switch (handle.kind) {
                case Kind::RasterPass: return std::forward<Visitor>(visitor)(this->rasterPasses[handle.index]);
                case Kind::RasterSubpass: return std::forward<Visitor>(visitor)(this->rasterSubpasses[handle.index]);
                case Kind::ComputeSubpass: return std::forward<Visitor>(visitor)(this->computeSubpasses[handle.index]);
                case Kind::Compute: return std::forward<Visitor>(visitor)(this->computePasses[handle.index]);
                case Kind::Resolve: return std::forward<Visitor>(visitor)(this->resolvePasses[handle.index]);
                case Kind::Copy: return std::forward<Visitor>(visitor)(this->copyPasses[handle.index]);
                case Kind::Move: return std::forward<Visitor>(visitor)(this->movePasses[handle.index]);
                case Kind::Raytrace: return std::forward<Visitor>(visitor)(this->raytracePasses[handle.index]);
                case Kind::Queue: return std::forward<Visitor>(visitor)(this->renderQueues[handle.index]);
                case Kind::Scene: return std::forward<Visitor>(visitor)(this->scenes[handle.index]);
                case Kind::Blit: return std::forward<Visitor>(visitor)(this->blits[handle.index]);
                case Kind::Dispatch: return std::forward<Visitor>(visitor)(this->dispatches[handle.index]);
                case Kind::Clear: return std::forward<Visitor>(visitor)(this->clearViews[handle.index]);
                case Kind::Viewport: return std::forward<Visitor>(visitor)(this->viewports[handle.index]);
            }
            throw std::bad_variant_access{};
        }
    }

    // ReferenceGraph
    std::pair<ownership_descriptor, bool> reference(vertex_descriptor u, vertex_descriptor v) const noexcept {
        if (u != null_vertex() && static_cast<std::uintmax_t>(v) < this->links.size() && get_parent(v) == u) return {{u, v}, true};
        return {{null_vertex(), null_vertex()}, false};
    }
    vertex_descriptor child(ownership_descriptor link) const noexcept { return link.target; }                                   // NOLINT(readability-convert-member-functions-to-static)
    vertex_descriptor get_parent(vertex_descriptor v) const noexcept { return v == null_vertex() ? v : this->links[v].parent; } // NOLINT(readability-identifier-naming)
    vertex_descriptor num_children(vertex_descriptor v) const noexcept { return this->links[v].childCount; }                    // NOLINT(readability-identifier-naming)
    graph::IteratorRange<children_iterator> child_links(vertex_descriptor v) const noexcept {                                   // NOLINT(readability-identifier-naming)
        const auto* rows = links.data();
        return {{rows, rows[v].firstChild}, {rows, null_vertex()}};
    }
    vertex_descriptor parent(ownership_descriptor e) const noexcept { return e.source; }                                                            // NOLINT(readability-convert-member-functions-to-static)
    vertex_descriptor num_parents(vertex_descriptor v) const noexcept { return get_parent(v) != null_vertex(); }                                    // NOLINT(readability-identifier-naming)
    graph::IteratorRange<parent_iterator> parent_links(vertex_descriptor v) const noexcept { return {{{get_parent(v), v}}, {{null_vertex(), v}}}; } // NOLINT(readability-identifier-naming)
    bool has_link(vertex_descriptor u, vertex_descriptor v) const noexcept { return reference(u, v).second; }                                       // NOLINT(readability-identifier-naming)

    // MutableReferenceGraph
    std::pair<ownership_descriptor, bool> add_reference(vertex_descriptor u, vertex_descriptor v) noexcept; // NOLINT(readability-identifier-naming)
    void remove_reference(ownership_descriptor e) noexcept;                                                 // NOLINT(readability-identifier-naming)
    void remove_reference(vertex_descriptor u, vertex_descriptor v) noexcept { remove_reference({u, v}); }  // NOLINT(readability-identifier-naming)

    RenderGraph::vertex_descriptor getPassID(RenderGraph::vertex_descriptor nodeID) const;
    ccstd::string print(boost::container::pmr::memory_resource *scratch) const;

    struct VertexHandle {
        Kind kind;
        vertex_descriptor index;
    };

    ccstd::pmr::vector<VertexHandle> handles;
    ccstd::pmr::vector<ccstd::pmr::vector<vertex_descriptor>> outEdges;
    ccstd::pmr::vector<ccstd::pmr::vector<vertex_descriptor>> inEdges;
    ccstd::pmr::vector<TreeEdge> links;
    ccstd::pmr::vector<ccstd::pmr::string> names;
    ccstd::pmr::vector<ccstd::pmr::string> layoutNodes;
    ccstd::pmr::vector<RenderData> data;
    ccstd::pmr::vector<bool> valid;
    ccstd::pmr::vector<RasterPass> rasterPasses;
    ccstd::pmr::vector<RasterSubpass> rasterSubpasses;
    ccstd::pmr::vector<ComputeSubpass> computeSubpasses;
    ccstd::pmr::vector<ComputePass> computePasses;
    ccstd::pmr::vector<ResolvePass> resolvePasses;
    ccstd::pmr::vector<CopyPass> copyPasses;
    ccstd::pmr::vector<MovePass> movePasses;
    ccstd::pmr::vector<RaytracePass> raytracePasses;
    ccstd::pmr::vector<RenderQueue> renderQueues;
    ccstd::pmr::vector<SceneData> scenes;
    ccstd::pmr::vector<Blit> blits;
    ccstd::pmr::vector<Dispatch> dispatches;
    ccstd::pmr::vector<ccstd::pmr::vector<ClearView>> clearViews;
    ccstd::pmr::vector<gfx::Viewport> viewports;
    PmrUnorderedStringMap<ccstd::pmr::string, uint32_t> index;
    ccstd::pmr::vector<uint32_t> sortedVertices;
    RenderData globalRenderData;
};

template <class Args0, class Args1, class>
SubpassGraph::vertex_descriptor SubpassGraph::add_vertex(std::piecewise_construct_t /*piecewise*/, Args0&& argsName, Args1&& argsSubpass) {
    if (this->names.size() >= (std::numeric_limits<SubpassGraph::vertex_descriptor>::max)()) {
        throw std::length_error("SubpassGraph vertex limit exceeded");
    }
    const auto vertex = static_cast<SubpassGraph::vertex_descriptor>(this->names.size());
    try {
        std::apply(
            [&](auto&&... args) {
                this->names.emplace_back(std::forward<decltype(args)>(args)...);
            },
            std::forward<Args0>(argsName));
        std::apply(
            [&](auto&&... args) {
                this->subpasses.emplace_back(std::forward<decltype(args)>(args)...);
            },
            std::forward<Args1>(argsSubpass));
        this->outEdges.emplace_back();
        this->inEdges.emplace_back();
    } catch (...) {
        if (this->names.size() > vertex) this->names.pop_back();
        if (this->subpasses.size() > vertex) this->subpasses.pop_back();
        if (this->outEdges.size() > vertex) this->outEdges.pop_back();
        if (this->inEdges.size() > vertex) this->inEdges.pop_back();
        throw;
    }
    return vertex;
}

template <class Tag, class PayloadArgs, class Args0, class Args1, class Args2, class Args3, class Args4,
          std::enable_if_t<std::is_same_v<Tag, Managed_> ||
                               std::is_same_v<Tag, ManagedBuffer_> ||
                               std::is_same_v<Tag, ManagedTexture_> ||
                               std::is_same_v<Tag, PersistentBuffer_> ||
                               std::is_same_v<Tag, PersistentTexture_> ||
                               std::is_same_v<Tag, Framebuffer_> ||
                               std::is_same_v<Tag, Swapchain_> ||
                               std::is_same_v<Tag, FormatView_> ||
                               std::is_same_v<Tag, SubresourceView_>,
                           int>,
          class>
ResourceGraph::vertex_descriptor ResourceGraph::add_vertex(const Tag& /*tag*/, std::piecewise_construct_t /*piecewise*/, PayloadArgs&& payloadArgs, Args0&& argsName, Args1&& argsDesc, Args2&& argsTraits, Args3&& argsStates, Args4&& argsSampler, vertex_descriptor parent) {
    if (parent != null_vertex() && static_cast<std::uintmax_t>(parent) >= this->names.size()) {
        throw std::out_of_range("invalid ResourceGraph parent");
    }
    if (this->names.size() >= (std::numeric_limits<ResourceGraph::vertex_descriptor>::max)()) {
        throw std::length_error("ResourceGraph vertex limit exceeded");
    }
    const auto vertex = static_cast<ResourceGraph::vertex_descriptor>(this->names.size());
    auto entry = this->nameIndex_.end();
    auto& edges = this->links;
    try {
        std::apply(
            [&](auto&&... args) {
                this->names.emplace_back(std::forward<decltype(args)>(args)...);
            },
            std::forward<Args0>(argsName));
        const auto inserted = this->nameIndex_.emplace(this->names.back(), vertex);
        if (!inserted.second) throw std::invalid_argument("duplicate vertex name");
        entry = inserted.first;
        std::apply(
            [&](auto&&... args) {
                this->descs.emplace_back(std::forward<decltype(args)>(args)...);
            },
            std::forward<Args1>(argsDesc));
        std::apply(
            [&](auto&&... args) {
                this->traits.emplace_back(std::forward<decltype(args)>(args)...);
            },
            std::forward<Args2>(argsTraits));
        std::apply(
            [&](auto&&... args) {
                this->states.emplace_back(std::forward<decltype(args)>(args)...);
            },
            std::forward<Args3>(argsStates));
        std::apply(
            [&](auto&&... args) {
                this->samplerInfo.emplace_back(std::forward<decltype(args)>(args)...);
            },
            std::forward<Args4>(argsSampler));
        edges.push_back(TreeEdge{parent});
        if constexpr (std::is_same_v<Tag, Managed_>) {
            this->handles.push_back({Kind::Managed, static_cast<ResourceGraph::vertex_descriptor>(this->resources.size())});
            std::apply(
                [&](auto&&... args) {
                    this->resources.emplace_back(std::forward<decltype(args)>(args)...);
                },
                std::forward<PayloadArgs>(payloadArgs));
        } else if constexpr (std::is_same_v<Tag, ManagedBuffer_>) {
            this->handles.push_back({Kind::ManagedBuffer, static_cast<ResourceGraph::vertex_descriptor>(this->managedBuffers.size())});
            std::apply(
                [&](auto&&... args) {
                    this->managedBuffers.emplace_back(std::forward<decltype(args)>(args)...);
                },
                std::forward<PayloadArgs>(payloadArgs));
        } else if constexpr (std::is_same_v<Tag, ManagedTexture_>) {
            this->handles.push_back({Kind::ManagedTexture, static_cast<ResourceGraph::vertex_descriptor>(this->managedTextures.size())});
            std::apply(
                [&](auto&&... args) {
                    this->managedTextures.emplace_back(std::forward<decltype(args)>(args)...);
                },
                std::forward<PayloadArgs>(payloadArgs));
        } else if constexpr (std::is_same_v<Tag, PersistentBuffer_>) {
            this->handles.push_back({Kind::PersistentBuffer, static_cast<ResourceGraph::vertex_descriptor>(this->buffers.size())});
            std::apply(
                [&](auto&&... args) {
                    this->buffers.emplace_back(std::forward<decltype(args)>(args)...);
                },
                std::forward<PayloadArgs>(payloadArgs));
        } else if constexpr (std::is_same_v<Tag, PersistentTexture_>) {
            this->handles.push_back({Kind::PersistentTexture, static_cast<ResourceGraph::vertex_descriptor>(this->textures.size())});
            std::apply(
                [&](auto&&... args) {
                    this->textures.emplace_back(std::forward<decltype(args)>(args)...);
                },
                std::forward<PayloadArgs>(payloadArgs));
        } else if constexpr (std::is_same_v<Tag, Framebuffer_>) {
            this->handles.push_back({Kind::Framebuffer, static_cast<ResourceGraph::vertex_descriptor>(this->framebuffers.size())});
            std::apply(
                [&](auto&&... args) {
                    this->framebuffers.emplace_back(std::forward<decltype(args)>(args)...);
                },
                std::forward<PayloadArgs>(payloadArgs));
        } else if constexpr (std::is_same_v<Tag, Swapchain_>) {
            this->handles.push_back({Kind::Swapchain, static_cast<ResourceGraph::vertex_descriptor>(this->swapchains.size())});
            std::apply(
                [&](auto&&... args) {
                    this->swapchains.emplace_back(std::forward<decltype(args)>(args)...);
                },
                std::forward<PayloadArgs>(payloadArgs));
        } else if constexpr (std::is_same_v<Tag, FormatView_>) {
            this->handles.push_back({Kind::FormatView, static_cast<ResourceGraph::vertex_descriptor>(this->formatViews.size())});
            std::apply(
                [&](auto&&... args) {
                    this->formatViews.emplace_back(std::forward<decltype(args)>(args)...);
                },
                std::forward<PayloadArgs>(payloadArgs));
        } else {
            this->handles.push_back({Kind::SubresourceView, static_cast<ResourceGraph::vertex_descriptor>(this->subresourceViews.size())});
            std::apply(
                [&](auto&&... args) {
                    this->subresourceViews.emplace_back(std::forward<decltype(args)>(args)...);
                },
                std::forward<PayloadArgs>(payloadArgs));
        }
    } catch (...) {
        if (entry != this->nameIndex_.end()) this->nameIndex_.erase(entry);
        if (this->names.size() > vertex) this->names.pop_back();
        if (this->descs.size() > vertex) this->descs.pop_back();
        if (this->traits.size() > vertex) this->traits.pop_back();
        if (this->states.size() > vertex) this->states.pop_back();
        if (this->samplerInfo.size() > vertex) this->samplerInfo.pop_back();
        if (this->links.size() > vertex) this->links.pop_back();
        if (this->handles.size() > vertex) this->handles.pop_back();
        throw;
    }
    if (parent != null_vertex()) {
        auto& parentLinks = edges[parent];
        if (parentLinks.lastChild == null_vertex()) {
            parentLinks.firstChild = vertex;
        } else {
            edges[parentLinks.lastChild].nextSibling = vertex;
        }
        parentLinks.lastChild = vertex;
        ++parentLinks.childCount;
    }
    return vertex;
}

template <class Tag, class PayloadArgs, class Args0, class Args1, class Args2, class Args3,
          std::enable_if_t<std::is_same_v<Tag, RasterPassTag> ||
                               std::is_same_v<Tag, RasterSubpassTag> ||
                               std::is_same_v<Tag, ComputeSubpassTag> ||
                               std::is_same_v<Tag, ComputeTag> ||
                               std::is_same_v<Tag, ResolveTag> ||
                               std::is_same_v<Tag, CopyTag> ||
                               std::is_same_v<Tag, MoveTag> ||
                               std::is_same_v<Tag, RaytraceTag> ||
                               std::is_same_v<Tag, Queue_> ||
                               std::is_same_v<Tag, Scene_> ||
                               std::is_same_v<Tag, Blit_> ||
                               std::is_same_v<Tag, Dispatch_> ||
                               std::is_same_v<Tag, Clear_> ||
                               std::is_same_v<Tag, Viewport_>,
                           int>,
          class>
RenderGraph::vertex_descriptor RenderGraph::add_vertex(const Tag& /*tag*/, std::piecewise_construct_t /*piecewise*/, PayloadArgs&& payloadArgs, Args0&& argsName, Args1&& argsLayout, Args2&& argsData, Args3&& argsValid, vertex_descriptor parent) {
    if (parent != null_vertex() && static_cast<std::uintmax_t>(parent) >= this->names.size()) {
        throw std::out_of_range("invalid RenderGraph parent");
    }
    if (this->names.size() >= (std::numeric_limits<RenderGraph::vertex_descriptor>::max)()) {
        throw std::length_error("RenderGraph vertex limit exceeded");
    }
    const auto vertex = static_cast<RenderGraph::vertex_descriptor>(this->names.size());
    auto& edges = this->links;
    try {
        std::apply(
            [&](auto&&... args) {
                this->names.emplace_back(std::forward<decltype(args)>(args)...);
            },
            std::forward<Args0>(argsName));
        std::apply(
            [&](auto&&... args) {
                this->layoutNodes.emplace_back(std::forward<decltype(args)>(args)...);
            },
            std::forward<Args1>(argsLayout));
        std::apply(
            [&](auto&&... args) {
                this->data.emplace_back(std::forward<decltype(args)>(args)...);
            },
            std::forward<Args2>(argsData));
        std::apply(
            [&](auto&&... args) {
                this->valid.emplace_back(std::forward<decltype(args)>(args)...);
            },
            std::forward<Args3>(argsValid));
        this->outEdges.emplace_back();
        this->inEdges.emplace_back();
        edges.push_back(TreeEdge{parent});
        if constexpr (std::is_same_v<Tag, RasterPassTag>) {
            this->handles.push_back({Kind::RasterPass, static_cast<RenderGraph::vertex_descriptor>(this->rasterPasses.size())});
            std::apply(
                [&](auto&&... args) {
                    this->rasterPasses.emplace_back(std::forward<decltype(args)>(args)...);
                },
                std::forward<PayloadArgs>(payloadArgs));
        } else if constexpr (std::is_same_v<Tag, RasterSubpassTag>) {
            this->handles.push_back({Kind::RasterSubpass, static_cast<RenderGraph::vertex_descriptor>(this->rasterSubpasses.size())});
            std::apply(
                [&](auto&&... args) {
                    this->rasterSubpasses.emplace_back(std::forward<decltype(args)>(args)...);
                },
                std::forward<PayloadArgs>(payloadArgs));
        } else if constexpr (std::is_same_v<Tag, ComputeSubpassTag>) {
            this->handles.push_back({Kind::ComputeSubpass, static_cast<RenderGraph::vertex_descriptor>(this->computeSubpasses.size())});
            std::apply(
                [&](auto&&... args) {
                    this->computeSubpasses.emplace_back(std::forward<decltype(args)>(args)...);
                },
                std::forward<PayloadArgs>(payloadArgs));
        } else if constexpr (std::is_same_v<Tag, ComputeTag>) {
            this->handles.push_back({Kind::Compute, static_cast<RenderGraph::vertex_descriptor>(this->computePasses.size())});
            std::apply(
                [&](auto&&... args) {
                    this->computePasses.emplace_back(std::forward<decltype(args)>(args)...);
                },
                std::forward<PayloadArgs>(payloadArgs));
        } else if constexpr (std::is_same_v<Tag, ResolveTag>) {
            this->handles.push_back({Kind::Resolve, static_cast<RenderGraph::vertex_descriptor>(this->resolvePasses.size())});
            std::apply(
                [&](auto&&... args) {
                    this->resolvePasses.emplace_back(std::forward<decltype(args)>(args)...);
                },
                std::forward<PayloadArgs>(payloadArgs));
        } else if constexpr (std::is_same_v<Tag, CopyTag>) {
            this->handles.push_back({Kind::Copy, static_cast<RenderGraph::vertex_descriptor>(this->copyPasses.size())});
            std::apply(
                [&](auto&&... args) {
                    this->copyPasses.emplace_back(std::forward<decltype(args)>(args)...);
                },
                std::forward<PayloadArgs>(payloadArgs));
        } else if constexpr (std::is_same_v<Tag, MoveTag>) {
            this->handles.push_back({Kind::Move, static_cast<RenderGraph::vertex_descriptor>(this->movePasses.size())});
            std::apply(
                [&](auto&&... args) {
                    this->movePasses.emplace_back(std::forward<decltype(args)>(args)...);
                },
                std::forward<PayloadArgs>(payloadArgs));
        } else if constexpr (std::is_same_v<Tag, RaytraceTag>) {
            this->handles.push_back({Kind::Raytrace, static_cast<RenderGraph::vertex_descriptor>(this->raytracePasses.size())});
            std::apply(
                [&](auto&&... args) {
                    this->raytracePasses.emplace_back(std::forward<decltype(args)>(args)...);
                },
                std::forward<PayloadArgs>(payloadArgs));
        } else if constexpr (std::is_same_v<Tag, Queue_>) {
            this->handles.push_back({Kind::Queue, static_cast<RenderGraph::vertex_descriptor>(this->renderQueues.size())});
            std::apply(
                [&](auto&&... args) {
                    this->renderQueues.emplace_back(std::forward<decltype(args)>(args)...);
                },
                std::forward<PayloadArgs>(payloadArgs));
        } else if constexpr (std::is_same_v<Tag, Scene_>) {
            this->handles.push_back({Kind::Scene, static_cast<RenderGraph::vertex_descriptor>(this->scenes.size())});
            std::apply(
                [&](auto&&... args) {
                    this->scenes.emplace_back(std::forward<decltype(args)>(args)...);
                },
                std::forward<PayloadArgs>(payloadArgs));
        } else if constexpr (std::is_same_v<Tag, Blit_>) {
            this->handles.push_back({Kind::Blit, static_cast<RenderGraph::vertex_descriptor>(this->blits.size())});
            std::apply(
                [&](auto&&... args) {
                    this->blits.emplace_back(std::forward<decltype(args)>(args)...);
                },
                std::forward<PayloadArgs>(payloadArgs));
        } else if constexpr (std::is_same_v<Tag, Dispatch_>) {
            this->handles.push_back({Kind::Dispatch, static_cast<RenderGraph::vertex_descriptor>(this->dispatches.size())});
            std::apply(
                [&](auto&&... args) {
                    this->dispatches.emplace_back(std::forward<decltype(args)>(args)...);
                },
                std::forward<PayloadArgs>(payloadArgs));
        } else if constexpr (std::is_same_v<Tag, Clear_>) {
            this->handles.push_back({Kind::Clear, static_cast<RenderGraph::vertex_descriptor>(this->clearViews.size())});
            std::apply(
                [&](auto&&... args) {
                    this->clearViews.emplace_back(std::forward<decltype(args)>(args)...);
                },
                std::forward<PayloadArgs>(payloadArgs));
        } else {
            this->handles.push_back({Kind::Viewport, static_cast<RenderGraph::vertex_descriptor>(this->viewports.size())});
            std::apply(
                [&](auto&&... args) {
                    this->viewports.emplace_back(std::forward<decltype(args)>(args)...);
                },
                std::forward<PayloadArgs>(payloadArgs));
        }
    } catch (...) {
        if (this->names.size() > vertex) this->names.pop_back();
        if (this->layoutNodes.size() > vertex) this->layoutNodes.pop_back();
        if (this->data.size() > vertex) this->data.pop_back();
        if (this->valid.size() > vertex) this->valid.pop_back();
        if (this->links.size() > vertex) this->links.pop_back();
        if (this->outEdges.size() > vertex) this->outEdges.pop_back();
        if (this->inEdges.size() > vertex) this->inEdges.pop_back();
        if (this->handles.size() > vertex) this->handles.pop_back();
        throw;
    }
    if (parent != null_vertex()) {
        auto& parentLinks = edges[parent];
        if (parentLinks.lastChild == null_vertex()) {
            parentLinks.firstChild = vertex;
        } else {
            edges[parentLinks.lastChild].nextSibling = vertex;
        }
        parentLinks.lastChild = vertex;
        ++parentLinks.childCount;
    }
    return vertex;
}

} // namespace render

} // namespace cc

namespace ccstd {

inline hash_t hash<cc::render::ClearValue>::operator()(const cc::render::ClearValue& val) const noexcept {
    hash_t seed = 0;
    hash_combine(seed, val.x);
    hash_combine(seed, val.y);
    hash_combine(seed, val.z);
    hash_combine(seed, val.w);
    return seed;
}

inline hash_t hash<cc::render::RasterView>::operator()(const cc::render::RasterView& val) const noexcept {
    hash_t seed = 0;
    hash_combine(seed, val.slotName);
    hash_combine(seed, val.slotName1);
    hash_combine(seed, val.accessType);
    hash_combine(seed, val.attachmentType);
    hash_combine(seed, val.loadOp);
    hash_combine(seed, val.storeOp);
    hash_combine(seed, val.clearFlags);
    hash_combine(seed, val.clearColor);
    hash_combine(seed, val.shaderStageFlags);
    return seed;
}

inline hash_t hash<cc::render::ComputeView>::operator()(const cc::render::ComputeView& val) const noexcept {
    hash_t seed = 0;
    hash_combine(seed, val.name);
    hash_combine(seed, val.accessType);
    hash_combine(seed, val.plane);
    hash_combine(seed, val.clearFlags);
    hash_combine(seed, val.clearValueType);
    hash_combine(seed, val.shaderStageFlags);
    return seed;
}

inline hash_t hash<cc::render::Subpass>::operator()(const cc::render::Subpass& val) const noexcept {
    hash_t seed = 0;
    hash_combine(seed, val.rasterViews);
    hash_combine(seed, val.computeViews);
    hash_combine(seed, val.resolvePairs);
    return seed;
}

inline hash_t hash<cc::render::SubpassGraph>::operator()(const cc::render::SubpassGraph& val) const noexcept {
    hash_t seed = 0;
    hash_combine(seed, val.names);
    hash_combine(seed, val.subpasses);
    return seed;
}

inline hash_t hash<cc::render::RasterPass>::operator()(const cc::render::RasterPass& val) const noexcept {
    hash_t seed = 0;
    hash_combine(seed, val.rasterViews);
    hash_combine(seed, val.computeViews);
    hash_combine(seed, val.textures);
    hash_combine(seed, val.subpassGraph);
    hash_combine(seed, val.width);
    hash_combine(seed, val.height);
    hash_combine(seed, val.count);
    hash_combine(seed, val.quality);
    return seed;
}

} // namespace ccstd
