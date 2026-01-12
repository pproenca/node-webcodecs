# CMake Patterns Reference

## Table of Contents
1. [Modern Library Pattern](#modern-library-pattern)
2. [Executable Pattern](#executable-pattern)
3. [Interface Libraries](#interface-libraries)
4. [Export and Install](#export-and-install)
5. [FetchContent Patterns](#fetchcontent-patterns)
6. [Presets](#presets)
7. [Toolchain Files](#toolchain-files)
8. [Testing Integration](#testing-integration)

---

## Modern Library Pattern

Complete pattern for a reusable library:

```cmake
cmake_minimum_required(VERSION 3.23)
project(MyLib VERSION 1.0.0 LANGUAGES CXX)

# Options for this project
option(MYLIB_BUILD_TESTS "Build tests" OFF)
option(MYLIB_BUILD_EXAMPLES "Build examples" OFF)

# Create library target
add_library(mylib)
add_library(MyLib::mylib ALIAS mylib)

# Sources (list explicitly, never glob)
target_sources(mylib
    PRIVATE
        src/mylib.cpp
        src/internal.cpp
    PUBLIC
        FILE_SET public_headers
        TYPE HEADERS
        BASE_DIRS include
        FILES
            include/mylib/mylib.hpp
            include/mylib/types.hpp
)

# Language standard via features
target_compile_features(mylib PUBLIC cxx_std_17)

# Include directories with generator expressions
target_include_directories(mylib
    PUBLIC
        $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
        $<INSTALL_INTERFACE:${CMAKE_INSTALL_INCLUDEDIR}>
    PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}/src
)

# Dependencies
find_package(fmt 9.0 REQUIRED)
target_link_libraries(mylib
    PUBLIC
        fmt::fmt  # Public because it's in our headers
)

# Compile options (warnings are PRIVATE)
target_compile_options(mylib
    PRIVATE
        $<$<CXX_COMPILER_ID:GNU,Clang>:-Wall -Wextra -Wpedantic>
        $<$<CXX_COMPILER_ID:MSVC>:/W4>
)

# Symbol visibility
set_target_properties(mylib PROPERTIES
    CXX_VISIBILITY_PRESET hidden
    VISIBILITY_INLINES_HIDDEN ON
)

# Version info
set_target_properties(mylib PROPERTIES
    VERSION ${PROJECT_VERSION}
    SOVERSION ${PROJECT_VERSION_MAJOR}
)
```

---

## Executable Pattern

```cmake
add_executable(myapp)

target_sources(myapp
    PRIVATE
        src/main.cpp
        src/app.cpp
)

target_link_libraries(myapp
    PRIVATE
        MyLib::mylib
)

# Runtime output directory
set_target_properties(myapp PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin
)
```

---

## Interface Libraries

For header-only libraries or compile flag collections:

```cmake
# Header-only library
add_library(myheaders INTERFACE)
add_library(MyProject::headers ALIAS myheaders)

target_include_directories(myheaders
    INTERFACE
        $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
        $<INSTALL_INTERFACE:include>
)

target_compile_features(myheaders INTERFACE cxx_std_20)

# Compile flags collection (for project-wide settings)
add_library(project_options INTERFACE)
target_compile_options(project_options
    INTERFACE
        $<$<CXX_COMPILER_ID:GNU,Clang>:-Wall -Wextra>
)
target_compile_definitions(project_options
    INTERFACE
        $<$<CONFIG:Debug>:DEBUG_BUILD>
)
```

---

## Export and Install

Complete export pattern for library consumers:

```cmake
include(GNUInstallDirs)
include(CMakePackageConfigHelpers)

# Install targets
install(TARGETS mylib
    EXPORT MyLibTargets
    LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR}
    ARCHIVE DESTINATION ${CMAKE_INSTALL_LIBDIR}
    RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
    FILE_SET public_headers
)

# Install export file
install(EXPORT MyLibTargets
    FILE MyLibTargets.cmake
    NAMESPACE MyLib::
    DESTINATION ${CMAKE_INSTALL_LIBDIR}/cmake/MyLib
)

# Generate config file
configure_package_config_file(
    ${CMAKE_CURRENT_SOURCE_DIR}/cmake/MyLibConfig.cmake.in
    ${CMAKE_CURRENT_BINARY_DIR}/MyLibConfig.cmake
    INSTALL_DESTINATION ${CMAKE_INSTALL_LIBDIR}/cmake/MyLib
)

# Generate version file
write_basic_package_version_file(
    ${CMAKE_CURRENT_BINARY_DIR}/MyLibConfigVersion.cmake
    VERSION ${PROJECT_VERSION}
    COMPATIBILITY SameMajorVersion
)

# Install config files
install(FILES
    ${CMAKE_CURRENT_BINARY_DIR}/MyLibConfig.cmake
    ${CMAKE_CURRENT_BINARY_DIR}/MyLibConfigVersion.cmake
    DESTINATION ${CMAKE_INSTALL_LIBDIR}/cmake/MyLib
)
```

Config file template (`cmake/MyLibConfig.cmake.in`):
```cmake
@PACKAGE_INIT@

include(CMakeFindDependencyMacro)
find_dependency(fmt 9.0)

include("${CMAKE_CURRENT_LIST_DIR}/MyLibTargets.cmake")

check_required_components(MyLib)
```

---

## FetchContent Patterns

### Basic FetchContent
```cmake
include(FetchContent)

FetchContent_Declare(googletest
    GIT_REPOSITORY https://github.com/google/googletest.git
    GIT_TAG v1.14.0
    FIND_PACKAGE_ARGS NAMES GTest
)

# Try find_package first, fetch if not found
FetchContent_MakeAvailable(googletest)
```

### With options override
```cmake
FetchContent_Declare(spdlog
    GIT_REPOSITORY https://github.com/gabime/spdlog.git
    GIT_TAG v1.12.0
)

# Set options before MakeAvailable
set(SPDLOG_BUILD_EXAMPLE OFF CACHE BOOL "" FORCE)
set(SPDLOG_BUILD_TESTS OFF CACHE BOOL "" FORCE)

FetchContent_MakeAvailable(spdlog)
```

### Prefer system packages
```cmake
FetchContent_Declare(fmt
    GIT_REPOSITORY https://github.com/fmtlib/fmt.git
    GIT_TAG 10.1.0
    FIND_PACKAGE_ARGS  # Try find_package(fmt) first
)
FetchContent_MakeAvailable(fmt)
```

---

## Presets

`CMakePresets.json` example:
```json
{
    "version": 6,
    "cmakeMinimumRequired": {"major": 3, "minor": 23, "patch": 0},
    "configurePresets": [
        {
            "name": "base",
            "hidden": true,
            "binaryDir": "${sourceDir}/build/${presetName}",
            "installDir": "${sourceDir}/install/${presetName}"
        },
        {
            "name": "debug",
            "inherits": "base",
            "cacheVariables": {
                "CMAKE_BUILD_TYPE": "Debug"
            }
        },
        {
            "name": "release",
            "inherits": "base",
            "cacheVariables": {
                "CMAKE_BUILD_TYPE": "Release"
            }
        },
        {
            "name": "ci",
            "inherits": "release",
            "cacheVariables": {
                "BUILD_TESTING": "ON"
            }
        }
    ],
    "buildPresets": [
        {"name": "debug", "configurePreset": "debug"},
        {"name": "release", "configurePreset": "release"}
    ],
    "testPresets": [
        {
            "name": "ci",
            "configurePreset": "ci",
            "output": {"outputOnFailure": true}
        }
    ]
}
```

Usage:
```bash
cmake --preset debug
cmake --build --preset debug
ctest --preset ci
```

---

## Toolchain Files

Cross-compilation toolchain (`arm-toolchain.cmake`):
```cmake
set(CMAKE_SYSTEM_NAME Linux)
set(CMAKE_SYSTEM_PROCESSOR arm)

set(CMAKE_SYSROOT /path/to/sysroot)

set(CMAKE_C_COMPILER arm-linux-gnueabihf-gcc)
set(CMAKE_CXX_COMPILER arm-linux-gnueabihf-g++)

set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_PACKAGE ONLY)
```

---

## Testing Integration

```cmake
include(CTest)

if(BUILD_TESTING)
    find_package(GTest REQUIRED)
    
    add_executable(mylib_tests)
    target_sources(mylib_tests
        PRIVATE
            tests/test_main.cpp
            tests/test_feature.cpp
    )
    
    target_link_libraries(mylib_tests
        PRIVATE
            MyLib::mylib
            GTest::gtest_main
    )
    
    include(GoogleTest)
    gtest_discover_tests(mylib_tests)
endif()
```

---

## Scope Reference

| Scope | Build Requirement | Interface Requirement | Use When |
|-------|------------------|----------------------|----------|
| PRIVATE | ✓ | ✗ | Internal implementation details |
| INTERFACE | ✗ | ✓ | Header-only, or things only consumers need |
| PUBLIC | ✓ | ✓ | Headers that include dependencies |

**Rule of thumb:** Start with `PRIVATE`. Only promote to `PUBLIC` if it appears in your public headers.
