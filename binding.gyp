{
  "variables": {
    "enable_sanitizers%": 0
  },
  "target_defaults": {
    "default_configuration": "Release",
    "configurations": {
      "Debug": {
        "defines": ["DEBUG", "_DEBUG"],
        "cflags_cc": ["-g", "-O0"],
        "xcode_settings": {
          "GCC_OPTIMIZATION_LEVEL": "0",
          "GCC_GENERATE_DEBUGGING_SYMBOLS": "YES"
        }
      },
      "Release": {
        "defines": ["NDEBUG"],
        "cflags_cc": ["-O3"],
        "xcode_settings": {
          "GCC_OPTIMIZATION_LEVEL": "3",
          "GCC_GENERATE_DEBUGGING_SYMBOLS": "NO"
        }
      }
    }
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
        "src/video_decoder_worker.cc",
        "src/video_encoder_worker.cc",
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
            "<!@(node gyp/ffmpeg-paths.js include 2>/dev/null || pkg-config --cflags-only-I libavcodec libavutil libswscale libswresample libavfilter 2>/dev/null | sed s/-I//g || echo '/opt/homebrew/include /usr/local/include /opt/local/include')"
          ],
          "libraries": [
            "<!@(node gyp/ffmpeg-paths.js lib 2>/dev/null || (pkg-config --libs libavcodec libavformat libavutil libswscale libswresample libavfilter 2>/dev/null | sed 's/-framework [^ ]*//g') || echo '-L/opt/homebrew/lib -L/usr/local/lib -L/opt/local/lib -lavcodec -lavformat -lavutil -lswscale -lswresample -lavfilter')",
            "-framework VideoToolbox",
            "-framework AudioToolbox",
            "-framework CoreMedia",
            "-framework CoreVideo",
            "-framework CoreFoundation",
            "-framework CoreServices",
            "-framework Security",
            "-framework Metal",
            "-framework CoreImage",
            "-framework AppKit",
            "-liconv",
            "-lbz2",
            "-lz"
          ],
          "xcode_settings": {
            "CLANG_CXX_LANGUAGE_STANDARD": "c++20",
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
            "GCC_ENABLE_CPP_RTTI": "YES",
            "MACOSX_DEPLOYMENT_TARGET": "11.0",
            "OTHER_CPLUSPLUSFLAGS": [
              "-fexceptions",
              "-Wall",
              "-Wextra",
              "-Wpedantic",
              "-Wshadow",
              "-Wno-unused-parameter"
            ],
            "OTHER_LDFLAGS": [
              "-mmacosx-version-min=11.0",
              "-Wl,-rpath,@loader_path/../lib"
            ]
          }
        }],
        ["OS=='linux'", {
          "include_dirs": [
            "<!@(node gyp/ffmpeg-paths.js include 2>/dev/null || pkg-config --cflags-only-I libavcodec libavutil libswscale libswresample libavfilter 2>/dev/null | sed s/-I//g || echo '/usr/include /usr/local/include')"
          ],
          "libraries": [
            "<!@(node gyp/ffmpeg-paths.js lib 2>/dev/null || pkg-config --libs --static libavcodec libavformat libavutil libswscale libswresample libavfilter 2>/dev/null || pkg-config --libs libavcodec libavformat libavutil libswscale libswresample libavfilter 2>/dev/null || echo '-L/usr/lib -L/usr/local/lib -lavcodec -lavformat -lavutil -lswscale -lswresample -lavfilter')",
            "-lpthread",
            "-lm",
            "-ldl",
            "-lz"
          ],
          "ldflags": [
            "-Wl,-Bsymbolic",
            "-Wl,-rpath,$ORIGIN/../lib"
          ],
          "cflags_cc": [
            "-std=c++20",
            "-fexceptions",
            "-Wall",
            "-Wextra",
            "-Wpedantic",
            "-Wshadow",
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
