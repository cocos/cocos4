# CocosModuleSplit.cmake
# Splits the Cocos4 engine into logical static libraries by subsystem.
# This makes incremental rebuilds fast and isolates breakage.
#
# Usage: include("${CMAKE_CURRENT_LIST_DIR}/CocosModuleSplit.cmake")
# Place this BEFORE: add_library(${ENGINE_NAME} ${COCOS_SOURCE_LIST})

message(STATUS "Executing extended module split...")

# ── Inject Hermes backend into ccbindings ───────────────────────────────────
if(USE_SE_HERMES)
    target_sources(ccbindings PRIVATE
        ${CWD}/cocos/bindings/jswrapper/hermes/Class.cpp
        ${CWD}/cocos/bindings/jswrapper/hermes/Object.cpp
        ${CWD}/cocos/bindings/jswrapper/hermes/ScriptEngine.cpp
        ${CWD}/cocos/bindings/jswrapper/hermes/Utils.cpp
    )
endif()

# ── Partition sources by directory ─────────────────────────────────────────
set(_ccrenderer_SOURCES)
set(_cc2d3d_SOURCES)
set(_ccscene_SOURCES)
set(_ccphysics_SOURCES)
set(_ccaudio_SOURCES)
set(_ccplatform_SOURCES)
set(_ccapp_SOURCES)
set(_ccmisc_SOURCES)

foreach(_src IN LISTS COCOS_SOURCE_LIST)
    if(_src MATCHES "/cocos/renderer/")
        list(APPEND _ccrenderer_SOURCES "${_src}")
    elseif(_src MATCHES "/cocos/2d/" OR _src MATCHES "/cocos/3d/")
        list(APPEND _cc2d3d_SOURCES "${_src}")
    elseif(_src MATCHES "/cocos/scene/")
        list(APPEND _ccscene_SOURCES "${_src}")
    elseif(_src MATCHES "/cocos/physics/")
        list(APPEND _ccphysics_SOURCES "${_src}")
    elseif(_src MATCHES "/cocos/audio/")
        list(APPEND _ccaudio_SOURCES "${_src}")
    elseif(_src MATCHES "/cocos/platform/")
        list(APPEND _ccplatform_SOURCES "${_src}")
    elseif(_src MATCHES "/cocos/application/" OR _src MATCHES "/cocos/engine/" OR _src MATCHES "/cocos/main/")
        list(APPEND _ccapp_SOURCES "${_src}")
    elseif(_src MATCHES "/cocos/ui/" OR _src MATCHES "/cocos/network/" OR _src MATCHES "/cocos/editor-support/" OR _src MATCHES "/cocos/profiler/" OR _src MATCHES "/cocos/primitive/" OR _src MATCHES "/cocos/plugins/" OR _src MATCHES "/cocos/gi/" OR _src MATCHES "/cocos/storage/" OR _src MATCHES "/cocos/base/" OR _src MATCHES "/cocos/core/")
        list(APPEND _ccmisc_SOURCES "${_src}")
    endif()
endforeach()

# ── Remove split sources from main engine list ──────────────────────────────
if(USE_MODULES)
    list(REMOVE_ITEM COCOS_SOURCE_LIST ${_ccrenderer_SOURCES})
    list(REMOVE_ITEM COCOS_SOURCE_LIST ${_cc2d3d_SOURCES})
    list(REMOVE_ITEM COCOS_SOURCE_LIST ${_ccscene_SOURCES})
    list(REMOVE_ITEM COCOS_SOURCE_LIST ${_ccphysics_SOURCES})
    list(REMOVE_ITEM COCOS_SOURCE_LIST ${_ccaudio_SOURCES})
    list(REMOVE_ITEM COCOS_SOURCE_LIST ${_ccplatform_SOURCES})
    list(REMOVE_ITEM COCOS_SOURCE_LIST ${_ccapp_SOURCES})
    list(REMOVE_ITEM COCOS_SOURCE_LIST ${_ccmisc_SOURCES})
endif()

# ── Create split static libraries ──────────────────────────────────────────
if(USE_MODULES)
    if(_ccrenderer_SOURCES)
        add_library(ccrenderer STATIC ${_ccrenderer_SOURCES})
        target_include_directories(ccrenderer PRIVATE ${CWD} ${CWD}/cocos ${CC_EXTERNAL_INCLUDES} ${CWD}/cocos/bindings/jswrapper
            $<$<BOOL:${USE_SE_HERMES}>:${REACT_NATIVE_JSI_DIR}> ${CWD}/cocos/renderer ${CWD}/cocos/platform ${CWD}/cocos/renderer/core ${CWD}/cocos/editor-support ${SWIG_OUTPUT_ROOT} ${SWIG_OUTPUT_ROOT}/cocos ${CWD}/external/sources/khronos
            $<$<NOT:$<BOOL:${APPLE}>>:${CWD}/external/sources/EGL>)
        target_link_libraries(ccrenderer PUBLIC ccmath cclog ccgeometry ccbindings ccfilesystem)
        if(ANDROID)
            target_link_libraries(ccrenderer PUBLIC android_platform android log)
        endif()
    endif()

    if(_cc2d3d_SOURCES)
        add_library(cc2d3d STATIC ${_cc2d3d_SOURCES})
        target_include_directories(cc2d3d PRIVATE ${CWD} ${CWD}/cocos ${CC_EXTERNAL_INCLUDES} ${CWD}/cocos/bindings/jswrapper
            $<$<BOOL:${USE_SE_HERMES}>:${REACT_NATIVE_JSI_DIR}> ${CWD}/cocos/renderer ${CWD}/cocos/platform ${CWD}/cocos/renderer/core ${CWD}/cocos/editor-support ${SWIG_OUTPUT_ROOT} ${SWIG_OUTPUT_ROOT}/cocos ${CWD}/external/sources/khronos
            $<$<NOT:$<BOOL:${APPLE}>>:${CWD}/external/sources/EGL>)
        target_link_libraries(cc2d3d PUBLIC ccmath cclog ccgeometry ccbindings ccrenderer)
    endif()

    if(_ccscene_SOURCES)
        add_library(ccscene STATIC ${_ccscene_SOURCES})
        target_include_directories(ccscene PRIVATE ${CWD} ${CWD}/cocos ${CC_EXTERNAL_INCLUDES} ${CWD}/cocos/bindings/jswrapper
            $<$<BOOL:${USE_SE_HERMES}>:${REACT_NATIVE_JSI_DIR}> ${CWD}/cocos/renderer ${CWD}/cocos/platform ${CWD}/cocos/renderer/core ${CWD}/cocos/editor-support ${SWIG_OUTPUT_ROOT} ${SWIG_OUTPUT_ROOT}/cocos ${CWD}/external/sources/khronos
            $<$<NOT:$<BOOL:${APPLE}>>:${CWD}/external/sources/EGL>)
        target_link_libraries(ccscene PUBLIC ccmath cclog cc2d3d ccrenderer ccbindings)
    endif()

    if(_ccphysics_SOURCES)
        add_library(ccphysics STATIC ${_ccphysics_SOURCES})
        target_include_directories(ccphysics PRIVATE ${CWD} ${CWD}/cocos ${CC_EXTERNAL_INCLUDES} ${CWD}/cocos/bindings/jswrapper
            $<$<BOOL:${USE_SE_HERMES}>:${REACT_NATIVE_JSI_DIR}> ${CWD}/cocos/renderer ${CWD}/cocos/platform ${CWD}/cocos/renderer/core ${CWD}/cocos/editor-support ${SWIG_OUTPUT_ROOT} ${SWIG_OUTPUT_ROOT}/cocos ${CWD}/external/sources/khronos
            $<$<NOT:$<BOOL:${APPLE}>>:${CWD}/external/sources/EGL>)
        target_link_libraries(ccphysics PUBLIC ccmath cclog ccscene)
    endif()

    if(_ccaudio_SOURCES)
        add_library(ccaudio STATIC ${_ccaudio_SOURCES})
        target_include_directories(ccaudio PRIVATE ${CWD} ${CWD}/cocos ${CC_EXTERNAL_INCLUDES} ${CWD}/cocos/bindings/jswrapper
            $<$<BOOL:${USE_SE_HERMES}>:${REACT_NATIVE_JSI_DIR}> ${CWD}/cocos/renderer ${CWD}/cocos/platform ${CWD}/cocos/renderer/core ${CWD}/cocos/editor-support ${SWIG_OUTPUT_ROOT} ${SWIG_OUTPUT_ROOT}/cocos ${CWD}/external/sources/khronos
            $<$<NOT:$<BOOL:${APPLE}>>:${CWD}/external/sources/EGL>
            ${CWD}/external/sources/pvmp3dec/include ${CWD}/external/sources/pvmp3dec/src)
        target_link_libraries(ccaudio PUBLIC ccmath cclog)
        if(ANDROID)
            target_link_libraries(ccaudio PUBLIC android_platform android log OpenSLES)
        endif()
    endif()

    if(_ccplatform_SOURCES)
        add_library(ccplatform STATIC ${_ccplatform_SOURCES})
        target_include_directories(ccplatform PRIVATE ${CWD} ${CWD}/cocos ${CC_EXTERNAL_INCLUDES} ${CWD}/cocos/bindings/jswrapper
            $<$<BOOL:${USE_SE_HERMES}>:${REACT_NATIVE_JSI_DIR}> ${CWD}/cocos/renderer ${CWD}/cocos/platform ${CWD}/cocos/renderer/core ${CWD}/cocos/editor-support ${SWIG_OUTPUT_ROOT} ${SWIG_OUTPUT_ROOT}/cocos ${CWD}/external/sources/khronos
            $<$<NOT:$<BOOL:${APPLE}>>:${CWD}/external/sources/EGL>)
        target_link_libraries(ccplatform PUBLIC ccmath cclog ccbindings ccfilesystem)
        if(ANDROID)
            target_link_libraries(ccplatform PUBLIC cocos_jni)
        endif()
    endif()

    if(_ccapp_SOURCES)
        add_library(ccapp STATIC ${_ccapp_SOURCES})
        target_include_directories(ccapp PRIVATE ${CWD} ${CWD}/cocos ${CC_EXTERNAL_INCLUDES} ${CWD}/cocos/bindings/jswrapper
            $<$<BOOL:${USE_SE_HERMES}>:${REACT_NATIVE_JSI_DIR}> ${CWD}/cocos/renderer ${CWD}/cocos/platform ${CWD}/cocos/renderer/core ${CWD}/cocos/editor-support ${SWIG_OUTPUT_ROOT} ${SWIG_OUTPUT_ROOT}/cocos ${CWD}/external/sources/khronos
            $<$<NOT:$<BOOL:${APPLE}>>:${CWD}/external/sources/EGL>)
        target_link_libraries(ccapp PUBLIC
            ccmath cclog cc2d3d ccrenderer ccscene ccphysics ccaudio ccplatform ccbindings ccfilesystem
        )
    endif()

    if(_ccmisc_SOURCES)
        add_library(ccmisc STATIC ${_ccmisc_SOURCES})
        target_include_directories(ccmisc PRIVATE ${CWD} ${CWD}/cocos ${CC_EXTERNAL_INCLUDES} ${CWD}/cocos/bindings/jswrapper
            $<$<BOOL:${USE_SE_HERMES}>:${REACT_NATIVE_JSI_DIR}> ${CWD}/cocos/renderer ${CWD}/cocos/platform ${CWD}/cocos/renderer/core ${CWD}/cocos/editor-support ${CWD}/cocos/bindings/jswrapper ${SWIG_OUTPUT_ROOT} ${SWIG_OUTPUT_ROOT}/cocos ${CWD}/external/sources/khronos
            $<$<NOT:$<BOOL:${APPLE}>>:${CWD}/external/sources/EGL>
            ${CWD}/external/android/${ANDROID_ABI}/include/freetype)
        target_link_libraries(ccmisc PUBLIC ccmath cclog ccfilesystem ccbindings freetype)
    endif()
endif()
