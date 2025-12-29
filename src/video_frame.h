#ifndef VIDEO_FRAME_H
#define VIDEO_FRAME_H

#include <napi.h>
#include <vector>

class VideoFrame : public Napi::ObjectWrap<VideoFrame> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    VideoFrame(const Napi::CallbackInfo& info);
    ~VideoFrame();

    // Getters
    Napi::Value GetCodedWidth(const Napi::CallbackInfo& info);
    Napi::Value GetCodedHeight(const Napi::CallbackInfo& info);
    Napi::Value GetTimestamp(const Napi::CallbackInfo& info);
    Napi::Value GetFormat(const Napi::CallbackInfo& info);

    // Methods
    void Close(const Napi::CallbackInfo& info);

    // Internal accessors for VideoEncoder
    uint8_t* GetData() { return data_.data(); }
    size_t GetDataSize() { return data_.size(); }
    int GetWidth() { return codedWidth_; }
    int GetHeight() { return codedHeight_; }

private:
    std::vector<uint8_t> data_;
    int codedWidth_;
    int codedHeight_;
    int64_t timestamp_;
    std::string format_;
    bool closed_;
};

#endif
