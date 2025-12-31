// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// ImageDecoder implementation wrapping FFmpeg image decoders.
// Supports both static images and animated formats (GIF, WebP).

#include "src/image_decoder.h"

#include <algorithm>
#include <cstring>
#include <limits>
#include <string>
#include <utility>
#include <vector>

#include "src/common.h"
#include "src/video_frame.h"

// Buffer size for AVIOContext (4KB is typical for image data)
static const int kAVIOBufferSize = 4096;

// Custom read callback for AVIOContext to read from memory buffer
struct MemoryBufferContext {
  const uint8_t* data;
  size_t size;
  size_t position;
};

static int ReadPacket(void* opaque, uint8_t* buf, int buf_size) {
  MemoryBufferContext* ctx = static_cast<MemoryBufferContext*>(opaque);
  int64_t remaining = static_cast<int64_t>(ctx->size - ctx->position);
  if (remaining <= 0) {
    return AVERROR_EOF;
  }
  int to_read = std::min(static_cast<int>(remaining), buf_size);
  memcpy(buf, ctx->data + ctx->position, to_read);
  ctx->position += to_read;
  return to_read;
}

static int64_t SeekPacket(void* opaque, int64_t offset, int whence) {
  MemoryBufferContext* ctx = static_cast<MemoryBufferContext*>(opaque);
  int64_t new_pos = 0;

  switch (whence) {
    case SEEK_SET:
      new_pos = offset;
      break;
    case SEEK_CUR:
      new_pos = static_cast<int64_t>(ctx->position) + offset;
      break;
    case SEEK_END:
      new_pos = static_cast<int64_t>(ctx->size) + offset;
      break;
    case AVSEEK_SIZE:
      return static_cast<int64_t>(ctx->size);
    default:
      return AVERROR(EINVAL);
  }

  if (new_pos < 0 || new_pos > static_cast<int64_t>(ctx->size)) {
    return AVERROR(EINVAL);
  }
  ctx->position = static_cast<size_t>(new_pos);
  return new_pos;
}

Napi::Object ImageDecoder::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func = DefineClass(
      env, "ImageDecoder",
      {
          InstanceMethod("decode", &ImageDecoder::Decode),
          InstanceMethod("close", &ImageDecoder::Close),
          InstanceAccessor("type", &ImageDecoder::GetType, nullptr),
          InstanceAccessor("complete", &ImageDecoder::GetComplete, nullptr),
          InstanceAccessor("tracks", &ImageDecoder::GetTracks, nullptr),
          StaticMethod("isTypeSupported", &ImageDecoder::IsTypeSupported),
      });

  Napi::FunctionReference* constructor = new Napi::FunctionReference();
  *constructor = Napi::Persistent(func);
  env.SetInstanceData(constructor);

  exports.Set("ImageDecoder", func);
  return exports;
}

ImageDecoder::ImageDecoder(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<ImageDecoder>(info),
      codec_(nullptr),
      codec_context_(nullptr),
      sws_context_(nullptr),
      frame_(nullptr),
      packet_(nullptr),
      format_context_(nullptr),
      avio_context_(nullptr),
      mem_ctx_(nullptr),
      video_stream_index_(-1),
      decoded_width_(0),
      decoded_height_(0),
      animated_(false),
      frame_count_(1),
      repetition_count_(0),
      complete_(false),
      closed_(false) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsObject()) {
    Napi::TypeError::New(env, "ImageDecoder init object is required")
        .ThrowAsJavaScriptException();
    return;
  }

  Napi::Object init = info[0].As<Napi::Object>();

  // Get type (MIME type)
  if (!webcodecs::HasAttr(init, "type") || !init.Get("type").IsString()) {
    Napi::TypeError::New(env, "type is required and must be a string")
        .ThrowAsJavaScriptException();
    return;
  }
  type_ = webcodecs::AttrAsStr(init, "type");

  // Get data
  if (!init.Has("data")) {
    Napi::TypeError::New(env, "data is required").ThrowAsJavaScriptException();
    return;
  }

  Napi::Value data_value = init.Get("data");
  if (data_value.IsBuffer()) {
    Napi::Buffer<uint8_t> buf = data_value.As<Napi::Buffer<uint8_t>>();
    data_.assign(buf.Data(), buf.Data() + buf.Length());
  } else if (data_value.IsTypedArray()) {
    Napi::TypedArray typed_array = data_value.As<Napi::TypedArray>();
    Napi::ArrayBuffer array_buffer = typed_array.ArrayBuffer();
    size_t offset = typed_array.ByteOffset();
    size_t length = typed_array.ByteLength();
    uint8_t* data_ptr = static_cast<uint8_t*>(array_buffer.Data()) + offset;
    data_.assign(data_ptr, data_ptr + length);
  } else {
    Napi::TypeError::New(env, "data must be Buffer or TypedArray")
        .ThrowAsJavaScriptException();
    return;
  }

  // Map MIME type to FFmpeg codec
  AVCodecID codec_id = MimeTypeToCodecId(type_);
  if (codec_id == AV_CODEC_ID_NONE) {
    Napi::TypeError::New(env, "Unsupported image type: " + type_)
        .ThrowAsJavaScriptException();
    return;
  }

  // Find decoder
  codec_ = avcodec_find_decoder(codec_id);
  if (!codec_) {
    Napi::Error::New(env, "Decoder not found for: " + type_)
        .ThrowAsJavaScriptException();
    return;
  }

  // Create codec context
  codec_context_ = avcodec_alloc_context3(codec_);
  if (!codec_context_) {
    Napi::Error::New(env, "Failed to allocate codec context")
        .ThrowAsJavaScriptException();
    return;
  }

  // Open codec
  if (avcodec_open2(codec_context_, codec_, nullptr) < 0) {
    Cleanup();
    Napi::Error::New(env, "Failed to open codec").ThrowAsJavaScriptException();
    return;
  }

  // Allocate frame and packet
  frame_ = av_frame_alloc();
  packet_ = av_packet_alloc();
  if (!frame_ || !packet_) {
    Cleanup();
    Napi::Error::New(env, "Failed to allocate frame/packet")
        .ThrowAsJavaScriptException();
    return;
  }

  // For animated formats, parse container to get frame count and loop info
  if (IsAnimatedFormat(type_)) {
    if (ParseAnimatedImageMetadata()) {
      complete_ = true;
    } else {
      // Fall back to static image decoding if animated parsing fails
      if (DecodeImage()) {
        complete_ = true;
      }
    }
  } else {
    // Pre-decode static image to get metadata
    if (DecodeImage()) {
      complete_ = true;
    }
  }
}

ImageDecoder::~ImageDecoder() { Cleanup(); }

void ImageDecoder::Cleanup() {
  if (sws_context_) {
    sws_freeContext(sws_context_);
    sws_context_ = nullptr;
  }
  if (frame_) {
    av_frame_free(&frame_);
    frame_ = nullptr;
  }
  if (packet_) {
    av_packet_free(&packet_);
    packet_ = nullptr;
  }
  if (codec_context_) {
    avcodec_free_context(&codec_context_);
    codec_context_ = nullptr;
  }
  if (format_context_) {
    avformat_close_input(&format_context_);
    format_context_ = nullptr;
  }
  // Free MemoryBufferContext BEFORE avio_context_free (it's stored in opaque)
  if (mem_ctx_) {
    delete mem_ctx_;
    mem_ctx_ = nullptr;
  }
  if (avio_context_) {
    // The buffer is freed by avio_context_free
    av_freep(&avio_context_->buffer);
    avio_context_free(&avio_context_);
    avio_context_ = nullptr;
  }
  decoded_frames_.clear();
}

AVCodecID ImageDecoder::MimeTypeToCodecId(const std::string& mime_type) {
  if (mime_type == "image/png") {
    return AV_CODEC_ID_PNG;
  } else if (mime_type == "image/jpeg" || mime_type == "image/jpg") {
    return AV_CODEC_ID_MJPEG;
  } else if (mime_type == "image/gif") {
    return AV_CODEC_ID_GIF;
  } else if (mime_type == "image/webp") {
    return AV_CODEC_ID_WEBP;
  } else if (mime_type == "image/bmp") {
    return AV_CODEC_ID_BMP;
  } else if (mime_type == "image/tiff") {
    return AV_CODEC_ID_TIFF;
  }
  return AV_CODEC_ID_NONE;
}

bool ImageDecoder::IsAnimatedFormat(const std::string& mime_type) {
  return mime_type == "image/gif" || mime_type == "image/webp";
}

bool ImageDecoder::ConvertFrameToRGBA(AVFrame* src_frame,
                                      std::vector<uint8_t>* output) {
  if (!src_frame || !output) {
    return false;
  }

  // Create swscale context for conversion to RGBA
  SwsContext* local_sws =
      sws_getContext(src_frame->width, src_frame->height,
                     static_cast<AVPixelFormat>(src_frame->format),
                     src_frame->width, src_frame->height, AV_PIX_FMT_RGBA,
                     SWS_BILINEAR, nullptr, nullptr, nullptr);

  if (!local_sws) {
    return false;
  }

  // Allocate output buffer
  int output_size = av_image_get_buffer_size(AV_PIX_FMT_RGBA, src_frame->width,
                                             src_frame->height, 1);
  output->resize(output_size);

  // Set up output planes
  uint8_t* dest_data[4] = {output->data(), nullptr, nullptr, nullptr};
  int dest_linesize[4] = {src_frame->width * 4, 0, 0, 0};

  // Convert
  sws_scale(local_sws, src_frame->data, src_frame->linesize, 0,
            src_frame->height, dest_data, dest_linesize);

  sws_freeContext(local_sws);
  return true;
}

bool ImageDecoder::ParseAnimatedImageMetadata() {
  if (data_.empty()) {
    return false;
  }

  // Allocate memory buffer context for custom I/O
  mem_ctx_ = new MemoryBufferContext();
  mem_ctx_->data = data_.data();
  mem_ctx_->size = data_.size();
  mem_ctx_->position = 0;

  // Allocate AVIO buffer
  uint8_t* avio_buffer = static_cast<uint8_t*>(av_malloc(kAVIOBufferSize));
  if (!avio_buffer) {
    delete mem_ctx_;
    mem_ctx_ = nullptr;
    return false;
  }

  // Create custom AVIO context
  avio_context_ = avio_alloc_context(avio_buffer, kAVIOBufferSize, 0, mem_ctx_,
                                     ReadPacket, nullptr, SeekPacket);
  if (!avio_context_) {
    av_free(avio_buffer);
    delete mem_ctx_;
    mem_ctx_ = nullptr;
    return false;
  }

  // Allocate format context
  format_context_ = avformat_alloc_context();
  if (!format_context_) {
    av_freep(&avio_context_->buffer);
    avio_context_free(&avio_context_);
    delete mem_ctx_;
    mem_ctx_ = nullptr;
    return false;
  }

  format_context_->pb = avio_context_;
  format_context_->flags |= AVFMT_FLAG_CUSTOM_IO;

  // Determine format based on MIME type
  const AVInputFormat* input_format = nullptr;
  if (type_ == "image/gif") {
    input_format = av_find_input_format("gif");
  } else if (type_ == "image/webp") {
    input_format = av_find_input_format("webp");
  }

  // Open input
  int ret =
      avformat_open_input(&format_context_, nullptr, input_format, nullptr);
  if (ret < 0) {
    // format_context_ is freed by avformat_open_input on failure
    format_context_ = nullptr;
    av_freep(&avio_context_->buffer);
    avio_context_free(&avio_context_);
    avio_context_ = nullptr;
    delete mem_ctx_;
    mem_ctx_ = nullptr;
    return false;
  }

  // Find stream info
  ret = avformat_find_stream_info(format_context_, nullptr);
  if (ret < 0) {
    avformat_close_input(&format_context_);
    av_freep(&avio_context_->buffer);
    avio_context_free(&avio_context_);
    avio_context_ = nullptr;
    delete mem_ctx_;
    mem_ctx_ = nullptr;
    return false;
  }

  // Find video stream
  video_stream_index_ = -1;
  for (unsigned int i = 0; i < format_context_->nb_streams; i++) {
    if (format_context_->streams[i]->codecpar->codec_type ==
        AVMEDIA_TYPE_VIDEO) {
      video_stream_index_ = i;
      break;
    }
  }

  if (video_stream_index_ < 0) {
    avformat_close_input(&format_context_);
    av_freep(&avio_context_->buffer);
    avio_context_free(&avio_context_);
    avio_context_ = nullptr;
    delete mem_ctx_;
    mem_ctx_ = nullptr;
    return false;
  }

  AVStream* video_stream = format_context_->streams[video_stream_index_];
  AVCodecParameters* codecpar = video_stream->codecpar;

  // Get dimensions
  decoded_width_ = codecpar->width;
  decoded_height_ = codecpar->height;

  // Find decoder for the stream
  const AVCodec* stream_codec = avcodec_find_decoder(codecpar->codec_id);
  if (!stream_codec) {
    avformat_close_input(&format_context_);
    av_freep(&avio_context_->buffer);
    avio_context_free(&avio_context_);
    avio_context_ = nullptr;
    delete mem_ctx_;
    mem_ctx_ = nullptr;
    return false;
  }

  // Allocate new codec context for the stream
  AVCodecContext* stream_codec_ctx = avcodec_alloc_context3(stream_codec);
  if (!stream_codec_ctx) {
    avformat_close_input(&format_context_);
    av_freep(&avio_context_->buffer);
    avio_context_free(&avio_context_);
    avio_context_ = nullptr;
    delete mem_ctx_;
    mem_ctx_ = nullptr;
    return false;
  }

  // Copy codec parameters
  ret = avcodec_parameters_to_context(stream_codec_ctx, codecpar);
  if (ret < 0) {
    avcodec_free_context(&stream_codec_ctx);
    avformat_close_input(&format_context_);
    av_freep(&avio_context_->buffer);
    avio_context_free(&avio_context_);
    avio_context_ = nullptr;
    delete mem_ctx_;
    mem_ctx_ = nullptr;
    return false;
  }

  // Open codec
  ret = avcodec_open2(stream_codec_ctx, stream_codec, nullptr);
  if (ret < 0) {
    avcodec_free_context(&stream_codec_ctx);
    avformat_close_input(&format_context_);
    av_freep(&avio_context_->buffer);
    avio_context_free(&avio_context_);
    avio_context_ = nullptr;
    delete mem_ctx_;
    mem_ctx_ = nullptr;
    return false;
  }

  // Count frames and decode them
  AVPacket* pkt = av_packet_alloc();
  AVFrame* frm = av_frame_alloc();
  if (!pkt || !frm) {
    if (pkt) av_packet_free(&pkt);
    if (frm) av_frame_free(&frm);
    avcodec_free_context(&stream_codec_ctx);
    avformat_close_input(&format_context_);
    av_freep(&avio_context_->buffer);
    avio_context_free(&avio_context_);
    avio_context_ = nullptr;
    delete mem_ctx_;
    mem_ctx_ = nullptr;
    return false;
  }

  frame_count_ = 0;
  int64_t accumulated_pts = 0;

  // Extract loop count for GIF from raw data (NETSCAPE2.0 extension)
  if (type_ == "image/gif") {
    // Default to infinite loop
    repetition_count_ = std::numeric_limits<double>::infinity();

    // Parse NETSCAPE2.0 extension from raw data
    // Look for: 0x21 0xFF 0x0B "NETSCAPE2.0" 0x03 0x01 <loop_low> <loop_high>
    const uint8_t netscape_sig[] = {0x21, 0xFF, 0x0B, 'N', 'E', 'T', 'S',
                                    'C',  'A',  'P',  'E', '2', '.', '0'};
    for (size_t i = 0; i + 18 < data_.size(); i++) {
      if (memcmp(data_.data() + i, netscape_sig, sizeof(netscape_sig)) == 0) {
        // Found NETSCAPE extension, read loop count
        // Format: sig(14) + sub-block-size(1=0x03) + id(1=0x01) + loop(2)
        size_t loop_offset = i + sizeof(netscape_sig) + 2;  // Skip 0x03 0x01
        if (loop_offset + 2 <= data_.size()) {
          int loop_count = data_[loop_offset] | (data_[loop_offset + 1] << 8);
          if (loop_count == 0) {
            repetition_count_ = std::numeric_limits<double>::infinity();
          } else {
            repetition_count_ = loop_count;
          }
        }
        break;
      }
    }
  } else if (type_ == "image/webp") {
    // WebP: try metadata first, default to infinite
    repetition_count_ = std::numeric_limits<double>::infinity();

    AVDictionaryEntry* loop_entry =
        av_dict_get(format_context_->metadata, "loop", nullptr, 0);
    if (loop_entry) {
      int loop_count = std::atoi(loop_entry->value);
      if (loop_count == 0) {
        repetition_count_ = std::numeric_limits<double>::infinity();
      } else {
        repetition_count_ = loop_count;
      }
    }
  }

  // Read all frames
  while (av_read_frame(format_context_, pkt) >= 0) {
    if (pkt->stream_index == video_stream_index_) {
      ret = avcodec_send_packet(stream_codec_ctx, pkt);
      if (ret >= 0) {
        while (avcodec_receive_frame(stream_codec_ctx, frm) >= 0) {
          DecodedFrame decoded_frame;
          if (ConvertFrameToRGBA(frm, &decoded_frame.data)) {
            decoded_frame.width = frm->width;
            decoded_frame.height = frm->height;

            // Calculate timestamp and duration
            AVRational time_base = video_stream->time_base;
            if (frm->pts != AV_NOPTS_VALUE) {
              decoded_frame.timestamp =
                  av_rescale_q(frm->pts, time_base, {1, 1000000});
            } else {
              decoded_frame.timestamp = accumulated_pts;
            }

            // Duration from packet or frame
            int64_t duration = pkt->duration;
            if (duration <= 0 && frm->duration > 0) {
              duration = frm->duration;
            }
            if (duration > 0) {
              decoded_frame.duration =
                  av_rescale_q(duration, time_base, {1, 1000000});
            } else {
              // Default to 100ms for GIF frames without explicit duration
              decoded_frame.duration = 100000;
            }
            accumulated_pts += decoded_frame.duration;

            decoded_frames_.push_back(std::move(decoded_frame));
            frame_count_++;
          }
          av_frame_unref(frm);
        }
      }
    }
    av_packet_unref(pkt);
  }

  // Flush decoder
  avcodec_send_packet(stream_codec_ctx, nullptr);
  while (avcodec_receive_frame(stream_codec_ctx, frm) >= 0) {
    DecodedFrame decoded_frame;
    if (ConvertFrameToRGBA(frm, &decoded_frame.data)) {
      decoded_frame.width = frm->width;
      decoded_frame.height = frm->height;
      AVRational time_base = video_stream->time_base;
      if (frm->pts != AV_NOPTS_VALUE) {
        decoded_frame.timestamp =
            av_rescale_q(frm->pts, time_base, {1, 1000000});
      } else {
        decoded_frame.timestamp = accumulated_pts;
      }
      decoded_frame.duration = 100000;  // Default duration
      decoded_frames_.push_back(std::move(decoded_frame));
      frame_count_++;
    }
    av_frame_unref(frm);
  }

  av_packet_free(&pkt);
  av_frame_free(&frm);
  avcodec_free_context(&stream_codec_ctx);

  // Determine if animated based on frame count
  animated_ = frame_count_ > 1;

  // If we have no frames, fall back to non-animated
  if (frame_count_ == 0) {
    frame_count_ = 1;
    animated_ = false;
    // mem_ctx_ will be cleaned up by Cleanup()
    return false;
  }

  // Set first frame as decoded data for compatibility
  if (!decoded_frames_.empty()) {
    decoded_data_ = decoded_frames_[0].data;
    decoded_width_ = decoded_frames_[0].width;
    decoded_height_ = decoded_frames_[0].height;
  }

  // mem_ctx_ stays alive for use by avio_context_, will be cleaned up by Cleanup()
  return true;
}

bool ImageDecoder::DecodeFrame(int frame_index) {
  // Validate frame index
  if (frame_index < 0 || frame_index >= frame_count_) {
    return false;
  }

  // For animated images, return cached frame
  if (animated_ && static_cast<size_t>(frame_index) < decoded_frames_.size()) {
    return true;
  }

  // For static images, just use the single decoded frame
  if (!animated_ && frame_index == 0 && !decoded_data_.empty()) {
    return true;
  }

  return false;
}

bool ImageDecoder::DecodeImage() {
  if (!codec_context_ || !frame_ || !packet_ || data_.empty()) {
    return false;
  }

  // Set packet data
  packet_->data = data_.data();
  packet_->size = static_cast<int>(data_.size());

  // Send packet to decoder
  int ret = avcodec_send_packet(codec_context_, packet_);
  if (ret < 0) {
    return false;
  }

  // Receive decoded frame
  ret = avcodec_receive_frame(codec_context_, frame_);
  if (ret < 0) {
    return false;
  }

  decoded_width_ = frame_->width;
  decoded_height_ = frame_->height;

  // Convert to RGBA
  sws_context_ = sws_getContext(frame_->width, frame_->height,
                                static_cast<AVPixelFormat>(frame_->format),
                                frame_->width, frame_->height, AV_PIX_FMT_RGBA,
                                SWS_BILINEAR, nullptr, nullptr, nullptr);

  if (!sws_context_) {
    return false;
  }

  // Allocate output buffer
  int output_size = av_image_get_buffer_size(AV_PIX_FMT_RGBA, frame_->width,
                                             frame_->height, 1);
  decoded_data_.resize(output_size);

  // Set up output planes
  uint8_t* dest_data[4] = {decoded_data_.data(), nullptr, nullptr, nullptr};
  int dest_linesize[4] = {frame_->width * 4, 0, 0, 0};

  // Convert
  sws_scale(sws_context_, frame_->data, frame_->linesize, 0, frame_->height,
            dest_data, dest_linesize);

  return true;
}

Napi::Value ImageDecoder::Decode(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (closed_) {
    Napi::Error::New(env, "ImageDecoder is closed")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  if (!complete_) {
    Napi::Error::New(env, "Image decoding failed").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Parse options for frameIndex
  int frame_index = 0;
  if (info.Length() > 0 && info[0].IsObject()) {
    Napi::Object options = info[0].As<Napi::Object>();
    if (options.Has("frameIndex") && options.Get("frameIndex").IsNumber()) {
      frame_index = options.Get("frameIndex").As<Napi::Number>().Int32Value();
    }
  }

  // Validate frame index
  if (frame_index < 0 || frame_index >= frame_count_) {
    Napi::RangeError::New(env, "frameIndex " + std::to_string(frame_index) +
                                   " is out of range. Valid range is 0 to " +
                                   std::to_string(frame_count_ - 1))
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Create a deferred promise
  Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);

  // Get the appropriate frame data
  const std::vector<uint8_t>* frame_data = nullptr;
  int frame_width = decoded_width_;
  int frame_height = decoded_height_;
  int64_t timestamp = 0;

  if (animated_ && static_cast<size_t>(frame_index) < decoded_frames_.size()) {
    const DecodedFrame& decoded_frame = decoded_frames_[frame_index];
    frame_data = &decoded_frame.data;
    frame_width = decoded_frame.width;
    frame_height = decoded_frame.height;
    timestamp = decoded_frame.timestamp;
  } else {
    frame_data = &decoded_data_;
  }

  if (!frame_data || frame_data->empty()) {
    Napi::Error::New(env, "Frame data not available")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Create VideoFrame from frame data
  Napi::Buffer<uint8_t> buffer =
      Napi::Buffer<uint8_t>::Copy(env, frame_data->data(), frame_data->size());

  Napi::Object init = Napi::Object::New(env);
  init.Set("codedWidth", Napi::Number::New(env, frame_width));
  init.Set("codedHeight", Napi::Number::New(env, frame_height));
  init.Set("timestamp", Napi::Number::New(env, static_cast<double>(timestamp)));
  init.Set("format", Napi::String::New(env, "RGBA"));

  // Get VideoFrame constructor from global
  Napi::Function video_frame_ctor =
      env.Global().Get("__nodeWebCodecsVideoFrame__").As<Napi::Function>();

  if (video_frame_ctor.IsUndefined() || !video_frame_ctor.IsFunction()) {
    // Try to get from module exports directly
    // For now, create result without VideoFrame wrapper
    Napi::Object result = Napi::Object::New(env);
    Napi::Object image = Napi::Object::New(env);
    image.Set("codedWidth", Napi::Number::New(env, frame_width));
    image.Set("codedHeight", Napi::Number::New(env, frame_height));
    image.Set("timestamp",
              Napi::Number::New(env, static_cast<double>(timestamp)));
    image.Set("format", Napi::String::New(env, "RGBA"));
    image.Set("data", buffer);
    auto closeFn = [](const Napi::CallbackInfo&) {};
    image.Set("close", Napi::Function::New(env, closeFn));
    result.Set("image", image);
    result.Set("complete", Napi::Boolean::New(env, complete_));

    deferred.Resolve(result);
    return deferred.Promise();
  }

  // Create VideoFrame instance
  Napi::Object frame = video_frame_ctor.New({buffer, init}).As<Napi::Object>();

  // Create result object
  Napi::Object result = Napi::Object::New(env);
  result.Set("image", frame);
  result.Set("complete", Napi::Boolean::New(env, complete_));

  deferred.Resolve(result);
  return deferred.Promise();
}

void ImageDecoder::Close(const Napi::CallbackInfo& info) {
  if (!closed_) {
    Cleanup();
    closed_ = true;
  }
}

Napi::Value ImageDecoder::GetType(const Napi::CallbackInfo& info) {
  return Napi::String::New(info.Env(), type_);
}

Napi::Value ImageDecoder::GetComplete(const Napi::CallbackInfo& info) {
  return Napi::Boolean::New(info.Env(), complete_);
}

Napi::Value ImageDecoder::GetTracks(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  // Create ImageTrack object per W3C spec
  Napi::Object selectedTrack = Napi::Object::New(env);
  selectedTrack.Set("selected", Napi::Boolean::New(env, true));
  selectedTrack.Set("animated", Napi::Boolean::New(env, animated_));
  selectedTrack.Set("frameCount", Napi::Number::New(env, frame_count_));

  // Set repetitionCount (Infinity for infinite loop per W3C spec)
  if (std::isinf(repetition_count_)) {
    selectedTrack.Set(
        "repetitionCount",
        Napi::Number::New(env, std::numeric_limits<double>::infinity()));
  } else {
    selectedTrack.Set("repetitionCount",
                      Napi::Number::New(env, repetition_count_));
  }

  if (complete_) {
    selectedTrack.Set("width", Napi::Number::New(env, decoded_width_));
    selectedTrack.Set("height", Napi::Number::New(env, decoded_height_));
  }

  // Create ImageTrackList object per W3C spec
  // The tracks property returns an ImageTrackList with:
  // - length: number of tracks
  // - selectedIndex: index of the selected track
  // - selectedTrack: the currently selected ImageTrack
  // - ready: Promise that resolves when track info is available
  Napi::Object trackList = Napi::Object::New(env);
  trackList.Set("length", Napi::Number::New(env, 1));
  trackList.Set("selectedIndex", Napi::Number::New(env, 0));
  trackList.Set("selectedTrack", selectedTrack);

  // Create a resolved Promise for the ready property
  // Static and animated images are immediately ready after construction
  Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
  deferred.Resolve(trackList);
  trackList.Set("ready", deferred.Promise());

  // Make trackList indexable like an array (tracks[0] should work)
  trackList.Set(static_cast<uint32_t>(0), selectedTrack);

  return trackList;
}

Napi::Value ImageDecoder::IsTypeSupported(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsString()) {
    return Napi::Boolean::New(env, false);
  }

  std::string mime_type = info[0].As<Napi::String>().Utf8Value();
  AVCodecID codec_id = MimeTypeToCodecId(mime_type);

  if (codec_id == AV_CODEC_ID_NONE) {
    return Napi::Boolean::New(env, false);
  }

  // Check if codec is available
  const AVCodec* codec = avcodec_find_decoder(codec_id);
  return Napi::Boolean::New(env, codec != nullptr);
}

Napi::Object InitImageDecoder(Napi::Env env, Napi::Object exports) {
  return ImageDecoder::Init(env, exports);
}
