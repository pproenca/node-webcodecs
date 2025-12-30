{
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
        "src/image_decoder.cc",
        "src/async_encode_worker.cc",
        "src/async_decode_worker.cc"
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
            "<!@(pkg-config --cflags-only-I libavcodec libavutil libswscale libswresample libavfilter 2>/dev/null | sed s/-I//g || echo '/opt/homebrew/include /usr/local/include')"
          ],
          "libraries": [
            "<!@(pkg-config --libs libavcodec libavutil libswscale libswresample libavfilter 2>/dev/null || echo '-L/opt/homebrew/lib -L/usr/local/lib -lavcodec -lavutil -lswscale -lswresample -lavfilter')"
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
            "<!@(pkg-config --cflags-only-I libavcodec libavutil libswscale libswresample libavfilter | sed s/-I//g)"
          ],
          "libraries": [
            "<!@(pkg-config --libs libavcodec libavutil libswscale libswresample libavfilter)"
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
        ["OS=='win'", {
          "include_dirs": [
            "<!(echo %FFMPEG_PATH%)/include"
          ],
          "libraries": [
            "-l<!(echo %FFMPEG_PATH%)/lib/avcodec",
            "-l<!(echo %FFMPEG_PATH%)/lib/avutil",
            "-l<!(echo %FFMPEG_PATH%)/lib/swscale",
            "-l<!(echo %FFMPEG_PATH%)/lib/swresample",
            "-l<!(echo %FFMPEG_PATH%)/lib/avfilter"
          ],
          "msvs_settings": {
            "VCCLCompilerTool": {
              "AdditionalOptions": ["/std:c++17", "/EHsc"],
              "ExceptionHandling": 1
            }
          },
          "defines": ["_HAS_EXCEPTIONS=1"]
        }]
      ]
    }
  ]
}
