# Sharp Advanced Patterns Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2024-12-31-sharp-patterns-advanced-implementation.md` to implement task-by-task.

**Goal:** Implement advanced C++ patterns from sharp: ErrorBuilder, WarningAccumulator, FFmpeg logging, descriptor structs, template enum conversion, and enhanced platform detection.

**Architecture:** Incremental additions to existing `src/common.h/cc` and `lib/` modules. Each pattern is self-contained with its own header/implementation. Tests use vitest in `test/golden/`.

**Tech Stack:** C++17, node-addon-api, TypeScript, vitest

---

## Phase 1: Error & Diagnostics

### Task 1: Create WarningAccumulator Class

**Files:**
- Create: `src/warnings.h`
- Create: `src/warnings.cc`
- Modify: `binding.gyp` (add source)
- Test: `test/golden/warnings.test.ts`

**Step 1: Write the failing test** (3 min)

Create `test/golden/warnings.test.ts`:

```typescript
import {describe, it, expect} from 'vitest';

// WarningAccumulator is exposed via binding for testing
const {WarningAccumulator} = await import('../../dist/index.js');

describe('WarningAccumulator', () => {
  it('accumulates warnings and drains them', () => {
    const accumulator = new WarningAccumulator();
    accumulator.add('Warning 1');
    accumulator.add('Warning 2');

    expect(accumulator.count()).toBe(2);
    expect(accumulator.hasWarnings()).toBe(true);

    const warnings = accumulator.drain();
    expect(warnings).toEqual(['Warning 1', 'Warning 2']);

    expect(accumulator.count()).toBe(0);
    expect(accumulator.hasWarnings()).toBe(false);
  });

  it('returns empty array when no warnings', () => {
    const accumulator = new WarningAccumulator();
    expect(accumulator.drain()).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/warnings.test.ts
```

Expected: FAIL with `WarningAccumulator is not defined` or similar

**Step 3: Create src/warnings.h** (3 min)

```cpp
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#ifndef SRC_WARNINGS_H_
#define SRC_WARNINGS_H_

#include <mutex>
#include <queue>
#include <string>
#include <vector>

#include <napi.h>

namespace webcodecs {

class WarningAccumulator : public Napi::ObjectWrap<WarningAccumulator> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  explicit WarningAccumulator(const Napi::CallbackInfo& info);

  // Thread-safe methods
  void AddWarning(const std::string& warning);
  std::vector<std::string> DrainWarnings();
  bool HasWarnings() const;
  size_t Count() const;

 private:
  // JS-exposed methods
  void Add(const Napi::CallbackInfo& info);
  Napi::Value Drain(const Napi::CallbackInfo& info);
  Napi::Value HasWarningsJS(const Napi::CallbackInfo& info);
  Napi::Value CountJS(const Napi::CallbackInfo& info);

  std::queue<std::string> warnings_;
  mutable std::mutex mutex_;
};

// Global warning accumulator for FFmpeg messages
extern WarningAccumulator* globalWarnings;

}  // namespace webcodecs

#endif  // SRC_WARNINGS_H_
```

**Step 4: Create src/warnings.cc** (5 min)

```cpp
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#include "src/warnings.h"

namespace webcodecs {

WarningAccumulator* globalWarnings = nullptr;

Napi::Object WarningAccumulator::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func = DefineClass(env, "WarningAccumulator", {
    InstanceMethod("add", &WarningAccumulator::Add),
    InstanceMethod("drain", &WarningAccumulator::Drain),
    InstanceMethod("hasWarnings", &WarningAccumulator::HasWarningsJS),
    InstanceMethod("count", &WarningAccumulator::CountJS),
  });

  Napi::FunctionReference* constructor = new Napi::FunctionReference();
  *constructor = Napi::Persistent(func);
  env.SetInstanceData(constructor);

  exports.Set("WarningAccumulator", func);
  return exports;
}

WarningAccumulator::WarningAccumulator(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<WarningAccumulator>(info) {}

void WarningAccumulator::AddWarning(const std::string& warning) {
  std::lock_guard<std::mutex> lock(mutex_);
  warnings_.push(warning);
}

std::vector<std::string> WarningAccumulator::DrainWarnings() {
  std::lock_guard<std::mutex> lock(mutex_);
  std::vector<std::string> result;
  while (!warnings_.empty()) {
    result.push_back(warnings_.front());
    warnings_.pop();
  }
  return result;
}

bool WarningAccumulator::HasWarnings() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return !warnings_.empty();
}

size_t WarningAccumulator::Count() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return warnings_.size();
}

void WarningAccumulator::Add(const Napi::CallbackInfo& info) {
  if (info.Length() < 1 || !info[0].IsString()) {
    Napi::TypeError::New(info.Env(), "Expected string argument")
        .ThrowAsJavaScriptException();
    return;
  }
  AddWarning(info[0].As<Napi::String>().Utf8Value());
}

Napi::Value WarningAccumulator::Drain(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  auto warnings = DrainWarnings();

  Napi::Array result = Napi::Array::New(env, warnings.size());
  for (size_t i = 0; i < warnings.size(); ++i) {
    result.Set(i, Napi::String::New(env, warnings[i]));
  }
  return result;
}

Napi::Value WarningAccumulator::HasWarningsJS(const Napi::CallbackInfo& info) {
  return Napi::Boolean::New(info.Env(), HasWarnings());
}

Napi::Value WarningAccumulator::CountJS(const Napi::CallbackInfo& info) {
  return Napi::Number::New(info.Env(), static_cast<double>(Count()));
}

}  // namespace webcodecs
```

**Step 5: Add to binding.gyp sources** (1 min)

Edit `binding.gyp`, add `"src/warnings.cc"` to sources array.

**Step 6: Register in addon.cc** (1 min)

Add to `src/addon.cc`:
```cpp
#include "src/warnings.h"

// In InitAll function:
webcodecs::WarningAccumulator::Init(env, exports);
```

**Step 7: Export from lib/index.ts** (1 min)

Add to `lib/index.ts`:
```typescript
export const WarningAccumulator = binding.WarningAccumulator;
```

**Step 8: Build and run test** (1 min)

```bash
npm run build && npx vitest run test/golden/warnings.test.ts
```

Expected: PASS (2 passed)

**Step 9: Commit** (30 sec)

```bash
git add src/warnings.h src/warnings.cc binding.gyp src/addon.cc lib/index.ts test/golden/warnings.test.ts
git commit -m "feat(warnings): add WarningAccumulator class following sharp pattern"
```

---

### Task 2: Create ErrorBuilder Class

**Files:**
- Create: `src/error_builder.h`
- Create: `src/error_builder.cc`
- Modify: `binding.gyp`
- Test: `test/golden/error-builder.test.ts`

**Step 1: Write the failing test** (3 min)

Create `test/golden/error-builder.test.ts`:

```typescript
import {describe, it, expect} from 'vitest';

const {ErrorBuilder} = await import('../../dist/index.js');

describe('ErrorBuilder', () => {
  it('creates error with operation and FFmpeg code', () => {
    const builder = new ErrorBuilder('avcodec_send_frame');
    builder.withFFmpegCode(-22); // EINVAL

    const message = builder.build();
    expect(message).toContain('avcodec_send_frame');
    expect(message).toContain('Invalid argument');
  });

  it('chains context and values', () => {
    const message = new ErrorBuilder('encode')
      .withContext('while encoding frame')
      .withValue('pts', 12345)
      .withValue('format', 'I420')
      .build();

    expect(message).toContain('encode');
    expect(message).toContain('while encoding frame');
    expect(message).toContain('pts=12345');
    expect(message).toContain('format=I420');
  });

  it('throws as Napi::Error', () => {
    const builder = new ErrorBuilder('test_operation');
    builder.withFFmpegCode(-1);

    expect(() => builder.throwError()).toThrow(/test_operation/);
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/error-builder.test.ts
```

Expected: FAIL with `ErrorBuilder is not defined`

**Step 3: Create src/error_builder.h** (3 min)

```cpp
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#ifndef SRC_ERROR_BUILDER_H_
#define SRC_ERROR_BUILDER_H_

#include <string>
#include <utility>
#include <vector>

#include <napi.h>

namespace webcodecs {

class ErrorBuilder : public Napi::ObjectWrap<ErrorBuilder> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  explicit ErrorBuilder(const Napi::CallbackInfo& info);

  // Fluent API for C++ usage
  ErrorBuilder& WithFFmpegCode(int errnum);
  ErrorBuilder& WithContext(const std::string& context);
  ErrorBuilder& WithValue(const std::string& name, int64_t value);
  ErrorBuilder& WithValue(const std::string& name, const std::string& value);

  std::string Build() const;
  Napi::Error BuildNapi(Napi::Env env) const;

 private:
  // JS-exposed methods
  Napi::Value WithFFmpegCodeJS(const Napi::CallbackInfo& info);
  Napi::Value WithContextJS(const Napi::CallbackInfo& info);
  Napi::Value WithValueJS(const Napi::CallbackInfo& info);
  Napi::Value BuildJS(const Napi::CallbackInfo& info);
  void ThrowErrorJS(const Napi::CallbackInfo& info);

  std::string operation_;
  int ffmpeg_code_ = 0;
  std::vector<std::string> context_;
  std::vector<std::pair<std::string, std::string>> values_;
};

}  // namespace webcodecs

#endif  // SRC_ERROR_BUILDER_H_
```

**Step 4: Create src/error_builder.cc** (5 min)

```cpp
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#include "src/error_builder.h"
#include "src/common.h"

namespace webcodecs {

Napi::Object ErrorBuilder::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func = DefineClass(env, "ErrorBuilder", {
    InstanceMethod("withFFmpegCode", &ErrorBuilder::WithFFmpegCodeJS),
    InstanceMethod("withContext", &ErrorBuilder::WithContextJS),
    InstanceMethod("withValue", &ErrorBuilder::WithValueJS),
    InstanceMethod("build", &ErrorBuilder::BuildJS),
    InstanceMethod("throwError", &ErrorBuilder::ThrowErrorJS),
  });

  Napi::FunctionReference* constructor = new Napi::FunctionReference();
  *constructor = Napi::Persistent(func);
  env.SetInstanceData(constructor);

  exports.Set("ErrorBuilder", func);
  return exports;
}

ErrorBuilder::ErrorBuilder(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<ErrorBuilder>(info) {
  if (info.Length() > 0 && info[0].IsString()) {
    operation_ = info[0].As<Napi::String>().Utf8Value();
  }
}

ErrorBuilder& ErrorBuilder::WithFFmpegCode(int errnum) {
  ffmpeg_code_ = errnum;
  return *this;
}

ErrorBuilder& ErrorBuilder::WithContext(const std::string& context) {
  context_.push_back(context);
  return *this;
}

ErrorBuilder& ErrorBuilder::WithValue(const std::string& name, int64_t value) {
  values_.emplace_back(name, std::to_string(value));
  return *this;
}

ErrorBuilder& ErrorBuilder::WithValue(const std::string& name,
                                       const std::string& value) {
  values_.emplace_back(name, value);
  return *this;
}

std::string ErrorBuilder::Build() const {
  std::string msg = operation_;

  if (ffmpeg_code_ != 0) {
    msg += ": " + FFmpegErrorString(ffmpeg_code_);
  }

  if (!context_.empty() || !values_.empty()) {
    msg += " (";
    bool first = true;

    for (const auto& ctx : context_) {
      if (!first) msg += ", ";
      msg += ctx;
      first = false;
    }

    for (const auto& [name, value] : values_) {
      if (!first) msg += ", ";
      msg += name + "=" + value;
      first = false;
    }

    msg += ")";
  }

  return msg;
}

Napi::Error ErrorBuilder::BuildNapi(Napi::Env env) const {
  return Napi::Error::New(env, Build());
}

Napi::Value ErrorBuilder::WithFFmpegCodeJS(const Napi::CallbackInfo& info) {
  if (info.Length() > 0 && info[0].IsNumber()) {
    WithFFmpegCode(info[0].As<Napi::Number>().Int32Value());
  }
  return info.This();
}

Napi::Value ErrorBuilder::WithContextJS(const Napi::CallbackInfo& info) {
  if (info.Length() > 0 && info[0].IsString()) {
    WithContext(info[0].As<Napi::String>().Utf8Value());
  }
  return info.This();
}

Napi::Value ErrorBuilder::WithValueJS(const Napi::CallbackInfo& info) {
  if (info.Length() >= 2 && info[0].IsString()) {
    std::string name = info[0].As<Napi::String>().Utf8Value();
    if (info[1].IsNumber()) {
      WithValue(name, info[1].As<Napi::Number>().Int64Value());
    } else if (info[1].IsString()) {
      WithValue(name, info[1].As<Napi::String>().Utf8Value());
    }
  }
  return info.This();
}

Napi::Value ErrorBuilder::BuildJS(const Napi::CallbackInfo& info) {
  return Napi::String::New(info.Env(), Build());
}

void ErrorBuilder::ThrowErrorJS(const Napi::CallbackInfo& info) {
  BuildNapi(info.Env()).ThrowAsJavaScriptException();
}

}  // namespace webcodecs
```

**Step 5: Add to binding.gyp and addon.cc** (1 min)

Add `"src/error_builder.cc"` to binding.gyp sources.

Add to `src/addon.cc`:
```cpp
#include "src/error_builder.h"
// In InitAll:
webcodecs::ErrorBuilder::Init(env, exports);
```

**Step 6: Export from lib/index.ts** (30 sec)

```typescript
export const ErrorBuilder = binding.ErrorBuilder;
```

**Step 7: Build and run test** (1 min)

```bash
npm run build && npx vitest run test/golden/error-builder.test.ts
```

Expected: PASS (3 passed)

**Step 8: Commit** (30 sec)

```bash
git add src/error_builder.h src/error_builder.cc binding.gyp src/addon.cc lib/index.ts test/golden/error-builder.test.ts
git commit -m "feat(error): add ErrorBuilder for rich FFmpeg error context"
```

---

### Task 3: Add FFmpeg Log Redirection

**Files:**
- Modify: `src/common.h`
- Modify: `src/common.cc`
- Modify: `src/addon.cc`
- Test: `test/golden/ffmpeg-logging.test.ts`

**Step 1: Write the failing test** (2 min)

Create `test/golden/ffmpeg-logging.test.ts`:

```typescript
import {describe, it, expect} from 'vitest';

const {getFFmpegWarnings, clearFFmpegWarnings} = await import('../../dist/index.js');

describe('FFmpeg Logging', () => {
  it('captures FFmpeg warnings', () => {
    // FFmpeg warnings are captured globally
    clearFFmpegWarnings();

    const warnings = getFFmpegWarnings();
    expect(Array.isArray(warnings)).toBe(true);
  });

  it('clears warnings after retrieval', () => {
    clearFFmpegWarnings();
    const warnings1 = getFFmpegWarnings();
    const warnings2 = getFFmpegWarnings();

    // Second call should return empty (warnings drained)
    expect(warnings2.length).toBeLessThanOrEqual(warnings1.length);
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/ffmpeg-logging.test.ts
```

Expected: FAIL with `getFFmpegWarnings is not defined`

**Step 3: Update src/common.h** (2 min)

Add after existing declarations:
```cpp
// FFmpeg log capture
void InitFFmpegLogging();
std::vector<std::string> GetFFmpegWarnings();
void ClearFFmpegWarnings();
```

**Step 4: Update src/common.cc** (4 min)

Add at the end, before the closing namespace:

```cpp
//==============================================================================
// FFmpeg Logging
//==============================================================================

static std::queue<std::string> ffmpegWarnings;
static std::mutex ffmpegWarningsMutex;

void InitFFmpegLogging() {
  static std::once_flag log_init_once;
  std::call_once(log_init_once, []() {
    av_log_set_callback([](void* ptr, int level, const char* fmt, va_list vl) {
      if (level <= AV_LOG_WARNING) {
        char buf[1024];
        vsnprintf(buf, sizeof(buf), fmt, vl);

        // Remove trailing newline
        size_t len = strlen(buf);
        if (len > 0 && buf[len - 1] == '\n') buf[len - 1] = '\0';

        // Skip empty messages
        if (strlen(buf) == 0) return;

        std::lock_guard<std::mutex> lock(ffmpegWarningsMutex);
        ffmpegWarnings.push(buf);
      }
    });
    av_log_set_level(AV_LOG_WARNING);
  });
}

std::vector<std::string> GetFFmpegWarnings() {
  std::lock_guard<std::mutex> lock(ffmpegWarningsMutex);
  std::vector<std::string> result;
  while (!ffmpegWarnings.empty()) {
    result.push_back(ffmpegWarnings.front());
    ffmpegWarnings.pop();
  }
  return result;
}

void ClearFFmpegWarnings() {
  std::lock_guard<std::mutex> lock(ffmpegWarningsMutex);
  while (!ffmpegWarnings.empty()) {
    ffmpegWarnings.pop();
  }
}
```

**Step 5: Add to src/common.h includes** (30 sec)

Add `#include <queue>` if not present.

**Step 6: Add JS exports in addon.cc** (2 min)

```cpp
// Add helper functions
Napi::Value GetFFmpegWarningsJS(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  auto warnings = webcodecs::GetFFmpegWarnings();

  Napi::Array result = Napi::Array::New(env, warnings.size());
  for (size_t i = 0; i < warnings.size(); ++i) {
    result.Set(i, Napi::String::New(env, warnings[i]));
  }
  return result;
}

void ClearFFmpegWarningsJS(const Napi::CallbackInfo& info) {
  webcodecs::ClearFFmpegWarnings();
}

// In InitAll:
webcodecs::InitFFmpegLogging();
exports.Set("getFFmpegWarnings", Napi::Function::New(env, GetFFmpegWarningsJS));
exports.Set("clearFFmpegWarnings", Napi::Function::New(env, ClearFFmpegWarningsJS));
```

**Step 7: Export from lib/index.ts** (30 sec)

```typescript
export const getFFmpegWarnings = binding.getFFmpegWarnings;
export const clearFFmpegWarnings = binding.clearFFmpegWarnings;
```

**Step 8: Build and run test** (1 min)

```bash
npm run build && npx vitest run test/golden/ffmpeg-logging.test.ts
```

Expected: PASS (2 passed)

**Step 9: Commit** (30 sec)

```bash
git add src/common.h src/common.cc src/addon.cc lib/index.ts test/golden/ffmpeg-logging.test.ts
git commit -m "feat(logging): add FFmpeg warning capture following sharp pattern"
```

---

## Phase 2: Configuration Patterns

### Task 4: Add Template AttrAsEnum Function

**Files:**
- Modify: `src/common.h`
- Modify: `src/common.cc`
- Test: `test/golden/attr-as-enum.test.ts`

**Step 1: Write the failing test** (3 min)

Create `test/golden/attr-as-enum.test.ts`:

```typescript
import {describe, it, expect} from 'vitest';

const {testAttrAsEnum} = await import('../../dist/index.js');

describe('AttrAsEnum', () => {
  it('returns mapped value for known string', () => {
    // testAttrAsEnum exposes internal for testing
    const result = testAttrAsEnum({colorPrimaries: 'bt709'}, 'colorPrimaries');
    expect(result).toBe('bt709'); // Returns string representation
  });

  it('returns default for missing attribute', () => {
    const result = testAttrAsEnum({}, 'colorPrimaries');
    expect(result).toBe('bt709'); // Default
  });

  it('returns default for unknown value', () => {
    const result = testAttrAsEnum({colorPrimaries: 'unknown'}, 'colorPrimaries');
    expect(result).toBe('bt709'); // Default
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/attr-as-enum.test.ts
```

Expected: FAIL

**Step 3: Update src/common.h** (3 min)

Add template and mappings:

```cpp
// Template for FFmpeg enums with string mapping
template<typename T>
T AttrAsEnum(Napi::Object obj, const std::string& attr, T default_val,
             const std::unordered_map<std::string, T>& mapping) {
  std::string val = AttrAsStr(obj, attr);
  if (val.empty()) return default_val;
  auto it = mapping.find(val);
  return (it != mapping.end()) ? it->second : default_val;
}

// Predefined enum mappings
extern const std::unordered_map<std::string, AVColorPrimaries> kColorPrimariesMap;
extern const std::unordered_map<std::string, AVColorTransferCharacteristic> kTransferMap;
extern const std::unordered_map<std::string, AVColorSpace> kMatrixMap;

// String conversion for enums
std::string ColorPrimariesToString(AVColorPrimaries primaries);
std::string TransferToString(AVColorTransferCharacteristic transfer);
std::string MatrixToString(AVColorSpace matrix);
```

**Step 4: Update src/common.cc** (5 min)

Add mappings:

```cpp
const std::unordered_map<std::string, AVColorPrimaries> kColorPrimariesMap = {
  {"bt709", AVCOL_PRI_BT709},
  {"bt470bg", AVCOL_PRI_BT470BG},
  {"smpte170m", AVCOL_PRI_SMPTE170M},
  {"bt2020", AVCOL_PRI_BT2020},
  {"smpte432", AVCOL_PRI_SMPTE432},
};

const std::unordered_map<std::string, AVColorTransferCharacteristic> kTransferMap = {
  {"bt709", AVCOL_TRC_BT709},
  {"smpte170m", AVCOL_TRC_SMPTE170M},
  {"iec61966-2-1", AVCOL_TRC_IEC61966_2_1},  // sRGB
  {"linear", AVCOL_TRC_LINEAR},
  {"pq", AVCOL_TRC_SMPTE2084},
  {"hlg", AVCOL_TRC_ARIB_STD_B67},
};

const std::unordered_map<std::string, AVColorSpace> kMatrixMap = {
  {"bt709", AVCOL_SPC_BT709},
  {"bt470bg", AVCOL_SPC_BT470BG},
  {"smpte170m", AVCOL_SPC_SMPTE170M},
  {"bt2020-ncl", AVCOL_SPC_BT2020_NCL},
  {"rgb", AVCOL_SPC_RGB},
};

std::string ColorPrimariesToString(AVColorPrimaries primaries) {
  for (const auto& [name, val] : kColorPrimariesMap) {
    if (val == primaries) return name;
  }
  return "bt709";
}

std::string TransferToString(AVColorTransferCharacteristic transfer) {
  for (const auto& [name, val] : kTransferMap) {
    if (val == transfer) return name;
  }
  return "bt709";
}

std::string MatrixToString(AVColorSpace matrix) {
  for (const auto& [name, val] : kMatrixMap) {
    if (val == matrix) return name;
  }
  return "bt709";
}
```

**Step 5: Add test helper to addon.cc** (2 min)

```cpp
Napi::Value TestAttrAsEnum(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 2) return env.Null();

  Napi::Object obj = info[0].As<Napi::Object>();
  std::string attr = info[1].As<Napi::String>().Utf8Value();

  auto primaries = webcodecs::AttrAsEnum(obj, attr, AVCOL_PRI_BT709,
                                          webcodecs::kColorPrimariesMap);
  return Napi::String::New(env, webcodecs::ColorPrimariesToString(primaries));
}

// In InitAll:
exports.Set("testAttrAsEnum", Napi::Function::New(env, TestAttrAsEnum));
```

**Step 6: Export from lib/index.ts** (30 sec)

```typescript
export const testAttrAsEnum = binding.testAttrAsEnum;
```

**Step 7: Build and run test** (1 min)

```bash
npm run build && npx vitest run test/golden/attr-as-enum.test.ts
```

Expected: PASS (3 passed)

**Step 8: Commit** (30 sec)

```bash
git add src/common.h src/common.cc src/addon.cc lib/index.ts test/golden/attr-as-enum.test.ts
git commit -m "feat(common): add template AttrAsEnum with color space mappings"
```

---

### Task 5: Create VideoEncoderConfigDescriptor

**Files:**
- Create: `src/descriptors.h`
- Create: `src/descriptors.cc`
- Modify: `binding.gyp`
- Test: `test/golden/descriptors.test.ts`

**Step 1: Write the failing test** (3 min)

Create `test/golden/descriptors.test.ts`:

```typescript
import {describe, it, expect} from 'vitest';

const {createEncoderConfigDescriptor} = await import('../../dist/index.js');

describe('VideoEncoderConfigDescriptor', () => {
  it('extracts config with defaults', () => {
    const config = {
      codec: 'avc1.42E01E',
      width: 1920,
      height: 1080,
    };

    const desc = createEncoderConfigDescriptor(config);

    expect(desc.codec).toBe('avc1.42E01E');
    expect(desc.width).toBe(1920);
    expect(desc.height).toBe(1080);
    expect(desc.displayWidth).toBe(1920); // Defaults to width
    expect(desc.displayHeight).toBe(1080); // Defaults to height
    expect(desc.latencyMode).toBe('quality'); // Default
    expect(desc.bitrateMode).toBe('variable'); // Default
  });

  it('uses provided display dimensions', () => {
    const config = {
      codec: 'avc1.42E01E',
      width: 1920,
      height: 1080,
      displayWidth: 1280,
      displayHeight: 720,
    };

    const desc = createEncoderConfigDescriptor(config);
    expect(desc.displayWidth).toBe(1280);
    expect(desc.displayHeight).toBe(720);
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/descriptors.test.ts
```

Expected: FAIL

**Step 3: Create src/descriptors.h** (3 min)

```cpp
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#ifndef SRC_DESCRIPTORS_H_
#define SRC_DESCRIPTORS_H_

#include <cstdint>
#include <string>

#include <napi.h>

namespace webcodecs {

struct VideoEncoderConfigDescriptor {
  std::string codec = "";
  uint32_t width = 0;
  uint32_t height = 0;
  uint32_t displayWidth = 0;
  uint32_t displayHeight = 0;
  int64_t bitrate = 0;
  double framerate = 0.0;
  std::string latencyMode = "quality";
  std::string bitrateMode = "variable";
  std::string scalabilityMode = "";
  std::string hardwareAcceleration = "no-preference";
  std::string avc = "avc";
  std::string hevc = "hevc";

  // Color space
  std::string colorPrimaries = "";
  std::string colorTransfer = "";
  std::string colorMatrix = "";
  bool colorFullRange = false;

  VideoEncoderConfigDescriptor() = default;
};

VideoEncoderConfigDescriptor CreateEncoderConfigDescriptor(
    Napi::Env env, Napi::Object config);

Napi::Object EncoderConfigToJS(Napi::Env env,
                                const VideoEncoderConfigDescriptor& desc);

void InitDescriptors(Napi::Env env, Napi::Object exports);

}  // namespace webcodecs

#endif  // SRC_DESCRIPTORS_H_
```

**Step 4: Create src/descriptors.cc** (5 min)

```cpp
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

#include "src/descriptors.h"
#include "src/common.h"

namespace webcodecs {

VideoEncoderConfigDescriptor CreateEncoderConfigDescriptor(
    Napi::Env env, Napi::Object config) {
  VideoEncoderConfigDescriptor desc;

  desc.codec = AttrAsStr(config, "codec");
  desc.width = AttrAsUint32(config, "width");
  desc.height = AttrAsUint32(config, "height");

  // Display dimensions default to coded dimensions
  desc.displayWidth = AttrAsUint32(config, "displayWidth");
  if (desc.displayWidth == 0) desc.displayWidth = desc.width;

  desc.displayHeight = AttrAsUint32(config, "displayHeight");
  if (desc.displayHeight == 0) desc.displayHeight = desc.height;

  desc.bitrate = AttrAsInt64(config, "bitrate", 0);
  desc.framerate = AttrAsDouble(config, "framerate", 0.0);
  desc.latencyMode = AttrAsStr(config, "latencyMode", "quality");
  desc.bitrateMode = AttrAsStr(config, "bitrateMode", "variable");
  desc.scalabilityMode = AttrAsStr(config, "scalabilityMode", "");
  desc.hardwareAcceleration = AttrAsStr(config, "hardwareAcceleration",
                                         "no-preference");
  desc.avc = AttrAsStr(config, "avc", "avc");
  desc.hevc = AttrAsStr(config, "hevc", "hevc");

  // Color space from nested object
  if (HasAttr(config, "colorSpace")) {
    Napi::Object cs = config.Get("colorSpace").As<Napi::Object>();
    desc.colorPrimaries = AttrAsStr(cs, "primaries", "");
    desc.colorTransfer = AttrAsStr(cs, "transfer", "");
    desc.colorMatrix = AttrAsStr(cs, "matrix", "");
    desc.colorFullRange = AttrAsBool(cs, "fullRange", false);
  }

  return desc;
}

Napi::Object EncoderConfigToJS(Napi::Env env,
                                const VideoEncoderConfigDescriptor& desc) {
  Napi::Object obj = Napi::Object::New(env);

  obj.Set("codec", desc.codec);
  obj.Set("width", desc.width);
  obj.Set("height", desc.height);
  obj.Set("displayWidth", desc.displayWidth);
  obj.Set("displayHeight", desc.displayHeight);
  obj.Set("bitrate", static_cast<double>(desc.bitrate));
  obj.Set("framerate", desc.framerate);
  obj.Set("latencyMode", desc.latencyMode);
  obj.Set("bitrateMode", desc.bitrateMode);
  obj.Set("scalabilityMode", desc.scalabilityMode);
  obj.Set("hardwareAcceleration", desc.hardwareAcceleration);
  obj.Set("avc", desc.avc);
  obj.Set("hevc", desc.hevc);
  obj.Set("colorPrimaries", desc.colorPrimaries);
  obj.Set("colorTransfer", desc.colorTransfer);
  obj.Set("colorMatrix", desc.colorMatrix);
  obj.Set("colorFullRange", desc.colorFullRange);

  return obj;
}

Napi::Value CreateEncoderConfigDescriptorJS(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsObject()) {
    Napi::TypeError::New(env, "Expected config object")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  auto desc = CreateEncoderConfigDescriptor(env, info[0].As<Napi::Object>());
  return EncoderConfigToJS(env, desc);
}

void InitDescriptors(Napi::Env env, Napi::Object exports) {
  exports.Set("createEncoderConfigDescriptor",
              Napi::Function::New(env, CreateEncoderConfigDescriptorJS));
}

}  // namespace webcodecs
```

**Step 5: Add to binding.gyp and addon.cc** (1 min)

Add `"src/descriptors.cc"` to binding.gyp.

```cpp
#include "src/descriptors.h"
// In InitAll:
webcodecs::InitDescriptors(env, exports);
```

**Step 6: Export from lib/index.ts** (30 sec)

```typescript
export const createEncoderConfigDescriptor = binding.createEncoderConfigDescriptor;
```

**Step 7: Build and run test** (1 min)

```bash
npm run build && npx vitest run test/golden/descriptors.test.ts
```

Expected: PASS (2 passed)

**Step 8: Commit** (30 sec)

```bash
git add src/descriptors.h src/descriptors.cc binding.gyp src/addon.cc lib/index.ts test/golden/descriptors.test.ts
git commit -m "feat(descriptors): add VideoEncoderConfigDescriptor following sharp pattern"
```

---

## Phase 3: Platform Detection

### Task 6: Create lib/platform.ts

**Files:**
- Create: `lib/platform.ts`
- Modify: `lib/binding.ts`
- Test: `test/golden/platform.test.ts`

**Step 1: Write the failing test** (2 min)

Create `test/golden/platform.test.ts`:

```typescript
import {describe, it, expect} from 'vitest';
import {runtimePlatformArch, isPrebuiltAvailable, prebuiltPlatforms} from '../../lib/platform';

describe('Platform Detection', () => {
  it('returns valid platform-arch string', () => {
    const platform = runtimePlatformArch();
    expect(platform).toMatch(/^(darwin|linux|linuxmusl|win32)-(arm64|x64|arm|ia32)$/);
  });

  it('exports prebuilt platforms list', () => {
    expect(Array.isArray(prebuiltPlatforms)).toBe(true);
    expect(prebuiltPlatforms.length).toBeGreaterThan(0);
    expect(prebuiltPlatforms).toContain('darwin-arm64');
    expect(prebuiltPlatforms).toContain('linux-x64');
  });

  it('isPrebuiltAvailable returns boolean', () => {
    const available = isPrebuiltAvailable();
    expect(typeof available).toBe('boolean');
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
npx vitest run test/golden/platform.test.ts
```

Expected: FAIL with `Cannot find module`

**Step 3: Create lib/platform.ts** (4 min)

```typescript
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Platform detection following sharp's lib/platform.js pattern.

import * as os from 'os';

// Try to detect musl vs glibc on Linux
function detectLibc(): 'glibc' | 'musl' | null {
  if (os.platform() !== 'linux') return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {familySync} = require('detect-libc');
    return familySync() === 'musl' ? 'musl' : 'glibc';
  } catch {
    // detect-libc not available, assume glibc
    return 'glibc';
  }
}

/**
 * Get the runtime platform-architecture string.
 * Handles musl vs glibc distinction on Linux.
 */
export function runtimePlatformArch(): string {
  const platform = os.platform();
  const arch = os.arch();

  if (platform === 'linux') {
    const libc = detectLibc();
    if (libc === 'musl') {
      return `linuxmusl-${arch}`;
    }
  }

  return `${platform}-${arch}`;
}

/**
 * Platforms with prebuilt binaries available.
 */
export const prebuiltPlatforms = [
  'darwin-arm64',
  'darwin-x64',
  'linux-arm64',
  'linux-x64',
  'linuxmusl-x64',
  'linuxmusl-arm64',
  'win32-x64',
  'win32-arm64',
] as const;

export type PrebuiltPlatform = (typeof prebuiltPlatforms)[number];

/**
 * Check if a prebuilt binary is available for the current platform.
 */
export function isPrebuiltAvailable(): boolean {
  const platform = runtimePlatformArch();
  return prebuiltPlatforms.includes(platform as PrebuiltPlatform);
}

/**
 * Get the npm package name for the prebuilt binary.
 */
export function getPrebuiltPackageName(): string {
  return `@ffmpeg/node-webcodecs-${runtimePlatformArch()}`;
}
```

**Step 4: Run test** (30 sec)

```bash
npm run build:ts && npx vitest run test/golden/platform.test.ts
```

Expected: PASS (3 passed)

**Step 5: Commit** (30 sec)

```bash
git add lib/platform.ts test/golden/platform.test.ts
git commit -m "feat(platform): add platform detection module following sharp pattern"
```

---

### Task 7: Update lib/binding.ts with Enhanced Loader

**Files:**
- Modify: `lib/binding.ts`
- Test: `test/golden/binding-loader.test.ts`

**Step 1: Write the test** (2 min)

Create `test/golden/binding-loader.test.ts`:

```typescript
import {describe, it, expect} from 'vitest';
import {binding, platformInfo} from '../../lib/binding';

describe('Binding Loader', () => {
  it('loads native binding successfully', () => {
    expect(binding).toBeDefined();
    expect(typeof binding.VideoEncoder).toBe('function');
  });

  it('exports platformInfo', () => {
    expect(platformInfo).toBeDefined();
    expect(platformInfo.platform).toBeDefined();
    expect(platformInfo.arch).toBeDefined();
    expect(typeof platformInfo.nodeVersion).toBe('string');
  });
});
```

**Step 2: Update lib/binding.ts** (5 min)

Replace with enhanced version:

```typescript
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Native binding loader with fallback chain and enhanced error messages.

import * as path from 'path';
import * as fs from 'fs';
import {runtimePlatformArch, isPrebuiltAvailable, getPrebuiltPackageName} from './platform';

const rootDir = path.resolve(__dirname, '..');

type LoadCandidate = string | (() => unknown);

const candidates: LoadCandidate[] = [
  // Development build (node-gyp output)
  path.join(rootDir, 'build', 'Release', 'node_webcodecs.node'),
  path.join(rootDir, 'build', 'Debug', 'node_webcodecs.node'),

  // node-gyp-build compatible
  () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('node-gyp-build')(rootDir);
    } catch {
      throw new Error('node-gyp-build not available');
    }
  },

  // Prebuilt from platform package
  () => {
    const pkg = getPrebuiltPackageName();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(pkg);
  },
];

function getPlatformBuildInstructions(): string {
  const platform = process.platform;

  if (platform === 'darwin') {
    return `  brew install ffmpeg pkg-config
  npm run build:native`;
  }
  if (platform === 'linux') {
    return `  sudo apt-get install libavcodec-dev libavutil-dev libswscale-dev libswresample-dev libavfilter-dev pkg-config
  npm run build:native`;
  }
  if (platform === 'win32') {
    return `  Download FFmpeg from https://github.com/BtbN/FFmpeg-Builds/releases
  Set FFMPEG_PATH environment variable
  npm run build:native`;
  }
  return `  Install FFmpeg development libraries
  npm run build:native`;
}

function buildHelpMessage(errors: Array<{path: string; error: Error}>): string {
  const platform = runtimePlatformArch();
  const hasPrebuilt = isPrebuiltAvailable();

  let msg = `Could not load native binding for ${platform}.\n\n`;
  msg += `Node.js: ${process.version}\n\n`;

  msg += 'Attempted paths:\n';
  for (const {path: p, error} of errors) {
    msg += `  - ${p}: ${error.message}\n`;
  }

  msg += '\nPossible solutions:\n';

  if (hasPrebuilt) {
    msg += `  1. Install with optional dependencies:\n`;
    msg += `     npm install --include=optional\n\n`;
    msg += `  2. Build from source:\n`;
  } else {
    msg += `  1. Build from source:\n`;
  }

  msg += getPlatformBuildInstructions();

  return msg;
}

function loadBinding(): unknown {
  const errors: Array<{path: string; error: Error}> = [];

  for (const candidate of candidates) {
    try {
      if (typeof candidate === 'function') {
        const binding = candidate();
        if (binding && typeof (binding as Record<string, unknown>).VideoEncoder === 'function') {
          return binding;
        }
        throw new Error('Invalid binding: missing VideoEncoder');
      }

      if (!fs.existsSync(candidate)) {
        continue;
      }

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const binding = require(candidate);
      if (typeof binding.VideoEncoder !== 'function') {
        throw new Error('Invalid binding: missing VideoEncoder');
      }
      return binding;
    } catch (err) {
      errors.push({
        path: typeof candidate === 'string' ? candidate : 'dynamic loader',
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }

  throw new Error(buildHelpMessage(errors));
}

export const binding = loadBinding();

export const platformInfo = {
  platform: process.platform,
  arch: process.arch,
  runtimePlatform: runtimePlatformArch(),
  nodeVersion: process.version,
  napiVersion: (process.versions as Record<string, string>).napi ?? 'unknown',
  prebuiltAvailable: isPrebuiltAvailable(),
};
```

**Step 3: Build and run test** (1 min)

```bash
npm run build:ts && npx vitest run test/golden/binding-loader.test.ts
```

Expected: PASS (2 passed)

**Step 4: Commit** (30 sec)

```bash
git add lib/binding.ts test/golden/binding-loader.test.ts
git commit -m "refactor(binding): enhance loader with platform detection and error messages"
```

---

## Phase 4: Code Review

### Task 8: Code Review

Run full test suite and verify:

```bash
npm run lint
npm test
npm run build
```

**Verification Checklist:**
- [ ] All new tests pass
- [ ] Existing tests still pass
- [ ] No lint errors
- [ ] Build succeeds
- [ ] Error messages include FFmpeg context
- [ ] Warnings are captured from FFmpeg

---

## Parallel Groups Summary

| Group | Tasks | Rationale |
|-------|-------|-----------|
| 1 | 1, 2, 3 | Error/Diagnostics - serial (shared common.cc) |
| 2 | 4, 5 | Configuration - serial (common.h dependencies) |
| 3 | 6, 7 | Platform - can run parallel after Group 2 |
| 4 | 8 | Code Review - final |

---

## Files Created/Modified

| Task | New Files | Modified Files |
|------|-----------|----------------|
| 1 | src/warnings.h, src/warnings.cc, test/golden/warnings.test.ts | binding.gyp, src/addon.cc, lib/index.ts |
| 2 | src/error_builder.h, src/error_builder.cc, test/golden/error-builder.test.ts | binding.gyp, src/addon.cc, lib/index.ts |
| 3 | test/golden/ffmpeg-logging.test.ts | src/common.h, src/common.cc, src/addon.cc, lib/index.ts |
| 4 | test/golden/attr-as-enum.test.ts | src/common.h, src/common.cc, src/addon.cc, lib/index.ts |
| 5 | src/descriptors.h, src/descriptors.cc, test/golden/descriptors.test.ts | binding.gyp, src/addon.cc, lib/index.ts |
| 6 | lib/platform.ts, test/golden/platform.test.ts | - |
| 7 | test/golden/binding-loader.test.ts | lib/binding.ts |
