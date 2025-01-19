import TmpAssembler from "./utils/TmpAssembler";
import TmpFontConfig from "./utils/TmpFontConfig";
import TmpUtils from "./utils/TmpUtils";

const { ccclass, property, executeInEditMode, menu } = cc._decorator;

/**
 * TextMeshPro的排版方式
 */
export enum TmpOverflow {
    NONE,
    CLAMP,
    ELLIPSIS,
    SHRINK,
    RESIZE_HEIGHT
}

/**
 * TextMeshPro Uniform参数
 */
@ccclass("TmpUniform")
export class TmpUniform {
    @property(cc.Color)
    private _faceColor: cc.Color = cc.Color.WHITE;
    @property({ tooltip: CC_DEV && "文本主体颜色", type: cc.Color })
    public get faceColor(): cc.Color { return this._faceColor; }
    public set faceColor(v: cc.Color) {
        if (!CC_EDITOR && this._faceColor === v) { return; }
        this._faceColor = v;
        if (!this._comp) { return; }
        this._comp.updateTmpMatFace(this._comp.getMaterial(0));
    }

    @property()
    private _faceDilate: number = 0.5;
    @property({ tooltip: CC_DEV && "文本主体厚度", range: [0, 1, 0.01] })
    public get faceDilate(): number { return this._faceDilate; }
    public set faceDilate(v: number) {
        if (this._faceDilate === v) { return; }
        this._faceDilate = v;
        if (!this._comp) { return; }
        this._comp.updateTmpMatFace(this._comp.getMaterial(0));
    }

    @property()
    private _faceSoftness: number = 0.01;
    @property({ tooltip: CC_DEV && "文本主体柔和度", range: [0, 1, 0.01] })
    public get faceSoftness(): number { return this._faceSoftness; }
    public set faceSoftness(v: number) {
        if (this._faceSoftness === v) { return; }
        this._faceSoftness = v;
        if (!this._comp) { return; }
        this._comp.updateTmpMatFace(this._comp.getMaterial(0));
    }

    @property()
    private _enableOutline: boolean = false;
    @property({ tooltip: CC_DEV && "是否启用描边效果" })
    public get enableOutline(): boolean { return this._enableOutline; }
    public set enableOutline(v: boolean) {
        if (this._enableOutline === v) { return; }
        this._enableOutline = v;
        if (!this._comp) { return; }
        this._comp.updateTmpMatOutline(this._comp.getMaterial(0));
    }

    @property(cc.Color)
    private _outlineColor: cc.Color = cc.color(255, 0, 0, 255);
    @property({
        tooltip: CC_DEV && "描边颜色",
        type: cc.Color,
        visible() { return this._enableOutline; }
    })
    public get outlineColor(): cc.Color { return this._outlineColor; }
    public set outlineColor(v: cc.Color) {
        if (!CC_EDITOR && this._outlineColor === v) { return; }
        this._outlineColor = v;
        if (!this._comp) { return; }
        this._comp.updateTmpMatOutline(this._comp.getMaterial(0));
    }

    @property()
    private _outlineThickness: number = 0.1;
    @property({
        tooltip: CC_DEV && "描边厚度",
        range: [0, 1, 0.01],
        visible() { return this._enableOutline; }
    })
    public get outlineThickness(): number { return this._outlineThickness; }
    public set outlineThickness(v: number) {
        if (this._outlineThickness === v) { return; }
        this._outlineThickness = v;
        if (!this._comp) { return; }
        this._comp.updateTmpMatOutline(this._comp.getMaterial(0));
    }

    @property()
    private _enableUnderlay: boolean = false;
    @property({ tooltip: CC_DEV && "是否启用阴影效果" })
    public get enableUnderlay(): boolean { return this._enableUnderlay; }
    public set enableUnderlay(v: boolean) {
        if (this._enableUnderlay === v) { return; }
        this._enableUnderlay = v;
        if (!this._comp) { return; }
        this._comp.updateTmpMatUnderlay(this._comp.getMaterial(0));
    }

    @property(cc.Color)
    private _underlayColor: cc.Color = cc.color(0, 0, 0, 255);
    @property({
        tooltip: CC_DEV && "阴影颜色",
        type: cc.Color,
        visible() { return this._enableUnderlay; }
    })
    public get underlayColor(): cc.Color { return this._underlayColor; }
    public set underlayColor(v: cc.Color) {
        if (!CC_EDITOR && this._underlayColor === v) { return; }
        this._underlayColor = v;
        if (!this._comp) { return; }
        this._comp.updateTmpMatUnderlay(this._comp.getMaterial(0));
    }

    @property(cc.Vec2)
    private _underlayOffset: cc.Vec2 = cc.v2(0, 0);
    @property({
        tooltip: CC_DEV && "阴影偏移",
        type: cc.Vec2,
        range: [-1, 1],
        visible() { return this._enableUnderlay; }
    })
    public get underlayOffset(): cc.Vec2 { return this._underlayOffset; }
    public set underlayOffset(v: cc.Vec2) {
        if (!CC_EDITOR && this._underlayOffset === v) { return; }
        this._underlayOffset = v;
        if (!this._comp) { return; }
        this._comp.updateTmpMatUnderlay(this._comp.getMaterial(0));
    }

    @property()
    private _underlayDilate: number = 0.5;
    @property({
        tooltip: CC_DEV && "阴影厚度",
        range: [0, 1, 0.01],
        visible() { return this._enableUnderlay; }
    })
    public get underlayDilate(): number { return this._underlayDilate; }
    public set underlayDilate(v: number) {
        if (this._underlayDilate === v) { return; }
        this._underlayDilate = v;
        if (!this._comp) { return; }
        this._comp.updateTmpMatUnderlay(this._comp.getMaterial(0));
    }

    @property()
    private _underlaySoftness: number = 0.1;
    @property({
        tooltip: CC_DEV && "阴影柔和度",
        range: [0, 1, 0.01],
        visible() { return this._enableUnderlay; }
    })
    public get underlaySoftness(): number { return this._underlaySoftness; }
    public set underlaySoftness(v: number) {
        if (this._underlaySoftness === v) { return; }
        this._underlaySoftness = v;
        if (!this._comp) { return; }
        this._comp.updateTmpMatUnderlay(this._comp.getMaterial(0));
    }

    @property()
    private _enableGlow: boolean = false;
    @property({ tooltip: CC_DEV && "是否启用辉光效果" })
    public get enableGlow(): boolean { return this._enableGlow; }
    public set enableGlow(v: boolean) {
        if (this._enableGlow === v) { return; }
        this._enableGlow = v;
        if (!this._comp) { return; }
        this._comp.updateTmpMatGlow(this._comp.getMaterial(0));
    }

    @property(cc.Color)
    private _glowColor: cc.Color = cc.color(0, 255, 0, 255);
    @property({
        tooltip: CC_DEV && "辉光颜色",
        type: cc.Color,
        visible() { return this._enableGlow; }
    })
    public get glowColor(): cc.Color { return this._glowColor; }
    public set glowColor(v: cc.Color) {
        if (!CC_EDITOR && this._glowColor === v) { return; }
        this._glowColor = v;
        if (!this._comp) { return; }
        this._comp.updateTmpMatGlow(this._comp.getMaterial(0));
    }

    @property()
    private _glowOffset: number = 0.5;
    @property({
        tooltip: CC_DEV && "辉光偏移",
        range: [0, 1, 0.01],
        visible() { return this._enableGlow; }
    })
    public get glowOffset(): number { return this._glowOffset; }
    public set glowOffset(v: number) {
        if (this._glowOffset === v) { return; }
        this._glowOffset = v;
        if (!this._comp) { return; }
        this._comp.updateTmpMatGlow(this._comp.getMaterial(0));
    }

    @property()
    private _glowInner: number = 0.01;
    @property({
        tooltip: CC_DEV && "辉光向内的厚度",
        range: [0, 1, 0.01],
        visible() { return this._enableGlow; }
    })
    public get glowInner(): number { return this._glowInner; }
    public set glowInner(v: number) {
        if (this._glowInner === v) { return; }
        this._glowInner = v;
        if (!this._comp) { return; }
        this._comp.updateTmpMatGlow(this._comp.getMaterial(0));
    }

    @property()
    private _glowOuter: number = 0.01;
    @property({
        tooltip: CC_DEV && "辉光向外的厚度",
        range: [0, 1, 0.01],
        visible() { return this._enableGlow; }
    })
    public get glowOuter(): number { return this._glowOuter; }
    public set glowOuter(v: number) {
        if (this._glowOuter === v) { return; }
        this._glowOuter = v;
        if (!this._comp) { return; }
        this._comp.updateTmpMatGlow(this._comp.getMaterial(0));
    }

    @property()
    private _glowPower: number = 1;
    @property({
        tooltip: CC_DEV && "辉光强度",
        range: [0, 1, 0.01],
        visible() { return this._enableGlow; }
    })
    public get glowPower(): number { return this._glowPower; }
    public set glowPower(v: number) {
        if (this._glowPower === v) { return; }
        this._glowPower = v;
        if (!this._comp) { return; }
        this._comp.updateTmpMatGlow(this._comp.getMaterial(0));
    }

    private _comp: TextMeshPro = null;
    public get comp(): TextMeshPro { return this._comp; }

    public init(text: TextMeshPro) {
        this._comp = text;

        if (CC_EDITOR) {
            return;
        }
        let material = this._comp.getMaterial(0);
        this._comp.updateTmpMatFace(material);
        this._comp.updateTmpMatOutline(material);
        this._comp.updateTmpMatUnderlay(material);
        this._comp.updateTmpMatGlow(material);
    }
}

@ccclass
@executeInEditMode
@menu("TextMeshPro组件/TextMeshPro")
export default class TextMeshPro extends cc.RenderComponent {
    @property
    private _string: string = "";
    @property({ multiline: true })
    public get string(): string { return this._string; }
    public set string(v: string) {
        if (this._string === v) { return; }
        this._string = v;
        this["setVertsDirty"]();
        this._checkStringEmpty();
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
            if (!this.enabledInHierarchy) { return; }
            this.forceUpdateRenderData();
        }
    }

    @property({ type: cc.Label.HorizontalAlign })
    private _horizontalAlign: cc.Label.HorizontalAlign = cc.Label.HorizontalAlign.LEFT;
    @property({ type: cc.Label.HorizontalAlign })
    public get horizontalAlign(): cc.Label.HorizontalAlign { return this._horizontalAlign; }
    public set horizontalAlign(v: cc.Label.HorizontalAlign) {
        if (this._horizontalAlign === v) { return; }
        this._horizontalAlign = v;
        this["setVertsDirty"]();
    }

    @property({ type: cc.Label.VerticalAlign })
    private _verticalAlign: cc.Label.VerticalAlign = cc.Label.VerticalAlign.TOP;
    @property({ type: cc.Label.VerticalAlign })
    public get verticalAlign(): cc.Label.VerticalAlign { return this._verticalAlign; }
    public set verticalAlign(v: cc.Label.VerticalAlign) {
        if (this._verticalAlign === v) { return; }
        this._verticalAlign = v;
        this["setVertsDirty"]();
    }

    @property
    private _actualFontSize: number = 0;
    @property({ visible() { return this._overflow === TmpOverflow.SHRINK; } })
    public get actualFontSize(): number { return this._actualFontSize; }

    @property
    public get bmfontOriginalSize(): number { return this.font ? this.font.json.size : -1; }

    @property
    private _fontSize: number = 32;
    @property({ range: [0, 1024] })
    public get fontSize(): number { return this._fontSize; }
    public set fontSize(v: number) {
        if (this._fontSize === v) { return; }
        this._fontSize = v;
        this["setVertsDirty"]();
    }

    @property
    private _lineHeight: number = 32;
    @property
    public get lineHeight(): number { return this._lineHeight; }
    public set lineHeight(v: number) {
        if (this._lineHeight === v) { return; }
        this._lineHeight = v;
        this["setVertsDirty"]();
    }

    @property
    private _spacingX: number = 0;
    @property
    public get spacingX(): number { return this._spacingX; }
    public set spacingX(v: number) {
        if (this._spacingX === v) { return; }
        this._spacingX = v;
        this["setVertsDirty"]();
    }

    @property({ type: cc.Enum(TmpOverflow) })
    private _overflow: TmpOverflow = TmpOverflow.NONE;
    @property({ tooltip: CC_DEV && "文本的排版方式", type: cc.Enum(TmpOverflow) })
    public get overflow(): TmpOverflow { return this._overflow; }
    public set overflow(v: TmpOverflow) {
        if (this._overflow === v) { return; }
        this._overflow = v;
        this["setVertsDirty"]();
    }

    @property
    private _enableWrapText: boolean = true;
    @property({
        tooltip: CC_DEV && "是否启用自动换行",
        visible() {
            return this._overflow === TmpOverflow.CLAMP || this._overflow === TmpOverflow.ELLIPSIS;
        }
    })
    public get enableWrapText(): boolean { return this._enableWrapText; }
    public set enableWrapText(v: boolean) {
        if (this._enableWrapText === v) { return; }
        this._enableWrapText = v;
        this["setVertsDirty"]();
    }

    @property
    private _enableItalic: boolean = false;
    @property({ tooltip: CC_DEV && "是否启用斜体" })
    public get enableItalic(): boolean { return this._enableItalic; }
    public set enableItalic(v: boolean) {
        if (this._enableItalic === v) { return; }
        this._enableItalic = v;
        this["setVertsDirty"]();
    }

    @property
    private _enableUnderline: boolean = false;
    @property({ tooltip: CC_DEV && "是否启用下划线" })
    public get enableUnderline(): boolean { return this._enableUnderline; }
    public set enableUnderline(v: boolean) {
        if (this._enableUnderline === v) { return; }
        this._enableUnderline = v;
        this["setVertsDirty"]();
    }

    @property
    private _underlineOffset: number = 0;
    @property({ tooltip: CC_DEV && "下划线高度偏移", visible() { return this._enableUnderline; } })
    public get underlineOffset(): number { return this._underlineOffset; }
    public set underlineOffset(v: number) {
        if (this._underlineOffset === v) { return; }
        this._underlineOffset = v;
        this["setVertsDirty"]();
    }

    @property
    private _enableStrikethrough: boolean = false;
    @property({ tooltip: CC_DEV && "是否启用删除线" })
    public get enableStrikethrough(): boolean { return this._enableStrikethrough; }
    public set enableStrikethrough(v: boolean) {
        if (this._enableStrikethrough === v) { return; }
        this._enableStrikethrough = v;
        this["setVertsDirty"]();
    }

    @property
    private _strikethroughOffset: number = 0;
    @property({ tooltip: CC_DEV && "删除线高度偏移", visible() { return this._enableStrikethrough; } })
    public get strikethroughOffset(): number { return this._strikethroughOffset; }
    public set strikethroughOffset(v: number) {
        if (this._strikethroughOffset === v) { return; }
        this._strikethroughOffset = v;
        this["setVertsDirty"]();
    }

    @property
    private _colorGradient: boolean = false;
    @property({ tooltip: CC_DEV && "是否启用颜色渐变，会和顶点颜色混合为最终的顶点颜色" })
    public get colorGradient(): boolean { return this._colorGradient; }
    public set colorGradient(v: boolean) {
        if (this._colorGradient === v) { return; }
        this._colorGradient = v;
        this._colorExtraDirty = true;
    }

    @property(cc.Color)
    private _colorLB: cc.Color = cc.Color.WHITE;
    @property({ tooltip: CC_DEV && "左下顶点", type: cc.Color, visible() { return this._colorGradient; } })
    public get colorLB(): cc.Color { return this._colorLB; }
    public set colorLB(v: cc.Color) {
        if (!CC_EDITOR && this._colorLB === v) { return; }
        this._colorLB = v;
        this._colorExtraDirty = true;
    }

    @property(cc.Color)
    private _colorRB: cc.Color = cc.Color.WHITE;
    @property({ tooltip: CC_DEV && "右下顶点", type: cc.Color, visible() { return this._colorGradient; } })
    public get colorRB(): cc.Color { return this._colorRB; }
    public set colorRB(v: cc.Color) {
        if (!CC_EDITOR && this._colorRB === v) { return; }
        this._colorRB = v;
        this._colorExtraDirty = true;
    }

    @property(cc.Color)
    private _colorLT: cc.Color = cc.Color.WHITE;
    @property({ tooltip: CC_DEV && "左上顶点", type: cc.Color, visible() { return this._colorGradient; } })
    public get colorLT(): cc.Color { return this._colorLT; }
    public set colorLT(v: cc.Color) {
        if (!CC_EDITOR && this._colorLT === v) { return; }
        this._colorLT = v;
        this._colorExtraDirty = true;
    }

    @property(cc.Color)
    private _colorRT: cc.Color = cc.Color.WHITE;
    @property({ tooltip: CC_DEV && "右上顶点", type: cc.Color, visible() { return this._colorGradient; } })
    public get colorRT(): cc.Color { return this._colorRT; }
    public set colorRT(v: cc.Color) {
        if (!CC_EDITOR && this._colorRT === v) { return; }
        this._colorRT = v;
        this._colorExtraDirty = true;
    }

    @property({ tooltip: CC_DEV && "材质参数", type: TmpUniform })
    public tmpUniform: TmpUniform = new TmpUniform();

    @property({ tooltip: CC_DEV && "字体所依赖的纹理", type: cc.Texture2D, readonly: true })
    public textures: cc.Texture2D[] = [];

    private _fontConfig: TmpFontConfig = null;
    /** 字体配置管理 */
    public get fontConfig(): TmpFontConfig { return this._fontConfig; }

    protected _assembler: TmpAssembler = null;
    private _worldVertsDirty: boolean = false;
    private _colorExtraDirty: boolean = false;

    private _richTextDeltaX: number = 0;
    /** 记录letterRight与nextTokenX的差值，供富文本排版使用 */
    public get richTextDeltaX(): number { return this._richTextDeltaX; }

    private editorInit(): void {
        if (CC_EDITOR) {
            // 加载图集
            if (!this._font || !this._font["_uuid"]) {
                this.textures = [];
                this.forceUpdateRenderData();
                return;
            }
            // cc.log(this._font["_uuid"]);
            Editor.assetdb.queryUrlByUuid(this._font["_uuid"], (error: any, url: string) => {
                // cc.log(url);
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
                    this._fontConfig = TmpFontConfig.getFontConfig(this._font, this.textures);

                    if (!this.enabledInHierarchy) { return; }
                    this.forceUpdateRenderData();
                    this._onBMFontTextureLoaded();
                });
            });
        }
    }

    protected resetInEditor(): void {
        if (CC_EDITOR) {
            TmpUtils.load<cc.Material>(TmpUtils.TMP_MAT).then((mat) => {
                if (mat) {
                    this.setMaterial(0, mat);
                }
            });
        }
    }

    protected onLoad(): void {
        this.editorInit();
        this.tmpUniform.init(this);
        if (!this._fontConfig && this.font && this.textures.length > 0) {
            this._fontConfig = TmpFontConfig.getFontConfig(this._font, this.textures);
        }
    }

    protected onEnable(): void {
        super.onEnable();
        this.node.on(cc.Node.EventType.SIZE_CHANGED, this._nodeSizeChanged, this);
        this.node.on(cc.Node.EventType.ANCHOR_CHANGED, this["setVertsDirty"], this);

        this.forceUpdateRenderData();
    }

    protected onDisable(): void {
        super.onDisable();
        this.node.off(cc.Node.EventType.SIZE_CHANGED, this._nodeSizeChanged, this);
        this.node.off(cc.Node.EventType.ANCHOR_CHANGED, this["setVertsDirty"], this);
    }

    protected lateUpdate(dt: number): void {
        if (this._worldVertsDirty) {
            this._worldVertsDirty = false;
            this._assembler.updateWorldVerts(this);
        }
        if (this._colorExtraDirty) {
            this._colorExtraDirty = false;
            this._assembler.updateColorExtra(this);
        }
    }

    private _nodeSizeChanged(): void {
        // Because the content size is automatically updated when overflow is NONE.
        // And this will conflict with the alignment of the CCWidget.
        if (CC_EDITOR || this.overflow !== TmpOverflow.NONE) {
            this["setVertsDirty"]();
        }
    }

    private _validateRender(): void {
        if (!this.string) {
            this["disableRender"]();
            return;
        }

        if (this.getMaterial(0)) {
            if (this.textures.length > 0) {
                return;
            }
        }
        this["disableRender"]();
    }

    protected _resetAssembler(): void {
        cc.RenderComponent.prototype["_resetAssembler"].call(this);
    }

    private _checkStringEmpty(): void {
        this["markForRender"](!!this.string);
    }

    private _on3DNodeChanged(): void {
        this._resetAssembler();
        this._applyFontTexture();
    }

    private _onBMFontTextureLoaded(): void {
        this["markForRender"](true);
        this._updateMaterial();
    }

    private _onBlendChanged(): void {
        if (!this.enabledInHierarchy) return;

        this.forceUpdateRenderData();
    }

    private _applyFontTexture(): void {
        this["markForValidate"]();
    }

    private _updateMaterial(): void {
        let material = this.getMaterial(0);
        if (!material) {
            return;
        }

        cc.BlendFunc.prototype["_updateMaterialBlendFunc"].call(this, material);

        // 更新材质参数
        this._updateTmpMatTexture(material);
        if (!this.tmpUniform || !this.tmpUniform.comp) {
            return;
        }
        this.updateTmpMatFace(material);
        this.updateTmpMatOutline(material);
        this.updateTmpMatUnderlay(material);
        this.updateTmpMatGlow(material);
    }

    public _updateTmpMatTexture(material: cc.Material): void {
        if (!material || this.textures.length <= 0) {
            return;
        }
        material.define("USE_TEXTURE_LEVEL_1", this.textures.length > 0);
        material.define("USE_TEXTURE_LEVEL_2", this.textures.length > 1);
        material.define("USE_TEXTURE_LEVEL_3", this.textures.length > 2);
        material.define("USE_TEXTURE_LEVEL_4", this.textures.length > 4);
        for (let i = 0; i < this.textures.length; i++) {
            material.setProperty(`texture${i}`, this.textures[i]);
        }
        material["_effect"]._dirty = true;
    }

    public updateTmpMatFace(material: cc.Material): void {
        if (!material) {
            return;
        }
        material.setProperty("faceColor", this.tmpUniform.faceColor);
        material.setProperty("faceDilate", this.tmpUniform.faceDilate);
        material.setProperty("faceSoftness", this.tmpUniform.faceSoftness);
        material["_effect"]._dirty = true;
    }

    public updateTmpMatOutline(material: cc.Material): void {
        if (!material) {
            return;
        }
        material.define("USE_OUTLINE", this.tmpUniform.enableOutline);
        if (this.tmpUniform.enableOutline) {
            material.setProperty("outlineColor", this.tmpUniform.outlineColor);
            material.setProperty("outlineThickness", this.tmpUniform.outlineThickness);
        }
        material["_effect"]._dirty = true;
    }

    public updateTmpMatUnderlay(material: cc.Material): void {
        if (!material) {
            return;
        }
        material.define("USE_UNDERLAY", this.tmpUniform.enableUnderlay);
        if (this.tmpUniform.enableUnderlay) {
            material.setProperty("underlayColor", this.tmpUniform.underlayColor);
            material.setProperty("underlayOffsetX", this.tmpUniform.underlayOffset.x);
            material.setProperty("underlayOffsetY", this.tmpUniform.underlayOffset.y);
            material.setProperty("underlayDilate", this.tmpUniform.underlayDilate);
            material.setProperty("underlaySoftness", this.tmpUniform.underlaySoftness);
        }
        material["_effect"]._dirty = true;
    }

    public updateTmpMatGlow(material: cc.Material): void {
        if (!material) {
            return;
        }
        material.define("USE_GLOW", this.tmpUniform.enableGlow);
        if (this.tmpUniform.enableGlow) {
            material.setProperty("glowColor", this.tmpUniform.glowColor);
            material.setProperty("glowOffset", this.tmpUniform.glowOffset);
            material.setProperty("glowInner", this.tmpUniform.glowInner);
            material.setProperty("glowOuter", this.tmpUniform.glowOuter);
            material.setProperty("glowPower", this.tmpUniform.glowPower);
        }
        material["_effect"]._dirty = true;
    }

    /**
     * 立即更新渲染数据
     */
    public forceUpdateRenderData(): void {
        this["setVertsDirty"]();
        this._resetAssembler();
        this._applyFontTexture();
        this._assembler && this._assembler.updateRenderData(this);
        this.node["_renderFlag"] |= cc["RenderFlow"].FLAG_COLOR;
    }

    /**
     * 设置字体，必须调用此接口去动态设置字体
     */
    public setFont(font: cc.JsonAsset, textures: cc.Texture2D[]): void {
        if (!font || textures.length < 0) {
            cc.error(`please check your font!`);
            return;
        }

        this._font = font;
        this.textures = textures;
        this._fontConfig = TmpFontConfig.getFontConfig(this._font, this.textures);
        if (!this.enabledInHierarchy) { return; }
        this.forceUpdateRenderData();
        this._onBMFontTextureLoaded();
    }

    //#region 顶点数据操作接口，必须保证组件启用且节点激活才可使用这些接口
    /**
     * 根据字符下标判断此字符是否可见
     */
    public isVisible(index: number): boolean {
        if (!this.enabledInHierarchy) { return false; }
        return this._assembler.isVisble(index);
    }

    /**
     * 根据字符下标设置字符是否可见
     */
    public setVisible(index: number, visible: boolean): void {
        if (!this.enabledInHierarchy) { return; }
        this._assembler.setVisible(this, index, visible);
    }

    /**
     * 根据字符下标获取颜色顶点数据，顺序为[左下, 右下, 左上, 右上]
     */
    public getColorExtraVertices(index: number): [cc.Color, cc.Color, cc.Color, cc.Color] | null {
        if (!this.enabledInHierarchy) { return null; }
        return this._assembler.getColorExtraVertices(index);
    }

    /**
     * 根据字符下标设置颜色顶点数据，会和节点颜色混合为最终的顶点颜色，顺序为[左下, 右下, 左上, 右上]
     */
    public setColorExtraVertices(index: number, data: [cc.Color, cc.Color, cc.Color, cc.Color]): void {
        if (!this.enabledInHierarchy) { return; }
        this._assembler.setColorExtraVertices(index, data);
    }

    /**
     * 根据字符下标获取坐标顶点数据，顺序为[左下, 右下, 左上, 右上]
     */
    public getPosVertices(index: number): [cc.Vec2, cc.Vec2, cc.Vec2, cc.Vec2] | null {
        if (!this.enabledInHierarchy) { return null; }
        return this._assembler.getPosVertices(index);
    }

    /**
     * 根据字符下标设置坐标顶点数据，顺序为[左下, 右下, 左上, 右上]
     */
    public setPosVertices(index: number, data: [cc.Vec2, cc.Vec2, cc.Vec2, cc.Vec2]): void {
        if (!this.enabledInHierarchy) { return; }
        this._assembler.setPosVertices(index, data);
        this._worldVertsDirty = true;
    }
    //#endregion
}

cc["Assembler"].register(TextMeshPro, {
    getConstructor(comp: TextMeshPro) {
        return TmpAssembler;
    }
});
