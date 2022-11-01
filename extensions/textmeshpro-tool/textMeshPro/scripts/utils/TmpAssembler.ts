import { Color, HorizontalTextAlignment, log, Mat4, misc, Rect, rect, size, UITransform, v2, Vec2, Vec3, VerticalTextAlignment } from "cc";
import { JSB } from "cc/env";
import TextMeshPro, { TmpOverflow } from "../TextMeshPro";
import TmpFontConfig, { TmpFontLetter } from "./TmpFontConfig";
import TmpUtils from "./TmpUtils";

const tempColor = new Color(255, 255, 255, 255);
const vec3_temp = new Vec3();
const _worldMatrix = new Mat4();

const WHITE = Color.WHITE;
/** 斜体倾斜弧度值 */
const ITALIC_REDIANS = misc.degreesToRadians(15);
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

let _comp: TextMeshPro = null;
let _uiTrans: UITransform | null = null;
let _tmpUvRect = rect();
let _tmpPosRect = rect();
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
let _contentSize = size(0, 0);
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
let QUAD_INDICES;

/** 斜体计算向量 */
let _italicVec = v2();
/** 画下划线、删除线所需的数据 */
let _extraLinesData: { [lineIndex: number]: { lineIndex: number, first: any, last: any } } = {};
let _extraLineDef: TmpFontLetter = null;
/** 省略号所需的数据 */
let _ellipsisDef: TmpFontLetter = null;
let _ellipsisWidth: number = 0;

/**
 * 字符渲染数据
 */
export class TmpLetterInfo {
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
export default class TmpAssembler {
    /** 每个顶点的数据长度 */
    protected static floatsPerVert: number = 14;
    protected static verticesCount: number = 4;
    protected static indicesCount: number = 6;
    protected static uvOffset: number = 3;
    protected static colorOffset: number = 5;
    protected static colorExtraOffset: number = 9;
    protected static textureIdxOffset: number = 13;

    static createData(comp: TextMeshPro) {
        return comp.requestRenderData();
    }

    static fillBuffers(comp: TextMeshPro, renderer: any) {
        const node = comp.node;
        tempColor.set(comp.color);
        tempColor.a = node._uiProps.opacity * 255;
        // Fill All
        const chunk = comp.renderData.chunk;
        const dataList = comp.renderData.data;
        const vData = chunk.vb;
        const vertexCount = comp.renderData.vertexCount;

        node.getWorldMatrix(_worldMatrix);

        let vertexOffset = 0;
        for (let i = 0; i < vertexCount; i++) {
            const vert = dataList[i];
            Vec3.set(vec3_temp, vert.x, vert.y, 0);
            Vec3.transformMat4(vec3_temp, vec3_temp, _worldMatrix);
            vData[vertexOffset++] = vec3_temp.x;
            vData[vertexOffset++] = vec3_temp.y;
            vData[vertexOffset++] = vec3_temp.z;
            Color.toArray(vData, tempColor, vertexOffset + 2);
            Color.toArray(vData, vert["colorExtra"], vertexOffset + 6);
            vertexOffset += 11;
        }

        // fill index data
        const bid = chunk.bufferId;
        const vid = chunk.vertexOffset;
        const meshBuffer = chunk.meshBuffer;
        const ib = chunk.meshBuffer.iData;
        let indexOffset = meshBuffer.indexOffset;
        for (let i = 0, count = vertexCount / 4; i < count; i++) {
            const start = vid + i * 4;
            ib[indexOffset++] = start;
            ib[indexOffset++] = start + 1;
            ib[indexOffset++] = start + 2;
            ib[indexOffset++] = start + 1;
            ib[indexOffset++] = start + 3;
            ib[indexOffset++] = start + 2;
        }
        meshBuffer.indexOffset += comp.renderData.indexCount;
        meshBuffer.setDirty();
    }

    /**
     * 执行一次渲染数据更新
     */
    public static updateRenderData(comp: TextMeshPro): void {
        if (!comp.renderData) { return; }
        if (_comp === comp) { return; }
        if (!comp.fontConfig) { return; }

        if (comp.renderData.vertDirty) {
            _comp = comp;
            _uiTrans = _comp.node._uiProps.uiTransformComp!;

            comp.lettersInfo.length = 0;
            this._updateProperties(comp);
            this._updateContent();

            this.updateUVs(comp);
            this.updateColor(comp);
            this.updateTextureIdx(comp);

            _comp["_actualFontSize"] = _fontSize;
            _uiTrans.setContentSize(_contentSize);

            _comp.renderData!.vertDirty = false;
            _comp.markForUpdateRenderData(false);

            _comp = null;
            this._resetProperties();
        }
        if (comp.textures.length > 0) {
            const renderData = comp.renderData;
            renderData.textureDirty = false;
            renderData.updateRenderData(comp, comp.textures[0]);
        }
    }

    static updateColor(comp: TextMeshPro) {
        if (JSB) {
            const renderData = comp.renderData!;
            const vertexCount = renderData.vertexCount;
            if (vertexCount === 0) return;
            const vData = renderData.chunk.vb;
            const stride = renderData.floatStride;
            let colorOffset = this.colorOffset;
            const color = comp.color;
            const colorR = color.r / 255;
            const colorG = color.g / 255;
            const colorB = color.b / 255;
            const colorA = color.a / 255;
            for (let i = 0; i < vertexCount; i++) {
                vData[colorOffset] = colorR;
                vData[colorOffset + 1] = colorG;
                vData[colorOffset + 2] = colorB;
                vData[colorOffset + 3] = colorA;
                colorOffset += stride;
            }
        }
    }

    static updateUVs(comp: TextMeshPro) {
        const renderData = comp.renderData!;
        const vData = renderData.chunk.vb;
        const vertexCount = renderData.vertexCount;
        const dataList = renderData.data;
        let vertexOffset = this.uvOffset;
        for (let i = 0; i < vertexCount; i++) {
            const vert = dataList[i];
            vData[vertexOffset] = vert.u;
            vData[vertexOffset + 1] = vert.v;
            vertexOffset += this.floatsPerVert;
        }
    }

    static updateTextureIdx(comp: TextMeshPro) {
        const renderData = comp.renderData!;
        const vData = renderData.chunk.vb;
        const vertexCount = renderData.vertexCount;
        const dataList = renderData.data;
        let vertexOffset = this.textureIdxOffset;
        for (let i = 0; i < vertexCount; i++) {
            const vert = dataList[i];
            vData[vertexOffset] = vert["textureIdx"];
            vertexOffset += this.floatsPerVert;
        }
    }

    /**
     * 更新渲染所需的前置数据
     */
    private static _updateProperties(comp: TextMeshPro): void {
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

        const contentSize = _uiTrans!.contentSize;
        _contentSize.width = contentSize.width;
        _contentSize.height = contentSize.height;

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
        } else if (_overflow === TmpOverflow.RESIZE_HEIGHT) {
            _isWrapText = true;
            _contentSize.height += shareLabelInfo.margin * 2;
        } else if (_overflow === TmpOverflow.SHRINK) {
            _isWrapText = false;
        } else {
            _isWrapText = comp.enableWrapText;
        }

        this._setupBMFontOverflowMetrics();

        // 斜体计算
        if (comp.enableItalic) {
            _italicVec.x = 0;
            _italicVec.y = _contentSize.height / 2;
            _italicVec = _italicVec.rotate(ITALIC_REDIANS);
            _contentSize.width += Math.abs(_italicVec.x) * 2;
            _contentSize.height -= Math.abs(_contentSize.height / 2 - _italicVec.y) * 2;
        }
        // 下划线、删除线
        if (comp.enableUnderline || comp.enableStrikethrough) {
            _extraLineDef = shareLabelInfo.fontAtlas.getLetter(UNDERLINE_CODE + shareLabelInfo.hash);
            if (!_extraLineDef) {
                log(`Can't find letter definition in textures. letter: _`);
            }
        }
        // 省略号
        if (comp.overflow === TmpOverflow.ELLIPSIS) {
            _ellipsisDef = shareLabelInfo.fontAtlas.getLetter(ELLIPSIS_CODE + shareLabelInfo.hash);
            if (_ellipsisDef) {
                _ellipsisWidth = (_ellipsisDef.xAdvance * _bmfontScale + _spacingX) * ELLIPSIS_NUM;
            } else {
                _ellipsisWidth = 0;
                log(`Can't find letter definition in textures. letter: ${ELLIPSIS_CHAR}`);
            }
        }
    }

    private static _resetProperties(): void {
        _fntConfig = null;
        shareLabelInfo.hash = "";
        shareLabelInfo.margin = 0;
    }

    private static _updateContent(): void {
        this._computeHorizontalKerningForText();
        this._alignText();
    }

    private static _computeHorizontalKerningForText(): void {
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

    private static _alignText(): void {
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
        this._updateQuads();
    }

    private static _multilineTextWrapByWord(): boolean {
        return this._multilineTextWrap(this._getFirstWordLen);
    }

    private static _multilineTextWrapByChar(): boolean {
        return this._multilineTextWrap(this._getFirstCharLen);
    }

    private static _multilineTextWrap(nextTokenFunc: Function): boolean {
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
        let letterPosition = v2(0, 0);

        for (let index = 0; index < textLen;) {
            let character = _string.charAt(index);
            if (character === "\n") {
                // 省略号处理
                if (_overflow === TmpOverflow.ELLIPSIS && _ellipsisDef && lineIndex + 1 >= ellipsisMaxLines) {
                    this._recordEllipsis(nextTokenY, letterPosition, lineIndex);
                    useEllipsis = true;
                    // 更新_linesWidth
                    let ellipsisInfo = _comp.lettersInfo[_comp.lettersInfo.length - 1];
                    // letterRight = ellipsisInfo.x + (_ellipsisDef.w) * _bmfontScale - shareLabelInfo.margin;
                    letterRight = ellipsisInfo.x + (_ellipsisDef.xAdvance - _ellipsisDef.offsetX) * _bmfontScale + _spacingX - shareLabelInfo.margin * 2;
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
                    log(`Can't find letter definition in textures. letter: ${character}`);
                    continue;
                }

                let letterX = nextLetterX + letterDef.offsetX * _bmfontScale - shareLabelInfo.margin;

                // 斜边处理
                if ((_comp as TextMeshPro).enableItalic) {
                    _italicVec.x = 0;
                    _italicVec.y = letterDef.h * _bmfontScale / 2;
                    _italicVec = _italicVec.rotate(ITALIC_REDIANS);
                    letterX += Math.abs(_italicVec.x);
                }

                // 省略号处理
                if (_overflow === TmpOverflow.ELLIPSIS && _ellipsisDef) {
                    if (letterX + (letterDef.xAdvance - letterDef.offsetX) * _bmfontScale > _maxLineWidth) {
                        if (!_isWrapText || lineIndex + 1 >= ellipsisMaxLines) {
                            this._recordEllipsis(nextTokenY, letterPosition, lineIndex);
                            useEllipsis = true;
                            // 更新_linesWidth
                            let ellipsisInfo = _comp.lettersInfo[_comp.lettersInfo.length - 1];
                            // letterRight = ellipsisInfo.x + (_ellipsisDef.w) * _bmfontScale - shareLabelInfo.margin;
                            letterRight = ellipsisInfo.x + (_ellipsisDef.xAdvance - _ellipsisDef.offsetX) * _bmfontScale + _spacingX - shareLabelInfo.margin * 2;
                            break;
                        }
                    }
                }

                if (_isWrapText
                    && _maxLineWidth > 0
                    && nextTokenX > 0
                    && letterX + (letterDef.xAdvance - letterDef.offsetX) * _bmfontScale > _maxLineWidth
                    && !TmpUtils.isUnicodeSpace(character)) {
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

                tokenRight = nextLetterX; //letterPosition.x + letterDef.w * _bmfontScale - shareLabelInfo.margin;
                // 斜边处理
                if ((_comp as TextMeshPro).enableItalic) {
                    _italicVec.x = 0;
                    _italicVec.y = letterDef.h * _bmfontScale / 2;
                    _italicVec = _italicVec.rotate(ITALIC_REDIANS);
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

        // 记录letterRight与nextTokenX的差值，供富文本排版使用
        _comp["_richTextDeltaX"] = nextTokenX - letterRight;

        return true;
    }

    private static _getFirstCharLen(): number {
        return 1;
    }

    private static _getFontScale(): number {
        return _overflow === TmpOverflow.SHRINK ? _bmfontScale : 1;
    }

    private static _getFirstWordLen(text: string, startIndex: number, textLen: number): number {
        let character = text.charAt(startIndex);
        if (TmpUtils.isUnicodeCJK(character)
            || character === "\n"
            || TmpUtils.isUnicodeSpace(character)) {
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

            if (letterX + (letterDef.xAdvance - letterDef.offsetX) * _bmfontScale > _maxLineWidth
                && !TmpUtils.isUnicodeSpace(character)
                && _maxLineWidth > 0) {
                return len;
            }
            nextLetterX += letterDef.xAdvance * _bmfontScale + _spacingX;
            if (character === "\n"
                || TmpUtils.isUnicodeSpace(character)
                || TmpUtils.isUnicodeCJK(character)) {
                break;
            }
            len++;
        }

        return len;
    }

    /**
     * 从已记录的字符中倒退，直到能放下省略号
     */
    private static _recordEllipsis(nextTokenY: number, letterPosition: Vec2, lineIndex: number): void {
        let nextX = 0;
        let lastIndex = _comp.lettersInfo.length - 1;
        while (lastIndex >= 0) {
            let lastInfo = _comp.lettersInfo[lastIndex];
            let lastDef = shareLabelInfo.fontAtlas.getLetterDefinitionForChar(lastInfo.char);
            let lastW = lastDef ? lastDef.w : 0;
            let lastXAdvance = lastDef ? lastDef.xAdvance : 0;
            let lastOffsetX = lastDef ? lastDef.offsetX : 0;
            let lastRightX = lastInfo.x + lastW * _bmfontScale - shareLabelInfo.margin;
            nextX = lastInfo.x + (lastXAdvance - lastOffsetX) * _bmfontScale + _spacingX - shareLabelInfo.margin * 2;
            if (_maxLineWidth >= lastRightX + _ellipsisWidth) {
                break;
            }
            lastIndex--;
            _comp.lettersInfo.pop();
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
    private static _recordPlaceholderInfo(letterIndex: number, char: string): void {
        if (letterIndex >= _comp.lettersInfo.length) {
            let tmpInfo = new TmpLetterInfo();
            _comp.lettersInfo.push(tmpInfo);
        }

        _comp.lettersInfo[letterIndex].char = char;
        _comp.lettersInfo[letterIndex].hash = char.charCodeAt(0) + shareLabelInfo.hash;
        _comp.lettersInfo[letterIndex].valid = false;
    }

    /**
     * 记录需要渲染的字符
     */
    private static _recordLetterInfo(letterPosition: Vec2, character: string, letterIndex: number, lineIndex: number): void {
        if (letterIndex >= _comp.lettersInfo.length) {
            let tmpInfo = new TmpLetterInfo();
            _comp.lettersInfo.push(tmpInfo);
        }
        let char = character.charCodeAt(0);
        let key = char + shareLabelInfo.hash;

        _comp.lettersInfo[letterIndex].line = lineIndex;
        _comp.lettersInfo[letterIndex].char = character;
        _comp.lettersInfo[letterIndex].hash = key;
        _comp.lettersInfo[letterIndex].valid = shareLabelInfo.fontAtlas.getLetter(key).valid;
        _comp.lettersInfo[letterIndex].x = letterPosition.x;
        _comp.lettersInfo[letterIndex].y = letterPosition.y;
    }

    private static _computeAlignmentOffset(): void {
        _linesOffsetX.length = 0;

        switch (_hAlign) {
            case HorizontalTextAlignment.LEFT:
                for (let i = 0; i < _numberOfLines; ++i) {
                    _linesOffsetX.push(0);
                }
                break;
            case HorizontalTextAlignment.CENTER:
                for (let i = 0, l = _linesWidth.length; i < l; i++) {
                    _linesOffsetX.push((_contentSize.width - _linesWidth[i]) / 2);
                }
                break;
            case HorizontalTextAlignment.RIGHT:
                for (let i = 0, l = _linesWidth.length; i < l; i++) {
                    _linesOffsetX.push(_contentSize.width - _linesWidth[i]);
                }
                break;
            default:
                break;
        }

        // TOP
        _letterOffsetY = _contentSize.height;
        if (_vAlign !== VerticalTextAlignment.TOP) {
            let blank = _contentSize.height - _textDesiredHeight + _lineHeight * this._getFontScale() - _originFontSize * _bmfontScale;
            if (_vAlign === VerticalTextAlignment.BOTTOM) {
                // BOTTOM
                _letterOffsetY -= blank;
            } else {
                // CENTER:
                _letterOffsetY -= blank / 2;
            }
        }
    }

    private static _setupBMFontOverflowMetrics(): void {
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
    private static _updateQuads(): void {
        const renderData = _comp.renderData!;
        renderData.dataLength = 0;
        renderData.resize(0, 0);
        const anchorPoint = _uiTrans!.anchorPoint;
        const contentSize = _contentSize;
        const appX = anchorPoint.x * contentSize.width;
        const appY = anchorPoint.y * contentSize.height;

        let quadsIndex = 0;
        for (let i = 0, l = _comp.lettersInfo.length; i < l; ++i) {
            let letterInfo = _comp.lettersInfo[i];
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
                _tmpPosRect.x = px - appX;
                _tmpPosRect.y = py - appY;
                _tmpPosRect.width = _tmpUvRect.width * _bmfontScale;
                _tmpPosRect.height = _tmpUvRect.height * _bmfontScale;
                this.appendQuad(_comp, letterDef.textureId, _tmpUvRect, _tmpPosRect);

                quadsIndex++;
                // 下划线数据记录
                if (_extraLineDef && ((_comp as TextMeshPro).enableUnderline || (_comp as TextMeshPro).enableStrikethrough)) {
                    if (!TmpUtils.isUnicodeSpace(letterInfo.char)) {
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
                this._updateLineQuads(appX, appY, -_fontSize + (_comp as TextMeshPro).underlineOffset * _bmfontScale);
            }
            // 删除线
            if ((_comp as TextMeshPro).enableStrikethrough) {
                this._updateLineQuads(appX, appY, -_fontSize / 2 + (_comp as TextMeshPro).strikethroughOffset * _bmfontScale);
            }
        }

        this.updateColorExtra(_comp);

        const indexCount = renderData.indexCount;
        this.createQuadIndices(indexCount);
        renderData.chunk.setIndexBuffer(QUAD_INDICES);
    }

    private static createQuadIndices(indexCount) {
        if (indexCount % 6 !== 0) {
            console.error('illegal index count!');
            return;
        }
        const quadCount = indexCount / 6;
        QUAD_INDICES = null;
        QUAD_INDICES = new Uint16Array(indexCount);
        let offset = 0;
        for (let i = 0; i < quadCount; i++) {
            QUAD_INDICES[offset++] = 0 + i * 4;
            QUAD_INDICES[offset++] = 1 + i * 4;
            QUAD_INDICES[offset++] = 2 + i * 4;
            QUAD_INDICES[offset++] = 1 + i * 4;
            QUAD_INDICES[offset++] = 3 + i * 4;
            QUAD_INDICES[offset++] = 2 + i * 4;
        }
    }

    /**
     * 更新下划线、删除线的顶点数据
     */
    private static _updateLineQuads(appx: number, appy: number, offsetY: number): void {
        for (let key in _extraLinesData) {
            let underlineInfo = _extraLinesData[key];
            let lineIdx = underlineInfo.lineIndex;
            let first = underlineInfo.first;
            let last = underlineInfo.last > 0 ? underlineInfo.last : first;
            let firstInfo = _comp.lettersInfo[first];
            if (!firstInfo.valid) {
                continue;
            }
            let lastInfo = _comp.lettersInfo[last];
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
                this.appendQuad(_comp, _extraLineDef.textureId, _tmpUvRect, _tmpPosRect);
            }

            // 右
            _tmpUvRect.width = wRight / _bmfontScale;
            _tmpUvRect.x = _extraLineDef.u + _extraLineDef.w - _tmpUvRect.width;

            if (_tmpUvRect.height > 0 && _tmpUvRect.width > 0) {
                _tmpPosRect.x = rightX - appx;
                _tmpPosRect.y = py - appy;
                _tmpPosRect.width = wRight;
                _tmpPosRect.height = _tmpUvRect.height * _bmfontScale;
                this.appendQuad(_comp, _extraLineDef.textureId, _tmpUvRect, _tmpPosRect);
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
                    this.appendQuad(_comp, _extraLineDef.textureId, _tmpUvRect, _tmpPosRect);
                }
            }
        }
    }

    /**
     * 添加一组顶点数据（4个顶点）
     * @param comp
     * @param textureId 渲染的字符所需纹理id
     * @param uvRect 顶点uv数据
     * @param posRect 顶点坐标数据
     */
    private static appendQuad(comp: TextMeshPro, textureId: number, uvRect: Rect, posRect: Rect): void {
        const renderData = comp.renderData;
        if (!renderData) {
            return;
        }

        // 此处会将renderData.chunk.vb置0
        const dataOffset = renderData.dataLength;
        renderData.dataLength += 4;
        renderData.resize(renderData.dataLength, renderData.dataLength / 2 * 3);
        const dataList = renderData.data;

        let texture = shareLabelInfo.fontAtlas.getTexture(textureId);
        let texw = texture.width,
            texh = texture.height,
            rectWidth = uvRect.width,
            rectHeight = uvRect.height;

        let l, b, r, t;
        // uvs
        l = (uvRect.x) / texw;
        r = (uvRect.x + rectWidth) / texw;
        b = (uvRect.y + rectHeight) / texh;
        t = (uvRect.y) / texh;
        dataList[dataOffset].u = l;
        dataList[dataOffset].v = b;
        dataList[dataOffset + 1].u = r;
        dataList[dataOffset + 1].v = b;
        dataList[dataOffset + 2].u = l;
        dataList[dataOffset + 2].v = t;
        dataList[dataOffset + 3].u = r;
        dataList[dataOffset + 3].v = t;

        // positions
        l = posRect.x;
        r = posRect.x + posRect.width;
        b = posRect.y - posRect.height;
        t = posRect.y;
        this.appendVerts(comp, dataList, dataOffset, l, r, b, t);

        // colorExtra
        for (let i = 0; i < 4; i++) {
            dataList[dataOffset + i]["colorExtra"] = WHITE.clone();
        }

        // textureId
        for (let i = 0; i < 4; i++) {
            dataList[dataOffset + i]["textureIdx"] = textureId;
        }
    }

    private static appendVerts(comp: TextMeshPro, dataList, dataOffset, l, r, b, t): void {
        if (comp.enableItalic) {
            _italicVec.x = 0;
            _italicVec.y = (t - b) / 2;
            _italicVec = _italicVec.rotate(ITALIC_REDIANS);

            dataList[dataOffset].x = l - Math.abs(_italicVec.x);
            dataList[dataOffset].y = b + Math.abs((t - b) / 2 - _italicVec.y);
            dataList[dataOffset + 1].x = r - Math.abs(_italicVec.x);
            dataList[dataOffset + 1].y = b + Math.abs((t - b) / 2 - _italicVec.y);
            dataList[dataOffset + 2].x = l + Math.abs(_italicVec.x);
            dataList[dataOffset + 2].y = t - Math.abs((t - b) / 2 - _italicVec.y);
            dataList[dataOffset + 3].x = r + Math.abs(_italicVec.x);
            dataList[dataOffset + 3].y = t - Math.abs((t - b) / 2 - _italicVec.y);
        } else {
            dataList[dataOffset].x = l;
            dataList[dataOffset].y = b;
            dataList[dataOffset + 1].x = r;
            dataList[dataOffset + 1].y = b;
            dataList[dataOffset + 2].x = l;
            dataList[dataOffset + 2].y = t;
            dataList[dataOffset + 3].x = r;
            dataList[dataOffset + 3].y = t;
        }
    }

    /**
     * 更新额外顶点颜色，不对下划线、删除线生效
     */
    public static updateColorExtra(comp: TextMeshPro): void {
        const dataList = comp.renderData.data;
        if (!dataList || dataList.length <= 0) { return; }

        if (!JSB) {
            for (let i = 0; i < comp.lettersInfo.length; i++) {
                let info = comp.lettersInfo[i];
                if (!info.valid || TmpUtils.isUnicodeSpace(info.char)) {
                    continue;
                }
                let alpha = info.visible ? 1 : 0;
                let offset = info.quadsIndex * 4;
                if (dataList.length < offset + 4) {
                    break;
                }

                tempColor.set(WHITE);
                tempColor.a *= alpha;
                comp.colorGradient && tempColor.multiply(comp.colorLB);
                dataList[offset]["colorExtra"].set(tempColor);

                tempColor.set(WHITE);
                tempColor.a *= alpha;
                comp.colorGradient && tempColor.multiply(comp.colorRB);
                dataList[offset + 1]["colorExtra"].set(tempColor);

                tempColor.set(WHITE);
                tempColor.a *= alpha;
                comp.colorGradient && tempColor.multiply(comp.colorLT);
                dataList[offset + 2]["colorExtra"].set(tempColor);

                tempColor.set(WHITE);
                tempColor.a *= alpha;
                comp.colorGradient && tempColor.multiply(comp.colorRT);
                dataList[offset + 3]["colorExtra"].set(tempColor);
            }
        } else {
            const renderData = comp.renderData!;
            const vData = comp.renderData.chunk.vb;
            const vertexCount = renderData.vertexCount;
            let quadCount = vertexCount / 4;
            let letterIndex = 0;
            for (let i = 0; i < quadCount; i++) {
                while (letterIndex < comp.lettersInfo.length && !comp.lettersInfo[letterIndex].valid) {
                    letterIndex++;
                }
                if (letterIndex < comp.lettersInfo.length) {
                    let info = comp.lettersInfo[letterIndex];
                    let alpha = info.visible ? 1 : 0;
                    let offset = i * 4;
                    if (dataList.length < offset + 4) {
                        break;
                    }

                    tempColor.set(WHITE);
                    tempColor.a *= alpha;
                    comp.colorGradient && tempColor.multiply(comp.colorLB);
                    dataList[offset]["colorExtra"].set(tempColor);

                    tempColor.set(WHITE);
                    tempColor.a *= alpha;
                    comp.colorGradient && tempColor.multiply(comp.colorRB);
                    dataList[offset + 1]["colorExtra"].set(tempColor);

                    tempColor.set(WHITE);
                    tempColor.a *= alpha;
                    comp.colorGradient && tempColor.multiply(comp.colorLT);
                    dataList[offset + 2]["colorExtra"].set(tempColor);

                    tempColor.set(WHITE);
                    tempColor.a *= alpha;
                    comp.colorGradient && tempColor.multiply(comp.colorRT);
                    dataList[offset + 3]["colorExtra"].set(tempColor);

                    let colorExtraOffset = offset * this.floatsPerVert + this.colorExtraOffset;
                    for (let i = 0; i < 4; i++) {
                        const colorR = dataList[offset + i]["colorExtra"].r / 255;
                        const colorG = dataList[offset + i]["colorExtra"].g / 255;
                        const colorB = dataList[offset + i]["colorExtra"].b / 255;
                        const colorA = dataList[offset + i]["colorExtra"].a / 255;
                        vData[colorExtraOffset] = colorR;
                        vData[colorExtraOffset + 1] = colorG;
                        vData[colorExtraOffset + 2] = colorB;
                        vData[colorExtraOffset + 3] = colorA;
                        colorExtraOffset += this.floatsPerVert;
                    }
                } else {
                    let colorExtraOffset = i * 4 * this.floatsPerVert + this.colorExtraOffset;
                    for (let i = 0; i < 4; i++) {
                        vData[colorExtraOffset] = 1;
                        vData[colorExtraOffset + 1] = 1;
                        vData[colorExtraOffset + 2] = 1;
                        vData[colorExtraOffset + 3] = 1;
                        colorExtraOffset += this.floatsPerVert;
                    }
                }
            }
        }
    }

    //#region 顶点数据操作接口

    /**
     * 根据字符下标判断此字符是否可见
     */
    public static isVisble(comp: TextMeshPro, index: number): boolean {
        let info = comp.lettersInfo[index];
        return info && info.valid && info.visible && !TmpUtils.isUnicodeSpace(info.char);
    }

    /**
     * 根据字符下标设置字符是否可见
     */
    public static setVisible(comp: TextMeshPro, index: number, visible: boolean): void {
        let info = comp.lettersInfo[index];
        if (!info || this.isVisble(comp, index) === visible || info.visible === visible || TmpUtils.isUnicodeSpace(info.char)) {
            return;
        }

        let offset = info.quadsIndex * 4;
        const dataList = comp.renderData.data;
        if (!dataList || dataList.length < offset + 4) { return; }

        info.visible = visible;
        let alpha = (visible ? 1 : 0);

        tempColor.set(WHITE);
        tempColor.a *= alpha;
        comp.colorGradient && tempColor.multiply(comp.colorLB);
        dataList[offset]["colorExtra"].set(tempColor);

        tempColor.set(WHITE);
        tempColor.a *= alpha;
        comp.colorGradient && tempColor.multiply(comp.colorRB);
        dataList[offset + 1]["colorExtra"].set(tempColor);

        tempColor.set(WHITE);
        tempColor.a *= alpha;
        comp.colorGradient && tempColor.multiply(comp.colorLT);
        dataList[offset + 2]["colorExtra"].set(tempColor);

        tempColor.set(WHITE);
        tempColor.a *= alpha;
        comp.colorGradient && tempColor.multiply(comp.colorRT);
        dataList[offset + 3]["colorExtra"].set(tempColor);

        if (JSB) {
            const vData = comp.renderData.chunk.vb;
            let colorExtraOffset = offset * this.floatsPerVert + this.colorExtraOffset;
            for (let i = 0; i < 4; i++) {
                const colorR = dataList[offset + i]["colorExtra"].r / 255;
                const colorG = dataList[offset + i]["colorExtra"].g / 255;
                const colorB = dataList[offset + i]["colorExtra"].b / 255;
                const colorA = dataList[offset + i]["colorExtra"].a / 255;
                vData[colorExtraOffset] = colorR;
                vData[colorExtraOffset + 1] = colorG;
                vData[colorExtraOffset + 2] = colorB;
                vData[colorExtraOffset + 3] = colorA;
                colorExtraOffset += this.floatsPerVert;
            }
        }
    }

    /**
     * 根据字符下标获取颜色顶点数据，顺序为[左下, 右下, 左上, 右上]
     */
    public static getColorExtraVertices(comp: TextMeshPro, index: number): [Color, Color, Color, Color] | null {
        let info = comp.lettersInfo[index];
        if (!info || !info.valid) {
            return null;
        }

        let offset = info.quadsIndex * 4;
        const dataList = comp.renderData.data;
        if (!dataList || dataList.length < offset + 4) { return; }

        let result: [Color, Color, Color, Color] = [] as any;
        for (let i = 0; i < 4; i++) {
            let rColor: Color = dataList[offset + i]["colorExtra"].clone();
            result.push(rColor);
        }
        return result;
    }

    /**
     * 根据字符下标设置颜色顶点数据，顺序为[左下, 右下, 左上, 右上]
     */
    public static setColorExtraVertices(comp: TextMeshPro, index: number, data: [Color, Color, Color, Color]): void {
        let info = comp.lettersInfo[index];
        if (!info || !info.valid || data.length !== 4 || TmpUtils.isUnicodeSpace(info.char)) {
            return;
        }

        let offset = info.quadsIndex * 4;
        const dataList = comp.renderData.data;
        if (!dataList || dataList.length < offset + 4) { return; }

        for (let i = 0; i < 4; i++) {
            dataList[offset + i]["colorExtra"].set(data[i]);
        }

        if (JSB) {
            const vData = comp.renderData.chunk.vb;
            let colorExtraOffset = offset * this.floatsPerVert + this.colorExtraOffset;
            for (let i = 0; i < 4; i++) {
                const colorR = dataList[offset + i]["colorExtra"].r / 255;
                const colorG = dataList[offset + i]["colorExtra"].g / 255;
                const colorB = dataList[offset + i]["colorExtra"].b / 255;
                const colorA = dataList[offset + i]["colorExtra"].a / 255;
                vData[colorExtraOffset] = colorR;
                vData[colorExtraOffset + 1] = colorG;
                vData[colorExtraOffset + 2] = colorB;
                vData[colorExtraOffset + 3] = colorA;
                colorExtraOffset += this.floatsPerVert;
            }
        }
    }

    /**
     * 根据字符下标获取坐标顶点数据，顺序为[左下, 右下, 左上, 右上]
     */
    public static getPosVertices(comp: TextMeshPro, index: number): [Vec3, Vec3, Vec3, Vec3] | null {
        let info = comp.lettersInfo[index];
        if (!info || !info.valid) {
            return null;
        }

        let offset = info.quadsIndex * 4;
        const dataList = comp.renderData.data;
        if (!dataList || dataList.length < offset + 4) { return; }

        let result: [Vec3, Vec3, Vec3, Vec3] = [] as any;
        for (let i = 0; i < 4; i++) {
            result.push(new Vec3(dataList[offset + i].x, dataList[offset + i].y, dataList[offset + i].z));
        }
        return result;
    }

    /**
     * 根据字符下标设置坐标顶点数据，顺序为[左下, 右下, 左上, 右上]
     */
    public static setPosVertices(comp: TextMeshPro, index: number, data: [Vec3, Vec3, Vec3, Vec3]): void {
        let info = comp.lettersInfo[index];
        if (!info || !info.valid || data.length !== 4 || TmpUtils.isUnicodeSpace(info.char)) {
            return;
        }

        let offset = info.quadsIndex * 4;
        const dataList = comp.renderData.data;
        if (!dataList || dataList.length < offset + 4) { return; }

        for (let i = 0; i < 4; i++) {
            dataList[offset + i].x = data[i].x;
            dataList[offset + i].y = data[i].y;
            dataList[offset + i].z = data[i].z;
        }

        if (JSB) {
            comp.renderData.renderDrawInfo.nativeObj["vertDirty"] = true;
            comp.renderData.renderDrawInfo.fillRender2dBuffer(comp.renderData.data);
        }
    }

    //#endregion
}
