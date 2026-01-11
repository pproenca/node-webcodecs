# Make Patterns Reference

## Table of Contents
1. [Production-Ready Template](#production-ready-template)
2. [Multi-Directory Projects](#multi-directory-projects)
3. [Library Builds](#library-builds)
4. [Automatic Dependencies](#automatic-dependencies)
5. [Cross-Compilation](#cross-compilation)
6. [Parallel Builds](#parallel-builds)
7. [Debug vs Release](#debug-vs-release)

---

## Production-Ready Template

Complete Makefile for a C/C++ project:

```makefile
# Project configuration
PROJECT  := myproject
VERSION  := 1.0.0

# Directories
SRCDIR   := src
INCDIR   := include
BUILDDIR := build
BINDIR   := bin

# Tools (overridable)
CC       ?= gcc
CXX      ?= g++
AR       ?= ar
LD       := $(CXX)

# Flags (overridable, then extended)
CFLAGS   ?= -Wall -Wextra -pedantic
CXXFLAGS ?= -Wall -Wextra -pedantic
LDFLAGS  ?=
LDLIBS   ?=

# Project-specific additions
CPPFLAGS += -I$(INCDIR)
CFLAGS   += -std=c11 -MMD -MP
CXXFLAGS += -std=c++17 -MMD -MP

# Source files (explicit listing preferred, wildcard acceptable for simple projects)
SRCS     := $(wildcard $(SRCDIR)/*.cpp)
OBJS     := $(SRCS:$(SRCDIR)/%.cpp=$(BUILDDIR)/%.o)
DEPS     := $(OBJS:.o=.d)

# Default target
.PHONY: all
all: $(BINDIR)/$(PROJECT)

# Link executable
$(BINDIR)/$(PROJECT): $(OBJS) | $(BINDIR)
	$(LD) $(LDFLAGS) -o $@ $^ $(LDLIBS)

# Compile sources
$(BUILDDIR)/%.o: $(SRCDIR)/%.cpp | $(BUILDDIR)
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -c -o $@ $<

# Create directories
$(BUILDDIR) $(BINDIR):
	mkdir -p $@

# Include dependencies
-include $(DEPS)

# Clean
.PHONY: clean
clean:
	$(RM) -r $(BUILDDIR) $(BINDIR)

# Install
PREFIX   ?= /usr/local
.PHONY: install
install: $(BINDIR)/$(PROJECT)
	install -d $(DESTDIR)$(PREFIX)/bin
	install -m 755 $(BINDIR)/$(PROJECT) $(DESTDIR)$(PREFIX)/bin/

.PHONY: uninstall
uninstall:
	$(RM) $(DESTDIR)$(PREFIX)/bin/$(PROJECT)

# Help
.PHONY: help
help:
	@echo "Targets:"
	@echo "  all       - Build $(PROJECT)"
	@echo "  clean     - Remove build artifacts"
	@echo "  install   - Install to PREFIX (default: /usr/local)"
	@echo "  help      - Show this message"
	@echo ""
	@echo "Variables:"
	@echo "  CC=$(CC)  CXX=$(CXX)"
	@echo "  CFLAGS=$(CFLAGS)"
	@echo "  PREFIX=$(PREFIX)"

# Prevent deletion of intermediate files
.SECONDARY:

# Delete targets on recipe failure
.DELETE_ON_ERROR:
```

---

## Multi-Directory Projects

### Recursive Make (traditional, but has issues)
```makefile
SUBDIRS := lib app tests

.PHONY: all clean $(SUBDIRS)

all: $(SUBDIRS)

$(SUBDIRS):
	$(MAKE) -C $@

app: lib
tests: lib app

clean:
	for dir in $(SUBDIRS); do $(MAKE) -C $$dir clean; done
```

### Non-recursive Make (preferred for complex projects)
```makefile
# Top-level Makefile
BUILDDIR := build

# Include all module makefiles
include src/lib/module.mk
include src/app/module.mk
include tests/module.mk

.PHONY: all clean

all: $(ALL_TARGETS)

clean:
	$(RM) -r $(BUILDDIR)
```

Module makefile (`src/lib/module.mk`):
```makefile
LIB_SRC := src/lib
LIB_SRCS := $(wildcard $(LIB_SRC)/*.cpp)
LIB_OBJS := $(LIB_SRCS:%.cpp=$(BUILDDIR)/%.o)

$(BUILDDIR)/libcore.a: $(LIB_OBJS)
	$(AR) rcs $@ $^

$(BUILDDIR)/$(LIB_SRC)/%.o: $(LIB_SRC)/%.cpp | $(BUILDDIR)/$(LIB_SRC)
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -c -o $@ $<

$(BUILDDIR)/$(LIB_SRC):
	mkdir -p $@

ALL_TARGETS += $(BUILDDIR)/libcore.a
```

---

## Library Builds

### Static Library
```makefile
LIB_OBJS := $(patsubst %.c,%.o,$(wildcard src/*.c))

libfoo.a: $(LIB_OBJS)
	$(AR) rcs $@ $^
```

### Shared Library
```makefile
LIB_OBJS := $(patsubst %.c,%.o,$(wildcard src/*.c))

CFLAGS += -fPIC

libfoo.so: $(LIB_OBJS)
	$(CC) -shared -o $@ $^ $(LDFLAGS)

# With versioning
LIBNAME   := libfoo.so
LIBVER    := 1.0.0
LIBSONAME := $(LIBNAME).1

$(LIBNAME).$(LIBVER): $(LIB_OBJS)
	$(CC) -shared -Wl,-soname,$(LIBSONAME) -o $@ $^ $(LDFLAGS)
	ln -sf $@ $(LIBSONAME)
	ln -sf $@ $(LIBNAME)
```

---

## Automatic Dependencies

### GCC/Clang Method (recommended)
```makefile
CFLAGS += -MMD -MP

DEPS := $(OBJS:.o=.d)
-include $(DEPS)
```

Flags explained:
- `-MMD`: Generate `.d` files with dependencies (excludes system headers)
- `-MP`: Add phony targets for headers (prevents errors when headers are deleted)

### Manual Method (for non-GCC compilers)
```makefile
depend: $(SRCS)
	$(CC) -MM $(CPPFLAGS) $^ > .depend

-include .depend
```

---

## Cross-Compilation

```makefile
# Cross-compile prefix
CROSS_COMPILE ?=

CC  := $(CROSS_COMPILE)gcc
CXX := $(CROSS_COMPILE)g++
AR  := $(CROSS_COMPILE)ar
LD  := $(CROSS_COMPILE)ld

# Usage: make CROSS_COMPILE=arm-linux-gnueabihf-
```

### Platform detection
```makefile
UNAME := $(shell uname -s)

ifeq ($(UNAME),Linux)
    LDLIBS += -lrt
endif
ifeq ($(UNAME),Darwin)
    CFLAGS += -mmacosx-version-min=10.15
endif
```

---

## Parallel Builds

Make supports parallel builds with `-j`:
```bash
make -j$(nproc)
```

Ensure correct dependencies so parallel builds work:
```makefile
# Order-only prerequisite for directory creation
$(BUILDDIR)/%.o: %.c | $(BUILDDIR)
	$(CC) $(CFLAGS) -c -o $@ $<

# Bad: race condition
$(BUILDDIR)/%.o: %.c
	mkdir -p $(BUILDDIR)  # Multiple jobs might race
	$(CC) $(CFLAGS) -c -o $@ $<
```

---

## Debug vs Release

### Using separate targets
```makefile
CFLAGS_DEBUG   := -g -O0 -DDEBUG
CFLAGS_RELEASE := -O2 -DNDEBUG

.PHONY: debug release

debug: CFLAGS += $(CFLAGS_DEBUG)
debug: all

release: CFLAGS += $(CFLAGS_RELEASE)
release: all
```

### Using build directories
```makefile
BUILD ?= release

ifeq ($(BUILD),debug)
    CFLAGS += -g -O0 -DDEBUG
    BUILDDIR := build/debug
else
    CFLAGS += -O2 -DNDEBUG
    BUILDDIR := build/release
endif
```

---

## Variable Reference

| Variable | Purpose | Set By |
|----------|---------|--------|
| `CC` | C compiler | Make/User |
| `CXX` | C++ compiler | Make/User |
| `CFLAGS` | C compiler flags | User |
| `CXXFLAGS` | C++ compiler flags | User |
| `CPPFLAGS` | Preprocessor flags (-I, -D) | User |
| `LDFLAGS` | Linker flags (-L, -Wl,) | User |
| `LDLIBS` | Libraries (-l) | User |
| `AR` | Archive tool | Make/User |

### Variable Assignment Types
```makefile
VAR  = value   # Recursive (re-evaluated on use)
VAR := value   # Simple (evaluated once)
VAR ?= value   # Conditional (set if unset)
VAR += value   # Append
```

**Best practice:** Use `?=` for tool definitions (allow user override), `+=` for flags (preserve user additions).

---

## Automatic Variables Quick Reference

| Variable | Meaning |
|----------|---------|
| `$@` | Target filename |
| `$<` | First prerequisite |
| `$^` | All prerequisites (deduplicated) |
| `$+` | All prerequisites (with duplicates) |
| `$*` | Stem (what % matched) |
| `$(@D)` | Directory part of target |
| `$(@F)` | File part of target |
| `$(<D)` | Directory part of first prereq |
| `$(<F)` | File part of first prereq |

---

## Common Functions

```makefile
# Text manipulation
$(patsubst %.c,%.o,$(SRCS))      # Pattern substitution
$(SRCS:.c=.o)                    # Shorthand for above
$(filter %.c,$(FILES))           # Keep only .c files
$(filter-out test%,$(SRCS))      # Remove test* files
$(sort $(LIST))                  # Sort and deduplicate
$(word 1,$(LIST))                # First word
$(words $(LIST))                 # Word count

# File functions
$(wildcard src/*.c)              # Glob expansion
$(realpath $(PATH))              # Absolute path
$(dir $(FILE))                   # Directory part
$(notdir $(FILE))                # Filename part
$(basename $(FILE))              # Remove extension
$(suffix $(FILE))                # Get extension
$(addprefix build/,$(FILES))     # Add prefix
$(addsuffix .o,$(NAMES))         # Add suffix

# Shell
$(shell uname -s)                # Run shell command
```
