const fs = require("fs");

export default class Utils {
    public static writeHiero(hieroPath: string, config: any) {
        try {
            let textStr = "";
            if (config.textFrom === 0) {
                textStr = config.textStr;
            } else if (config.textFrom === 1) {
                if (config.textPath) {
                    textStr = fs.readFileSync(config.textPath, "utf-8");
                }
            }

            let data = `
font.name=${config.exportName}
font.size=${config.fontSize}
font.bold=false
font.italic=false
font.gamma=1.8
font.mono=false

font2.file=${config.fontPath}
font2.use=true

pad.top=${config.padding}
pad.right=${config.padding}
pad.bottom=${config.padding}
pad.left=${config.padding}
pad.advance.x=${-2 * config.padding}
pad.advance.y=${-2 * config.padding}

glyph.native.rendering=false
glyph.page.width=${config.width}
glyph.page.height=${config.height}
glyph.text=${textStr.replace(/[\r\n]/g, "")}

render_type=0

effect.class=com.badlogic.gdx.tools.hiero.unicodefont.effects.DistanceFieldEffect
effect.Color=ffffff
effect.Scale=${config.scale}
effect.Spread=${config.padding}
`;
            fs.writeFileSync(hieroPath, data);
        } catch (error) {
            console.error(`[textmeshpro-tool writeHiero] error: ${error}`);
        }
    }

    // 正则匹配时需要注意不同系统的换行符不一致
    public static parse(fontPath: string) {
        try {
            let data = fs.readFileSync(fontPath, "utf-8");
            let arr = data.split(/\r\n|\n|\r/);

            let size = Number(arr[0].match(/(?<=size=)([\S]+?)(?=[\s])/)[0]);
            let bold = Number(arr[0].match(/(?<=bold=)([\S]+?)(?=[\s])/)[0]);
            let italic = Number(arr[0].match(/(?<=italic=)([\S]+?)(?=[\s])/)[0]);
            let padding = arr[0].match(/(?<=padding=)([\S]+?)(?=[\s])/)[0];
            let spacing = "";
            let outline = 0;

            let lineHeight = Number(arr[1].match(/(?<=lineHeight=)([\S]+?)(?=[\s])/)[0]);
            let base = Number(arr[1].match(/(?<=base=)([\S]+?)(?=[\s])/)[0]);
            let scaleW = Number(arr[1].match(/(?<=scaleW=)([\S]+?)(?=[\s])/)[0]);
            let scaleH = Number(arr[1].match(/(?<=scaleH=)([\S]+?)(?=[\s])/)[0]);
            let pages = Number(arr[1].match(/(?<=pages=)([\S]+?)(?=[\s])/)[0]);
            let packed = 0;
            let alphaChnl = 0;
            let redChnl = 0;
            let greenChnl = 0;
            let blueChnl = 0;

            let pageData = [];
            for (let i = 2; i < 2 + pages; i++) {
                pageData.push({
                    id: Number(arr[i].match(/(?<=id=)([\S]+?)(?=[\s])/)[0]),
                    file: String(arr[i].match(/(?<=file=")([\S]+?)(?=")/)[0])
                });
            }

            let charData = [];
            for (let i = 2 + pages + 1; i < arr.length; i++) {
                if (!/char/.test(arr[i])) {
                    continue;
                }
                charData.push({
                    id: Number(arr[i].match(/(?<=id=)([\S]+?)(?=[\s])/)[0]),
                    x: Number(arr[i].match(/(?<=x=)([\S]+?)(?=[\s])/)[0]),
                    y: Number(arr[i].match(/(?<=y=)([\S]+?)(?=[\s])/)[0]),
                    width: Number(arr[i].match(/(?<=width=)([\S]+?)(?=[\s])/)[0]),
                    height: Number(arr[i].match(/(?<=height=)([\S]+?)(?=[\s])/)[0]),
                    xoffset: Number(arr[i].match(/(?<=xoffset=)([\S]+?)(?=[\s])/)[0]),
                    yoffset: Number(arr[i].match(/(?<=yoffset=)([\S]+?)(?=[\s])/)[0]),
                    xadvance: Number(arr[i].match(/(?<=xadvance=)([\S]+?)(?=[\s])/)[0]),
                    page: Number(arr[i].match(/(?<=page=)([\S]+?)(?=[\s])/)[0]),
                    chnl: Number(arr[i].match(/(?<=chnl=)([\S]+?)/)[0]),
                });
            }

            let out = {
                size: size,
                bold: bold,
                italic: italic,
                padding: padding,
                spacing: spacing,
                outline: outline,

                lineHeight: lineHeight,
                base: base,
                scaleW: scaleW,
                scaleH: scaleH,
                pages: pages,
                packed: packed,
                alphaChnl: alphaChnl,
                redChnl: redChnl,
                greenChnl: greenChnl,
                blueChnl: blueChnl,

                pageData: pageData,
                charData: charData
            };

            fs.writeFileSync(fontPath.replace(".fnt", ".json"), JSON.stringify(out));
        } catch (error) {
            console.error(`[textmeshpro-tool parse] error: ${error}`);
        }
    }
}
