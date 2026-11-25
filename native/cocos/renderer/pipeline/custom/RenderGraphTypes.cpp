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
#include "RenderGraphTypes.h"
#include <utility>

namespace cc {

namespace render {

RasterView::RasterView(const allocator_type& alloc)
: slotName(alloc),
  slotName1(alloc),
  clearColor() {} // NOLINT(readability-redundant-member-init)

RasterView::RasterView(const std::allocator_arg_t& /*tag*/, const allocator_type& alloc, ccstd::pmr::string slotNameIn, AccessType accessTypeIn, AttachmentType attachmentTypeIn, gfx::LoadOp loadOpIn, gfx::StoreOp storeOpIn, gfx::ClearFlagBit clearFlagsIn, const gfx::Color& clearColorIn, gfx::ShaderStageFlagBit shaderStageFlagsIn) // NOLINT
: slotName(std::move(slotNameIn), alloc),
  slotName1(alloc),
  accessType(accessTypeIn),
  attachmentType(attachmentTypeIn),
  loadOp(loadOpIn),
  storeOp(storeOpIn),
  clearFlags(clearFlagsIn),
  clearColor(clearColorIn),
  shaderStageFlags(shaderStageFlagsIn) {}

RasterView::RasterView(ccstd::pmr::string slotNameIn, ccstd::pmr::string slotName1In, AccessType accessTypeIn, AttachmentType attachmentTypeIn, gfx::LoadOp loadOpIn, gfx::StoreOp storeOpIn, gfx::ClearFlagBit clearFlagsIn, const gfx::Color& clearColorIn, gfx::ShaderStageFlagBit shaderStageFlagsIn, const allocator_type& alloc) // NOLINT
: slotName(std::move(slotNameIn), alloc),
  slotName1(std::move(slotName1In), alloc),
  accessType(accessTypeIn),
  attachmentType(attachmentTypeIn),
  loadOp(loadOpIn),
  storeOp(storeOpIn),
  clearFlags(clearFlagsIn),
  clearColor(clearColorIn),
  shaderStageFlags(shaderStageFlagsIn) {}

RasterView::RasterView(RasterView&& rhs, const allocator_type& alloc)
: slotName(std::move(rhs.slotName), alloc),
  slotName1(std::move(rhs.slotName1), alloc),
  accessType(rhs.accessType),
  attachmentType(rhs.attachmentType),
  loadOp(rhs.loadOp),
  storeOp(rhs.storeOp),
  clearFlags(rhs.clearFlags),
  clearColor(std::move(rhs.clearColor)),
  slotID(rhs.slotID),
  shaderStageFlags(rhs.shaderStageFlags) {}

RasterView::RasterView(RasterView const& rhs, const allocator_type& alloc)
: slotName(rhs.slotName, alloc),
  slotName1(rhs.slotName1, alloc),
  accessType(rhs.accessType),
  attachmentType(rhs.attachmentType),
  loadOp(rhs.loadOp),
  storeOp(rhs.storeOp),
  clearFlags(rhs.clearFlags),
  clearColor(rhs.clearColor),
  slotID(rhs.slotID),
  shaderStageFlags(rhs.shaderStageFlags) {}

ComputeView::ComputeView(const allocator_type& alloc)
: name(alloc),
  clearValue() {} // NOLINT(readability-redundant-member-init)

ComputeView::ComputeView(const std::allocator_arg_t& /*tag*/, const allocator_type& alloc, ccstd::pmr::string nameIn, AccessType accessTypeIn, gfx::ClearFlagBit clearFlagsIn, ClearValueType clearValueTypeIn, ClearValue clearValueIn, gfx::ShaderStageFlagBit shaderStageFlagsIn) // NOLINT
: name(std::move(nameIn), alloc),
  accessType(accessTypeIn),
  clearFlags(clearFlagsIn),
  clearValueType(clearValueTypeIn),
  clearValue(std::move(clearValueIn)),
  shaderStageFlags(shaderStageFlagsIn) {}

ComputeView::ComputeView(ccstd::pmr::string nameIn, AccessType accessTypeIn, uint32_t planeIn, gfx::ClearFlagBit clearFlagsIn, ClearValueType clearValueTypeIn, ClearValue clearValueIn, gfx::ShaderStageFlagBit shaderStageFlagsIn, const allocator_type& alloc) // NOLINT
: name(std::move(nameIn), alloc),
  accessType(accessTypeIn),
  plane(planeIn),
  clearFlags(clearFlagsIn),
  clearValueType(clearValueTypeIn),
  clearValue(std::move(clearValueIn)),
  shaderStageFlags(shaderStageFlagsIn) {}

ComputeView::ComputeView(ComputeView&& rhs, const allocator_type& alloc)
: name(std::move(rhs.name), alloc),
  accessType(rhs.accessType),
  plane(rhs.plane),
  clearFlags(rhs.clearFlags),
  clearValueType(rhs.clearValueType),
  clearValue(std::move(rhs.clearValue)),
  shaderStageFlags(rhs.shaderStageFlags) {}

ComputeView::ComputeView(ComputeView const& rhs, const allocator_type& alloc)
: name(rhs.name, alloc),
  accessType(rhs.accessType),
  plane(rhs.plane),
  clearFlags(rhs.clearFlags),
  clearValueType(rhs.clearValueType),
  clearValue(rhs.clearValue),
  shaderStageFlags(rhs.shaderStageFlags) {}

Subpass::Subpass(const allocator_type& alloc)
: rasterViews(alloc),
  computeViews(alloc),
  resolvePairs(alloc) {}

Subpass::Subpass(Subpass&& rhs, const allocator_type& alloc)
: rasterViews(std::move(rhs.rasterViews), alloc),
  computeViews(std::move(rhs.computeViews), alloc),
  resolvePairs(std::move(rhs.resolvePairs), alloc) {}

Subpass::Subpass(Subpass const& rhs, const allocator_type& alloc)
: rasterViews(rhs.rasterViews, alloc),
  computeViews(rhs.computeViews, alloc),
  resolvePairs(rhs.resolvePairs, alloc) {}

SubpassGraph::SubpassGraph(const SubpassGraph& rhs, const allocator_type& alloc)
: outEdges(rhs.outEdges, alloc), inEdges(rhs.inEdges, alloc), names(rhs.names, alloc), subpasses(rhs.subpasses, alloc) {}

SubpassGraph::SubpassGraph(SubpassGraph&& rhs, const allocator_type& alloc)
: outEdges(std::move(rhs.outEdges), alloc), inEdges(std::move(rhs.inEdges), alloc), names(std::move(rhs.names), alloc), subpasses(std::move(rhs.subpasses), alloc) {}

SubpassGraph::vertex_descriptor SubpassGraph::add_vertex(std::string_view value) {
    return add_vertex(std::piecewise_construct, std::forward_as_tuple(value), std::tuple<>{});
}

std::pair<SubpassGraph::edge_descriptor, bool> SubpassGraph::add_edge(vertex_descriptor u, vertex_descriptor v) {
    if (u >= outEdges.size() || v >= outEdges.size()) return {{null_vertex(), null_vertex()}, false};
    outEdges[u].push_back(v);
    try {
        inEdges[v].push_back(u);
    } catch (...) {
        outEdges[u].pop_back();
        throw;
    }
    return {{u, v}, true};
}

void SubpassGraph::remove_edge(edge_descriptor e) noexcept {
    if (e.source >= outEdges.size()) return;
    auto& out = outEdges[e.source];
    const auto it = std::find(out.begin(), out.end(), e.target);
    if (it == out.end()) return;
    out.erase(it);
    auto& in = inEdges[e.target];
    in.erase(std::find(in.begin(), in.end(), e.source));
}

void SubpassGraph::remove_edge(vertex_descriptor u, vertex_descriptor v) noexcept {
    if (u >= outEdges.size() || v >= outEdges.size()) return;
    auto& out = outEdges[u];
    out.erase(std::remove(out.begin(), out.end(), v), out.end());
    auto& in = inEdges[v];
    in.erase(std::remove(in.begin(), in.end(), u), in.end());
}

RasterSubpass::RasterSubpass(const allocator_type& alloc)
: rasterViews(alloc),
  computeViews(alloc),
  resolvePairs(alloc),
  viewport() {} // NOLINT(readability-redundant-member-init)

RasterSubpass::RasterSubpass(const std::allocator_arg_t& /*tag*/, const allocator_type& alloc, uint32_t subpassIDIn, uint32_t countIn, uint32_t qualityIn) // NOLINT
: rasterViews(alloc),
  computeViews(alloc),
  resolvePairs(alloc),
  viewport(), // NOLINT(readability-redundant-member-init)
  subpassID(subpassIDIn),
  count(countIn),
  quality(qualityIn) {}

RasterSubpass::RasterSubpass(RasterSubpass&& rhs, const allocator_type& alloc)
: rasterViews(std::move(rhs.rasterViews), alloc),
  computeViews(std::move(rhs.computeViews), alloc),
  resolvePairs(std::move(rhs.resolvePairs), alloc),
  viewport(std::move(rhs.viewport)),
  subpassID(rhs.subpassID),
  count(rhs.count),
  quality(rhs.quality),
  showStatistics(rhs.showStatistics) {}

RasterSubpass::RasterSubpass(RasterSubpass const& rhs, const allocator_type& alloc)
: rasterViews(rhs.rasterViews, alloc),
  computeViews(rhs.computeViews, alloc),
  resolvePairs(rhs.resolvePairs, alloc),
  viewport(rhs.viewport),
  subpassID(rhs.subpassID),
  count(rhs.count),
  quality(rhs.quality),
  showStatistics(rhs.showStatistics) {}

ComputeSubpass::ComputeSubpass(const allocator_type& alloc)
: rasterViews(alloc),
  computeViews(alloc) {}

ComputeSubpass::ComputeSubpass(const std::allocator_arg_t& /*tag*/, const allocator_type& alloc, uint32_t subpassIDIn) // NOLINT
: rasterViews(alloc),
  computeViews(alloc),
  subpassID(subpassIDIn) {}

ComputeSubpass::ComputeSubpass(ComputeSubpass&& rhs, const allocator_type& alloc)
: rasterViews(std::move(rhs.rasterViews), alloc),
  computeViews(std::move(rhs.computeViews), alloc),
  subpassID(rhs.subpassID) {}

ComputeSubpass::ComputeSubpass(ComputeSubpass const& rhs, const allocator_type& alloc)
: rasterViews(rhs.rasterViews, alloc),
  computeViews(rhs.computeViews, alloc),
  subpassID(rhs.subpassID) {}

RasterPass::RasterPass(const allocator_type& alloc)
: rasterViews(alloc),
  computeViews(alloc),
  attachmentIndexMap(alloc),
  textures(alloc),
  subpassGraph(alloc),
  viewport(), // NOLINT(readability-redundant-member-init)
  versionName(alloc) {}

RasterPass::RasterPass(RasterPass&& rhs, const allocator_type& alloc)
: rasterViews(std::move(rhs.rasterViews), alloc),
  computeViews(std::move(rhs.computeViews), alloc),
  attachmentIndexMap(std::move(rhs.attachmentIndexMap), alloc),
  textures(std::move(rhs.textures), alloc),
  subpassGraph(std::move(rhs.subpassGraph), alloc),
  width(rhs.width),
  height(rhs.height),
  count(rhs.count),
  quality(rhs.quality),
  viewport(std::move(rhs.viewport)),
  versionName(std::move(rhs.versionName), alloc),
  version(rhs.version),
  hashValue(rhs.hashValue),
  showStatistics(rhs.showStatistics) {}

RasterPass::RasterPass(RasterPass const& rhs, const allocator_type& alloc)
: rasterViews(rhs.rasterViews, alloc),
  computeViews(rhs.computeViews, alloc),
  attachmentIndexMap(rhs.attachmentIndexMap, alloc),
  textures(rhs.textures, alloc),
  subpassGraph(rhs.subpassGraph, alloc),
  width(rhs.width),
  height(rhs.height),
  count(rhs.count),
  quality(rhs.quality),
  viewport(rhs.viewport),
  versionName(rhs.versionName, alloc),
  version(rhs.version),
  hashValue(rhs.hashValue),
  showStatistics(rhs.showStatistics) {}

PersistentRenderPassAndFramebuffer::PersistentRenderPassAndFramebuffer(const allocator_type& alloc)
: renderPass(), // NOLINT(readability-redundant-member-init)
  framebuffer(), // NOLINT(readability-redundant-member-init)
  clearColors(alloc) {}

PersistentRenderPassAndFramebuffer::PersistentRenderPassAndFramebuffer(const std::allocator_arg_t& /*tag*/, const allocator_type& alloc, IntrusivePtr<gfx::RenderPass> renderPassIn, IntrusivePtr<gfx::Framebuffer> framebufferIn) // NOLINT
: renderPass(std::move(renderPassIn)),
  framebuffer(std::move(framebufferIn)),
  clearColors(alloc) {}

PersistentRenderPassAndFramebuffer::PersistentRenderPassAndFramebuffer(PersistentRenderPassAndFramebuffer&& rhs, const allocator_type& alloc)
: renderPass(std::move(rhs.renderPass)),
  framebuffer(std::move(rhs.framebuffer)),
  clearColors(std::move(rhs.clearColors), alloc),
  clearDepth(rhs.clearDepth),
  clearStencil(rhs.clearStencil) {}

PersistentRenderPassAndFramebuffer::PersistentRenderPassAndFramebuffer(PersistentRenderPassAndFramebuffer const& rhs, const allocator_type& alloc)
: renderPass(rhs.renderPass),
  framebuffer(rhs.framebuffer),
  clearColors(rhs.clearColors, alloc),
  clearDepth(rhs.clearDepth),
  clearStencil(rhs.clearStencil) {}

ResourceGraph::vertex_descriptor ResourceGraph::add_vertex(const Managed_& tag, std::string_view value, vertex_descriptor parent) {
    return add_vertex(tag, std::piecewise_construct, std::tuple<>{}, std::forward_as_tuple(value), std::tuple<>{}, std::tuple<>{}, std::tuple<>{}, std::tuple<>{}, parent);
}

ResourceGraph::vertex_descriptor ResourceGraph::add_vertex(const ManagedBuffer_& tag, std::string_view value, vertex_descriptor parent) {
    return add_vertex(tag, std::piecewise_construct, std::tuple<>{}, std::forward_as_tuple(value), std::tuple<>{}, std::tuple<>{}, std::tuple<>{}, std::tuple<>{}, parent);
}

ResourceGraph::vertex_descriptor ResourceGraph::add_vertex(const ManagedTexture_& tag, std::string_view value, vertex_descriptor parent) {
    return add_vertex(tag, std::piecewise_construct, std::tuple<>{}, std::forward_as_tuple(value), std::tuple<>{}, std::tuple<>{}, std::tuple<>{}, std::tuple<>{}, parent);
}

ResourceGraph::vertex_descriptor ResourceGraph::add_vertex(const PersistentBuffer_& tag, std::string_view value, vertex_descriptor parent) {
    return add_vertex(tag, std::piecewise_construct, std::tuple<>{}, std::forward_as_tuple(value), std::tuple<>{}, std::tuple<>{}, std::tuple<>{}, std::tuple<>{}, parent);
}

ResourceGraph::vertex_descriptor ResourceGraph::add_vertex(const PersistentTexture_& tag, std::string_view value, vertex_descriptor parent) {
    return add_vertex(tag, std::piecewise_construct, std::tuple<>{}, std::forward_as_tuple(value), std::tuple<>{}, std::tuple<>{}, std::tuple<>{}, std::tuple<>{}, parent);
}

ResourceGraph::vertex_descriptor ResourceGraph::add_vertex(const Framebuffer_& tag, std::string_view value, vertex_descriptor parent) {
    return add_vertex(tag, std::piecewise_construct, std::tuple<>{}, std::forward_as_tuple(value), std::tuple<>{}, std::tuple<>{}, std::tuple<>{}, std::tuple<>{}, parent);
}

ResourceGraph::vertex_descriptor ResourceGraph::add_vertex(const Swapchain_& tag, std::string_view value, vertex_descriptor parent) {
    return add_vertex(tag, std::piecewise_construct, std::tuple<>{}, std::forward_as_tuple(value), std::tuple<>{}, std::tuple<>{}, std::tuple<>{}, std::tuple<>{}, parent);
}

ResourceGraph::vertex_descriptor ResourceGraph::add_vertex(const FormatView_& tag, std::string_view value, vertex_descriptor parent) {
    return add_vertex(tag, std::piecewise_construct, std::tuple<>{}, std::forward_as_tuple(value), std::tuple<>{}, std::tuple<>{}, std::tuple<>{}, std::tuple<>{}, parent);
}

ResourceGraph::vertex_descriptor ResourceGraph::add_vertex(const SubresourceView_& tag, std::string_view value, vertex_descriptor parent) {
    return add_vertex(tag, std::piecewise_construct, std::tuple<>{}, std::forward_as_tuple(value), std::tuple<>{}, std::tuple<>{}, std::tuple<>{}, std::tuple<>{}, parent);
}

std::pair<ResourceGraph::edge_descriptor, bool> ResourceGraph::add_edge(vertex_descriptor u, vertex_descriptor v) noexcept {
    if (static_cast<std::uintmax_t>(u) >= links.size() || static_cast<std::uintmax_t>(v) >= links.size() ||
        links[v].parent != null_vertex()) return {{null_vertex(), null_vertex()}, false};
    for (auto p = u; p != null_vertex(); p = links[p].parent)
        if (p == v) return {{null_vertex(), null_vertex()}, false};
    auto& parent = links[u];
    auto& child = links[v];
    auto* slot = &parent.firstChild;
    while (*slot != null_vertex() && *slot < v) slot = &links[*slot].nextSibling;
    child.nextSibling = *slot;
    if (*slot == null_vertex()) parent.lastChild = v;
    *slot = v;
    child.parent = u;
    ++parent.childCount;
    return {{u, v}, true};
}

void ResourceGraph::remove_edge(edge_descriptor e) noexcept {
    if (!edge(e.source, e.target).second) return;
    auto& parent = links[e.source];
    auto& child = links[e.target];
    auto previous = null_vertex();
    auto* slot = &parent.firstChild;
    while (*slot != e.target) {
        previous = *slot;
        slot = &links[previous].nextSibling;
    }
    *slot = child.nextSibling;
    if (parent.lastChild == e.target) parent.lastChild = previous;
    child.parent = child.nextSibling = null_vertex();
    --parent.childCount;
}

void ResourceGraph::setName(vertex_descriptor v, std::string_view value) {
    auto& current = this->names.at(v);
    if (std::string_view{current} == value) return;
    ccstd::pmr::string replacement(value, current.get_allocator());
    const auto old = this->nameIndex_.find(std::string_view{current});
    if (!this->nameIndex_.emplace(value, v).second) throw std::invalid_argument("duplicate vertex name");
    current.swap(replacement);
    this->nameIndex_.erase(old);
}

ComputePass::ComputePass(const allocator_type& alloc)
: computeViews(alloc),
  textures(alloc) {}

ComputePass::ComputePass(ComputePass&& rhs, const allocator_type& alloc)
: computeViews(std::move(rhs.computeViews), alloc),
  textures(std::move(rhs.textures), alloc) {}

ComputePass::ComputePass(ComputePass const& rhs, const allocator_type& alloc)
: computeViews(rhs.computeViews, alloc),
  textures(rhs.textures, alloc) {}

ResolvePass::ResolvePass(const allocator_type& alloc)
: resolvePairs(alloc) {}

ResolvePass::ResolvePass(ResolvePass&& rhs, const allocator_type& alloc)
: resolvePairs(std::move(rhs.resolvePairs), alloc) {}

ResolvePass::ResolvePass(ResolvePass const& rhs, const allocator_type& alloc)
: resolvePairs(rhs.resolvePairs, alloc) {}

CopyPass::CopyPass(const allocator_type& alloc)
: copyPairs(alloc),
  uploadPairs(alloc) {}

CopyPass::CopyPass(CopyPass&& rhs, const allocator_type& alloc)
: copyPairs(std::move(rhs.copyPairs), alloc),
  uploadPairs(std::move(rhs.uploadPairs), alloc) {}

MovePass::MovePass(const allocator_type& alloc)
: movePairs(alloc) {}

MovePass::MovePass(MovePass&& rhs, const allocator_type& alloc)
: movePairs(std::move(rhs.movePairs), alloc) {}

MovePass::MovePass(MovePass const& rhs, const allocator_type& alloc)
: movePairs(rhs.movePairs, alloc) {}

RaytracePass::RaytracePass(const allocator_type& alloc)
: computeViews(alloc) {}

RaytracePass::RaytracePass(RaytracePass&& rhs, const allocator_type& alloc)
: computeViews(std::move(rhs.computeViews), alloc) {}

RaytracePass::RaytracePass(RaytracePass const& rhs, const allocator_type& alloc)
: computeViews(rhs.computeViews, alloc) {}

ClearView::ClearView(const allocator_type& alloc)
: slotName(alloc),
  clearColor() {} // NOLINT(readability-redundant-member-init)

ClearView::ClearView(const std::allocator_arg_t& /*tag*/, const allocator_type& alloc, ccstd::pmr::string slotNameIn, gfx::ClearFlagBit clearFlagsIn, const gfx::Color& clearColorIn) // NOLINT
: slotName(std::move(slotNameIn), alloc),
  clearFlags(clearFlagsIn),
  clearColor(clearColorIn) {}

ClearView::ClearView(ClearView&& rhs, const allocator_type& alloc)
: slotName(std::move(rhs.slotName), alloc),
  clearFlags(rhs.clearFlags),
  clearColor(std::move(rhs.clearColor)) {}

ClearView::ClearView(ClearView const& rhs, const allocator_type& alloc)
: slotName(rhs.slotName, alloc),
  clearFlags(rhs.clearFlags),
  clearColor(rhs.clearColor) {}

Blit::Blit(const allocator_type& alloc)
: material(), // NOLINT(readability-redundant-member-init)
  models(alloc) {}

Blit::Blit(const std::allocator_arg_t& /*tag*/, const allocator_type& alloc, IntrusivePtr<Material> materialIn, uint32_t passIDIn, SceneFlags sceneFlagsIn, const scene::Camera* cameraIn, BlitType blitTypeIn) // NOLINT
: material(std::move(materialIn)),
  passID(passIDIn),
  sceneFlags(sceneFlagsIn),
  camera(cameraIn),
  blitType(blitTypeIn),
  models(alloc) {}

Blit::Blit(const scene::Camera* cameraIn, BlitType blitTypeIn, ccstd::pmr::vector<IntrusivePtr<scene::Model>> modelsIn, const allocator_type& alloc) // NOLINT
: material(), // NOLINT(readability-redundant-member-init)
  camera(cameraIn),
  blitType(blitTypeIn),
  models(std::move(modelsIn), alloc) {}

Blit::Blit(Blit&& rhs, const allocator_type& alloc)
: material(std::move(rhs.material)),
  passID(rhs.passID),
  sceneFlags(rhs.sceneFlags),
  camera(rhs.camera),
  blitType(rhs.blitType),
  models(std::move(rhs.models), alloc) {}

Blit::Blit(Blit const& rhs, const allocator_type& alloc)
: material(rhs.material),
  passID(rhs.passID),
  sceneFlags(rhs.sceneFlags),
  camera(rhs.camera),
  blitType(rhs.blitType),
  models(rhs.models, alloc) {}

RenderData::RenderData(const allocator_type& alloc)
: constants(alloc),
  buffers(alloc),
  textures(alloc),
  samplers(alloc),
  custom(alloc) {}

RenderData::RenderData(RenderData&& rhs, const allocator_type& alloc)
: constants(std::move(rhs.constants), alloc),
  buffers(std::move(rhs.buffers), alloc),
  textures(std::move(rhs.textures), alloc),
  samplers(std::move(rhs.samplers), alloc),
  custom(std::move(rhs.custom), alloc) {}

RenderGraph::RenderGraph(RenderGraph&& rhs, const allocator_type& alloc)
: handles(std::move(rhs.handles), alloc), outEdges(std::move(rhs.outEdges), alloc), inEdges(std::move(rhs.inEdges), alloc), links(std::move(rhs.links), alloc), names(std::move(rhs.names), alloc), layoutNodes(std::move(rhs.layoutNodes), alloc), data(std::move(rhs.data), alloc), valid(std::move(rhs.valid), alloc), rasterPasses(std::move(rhs.rasterPasses), alloc), rasterSubpasses(std::move(rhs.rasterSubpasses), alloc), computeSubpasses(std::move(rhs.computeSubpasses), alloc), computePasses(std::move(rhs.computePasses), alloc), resolvePasses(std::move(rhs.resolvePasses), alloc), copyPasses(std::move(rhs.copyPasses), alloc), movePasses(std::move(rhs.movePasses), alloc), raytracePasses(std::move(rhs.raytracePasses), alloc), renderQueues(std::move(rhs.renderQueues), alloc), scenes(std::move(rhs.scenes), alloc), blits(std::move(rhs.blits), alloc), dispatches(std::move(rhs.dispatches), alloc), clearViews(std::move(rhs.clearViews), alloc), viewports(std::move(rhs.viewports), alloc), index(std::move(rhs.index), alloc), sortedVertices(std::move(rhs.sortedVertices), alloc), globalRenderData(std::move(rhs.globalRenderData), alloc) {}

RenderGraph::vertex_descriptor RenderGraph::add_vertex(const RasterPassTag& tag, std::string_view value, vertex_descriptor parent) {
    return add_vertex(tag, std::piecewise_construct, std::tuple<>{}, std::forward_as_tuple(value), std::tuple<>{}, std::tuple<>{}, std::tuple<>{}, parent);
}

RenderGraph::vertex_descriptor RenderGraph::add_vertex(const RasterSubpassTag& tag, std::string_view value, vertex_descriptor parent) {
    return add_vertex(tag, std::piecewise_construct, std::tuple<>{}, std::forward_as_tuple(value), std::tuple<>{}, std::tuple<>{}, std::tuple<>{}, parent);
}

RenderGraph::vertex_descriptor RenderGraph::add_vertex(const ComputeSubpassTag& tag, std::string_view value, vertex_descriptor parent) {
    return add_vertex(tag, std::piecewise_construct, std::tuple<>{}, std::forward_as_tuple(value), std::tuple<>{}, std::tuple<>{}, std::tuple<>{}, parent);
}

RenderGraph::vertex_descriptor RenderGraph::add_vertex(const ComputeTag& tag, std::string_view value, vertex_descriptor parent) {
    return add_vertex(tag, std::piecewise_construct, std::tuple<>{}, std::forward_as_tuple(value), std::tuple<>{}, std::tuple<>{}, std::tuple<>{}, parent);
}

RenderGraph::vertex_descriptor RenderGraph::add_vertex(const ResolveTag& tag, std::string_view value, vertex_descriptor parent) {
    return add_vertex(tag, std::piecewise_construct, std::tuple<>{}, std::forward_as_tuple(value), std::tuple<>{}, std::tuple<>{}, std::tuple<>{}, parent);
}

RenderGraph::vertex_descriptor RenderGraph::add_vertex(const CopyTag& tag, std::string_view value, vertex_descriptor parent) {
    return add_vertex(tag, std::piecewise_construct, std::tuple<>{}, std::forward_as_tuple(value), std::tuple<>{}, std::tuple<>{}, std::tuple<>{}, parent);
}

RenderGraph::vertex_descriptor RenderGraph::add_vertex(const MoveTag& tag, std::string_view value, vertex_descriptor parent) {
    return add_vertex(tag, std::piecewise_construct, std::tuple<>{}, std::forward_as_tuple(value), std::tuple<>{}, std::tuple<>{}, std::tuple<>{}, parent);
}

RenderGraph::vertex_descriptor RenderGraph::add_vertex(const RaytraceTag& tag, std::string_view value, vertex_descriptor parent) {
    return add_vertex(tag, std::piecewise_construct, std::tuple<>{}, std::forward_as_tuple(value), std::tuple<>{}, std::tuple<>{}, std::tuple<>{}, parent);
}

RenderGraph::vertex_descriptor RenderGraph::add_vertex(const Queue_& tag, std::string_view value, vertex_descriptor parent) {
    return add_vertex(tag, std::piecewise_construct, std::tuple<>{}, std::forward_as_tuple(value), std::tuple<>{}, std::tuple<>{}, std::tuple<>{}, parent);
}

RenderGraph::vertex_descriptor RenderGraph::add_vertex(const Scene_& tag, std::string_view value, vertex_descriptor parent) {
    return add_vertex(tag, std::piecewise_construct, std::tuple<>{}, std::forward_as_tuple(value), std::tuple<>{}, std::tuple<>{}, std::tuple<>{}, parent);
}

RenderGraph::vertex_descriptor RenderGraph::add_vertex(const Blit_& tag, std::string_view value, vertex_descriptor parent) {
    return add_vertex(tag, std::piecewise_construct, std::tuple<>{}, std::forward_as_tuple(value), std::tuple<>{}, std::tuple<>{}, std::tuple<>{}, parent);
}

RenderGraph::vertex_descriptor RenderGraph::add_vertex(const Dispatch_& tag, std::string_view value, vertex_descriptor parent) {
    return add_vertex(tag, std::piecewise_construct, std::tuple<>{}, std::forward_as_tuple(value), std::tuple<>{}, std::tuple<>{}, std::tuple<>{}, parent);
}

RenderGraph::vertex_descriptor RenderGraph::add_vertex(const Clear_& tag, std::string_view value, vertex_descriptor parent) {
    return add_vertex(tag, std::piecewise_construct, std::tuple<>{}, std::forward_as_tuple(value), std::tuple<>{}, std::tuple<>{}, std::tuple<>{}, parent);
}

RenderGraph::vertex_descriptor RenderGraph::add_vertex(const Viewport_& tag, std::string_view value, vertex_descriptor parent) {
    return add_vertex(tag, std::piecewise_construct, std::tuple<>{}, std::forward_as_tuple(value), std::tuple<>{}, std::tuple<>{}, std::tuple<>{}, parent);
}

std::pair<RenderGraph::edge_descriptor, bool> RenderGraph::add_edge(vertex_descriptor u, vertex_descriptor v) {
    if (u >= outEdges.size() || v >= outEdges.size()) return {{null_vertex(), null_vertex()}, false};
    outEdges[u].push_back(v);
    try {
        inEdges[v].push_back(u);
    } catch (...) {
        outEdges[u].pop_back();
        throw;
    }
    return {{u, v}, true};
}

void RenderGraph::remove_edge(edge_descriptor e) noexcept {
    if (e.source >= outEdges.size()) return;
    auto& out = outEdges[e.source];
    const auto it = std::find(out.begin(), out.end(), e.target);
    if (it == out.end()) return;
    out.erase(it);
    auto& in = inEdges[e.target];
    in.erase(std::find(in.begin(), in.end(), e.source));
}

void RenderGraph::remove_edge(vertex_descriptor u, vertex_descriptor v) noexcept {
    if (u >= outEdges.size() || v >= outEdges.size()) return;
    auto& out = outEdges[u];
    out.erase(std::remove(out.begin(), out.end(), v), out.end());
    auto& in = inEdges[v];
    in.erase(std::remove(in.begin(), in.end(), u), in.end());
}

std::pair<RenderGraph::ownership_descriptor, bool> RenderGraph::add_reference(vertex_descriptor u, vertex_descriptor v) noexcept {
    if (static_cast<std::uintmax_t>(u) >= links.size() || static_cast<std::uintmax_t>(v) >= links.size() ||
        links[v].parent != null_vertex()) return {{null_vertex(), null_vertex()}, false};
    for (auto p = u; p != null_vertex(); p = links[p].parent)
        if (p == v) return {{null_vertex(), null_vertex()}, false};
    auto& parent = links[u];
    auto& child = links[v];
    auto* slot = &parent.firstChild;
    while (*slot != null_vertex() && *slot < v) slot = &links[*slot].nextSibling;
    child.nextSibling = *slot;
    if (*slot == null_vertex()) parent.lastChild = v;
    *slot = v;
    child.parent = u;
    ++parent.childCount;
    return {{u, v}, true};
}

void RenderGraph::remove_reference(ownership_descriptor e) noexcept {
    if (!reference(e.source, e.target).second) return;
    auto& parent = links[e.source];
    auto& child = links[e.target];
    auto previous = null_vertex();
    auto* slot = &parent.firstChild;
    while (*slot != e.target) {
        previous = *slot;
        slot = &links[previous].nextSibling;
    }
    *slot = child.nextSibling;
    if (parent.lastChild == e.target) parent.lastChild = previous;
    child.parent = child.nextSibling = null_vertex();
    --parent.childCount;
}

} // namespace render

} // namespace cc
