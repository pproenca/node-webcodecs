{
  "variables": {
    "enable_sanitizers%": 0
  },
  "targets": [
    {
      "target_name": "node_webcodecs",
      "sources": [
        "src/addon.cc",
        "src/common.cc",
        "src/video_encoder.cc",
        "src/video_decoder.cc",
        "src/video_frame.cc",
        "src/audio_encoder.cc",
        "src/audio_decoder.cc",
        "src/audio_data.cc",
        "src/encoded_video_chunk.cc",
        "src/encoded_audio_chunk.cc",
        "src/video_filter.cc",
        "src/demuxer.cc",
        "src/muxer.cc",
        "src/image_decoder.cc",
        "src/test_video_generator.cc",
        "src/async_encode_worker.cc",
        "src/async_decode_worker.cc",
        "src/warnings.cc",
        "src/error_builder.cc",
        "src/descriptors.cc"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "."
      ],
      "defines": [
        "NAPI_VERSION=8",
        "NAPI_CPP_EXCEPTIONS",
        "NODE_ADDON_API_DISABLE_DEPRECATED"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "conditions": [
        ["OS=='mac'", {
          "include_dirs": [
            "<!@(node gyp/ffmpeg-paths.js include 2>/dev/null || pkg-config --cflags-only-I libavcodec libavutil libswscale libswresample libavfilter 2>/dev/null | sed s/-I//g || echo '/opt/homebrew/include /usr/local/include')"
          ],
          "libraries": [
            "<!@(node gyp/ffmpeg-paths.js lib 2>/dev/null || echo '')",
            "<!@(pkg-config --libs libavcodec libavutil libswscale libswresample libavfilter 2>/dev/null || echo '-L/opt/homebrew/lib -L/usr/local/lib -lavcodec -lavutil -lswscale -lswresample -lavfilter')",
            "<!@(node gyp/ffmpeg-paths.js rpath 2>/dev/null || echo '')"
          ],
          "xcode_settings": {
            "CLANG_CXX_LANGUAGE_STANDARD": "c++17",
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
            "GCC_ENABLE_CPP_RTTI": "YES",
            "MACOSX_DEPLOYMENT_TARGET": "10.15",
            "OTHER_CPLUSPLUSFLAGS": [
              "-fexceptions",
              "-Wall",
              "-Wextra",
              "-Wno-unused-parameter"
            ]
          }
        }],
        ["OS=='linux'", {
          "include_dirs": [
            "<!@(node gyp/ffmpeg-paths.js include 2>/dev/null || pkg-config --cflags-only-I libavcodec libavutil libswscale libswresample libavfilter | sed s/-I//g)"
          ],
          "libraries": [
            "<!@(node gyp/ffmpeg-paths.js lib 2>/dev/null || echo '')",
            "<!@(pkg-config --libs libavcodec libavutil libswscale libswresample libavfilter)",
            "<!@(node gyp/ffmpeg-paths.js rpath 2>/dev/null || echo '')"
          ],
          "cflags_cc": [
            "-std=c++17",
            "-fexceptions",
            "-Wall",
            "-Wextra",
            "-Wno-unused-parameter",
            "-fPIC"
          ]
        }],
        ["enable_sanitizers==1", {
          "cflags_cc": [
            "-fsanitize=address,undefined",
            "-fno-omit-frame-pointer"
          ],
          "ldflags": [
            "-fsanitize=address,undefined"
          ],
          "xcode_settings": {
            "OTHER_CFLAGS": [
              "-fsanitize=address,undefined",
              "-fno-omit-frame-pointer"
            ],
            "OTHER_LDFLAGS": [
              "-fsanitize=address,undefined"
            ]
          }
        }]
      ]
    }
  ]
}
