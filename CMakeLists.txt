cmake_minimum_required(VERSION 3.10)
project(node_webcodecs)

# C++17 for modern features
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Node-API configuration
add_definitions(-DNAPI_VERSION=8)
add_definitions(-DNAPI_CPP_EXCEPTIONS)

# Find FFmpeg libraries using pkg-config
find_package(PkgConfig REQUIRED)
pkg_check_modules(AVCODEC REQUIRED libavcodec)
pkg_check_modules(AVUTIL REQUIRED libavutil)
pkg_check_modules(SWSCALE REQUIRED libswscale)
pkg_check_modules(SWRESAMPLE REQUIRED libswresample)

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
    ${AVCODEC_INCLUDE_DIRS}
    ${AVUTIL_INCLUDE_DIRS}
    ${SWSCALE_INCLUDE_DIRS}
    ${SWRESAMPLE_INCLUDE_DIRS}
)

# Link libraries
target_link_libraries(${PROJECT_NAME}
    ${CMAKE_JS_LIB}
    ${AVCODEC_LIBRARIES}
    ${AVUTIL_LIBRARIES}
    ${SWSCALE_LIBRARIES}
    ${SWRESAMPLE_LIBRARIES}
)

# Link directories for FFmpeg
target_link_directories(${PROJECT_NAME} PRIVATE
    ${AVCODEC_LIBRARY_DIRS}
    ${AVUTIL_LIBRARY_DIRS}
    ${SWSCALE_LIBRARY_DIRS}
    ${SWRESAMPLE_LIBRARY_DIRS}
)
