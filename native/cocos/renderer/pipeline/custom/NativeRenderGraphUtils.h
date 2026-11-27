#pragma once
#include <string_view>
#include <tuple>
#include <utility>
#include "cocos/renderer/pipeline/custom/LayoutGraphTypes.h"
#include "cocos/renderer/pipeline/custom/RenderGraphTypes.h"
#include "cocos/renderer/pipeline/custom/RenderInterfaceTypes.h"
#include "cocos/renderer/pipeline/custom/details/GslUtils.h"

namespace cc {

namespace render {

template <class Tag, class NameArgs, class LayoutArgs, class DataArgs, class ValidArgs, class PayloadArgs>
RenderGraph::vertex_descriptor
addVertex2(Tag tag, NameArgs &&name, LayoutArgs &&layout, DataArgs &&data, ValidArgs &&valid, PayloadArgs &&payload,
           RenderGraph &g, RenderGraph::vertex_descriptor parent = RenderGraph::null_vertex()) {
    const auto v = g.add_vertex(
        tag, std::piecewise_construct, std::forward<PayloadArgs>(payload),
        std::forward<NameArgs>(name), std::forward<LayoutArgs>(layout),
        std::forward<DataArgs>(data), std::forward<ValidArgs>(valid), parent);
    g.sortedVertices.emplace_back(v);
    CC_EXPECTS(g.sortedVertices.size() == g.num_vertices());
    return v;
}

inline LayoutGraphData::vertex_descriptor getSubpassOrPassID(
    RenderGraph::vertex_descriptor vertID,
    const RenderGraph &rg, const LayoutGraphData &lg) {
    const auto queueID = rg.get_parent(vertID);
    CC_ENSURES(queueID != RenderGraph::null_vertex());
    const auto subpassOrPassID = rg.get_parent(queueID);
    CC_ENSURES(subpassOrPassID != RenderGraph::null_vertex());
    const auto passID = rg.get_parent(subpassOrPassID);

    auto layoutID = LayoutGraphData::null_vertex();
    if (passID == RenderGraph::null_vertex()) { // single render pass
        const auto &layoutName = rg.getLayout(subpassOrPassID);
        CC_ENSURES(!layoutName.empty());
        layoutID = lg.locate(layoutName);
    } else { // render pass
        const auto &passLayoutName = rg.getLayout(passID);
        CC_ENSURES(!passLayoutName.empty());
        const auto passLayoutID = lg.locate(passLayoutName);
        CC_ENSURES(passLayoutID != LayoutGraphData::null_vertex());

        const auto &subpassLayoutName = rg.getLayout(subpassOrPassID);
        if (subpassLayoutName.empty()) {
            layoutID = passLayoutID; // expect to be multisample pass
        } else {
            const auto subpassLayoutID = lg.locate(subpassLayoutName, passLayoutID);
            CC_ENSURES(subpassLayoutID != LayoutGraphData::null_vertex());
            layoutID = subpassLayoutID;
        }
    }
    CC_ENSURES(layoutID != LayoutGraphData::null_vertex());
    return layoutID;
}

inline std::tuple<RenderGraph::vertex_descriptor, LayoutGraphData::vertex_descriptor>
addRenderPassVertex(
    RenderGraph &renderGraph, const LayoutGraphData &layoutGraph,
    uint32_t width, uint32_t height,  // NOLINT(bugprone-easily-swappable-parameters)
    uint32_t count, uint32_t quality, // NOLINT(bugprone-easily-swappable-parameters)
    const ccstd::string &passName) {
    RasterPass pass(renderGraph.get_allocator());
    pass.width = width;
    pass.height = height;
    pass.viewport.width = width;
    pass.viewport.height = height;
    pass.count = count;
    pass.quality = quality;

    auto passID = addVertex2(
        RasterPass_{},
        std::forward_as_tuple(passName),
        std::forward_as_tuple(passName),
        std::forward_as_tuple(),
        std::forward_as_tuple(),
        std::forward_as_tuple(std::move(pass)),
        renderGraph);

    auto passLayoutID = layoutGraph.locate(passName);
    CC_EXPECTS(passLayoutID != LayoutGraphData::null_vertex());

    return {passID, passLayoutID};
}

inline std::tuple<RenderGraph::vertex_descriptor, LayoutGraphData::vertex_descriptor>
addRenderSubpassVertex(
    RasterPass &pass,
    RenderGraph &renderGraph, RenderGraph::vertex_descriptor passID,
    const LayoutGraphData &layoutGraph, LayoutGraphData::vertex_descriptor passLayoutID,
    const ccstd::string &subpassName,
    uint32_t count, uint32_t quality) { // NOLINT(bugprone-easily-swappable-parameters)

    // if subpassName is empty, it must be basic multisample render pass
    CC_EXPECTS(!subpassName.empty() || count > 1);

    auto &subpassGraph = pass.subpassGraph;
    const auto subpassIndex = subpassGraph.num_vertices();
    {
        const auto id = subpassGraph.add_vertex(subpassName);
        CC_ENSURES(id == subpassIndex);
    }

    RasterSubpass subpass(std::allocator_arg, renderGraph.get_allocator(), subpassIndex, count, quality);
    subpass.viewport.width = pass.width;
    subpass.viewport.height = pass.height;

    auto subpassID = addVertex2(
        RasterSubpass_{},
        std::forward_as_tuple(subpassName),
        std::forward_as_tuple(subpassName),
        std::forward_as_tuple(),
        std::forward_as_tuple(),
        std::forward_as_tuple(std::move(subpass)),
        renderGraph, passID);

    auto subpassLayoutID = LayoutGraphData::null_vertex();
    if (subpassName.empty()) { // Basic multisample render pass (single subpass)
        CC_EXPECTS(count > 1);
        subpassLayoutID = passLayoutID;
    } else {
        if constexpr (ENABLE_SUBPASS) {
            subpassLayoutID = layoutGraph.locate(subpassName, passLayoutID);
        } else {
            subpassLayoutID = layoutGraph.locate(subpassName);
        }
    }
    CC_ENSURES(subpassLayoutID != LayoutGraphData::null_vertex());

    return {subpassID, subpassLayoutID};
}

template <class Tag>
void addPassComputeViewImpl(
    Tag tag,
    RenderGraph &renderGraph,
    RenderGraph::vertex_descriptor passID,
    const ccstd::string &name, const ComputeView &view) {
    CC_EXPECTS(!name.empty());
    CC_EXPECTS(!view.name.empty());
    auto &pass = renderGraph.value(tag, passID);
    auto iter = pass.computeViews.find(name.c_str());
    if (iter == pass.computeViews.end()) {
        bool added = false;
        std::tie(iter, added) = pass.computeViews.emplace(
            std::piecewise_construct,
            std::forward_as_tuple(name.c_str()),
            std::forward_as_tuple());
        CC_ENSURES(added);
    }
    iter->second.emplace_back(view);
}

template <class Tag>
void addSubpassComputeViewImpl(
    Tag tag,
    RenderGraph &renderGraph,
    RenderGraph::vertex_descriptor subpassID,
    const ccstd::string &name, const ComputeView &view) {
    CC_EXPECTS(!name.empty());
    CC_EXPECTS(!view.name.empty());
    auto &subpass = renderGraph.value(tag, subpassID);
    const auto passID = renderGraph.get_parent(subpassID);
    CC_EXPECTS(passID != RenderGraph::null_vertex());
    CC_EXPECTS(renderGraph.holds<RasterPass_>(passID));
    auto &pass = renderGraph.value(RasterPass_{}, passID);
    CC_EXPECTS(subpass.subpassID < pass.subpassGraph.num_vertices());
    auto &subpassData = pass.subpassGraph.getSubpass(subpass.subpassID);
    CC_EXPECTS(subpass.computeViews.size() == subpassData.computeViews.size());
    {
        auto iter = subpassData.computeViews.find(name.c_str());
        if (iter == subpassData.computeViews.end()) {
            bool added = false;
            std::tie(iter, added) = subpassData.computeViews.emplace(
                std::piecewise_construct,
                std::forward_as_tuple(name.c_str()),
                std::forward_as_tuple());
            CC_ENSURES(added);
        }
        iter->second.emplace_back(view);
    }
    {
        auto iter = subpass.computeViews.find(name.c_str());
        if (iter == subpass.computeViews.end()) {
            bool added = false;
            std::tie(iter, added) = subpass.computeViews.emplace(
                std::piecewise_construct,
                std::forward_as_tuple(name.c_str()),
                std::forward_as_tuple());
            CC_ENSURES(added);
        }
        iter->second.emplace_back(view);
    }
    CC_ENSURES(subpass.computeViews.size() == subpassData.computeViews.size());
    CC_ENSURES(subpass.computeViews.find(std::string_view{name}) != subpass.computeViews.end());
    CC_ENSURES(subpassData.computeViews.find(std::string_view{name}) != subpassData.computeViews.end());
    CC_ENSURES(subpass.computeViews.find(std::string_view{name})->second.size() ==
               subpassData.computeViews.find(std::string_view{name})->second.size());
}

inline bool defaultAttachment(std::string_view slotName) {
    return slotName.empty() || slotName == "_";
}

static constexpr std::string_view DEPTH_PLANE_NAME = "depth";
static constexpr std::string_view STENCIL_PLANE_NAME = "stencil";
static constexpr std::string_view CUBE_TOP_NAME = "top";
static constexpr std::string_view CUBE_BOTTOM_NAME = "bottom";
static constexpr std::string_view CUBE_FRONT_NAME = "front";
static constexpr std::string_view CUBE_REAR_NAME = "rear";
static constexpr std::string_view CUBE_LEFT_NAME = "left";
static constexpr std::string_view CUBE_RIGHT_NAME = "right";

} // namespace render

} // namespace cc
