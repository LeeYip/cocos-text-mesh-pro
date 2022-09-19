// @ts-ignore
import packageJSON from '../package.json';
import Utils from './utils';

const { dialog } = require("electron");
const os = require("os");
const fs = require("fs");
const exec = require("child_process").exec;

const EXAMPLE_PATH = "/extensions/textmeshpro-tool/textMeshPro";
const CONFIG_PATH = "/extensions/textmeshpro-tool/dist/config.json";
const TEMP_PATH = "/extensions/textmeshpro-tool/dist/temp";
const TEMP_HIERO_PATH = "/extensions/textmeshpro-tool/dist/temp/hieroConfig.hiero";

let config: { [key: string]: number | string } = {
    hieroPath: "",
    fontPath: "",

    exportName: "",
    exportDir: "",

    /** 导出文本来源 0:输入框 1:txt文件 */
    textFrom: 0,
    textStr: "",
    textPath: "",

    fontSize: 32,
    padding: 5,
    scale: 10,
    width: 1024,
    height: 1024
};

function isFileExist(path: string) {
    return new Promise((resolve, reject) => {
        fs.access(path, fs.constants.F_OK, (err: any) => {
            resolve(!err);
        });
    });
}

async function readConfig() {
    try {
        let exist = await isFileExist(Editor.Project.path + CONFIG_PATH);
        if (!exist) {
            return;
        }
        let data = fs.readFileSync(Editor.Project.path + CONFIG_PATH, "utf-8");
        if (data) {
            config = JSON.parse(data);
        }
    } catch (err) {
        console.error(`[textmeshpro-tool readConfig] error`);
    }
}

function writeConfig() {
    try {
        let data = JSON.stringify(config);
        fs.writeFileSync(Editor.Project.path + CONFIG_PATH, data);
        console.log(`write config: ${Editor.Project.path + CONFIG_PATH}`);
    } catch (err) {
        console.error(`[textmeshpro-tool writeConfig] error`);
        console.error(err);
    }
}

function exportFont() {
    try {
        let check = fs.existsSync(`${Editor.Project.path}${TEMP_PATH}`);
        if (!check) {
            fs.mkdirSync(`${Editor.Project.path}${TEMP_PATH}`);
        }
        Utils.writeHiero(`${Editor.Project.path}${TEMP_HIERO_PATH}`, config);
        let cmdStr = `java -jar ${config.hieroPath} -i ${Editor.Project.path}${TEMP_HIERO_PATH} -o ${config.exportDir}/${config.exportName}.fnt -b`;

        console.log("[textmeshpro-tool] 正在输出字体文件，请耐心等待Hiero窗口自行关闭...");
        let time = Date.now();
        exec(cmdStr, (err: any, stdout: any, stderr: any) => {
            if (err) {
                console.error(`[textmeshpro-tool exportFont] exec error: ${err}`);
                return;
            }
            Utils.parse(`${config.exportDir}/${config.exportName}.fnt`);
            setTimeout(() => {
                fs.unlinkSync(`${config.exportDir}/${config.exportName}.fnt`);
                Editor.Message.request("asset-db", "refresh-asset", "db://assets/");
            }, 500);
            console.log(`[textmeshpro-tool] 字体文件输出完毕，耗时：${(Date.now() - time) / 1000}s`);
        });
    } catch (err) {
        console.error(`[textmeshpro-tool exportFont] error`);
        console.error(err);
    }
}

/**
 * @en 
 * @zh 为扩展的主进程的注册方法
 */
export const methods: { [key: string]: (...any: any) => any } = {

    importExample() {
        try {
            let check = fs.existsSync(`${Editor.Project.path}/assets/textMeshPro`);
            if (check) {
                dialog.showMessageBox({
                    type: "warning",
                    title: "warning",
                    message: "警告",
                    detail: "assets目录下已存在textMeshPro文件夹，为防止误覆盖，请手动导入",
                    buttons: ["确定"],
                }).then(res => console.log(res));
                return;
            }

            let cmdStr = "";
            if (os.type() == "Windows_NT") {
                cmdStr = `xcopy ${Editor.Project.path}${EXAMPLE_PATH.replace(/\//g, "\\")} ${Editor.Project.path}\\assets\\textMeshPro\\ /e`;
            } else {
                cmdStr = `cp -r ${Editor.Project.path}${EXAMPLE_PATH} ${Editor.Project.path}/assets/textMeshPro/`;
            }
            console.log(cmdStr);
            exec(cmdStr, (error: any, stdout: any, stderr: any) => {
                if (error) {
                    console.error(`[textmeshpro-tool importExample] exec error: ${error}`);
                    return;
                }
                setTimeout(() => {
                    Editor.Message.request("asset-db", "refresh-asset", "db://assets/textMeshPro/");
                }, 500);
            });
        } catch (error) {
            console.error(`[textmeshpro-tool importExample] 文件导入失败，请尝试手动导入 error: ${error}`);
            console.error(error);
        }
    },

    openPanel() {
        Editor.Panel.open(packageJSON.name);
    },

    onPanelInit() {
        Editor.Message.send(packageJSON.name, "refresh-config", config);
    },

    onChangeConfig(key: string, value: string | number) {
        config[key] = value;
    },

    onClickBtnSave(arg) {
        if (arg) {
            config = arg;
        }
        writeConfig();
    },

    onClickBtnExport() {
        exportFont();
    }
};

/**
 * @en Hooks triggered after extension loading is complete
 * @zh 扩展加载完成后触发的钩子
 */
export function load() {
    readConfig();
}

/**
 * @en Hooks triggered after extension uninstallation is complete
 * @zh 扩展卸载完成后触发的钩子
 */
export function unload() { }

