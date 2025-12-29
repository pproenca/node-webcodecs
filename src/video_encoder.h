#ifndef VIDEO_ENCODER_H
#define VIDEO_ENCODER_H

#include <napi.h>

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavutil/opt.h>
#include <libavutil/imgutils.h>
#include <libswscale/swscale.h>
}

class VideoEncoder : public Napi::ObjectWrap<VideoEncoder> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    VideoEncoder(const Napi::CallbackInfo& info);
    ~VideoEncoder();

private:
    // WebCodecs API methods
    Napi::Value Configure(const Napi::CallbackInfo& info);
    Napi::Value Encode(const Napi::CallbackInfo& info);
    Napi::Value Flush(const Napi::CallbackInfo& info);
    void Close(const Napi::CallbackInfo& info);
    Napi::Value GetState(const Napi::CallbackInfo& info);
    Napi::Value GetEncodeQueueSize(const Napi::CallbackInfo& info);

    // Internal helpers
    void Cleanup();
    void EmitChunks(Napi::Env env);

    // FFmpeg state
    const AVCodec* codec_;
    AVCodecContext* codecContext_;
    SwsContext* swsContext_;
    AVFrame* frame_;
    AVPacket* packet_;

    // Callbacks
    Napi::FunctionReference outputCallback_;
    Napi::FunctionReference errorCallback_;

    // State
    std::string state_;
    int width_;
    int height_;
    int64_t frameCount_;
    int encodeQueueSize_;
};

#endif
