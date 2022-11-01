import { assert, CCObject, Color, Component, EventTouch, HorizontalTextAlignment, isValid, js, JsonAsset, Material, Node, NodeEventType, Sprite, SpriteAtlas, SpriteFrame, Texture2D, UITransform, v2, Vec2, VerticalTextAlignment, warnID, _decorator } from "cc";
import { DEV, EDITOR } from "cc/env";
import TextMeshPro from "./TextMeshPro";
import { HtmlTextParser, IHtmlTextParserResultObj, IHtmlTextParserStack } from "./utils/HtmlParser";
import TmpUtils from "./utils/TmpUtils";

const { ccclass, property, disallowMultiple, executeInEditMode } = _decorator;

const RichTextChildName = "RICHTEXT_CHILD";
const RichTextChildImageName = "RICHTEXT_Image_CHILD";
const _htmlTextParser = new HtmlTextParser();

const BASELINE_RATIO = 0.26;

interface ISegment {
    node: Node;
    comp: TextMeshPro | Sprite | null;
    lineCount: number;
    styleIndex: number;
    imageOffset: string;
    clickParam: string;
    clickHandler: string;
    type: string,
}

/**
 * 富文本池
 */
const labelPool: any = new js.Pool((seg: ISegment) => {
    if (DEV) {
        assert(!seg.node.parent, "Recycling node\'s parent should be null!");
    }
    if (!isValid(seg.node)) {
        return false;
    }
    return true;
}, 20);

const imagePool: any = new js.Pool((seg: ISegment) => {
    if (DEV) {
        assert(!seg.node.parent, "Recycling node\'s parent should be null!");
    }
    return isValid(seg.node) as boolean;
}, 10);

function createSegment(type: string): ISegment {
    return {
        node: new Node(type),
        comp: null,
        lineCount: 0,
        styleIndex: 0,
        imageOffset: "",
        clickParam: "",
        clickHandler: "",
        type,
    };
}

function getSegmentByPool(type: string, content: string | SpriteFrame, mat?: Material) {
    let seg;
    if (type === RichTextChildName) {
        seg = labelPool["_get"]();
    } else if (type === RichTextChildImageName) {
        seg = imagePool["_get"]();
    }
    seg = seg || createSegment(type);
    let node = seg.node as Node;
    if (!node) {
        node = new Node(type);
    }
    node.hideFlags |= CCObject.Flags.DontSave | CCObject.Flags.HideInHierarchy;
    if (type === RichTextChildImageName) {
        seg.comp = node.getComponent(Sprite) || node.addComponent(Sprite);
        seg.comp.spriteFrame = content as SpriteFrame;
        seg.comp.type = Sprite.Type.SLICED;
        seg.comp.sizeMode = Sprite.SizeMode.CUSTOM;
    } else { // RichTextChildName
        seg.comp = node.getComponent(TextMeshPro) || node.addComponent(TextMeshPro);
        if (mat) {
            seg.comp.customMaterial = mat;
        }
        seg.comp.string = content as string;
        seg.comp.horizontalAlign = HorizontalTextAlignment.LEFT;
        seg.comp.verticalAlign = VerticalTextAlignment.TOP;
        seg.comp.underlineHeight = 2;
    }
    node.setPosition(0, 0, 0);
    const trans = node._uiProps.uiTransformComp!;
    trans.setAnchorPoint(0.5, 0.5);

    seg.node = node;
    seg.lineCount = 0;
    seg.styleIndex = 0;
    seg.imageOffset = "";
    seg.clickParam = "";
    seg.clickHandler = "";
    return seg as ISegment | null;
}

/**
 * TextMeshPro富文本组件
 */
@ccclass
@disallowMultiple
@executeInEditMode
export default class TmpRichText extends Component {

    @property
    private _string: string = "";
    @property({ multiline: true })
    public get string(): string { return this._string; }
    public set string(v: string) {
        if (this._string === v) { return; }
        this._string = v;
        // this._layoutDirty = true;
        this._updateRichText();
    }

    @property(JsonAsset)
    private _font: JsonAsset = null;
    @property({ tooltip: DEV && "字体资源\n依赖的纹理请勿打入图集\n在编辑器内拖拽此文件时，纹理必须和此文件处于同一目录下", type: JsonAsset })
    private get font(): JsonAsset { return this._font; }
    private set font(v: JsonAsset) {
        if (this._font === v) { return; }
        this._font = v;
        if (EDITOR) {
            this.editorInit();
        } else {
            this._layoutDirty = true;
            this._updateRichText();
        }
    }

    @property({ type: HorizontalTextAlignment })
    private _horizontalAlign: HorizontalTextAlignment = HorizontalTextAlignment.LEFT;
    @property({ type: HorizontalTextAlignment })
    public get horizontalAlign(): HorizontalTextAlignment { return this._horizontalAlign; }
    public set horizontalAlign(v: HorizontalTextAlignment) {
        if (this._horizontalAlign === v) { return; }
        this._horizontalAlign = v;
        this._layoutDirty = true;
        this._updateRichText();
    }

    @property({ type: VerticalTextAlignment })
    private _verticalAlign: VerticalTextAlignment = VerticalTextAlignment.TOP;
    @property({ type: VerticalTextAlignment })
    public get verticalAlign(): VerticalTextAlignment { return this._verticalAlign; }
    public set verticalAlign(v: VerticalTextAlignment) {
        if (this._verticalAlign === v) { return; }
        this._verticalAlign = v;
        this._layoutDirty = true;
        this._updateRichText();
    }

    @property
    private _fontSize: number = 32;
    @property({ range: [0, 1024] })
    public get fontSize(): number { return this._fontSize; }
    public set fontSize(v: number) {
        if (this._fontSize === v) { return; }
        this._fontSize = v;
        this._layoutDirty = true;
        this._updateRichText();
    }

    @property
    private _maxWidth: number = 0;
    @property({ tooltip: DEV && "富文本的最大宽度" })
    public get maxWidth(): number { return this._maxWidth; }
    public set maxWidth(v: number) {
        if (this._maxWidth === v) { return; }
        this._maxWidth = v;
        this._layoutDirty = true;
        this._updateRichText();
    }

    @property
    private _lineHeight: number = 32;
    @property
    public get lineHeight(): number { return this._lineHeight; }
    public set lineHeight(v: number) {
        if (this._lineHeight === v) { return; }
        this._lineHeight = v;
        this._layoutDirty = true;
        this._updateRichText();
    }

    @property(SpriteAtlas)
    private _imageAtlas: SpriteAtlas = null;
    @property(SpriteAtlas)
    public get imageAtlas(): SpriteAtlas { return this._imageAtlas; }
    public set imageAtlas(v: SpriteAtlas) {
        if (this._imageAtlas === v) { return; }
        this._imageAtlas = v;
        this._layoutDirty = true;
        this._updateRichText();
    }

    @property
    private _handleTouchEvent: boolean = true;
    @property
    public get handleTouchEvent(): boolean { return this._handleTouchEvent; }
    public set handleTouchEvent(v: boolean) {
        if (this._handleTouchEvent === v) { return; }
        this._handleTouchEvent = v;
        if (this.enabledInHierarchy) {
            this.handleTouchEvent ? this._addEventListeners() : this._removeEventListeners();
        }
    }

    @property(Material)
    public material: Material = null;

    @property({ tooltip: DEV && "字体所依赖的纹理", type: Texture2D, readonly: true })
    public textures: Texture2D[] = [];

    private _textArray: IHtmlTextParserResultObj[] = [];
    private _segments: ISegment[] = [];
    private _labelSegmentsCache: ISegment[] = [];
    private _linesWidth: number[] = [];
    private _lineOffsetX: number = 0;
    private _lineCount: number = 1;
    private _labelWidth: number = 0;
    private _labelHeight: number = 0;
    private _layoutDirty: boolean = true;
    private _labelChildrenNum = 0;

    // 文本父节点
    private _labelContent: Node = null;
    private get labelContent(): Node {
        if (!this._labelContent) {
            const content = "TMP_LABEL_CONTENT";
            this._labelContent = this.node.getChildByName(content) ?? new Node(content);
            this._labelContent.hideFlags |= CCObject.Flags.DontSave | CCObject.Flags.HideInHierarchy;
            this.node.insertChild(this._labelContent, this._imageContent ? 1 : 0);
        }
        return this._labelContent;
    }
    // 图片父节点
    private _imageContent: Node = null;
    private get imageContent(): Node {
        if (!this._imageContent) {
            const content = "TMP_IMAGE_CONTENT";
            this._imageContent = this.node.getChildByName(content) ?? new Node(content);
            this._imageContent.hideFlags |= CCObject.Flags.DontSave | CCObject.Flags.HideInHierarchy;
            this.node.insertChild(this._imageContent, 0);
        }
        return this._imageContent;
    }

    private editorInit(): void {
        if (EDITOR) {
            // 加载图集
            if (!this._font || !this._font["_uuid"]) {
                this.textures = [];
                this._layoutDirty = true;
                this._updateRichText();
                return;
            }
            Editor.Message.request("asset-db", "query-url", this._font["_uuid"]).then((url: string) => {
                if (!url) {
                    return;
                }
                let start = 12;
                let end = url.lastIndexOf("/");
                let dir = url.slice(start, end + 1);
                let arr: Promise<Texture2D>[] = [];
                this._font.json["pageData"].forEach((v) => {
                    let imgUrl = dir + v.file + "/texture";
                    arr.push(TmpUtils.load<Texture2D>(imgUrl));
                });
                Promise.all(arr).then((v) => {
                    this.textures = v;
                    this._layoutDirty = true;
                    this._updateRichText();
                });
            });
        }
    }

    public resetInEditor(): void {
        if (EDITOR) {
            TmpUtils.load<Material>(TmpUtils.TMP_MAT).then((mat) => {
                if (mat) {
                    this.material = mat;
                }
            });
        }
    }

    public onRestore(): void {
        if (EDITOR) {
            // Because undo/redo will not call onEnable/onDisable,
            // we need call onEnable/onDisable manually to active/disactive children nodes.
            if (this.enabledInHierarchy) {
                this.onEnable();
            }
            else {
                this.onDisable();
            }
        }
    }

    public onEnable(): void {
        if (this.handleTouchEvent) {
            this._addEventListeners();
        }
        this._onFontLoaded();
        this._activateChildren(true);
    }

    public onDisable(): void {
        if (this.handleTouchEvent) {
            this._removeEventListeners();
        }
        this._activateChildren(false);
    }

    public onLoad() {
        this.node.on(NodeEventType.LAYER_CHANGED, this._applyLayer, this);
    }

    public onDestroy(): void {
        for (const seg of this._segments) {
            seg.node.removeFromParent();
            if (seg.type === RichTextChildName) {
                labelPool.put(seg);
            } else if (seg.type === RichTextChildImageName) {
                imagePool.put(seg);
            }
        }

        this.node.off(NodeEventType.ANCHOR_CHANGED, this._updateRichTextPosition, this);
        this.node.off(NodeEventType.LAYER_CHANGED, this._applyLayer, this);
    }

    public start() {
        this._onFontLoaded();
        this.node.on(NodeEventType.ANCHOR_CHANGED, this._updateRichTextPosition, this);
    }

    private _addEventListeners(): void {
        this.node.on(Node.EventType.TOUCH_END, this._onTouchEnded, this);
    }

    private _removeEventListeners(): void {
        this.node.off(Node.EventType.TOUCH_END, this._onTouchEnded, this);
    }

    private _updateLabelSegmentTextAttributes(): void {
        this._segments.forEach((item) => {
            this._applyTextAttribute(item);
        });
    }

    private _createFontLabel(str: string): ISegment {
        return getSegmentByPool(RichTextChildName, str, this.material)!;
    }

    protected _createImage(spriteFrame: SpriteFrame): ISegment {
        return getSegmentByPool(RichTextChildImageName, spriteFrame)!;
    }

    private _onFontLoaded(): void {
        this._layoutDirty = true;
        this._updateRichText();
    }

    protected SplitLongStringApproximatelyIn2048(text: string, styleIndex: number) {
        const labelSize = this._calculateSize(styleIndex, text);
        const partStringArr: string[] = [];
        if (labelSize.x < 2048) {
            partStringArr.push(text);
        } else {
            const multilineTexts = text.split("\n");
            for (let i = 0; i < multilineTexts.length; i++) {
                const thisPartSize = this._calculateSize(styleIndex, multilineTexts[i]);
                if (thisPartSize.x < 2048) {
                    partStringArr.push(multilineTexts[i]);
                } else {
                    const thisPartSplitResultArr = this.splitLongStringOver2048(multilineTexts[i], styleIndex);
                    partStringArr.push(...thisPartSplitResultArr);
                }
            }
        }
        return partStringArr;
    }

    /**
    * @engineInternal
    */
    protected splitLongStringOver2048(text: string, styleIndex: number) {
        const partStringArr: string[] = [];
        const longStr = text;

        let curStart = 0;
        let curEnd = longStr.length / 2;
        let curString = longStr.substring(curStart, curEnd);
        let leftString = longStr.substring(curEnd);
        let curStringSize = this._calculateSize(styleIndex, curString);
        let leftStringSize = this._calculateSize(styleIndex, leftString);

        // a line should be an unit to split long string
        const lineCountForOnePart = 1;
        const sizeForOnePart = lineCountForOnePart * this.maxWidth;

        // divide text into some pieces of which the size is less than sizeForOnePart
        while (curStringSize.x > sizeForOnePart) {
            curEnd /= 2;
            // at least one char can be an entity, step back.
            if (curEnd < 1) {
                curEnd *= 2;
                break;
            }

            curString = curString.substring(curStart, curEnd);
            leftString = longStr.substring(curEnd);
            curStringSize = this._calculateSize(styleIndex, curString);
        }

        // avoid too many loops
        let leftTryTimes = 1000;
        // the minimum step of expansion or reduction
        let curWordStep = 1;
        while (leftTryTimes && curStart < text.length) {
            while (leftTryTimes && curStringSize.x < sizeForOnePart) {
                const nextPartExec = TmpUtils.getEnglishWordPartAtFirst(leftString);
                // add a character, unless there is a complete word at the beginning of the next line
                if (nextPartExec && nextPartExec.length > 0) {
                    curWordStep = nextPartExec[0].length;
                }
                curEnd += curWordStep;

                curString = longStr.substring(curStart, curEnd);
                leftString = longStr.substring(curEnd);
                curStringSize = this._calculateSize(styleIndex, curString);

                leftTryTimes--;
            }

            // reduce condition：size > maxwidth && curString.length >= 2
            while (leftTryTimes && curString.length >= 2 && curStringSize.x > sizeForOnePart) {
                curEnd -= curWordStep;
                curString = longStr.substring(curStart, curEnd);
                curStringSize = this._calculateSize(styleIndex, curString);
                // after the first reduction, the step should be 1.
                curWordStep = 1;

                leftTryTimes--;
            }

            // consider there is a part of a word at the end of this line, it should be moved to the next line
            if (curString.length >= 2) {
                const lastWordExec = TmpUtils.getEnglishWordPartAtLast(curString);
                if (lastWordExec && lastWordExec.length > 0
                    // to avoid endless loop when there is only one word in this line
                    && curString !== lastWordExec[0]) {
                    curEnd -= lastWordExec[0].length;
                    curString = longStr.substring(curStart, curEnd);
                }
            }

            // curStart and curEnd can be float since they are like positions of pointer,
            // but step must be integer because we split the complete characters of which the unit is integer.
            // it is reasonable that using the length of this result to estimate the next result.
            partStringArr.push(curString);
            const partStep = curString.length;
            curStart = curEnd;
            curEnd += partStep;

            curString = longStr.substring(curStart, curEnd);
            leftString = longStr.substring(curEnd);
            leftStringSize = this._calculateSize(styleIndex, leftString);

            leftTryTimes--;

            // Exit: If the left part string size is less than 2048, the method will finish.
            if (leftStringSize.x < 2048) {
                curStart = text.length;
                curEnd = text.length;
                curString = leftString;
                partStringArr.push(curString);
                break;
            } else {
                curStringSize = this._calculateSize(styleIndex, curString);
            }
        }

        return partStringArr;
    }

    private _measureText(styleIndex: number, string?: string): number | ((s: string) => number) {
        const func = (s: string) => {
            const labelSize = this._calculateSize(styleIndex, s);
            return labelSize.width;
        };
        if (string) {
            return func(string);
        } else {
            return func;
        }
    }

    protected _calculateSize(styleIndex: number, s: string) {
        let label: ISegment;
        if (this._labelSegmentsCache.length === 0) {
            label = this._createFontLabel(s);
            this._labelSegmentsCache.push(label);
        } else {
            label = this._labelSegmentsCache[0];
            label.node.getComponent(TextMeshPro)!.string = s;
        }
        label.styleIndex = styleIndex;
        this._applyTextAttribute(label);
        const labelSize = label.node._uiProps.uiTransformComp!.contentSize;
        return labelSize;
    }

    private _onTouchEnded(event: EventTouch): void {
        const components = this.node.getComponents(Component);

        for (const seg of this._segments) {
            const clickHandler = seg.clickHandler;
            const clickParam = seg.clickParam;
            if (clickHandler && this._containsTouchLocation(seg, event.touch!.getUILocation())) {
                components.forEach((component) => {
                    const func = component[clickHandler];
                    if (component.enabledInHierarchy && func) {
                        func.call(component, event, clickParam);
                    }
                });
                event.propagationStopped = true;
            }
        }
    }

    protected _containsTouchLocation(label: ISegment, point: Vec2) {
        const comp = label.node.getComponent(UITransform);
        if (!comp) {
            return false;
        }

        const myRect = comp.getBoundingBoxToWorld();
        return myRect.contains(point);
    }

    private _resetContent(node: Node): void {
        if (!node) {
            return;
        }

        const children = node.children;
        for (let i = children.length - 1; i >= 0; i--) {
            const child = children[i];
            if (child.name === RichTextChildName || child.name === RichTextChildImageName) {
                if (child.parent === node) {
                    child.parent = null;
                } else {
                    // In case child.parent !== this.node, child cannot be removed from children
                    children.splice(i, 1);
                }

                const segment = createSegment(child.name);
                segment.node = child;
                if (child.name === RichTextChildName) {
                    segment.comp = child.getComponent(TextMeshPro);
                    labelPool.put(segment);
                } else {
                    segment.comp = child.getComponent(Sprite);
                    imagePool.put(segment);
                }
                this._labelChildrenNum--;
            }
        }
    }

    private _resetState(): void {
        this._resetContent(this._labelContent);
        this._resetContent(this._imageContent);

        this._segments.length = 0;
        this._labelSegmentsCache.length = 0;
        this._linesWidth.length = 0;
        this._lineOffsetX = 0;
        this._lineCount = 1;
        this._labelWidth = 0;
        this._labelHeight = 0;
        this._layoutDirty = true;
    }

    private _activateChildren(active: boolean): void {
        this.node.children.forEach((content) => {
            for (let i = content.children.length - 1; i >= 0; i--) {
                const child = content.children[i];
                if (child.name === RichTextChildName || child.name === RichTextChildImageName) {
                    child.active = active;
                }
            }
        });
    }

    private _addLabelSegment(stringToken: string, styleIndex: number): ISegment {
        let labelSegment: ISegment;
        if (this._labelSegmentsCache.length === 0) {
            labelSegment = this._createFontLabel(stringToken);
        } else {
            labelSegment = this._labelSegmentsCache.pop()!;
            const label = labelSegment.node.getComponent(TextMeshPro);
            if (label) {
                label.string = stringToken;
            }
        }

        // set vertical alignments
        // because horizontal alignment is applied with line offsets in method "_updateRichTextPosition"
        const labelComp: TextMeshPro = labelSegment.comp as TextMeshPro;
        if (labelComp.verticalAlign !== this._verticalAlign) {
            labelComp.verticalAlign = this._verticalAlign;
        }

        labelSegment.styleIndex = styleIndex;
        labelSegment.lineCount = this._lineCount;
        labelSegment.node._uiProps.uiTransformComp!.setAnchorPoint(0, 0);
        labelSegment.node.layer = this.node.layer;
        this.labelContent.insertChild(labelSegment.node, this._labelChildrenNum++);
        this._applyTextAttribute(labelSegment);
        this._segments.push(labelSegment);

        return labelSegment;
    }

    private _updateRichTextWithMaxWidth(labelString, labelWidth, styleIndex): void {
        let fragmentWidth = labelWidth;
        let labelSegment: ISegment;

        if (this._lineOffsetX > 0 && fragmentWidth + this._lineOffsetX > this._maxWidth) {
            // concat previous line
            let checkStartIndex = 0;
            while (this._lineOffsetX <= this._maxWidth) {
                const checkEndIndex = this._getFirstWordLen(labelString, checkStartIndex, labelString.length);
                const checkString = labelString.substr(checkStartIndex, checkEndIndex);
                const checkStringWidth = this._measureText(styleIndex, checkString) as number;

                if (this._lineOffsetX + checkStringWidth <= this._maxWidth) {
                    this._lineOffsetX += checkStringWidth;
                    checkStartIndex += checkEndIndex;
                } else {
                    if (checkStartIndex > 0) {
                        const remainingString = labelString.substr(0, checkStartIndex);
                        this._addLabelSegment(remainingString, styleIndex);
                        labelString = labelString.substr(checkStartIndex, labelString.length);
                        fragmentWidth = this._measureText(styleIndex, labelString) as number;
                    }
                    this._updateLineInfo();
                    break;
                }
            }
        }
        if (fragmentWidth > this._maxWidth) {
            const fragments = TmpUtils.fragmentText(labelString, fragmentWidth, this._maxWidth,
                this._measureText(styleIndex) as unknown as (s: string) => number);
            for (let k = 0; k < fragments.length; ++k) {
                const splitString = fragments[k];
                labelSegment = this._addLabelSegment(splitString, styleIndex);
                const labelSize = labelSegment.node._uiProps.uiTransformComp!.contentSize;
                this._lineOffsetX += labelSize.width;
                if (fragments.length > 1 && k < fragments.length - 1) {
                    this._updateLineInfo();
                }
            }
        } else {
            this._lineOffsetX += fragmentWidth;
            this._addLabelSegment(labelString, styleIndex);
        }
    }

    private _isLastComponentCR(stringToken: string): boolean {
        return stringToken.length - 1 === stringToken.lastIndexOf("\n");
    }

    private _updateLineInfo(): void {
        this._linesWidth.push(this._lineOffsetX);
        this._lineOffsetX = 0;
        this._lineCount++;
    }

    private _needsUpdateTextLayout(newTextArray): boolean {
        if (this._layoutDirty || !this._textArray || !newTextArray) {
            return true;
        }

        if (this._textArray.length !== newTextArray.length) {
            return true;
        }

        for (let i = 0; i < this._textArray.length; i++) {
            const oldItem = this._textArray[i];
            const newItem = newTextArray[i];
            if (oldItem.text !== newItem.text) {
                return true;
            } else {
                const oldStyle = oldItem.style; const newStyle = newItem.style;
                if (oldStyle) {
                    if (newStyle) {
                        if (!!newStyle.outline !== !!oldStyle.outline) {
                            return true;
                        }
                        if (oldStyle.size !== newStyle.size
                            || oldStyle.italic !== newStyle.italic
                            || oldStyle.isImage !== newStyle.isImage) {
                            return true;
                        }
                        if (oldStyle.src !== newStyle.src
                            || oldStyle.imageAlign !== newStyle.imageAlign
                            || oldStyle.imageHeight !== newStyle.imageHeight
                            || oldStyle.imageWidth !== newStyle.imageWidth
                            || oldStyle.imageOffset !== newStyle.imageOffset) {
                            return true;
                        }
                    } else if (oldStyle.size || oldStyle.italic || oldStyle.isImage || oldStyle.outline) {
                        return true;
                    }
                } else if (newStyle) {
                    if (newStyle.size || newStyle.italic || newStyle.isImage || newStyle.outline) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    private _addRichTextImageElement(richTextElement): void {
        if (!richTextElement.style) {
            return;
        }

        const style = richTextElement.style;
        const spriteFrameName = style.src;
        const spriteFrame = this._imageAtlas && spriteFrameName && this._imageAtlas.getSpriteFrame(spriteFrameName);
        if (!spriteFrame) {
            warnID(4400);
        } else {
            const segment = this._createImage(spriteFrame);
            const sprite = segment.comp;
            switch (style.imageAlign) {
                case "top":
                    segment.node._uiProps.uiTransformComp!.setAnchorPoint(0, 1);
                    break;
                case "center":
                    segment.node._uiProps.uiTransformComp!.setAnchorPoint(0, 0.5);
                    break;
                default:
                    segment.node._uiProps.uiTransformComp!.setAnchorPoint(0, 0);
                    break;
            }

            if (style.imageOffset) {
                segment.imageOffset = style.imageOffset;
            }
            segment.node.layer = this.node.layer;
            this.imageContent.insertChild(segment.node, this._labelChildrenNum++);
            this._segments.push(segment);

            const spriteRect = spriteFrame.rect.clone();
            let scaleFactor = 1;
            let spriteWidth = spriteRect.width;
            let spriteHeight = spriteRect.height;
            const expectWidth = style.imageWidth || 0;
            const expectHeight = style.imageHeight || 0;

            if (expectHeight > 0) {
                scaleFactor = expectHeight / spriteHeight;
                spriteWidth *= scaleFactor;
                spriteHeight *= scaleFactor;
            } else {
                scaleFactor = this._lineHeight / spriteHeight;
                spriteWidth *= scaleFactor;
                spriteHeight *= scaleFactor;
            }

            if (expectWidth > 0) {
                spriteWidth = expectWidth;
            }

            if (this._maxWidth > 0) {
                if (this._lineOffsetX + spriteWidth > this._maxWidth) {
                    this._updateLineInfo();
                }
                this._lineOffsetX += spriteWidth;
            } else {
                this._lineOffsetX += spriteWidth;
                if (this._lineOffsetX > this._labelWidth) {
                    this._labelWidth = this._lineOffsetX;
                }
            }
            segment.node._uiProps.uiTransformComp!.setContentSize(spriteWidth, spriteHeight);
            segment.lineCount = this._lineCount;

            segment.clickHandler = "";
            segment.clickParam = "";
            const event = style.event;
            if (event) {
                segment.clickHandler = event.click;
                segment.clickParam = event.param;
            }
        }
    }

    protected _updateRichText(): void {
        if (!this.enabledInHierarchy) {
            return;
        }

        const newTextArray = _htmlTextParser.parse(this._string);
        if (!this._needsUpdateTextLayout(newTextArray)) {
            this._textArray = newTextArray.slice();
            this._updateLabelSegmentTextAttributes();
            return;
        }

        this._textArray = newTextArray.slice();
        this._resetState();

        let lastEmptyLine = false;
        let label: ISegment;

        for (let i = 0; i < this._textArray.length; ++i) {
            const richTextElement = this._textArray[i];
            let text = richTextElement.text;
            if (text === undefined) {
                continue;
            }

            // handle <br/> <img /> tag
            if (text === "") {
                if (richTextElement.style && richTextElement.style.isNewLine) {
                    this._updateLineInfo();
                    continue;
                }
                if (richTextElement.style && richTextElement.style.isImage && this._imageAtlas) {
                    this._addRichTextImageElement(richTextElement);
                    continue;
                }
            }

            const splitArr: string[] = this.SplitLongStringApproximatelyIn2048(text, i);
            text = splitArr.join("\n");

            const multilineTexts = text.split("\n");

            for (let j = 0; j < multilineTexts.length; ++j) {
                const labelString = multilineTexts[j];
                if (labelString === "") {
                    // for continues \n
                    if (this._isLastComponentCR(text) && j === multilineTexts.length - 1) {
                        continue;
                    }
                    this._updateLineInfo();
                    lastEmptyLine = true;
                    continue;
                }
                lastEmptyLine = false;

                if (this._maxWidth > 0) {
                    const labelWidth = this._measureText(i, labelString) as number;
                    this._updateRichTextWithMaxWidth(labelString, labelWidth, i);

                    if (multilineTexts.length > 1 && j < multilineTexts.length - 1) {
                        this._updateLineInfo();
                    }
                } else {
                    label = this._addLabelSegment(labelString, i);

                    this._lineOffsetX += label.node._uiProps.uiTransformComp!.width;
                    if (this._lineOffsetX > this._labelWidth) {
                        this._labelWidth = this._lineOffsetX;
                    }

                    if (multilineTexts.length > 1 && j < multilineTexts.length - 1) {
                        this._updateLineInfo();
                    }
                }
            }
        }
        if (!lastEmptyLine) {
            this._linesWidth.push(this._lineOffsetX);
        }

        if (this._maxWidth > 0) {
            this._labelWidth = this._maxWidth;
        }
        this._labelHeight = (this._lineCount + BASELINE_RATIO) * this._lineHeight;

        // trigger "size-changed" event
        this.node._uiProps.uiTransformComp!.setContentSize(this._labelWidth, this._labelHeight);

        this._updateRichTextPosition();
        this._layoutDirty = false;
    }

    private _getFirstWordLen(text, startIndex, textLen): number {
        let character = text.charAt(startIndex);
        if (TmpUtils.isUnicodeCJK(character) || TmpUtils.isUnicodeSpace(character)) {
            return 1;
        }

        let len = 1;
        for (let index = startIndex + 1; index < textLen; ++index) {
            character = text.charAt(index);
            if (TmpUtils.isUnicodeSpace(character) || TmpUtils.isUnicodeCJK(character)) {
                break;
            }

            len++;
        }

        return len;
    }

    private _updateRichTextPosition(): void {
        let nextTokenX = 0;
        let nextLineIndex = 1;
        const totalLineCount = this._lineCount;
        const trans = this.node._uiProps.uiTransformComp!;
        const anchorX = trans.anchorX;
        const anchorY = trans.anchorY;
        for (let i = 0; i < this._segments.length; ++i) {
            const segment = this._segments[i];
            const lineCount = segment.lineCount;
            if (lineCount > nextLineIndex) {
                nextTokenX = 0;
                nextLineIndex = lineCount;
            }

            let lineOffsetX = this._labelWidth * (this._horizontalAlign * 0.5 - anchorX);
            switch (this._horizontalAlign) {
                case HorizontalTextAlignment.LEFT:
                    break;
                case HorizontalTextAlignment.CENTER:
                    lineOffsetX -= this._linesWidth[lineCount - 1] / 2;
                    break;
                case HorizontalTextAlignment.RIGHT:
                    lineOffsetX -= this._linesWidth[lineCount - 1];
                    break;
                default:
                    break;
            }

            const pos = segment.node.position;
            segment.node.setPosition(nextTokenX + lineOffsetX,
                this._lineHeight * (totalLineCount - lineCount) - this._labelHeight * anchorY,
                pos.z);

            if (lineCount === nextLineIndex) {
                nextTokenX += segment.node._uiProps.uiTransformComp!.width;
                // 排版根据TextMeshPro字符信息适配
                let tmp: TextMeshPro = segment.node.getComponent(TextMeshPro);
                if (tmp && tmp.richTextDeltaX) {
                    nextTokenX += tmp.richTextDeltaX;
                }
            }

            const sprite = segment.node.getComponent(Sprite);
            if (sprite) {
                const position = segment.node.position.clone();
                // adjust img align (from <img align=top|center|bottom>)
                const lineHeightSet = this._lineHeight;
                const lineHeightReal = this._lineHeight * (1 + BASELINE_RATIO); // single line node height
                switch (segment.node._uiProps.uiTransformComp!.anchorY) {
                    case 1:
                        position.y += (lineHeightSet + ((lineHeightReal - lineHeightSet) / 2));
                        break;
                    case 0.5:
                        position.y += (lineHeightReal / 2);
                        break;
                    default:
                        position.y += ((lineHeightReal - lineHeightSet) / 2);
                        break;
                }
                // adjust img offset (from <img offset=12|12,34>)
                if (segment.imageOffset) {
                    const offsets = segment.imageOffset.split(",");
                    if (offsets.length === 1 && offsets[0]) {
                        const offsetY = parseFloat(offsets[0]);
                        if (Number.isInteger(offsetY)) position.y += offsetY;
                    } else if (offsets.length === 2) {
                        const offsetX = parseFloat(offsets[0]);
                        const offsetY = parseFloat(offsets[1]);
                        if (Number.isInteger(offsetX)) position.x += offsetX;
                        if (Number.isInteger(offsetY)) position.y += offsetY;
                    }
                }
                segment.node.position = position;
            }

            // // adjust y for label with outline
            // const outline = segment.node.getComponent(LabelOutline);
            // if (outline) {
            //     const position = segment.node.position.clone();
            //     position.y -= outline.width;
            //     segment.node.position = position;
            // }
        }
    }

    /**
     * 16进制颜色转换
     * @param color 
     */
    private _convertLiteralColorValue(color: string): Color {
        const colorValue = color.toUpperCase();
        if (Color[colorValue]) {
            const colorUse: Color = Color[colorValue];
            return colorUse;
        }
        else {
            let hexString = (color.indexOf("#") === 0) ? color.substring(1) : color;
            let r = parseInt(hexString.substring(0, 2), 16) || 0;
            let g = parseInt(hexString.substring(2, 4), 16) || 0;
            let b = parseInt(hexString.substring(4, 6), 16) || 0;
            let a = parseInt(hexString.substring(6, 8), 16);
            if (Number.isNaN(a)) {
                a = 255;
            }
            return new Color(r, g, b, a);
        }
    }

    /**
     * 更新字体样式
     */
    private _applyTextAttribute(labelSeg: ISegment): void {
        let labelComponent: TextMeshPro = labelSeg.node.getComponent(TextMeshPro);
        if (!labelComponent) {
            return;
        }

        const index = labelSeg.styleIndex;

        let textStyle: IHtmlTextParserStack = null;
        if (this._textArray[index]) {
            textStyle = this._textArray[index].style;
        }

        if (textStyle && textStyle.color) {
            labelComponent.color = this._convertLiteralColorValue(textStyle.color);
        } else {
            labelComponent.color = Color.WHITE;
        }

        labelComponent.setFont(this.font, this.textures);
        labelComponent.lineHeight = this.lineHeight;

        labelComponent.colorGradient = Boolean(textStyle && textStyle.colorGradient);
        if (labelComponent.colorGradient) {
            labelComponent.colorLB = this._convertLiteralColorValue(textStyle.colorGradient.lb);
            labelComponent.colorRB = this._convertLiteralColorValue(textStyle.colorGradient.rb);
            labelComponent.colorLT = this._convertLiteralColorValue(textStyle.colorGradient.lt);
            labelComponent.colorRT = this._convertLiteralColorValue(textStyle.colorGradient.rt);
        }

        if (textStyle && textStyle.face) {
            labelComponent.tmpUniform.faceColor = this._convertLiteralColorValue(textStyle.face.color);
            labelComponent.tmpUniform.faceDilate = textStyle.face.dilate;
            labelComponent.tmpUniform.faceSoftness = textStyle.face.softness;
        } else {
            labelComponent.tmpUniform.faceColor = Color.WHITE;
            labelComponent.tmpUniform.faceDilate = 0.5;
            labelComponent.tmpUniform.faceSoftness = 0.01;
        }

        labelComponent.enableItalic = Boolean(textStyle && textStyle.italic);
        labelComponent.enableUnderline = Boolean(textStyle && textStyle.underline);
        if (labelComponent.enableUnderline) {
            labelComponent.underlineOffset = textStyle.offset || 0;
        }
        labelComponent.enableStrikethrough = Boolean(textStyle && textStyle.strikethrough);
        if (labelComponent.enableStrikethrough) {
            labelComponent.strikethroughOffset = textStyle.offset || 0;
        }

        labelComponent.tmpUniform.enableOutline = Boolean(textStyle && textStyle.outline);
        if (textStyle && textStyle.outline) {
            labelComponent.tmpUniform.outlineColor = this._convertLiteralColorValue(textStyle.outline.color);
            labelComponent.tmpUniform.outlineThickness = textStyle.outline.thickness;
        }

        labelComponent.tmpUniform.enableUnderlay = Boolean(textStyle && textStyle.underlay);
        if (labelComponent.tmpUniform.enableUnderlay) {
            labelComponent.tmpUniform.underlayColor = this._convertLiteralColorValue(textStyle.underlay.color);
            labelComponent.tmpUniform.underlayOffset = v2(textStyle.underlay.x, textStyle.underlay.y);
            labelComponent.tmpUniform.underlayDilate = textStyle.underlay.dilate;
            labelComponent.tmpUniform.underlaySoftness = textStyle.underlay.softness;
        }

        labelComponent.tmpUniform.enableGlow = Boolean(textStyle && textStyle.glow);
        if (labelComponent.tmpUniform.enableGlow) {
            labelComponent.tmpUniform.glowColor = this._convertLiteralColorValue(textStyle.glow.color);
            labelComponent.tmpUniform.glowOffset = textStyle.glow.offset;
            labelComponent.tmpUniform.glowInner = textStyle.glow.inner;
            labelComponent.tmpUniform.glowOuter = textStyle.glow.outer;
            labelComponent.tmpUniform.glowPower = textStyle.glow.power;
        }

        if (textStyle && textStyle.size) {
            labelComponent.fontSize = textStyle.size;
        } else {
            labelComponent.fontSize = this.fontSize;
        }

        labelComponent.forceUpdateRenderData();

        labelSeg.clickHandler = "";
        labelSeg.clickParam = "";
        const event = textStyle?.event;
        if (event) {
            labelSeg.clickHandler = event.click || "";
            labelSeg.clickParam = event.param || "";
        }
    }

    protected _applyLayer(): void {
        for (const seg of this._segments) {
            seg.node.layer = this.node.layer;
        }
    }
}