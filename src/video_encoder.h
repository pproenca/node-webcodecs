#ifndef VIDEO_ENCODER_H
#define VIDEO_ENCODER_H

#include <napi.h>
#include <thread>
#include <mutex>
#include <condition_variable>
#include <queue>
#include <atomic>
#include <vector>
#include <utility>

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavutil/opt.h>
#include <libavutil/imgutils.h>
#include <libswscale/swscale.h>
}

class VideoEncoder : public Napi::ObjectWrap<VideoEncoder> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    static Napi::Value IsConfigSupported(const Napi::CallbackInfo& info);
    VideoEncoder(const Napi::CallbackInfo& info);
    ~VideoEncoder();

private:
    // WebCodecs API methods
    Napi::Value Configure(const Napi::CallbackInfo& info);
    Napi::Value Encode(const Napi::CallbackInfo& info);
    Napi::Value Flush(const Napi::CallbackInfo& info);
    Napi::Value Reset(const Napi::CallbackInfo& info);
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

    // Threading
    std::thread encoderThread_;
    std::mutex queueMutex_;
    std::condition_variable queueCondition_;
    std::atomic<bool> threadRunning_{false};

    // Request types
    struct EncodeRequest {
        std::vector<uint8_t> frameData;
        int width;
        int height;
        int64_t timestamp;
        bool forceKeyFrame;
    };

    struct FlushSentinel {
        uint32_t resetCount;
    };

    std::queue<EncodeRequest> encodeQueue_;
    std::queue<FlushSentinel> flushQueue_;

    // Thread-safe callbacks
    Napi::ThreadSafeFunction outputTsfn_;
    Napi::ThreadSafeFunction dequeueTsfn_;

    // Dequeue event coalescing
    std::atomic<bool> dequeueEventScheduled_{false};

    // Flush promise tracking
    std::mutex flushMutex_;
    std::vector<std::pair<uint32_t, Napi::Promise::Deferred>> pendingFlushPromises_;
    std::atomic<uint32_t> resetCount_{0};

    // Atomic encodeQueueSize for thread safety
    std::atomic<int> encodeQueueSize_{0};

    // Thread functions
    void EncoderThreadFunc();
    void ScheduleDequeueEvent();
    void ProcessEncodeRequest(const EncodeRequest& request);
    void StartThread(Napi::Env env);
    void StopThread();
    void EmitChunksThreadSafe();
};

#endif
