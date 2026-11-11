/****************************************************************************
 Copyright (c) 2021 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated engine source code (the "Software"), a limited,
 worldwide, royalty-free, non-assignable, revocable and non-exclusive license
 to use Cocos Creator solely to develop games on your target platforms. You shall
 not use Cocos Creator software for developing other software or tools that's
 used for developing games. You are not granted to publish, distribute,
 sublicense, and/or sell copies of Cocos Creator.

 The software or tools in this License Agreement are licensed, not sold.
 Xiamen Yaji Software Co., Ltd. reserves all rights not expressly granted to you.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/

//#include "core/Director.h"
#include "core/scene-graph/Node.h"
#include "core/Root.h"
//#include "core/platform/event-manager/Events.h"
//#include "core/scene-graph/SceneGraphModuleHeader.h"
#include "gtest/gtest.h"
#include "renderer/GFXDeviceManager.h"
#include "renderer/gfx-base/GFXDef.h"
#include "utils.h"

using namespace cc;
using namespace cc::event;
using namespace cc::gfx;

namespace {

/*

class MyCallbackTarget {
public:
};

TEST(NodeTest, inverseTransformPoint) {
    initCocos(100, 100);

    auto *director = Director::getInstance();
    auto *scene    = director->getScene();

    auto *parentNode = new Node("");
    auto *subNode    = new Node("");
    parentNode->setPosition(20.F, -30.F, 100.F);
    subNode->setPosition(55, 35, 22);
    parentNode->setParent(scene);
    subNode->setParent(parentNode);
    auto p = Vec3(100.F, 200.F, 0.F);
    subNode->inverseTransformPoint(p, p);

    EXPECT_EQ(p, Vec3(25.F, 195.F, -122.F));

    //xwx FIXME: gfx-validator Assert
    destroyCocos();
}

TEST(NodeTest, activeInHierarchyChanged) {
    // TODO(xwx): need fix Director usage in setActive()
    initCocos(100, 100);
    static CallbackInfoBase::ID id{0};
    static CallbackInfoBase::ID id1{0};
    static CallbackInfoBase::ID id2{0};
    auto *                      director = Director::getInstance();
    auto *                      scene    = director->getScene();
    auto *                      node     = new Node();
    auto                        cb       = [](Node *node) {
        EXPECT_TRUE(node->isActiveInHierarchy());
    };

    node->once(NodeEventType::ACTIVE_IN_HIERARCHY_CHANGED, cb, id);
    scene->addChild(node);
    auto cb1 = [](Node *node) {
        EXPECT_FALSE(node->isActiveInHierarchy());
    };
    node->once(NodeEventType::ACTIVE_IN_HIERARCHY_CHANGED, cb1, id1);
    node->setActive(false);
    node->once(NodeEventType::ACTIVE_IN_HIERARCHY_CHANGED, cb, id);
    node->setActive(true);

    auto *node2 = new Node();
    scene->addChild(node2);
    node2->setActive(false);
    node->once(NodeEventType::ACTIVE_IN_HIERARCHY_CHANGED, cb1, id1);
    node2->addChild(node);

    node->once(NodeEventType::ACTIVE_IN_HIERARCHY_CHANGED, cb, id);
    node->setParent(scene);
    // xwx FIXME: gfx-validator Assert
    destroyCocos();
}

*/

TEST(NodeTest, setWorldScale000_and_rotation) {
    cc::IntrusivePtr<cc::Node> parent(new Node());

    parent->setScale(2, 2, 2);

    cc::IntrusivePtr<cc::Node> son(new Node());
    son->setRotationFromEuler(10, 0, 0);
    son->setParent(parent);
    son->updateWorldTransform();
    EXPECT_TRUE(son->getScale() == Vec3::ONE);
    EXPECT_TRUE(son->getWorldScale().approxEquals(Vec3(2.f, 2.f, 2.f)));
    EXPECT_TRUE(son->getWorldMatrix().approxEquals(Mat4(
        2, 0, 0, 0,
        0, 1.969615506024416, 0.34729635533386066, 0,
        0, -0.34729635533386066, 1.969615506024416, 0,
        0, 0, 0, 1)));

    son->setWorldScale(0, 0, 0);
    EXPECT_TRUE(son->getScale() == Vec3::ZERO);
    EXPECT_TRUE(son->getWorldScale() == Vec3::ZERO);
    EXPECT_TRUE(son->getWorldMatrix().approxEquals(Mat4(
        0, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 1)));

    son->setWorldScale(2, 2, 2);
    EXPECT_TRUE(son->getScale().approxEquals(Vec3::ONE));
    EXPECT_TRUE(son->getWorldScale().approxEquals(Vec3(2.f, 2.f, 2.f)));
    EXPECT_TRUE(son->getWorldMatrix().approxEquals(Mat4(
        2, 0, 0, 0,
        0, 1.969615506024416, 0.34729635533386066, 0,
        0, -0.34729635533386066, 1.969615506024416, 0,
        0, 0, 0, 1)));

    son->setWorldScale(1, 1, 1);
    EXPECT_TRUE(son->getScale().approxEquals(Vec3(0.5f, 0.5f, 0.5f)));
    EXPECT_TRUE(son->getWorldScale().approxEquals(Vec3::ONE));
    EXPECT_TRUE(son->getWorldMatrix().approxEquals(Mat4(
        1, 0, 0, 0,
        0, 0.984807753012208, 0.17364817766693033, 0,
        0, -0.17364817766693033, 0.984807753012208, 0,
        0, 0, 0, 1)));
}

TEST(NodeTest, setWorldScale0yz_and_rotation) {
    cc::IntrusivePtr<cc::Node> parent(new Node());

    parent->setScale(2, 2, 2);

    cc::IntrusivePtr<cc::Node> son(new Node());
    son->setRotationFromEuler(10, 10, 10);
    son->setParent(parent);
    son->updateWorldTransform();
    EXPECT_TRUE(son->getScale().approxEquals(Vec3::ONE));
    EXPECT_TRUE(son->getWorldScale().approxEquals(Vec3(2, 2, 2)));
    EXPECT_TRUE(son->getWorldMatrix().approxEquals(Mat4(
        1.9396926207859084, 0.3472963553338607, -0.3420201433256687, 0,
        -0.2765167096193736, 1.9396926207859084, 0.40141131793955337, 0,
        0.40141131793955337, -0.3420201433256687, 1.9292203542855129, 0,
        0, 0, 0, 1)));

    son->setWorldScale(0, 2, 2);
    EXPECT_TRUE(son->getScale().approxEquals(Vec3(0, 1, 1)));
    EXPECT_TRUE(son->getWorldScale().approxEquals(Vec3(0, 2, 2)));
    EXPECT_TRUE(son->getWorldMatrix().approxEquals(Mat4(
        0, 0, 0, 0,
        -0.2765167096193736, 1.9396926207859084, 0.40141131793955337, 0,
        0.40141131793955337, -0.3420201433256687, 1.9292203542855129, 0,
        0, 0, 0, 1)));

    EXPECT_TRUE(son->getRotation().approxEquals(Quaternion(0.09406091491321403, 0.09406091491321403, 0.07892647901187543, 0.9879654343559627)));
    EXPECT_TRUE(son->getWorldRotation().approxEquals(Quaternion(0, 0, 0, 1))); // Could not decompose rotation in Mat4.toSRT since there is a axis is zero, so the rotation will be reset to unit quaternion.

    son->setRotationFromEuler(20, 20, 20);
    EXPECT_TRUE(son->getRotation().approxEquals(Quaternion(0.1981076317236749, 0.1981076317236749, 0.1387164571097902, 0.9498760324550678)));
    EXPECT_TRUE(son->getWorldRotation().approxEquals(Quaternion(0, 0, 0, 1)));

    son->setRotationFromEuler(10, 10, 10);
    EXPECT_TRUE(son->getRotation().approxEquals(Quaternion(0.09406091491321403, 0.09406091491321403, 0.07892647901187543, 0.9879654343559627)));
    EXPECT_TRUE(son->getWorldRotation().approxEquals(Quaternion(0, 0, 0, 1)));

    son->setWorldScale(1, 1, 1);
    EXPECT_TRUE(son->getScale().approxEquals(Vec3(0.5, 0.5, 0.5)));
    EXPECT_TRUE(son->getWorldScale().approxEquals(Vec3(1, 1, 1)));
    EXPECT_TRUE(son->getWorldMatrix().approxEquals(Mat4(
        0.9698463103929542, 0.17364817766693036, -0.17101007166283436, 0,
        -0.1382583548096868, 0.9698463103929542, 0.20070565896977668, 0,
        0.20070565896977668, -0.17101007166283436, 0.9646101771427564, 0,
        0, 0, 0, 1)));

    EXPECT_TRUE(son->getRotation().approxEquals(Quaternion(0.09406091491321403, 0.09406091491321403, 0.07892647901187543, 0.9879654343559627)));
    EXPECT_TRUE(son->getWorldRotation().approxEquals(Quaternion(0.09406091491321403, 0.09406091491321403, 0.07892647901187543, 0.9879654343559627)));

    son->setWorldScale(2, 0, 0);
    EXPECT_TRUE(son->getScale().approxEquals(Vec3(1, 0, 0)));
    EXPECT_TRUE(son->getWorldScale().approxEquals(Vec3(2, 0, 0)));
    EXPECT_TRUE(son->getWorldMatrix().approxEquals(Mat4(
        1.9396926207859084, 0.3472963553338607, -0.3420201433256687, 0,
        0, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 1)));

    son->setWorldScale(2, 2, 2);
    EXPECT_TRUE(son->getScale().approxEquals(Vec3(1, 1, 1)));
    EXPECT_TRUE(son->getWorldScale().approxEquals(Vec3(2, 2, 2)));
    EXPECT_TRUE(son->getWorldMatrix().approxEquals(Mat4(
        1.9396926207859084, 0.3472963553338607, -0.3420201433256687, 0,
        -0.2765167096193736, 1.9396926207859084, 0.40141131793955337, 0,
        0.40141131793955337, -0.3420201433256687, 1.9292203542855129, 0,
        0, 0, 0, 1)));
}

TEST(NodeTest, setWorldScaleSignedTargetsAreIdempotent) {
    for (int signs = 0; signs < 8; ++signs) {
        cc::IntrusivePtr<cc::Node> parent(new Node());
        cc::IntrusivePtr<cc::Node> child(new Node());
        child->setParent(parent);
        const Vec3 target((signs & 1) ? -2.F : 2.F,
                          (signs & 2) ? -3.F : 3.F,
                          (signs & 4) ? -4.F : 4.F);
        child->setWorldScale(target);
        Mat4 expected;
        Mat4::fromRTS(Quaternion::identity(), Vec3::ZERO, target, &expected);
        EXPECT_TRUE(child->getScale().approxEquals(target));
        EXPECT_TRUE(child->getWorldMatrix().approxEquals(expected));
        child->setWorldScale(target);
        EXPECT_TRUE(child->getScale().approxEquals(target));
        EXPECT_TRUE(child->getWorldMatrix().approxEquals(expected));
    }
}

TEST(NodeTest, setWorldScaleWithSignedParent) {
    for (int signs = 0; signs < 8; ++signs) {
        cc::IntrusivePtr<cc::Node> parent(new Node());
        const float signX = (signs & 1) ? -1.F : 1.F;
        const float signY = (signs & 2) ? -1.F : 1.F;
        const float signZ = (signs & 4) ? -1.F : 1.F;
        parent->setScale(2.F * signX, 3.F * signY, 4.F * signZ);
        cc::IntrusivePtr<cc::Node> child(new Node());
        child->setParent(parent);
        child->setWorldScale(-6.F, 9.F, 8.F);
        const Vec3 expectedLocal(-3.F * signX * signY * signZ, 3.F, 2.F);
        EXPECT_TRUE(child->getScale().approxEquals(expectedLocal));
        EXPECT_TRUE(child->getWorldScale().approxEquals(Vec3(-6.F, 9.F, 8.F)));
        Mat4 expected;
        Mat4::fromRTS(Quaternion::identity(), Vec3::ZERO,
                      Vec3(-6.F * signY * signZ, 9.F * signY, 8.F * signZ), &expected);
        EXPECT_TRUE(child->getWorldMatrix().approxEquals(expected));
        child->setWorldScale(-6.F, 9.F, 8.F);
        EXPECT_TRUE(child->getScale().approxEquals(expectedLocal));
        EXPECT_TRUE(child->getWorldMatrix().approxEquals(expected));

        child->setWorldScale(6.F, 9.F, 8.F);
        EXPECT_TRUE(child->getScale().approxEquals(Vec3(3.F, 3.F, 2.F)));
        EXPECT_TRUE(child->getWorldScale().approxEquals(Vec3(6.F * signX * signY * signZ, 9.F, 8.F)));
        Mat4::fromRTS(Quaternion::identity(), Vec3::ZERO,
                      Vec3(6.F * signX, 9.F * signY, 8.F * signZ), &expected);
        EXPECT_TRUE(child->getWorldMatrix().approxEquals(expected));
    }
}

TEST(NodeTest, setWorldScaleSignsDoNotDependOnPreviousLocalScale) {
    cc::IntrusivePtr<cc::Node> parent(new Node());
    cc::IntrusivePtr<cc::Node> child(new Node());
    child->setParent(parent);
    child->setScale(-1.F, -1.F, -1.F);
    child->getWorldMatrix();
    child->setWorldScale(2.F, -3.F, 4.F);
    EXPECT_TRUE(child->getScale().approxEquals(Vec3(2.F, -3.F, 4.F)));
    const Mat4 firstMatrix = child->getWorldMatrix();
    child->setWorldScale(2.F, -3.F, 4.F);
    EXPECT_TRUE(child->getScale().approxEquals(Vec3(2.F, -3.F, 4.F)));
    EXPECT_TRUE(child->getWorldMatrix().approxEquals(firstMatrix));
    child->setWorldScale(2.F, 3.F, 4.F);
    EXPECT_TRUE(child->getScale().approxEquals(Vec3(2.F, 3.F, 4.F)));
}

TEST(NodeTest, setWorldScaleChangesMirrorAxisWhenWorldScaleMatches) {
    cc::IntrusivePtr<cc::Node> parent(new Node());
    cc::IntrusivePtr<cc::Node> child(new Node());
    child->setParent(parent);
    child->setWorldScale(2.F, -3.F, 4.F);
    EXPECT_TRUE(child->getWorldScale().approxEquals(Vec3(-2.F, 3.F, 4.F)));
    Mat4 expected;
    Mat4::fromRTS(Quaternion::identity(), Vec3::ZERO, Vec3(2.F, -3.F, 4.F), &expected);
    EXPECT_TRUE(child->getWorldMatrix().approxEquals(expected));

    child->setWorldScale(-2.F, 3.F, 4.F);
    EXPECT_TRUE(child->getScale().approxEquals(Vec3(-2.F, 3.F, 4.F)));
    Mat4::fromRTS(Quaternion::identity(), Vec3::ZERO, Vec3(-2.F, 3.F, 4.F), &expected);
    EXPECT_TRUE(child->getWorldMatrix().approxEquals(expected));
    child->setWorldScale(-2.F, 3.F, 4.F);
    EXPECT_TRUE(child->getWorldMatrix().approxEquals(expected));

    child->setScale(2.F, -3.F, -4.F);
    EXPECT_TRUE(child->getWorldScale().approxEquals(Vec3(2.F, 3.F, 4.F)));
    child->setWorldScale(2.F, 3.F, 4.F);
    EXPECT_TRUE(child->getScale().approxEquals(Vec3(2.F, 3.F, 4.F)));
    Mat4::fromRTS(Quaternion::identity(), Vec3::ZERO, Vec3(2.F, 3.F, 4.F), &expected);
    EXPECT_TRUE(child->getWorldMatrix().approxEquals(expected));
}

TEST(NodeTest, setWorldScaleChangesXWithTinyNegativeY) {
    cc::IntrusivePtr<cc::Node> parent(new Node());
    cc::IntrusivePtr<cc::Node> child(new Node());
    child->setParent(parent);
    child->setScale(2.F, -1e-7F, 4.F);
    EXPECT_FLOAT_EQ(child->getWorldMatrix().m[0], 2.F);
    child->setWorldScale(-2.F, -1e-7F, 4.F);
    EXPECT_FLOAT_EQ(child->getWorldMatrix().m[0], -2.F);
}

TEST(NodeTest, setWorldScalePreservesTinyXSignChange) {
    cc::IntrusivePtr<cc::Node> parent(new Node());
    cc::IntrusivePtr<cc::Node> child(new Node());
    child->setParent(parent);
    child->setScale(1e-7F, 1.F, 1.F);
    child->getWorldScale();
    child->setWorldScale(-1e-7F, 1.F, 1.F);
    EXPECT_TRUE(child->getScale().x < 0.F);
    EXPECT_TRUE(child->getWorldScale().x < 0.F);
    EXPECT_TRUE(child->getWorldMatrix().m[0] < 0.F);
    child->setWorldScale(1e-7F, 1.F, 1.F);
    EXPECT_TRUE(child->getScale().x > 0.F);
    EXPECT_TRUE(child->getWorldScale().x > 0.F);
    EXPECT_TRUE(child->getWorldMatrix().m[0] > 0.F);
}

TEST(NodeTest, setWorldScalePreservesLocalRotationWithSignedTargets) {
    cc::IntrusivePtr<cc::Node> parent(new Node());
    parent->setScale(2.F, 2.F, 2.F);
    cc::IntrusivePtr<cc::Node> child(new Node());
    child->setParent(parent);
    child->setRotationFromEuler(10.F, 30.F, 25.F);
    const Quaternion localRotation = child->getRotation();
    child->setScale(-1.F, -1.F, 1.F);
    child->getWorldMatrix();
    child->setWorldScale(-2.F, -3.F, 4.F);
    EXPECT_TRUE(child->getRotation().approxEquals(localRotation));
    Mat4 expected;
    Mat4::fromRTS(localRotation, Vec3::ZERO, Vec3(-2.F, -3.F, 4.F), &expected);
    EXPECT_TRUE(child->getWorldMatrix().approxEquals(expected));
    child->setWorldScale(-2.F, -3.F, 4.F);
    EXPECT_TRUE(child->getRotation().approxEquals(localRotation));
    EXPECT_TRUE(child->getWorldMatrix().approxEquals(expected));
}

TEST(NodeTest, setWorldScaleSignChangeRefreshesWorldRotation) {
    cc::IntrusivePtr<cc::Node> parent(new Node());
    cc::IntrusivePtr<cc::Node> child(new Node());
    child->setParent(parent);
    child->setScale(1.F, -1.F, 1.F);
    const Quaternion before = child->getWorldRotation();
    EXPECT_FALSE(before.approxEquals(Quaternion::identity()));
    child->setWorldScale(-2.F, 3.F, 4.F);
    EXPECT_TRUE(child->getRotation().approxEquals(Quaternion::identity()));
    EXPECT_TRUE(child->getWorldRotation().approxEquals(Quaternion::identity()));
}

} // namespace
