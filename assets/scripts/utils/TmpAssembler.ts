import TextMeshPro, { TmpOverflow } from "../TextMeshPro";
import TmpFontConfig, { TmpFontLetter } from "./TmpFontConfig";

const gfx = cc["gfx"];
const vfmt = new gfx.VertexFormat([
    { name: gfx.ATTR_POSITION, type: gfx.ATTR_TYPE_FLOAT32, num: 2 },
    { name: gfx.ATTR_UV0, type: gfx.ATTR_TYPE_FLOAT32, num: 2 },
    { name: gfx.ATTR_COLOR, type: gfx.ATTR_TYPE_UINT8, num: 4, normalize: true },
    { name: "a_color_extra", type: gfx.ATTR_TYPE_UINT8, num: 4, normalize: true },
    { name: "a_texture_idx", type: gfx.ATTR_TYPE_FLOAT32, num: 1 },
]);

const WHITE = cc.Color.WHITE;
/** 斜体倾斜弧度值 */
const ITALIC_REDIANS = cc.misc.degreesToRadians(15);
/** 下划线字符code */
const UNDERLINE_CODE = 95;
/** 省略号字符code */
const ELLIPSIS_CODE = 46;
const ELLIPSIS_CHAR = ".";
const ELLIPSIS_NUM = 3;

// share data of bmfont
let shareLabelInfo = {
    fontAtlas: null as TmpFontConfig,

    fontSize: 0,
    lineHeight: 0,
    hAlign: 0,
    vAlign: 0,

    hash: "",
    margin: 0,
};

let _comp = null;
let _tmpUvRect = cc.rect();
let _tmpPosRect = cc.rect();
let _horizontalKernings = [];
let _linesWidth = [];
let _linesOffsetX = [];

let _fntConfig: TmpFontConfig = null;
let _numberOfLines = 0;
let _textDesiredHeight = 0;
let _letterOffsetY = 0;
let _tailoredTopY = 0;
let _tailoredBottomY = 0;
let _bmfontScale = 1.0;

let _lineBreakWithoutSpaces = false;
let _lineSpacing = 0;
let _contentSize = cc.size(0, 0);
let _string = "";
let _fontSize = 0;
let _originFontSize = 0;
let _hAlign = 0;
let _vAlign = 0;
let _spacingX = 0;
let _lineHeight = 0;
let _overflow: TmpOverflow = 0;
let _isWrapText = false;
let _labelWidth = 0;
let _labelHeight = 0;
let _maxLineWidth = 0;

let _dataOffset = 0;

/** 斜体计算向量 */
let _italicVec = cc.v2();
/** 画下划线、删除线所需的数据 */
let _extraLinesData: { [lineIndex: number]: { lineIndex: number, first: any, last: any } } = {};
let _extraLineDef: TmpFontLetter = null;
/** 省略号所需的数据 */
let _ellipsisDef: TmpFontLetter = null;
let _ellipsisWidth: number = 0;

/**
 * 字符渲染数据
 */
class LetterInfo {
    /** 标记字符是否需要渲染 */
    public valid = true;
    public char = "";
    public x = 0;
    public y = 0;
    public line = 0;
    public hash = "";
    /** 标记处于需要渲染的字符中的第几位 */
    public quadsIndex = 0;
    /** 主动设置字符是否可见 */
    public visible = true;
}

/**
 * TextMeshPro顶点数据管理
 */
export default class TmpAssembler extends cc.Assembler {
    /** 每个顶点的数据长度 */
    protected floatsPerVert: number = 7;
    protected verticesCount: number = 4;
    protected indicesCount: number = 6;
    protected uvOffset: number = 2;
    protected colorOffset: number = 4;
    protected colorExtraOffset: number = 5;
    protected textureIdxOffset: number = 6;

    protected _renderData = null;
    protected _local = [];
    protected get verticesFloats() { return this.verticesCount * this.floatsPerVert; }

    /** 每个字符的渲染数据 */
    private _lettersInfo: LetterInfo[] = [];

    constructor() {
        super();

        this._renderData = new cc["RenderData"]();
        this._renderData.init(this);

        this.initData();
        this.initLocal();
    }

    public initData(): void {
        let data = this._renderData;
        // createFlexData支持创建指定格式的renderData
        data.createFlexData(0, this.verticesCount, this.indicesCount, this.getVfmt());

        // createFlexData不会填充顶点索引信息，手动补充一下
        let indices = data.iDatas[0];
        let count = indices.length / 6;
        for (let i = 0, idx = 0; i < count; i++) {
            let vertextID = i * 4;
            indices[idx++] = vertextID;
            indices[idx++] = vertextID + 1;
            indices[idx++] = vertextID + 2;
            indices[idx++] = vertextID + 1;
            indices[idx++] = vertextID + 3;
            indices[idx++] = vertextID + 2;
        }
    }

    public initLocal(): void {
        this._local = [];
        this._local.length = 4;
    }

    public getBuffer(v) {
        return cc.renderer["_handle"].getBuffer("mesh", this.getVfmt());
    }

    public getVfmt() {
        return vfmt;
    }

    public fillBuffers(comp, renderer): void {
        if (renderer.worldMatDirty) {
            this.updateWorldVerts(comp);
        }

        let renderData = this._renderData;
        let vData = renderData.vDatas[0];
        let iData = renderData.iDatas[0];

        let buffer = this.getBuffer(renderer);
        let offsetInfo = buffer.request(this.verticesCount, this.indicesCount);

        // buffer data may be realloc, need get reference after request.

        // fill vertices
        let vertexOffset = offsetInfo.byteOffset >> 2,
            vbuf = buffer._vData;

        if (vData.length + vertexOffset > vbuf.length) {
            vbuf.set(vData.subarray(0, vbuf.length - vertexOffset), vertexOffset);
        } else {
            vbuf.set(vData, vertexOffset);
        }

        // fill indices
        let ibuf = buffer._iData,
            indiceOffset = offsetInfo.indiceOffset,
            vertexId = offsetInfo.vertexOffset;
        for (let i = 0, l = iData.length; i < l; i++) {
            ibuf[indiceOffset++] = vertexId + iData[i];
        }
    }

    /**
     * 执行一次渲染数据更新
     */
    public updateRenderData(comp: TextMeshPro): void {
        if (!comp._vertsDirty) { return; }
        if (_comp === comp) { return; }
        if (!comp.fontConfig) { return; }

        _comp = comp;

        this._lettersInfo.length = 0;
        this._updateProperties(comp);
        this._updateContent();
        this.updateWorldVerts(comp);

        _comp._actualFontSize = _fontSize;
        _comp.node.setContentSize(_contentSize);

        _comp._vertsDirty = false;
        _comp = null;
        this._resetProperties();
    }

    /**
     * 更新渲染所需的前置数据
     */
    private _updateProperties(comp: TextMeshPro): void {
        _fntConfig = comp.fontConfig;
        _string = comp.string.toString();
        _fontSize = comp.fontSize;
        _originFontSize = _fntConfig ? _fntConfig.json.size : comp.fontSize;
        _bmfontScale = _fontSize / _originFontSize;
        _hAlign = comp.horizontalAlign;
        _vAlign = comp.verticalAlign;
        _spacingX = comp.spacingX;
        _overflow = comp.overflow;
        _lineHeight = comp.lineHeight;

        _contentSize.width = comp.node.width;
        _contentSize.height = comp.node.height;

        shareLabelInfo.fontAtlas = comp.fontConfig;
        shareLabelInfo.lineHeight = _lineHeight;
        shareLabelInfo.fontSize = _fontSize;
        shareLabelInfo.hash = "";
        shareLabelInfo.margin = 0;

        // should wrap text
        if (_overflow === TmpOverflow.NONE) {
            _isWrapText = false;
            _contentSize.width += shareLabelInfo.margin * 2;
            _contentSize.height += shareLabelInfo.margin * 2;
        }
        else if (_overflow === TmpOverflow.RESIZE_HEIGHT) {
            _isWrapText = true;
            _contentSize.height += shareLabelInfo.margin * 2;
        }
        else {
            _isWrapText = comp.enableWrapText;
        }

        this._setupBMFontOverflowMetrics();

        // 斜体计算
        if (comp.enableItalic) {
            _italicVec.x = 0;
            _italicVec.y = _contentSize.height / 2;
            _italicVec.rotateSelf(ITALIC_REDIANS);
            _contentSize.width += Math.abs(_italicVec.x) * 2;
            _contentSize.height -= Math.abs(_contentSize.height / 2 - _italicVec.y) * 2;
        }
        // 下划线、删除线
        if (comp.enableUnderline || comp.enableStrikethrough) {
            _extraLineDef = shareLabelInfo.fontAtlas.getLetter(UNDERLINE_CODE + shareLabelInfo.hash);
            if (!_extraLineDef) {
                cc.log(`Can't find letter definition in textures. letter: _`);
            }
        }
        // 省略号
        if (comp.overflow === TmpOverflow.ELLIPSIS) {
            _ellipsisDef = shareLabelInfo.fontAtlas.getLetter(ELLIPSIS_CODE + shareLabelInfo.hash);
            if (_ellipsisDef) {
                _ellipsisWidth = (_ellipsisDef.xAdvance * _bmfontScale + _spacingX) * ELLIPSIS_NUM;
            } else {
                _ellipsisWidth = 0;
                cc.log(`Can't find letter definition in textures. letter: ${ELLIPSIS_CHAR}`);
            }
        }
    }

    private _resetProperties(): void {
        _fntConfig = null;
        shareLabelInfo.hash = "";
        shareLabelInfo.margin = 0;
    }

    private _updateContent(): void {
        this._computeHorizontalKerningForText();
        this._alignText();
    }

    private _computeHorizontalKerningForText(): void {
        let string = _string;
        let stringLen = string.length;

        let horizontalKernings = _horizontalKernings;
        let kerningDict;
        // _fntConfig && (kerningDict = _fntConfig.kerningDict);
        // if (kerningDict && !cc.js.isEmptyObject(kerningDict)) {
        //     let prev = -1;
        //     for (let i = 0; i < stringLen; ++i) {
        //         let key = string.charCodeAt(i);
        //         let kerningAmount = kerningDict[(prev << 16) | (key & 0xffff)] || 0;
        //         if (i < stringLen - 1) {
        //             horizontalKernings[i] = kerningAmount;
        //         } else {
        //             horizontalKernings[i] = 0;
        //         }
        //         prev = key;
        //     }
        // } else {
        horizontalKernings.length = 0;
        // }
    }

    private _alignText(): void {
        _textDesiredHeight = 0;
        _linesWidth.length = 0;
        _extraLinesData = {};

        if (!_lineBreakWithoutSpaces) {
            this._multilineTextWrapByWord();
        } else {
            this._multilineTextWrapByChar();
        }

        // shrink
        if (_overflow === TmpOverflow.SHRINK && _fontSize > 0) {
            let scaleHeight = _bmfontScale;
            let scaleWidth = _bmfontScale;
            let needReset = false;
            if (_textDesiredHeight > _contentSize.height) {
                scaleHeight = (_contentSize.height / _textDesiredHeight) * _bmfontScale;
                needReset = true;
            }

            let maxWidth = 0;
            _linesWidth.forEach((v) => {
                if (v > maxWidth) {
                    maxWidth = v;
                }
            });
            if (maxWidth > _contentSize.width) {
                scaleWidth = (_contentSize.width / maxWidth) * _bmfontScale;
                needReset = true;
            }
            _bmfontScale = Math.min(scaleHeight, scaleWidth);

            if (needReset) {
                _fontSize = _bmfontScale * _originFontSize;
                _textDesiredHeight = 0;
                _linesWidth.length = 0;
                _extraLinesData = {};
                if (!_lineBreakWithoutSpaces) {
                    this._multilineTextWrapByWord();
                } else {
                    this._multilineTextWrapByChar();
                }
            }
        }

        this._computeAlignmentOffset();

        // 顶点数据填充
        this._reserveQuads(_comp, this._lettersInfo.length);
        this._updateQuads();
    }

    private _multilineTextWrapByWord(): boolean {
        return this._multilineTextWrap(this._getFirstWordLen);
    }

    private _multilineTextWrapByChar(): boolean {
        return this._multilineTextWrap(this._getFirstCharLen);
    }

    private _multilineTextWrap(nextTokenFunc: Function): boolean {
        // 省略号处理
        let ellipsisMaxLines = 0;
        let useEllipsis = false;
        if (_overflow === TmpOverflow.ELLIPSIS && _ellipsisDef) {
            ellipsisMaxLines = Math.max(1, Math.floor(_contentSize.height / _lineHeight));
        }

        let textLen = _string.length;

        let lineIndex = 0;
        let nextTokenX = 0;
        let nextTokenY = 0;
        let longestLine = 0;
        let letterRight = 0;

        let highestY = 0;
        let lowestY = 0;
        let letterDef: TmpFontLetter = null;
        let letterPosition = cc.v2(0, 0);

        for (let index = 0; index < textLen;) {
            let character = _string.charAt(index);
            if (character === "\n") {
                // 省略号处理
                if (_overflow === TmpOverflow.ELLIPSIS && _ellipsisDef && lineIndex + 1 >= ellipsisMaxLines) {
                    this._recordEllipsis(nextTokenY, letterPosition, lineIndex);
                    useEllipsis = true;
                    break;
                }

                _linesWidth.push(letterRight);
                letterRight = 0;
                lineIndex++;
                nextTokenX = 0;
                nextTokenY -= _lineHeight * this._getFontScale() + _lineSpacing;
                this._recordPlaceholderInfo(index, character);
                index++;
                continue;
            }

            let tokenLen = nextTokenFunc(_string, index, textLen);
            let tokenHighestY = highestY;
            let tokenLowestY = lowestY;
            let tokenRight = letterRight;
            let nextLetterX = nextTokenX;
            let newLine = false;

            for (let tmp = 0; tmp < tokenLen; ++tmp) {
                let letterIndex = index + tmp;
                character = _string.charAt(letterIndex);
                if (character === "\r") {
                    this._recordPlaceholderInfo(letterIndex, character);
                    continue;
                }
                letterDef = shareLabelInfo.fontAtlas.getLetterDefinitionForChar(character);
                if (!letterDef) {
                    this._recordPlaceholderInfo(letterIndex, character);
                    cc.log(`Can't find letter definition in textures. letter: ${character}`);
                    continue;
                }

                let letterX = nextLetterX + letterDef.offsetX * _bmfontScale - shareLabelInfo.margin;

                // 斜边处理
                if ((_comp as TextMeshPro).enableItalic) {
                    _italicVec.x = 0;
                    _italicVec.y = letterDef.h * _bmfontScale / 2;
                    _italicVec.rotateSelf(ITALIC_REDIANS);
                    letterX += Math.abs(_italicVec.x);
                }

                // 省略号处理
                if (_overflow === TmpOverflow.ELLIPSIS && _ellipsisDef) {
                    if (letterX + letterDef.w * _bmfontScale > _maxLineWidth) {
                        if (!_isWrapText || lineIndex + 1 >= ellipsisMaxLines) {
                            this._recordEllipsis(nextTokenY, letterPosition, lineIndex);
                            useEllipsis = true;
                            break;
                        }
                    }
                }

                if (_isWrapText
                    && _maxLineWidth > 0
                    && nextTokenX > 0
                    && letterX + letterDef.w * _bmfontScale > _maxLineWidth
                    && !cc.textUtils.isUnicodeSpace(character)) {
                    _linesWidth.push(letterRight);
                    letterRight = 0;
                    lineIndex++;
                    nextTokenX = 0;
                    nextTokenY -= (_lineHeight * this._getFontScale() + _lineSpacing);
                    newLine = true;
                    break;
                } else {
                    letterPosition.x = letterX;
                }

                letterPosition.y = nextTokenY - letterDef.offsetY * _bmfontScale + shareLabelInfo.margin;
                this._recordLetterInfo(letterPosition, character, letterIndex, lineIndex);

                if (letterIndex + 1 < _horizontalKernings.length && letterIndex < textLen - 1) {
                    nextLetterX += _horizontalKernings[letterIndex + 1];
                }

                nextLetterX += letterDef.xAdvance * _bmfontScale + _spacingX - shareLabelInfo.margin * 2;

                tokenRight = letterPosition.x + letterDef.w * _bmfontScale - shareLabelInfo.margin;
                // 斜边处理
                if ((_comp as TextMeshPro).enableItalic) {
                    _italicVec.x = 0;
                    _italicVec.y = letterDef.h * _bmfontScale / 2;
                    _italicVec.rotateSelf(ITALIC_REDIANS);
                    tokenRight += Math.abs(_italicVec.x);
                }

                if (tokenHighestY < letterPosition.y) {
                    tokenHighestY = letterPosition.y;
                }

                if (tokenLowestY > letterPosition.y - letterDef.h * _bmfontScale) {
                    tokenLowestY = letterPosition.y - letterDef.h * _bmfontScale;
                }

            } //end of for loop

            if (useEllipsis) { break; }

            if (newLine) { continue; }

            nextTokenX = nextLetterX;
            letterRight = tokenRight;

            if (highestY < tokenHighestY) {
                highestY = tokenHighestY;
            }
            if (lowestY > tokenLowestY) {
                lowestY = tokenLowestY;
            }
            if (longestLine < letterRight) {
                longestLine = letterRight;
            }

            index += tokenLen;
        } //end of for loop

        _linesWidth.push(letterRight);

        _numberOfLines = lineIndex + 1;
        _textDesiredHeight = _numberOfLines * _lineHeight * this._getFontScale();
        if (_numberOfLines > 1) {
            _textDesiredHeight += (_numberOfLines - 1) * _lineSpacing;
        }

        _contentSize.width = _labelWidth;
        _contentSize.height = _labelHeight;
        if (_labelWidth <= 0) {
            _contentSize.width = parseFloat(longestLine.toFixed(2)) + shareLabelInfo.margin * 2;
        }
        if (_labelHeight <= 0) {
            _contentSize.height = parseFloat(_textDesiredHeight.toFixed(2)) + shareLabelInfo.margin * 2;
        }

        _tailoredTopY = _contentSize.height;
        _tailoredBottomY = 0;

        if (_overflow !== TmpOverflow.CLAMP) {
            if (highestY > 0) {
                _tailoredTopY = _contentSize.height + highestY;
            }

            if (lowestY < -_textDesiredHeight) {
                _tailoredBottomY = _textDesiredHeight + lowestY;
            }
        }

        return true;
    }

    private _getFirstCharLen(): number {
        return 1;
    }

    private _getFontScale(): number {
        return _overflow === TmpOverflow.SHRINK ? _bmfontScale : 1;
    }

    private _getFirstWordLen(text: string, startIndex: number, textLen: number): number {
        let character = text.charAt(startIndex);
        if (cc.textUtils.isUnicodeCJK(character)
            || character === "\n"
            || cc.textUtils.isUnicodeSpace(character)) {
            return 1;
        }

        let len = 1;
        let letterDef = shareLabelInfo.fontAtlas.getLetterDefinitionForChar(character);
        if (!letterDef) {
            return len;
        }
        let nextLetterX = letterDef.xAdvance * _bmfontScale + _spacingX;
        let letterX;
        for (let index = startIndex + 1; index < textLen; ++index) {
            character = text.charAt(index);

            letterDef = shareLabelInfo.fontAtlas.getLetterDefinitionForChar(character);
            if (!letterDef) {
                break;
            }
            letterX = nextLetterX + letterDef.offsetX * _bmfontScale;

            if (letterX + letterDef.w * _bmfontScale > _maxLineWidth
                && !cc.textUtils.isUnicodeSpace(character)
                && _maxLineWidth > 0) {
                return len;
            }
            nextLetterX += letterDef.xAdvance * _bmfontScale + _spacingX;
            if (character === "\n"
                || cc.textUtils.isUnicodeSpace(character)
                || cc.textUtils.isUnicodeCJK(character)) {
                break;
            }
            len++;
        }

        return len;
    }

    /**
     * 从已记录的字符中倒退，直到能放下省略号
     */
    private _recordEllipsis(nextTokenY: number, letterPosition: cc.Vec2, lineIndex: number): void {
        let nextX = 0;
        let lastIndex = this._lettersInfo.length - 1;
        while (lastIndex >= 0) {
            let lastInfo = this._lettersInfo[lastIndex];
            let lastDef = shareLabelInfo.fontAtlas.getLetterDefinitionForChar(lastInfo.char);
            let lastRightX = lastInfo.x + lastDef.w * _bmfontScale - shareLabelInfo.margin;
            nextX = lastInfo.x + (lastDef.xAdvance - lastDef.offsetX) * _bmfontScale + _spacingX - shareLabelInfo.margin * 2;
            if (_maxLineWidth >= lastRightX + _ellipsisWidth) {
                break;
            }
            lastIndex--;
            this._lettersInfo.pop();
        }
        if (lastIndex < 0) {
            nextX = 0;
        }
        // 记录省略号
        letterPosition.y = nextTokenY - _ellipsisDef.offsetY * _bmfontScale + shareLabelInfo.margin;
        for (let i = 1; i <= ELLIPSIS_NUM; i++) {
            letterPosition.x = nextX + _ellipsisDef.offsetX * _bmfontScale - shareLabelInfo.margin;
            this._recordLetterInfo(letterPosition, ELLIPSIS_CHAR, lastIndex + i, lineIndex);
            nextX += _ellipsisDef.xAdvance * _bmfontScale + _spacingX - shareLabelInfo.margin * 2;
        }
    }

    /**
     * 记录无需渲染的占位符
     */
    private _recordPlaceholderInfo(letterIndex: number, char: string): void {
        if (letterIndex >= this._lettersInfo.length) {
            let tmpInfo = new LetterInfo();
            this._lettersInfo.push(tmpInfo);
        }

        this._lettersInfo[letterIndex].char = char;
        this._lettersInfo[letterIndex].hash = char.charCodeAt(0) + shareLabelInfo.hash;
        this._lettersInfo[letterIndex].valid = false;
    }

    /**
     * 记录需要渲染的字符
     */
    private _recordLetterInfo(letterPosition: cc.Vec2, character: string, letterIndex: number, lineIndex: number): void {
        if (letterIndex >= this._lettersInfo.length) {
            let tmpInfo = new LetterInfo();
            this._lettersInfo.push(tmpInfo);
        }
        let char = character.charCodeAt(0);
        let key = char + shareLabelInfo.hash;

        this._lettersInfo[letterIndex].line = lineIndex;
        this._lettersInfo[letterIndex].char = character;
        this._lettersInfo[letterIndex].hash = key;
        this._lettersInfo[letterIndex].valid = shareLabelInfo.fontAtlas.getLetter(key).valid;
        this._lettersInfo[letterIndex].x = letterPosition.x;
        this._lettersInfo[letterIndex].y = letterPosition.y;
    }

    private _computeAlignmentOffset(): void {
        _linesOffsetX.length = 0;

        switch (_hAlign) {
            case cc.macro.TextAlignment.LEFT:
                for (let i = 0; i < _numberOfLines; ++i) {
                    _linesOffsetX.push(0);
                }
                break;
            case cc.macro.TextAlignment.CENTER:
                for (let i = 0, l = _linesWidth.length; i < l; i++) {
                    _linesOffsetX.push((_contentSize.width - _linesWidth[i]) / 2);
                }
                break;
            case cc.macro.TextAlignment.RIGHT:
                for (let i = 0, l = _linesWidth.length; i < l; i++) {
                    _linesOffsetX.push(_contentSize.width - _linesWidth[i]);
                }
                break;
            default:
                break;
        }

        // TOP
        _letterOffsetY = _contentSize.height;
        if (_vAlign !== cc.macro.VerticalTextAlignment.TOP) {
            let blank = _contentSize.height - _textDesiredHeight + _lineHeight * this._getFontScale() - _originFontSize * _bmfontScale;
            if (_vAlign === cc.macro.VerticalTextAlignment.BOTTOM) {
                // BOTTOM
                _letterOffsetY -= blank;
            } else {
                // CENTER:
                _letterOffsetY -= blank / 2;
            }
        }
    }

    private _setupBMFontOverflowMetrics(): void {
        let newWidth = _contentSize.width;
        let newHeight = _contentSize.height;

        if (_overflow === TmpOverflow.RESIZE_HEIGHT) {
            newHeight = 0;
        }

        if (_overflow === TmpOverflow.NONE) {
            newWidth = 0;
            newHeight = 0;
        }

        _labelWidth = newWidth;
        _labelHeight = newHeight;
        _maxLineWidth = newWidth;
    }

    /**
     * 更新所有顶点数据
     */
    private _updateQuads(): void {
        let node = _comp.node;

        this.verticesCount = this.indicesCount = 0;

        // Need to reset dataLength in Canvas rendering mode.
        this._renderData && (this._renderData.dataLength = 0);

        let contentSize = _contentSize,
            appx = node._anchorPoint.x * contentSize.width,
            appy = node._anchorPoint.y * contentSize.height;

        let quadsIndex = 0;
        for (let i = 0, l = this._lettersInfo.length; i < l; ++i) {
            let letterInfo = this._lettersInfo[i];
            if (!letterInfo) break;
            if (!letterInfo.valid) continue;
            letterInfo.quadsIndex = quadsIndex;
            let letterDef = shareLabelInfo.fontAtlas.getLetter(letterInfo.hash);

            _tmpUvRect.height = letterDef.h;
            _tmpUvRect.width = letterDef.w;
            _tmpUvRect.x = letterDef.u;
            _tmpUvRect.y = letterDef.v;

            let py = letterInfo.y + _letterOffsetY;

            if (_labelHeight > 0) {
                if (_overflow === TmpOverflow.CLAMP) {
                    if (py > _tailoredTopY) {
                        let clipTop = py - _tailoredTopY;
                        _tmpUvRect.y += clipTop / _bmfontScale;
                        _tmpUvRect.height -= clipTop / _bmfontScale;
                        py = py - clipTop;
                    }

                    if ((py - _tmpUvRect.height * _bmfontScale < _tailoredBottomY)) {
                        _tmpUvRect.height = (py < _tailoredBottomY) ? 0 : (py - _tailoredBottomY) / _bmfontScale;
                    }
                }
            }

            let px = letterInfo.x + _linesOffsetX[letterInfo.line];
            if (_labelWidth > 0) {
                if (_overflow === TmpOverflow.CLAMP) {
                    if (px < 0) {
                        _tmpUvRect.x += -px / _bmfontScale;
                        _tmpUvRect.width -= -px / _bmfontScale;
                        px = 0;
                    }
                    if (px + _tmpUvRect.width * _bmfontScale > _contentSize.width) {
                        let clipRight = px + _tmpUvRect.width * _bmfontScale - _contentSize.width;
                        _tmpUvRect.width -= clipRight / _bmfontScale;
                    }
                }
            }

            if (_tmpUvRect.height > 0 && _tmpUvRect.width > 0) {
                _tmpPosRect.x = px - appx;
                _tmpPosRect.y = py - appy;
                _tmpPosRect.width = _tmpUvRect.width * _bmfontScale;
                _tmpPosRect.height = _tmpUvRect.height * _bmfontScale;
                this.appendQuad(letterDef.textureId, _tmpUvRect, _tmpPosRect);

                quadsIndex++;
                // 下划线数据记录
                if (_extraLineDef && ((_comp as TextMeshPro).enableUnderline || (_comp as TextMeshPro).enableStrikethrough)) {
                    if (!cc.textUtils.isUnicodeSpace(letterInfo.char)) {
                        let lineData = _extraLinesData[letterInfo.line];
                        if (!lineData) {
                            _extraLinesData[letterInfo.line] = {
                                lineIndex: letterInfo.line,
                                first: i,
                                last: i
                            }
                        } else {
                            if (lineData.last < i) {
                                lineData.last = i;
                            }
                        }
                    }
                }
            }
        }

        if (_extraLineDef) {
            // 下划线
            if ((_comp as TextMeshPro).enableUnderline) {
                this._updateLineQuads(appx, appy, -_fontSize + (_comp as TextMeshPro).underlineOffset * _bmfontScale);
            }
            // 删除线
            if ((_comp as TextMeshPro).enableStrikethrough) {
                this._updateLineQuads(appx, appy, -_fontSize / 2 + (_comp as TextMeshPro).strikethroughOffset * _bmfontScale);
            }
        }

        this.updateColorExtra(_comp);
        this._quadsUpdated();
    }

    /**
     * 更新下划线、删除线的顶点数据
     */
    private _updateLineQuads(appx: number, appy: number, offsetY: number): void {
        for (let key in _extraLinesData) {
            let underlineInfo = _extraLinesData[key];
            let lineIdx = underlineInfo.lineIndex;
            let first = underlineInfo.first;
            let last = underlineInfo.last > 0 ? underlineInfo.last : first;
            let firstInfo = this._lettersInfo[first];
            if (!firstInfo.valid) {
                continue;
            }
            let lastInfo = this._lettersInfo[last];
            let firstDef = shareLabelInfo.fontAtlas.getLetter(firstInfo.hash);
            let lastDef = shareLabelInfo.fontAtlas.getLetter(lastInfo.hash);

            let maxWidth = lastInfo.x + lastDef.w * _bmfontScale - firstInfo.x;

            let wLeft = maxWidth >= _extraLineDef.w * _bmfontScale ? _extraLineDef.w * _bmfontScale / 3 : maxWidth / 2;
            let wRight = wLeft;
            let wMid = maxWidth - wLeft - wRight;
            let leftX = firstInfo.x + _linesOffsetX[lineIdx];
            let rightX = leftX + wLeft + wMid;
            let midX = leftX + wLeft;

            // 左
            _tmpUvRect.height = _extraLineDef.h;
            _tmpUvRect.width = wLeft / _bmfontScale;
            _tmpUvRect.x = _extraLineDef.u;
            _tmpUvRect.y = _extraLineDef.v;

            let py = firstInfo.y + _letterOffsetY + firstDef.offsetY * _bmfontScale + offsetY;

            if (_labelHeight > 0) {
                if (py > _tailoredTopY) {
                    let clipTop = py - _tailoredTopY;
                    _tmpUvRect.y += clipTop;
                    _tmpUvRect.height -= clipTop;
                    py = py - clipTop;
                }

                if ((py - _extraLineDef.h * _bmfontScale < _tailoredBottomY) && _overflow === TmpOverflow.CLAMP) {
                    _tmpUvRect.height = (py < _tailoredBottomY) ? 0 : (py - _tailoredBottomY) / _bmfontScale;
                }
            }

            if (_tmpUvRect.height > 0 && _tmpUvRect.width > 0) {
                _tmpPosRect.x = leftX - appx;
                _tmpPosRect.y = py - appy;
                _tmpPosRect.width = wLeft;
                _tmpPosRect.height = _tmpUvRect.height * _bmfontScale;
                this.appendQuad(_extraLineDef.textureId, _tmpUvRect, _tmpPosRect);
            }

            // 右
            _tmpUvRect.width = wRight / _bmfontScale;
            _tmpUvRect.x = _extraLineDef.u + _extraLineDef.w - _tmpUvRect.width;

            if (_tmpUvRect.height > 0 && _tmpUvRect.width > 0) {
                _tmpPosRect.x = rightX - appx;
                _tmpPosRect.y = py - appy;
                _tmpPosRect.width = wRight;
                _tmpPosRect.height = _tmpUvRect.height * _bmfontScale;
                this.appendQuad(_extraLineDef.textureId, _tmpUvRect, _tmpPosRect);
            }

            // 中
            if (wMid > 0) {
                _tmpUvRect.width = _extraLineDef.w - wLeft * 2 / _bmfontScale;
                _tmpUvRect.x = _extraLineDef.u + _tmpUvRect.width;

                if (_tmpUvRect.height > 0 && _tmpUvRect.width > 0) {
                    _tmpPosRect.x = midX - appx;
                    _tmpPosRect.y = py - appy;
                    _tmpPosRect.width = wMid;
                    _tmpPosRect.height = _tmpUvRect.height * _bmfontScale;
                    this.appendQuad(_extraLineDef.textureId, _tmpUvRect, _tmpPosRect);
                }
            }
        }
    }

    /**
     * 顶点数据、索引数据初始化
     */
    private _reserveQuads(comp: TextMeshPro, count: number): void {
        let extra = 0;
        if (comp.enableUnderline) {
            extra++;
        }
        if (comp.enableStrikethrough) {
            extra++;
        }
        count = count + extra * _numberOfLines * 3;

        let verticesCount = count * 4;
        let indicesCount = count * 6;
        let flexBuffer = this._renderData._flexBuffer;
        flexBuffer.reserve(verticesCount, indicesCount);
        flexBuffer.used(verticesCount, indicesCount);
        let iData = this._renderData.iDatas[0];
        for (let i = 0, vid = 0, l = indicesCount; i < l; i += 6, vid += 4) {
            iData[i] = vid;
            iData[i + 1] = vid + 1;
            iData[i + 2] = vid + 2;
            iData[i + 3] = vid + 1;
            iData[i + 4] = vid + 3;
            iData[i + 5] = vid + 2;
        }
        _dataOffset = 0;
    }

    /**
     * 更新实际使用的顶点数据、索引数据长度
     */
    private _quadsUpdated(): void {
        _dataOffset = 0;
        let flexBuffer = this._renderData._flexBuffer;
        flexBuffer.used(this.verticesCount, this.indicesCount);
    }

    /**
     * 添加一组顶点数据（4个顶点）
     * @param textureId 渲染的字符所需纹理id
     * @param uvRect 顶点uv数据
     * @param posRect 顶点坐标数据
     */
    private appendQuad(textureId: number, uvRect: cc.Rect, posRect: cc.Rect): void {
        let renderData = this._renderData;
        let verts = renderData.vDatas[0],
            uintVerts = renderData.uintVDatas[0];

        this.verticesCount += 4;
        this.indicesCount = this.verticesCount / 2 * 3;

        let texture = shareLabelInfo.fontAtlas.getTexture(textureId);
        let texw = texture.width,
            texh = texture.height,
            rectWidth = uvRect.width,
            rectHeight = uvRect.height,
            color = _comp.node._color._val;

        let l, b, r, t;
        let floatsPerVert = this.floatsPerVert;
        // uvs
        let uvDataOffset = _dataOffset + this.uvOffset;
        l = (uvRect.x) / texw;
        r = (uvRect.x + rectWidth) / texw;
        b = (uvRect.y + rectHeight) / texh;
        t = (uvRect.y) / texh;

        verts[uvDataOffset] = l;
        verts[uvDataOffset + 1] = b;
        uvDataOffset += floatsPerVert;
        verts[uvDataOffset] = r;
        verts[uvDataOffset + 1] = b;
        uvDataOffset += floatsPerVert;
        verts[uvDataOffset] = l;
        verts[uvDataOffset + 1] = t;
        uvDataOffset += floatsPerVert;
        verts[uvDataOffset] = r;
        verts[uvDataOffset + 1] = t;

        // positions
        l = posRect.x;
        r = posRect.x + posRect.width;
        b = posRect.y - posRect.height;
        t = posRect.y;
        this.appendVerts(_comp, _dataOffset, l, r, b, t);

        // colors
        let colorOffset = _dataOffset + this.colorOffset;
        for (let i = 0; i < 4; i++) {
            uintVerts[colorOffset] = color;
            colorOffset += floatsPerVert;
        }

        // colorExtra
        let colorExtraOffset = _dataOffset + this.colorExtraOffset;
        for (let i = 0; i < 4; i++) {
            uintVerts[colorExtraOffset] = WHITE._val;
            colorExtraOffset += floatsPerVert;
        }

        // textureId
        let idOffset = _dataOffset + this.textureIdxOffset;
        for (let i = 0; i < 4; i++) {
            verts[idOffset] = textureId;
            idOffset += this.floatsPerVert;
        }

        _dataOffset += this.floatsPerVert * 4;
    }

    private appendVerts(comp: TextMeshPro, offset, l, r, b, t): void {
        let local = this._local;
        let floatsPerVert = this.floatsPerVert;

        if (comp.enableItalic) {
            _italicVec.x = 0;
            _italicVec.y = (t - b) / 2;
            _italicVec.rotateSelf(ITALIC_REDIANS);

            local[offset] = l - Math.abs(_italicVec.x);
            local[offset + 1] = b + Math.abs((t - b) / 2 - _italicVec.y);

            offset += floatsPerVert;
            local[offset] = r - Math.abs(_italicVec.x);
            local[offset + 1] = b + Math.abs((t - b) / 2 - _italicVec.y);

            offset += floatsPerVert;
            local[offset] = l + Math.abs(_italicVec.x);
            local[offset + 1] = t - Math.abs((t - b) / 2 - _italicVec.y);

            offset += floatsPerVert;
            local[offset] = r + Math.abs(_italicVec.x);
            local[offset + 1] = t - Math.abs((t - b) / 2 - _italicVec.y);
        } else {
            local[offset] = l;
            local[offset + 1] = b;

            offset += floatsPerVert;
            local[offset] = r;
            local[offset + 1] = b;

            offset += floatsPerVert;
            local[offset] = l;
            local[offset + 1] = t;

            offset += floatsPerVert;
            local[offset] = r;
            local[offset + 1] = t;
        }
    }

    /**
     * 更新顶点世界坐标数据
     */
    public updateWorldVerts(comp: TextMeshPro): void {
        let node = comp.node;
        let local = this._local;
        let world = this._renderData.vDatas[0];
        let floatsPerVert = this.floatsPerVert;

        if (CC_NATIVERENDERER) {
            for (let offset = 0, l = local.length; offset < l; offset += floatsPerVert) {
                world[offset] = local[offset];
                world[offset + 1] = local[offset + 1];
            }
        } else {
            let matrix = node["_worldMatrix"];
            let matrixm = matrix.m,
                a = matrixm[0], b = matrixm[1], c = matrixm[4], d = matrixm[5],
                tx = matrixm[12], ty = matrixm[13];

            for (let offset = 0; offset < local.length; offset += floatsPerVert) {
                let x = local[offset];
                let y = local[offset + 1];
                world[offset] = x * a + y * c + tx;
                world[offset + 1] = x * b + y * d + ty;
            }
        }
    }

    public updateColor(comp, color?): void {
        if (CC_NATIVERENDERER) {
            this["_dirtyPtr"][0] |= cc.Assembler["FLAG_VERTICES_OPACITY_CHANGED"];
        }
        let uintVerts = this._renderData.uintVDatas[0];
        if (!uintVerts) return;
        color = color != null ? color : comp.node.color._val;
        let floatsPerVert = this.floatsPerVert;
        let colorOffset = this.colorOffset;
        for (let i = colorOffset, l = uintVerts.length; i < l; i += floatsPerVert) {
            uintVerts[i] = color;
        }
    }

    /**
     * 更新额外顶点颜色，不对下划线、删除线生效
     */
    public updateColorExtra(comp: TextMeshPro): void {
        let uintVerts = this._renderData.uintVDatas[0];
        if (!uintVerts) return;

        let tmpColor = cc.color();
        for (let i = 0; i < this._lettersInfo.length; i++) {
            let info = this._lettersInfo[i];
            if (!info.valid) {
                continue;
            }
            let alpha = info.visible ? 1 : 0;
            let offset = this.colorExtraOffset + this.floatsPerVert * info.quadsIndex * 4;
            tmpColor.set(WHITE);
            tmpColor.setA(tmpColor.a * alpha);
            comp.colorGradient && tmpColor.multiply(comp.colorLB);
            uintVerts[offset] = tmpColor._val;

            offset += this.floatsPerVert;
            tmpColor.set(WHITE);
            tmpColor.setA(tmpColor.a * alpha);
            comp.colorGradient && tmpColor.multiply(comp.colorRB);
            uintVerts[offset] = tmpColor._val;

            offset += this.floatsPerVert;
            tmpColor.set(WHITE);
            tmpColor.setA(tmpColor.a * alpha);
            comp.colorGradient && tmpColor.multiply(comp.colorLT);
            uintVerts[offset] = tmpColor._val;

            offset += this.floatsPerVert;
            tmpColor.set(WHITE);
            tmpColor.setA(tmpColor.a * alpha);
            comp.colorGradient && tmpColor.multiply(comp.colorRT);
            uintVerts[offset] = tmpColor._val;
        }
    }

    //#region 顶点数据操作接口

    /**
     * 根据字符下标判断此字符是否可见
     */
    public isVisble(index: number): boolean {
        let info = this._lettersInfo[index];
        return info && info.valid && info.visible && !cc.textUtils.isUnicodeSpace(info.char);
    }

    /**
     * 根据字符下标设置字符是否可见
     */
    public setVisible(comp: TextMeshPro, index: number, visible: boolean): void {
        let info = this._lettersInfo[index];
        if (!info || this.isVisble(index) === visible || info.visible === visible) {
            return;
        }

        info.visible = visible;
        let offset = this.colorExtraOffset + this.floatsPerVert * info.quadsIndex * 4;
        let color = cc.color();
        let alpha = (visible ? 1 : 0);

        let uintVerts = this._renderData.uintVDatas[0];

        color.set(WHITE);
        color.setA(color.a * alpha);
        comp.colorGradient && color.multiply(comp.colorLB);
        uintVerts[offset] = color["_val"];
        offset += this.floatsPerVert;

        color.set(WHITE);
        color.setA(color.a * alpha);
        comp.colorGradient && color.multiply(comp.colorRB);
        uintVerts[offset] = color["_val"];
        offset += this.floatsPerVert;

        color.set(WHITE);
        color.setA(color.a * alpha);
        comp.colorGradient && color.multiply(comp.colorLT);
        uintVerts[offset] = color["_val"];
        offset += this.floatsPerVert;

        color.set(WHITE);
        color.setA(color.a * alpha);
        comp.colorGradient && color.multiply(comp.colorRT);
        uintVerts[offset] = color["_val"];
    }

    /**
     * 根据字符下标获取颜色顶点数据，顺序为[左下, 右下, 左上, 右上]
     */
    public getColorExtraVertices(index: number): [cc.Color, cc.Color, cc.Color, cc.Color] | null {
        let info = this._lettersInfo[index];
        if (!info || !info.valid) {
            return null;
        }
        let result: [cc.Color, cc.Color, cc.Color, cc.Color] = [] as any;
        let uintVerts = this._renderData.uintVDatas[0];
        let offset = this.colorExtraOffset + this.floatsPerVert * info.quadsIndex * 4;
        for (let i = 0; i < 4; i++) {
            let color = cc.color();
            color._val = uintVerts[offset];
            result.push(color);
            offset += this.floatsPerVert;
        }
        return result;
    }

    /**
     * 根据字符下标设置颜色顶点数据，顺序为[左下, 右下, 左上, 右上]
     */
    public setColorExtraVertices(index: number, data: [cc.Color, cc.Color, cc.Color, cc.Color]): void {
        let info = this._lettersInfo[index];
        if (!info || !info.valid || data.length !== 4) {
            return;
        }

        let uintVerts = this._renderData.uintVDatas[0];
        let offset = this.colorExtraOffset + this.floatsPerVert * info.quadsIndex * 4;
        for (let i = 0; i < 4; i++) {
            uintVerts[offset] = data[i]._val;
            offset += this.floatsPerVert;
        }
    }

    /**
     * 根据字符下标获取坐标顶点数据，顺序为[左下, 右下, 左上, 右上]
     */
    public getPosVertices(index: number): [cc.Vec2, cc.Vec2, cc.Vec2, cc.Vec2] | null {
        let info = this._lettersInfo[index];
        if (!info || !info.valid) {
            return null;
        }
        let result: [cc.Vec2, cc.Vec2, cc.Vec2, cc.Vec2] = [] as any;
        let local = this._local;
        let offset = this.floatsPerVert * info.quadsIndex * 4;
        for (let i = 0; i < 4; i++) {
            result.push(cc.v2(local[offset], local[offset + 1]));
            offset += this.floatsPerVert;
        }
        return result;
    }

    /**
     * 根据字符下标设置坐标顶点数据，顺序为[左下, 右下, 左上, 右上]
     */
    public setPosVertices(index: number, data: [cc.Vec2, cc.Vec2, cc.Vec2, cc.Vec2]): void {
        let info = this._lettersInfo[index];
        if (!info || !info.valid || data.length !== 4) {
            return;
        }
        let local = this._local;
        let offset = this.floatsPerVert * info.quadsIndex * 4;
        for (let i = 0; i < 4; i++) {
            local[offset] = data[i].x;
            local[offset + 1] = data[i].y;
            offset += this.floatsPerVert;
        }
    }

    //#endregion
}
