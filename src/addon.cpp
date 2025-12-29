#include <napi.h>

// Forward declarations
Napi::Object InitVideoEncoder(Napi::Env env, Napi::Object exports);
Napi::Object InitVideoFrame(Napi::Env env, Napi::Object exports);

Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
    InitVideoEncoder(env, exports);
    InitVideoFrame(env, exports);
    return exports;
}

NODE_API_MODULE(node_webcodecs, InitAll)
