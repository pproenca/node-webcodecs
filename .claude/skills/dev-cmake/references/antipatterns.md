# Build System Antipatterns

Common mistakes and how to fix them. These are patterns that make build files fragile, hard to maintain, or just incorrect.

---

## CMake Antipatterns

### 1. Directory-Level Commands

❌ **Bad:**
```cmake
include_directories(${CMAKE_SOURCE_DIR}/include)
add_definitions(-DFOO)
link_libraries(pthread)
```

✅ **Good:**
```cmake
target_include_directories(mylib PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/include)
target_compile_definitions(mylib PRIVATE FOO)
target_link_libraries(mylib PRIVATE pthread)
```

**Why:** Directory commands affect all targets in that scope, creating hidden dependencies and making it impossible to reason about individual target requirements.

---

### 2. Manipulating CMAKE_CXX_FLAGS

❌ **Bad:**
```cmake
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -std=c++17 -Wall")
```

✅ **Good:**
```cmake
target_compile_features(mylib PUBLIC cxx_std_17)
target_compile_options(mylib PRIVATE -Wall)
```

**Why:** `CMAKE_CXX_FLAGS` is global, affects all targets, and doesn't work correctly across different compilers. `-std=c++17` is GCC/Clang syntax; MSVC uses `/std:c++17`.

---

### 3. Using file(GLOB) for Sources

❌ **Bad:**
```cmake
file(GLOB SOURCES "src/*.cpp")
add_library(mylib ${SOURCES})
```

✅ **Good:**
```cmake
add_library(mylib
    src/file1.cpp
    src/file2.cpp
    src/file3.cpp
)
```

**Why:** CMake evaluates GLOB at configure time. Adding a new file doesn't trigger reconfiguration, so the build system doesn't see it. This causes "works on my machine" bugs.

---

### 4. Missing Scope Specifiers

❌ **Bad:**
```cmake
target_link_libraries(mylib fmt)
target_include_directories(mylib include)
```

✅ **Good:**
```cmake
target_link_libraries(mylib PRIVATE fmt::fmt)
target_include_directories(mylib PUBLIC include)
```

**Why:** Without `PRIVATE`/`PUBLIC`/`INTERFACE`, CMake uses legacy behavior. Be explicit about what propagates to dependents.

---

### 5. Bare Library Names

❌ **Bad:**
```cmake
target_link_libraries(myapp boost_filesystem)
```

✅ **Good:**
```cmake
find_package(Boost REQUIRED COMPONENTS filesystem)
target_link_libraries(myapp PRIVATE Boost::filesystem)
```

**Why:** Bare names don't carry include directories or compile definitions. Namespaced targets (`Boost::filesystem`) propagate all usage requirements automatically.

---

### 6. Overwriting Find Variables

❌ **Bad:**
```cmake
set(CMAKE_CXX_FLAGS "-Wall -g")  # Overwrites user settings!
```

✅ **Good:**
```cmake
# In CMakeLists.txt: use target commands
target_compile_options(mylib PRIVATE -Wall -g)

# Or if you must set variables, append:
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wall")
```

**Why:** Users may pass `CMAKE_CXX_FLAGS` via command line or presets. Overwriting destroys their customization.

---

### 7. Wrong Generator Expression Syntax

❌ **Bad:**
```cmake
target_compile_definitions(mylib PRIVATE
    DEBUG=$<CONFIG:Debug>
)
```

✅ **Good:**
```cmake
target_compile_definitions(mylib PRIVATE
    $<$<CONFIG:Debug>:DEBUG>
)
```

**Why:** `$<CONFIG:Debug>` evaluates to `1` or `0`. You want conditional inclusion, not a value.

---

### 8. Missing ALIAS Targets

❌ **Bad:**
```cmake
add_library(mylib src/lib.cpp)
# Consumer uses: target_link_libraries(app mylib)
```

✅ **Good:**
```cmake
add_library(mylib src/lib.cpp)
add_library(MyProject::mylib ALIAS mylib)
# Consumer uses: target_link_libraries(app MyProject::mylib)
```

**Why:** Namespaced targets can't be accidentally modified. They also match the names used after `install(EXPORT)`.

---

### 9. Installing Wrong Paths

❌ **Bad:**
```cmake
target_include_directories(mylib PUBLIC include)
```

✅ **Good:**
```cmake
target_include_directories(mylib PUBLIC
    $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
    $<INSTALL_INTERFACE:include>
)
```

**Why:** The build directory path makes no sense after installation. Generator expressions let you specify different paths for build vs. install.

---

## Makefile Antipatterns

### 1. Overwriting Variables

❌ **Bad:**
```makefile
CFLAGS = -Wall -O2
```

✅ **Good:**
```makefile
CFLAGS ?= -Wall
CFLAGS += -O2
```

**Why:** `=` overwrites anything the user passed via `make CFLAGS=...`. Use `?=` for defaults and `+=` to append.

---

### 2. Missing .PHONY

❌ **Bad:**
```makefile
clean:
	rm -rf build
```

✅ **Good:**
```makefile
.PHONY: clean
clean:
	rm -rf build
```

**Why:** If a file named `clean` exists, Make thinks it's up-to-date and won't run the recipe.

---

### 3. Hardcoded Compilers

❌ **Bad:**
```makefile
CC = gcc
CXX = g++
```

✅ **Good:**
```makefile
CC  ?= cc
CXX ?= c++
```

**Why:** Users on different systems (macOS, BSD) may use clang by default. Allow override.

---

### 4. Missing Dependencies

❌ **Bad:**
```makefile
main.o: main.c
	$(CC) -c main.c -o main.o
# Forgot: main.c includes config.h
```

✅ **Good:**
```makefile
CFLAGS += -MMD -MP
-include $(DEPS)
```

**Why:** Without automatic dependency tracking, changing headers doesn't rebuild affected sources.

---

### 5. Recipe Directory Creation Race

❌ **Bad:**
```makefile
build/%.o: src/%.c
	mkdir -p build
	$(CC) -c $< -o $@
```

✅ **Good:**
```makefile
build/%.o: src/%.c | build
	$(CC) -c $< -o $@

build:
	mkdir -p $@
```

**Why:** With parallel make (`-j`), multiple jobs might race to create `build`. Order-only prerequisites (`|`) ensure directory exists before any compilation starts.

---

### 6. Using `make` in Recipes

❌ **Bad:**
```makefile
all:
	make -C subdir
```

✅ **Good:**
```makefile
all:
	$(MAKE) -C subdir
```

**Why:** `$(MAKE)` preserves flags like `-j`, `-k`, and jobserver communication. Raw `make` loses parallel build capability.

---

### 7. Recursive Variable Loops

❌ **Bad:**
```makefile
CFLAGS = $(CFLAGS) -Wall  # Infinite recursion!
```

✅ **Good:**
```makefile
CFLAGS := $(CFLAGS) -Wall  # Simple expansion
# Or
CFLAGS += -Wall            # Append
```

**Why:** `=` creates recursive variables. Self-reference causes infinite expansion.

---

### 8. Forgetting Automatic Variables

❌ **Bad:**
```makefile
build/foo.o: src/foo.c
	$(CC) $(CFLAGS) -c src/foo.c -o build/foo.o
```

✅ **Good:**
```makefile
build/%.o: src/%.c
	$(CC) $(CFLAGS) -c $< -o $@
```

**Why:** Explicit paths duplicate information and don't generalize. Pattern rules with automatic variables work for any file.

---

### 9. Wrong Flag Variables

❌ **Bad:**
```makefile
CFLAGS += -I./include  # -I is a preprocessor flag
CFLAGS += -lpthread    # -l is a library flag
```

✅ **Good:**
```makefile
CPPFLAGS += -I./include
LDLIBS   += -lpthread
```

**Why:** Built-in rules use variables correctly:
- `CPPFLAGS`: Preprocessor (`-I`, `-D`)
- `CFLAGS`/`CXXFLAGS`: Compiler (`-Wall`, `-O2`, `-std=`)
- `LDFLAGS`: Linker flags (`-L`, `-Wl,`)
- `LDLIBS`: Libraries (`-l`)

---

## Quick Fixes Checklist

### CMake: Before You Submit
1. ✅ Run `cmake --warn-uninitialized`
2. ✅ Build with a different generator (Ninja if using Make, or vice versa)
3. ✅ Test `cmake --install` to an empty prefix
4. ✅ Try as a subdirectory of another project

### Make: Before You Submit
1. ✅ Run `make -n` (dry run) to see what would execute
2. ✅ Run `make -j$(nproc)` to test parallel builds
3. ✅ Run `make CC=clang` to test compiler override
4. ✅ Clean and rebuild after changing headers
