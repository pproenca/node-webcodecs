# 9.9. Video Color Space Interface

```webidl
[Exposed=(Window,DedicatedWorker)]
interface VideoColorSpace {
  constructor(optional VideoColorSpaceInit init = {});

  readonly attribute VideoColorPrimaries? primaries;
  readonly attribute VideoTransferCharacteristics? transfer;
  readonly attribute VideoMatrixCoefficients? matrix;
  readonly attribute boolean? fullRange;

  [Default] VideoColorSpaceInit toJSON();
};

dictionary VideoColorSpaceInit {
  VideoColorPrimaries? primaries = null;
  VideoTransferCharacteristics? transfer = null;
  VideoMatrixCoefficients? matrix = null;
  boolean? fullRange = null;
};
```
## Subsections

- [9.9.1. Internal Slots](./9.9.1-internal-slots.md)
- [9.9.2. Constructors](./9.9.2-constructors.md)
- [9.9.3. Attributes](./9.9.3-attributes.md)


---

[← Back to 9. Raw Media Interfaces](../../9-raw-media-interfaces/TOC.md)
