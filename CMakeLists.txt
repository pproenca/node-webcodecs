cmake_minimum_required(VERSION 3.10)
project(node_webcodecs)

# C++17 for modern features
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Code coverage option
option(ENABLE_COVERAGE "Enable code coverage instrumentation" OFF)

if(ENABLE_COVERAGE)
    if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
        message(STATUS "Code coverage enabled")
        add_compile_options(--coverage -fprofile-arcs -ftest-coverage)
        add_link_options(--coverage)
    endif()
endif()

# Sanitizer options (use one at a time - they don't combine well)
option(ENABLE_ASAN "Enable AddressSanitizer (memory errors)" OFF)
option(ENABLE_UBSAN "Enable UndefinedBehaviorSanitizer" OFF)
option(ENABLE_TSAN "Enable ThreadSanitizer (data races)" OFF)

if(ENABLE_ASAN)
    if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
        message(STATUS "AddressSanitizer enabled")
        add_compile_options(-fsanitize=address -fno-omit-frame-pointer -g)
        add_link_options(-fsanitize=address)
    endif()
endif()

if(ENABLE_UBSAN)
    if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
        message(STATUS "UndefinedBehaviorSanitizer enabled")
        add_compile_options(-fsanitize=undefined -fno-omit-frame-pointer -g)
        add_link_options(-fsanitize=undefined)
    endif()
endif()

if(ENABLE_TSAN)
    if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
        message(STATUS "ThreadSanitizer enabled")
        add_compile_options(-fsanitize=thread -g)
        add_link_options(-fsanitize=thread)
    endif()
endif()

# Node-API configuration
add_definitions(-DNAPI_VERSION=8)
add_definitions(-DNAPI_CPP_EXCEPTIONS)

# Find FFmpeg libraries using pkg-config
find_package(PkgConfig REQUIRED)
pkg_check_modules(AVCODEC REQUIRED libavcodec)
pkg_check_modules(AVFORMAT REQUIRED libavformat)
pkg_check_modules(AVUTIL REQUIRED libavutil)
pkg_check_modules(SWSCALE REQUIRED libswscale)
pkg_check_modules(SWRESAMPLE REQUIRED libswresample)
pkg_check_modules(AVFILTER REQUIRED libavfilter)

# Include cmake-js headers
include_directories(${CMAKE_JS_INC})

# Include node-addon-api headers
execute_process(COMMAND node -p "require('node-addon-api').include"
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    OUTPUT_VARIABLE NODE_ADDON_API_DIR
    OUTPUT_STRIP_TRAILING_WHITESPACE
)
string(REPLACE "\"" "" NODE_ADDON_API_DIR ${NODE_ADDON_API_DIR})
include_directories(${NODE_ADDON_API_DIR})

# Source files
file(GLOB SOURCE_FILES
    "src/*.cc"
    "src/*.h"
)

# Build shared library
add_library(${PROJECT_NAME} SHARED ${SOURCE_FILES} ${CMAKE_JS_SRC})

# Set output name and extension for Node.js
set_target_properties(${PROJECT_NAME} PROPERTIES
    PREFIX ""
    SUFFIX ".node"
)

# Include directories
target_include_directories(${PROJECT_NAME} PRIVATE
    ${CMAKE_SOURCE_DIR}
)

# FFmpeg includes as SYSTEM to suppress warnings from their headers
target_include_directories(${PROJECT_NAME} SYSTEM PRIVATE
    ${AVCODEC_INCLUDE_DIRS}
    ${AVFORMAT_INCLUDE_DIRS}
    ${AVUTIL_INCLUDE_DIRS}
    ${SWSCALE_INCLUDE_DIRS}
    ${SWRESAMPLE_INCLUDE_DIRS}
    ${AVFILTER_INCLUDE_DIRS}
)

# Link libraries
target_link_libraries(${PROJECT_NAME}
    ${CMAKE_JS_LIB}
    ${AVCODEC_LIBRARIES}
    ${AVFORMAT_LIBRARIES}
    ${AVUTIL_LIBRARIES}
    ${SWSCALE_LIBRARIES}
    ${SWRESAMPLE_LIBRARIES}
    ${AVFILTER_LIBRARIES}
)

# Link directories for FFmpeg
target_link_directories(${PROJECT_NAME} PRIVATE
    ${AVCODEC_LIBRARY_DIRS}
    ${AVFORMAT_LIBRARY_DIRS}
    ${AVUTIL_LIBRARY_DIRS}
    ${SWSCALE_LIBRARY_DIRS}
    ${SWRESAMPLE_LIBRARY_DIRS}
    ${AVFILTER_LIBRARY_DIRS}
)

# Strict compiler warnings (treat warnings as errors in CI)
option(ENABLE_WERROR "Treat warnings as errors" OFF)

if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
    target_compile_options(${PROJECT_NAME} PRIVATE
        -Wall
        -Wextra
        -Wpedantic
        -Wshadow
        -Wconversion
        -Wsign-conversion
        -Wnull-dereference
        -Wdouble-promotion
        -Wformat=2
        -Wno-unused-parameter      # Common in NAPI callbacks
        -Wno-missing-field-initializers  # FFmpeg structs
    )
    if(ENABLE_WERROR)
        target_compile_options(${PROJECT_NAME} PRIVATE -Werror)
    endif()
elseif(MSVC)
    target_compile_options(${PROJECT_NAME} PRIVATE
        /W4
        /wd4100  # unreferenced formal parameter
    )
    if(ENABLE_WERROR)
        target_compile_options(${PROJECT_NAME} PRIVATE /WX)
    endif()
endif()

# Native unit tests (optional, requires GTest)
option(BUILD_NATIVE_TESTS "Build native C++ unit tests" OFF)

if(BUILD_NATIVE_TESTS)
    # Try to find GTest
    find_package(GTest QUIET)

    if(GTest_FOUND)
        enable_testing()
        message(STATUS "Building native tests with GTest")

        # Collect test source files (exclude N-API specific code)
        set(TESTABLE_SOURCES
            src/ffmpeg_raii.h
            # Add more testable sources here as they are decoupled from N-API
        )

        # Test executable
        file(GLOB TEST_SOURCES "test/native/*.cc")

        if(TEST_SOURCES)
            add_executable(native_tests ${TEST_SOURCES})

            target_include_directories(native_tests PRIVATE
                ${CMAKE_SOURCE_DIR}
                ${CMAKE_SOURCE_DIR}/src
            )

            target_include_directories(native_tests SYSTEM PRIVATE
                ${AVCODEC_INCLUDE_DIRS}
                ${AVFORMAT_INCLUDE_DIRS}
                ${AVUTIL_INCLUDE_DIRS}
                ${SWSCALE_INCLUDE_DIRS}
                ${SWRESAMPLE_INCLUDE_DIRS}
                ${AVFILTER_INCLUDE_DIRS}
            )

            target_link_libraries(native_tests
                GTest::gtest
                GTest::gtest_main
                ${AVCODEC_LIBRARIES}
                ${AVFORMAT_LIBRARIES}
                ${AVUTIL_LIBRARIES}
                ${SWSCALE_LIBRARIES}
                ${SWRESAMPLE_LIBRARIES}
                ${AVFILTER_LIBRARIES}
            )

            target_link_directories(native_tests PRIVATE
                ${AVCODEC_LIBRARY_DIRS}
                ${AVFORMAT_LIBRARY_DIRS}
                ${AVUTIL_LIBRARY_DIRS}
                ${SWSCALE_LIBRARY_DIRS}
                ${SWRESAMPLE_LIBRARY_DIRS}
                ${AVFILTER_LIBRARY_DIRS}
            )

            # Apply same compiler options
            if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
                target_compile_options(native_tests PRIVATE
                    -Wall -Wextra -Wpedantic
                    -Wno-unused-parameter
                )
            endif()

            # Register tests with CTest
            include(GoogleTest)
            gtest_discover_tests(native_tests)
        endif()
    else()
        message(WARNING "GTest not found. Native tests disabled. Install with: brew install googletest (macOS) or apt-get install libgtest-dev (Linux)")
    endif()
endif()
