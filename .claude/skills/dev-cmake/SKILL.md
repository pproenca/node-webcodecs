---
name: dev-cmake
description: Write CMake and Make files like a principal engineer with decades of experience. Use when creating, refactoring, reviewing, or debugging CMakeLists.txt, Makefiles, or build system configurations for C/C++ projects. Produces elegant, minimal, modern build files that reflect deep understanding of build systems.
---

# CMake & Make Expert

Write build files that are elegant because the understanding is deep. Every line should have a reason. Simplicity comes from mastery, not shortcuts.

## Core Philosophy

**Targets are everything.** Modern CMake is about targets and properties, not variables and directories. Think of targets as objects with member functions and properties.

**Explicit over implicit.** Always specify `PRIVATE`, `PUBLIC`, or `INTERFACE`. Never rely on inherited directory-level settings.

**Minimal surface area.** Expose only what consumers need. Default to `PRIVATE`; use `PUBLIC` only when downstream targets genuinely require it.

## CMake: The Principal Engineer Approach

### Project Structure
```cmake
cmake_minimum_required(VERSION 3.16)
project(MyProject VERSION 1.0.0 LANGUAGES CXX)

# Set standards at target level, not globally
# Use compile features, not flags
```

### Target Definition Pattern
```cmake
add_library(mylib)
add_library(MyProject::mylib ALIAS mylib)

target_sources(mylib
    PRIVATE
        src/impl.cpp
    PUBLIC
        FILE_SET HEADERS
        BASE_DIRS include
        FILES include/mylib/api.h
)

target_compile_features(mylib PUBLIC cxx_std_17)

target_include_directories(mylib
    PUBLIC
        $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
        $<INSTALL_INTERFACE:include>
)
```

### What to Never Do
- `include_directories()` — use `target_include_directories()`
- `link_directories()` — use full paths or targets
- `add_definitions()` — use `target_compile_definitions()`
- `link_libraries()` — use `target_link_libraries()`
- `CMAKE_CXX_FLAGS` manipulation — use `target_compile_options()` or features
- `file(GLOB)` for sources — list files explicitly
- Bare library names in `target_link_libraries()` — use namespaced targets

### Dependency Handling

For find_package dependencies:
```cmake
find_package(Boost 1.70 REQUIRED COMPONENTS filesystem)
target_link_libraries(mylib PRIVATE Boost::filesystem)
```

For FetchContent (prefer over ExternalProject for CMake deps):
```cmake
include(FetchContent)
FetchContent_Declare(fmt
    GIT_REPOSITORY https://github.com/fmtlib/fmt.git
    GIT_TAG 10.1.0
)
FetchContent_MakeAvailable(fmt)
target_link_libraries(mylib PRIVATE fmt::fmt)
```

### Generator Expressions

Use for build/install path differences:
```cmake
target_include_directories(mylib PUBLIC
    $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
    $<INSTALL_INTERFACE:include>
)
```

Use for conditional compilation:
```cmake
target_compile_definitions(mylib PRIVATE
    $<$<CONFIG:Debug>:DEBUG_MODE>
)
```

## Make: The Principal Engineer Approach

### Essential Structure
```makefile
# Immediately expanded defaults
CC      ?= gcc
CXX     ?= g++
CFLAGS  ?= -Wall -Wextra -pedantic
LDFLAGS ?=

# Preserve user-provided flags
CFLAGS  += -MMD -MP

# Automatic dependency tracking
SRCS := $(wildcard src/*.c)
OBJS := $(SRCS:src/%.c=build/%.o)
DEPS := $(OBJS:.o=.d)

.PHONY: all clean

all: bin/program

bin/program: $(OBJS) | bin
	$(CC) $(LDFLAGS) -o $@ $^

build/%.o: src/%.c | build
	$(CC) $(CFLAGS) -c -o $@ $<

bin build:
	mkdir -p $@

clean:
	rm -rf build bin

-include $(DEPS)
```

### Pattern Rules — The Elegant Way
```makefile
# Single pattern rule replaces N explicit rules
%.o: %.c
	$(CC) $(CFLAGS) $(CPPFLAGS) -c -o $@ $<
```

### Automatic Variables (memorize these)
- `$@` — target
- `$<` — first prerequisite
- `$^` — all prerequisites (no duplicates)
- `$+` — all prerequisites (with duplicates, for libs)
- `$*` — stem (matched by %)

### What Makes Makefiles Elegant
1. Order-only prerequisites (`| dir`) for directory creation
2. `-include` for optional dependency files
3. `?=` for overridable defaults, `+=` to append
4. `.PHONY` for non-file targets
5. `.DELETE_ON_ERROR` to clean failed builds
6. Consistent variable naming (UPPERCASE for user-facing)

## Reference Files

- **references/cmake-patterns.md** — Complete modern CMake patterns (library export, install, presets, toolchains)
- **references/make-patterns.md** — Advanced Make patterns (multi-directory, cross-compilation, dependencies)
- **references/antipatterns.md** — Common mistakes and their fixes

## Quality Checklist

Before finalizing any build file:

### CMake
- [ ] Every target has a namespaced alias
- [ ] All `target_*` calls specify scope (`PRIVATE`/`PUBLIC`/`INTERFACE`)
- [ ] No directory-level commands (`include_directories`, etc.)
- [ ] Generator expressions for build/install differences
- [ ] Version requirements on `find_package`
- [ ] `cmake_minimum_required` reflects actual features used

### Make
- [ ] All variables use `?=` or `+=` appropriately
- [ ] Automatic dependency generation (`-MMD -MP`)
- [ ] Pattern rules instead of repeated explicit rules
- [ ] `.PHONY` declared for non-file targets
- [ ] Clean target removes all generated files
- [ ] Build artifacts in separate directory from source
