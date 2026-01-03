---
title: '9. Raw Media Interfaces (Part 4 of 4)'
---

> Section 9 from [W3C WebCodecs Specification](https://www.w3.org/TR/webcodecs/)

**Part 4 of 4**

---

Transfer characteristics used by BT.2100 HLG, as described by [\[H.273\]](https://www.w3.org/TR/webcodecs/#biblio-h273) section 8.2 table 3 value 18.

### [9.12. Video Matrix Coefficients](https://www.w3.org/TR/webcodecs/#videomatrixcoefficients)

```webidl
enum VideoMatrixCoefficients {
  "rgb",
  "bt709",
  "bt470bg",
  "smpte170m",
  "bt2020-ncl",
};
```

**`rgb`**

Matrix coefficients used by sRGB, as described by [\[H.273\]](https://www.w3.org/TR/webcodecs/#biblio-h273) section 8.3 table 4 value 0.
**`bt709`**

Matrix coefficients used by BT.709, as described by [\[H.273\]](https://www.w3.org/TR/webcodecs/#biblio-h273) section 8.3 table 4 value 1.
**`bt470bg`**

Matrix coefficients used by BT.601 PAL, as described by [\[H.273\]](https://www.w3.org/TR/webcodecs/#biblio-h273) section 8.3 table 4 value 5.
**`smpte170m`**

Matrix coefficients used by BT.601 NTSC, as described by [\[H.273\]](https://www.w3.org/TR/webcodecs/#biblio-h273) section 8.3 table 4 value 6. (Functionally the same as "bt470bg".)
**`bt2020-ncl`**

Matrix coefficients used by BT.2020 NCL, as described by [\[H.273\]](https://www.w3.org/TR/webcodecs/#biblio-h273) section 8.3 table 4 value 9.
