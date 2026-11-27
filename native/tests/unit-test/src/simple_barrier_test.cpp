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
#include "utils.h"

TEST(barrierTest, test10) {
    // simple graph
    TEST_CASE_1;

    boost::container::pmr::memory_resource* resource = boost::container::pmr::get_default_resource();
    RenderGraph renderGraph(resource);
    ResourceGraph rescGraph(resource);
    LayoutGraphData layoutGraphData(resource);

    fillTestGraph(rasterData, resources, layoutInfo, renderGraph, rescGraph, layoutGraphData);

    FrameGraphDispatcher fgDispatcher(rescGraph, renderGraph, layoutGraphData, resource, resource);
    fgDispatcher.run();

    const auto& barrierMap = fgDispatcher.resourceAccessGraph.barrier;
    const auto& rag = fgDispatcher.resourceAccessGraph;
    ExpectEq(rag.num_vertices() == 6, true);

    // head
    const auto& head = barrierMap.at(0);
    ExpectEq(head.frontBarriers.empty(), true);
    ExpectEq(head.rearBarriers.empty(), true);

    //// 2nd node
    const auto& node4 = barrierMap.at(4);
    ExpectEq(node4.frontBarriers.size(), 0);
    ExpectEq(node4.rearBarriers.size() == 1, true);

    const auto& node4RearBarrier0 = node4.rearBarriers.back();
    ExpectEq(node4RearBarrier0.endStatus.accessFlag == AccessFlagBit::PRESENT, true);

    //runTestGraph(renderGraph, rescGraph, layoutGraphData, fgDispatcher);
}

TEST(frameGraphDispatcher, reordersForkAndJoinWithoutLosingDependencies) {
    TEST_CASE_DEFINE;
    const ViewInfo passes{
        {PassType::RASTER, {{{}, {"19", "20"}}}},
        {PassType::RASTER, {{{}, {"19"}}}},
        {PassType::RASTER, {{{}, {"20"}}}},
        {PassType::RASTER, {{{}, {"19", "20"}}}},
        {PassType::RASTER, {{{}, {}}}},
    };

    for (const float parallelWeight : {0.0F, 1.0F}) {
        SCOPED_TRACE(parallelWeight);
        auto* memory = boost::container::pmr::get_default_resource();
        RenderGraph renderGraph(memory);
        ResourceGraph resourceGraph(memory);
        LayoutGraphData layout(memory);
        fillTestGraph(passes, resources, {}, renderGraph, resourceGraph, layout);
        FrameGraphDispatcher dispatcher(resourceGraph, renderGraph, layout, memory, memory);
        dispatcher.enablePassReorder(true);
        dispatcher.setParalellWeight(parallelWeight);
        dispatcher.run();

        const auto& access = dispatcher.resourceAccessGraph;
        const auto& relation = dispatcher.relationGraph;
        ASSERT_EQ(access.topologicalOrder.size(), relation.num_vertices());
        std::vector<size_t> position(access.num_vertices(), access.num_vertices());
        for (size_t i = 0; i < access.topologicalOrder.size(); ++i) {
            const auto v = access.topologicalOrder[i];
            ASSERT_LT(v, position.size());
            ASSERT_EQ(position[v], access.num_vertices());
            position[v] = i;
        }
        for (const auto edge : access.edges()) {
            EXPECT_LT(position[edge.source], position[edge.target]);
            EXPECT_TRUE(relation.edge(relation.vertex(edge.source), relation.vertex(edge.target)).second);
        }
        const auto pass = [&](size_t i) { return access.vertex(renderGraph.sortedVertices.at(i)); };
        for (const auto branch : {pass(1), pass(2)}) {
            EXPECT_TRUE(access.edge(pass(0), branch).second);
            EXPECT_TRUE(access.edge(branch, pass(3)).second);
        }
        EXPECT_TRUE(access.edge(pass(3), access.presentPassID).second);
        EXPECT_EQ(access.edge(pass(1), pass(2)).second || access.edge(pass(2), pass(1)).second,
                  parallelWeight == 0.0F);
        EXPECT_EQ(access.topologicalOrder.front(), 0U);
        EXPECT_EQ(access.topologicalOrder.back(), access.presentPassID);
    }
}

TEST(frameGraphDispatcher, copyFallbackUsesOneAccessVertexPerMovePass) {
    TEST_CASE_DEFINE;
    auto* memory = boost::container::pmr::get_default_resource();
    RenderGraph passes(memory);
    ResourceGraph resourceGraph(memory);
    LayoutGraphData layout(memory);
    fillTestGraph({}, resources, {}, passes, resourceGraph, layout);
    const auto move = passes.add_vertex(Move_{}, "move");
    passes.sortedVertices.push_back(move);
    auto& pairs = passes.value(Move_{}, move).movePairs;
    // Moving an external source falls back to copying both destinations.
    for (const auto* target : {"0", "1"}) {
        resourceGraph.getDesc(resourceGraph.vertex(target)).mipLevels = 1;
        pairs.emplace_back("19", target, 1U, 1U);
    }
    FrameGraphDispatcher dispatcher(resourceGraph, passes, layout, memory, memory);
    dispatcher.enablePassReorder(true);
    dispatcher.run();

    const auto& access = dispatcher.resourceAccessGraph;
    const auto v = access.vertex(move);
    EXPECT_EQ(access.num_vertices(), 3U); // Start, move, present.
    const auto& status = access.getPassNode(v).resourceStatus;
    EXPECT_EQ(status.at("19").accessFlag, AccessFlagBit::TRANSFER_READ);
    EXPECT_EQ(status.at("0").accessFlag, AccessFlagBit::TRANSFER_WRITE);
    EXPECT_EQ(status.at("1").accessFlag, AccessFlagBit::TRANSFER_WRITE);
    EXPECT_FALSE(access.edge(v, v).second);
}
