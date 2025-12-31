# Codecs and Pixel Formats

## Codec Strings

Codec strings follow the W3C WebCodecs specification format.

### Video

| Codec | String Format | Examples |
|-------|---------------|----------|
| H.264/AVC | `avc1.PPCCLL` | `avc1.42001e` (Baseline), `avc1.4d001e` (Main), `avc1.64001e` (High) |
| H.265/HEVC | `hvc1.*` or `hev1.*` | `hvc1.1.6.L93.B0` |
| VP8 | `vp8` | `vp8` |
| VP9 | `vp09.PP.LL.DD` | `vp09.00.10.08` |
| AV1 | `av01.P.LLT.DD` | `av01.0.04M.08` |

### Audio

| Codec | String | Encode | Decode |
|-------|--------|--------|--------|
| AAC | `mp4a.40.2` | Yes | Yes |
| Opus | `opus` | Yes | Yes |
| MP3 | `mp3` | No | Yes |
| FLAC | `flac` | No | Yes |

## Pixel Formats

### 8-bit

| Format | Description |
|--------|-------------|
| `I420` | YUV 4:2:0 planar |
| `I420A` | YUV 4:2:0 planar with alpha |
| `I422` | YUV 4:2:2 planar |
| `I422A` | YUV 4:2:2 planar with alpha |
| `I444` | YUV 4:4:4 planar |
| `I444A` | YUV 4:4:4 planar with alpha |
| `NV12` | YUV 4:2:0 semi-planar |
| `NV21` | YUV 4:2:0 semi-planar (VU order) |
| `NV12A` | YUV 4:2:0 semi-planar with alpha |
| `RGBA` | 32-bit RGBA packed |
| `RGBX` | 32-bit RGBx packed |
| `BGRA` | 32-bit BGRA packed |
| `BGRX` | 32-bit BGRx packed |

### 10-bit

| Format | Description |
|--------|-------------|
| `I420P10` | YUV 4:2:0 planar, 10-bit |
| `I422P10` | YUV 4:2:2 planar, 10-bit |
| `I444P10` | YUV 4:4:4 planar, 10-bit |
| `NV12P10` | YUV 4:2:0 semi-planar, 10-bit |
| `I420AP10` | YUV 4:2:0 planar with alpha, 10-bit |
| `I422AP10` | YUV 4:2:2 planar with alpha, 10-bit |
| `I444AP10` | YUV 4:4:4 planar with alpha, 10-bit |

### 12-bit

| Format | Description |
|--------|-------------|
| `I420P12` | YUV 4:2:0 planar, 12-bit |
| `I422P12` | YUV 4:2:2 planar, 12-bit |
| `I444P12` | YUV 4:4:4 planar, 12-bit |

## References

- [W3C WebCodecs Codec Registry](https://www.w3.org/TR/webcodecs-codec-registry/)
- [W3C WebCodecs Specification](https://www.w3.org/TR/webcodecs/)
