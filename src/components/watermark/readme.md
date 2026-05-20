# zane-watermark



<!-- Auto Generated Below -->


## Properties

| Property       | Attribute       | Description                                                     | Type                                   | Default                            |
| -------------- | --------------- | --------------------------------------------------------------- | -------------------------------------- | ---------------------------------- |
| `zIndex`       | `z-index`       | z-index of the watermark overlay                                | `number`                               | `9`                                |
| `rotate`       | `rotate`        | Rotation angle in degrees                                       | `number`                               | `-22`                              |
| `width`        | `width`         | Tile width (auto if not set)                                    | `number \| undefined`                  | `undefined`                        |
| `height`       | `height`        | Tile height (auto if not set)                                   | `number \| undefined`                  | `undefined`                        |
| `image`        | `image`         | Image URL (takes priority over `content`)                       | `string \| undefined`                  | `undefined`                        |
| `content`      | `content`       | Watermark text or array of lines (supports `\n` or JSON array)  | `string \| string[]`                   | `'zane-ui'`                        |
| `fontColor`    | `font-color`    | Watermark font color                                            | `string`                               | `'var(--zane-text-color-disabled)'`|
| `fontSize`     | `font-size`     | Font size in px                                                 | `number`                               | `16`                               |
| `fontWeight`   | `font-weight`   | Font weight                                                     | `string`                               | `'normal'`                         |
| `fontStyle`    | `font-style`    | Font style                                                      | `string`                               | `'normal'`                         |
| `fontFamily`   | `font-family`   | Font family                                                     | `string`                               | `'sans-serif'`                     |
| `textAlign`    | `text-align`    | Canvas textAlign value                                          | `CanvasTextAlign`                       | `'center'`                         |
| `textBaseline` | `text-baseline` | Canvas textBaseline value                                       | `CanvasTextBaseline`                   | `'hanging'`                        |
| `fontGap`      | `font-gap`      | Gap between multi-line text                                     | `number`                               | `3`                                |
| `gap`          | `gap`           | Tile spacing as JSON array string e.g. `'[100,100]'`           | `string`                               | `'100,100'`                        |
| `offset`       | `offset`        | First tile offset as JSON array string e.g. `'[50,50]'`        | `string \| undefined`                  | `undefined`                        |


----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
