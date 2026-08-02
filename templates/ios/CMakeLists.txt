cmake_minimum_required(VERSION 3.8)

set(CMAKE_SYSTEM_NAME iOS)
set(APP_NAME "CocosGame"  CACHE STRING "Project Name")

project(${APP_NAME} CXX)

# Xcode 14.3+ no longer supports running under Rosetta on Apple Silicon,
# so iOS Simulator must use arm64 instead of x86_64.
# See: https://developer.apple.com/documentation/xcode-release-notes/xcode-14_3-release-notes
if(CMAKE_HOST_SYSTEM_PROCESSOR STREQUAL "arm64" AND "${XCODE_VERSION}" VERSION_GREATER_EQUAL "14.3")
    set(CMAKE_OSX_ARCHITECTURES "arm64" CACHE STRING "" FORCE)
else()
    set(CMAKE_OSX_ARCHITECTURES "arm64;x86_64" CACHE STRING "" FORCE)
endif()

set(CC_PROJECT_DIR ${CMAKE_CURRENT_LIST_DIR})
set(CC_UI_RESOURCES)
set(CC_PROJ_SOURCES)
set(CC_ASSET_FILES)
set(CC_COMMON_SOURCES)
set(CC_ALL_SOURCES)

include(${CC_PROJECT_DIR}/../common/CMakeLists.txt)
set(EXECUTABLE_NAME ${APP_NAME}-mobile)

cc_ios_before_target(${EXECUTABLE_NAME})
add_executable(${EXECUTABLE_NAME} ${CC_ALL_SOURCES})
cc_ios_after_target(${EXECUTABLE_NAME})
