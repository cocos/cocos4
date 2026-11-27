#include "engine/FramePacer.h"
#include "gtest/gtest.h"

#include <limits>
#include <vector>

namespace {

using Pacer = cc::FramePacer;
using namespace std::chrono_literals;

class FramePacerTest : public testing::Test {
protected:
    double beginFrame() {
        return pacer.beginFrame([this] { return time; }, [this](Pacer::TimePoint deadline) {
            waits.emplace_back(deadline - time);
            time = deadline + oversleep; });
    }

    Pacer pacer;
    Pacer::TimePoint time{};
    Pacer::Duration oversleep{0};
    std::vector<Pacer::Clock::duration> waits;
};

TEST_F(FramePacerTest, FirstFrameDoesNotWait) {
    time += 10s;
    EXPECT_DOUBLE_EQ(beginFrame(), 0.0);
    EXPECT_TRUE(waits.empty());
}

TEST_F(FramePacerTest, WaitsOnlyForRemainingBudget) {
    beginFrame();
    time += 5ms;
    pacer.endFrame(time);
    EXPECT_EQ(pacer.getTiming().tickWallDuration, 5ms);
    EXPECT_DOUBLE_EQ(beginFrame(), 0.016666666);
    ASSERT_EQ(waits.size(), 1U);
    EXPECT_EQ(waits.back(), 11666666ns);
    EXPECT_EQ(pacer.getTiming().requestedWait, 11666666ns);
    EXPECT_EQ(pacer.getTiming().actualWait, 11666666ns);
}

TEST_F(FramePacerTest, IncludesExternalMessagesAndSwapBlockingInBudget) {
    beginFrame();
    time += 5ms; // Tick work, including any submission blocking.
    pacer.endFrame(time);
    time += 3ms; // AfterTick/platform messages between frames.
    EXPECT_DOUBLE_EQ(beginFrame(), 0.016666666);
    ASSERT_EQ(waits.size(), 1U);
    EXPECT_EQ(waits.back(), 8666666ns);
}

TEST_F(FramePacerTest, OverBudgetFrameDoesNotWaitOrCatchUp) {
    beginFrame();
    time += 50ms;
    EXPECT_DOUBLE_EQ(beginFrame(), 0.05);
    EXPECT_TRUE(waits.empty());
    time += 5ms;
    EXPECT_DOUBLE_EQ(beginFrame(), 0.016666666);
    ASSERT_EQ(waits.size(), 1U);
    EXPECT_EQ(waits.back(), 11666666ns);
}

TEST_F(FramePacerTest, LateWakeupIsMeasuredAndDoesNotShortenNextFrame) {
    beginFrame();
    time += 5ms;
    oversleep = 2ms;
    EXPECT_DOUBLE_EQ(beginFrame(), 0.018666666);
    EXPECT_EQ(pacer.getTiming().requestedWait, 11666666ns);
    EXPECT_EQ(pacer.getTiming().actualWait, 13666666ns);
    time += 5ms;
    oversleep = 0ns;
    EXPECT_DOUBLE_EQ(beginFrame(), 0.016666666);
    EXPECT_EQ(waits.back(), 11666666ns);
}

TEST_F(FramePacerTest, ExactDeadlineDoesNotWait) {
    beginFrame();
    time += pacer.getFrameInterval();
    EXPECT_DOUBLE_EQ(beginFrame(), 0.016666666);
    EXPECT_TRUE(waits.empty());
}

TEST_F(FramePacerTest, ResetDiscardsBackgroundTimeButKeepsFrameRate) {
    ASSERT_TRUE(pacer.setFrameRate(30));
    beginFrame();
    time += 5min;
    pacer.reset(); // Foreground/resume/restart all use the same reset contract.
    EXPECT_DOUBLE_EQ(beginFrame(), 0.0);
    EXPECT_TRUE(waits.empty());
    time += 5ms;
    EXPECT_DOUBLE_EQ(beginFrame(), 0.033333333);
    EXPECT_EQ(waits.back(), 28333333ns);
}

TEST_F(FramePacerTest, LowerFrameRateRebuildsDeadlineWithoutZeroingDt) {
    beginFrame();
    time += 5ms;
    ASSERT_TRUE(pacer.setFrameRate(30));
    EXPECT_DOUBLE_EQ(beginFrame(), 0.033333333);
    EXPECT_EQ(waits.back(), 28333333ns);
}

TEST_F(FramePacerTest, HigherFrameRateDoesNotRetainOldDeadline) {
    ASSERT_TRUE(pacer.setFrameRate(30));
    beginFrame();
    time += 20ms;
    ASSERT_TRUE(pacer.setFrameRate(60));
    EXPECT_DOUBLE_EQ(beginFrame(), 0.02);
    EXPECT_TRUE(waits.empty());
}

TEST_F(FramePacerTest, InvalidFrameRateLeavesDeadlineUnchanged) {
    beginFrame();
    time += 5ms;
    EXPECT_FALSE(pacer.setFrameRate(0));
    EXPECT_FALSE(pacer.setFrameRate(-1));
    EXPECT_FALSE(pacer.setFrameRate(std::numeric_limits<int>::max()));
    EXPECT_DOUBLE_EQ(beginFrame(), 0.016666666);
    EXPECT_EQ(waits.back(), 11666666ns);
}

TEST_F(FramePacerTest, NewInstanceDoesNotInheritTimingState) {
    beginFrame();
    time += 1s;
    Pacer newPacer;
    EXPECT_DOUBLE_EQ(newPacer.beginFrame([this] { return time; }, [](Pacer::TimePoint) { ADD_FAILURE() << "A new engine must not wait for a previous instance"; }), 0.0);
}

TEST_F(FramePacerTest, SameFrameRateDoesNotDriftDeadline) {
    beginFrame();
    time += 5ms;
    ASSERT_TRUE(pacer.setFrameRate(60));
    EXPECT_DOUBLE_EQ(beginFrame(), 0.016666666);
    EXPECT_EQ(waits.back(), 11666666ns);
}

} // namespace
