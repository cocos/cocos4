/****************************************************************************
Copyright (c) 2022 Xiamen Yaji Software Co., Ltd.

http://www.cocos2d-x.org

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

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

#include "cocos/renderer/pipeline/custom/test/test.h"
#include "gfx-base/GFXDef-common.h"
#include "gtest/gtest.h"

#if BRANCH_CULLING
TEST(fgDispatherCulling, test13) {
    // simple graph
    TEST_CASE_4;

    boost::container::pmr::memory_resource* resource = boost::container::pmr::get_default_resource();
    RenderGraph renderGraph(resource);
    ResourceGraph rescGraph(resource);
    LayoutGraphData layoutGraphData(resource);

    fillTestGraph(rasterData, resources, layoutInfo, renderGraph, rescGraph, layoutGraphData);

    FrameGraphDispatcher fgDispatcher(rescGraph, renderGraph, layoutGraphData, resource, resource);
    fgDispatcher.run();

    const auto& rag = fgDispatcher.resourceAccessGraph;
    ASSERT_EQ(rag.num_vertices(), renderGraph.num_vertices() + 2); // Start and present.

    std::vector<RenderGraph::vertex_descriptor> passes;
    for (const auto v : renderGraph.sortedVertices) {
        if (renderGraph.get_parent(v) == RenderGraph::null_vertex()) {
            passes.emplace_back(v);
        }
    }
    ASSERT_EQ(passes.size(), rasterData.size());

    auto expectCulled = [&](RenderGraph::vertex_descriptor pass) {
        SCOPED_TRACE(renderGraph.getName(pass).c_str());
        const auto v = rag.vertex(pass);
        EXPECT_EQ(rag.culledPasses.count(v), 1U);
        EXPECT_TRUE(rag.passResource.at(v).resourceStatus.empty());
        EXPECT_EQ(rag.in_degree(v), 0U);
        EXPECT_EQ(rag.out_degree(v), 0U);
    };
    auto expectRetained = [&](RenderGraph::vertex_descriptor pass, const char* output) {
        SCOPED_TRACE(renderGraph.getName(pass).c_str());
        const auto v = rag.vertex(pass);
        EXPECT_EQ(rag.culledPasses.count(v), 0U);
        EXPECT_EQ(rag.passResource.at(v).resourceStatus.count(output), 1U);
        EXPECT_GT(rag.in_degree(v), 0U);
        EXPECT_GT(rag.out_degree(v), 0U);
    };

    // The transient branch pass5 -> pass6 is culled back to its shared producer.
    expectRetained(passes[3], "3");
    expectRetained(passes[4], "19");
    expectCulled(passes[5]);
    expectCulled(passes[6]);

    // The second subpass of pass7 writes an external resource. Pass8 only reads one.
    ASSERT_EQ(renderGraph.num_children(passes[7]), 2U);
    ASSERT_EQ(renderGraph.num_children(passes[8]), 2U);
    EXPECT_EQ(rag.culledPasses.count(rag.vertex(passes[7])), 0U);
    expectCulled(passes[8]);
    for (const auto e : renderGraph.child_links(passes[7])) {
        const auto child = renderGraph.target(e);
        expectRetained(child, renderGraph.value(RasterSubpass_{}, child).subpassID == 0 ? "7" : "20");
    }
    for (const auto e : renderGraph.child_links(passes[8])) {
        expectCulled(renderGraph.target(e));
    }

    expectRetained(passes[9], "22");
    EXPECT_TRUE(rag.edge(rag.vertex(passes[9]), rag.presentPassID).second);
    EXPECT_EQ(rag.culledPasses.size(), 5U);
    EXPECT_EQ(rag.leafPasses.size(), 6U);
}

TEST(fgDispatherCulling, keepsSiblingSubpassWhenExternalOutputLosesItsConsumer) {
    TEST_CASE_DEFINE;
    const ViewInfo passes{
        {PassType::RASTER, {{{}, {"20"}}, {{}, {"10"}}}},
        {PassType::RASTER, {{{"20"}, {"9"}}}},
    };
    auto* resource = boost::container::pmr::get_default_resource();
    RenderGraph renderGraph(resource);
    ResourceGraph resourceGraph(resource);
    LayoutGraphData layout(resource);
    fillTestGraph(passes, resources, {}, renderGraph, resourceGraph, layout);

    FrameGraphDispatcher dispatcher(resourceGraph, renderGraph, layout, resource, resource);
    dispatcher.run();

    const auto& rag = dispatcher.resourceAccessGraph;
    const auto pass = renderGraph.sortedVertices.front();
    const auto consumer = renderGraph.sortedVertices.back();
    ASSERT_EQ(rag.culledPasses.size(), 1U);
    EXPECT_EQ(rag.culledPasses.count(rag.vertex(consumer)), 1U);
    const auto children = renderGraph.child_links(pass);
    ASSERT_EQ(renderGraph.num_children(pass), 2U);
    const auto writer = renderGraph.target(*children.begin());
    EXPECT_TRUE(rag.edge(rag.vertex(writer), rag.presentPassID).second);
}
#endif
