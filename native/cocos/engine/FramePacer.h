/****************************************************************************
 Copyright (c) 2026 Xiamen Yaji Software Co., Ltd.

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

#pragma once

#include <chrono>
#include <cstdint>

namespace cc {

// Owned by the game thread. Clock and waiter injection keeps tests independent
// of OS sleep precision. This is a rate limiter, not a display phase lock.
class FramePacer final {
public:
    using Clock = std::chrono::steady_clock;
    using TimePoint = Clock::time_point;
    using Duration = std::chrono::nanoseconds;

    struct Timing {
        double rawDt{0.0};
        Duration requestedWait{0};
        Duration actualWait{0};
        Duration tickWallDuration{0}; // Includes blocking; NOT an ADPF work sample.
    };

    bool setFrameRate(int fps) {
        if (fps <= 0 || fps > NANOSECONDS_PER_SEC) {
            return false;
        }
        _frameInterval = Duration(NANOSECONDS_PER_SEC / fps);
        if (_hasFrameStart) {
            // A rate change preserves elapsed dt and takes effect next frame.
            _nextDeadline = _lastFrameStart + _frameInterval;
        }
        return true;
    }

    void reset() {
        _hasFrameStart = false;
        _lastFrameStart = TimePoint{};
        _nextDeadline = TimePoint{};
        _timing = Timing{};
    }

    template <class Now, class WaitUntil>
    double beginFrame(Now now, WaitUntil waitUntil) {
        _timing = Timing{};
        const auto beforeWait = now();
        if (_hasFrameStart && beforeWait < _nextDeadline) {
            _timing.requestedWait = std::chrono::duration_cast<Duration>(_nextDeadline - beforeWait);
            waitUntil(_nextDeadline);
            _timing.actualWait = std::chrono::duration_cast<Duration>(now() - beforeWait);
        }
        const auto start = now();
        _timing.rawDt = _hasFrameStart
                            ? std::chrono::duration<double>(start - _lastFrameStart).count()
                            : 0.0;
        _lastFrameStart = start;
        _nextDeadline = start + _frameInterval;
        _hasFrameStart = true;
        return _timing.rawDt;
    }

    void endFrame(TimePoint now) {
        _timing.tickWallDuration = std::chrono::duration_cast<Duration>(now - _lastFrameStart);
    }

    const Timing &getTiming() const { return _timing; }
    Duration getFrameInterval() const { return _frameInterval; }

private:
    static constexpr int64_t NANOSECONDS_PER_SEC = 1000000000;
    Duration _frameInterval{NANOSECONDS_PER_SEC / 60};
    TimePoint _lastFrameStart{};
    TimePoint _nextDeadline{};
    Timing _timing{};
    bool _hasFrameStart{false};
};

} // namespace cc
