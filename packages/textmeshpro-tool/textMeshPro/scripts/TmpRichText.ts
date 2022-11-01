import TextMeshPro from "./TextMeshPro";
import { HtmlTextParser } from "./utils/HtmlParser";
import TmpUtils from "./utils/TmpUtils";

const { ccclass, property, disallowMultiple, executeInEditMode } = cc._decorator;

const RichTextChildName = "RICHTEXT_CHILD";
const RichTextChildImageName = "RICHTEXT_Image_CHILD";
const _htmlTextParser = new HtmlTextParser();

let pool = new cc.js.Pool(function (node) {
    if (CC_EDITOR) {
        cc.isValid(node) && node.destroy();
        return false;
    }
    if (CC_DEV) {
        cc["assert"](!node._parent, "Recycling node\'s parent should be null!");
    }
    if (!cc.isValid(node)) {
        return false;
    }
    return true;
}, 20);

pool.get = function (string: string, richtext: TmpRichText) {
    let labelNode = this._get();
    if (!labelNode) {
        labelNode = new cc.PrivateNode(RichTextChildName);
        labelNode._objFlags |= cc.Object["Flags"].DontSave;
    }

    labelNode.setPosition(0, 0);
    labelNode.setAnchorPoint(0.5, 0.5);

    let labelComponent: TextMeshPro = labelNode.getComponent(TextMeshPro);
    if (!labelComponent) {
        labelComponent = labelNode.addComponent(TextMeshPro);
    }

    labelComponent.string = "";
    labelComponent.horizontalAlign = cc.Label.HorizontalAlign.LEFT;
    labelComponent.verticalAlign = cc.Label.VerticalAlign.CENTER;

    return labelNode;
};

/**
 * TextMeshPro富文本组件
 */
@ccclass
@disallowMultiple
@executeInEditMode
export default class TmpRichText extends cc.Component {

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

    @property(cc.JsonAsset)
    private _font: cc.JsonAsset = null;
    @property({ tooltip: CC_DEV && "字体资源\n依赖的纹理请勿打入图集\n在编辑器内拖拽此文件时，纹理必须和此文件处于同一目录下", type: cc.JsonAsset })
    private get font(): cc.JsonAsset { return this._font; }
    private set font(v: cc.JsonAsset) {
        if (this._font === v) { return; }
        this._font = v;
        if (CC_EDITOR) {
            this.editorInit();
        } else {
            this._layoutDirty = true;
            this._updateRichText();
        }
    }

    @property({ type: cc.Label.HorizontalAlign })
    private _horizontalAlign: cc.Label.HorizontalAlign = cc.Label.HorizontalAlign.LEFT;
    @property({ type: cc.Label.HorizontalAlign })
    public get horizontalAlign(): cc.Label.HorizontalAlign { return this._horizontalAlign; }
    public set horizontalAlign(v: cc.Label.HorizontalAlign) {
        if (this._horizontalAlign === v) { return; }
        this._horizontalAlign = v;
        this._layoutDirty = true;
        this._updateRichText();
    }

    @property({ type: cc.Label.VerticalAlign })
    private _verticalAlign: cc.Label.VerticalAlign = cc.Label.VerticalAlign.TOP;
    @property({ type: cc.Label.VerticalAlign })
    public get verticalAlign(): cc.Label.VerticalAlign { return this._verticalAlign; }
    public set verticalAlign(v: cc.Label.VerticalAlign) {
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
    @property({ tooltip: CC_DEV && "富文本的最大宽度" })
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

    @property(cc.SpriteAtlas)
    private _imageAtlas: cc.SpriteAtlas = null;
    @property(cc.SpriteAtlas)
    public get imageAtlas(): cc.SpriteAtlas { return this._imageAtlas; }
    public set imageAtlas(v: cc.SpriteAtlas) {
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

    @property(cc.Material)
    public material: cc.Material = null;

    @property({ tooltip: CC_DEV && "字体所依赖的纹理", type: cc.Texture2D, readonly: true })
    public textures: cc.Texture2D[] = [];

    private _textArray = null;
    private _labelSegments: cc.PrivateNode[] = [];
    private _labelSegmentsCache: cc.PrivateNode[] = [];
    private _linesWidth: number[] = [];
    private _lineOffsetX: number = 0;
    private _lineCount: number = 1;
    private _labelWidth: number = 0;
    private _labelHeight: number = 0;
    private _layoutDirty: boolean = true;

    // 文本父节点
    private _labelContent: cc.PrivateNode = null;
    private get labelContent(): cc.PrivateNode {
        if (!this._labelContent) {
            const content = "TMP_LABEL_CONTENT";
            this._labelContent = this.node.getChildByName(content) ?? new cc.PrivateNode(content);
            this._labelContent["_objFlags"] |= cc.Object["Flags"].DontSave;
            this.node.insertChild(this._labelContent, this._imageContent ? 1 : 0);
        }
        return this._labelContent;
    }
    // 图片父节点
    private _imageContent: cc.PrivateNode = null;
    private get imageContent(): cc.PrivateNode {
        if (!this._imageContent) {
            const content = "TMP_IMAGE_CONTENT";
            this._imageContent = this.node.getChildByName(content) ?? new cc.PrivateNode(content);
            this._imageContent["_objFlags"] |= cc.Object["Flags"].DontSave;
            this.node.insertChild(this._imageContent, 0);
        }
        return this._imageContent;
    }

    private editorInit(): void {
        if (CC_EDITOR) {
            // 加载图集
            if (!this._font || !this._font["_uuid"]) {
                this.textures = [];
                this._layoutDirty = true;
                this._updateRichText();
                return;
            }
            Editor.assetdb.queryUrlByUuid(this._font["_uuid"], (error: any, url: string) => {
                if (!url) {
                    return;
                }
                let start = 12;
                let end = url.lastIndexOf("/");
                let dir = url.slice(start, end + 1);
                let arr: Promise<cc.Texture2D>[] = [];
                this._font.json.pageData.forEach((v) => {
                    let imgUrl = dir + v.file;
                    arr.push(TmpUtils.load<cc.Texture2D>(imgUrl));
                });
                Promise.all(arr).then((v) => {
                    this.textures = v;
                    this._layoutDirty = true;
                    this._updateRichText();
                });
            });
        }
    }

    protected resetInEditor(): void {
        if (CC_EDITOR) {
            TmpUtils.load<cc.Material>(TmpUtils.TMP_MAT).then((mat) => {
                if (mat) {
                    this.material = mat;
                }
            });
        }
    }

    public onRestore(): void {
        if (CC_EDITOR) {
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

    protected onEnable(): void {
        if (this.handleTouchEvent) {
            this._addEventListeners();
        }
        this._onFontLoaded();
        this._activateChildren(true);
    }

    protected onDisable(): void {
        if (this.handleTouchEvent) {
            this._removeEventListeners();
        }
        this._activateChildren(false);
    }

    protected onDestroy(): void {
        for (let i = 0; i < this._labelSegments.length; ++i) {
            this._labelSegments[i].removeFromParent();
            pool.put(this._labelSegments[i]);
        }
    }

    private _onColorChanged(parentColor): void {
        this.node.children.forEach((content) => {
            content.children.forEach((childNode) => {
                childNode.color = parentColor;
            });
        });
    }

    private _addEventListeners(): void {
        this.node.on(cc.Node.EventType.TOUCH_END, this._onTouchEnded, this);
        this.node.on(cc.Node.EventType.COLOR_CHANGED, this._onColorChanged, this);
    }

    private _removeEventListeners(): void {
        this.node.off(cc.Node.EventType.TOUCH_END, this._onTouchEnded, this);
        this.node.off(cc.Node.EventType.COLOR_CHANGED, this._onColorChanged, this);
    }

    private _updateLabelSegmentTextAttributes(): void {
        this._labelSegments.forEach(function (item) {
            this._applyTextAttribute(item, null, true);
        }.bind(this));
    }

    private _createFontLabel(string: string): cc.Node {
        let node = pool.get(string, this);
        let tmp: TextMeshPro = node.getComponent(TextMeshPro);
        if (tmp && tmp.getMaterial(0) !== this.material) {
            tmp.setMaterial(0, this.material);
        }
        return node;
    }

    private _onFontLoaded(): void {
        this._layoutDirty = true;
        this._updateRichText();
    }

    private _measureText(styleIndex: number, string?: string): number | ((s: string) => number) {
        let self = this;
        let func = function (string) {
            let label: cc.Node;
            if (self._labelSegmentsCache.length === 0) {
                label = self._createFontLabel(string);
                self._labelSegmentsCache.push(label);
            } else {
                label = self._labelSegmentsCache[0];
            }
            label["_styleIndex"] = styleIndex;

            self._applyTextAttribute(label, string, true);
            let labelSize = label.getContentSize();
            return labelSize.width;
        };

        if (string) {
            return func(string);
        } else {
            return func;
        }
    }

    private _onTouchEnded(event): void {
        let components = this.node.getComponents(cc.Component);

        for (let i = 0; i < this._labelSegments.length; ++i) {
            let labelSegment = this._labelSegments[i];
            let clickHandler = labelSegment["_clickHandler"];
            let clickParam = labelSegment["_clickParam"];
            if (clickHandler && this._containsTouchLocation(labelSegment, event.touch.getLocation())) {
                components.forEach(function (component) {
                    if (component.enabledInHierarchy && component[clickHandler]) {
                        component[clickHandler](event, clickParam);
                    }
                });
                event.stopPropagation();
            }
        }
    }

    private _containsTouchLocation(label: cc.Node, point: cc.Vec2): boolean {
        let myRect = label.getBoundingBoxToWorld();
        return myRect.contains(point);
    }

    private _resetContent(node: cc.Node): void {
        if (!node) {
            return;
        }
        const children = node.children;
        for (let i = children.length - 1; i >= 0; i--) {
            const child = children[i];
            if (child.name === RichTextChildName || child.name === RichTextChildImageName) {
                if (child.parent === node) {
                    child.parent = null;
                }
                else {
                    // In case child.parent !== this.node, child cannot be removed from children
                    children.splice(i, 1);
                }
                if (child.name === RichTextChildName) {
                    pool.put(child);
                }
            }
        }
    }

    private _resetState(): void {
        for (let i = 0; i < this.node.childrenCount; i++) {
            this._resetContent(this.node.children[i]);
        }

        this._labelSegments.length = 0;
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
                let child = content.children[i];
                if (child.name === RichTextChildName || child.name === RichTextChildImageName) {
                    child.active = active;
                }
            }
        });
    }

    private _addLabelSegment(stringToken: string, styleIndex: number): cc.Node {
        let labelSegment;
        if (this._labelSegmentsCache.length === 0) {
            labelSegment = this._createFontLabel(stringToken);
        } else {
            labelSegment = this._labelSegmentsCache.pop();
        }

        const tmp: TextMeshPro = labelSegment.getComponent(TextMeshPro);
        if (tmp.verticalAlign !== this._verticalAlign) {
            tmp.verticalAlign = this._verticalAlign;
        }

        labelSegment._styleIndex = styleIndex;
        labelSegment._lineCount = this._lineCount;
        labelSegment.active = this.node.active;

        labelSegment.setAnchorPoint(0, 0);
        this._applyTextAttribute(labelSegment, stringToken, !!CC_EDITOR);

        this.labelContent.addChild(labelSegment);
        this._labelSegments.push(labelSegment);

        return labelSegment;
    }

    private _updateRichTextWithMaxWidth(labelString, labelWidth, styleIndex): void {
        let fragmentWidth = labelWidth;
        let labelSegment;

        if (this._lineOffsetX > 0 && fragmentWidth + this._lineOffsetX > this.maxWidth) {
            //concat previous line
            let checkStartIndex = 0;
            while (this._lineOffsetX <= this.maxWidth) {
                let checkEndIndex = this._getFirstWordLen(labelString,
                    checkStartIndex,
                    labelString.length);
                let checkString = labelString.substr(checkStartIndex, checkEndIndex);
                let checkStringWidth: number = this._measureText(styleIndex, checkString) as number;

                if (this._lineOffsetX + checkStringWidth <= this.maxWidth) {
                    this._lineOffsetX += checkStringWidth;
                    checkStartIndex += checkEndIndex;
                }
                else {
                    if (checkStartIndex > 0) {
                        let remainingString = labelString.substr(0, checkStartIndex);
                        this._addLabelSegment(remainingString, styleIndex);
                        labelString = labelString.substr(checkStartIndex, labelString.length);
                        fragmentWidth = this._measureText(styleIndex, labelString);
                    }
                    this._updateLineInfo();
                    break;
                }
            }
        }
        if (fragmentWidth > this.maxWidth) {
            let fragments = cc.textUtils.fragmentText(labelString,
                fragmentWidth,
                this.maxWidth,
                this._measureText(styleIndex));
            for (let k = 0; k < fragments.length; ++k) {
                let splitString = fragments[k];
                labelSegment = this._addLabelSegment(splitString, styleIndex);
                let labelSize = labelSegment.getContentSize();
                this._lineOffsetX += labelSize.width;
                if (fragments.length > 1 && k < fragments.length - 1) {
                    this._updateLineInfo();
                }
            }
        }
        else {
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

        for (let i = 0; i < this._textArray.length; ++i) {
            let oldItem = this._textArray[i];
            let newItem = newTextArray[i];
            if (oldItem.text !== newItem.text) {
                return true;
            }
            else {
                let oldStyle = oldItem.style, newStyle = newItem.style;
                if (oldStyle) {
                    if (newStyle) {
                        if (!oldStyle.outline !== !newStyle.outline) {
                            return true;
                        }
                        if (oldStyle.size !== newStyle.size
                            || !oldStyle.italic !== !newStyle.italic
                            || oldStyle.isImage !== newStyle.isImage) {
                            return true;
                        }
                        if (oldStyle.src !== newStyle.src ||
                            oldStyle.imageAlign !== newStyle.imageAlign ||
                            oldStyle.imageHeight !== newStyle.imageHeight ||
                            oldStyle.imageWidth !== newStyle.imageWidth ||
                            oldStyle.imageOffset !== newStyle.imageOffset) {
                            return true;
                        }
                    }
                    else {
                        if (oldStyle.size || oldStyle.italic || oldStyle.isImage || oldStyle.outline) {
                            return true;
                        }
                    }
                }
                else {
                    if (newStyle) {
                        if (newStyle.size || newStyle.italic || newStyle.isImage || newStyle.outline) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    private _addRichTextImageElement(richTextElement): void {
        let spriteFrameName = richTextElement.style.src;
        let spriteFrame = this.imageAtlas.getSpriteFrame(spriteFrameName);
        if (spriteFrame) {
            let spriteNode = new cc.PrivateNode(RichTextChildImageName);
            spriteNode["_objFlags"] |= cc.Object["Flags"].DontSave;
            let spriteComponent = spriteNode.addComponent(cc.Sprite);
            switch (richTextElement.style.imageAlign) {
                case "top":
                    spriteNode.setAnchorPoint(0, 1);
                    break;
                case "center":
                    spriteNode.setAnchorPoint(0, 0.5);
                    break;
                default:
                    spriteNode.setAnchorPoint(0, 0);
                    break;
            }
            if (richTextElement.style.imageOffset) spriteNode["_imageOffset"] = richTextElement.style.imageOffset;
            spriteComponent.type = cc.Sprite.Type.SLICED;
            spriteComponent.sizeMode = cc.Sprite.SizeMode.CUSTOM;
            this.imageContent.addChild(spriteNode);
            this._labelSegments.push(spriteNode);

            let spriteRect = spriteFrame.getRect();
            let scaleFactor = 1;
            let spriteWidth = spriteRect.width;
            let spriteHeight = spriteRect.height;
            let expectWidth = richTextElement.style.imageWidth;
            let expectHeight = richTextElement.style.imageHeight;

            if (expectHeight > 0) {
                scaleFactor = expectHeight / spriteHeight;
                spriteWidth = spriteWidth * scaleFactor;
                spriteHeight = spriteHeight * scaleFactor;
            }
            else {
                scaleFactor = this.lineHeight / spriteHeight;
                spriteWidth = spriteWidth * scaleFactor;
                spriteHeight = spriteHeight * scaleFactor;
            }

            if (expectWidth > 0) spriteWidth = expectWidth;

            if (this.maxWidth > 0) {
                if (this._lineOffsetX + spriteWidth > this.maxWidth) {
                    this._updateLineInfo();
                }
                this._lineOffsetX += spriteWidth;

            }
            else {
                this._lineOffsetX += spriteWidth;
                if (this._lineOffsetX > this._labelWidth) {
                    this._labelWidth = this._lineOffsetX;
                }
            }
            spriteComponent.spriteFrame = spriteFrame;
            spriteNode.setContentSize(spriteWidth, spriteHeight);
            spriteNode["_lineCount"] = this._lineCount;

            if (richTextElement.style.event) {
                if (richTextElement.style.event.click) {
                    spriteNode["_clickHandler"] = richTextElement.style.event.click;
                }
                if (richTextElement.style.event.param) {
                    spriteNode["_clickParam"] = richTextElement.style.event.param;
                }
                else {
                    spriteNode["_clickParam"] = "";
                }
            }
            else {
                spriteNode["_clickHandler"] = null;
            }
        }
        else {
            cc["warnID"](4400);
        }
    }

    private _updateRichText(): void {
        if (!this.enabledInHierarchy) return;

        let newTextArray = _htmlTextParser.parse(this.string);
        if (!this._needsUpdateTextLayout(newTextArray)) {
            this._textArray = newTextArray.slice();
            this._updateLabelSegmentTextAttributes();
            return;
        }

        this._textArray = newTextArray.slice();
        this._resetState();

        let lastEmptyLine = false;
        let label;
        let labelSize;

        for (let i = 0; i < this._textArray.length; ++i) {
            let richTextElement = this._textArray[i];
            let text = richTextElement.text;
            //handle <br/> <img /> tag
            if (text === "") {
                if (richTextElement.style && richTextElement.style.newline) {
                    this._updateLineInfo();
                    continue;
                }
                if (richTextElement.style && richTextElement.style.isImage && this.imageAtlas) {
                    this._addRichTextImageElement(richTextElement);
                    continue;
                }
            }
            let multilineTexts = text.split("\n");

            for (let j = 0; j < multilineTexts.length; ++j) {
                let labelString = multilineTexts[j];
                if (labelString === "") {
                    //for continues \n
                    if (this._isLastComponentCR(text)
                        && j === multilineTexts.length - 1) {
                        continue;
                    }
                    this._updateLineInfo();
                    lastEmptyLine = true;
                    continue;
                }
                lastEmptyLine = false;

                if (this.maxWidth > 0) {
                    let labelWidth = this._measureText(i, labelString);
                    this._updateRichTextWithMaxWidth(labelString, labelWidth, i);

                    if (multilineTexts.length > 1 && j < multilineTexts.length - 1) {
                        this._updateLineInfo();
                    }
                }
                else {
                    label = this._addLabelSegment(labelString, i);
                    labelSize = label.getContentSize();

                    this._lineOffsetX += labelSize.width;
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

        if (this.maxWidth > 0) {
            this._labelWidth = this.maxWidth;
        }
        this._labelHeight = (this._lineCount + cc.textUtils.BASELINE_RATIO) * this.lineHeight;

        // trigger "size-changed" event
        this.node.setContentSize(this._labelWidth, this._labelHeight);

        this._updateRichTextPosition();
        this._layoutDirty = false;
    }

    private _getFirstWordLen(text, startIndex, textLen): number {
        let character = text.charAt(startIndex);
        if (cc.textUtils.isUnicodeCJK(character)
            || cc.textUtils.isUnicodeSpace(character)) {
            return 1;
        }

        let len = 1;
        for (let index = startIndex + 1; index < textLen; ++index) {
            character = text.charAt(index);
            if (cc.textUtils.isUnicodeSpace(character)
                || cc.textUtils.isUnicodeCJK(character)) {
                break;
            }
            len++;
        }

        return len;
    }

    private _updateRichTextPosition(): void {
        let nextTokenX = 0;
        let nextLineIndex = 1;
        let totalLineCount = this._lineCount;
        for (let i = 0; i < this._labelSegments.length; ++i) {
            let label = this._labelSegments[i];
            let lineCount = label["_lineCount"];
            if (lineCount > nextLineIndex) {
                nextTokenX = 0;
                nextLineIndex = lineCount;
            }
            let lineOffsetX = 0;
            switch (this.horizontalAlign) {
                case cc.Label.HorizontalAlign.LEFT:
                    lineOffsetX = - this._labelWidth / 2;
                    break;
                case cc.Label.HorizontalAlign.CENTER:
                    lineOffsetX = - this._linesWidth[lineCount - 1] / 2;
                    break;
                case cc.Label.HorizontalAlign.RIGHT:
                    lineOffsetX = this._labelWidth / 2 - this._linesWidth[lineCount - 1];
                    break;
                default:
                    break;
            }
            label.x = nextTokenX + lineOffsetX;
            label.y = this.lineHeight * (totalLineCount - lineCount) - this._labelHeight / 2;

            if (lineCount === nextLineIndex) {
                let labelSize = label.getContentSize();
                nextTokenX += labelSize.width;
                // 排版根据TextMeshPro字符信息适配
                let tmp: TextMeshPro = label.getComponent(TextMeshPro);
                if (tmp && tmp.richTextDeltaX) {
                    nextTokenX += tmp.richTextDeltaX;
                }
            }

            let sprite = label.getComponent(cc.Sprite);
            if (sprite) {
                // adjust img align (from <img align=top|center|bottom>)
                let lineHeightSet = this.lineHeight;
                let lineHeightReal = this.lineHeight * (1 + cc.textUtils.BASELINE_RATIO); //single line node height
                switch (label.anchorY) {
                    case 1:
                        label.y += (lineHeightSet + ((lineHeightReal - lineHeightSet) / 2));
                        break;
                    case 0.5:
                        label.y += (lineHeightReal / 2);
                        break;
                    default:
                        label.y += ((lineHeightReal - lineHeightSet) / 2);
                        break;
                }
                // adjust img offset (from <img offset=12|12,34>)
                if (label["_imageOffset"]) {
                    let offsets = label["_imageOffset"].split(",");
                    if (offsets.length === 1 && offsets[0]) {
                        let offsetY = parseFloat(offsets[0]);
                        if (Number.isInteger(offsetY)) label.y += offsetY;
                    }
                    else if (offsets.length === 2) {
                        let offsetX = parseFloat(offsets[0]);
                        let offsetY = parseFloat(offsets[1]);
                        if (Number.isInteger(offsetX)) label.x += offsetX;
                        if (Number.isInteger(offsetY)) label.y += offsetY;
                    }
                }
            }

            //adjust y for label with outline
            // let outline = label.getComponent(cc.LabelOutline);
            // if (outline && outline.width) label.y = label.y - outline.width;
        }
    }

    /**
     * 16进制颜色转换
     * @param color 
     */
    private _convertLiteralColorValue(color: string): cc.Color {
        let colorValue = color.toUpperCase();
        if (cc.Color[colorValue]) {
            return cc.Color[colorValue];
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
            return cc.color(r, g, b, a);
        }
    }

    /**
     * 更新字体样式
     * @param labelNode 
     * @param string 
     * @param force 
     * @param needSpaceW 临时计算宽度时需要考虑空格字符串的宽度
     */
    private _applyTextAttribute(labelNode: cc.Node, string: string, force: boolean): void {
        let labelComponent: TextMeshPro = labelNode.getComponent(TextMeshPro);
        if (!labelComponent) {
            return;
        }

        let index = labelNode["_styleIndex"];

        let textStyle = null;
        if (this._textArray[index]) {
            textStyle = this._textArray[index].style;
        }

        if (textStyle && textStyle.color) {
            labelNode.color = this._convertLiteralColorValue(textStyle.color);
        } else {
            labelNode.color = this.node.color;
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
            labelComponent.tmpUniform.faceColor = cc.Color.WHITE;
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
            labelComponent.tmpUniform.underlayOffset = cc.v2(textStyle.underlay.x, textStyle.underlay.y);
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

        if (string !== null) {
            if (typeof string !== "string") {
                string = "" + string;
            }
            labelComponent.string = string;
        }

        force && labelComponent.forceUpdateRenderData();

        if (textStyle && textStyle.event) {
            if (textStyle.event.click) {
                labelNode["_clickHandler"] = textStyle.event.click;
            }
            if (textStyle.event.param) {
                labelNode["_clickParam"] = textStyle.event.param;
            }
            else {
                labelNode["_clickParam"] = "";
            }
        }
        else {
            labelNode["_clickHandler"] = null;
        }
    }
}