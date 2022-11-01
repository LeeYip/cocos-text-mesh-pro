import { BaseRenderData, color, Color, Enum, error, gfx, HorizontalTextAlignment, JsonAsset, Material, RenderData, renderer, SpriteFrame, StencilManager, Texture2D, UIRenderer, Vec2, Vec3, VerticalTextAlignment, _decorator } from "cc";
import { EDITOR, JSB } from "cc/env";
import TmpAssembler, { TmpLetterInfo } from "./utils/TmpAssembler";
import TmpFontConfig from "./utils/TmpFontConfig";
import TmpUtils from "./utils/TmpUtils";

const { ccclass, property, executeInEditMode } = _decorator;

const vfmt = [
    new gfx.Attribute(gfx.AttributeName.ATTR_POSITION, gfx.Format.RGB32F),
    new gfx.Attribute(gfx.AttributeName.ATTR_TEX_COORD, gfx.Format.RG32F),
    new gfx.Attribute(gfx.AttributeName.ATTR_COLOR, gfx.Format.RGBA32F),
    new gfx.Attribute(gfx.AttributeName.ATTR_COLOR2, gfx.Format.RGBA32F),
    new gfx.Attribute("a_texture_idx", gfx.Format.R32F)
];

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
    @property(Color)
    private _faceColor: Color = Color.WHITE.clone();
    @property({ tooltip: "文本主体颜色", type: Color })
    public get faceColor(): Color { return this._faceColor; }
    public set faceColor(v: Color) {
        if (!EDITOR && this._faceColor === v) { return; }
        this._faceColor = v;
        if (!this._comp) { return; }
        this._comp.updateTmpMatFace(this._comp.getMaterialInstance(0));
    }

    @property
    private _faceDilate: number = 0.5;
    @property({ tooltip: "文本主体厚度", range: [0, 1, 0.01] })
    public get faceDilate(): number { return this._faceDilate; }
    public set faceDilate(v: number) {
        if (!EDITOR && this._faceDilate === v) { return; }
        this._faceDilate = v;
        if (!this._comp) { return; }
        this._comp.updateTmpMatFace(this._comp.getMaterialInstance(0));
    }

    @property
    private _faceSoftness: number = 0.01;
    @property({ tooltip: "文本主体柔和度", range: [0, 1, 0.01] })
    public get faceSoftness(): number { return this._faceSoftness; }
    public set faceSoftness(v: number) {
        if (!EDITOR && this._faceSoftness === v) { return; }
        this._faceSoftness = v;
        if (!this._comp) { return; }
        this._comp.updateTmpMatFace(this._comp.getMaterialInstance(0));
    }

    @property
    private _enableOutline: boolean = false;
    @property({ tooltip: "是否启用描边效果" })
    public get enableOutline(): boolean { return this._enableOutline; }
    public set enableOutline(v: boolean) {
        if (!EDITOR && this._enableOutline === v) { return; }
        this._enableOutline = v;
        if (!this._comp) { return; }
        this._comp.updateTmpMatOutline(this._comp.getMaterialInstance(0));
    }

    @property(Color)
    private _outlineColor: Color = color(255, 0, 0, 255);
    @property({
        tooltip: "描边颜色",
        type: Color,
        visible() { return this._enableOutline; }
    })
    public get outlineColor(): Color { return this._outlineColor; }
    public set outlineColor(v: Color) {
        if (!EDITOR && this._outlineColor === v) { return; }
        this._outlineColor = v;
        if (!this._comp) { return; }
        this._comp.updateTmpMatOutline(this._comp.getMaterialInstance(0));
    }

    @property
    private _outlineThickness: number = 0.1;
    @property({
        tooltip: "描边厚度",
        range: [0, 1, 0.01],
        visible() { return this._enableOutline; }
    })
    public get outlineThickness(): number { return this._outlineThickness; }
    public set outlineThickness(v: number) {
        if (!EDITOR && this._outlineThickness === v) { return; }
        this._outlineThickness = v;
        if (!this._comp) { return; }
        this._comp.updateTmpMatOutline(this._comp.getMaterialInstance(0));
    }

    @property
    private _enableUnderlay: boolean = false;
    @property({ tooltip: "是否启用阴影效果" })
    public get enableUnderlay(): boolean { return this._enableUnderlay; }
    public set enableUnderlay(v: boolean) {
        if (!EDITOR && this._enableUnderlay === v) { return; }
        this._enableUnderlay = v;
        if (!this._comp) { return; }
        this._comp.updateTmpMatUnderlay(this._comp.getMaterialInstance(0));
    }

    @property(Color)
    private _underlayColor: Color = color(0, 0, 0, 255);
    @property({
        tooltip: "阴影颜色",
        type: Color,
        visible() { return this._enableUnderlay; }
    })
    public get underlayColor(): Color { return this._underlayColor; }
    public set underlayColor(v: Color) {
        if (!EDITOR && this._underlayColor === v) { return; }
        this._underlayColor = v;
        if (!this._comp) { return; }
        this._comp.updateTmpMatUnderlay(this._comp.getMaterialInstance(0));
    }

    @property(Vec2)
    private _underlayOffset: Vec2 = new Vec2(0, 0);
    @property({
        tooltip: "阴影偏移",
        type: Vec2,
        range: [-1, 1],
        visible() { return this._enableUnderlay; }
    })
    public get underlayOffset(): Vec2 { return this._underlayOffset; }
    public set underlayOffset(v: Vec2) {
        if (!EDITOR && this._underlayOffset === v) { return; }
        this._underlayOffset = v;
        if (!this._comp) { return; }
        this._comp.updateTmpMatUnderlay(this._comp.getMaterialInstance(0));
    }

    @property
    private _underlayDilate: number = 0.5;
    @property({
        tooltip: "阴影厚度",
        range: [0, 1, 0.01],
        visible() { return this._enableUnderlay; }
    })
    public get underlayDilate(): number { return this._underlayDilate; }
    public set underlayDilate(v: number) {
        if (!EDITOR && this._underlayDilate === v) { return; }
        this._underlayDilate = v;
        if (!this._comp) { return; }
        this._comp.updateTmpMatUnderlay(this._comp.getMaterialInstance(0));
    }

    @property
    private _underlaySoftness: number = 0.1;
    @property({
        tooltip: "阴影柔和度",
        range: [0, 1, 0.01],
        visible() { return this._enableUnderlay; }
    })
    public get underlaySoftness(): number { return this._underlaySoftness; }
    public set underlaySoftness(v: number) {
        if (!EDITOR && this._underlaySoftness === v) { return; }
        this._underlaySoftness = v;
        if (!this._comp) { return; }
        this._comp.updateTmpMatUnderlay(this._comp.getMaterialInstance(0));
    }

    @property
    private _enableGlow: boolean = false;
    @property({ tooltip: "是否启用辉光效果" })
    public get enableGlow(): boolean { return this._enableGlow; }
    public set enableGlow(v: boolean) {
        if (!EDITOR && this._enableGlow === v) { return; }
        this._enableGlow = v;
        if (!this._comp) { return; }
        this._comp.updateTmpMatGlow(this._comp.getMaterialInstance(0));
    }

    @property(Color)
    private _glowColor: Color = color(0, 255, 0, 255);
    @property({
        tooltip: "辉光颜色",
        type: Color,
        visible() { return this._enableGlow; }
    })
    public get glowColor(): Color { return this._glowColor; }
    public set glowColor(v: Color) {
        if (!EDITOR && this._glowColor === v) { return; }
        this._glowColor = v;
        if (!this._comp) { return; }
        this._comp.updateTmpMatGlow(this._comp.getMaterialInstance(0));
    }

    @property
    private _glowOffset: number = 0.5;
    @property({
        tooltip: "辉光偏移",
        range: [0, 1, 0.01],
        visible() { return this._enableGlow; }
    })
    public get glowOffset(): number { return this._glowOffset; }
    public set glowOffset(v: number) {
        if (!EDITOR && this._glowOffset === v) { return; }
        this._glowOffset = v;
        if (!this._comp) { return; }
        this._comp.updateTmpMatGlow(this._comp.getMaterialInstance(0));
    }

    @property
    private _glowInner: number = 0.01;
    @property({
        tooltip: "辉光向内的厚度",
        range: [0, 1, 0.01],
        visible() { return this._enableGlow; }
    })
    public get glowInner(): number { return this._glowInner; }
    public set glowInner(v: number) {
        if (!EDITOR && this._glowInner === v) { return; }
        this._glowInner = v;
        if (!this._comp) { return; }
        this._comp.updateTmpMatGlow(this._comp.getMaterialInstance(0));
    }

    @property
    private _glowOuter: number = 0.01;
    @property({
        tooltip: "辉光向外的厚度",
        range: [0, 1, 0.01],
        visible() { return this._enableGlow; }
    })
    public get glowOuter(): number { return this._glowOuter; }
    public set glowOuter(v: number) {
        if (!EDITOR && this._glowOuter === v) { return; }
        this._glowOuter = v;
        if (!this._comp) { return; }
        this._comp.updateTmpMatGlow(this._comp.getMaterialInstance(0));
    }

    @property
    private _glowPower: number = 1;
    @property({
        tooltip: "辉光强度",
        range: [0, 1, 0.01],
        visible() { return this._enableGlow; }
    })
    public get glowPower(): number { return this._glowPower; }
    public set glowPower(v: number) {
        if (!EDITOR && this._glowPower === v) { return; }
        this._glowPower = v;
        if (!this._comp) { return; }
        this._comp.updateTmpMatGlow(this._comp.getMaterialInstance(0));
    }

    private _comp: TextMeshPro = null;
    public get comp(): TextMeshPro { return this._comp; }

    public init(text: TextMeshPro) {
        this._comp = text;

        let material = this._comp.getMaterialInstance(0);
        this._comp.updateTmpMatFace(material);
        this._comp.updateTmpMatOutline(material);
        this._comp.updateTmpMatUnderlay(material);
        this._comp.updateTmpMatGlow(material);
    }
}

@ccclass("TextMeshPro")
@executeInEditMode
export default class TextMeshPro extends UIRenderer {

    @property
    private _string: string = "";
    @property({ multiline: true })
    public get string(): string { return this._string; }
    public set string(v: string) {
        if (!EDITOR && this._string === v) { return; }
        this._string = v;
        this.markForUpdateRenderData();
    }

    @property(JsonAsset)
    private _font: JsonAsset = null;
    @property({ tooltip: "字体资源\n依赖的纹理请勿打入图集\n在编辑器内拖拽此文件时，纹理必须和此文件处于同一目录下", type: JsonAsset })
    private get font(): JsonAsset { return this._font; }
    private set font(v: JsonAsset) {
        if (!EDITOR && this._font === v) { return; }
        this._font = v;
        if (EDITOR) {
            this.editorInit();
        } else {
            if (this._renderData) {
                this.destroyRenderData();
                this._renderData = null;
            }
            this.updateRenderData(true);
        }
    }

    @property({ type: HorizontalTextAlignment })
    private _horizontalAlign: HorizontalTextAlignment = HorizontalTextAlignment.LEFT;
    @property({ type: HorizontalTextAlignment })
    public get horizontalAlign(): HorizontalTextAlignment { return this._horizontalAlign; }
    public set horizontalAlign(v: HorizontalTextAlignment) {
        if (!EDITOR && this._horizontalAlign === v) { return; }
        this._horizontalAlign = v;
        this.markForUpdateRenderData();
    }

    @property({ type: VerticalTextAlignment })
    private _verticalAlign: VerticalTextAlignment = VerticalTextAlignment.TOP;
    @property({ type: VerticalTextAlignment })
    public get verticalAlign(): VerticalTextAlignment { return this._verticalAlign; }
    public set verticalAlign(v: VerticalTextAlignment) {
        if (!EDITOR && this._verticalAlign === v) { return; }
        this._verticalAlign = v;
        this.markForUpdateRenderData();
    }

    @property
    private _actualFontSize: number = 0;
    @property({ visible() { return this._overflow === TmpOverflow.SHRINK; } })
    public get actualFontSize(): number { return this._actualFontSize; }

    @property
    public get bmfontOriginalSize(): number { return this.font ? this.font.json["size"] : -1; }

    @property
    private _fontSize: number = 32;
    @property({ range: [0, 1024] })
    public get fontSize(): number { return this._fontSize; }
    public set fontSize(v: number) {
        if (!EDITOR && this._fontSize === v) { return; }
        this._fontSize = v;
        this.markForUpdateRenderData();
    }

    @property
    private _lineHeight: number = 32;
    @property
    public get lineHeight(): number { return this._lineHeight; }
    public set lineHeight(v: number) {
        if (!EDITOR && this._lineHeight === v) { return; }
        this._lineHeight = v;
        this.markForUpdateRenderData();
    }

    @property
    private _spacingX: number = 0;
    @property
    public get spacingX(): number { return this._spacingX; }
    public set spacingX(v: number) {
        if (!EDITOR && this._spacingX === v) { return; }
        this._spacingX = v;
        this.markForUpdateRenderData();
    }

    @property({ type: Enum(TmpOverflow) })
    private _overflow: TmpOverflow = TmpOverflow.NONE;
    @property({ tooltip: "文本的排版方式", type: Enum(TmpOverflow) })
    public get overflow(): TmpOverflow { return this._overflow; }
    public set overflow(v: TmpOverflow) {
        if (!EDITOR && this._overflow === v) { return; }
        this._overflow = v;
        this.markForUpdateRenderData();
    }

    @property
    private _enableWrapText: boolean = true;
    @property({
        tooltip: "是否启用自动换行",
        visible() {
            return this._overflow === TmpOverflow.CLAMP || this._overflow === TmpOverflow.ELLIPSIS;
        }
    })
    public get enableWrapText(): boolean { return this._enableWrapText; }
    public set enableWrapText(v: boolean) {
        if (!EDITOR && this._enableWrapText === v) { return; }
        this._enableWrapText = v;
        this.markForUpdateRenderData();
    }

    @property
    private _enableItalic: boolean = false;
    @property({ tooltip: "是否启用斜体" })
    public get enableItalic(): boolean { return this._enableItalic; }
    public set enableItalic(v: boolean) {
        if (!EDITOR && this._enableItalic === v) { return; }
        this._enableItalic = v;
        this.markForUpdateRenderData();
    }

    @property
    private _enableUnderline: boolean = false;
    @property({ tooltip: "是否启用下划线" })
    public get enableUnderline(): boolean { return this._enableUnderline; }
    public set enableUnderline(v: boolean) {
        if (!EDITOR && this._enableUnderline === v) { return; }
        this._enableUnderline = v;
        this.markForUpdateRenderData();
    }

    @property
    private _underlineOffset: number = 0;
    @property({
        tooltip: "下划线高度偏移",
        visible() { return this._enableUnderline; }
    })
    public get underlineOffset(): number { return this._underlineOffset; }
    public set underlineOffset(v: number) {
        if (!EDITOR && this._underlineOffset === v) { return; }
        this._underlineOffset = v;
        this.markForUpdateRenderData();
    }

    @property
    private _enableStrikethrough: boolean = false;
    @property({ tooltip: "是否启用删除线" })
    public get enableStrikethrough(): boolean { return this._enableStrikethrough; }
    public set enableStrikethrough(v: boolean) {
        if (!EDITOR && this._enableStrikethrough === v) { return; }
        this._enableStrikethrough = v;
        this.markForUpdateRenderData();
    }

    @property
    private _strikethroughOffset: number = 0;
    @property({
        tooltip: "删除线高度偏移",
        visible() { return this._enableStrikethrough; }
    })
    public get strikethroughOffset(): number { return this._strikethroughOffset; }
    public set strikethroughOffset(v: number) {
        if (!EDITOR && this._strikethroughOffset === v) { return; }
        this._strikethroughOffset = v;
        this.markForUpdateRenderData();
    }

    @property
    private _colorGradient: boolean = false;
    @property({ tooltip: "是否启用颜色渐变，会和顶点颜色混合为最终的顶点颜色" })
    public get colorGradient(): boolean { return this._colorGradient; }
    public set colorGradient(v: boolean) {
        if (!EDITOR && this._colorGradient === v) { return; }
        this._colorGradient = v;
        this._colorExtraDirty = true;
    }

    @property(Color)
    private _colorLB: Color = Color.WHITE.clone();
    @property({
        tooltip: "左下顶点", type: Color,
        visible() { return this._colorGradient; }
    })
    public get colorLB(): Color { return this._colorLB; }
    public set colorLB(v: Color) {
        if (!EDITOR && this._colorLB === v) { return; }
        this._colorLB = v;
        this._colorExtraDirty = true;
    }

    @property(Color)
    private _colorRB: Color = Color.WHITE.clone();
    @property({
        tooltip: "右下顶点", type: Color,
        visible() { return this._colorGradient; }
    })
    public get colorRB(): Color { return this._colorRB; }
    public set colorRB(v: Color) {
        if (!EDITOR && this._colorRB === v) { return; }
        this._colorRB = v;
        this._colorExtraDirty = true;
    }

    @property(Color)
    private _colorLT: Color = Color.WHITE.clone();
    @property({
        tooltip: "左上顶点", type: Color,
        visible() { return this._colorGradient; }
    })
    public get colorLT(): Color { return this._colorLT; }
    public set colorLT(v: Color) {
        if (!EDITOR && this._colorLT === v) { return; }
        this._colorLT = v;
        this._colorExtraDirty = true;
    }

    @property(Color)
    private _colorRT: Color = Color.WHITE.clone();
    @property({
        tooltip: "右上顶点", type: Color,
        visible() { return this._colorGradient; }
    })
    public get colorRT(): Color { return this._colorRT; }
    public set colorRT(v: Color) {
        if (!EDITOR && this._colorRT === v) { return; }
        this._colorRT = v;
        this._colorExtraDirty = true;
    }

    @property({ tooltip: "材质参数", type: TmpUniform })
    public tmpUniform: TmpUniform = new TmpUniform();

    @property({ tooltip: "字体所依赖的纹理", type: Texture2D, readonly: true })
    public textures: Texture2D[] = [];

    private _fontConfig: TmpFontConfig = null;
    /** 字体配置管理 */
    public get fontConfig(): TmpFontConfig { return this._fontConfig; }

    /** 每个字符的渲染数据，与string并不一定一一对应 */
    private _lettersInfo: TmpLetterInfo[] = [];
    public get lettersInfo(): TmpLetterInfo[] { return this._lettersInfo; }

    protected _assembler: typeof TmpAssembler = null;
    private _colorExtraDirty: boolean = false;

    private _richTextDeltaX: number = 0;
    /** 记录letterRight与nextTokenX的差值，供富文本排版使用 */
    public get richTextDeltaX(): number { return this._richTextDeltaX; }

    private editorInit(): void {
        if (EDITOR) {
            // 加载图集
            if (!this._font || !this._font["_uuid"]) {
                this.textures = [];
                this.updateRenderData(true);
                return;
            }
            // log(this._font);
            //@ts-ignore
            Editor.Message.request("asset-db", "query-url", this._font["_uuid"]).then((url: string) => {
                // log(url);
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
                    this._fontConfig = new TmpFontConfig(this._font.json, this.textures);

                    if (this._renderData) {
                        this.destroyRenderData();
                        this._renderData = null;
                    }
                    this.updateRenderData(true);
                });
            });
        }
    }

    public resetInEditor(): void {
        if (EDITOR) {
            TmpUtils.load<Material>(TmpUtils.TMP_MAT).then((mat) => {
                if (mat) {
                    this.customMaterial = mat;
                }
            });
        }
    }

    public onLoad(): void {
        super.onLoad();
        if (!this.customMaterial) {
            this.resetInEditor();
        }
        this.tmpUniform.init(this);
        if (!this._fontConfig && this.font && this.textures.length > 0) {
            this._fontConfig = new TmpFontConfig(this._font.json, this.textures);
        }
    }

    public onEnable(): void {
        super.onEnable();
        this._applyFontTexture();
    }

    public lateUpdate(dt: number): void {
        if (this._colorExtraDirty) {
            this._colorExtraDirty = false;
            this._assembler.updateColorExtra(this);
        }
    }

    /**
     * @en Request new render data object.
     * @zh 请求新的渲染数据对象。
     * @return The new render data
     */
    public requestRenderData(drawInfoType = 0) {
        const data = RenderData.add(vfmt);
        data.initRenderDrawInfo(this, drawInfoType);
        this._renderData = data;
        return data;
    }

    public updateRenderData(force: boolean = false) {
        if (force) {
            this._flushAssembler();
            // Hack: Fixed the bug that richText wants to get the label length by _measureText,
            // _assembler.updateRenderData will update the content size immediately.
            if (this.renderData) { this.renderData.vertDirty = true; }
            this._applyFontTexture();
        }
        if (this._assembler) {
            this._assembler.updateRenderData(this);
        }
    }

    protected _render(render: any) {
        // render.commitComp(this, this.renderData, this.textures[0], this._assembler!, null);
        this.commitComp(render, this, this.renderData, this.textures[0], this._assembler!, null);
    }

    /**
     * 合批hack
     */
    private commitComp(render: any, comp: TextMeshPro, renderData: BaseRenderData | null, frame: Texture2D | SpriteFrame | null, assembler, transform: Node | null) {
        let dataHash = 0;
        let mat: Material;
        let bufferID = -1;
        if (renderData && renderData.chunk) {
            if (!renderData.isValid()) return;
            dataHash = renderData.dataHash;
            mat = renderData.material;
            bufferID = renderData.chunk.bufferId;
        }
        comp.stencilStage = StencilManager.sharedManager!.stage;
        const depthStencilStateStage = comp.stencilStage;

        // 判断材质宏与参数是否一致
        let isMatEqual = true;
        let tmpMatDefine = 0;
        if (comp.tmpUniform.enableOutline) { tmpMatDefine |= 1 << 0; }
        if (comp.tmpUniform.enableUnderlay) { tmpMatDefine |= 1 << 1; }
        if (comp.tmpUniform.enableGlow) { tmpMatDefine |= 1 << 2; }
        if (render._currMaterial !== mat) {
            if (((mat instanceof renderer.MaterialInstance) && render._currMaterial.parent !== mat.parent) ||
                (!(mat instanceof renderer.MaterialInstance) && render._currMaterial.parent !== mat) ||
                render._currTmpMatDefine !== tmpMatDefine) {
                isMatEqual = false
            }
            if (isMatEqual) {
                let arr = ["texture0", "texture1", "texture2", "texture3", "texture4", "texture5", "texture6", "texture7",
                    "faceColor", "faceDilate", "faceSoftness",
                    "outlineColor", "outlineThickness",
                    "underlayColor", "underlayOffsetX", "underlayOffsetY", "underlayDilate", "underlaySoftness",
                    "glowColor", "glowOffset", "glowInner", "glowOuter", "glowPower"
                ];
                let renderMat = comp.getRenderMaterial(0);
                for (let i = 0; i < arr.length; i++) {
                    const propName = arr[i];
                    let v1 = renderMat.getProperty(propName);
                    let v2 = render._currMaterial.getProperty(propName);
                    if (v1 instanceof Color && v2 instanceof Color && v1.equals(v2)) {
                        continue;
                    }
                    if (v1 !== v2) {
                        isMatEqual = false;
                        break;
                    }
                }
            }
        }

        if (render._currHash !== dataHash || dataHash === 0 || !isMatEqual//render._currMaterial !== mat
            || render._currDepthStencilStateStage !== depthStencilStateStage) {
            // Merge all previous data to a render batch, and update buffer for next render data
            render.autoMergeBatches(render._currComponent!);
            if (renderData && !renderData._isMeshBuffer) {
                render.updateBuffer(renderData.vertexFormat, bufferID);
            }

            // 标记宏定义开关
            render._currTmpMatDefine = tmpMatDefine;

            render._currRenderData = renderData;
            render._currHash = renderData ? renderData.dataHash : 0;
            render._currComponent = comp;
            render._currTransform = transform;
            render._currMaterial = comp.getRenderMaterial(0)!;
            render._currDepthStencilStateStage = depthStencilStateStage;
            render._currLayer = comp.node.layer;
            if (frame) {
                render._currTexture = frame.getGFXTexture();
                render._currSampler = frame.getGFXSampler();
                render._currTextureHash = frame.getHash();
                render._currSamplerHash = render._currSampler.hash;
            } else {
                render._currTexture = null;
                render._currSampler = null;
                render._currTextureHash = 0;
                render._currSamplerHash = 0;
            }
        }

        assembler.fillBuffers(comp, render);
    }

    // Cannot use the base class methods directly because BMFont and CHAR cannot be updated in assambler with just color.
    protected _updateColor() {
        super._updateColor();
        this.markForUpdateRenderData();
    }

    public setEntityColor(color: Color) {
        if (JSB) {
            this._renderEntity.color = color;
        }
    }

    protected _canRender() {
        if (!super._canRender() || !this._string) {
            return false;
        }

        if (!this.fontConfig || this.textures.length <= 0) {
            return false;
        }

        return true;
    }

    protected _flushAssembler() {
        const assembler = TmpAssembler;

        if (this._assembler !== assembler) {
            this.destroyRenderData();
            this._assembler = assembler;
        }

        if (!this._renderData) {
            if (this._assembler && this._assembler.createData) {
                this._renderData = this._assembler.createData(this);
                this._renderData!.material = this.material;
                this._updateColor();
            }
        }
    }

    private _applyFontTexture(): void {
        this.markForUpdateRenderData();
        if (this.textures.length > 0) {
            if (this.renderData) {
                // this.renderData.textureDirty = true;
            }
            this.changeMaterialForDefine();
            if (this._assembler) {
                this._assembler.updateRenderData(this);
            }
        }
    }

    protected changeMaterialForDefine() {
        if (this.textures.length <= 0) {
            return;
        }

        this.updateMaterial();
    }

    protected updateMaterial(): void {
        if (!this._customMaterial) {
            return;
        }
        this.setMaterial(this._customMaterial, 0);

        // 更新材质参数
        let material = this.getMaterialInstance(0);
        this._updateTmpMatTexture(material);
        if (!this.tmpUniform || !this.tmpUniform.comp) {
            return;
        }
        this.updateTmpMatFace(material);
        this.updateTmpMatOutline(material);
        this.updateTmpMatUnderlay(material);
        this.updateTmpMatGlow(material);
    }

    private _updateTmpMatTexture(material: renderer.MaterialInstance): void {
        if (!material || this.textures.length <= 0) {
            return;
        }

        material.recompileShaders({
            "USE_TEXTURE_LEVEL_1": this.textures.length > 0,
            "USE_TEXTURE_LEVEL_2": this.textures.length > 1,
            "USE_TEXTURE_LEVEL_3": this.textures.length > 2,
            "USE_TEXTURE_LEVEL_4": this.textures.length > 4
        });

        for (let i = 0; i < this.textures.length; i++) {
            material.setProperty(`texture${i}`, this.textures[i]);
        }
    }

    public updateTmpMatFace(material: renderer.MaterialInstance): void {
        if (!material) {
            return;
        }
        material.setProperty("faceColor", this.tmpUniform.faceColor);
        material.setProperty("faceDilate", this.tmpUniform.faceDilate);
        material.setProperty("faceSoftness", this.tmpUniform.faceSoftness);
    }

    public updateTmpMatOutline(material: renderer.MaterialInstance): void {
        if (!material) {
            return;
        }

        material.recompileShaders({ "USE_OUTLINE": this.tmpUniform.enableOutline });

        if (this.tmpUniform.enableOutline) {
            material.setProperty("outlineColor", this.tmpUniform.outlineColor);
            material.setProperty("outlineThickness", this.tmpUniform.outlineThickness);
        }
    }

    public updateTmpMatUnderlay(material: renderer.MaterialInstance): void {
        if (!material) {
            return;
        }

        material.recompileShaders({ "USE_UNDERLAY": this.tmpUniform.enableUnderlay });

        if (this.tmpUniform.enableUnderlay) {
            material.setProperty("underlayColor", this.tmpUniform.underlayColor);
            material.setProperty("underlayOffsetX", this.tmpUniform.underlayOffset.x);
            material.setProperty("underlayOffsetY", this.tmpUniform.underlayOffset.y);
            material.setProperty("underlayDilate", this.tmpUniform.underlayDilate);
            material.setProperty("underlaySoftness", this.tmpUniform.underlaySoftness);
        }
    }

    public updateTmpMatGlow(material: renderer.MaterialInstance): void {
        if (!material) {
            return;
        }

        material.recompileShaders({ "USE_GLOW": this.tmpUniform.enableGlow });

        if (this.tmpUniform.enableGlow) {
            material.setProperty("glowColor", this.tmpUniform.glowColor);
            material.setProperty("glowOffset", this.tmpUniform.glowOffset);
            material.setProperty("glowInner", this.tmpUniform.glowInner);
            material.setProperty("glowOuter", this.tmpUniform.glowOuter);
            material.setProperty("glowPower", this.tmpUniform.glowPower);
        }
    }

    /**
     * 立即更新渲染数据
     */
    public forceUpdateRenderData(): void {
        this.updateRenderData(true);
    }

    /**
     * 设置字体，必须调用此接口去动态设置字体
     */
    public setFont(font: JsonAsset, textures: Texture2D[]): void {
        if (!font || textures.length < 0) {
            error(`params error!`);
            return;
        }

        this._font = font;
        this.textures = textures;
        this._fontConfig = new TmpFontConfig(this._font.json, this.textures);
        if (!this.enabledInHierarchy) { return; }
        this.updateRenderData(true);
    }

    //#region 顶点数据操作接口，必须保证组件启用且节点激活才可使用这些接口
    /**
     * 根据字符下标判断此字符是否可见
     */
    public isVisible(index: number): boolean {
        if (!this.enabledInHierarchy) { return false; }
        return this._assembler.isVisble(this, index);
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
    public getColorExtraVertices(index: number): [Color, Color, Color, Color] | null {
        if (!this.enabledInHierarchy) { return null; }
        return this._assembler.getColorExtraVertices(this, index);
    }

    /**
     * 根据字符下标设置颜色顶点数据，会和节点颜色混合为最终的顶点颜色，顺序为[左下, 右下, 左上, 右上]
     */
    public setColorExtraVertices(index: number, data: [Color, Color, Color, Color]): void {
        if (!this.enabledInHierarchy) { return; }
        this._assembler.setColorExtraVertices(this, index, data);
    }

    /**
     * 根据字符下标获取坐标顶点数据，顺序为[左下, 右下, 左上, 右上]
     */
    public getPosVertices(index: number): [Vec3, Vec3, Vec3, Vec3] | null {
        if (!this.enabledInHierarchy) { return null; }
        return this._assembler.getPosVertices(this, index);
    }

    /**
     * 根据字符下标设置坐标顶点数据，顺序为[左下, 右下, 左上, 右上]
     */
    public setPosVertices(index: number, data: [Vec3, Vec3, Vec3, Vec3]): void {
        if (!this.enabledInHierarchy) { return; }
        this._assembler.setPosVertices(this, index, data);
    }
    //#endregion
}
