"use strict";

const { dialog } = require("electron");
const os = require("os");
const fs = require("fs");
const exec = require("child_process").exec;
const utils = require("./utils");

const EXAMPLE_PATH = `${__dirname}/textMeshPro`;
const CONFIG_PATH = `${__dirname}/config.json`;
const TEMP_PATH = `${__dirname}/temp`;
const TEMP_HIERO_PATH = `${__dirname}/temp/hieroConfig.hiero`;

let config = {
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

function isFileExist(path) {
    return new Promise((resolve, reject) => {
        fs.access(path, fs.constants.F_OK, (err) => {
            resolve(!err);
        });
    });
}

async function readConfig() {
    try {
        let exist = await isFileExist(CONFIG_PATH);
        if (!exist) {
            return;
        }
        let data = fs.readFileSync(CONFIG_PATH, "utf-8");
        if (data) {
            config = JSON.parse(data);
        }
    } catch (error) {
        Editor.error(`[textmeshpro-tool readConfig] error`);
    }
}

function writeConfig() {
    try {
        let data = JSON.stringify(config);
        fs.writeFileSync(CONFIG_PATH, data);
        Editor.log(`write config: ${CONFIG_PATH}`);
    } catch (error) {
        Editor.error(`[textmeshpro-tool writeConfig] error`);
        Editor.error(error);
    }
}

function exportFont() {
    try {
        let check = fs.existsSync(TEMP_PATH);
        if (!check) {
            fs.mkdirSync(TEMP_PATH);
        }
        utils.writeHiero(TEMP_HIERO_PATH, config);
        let cmdStr = `java -jar ${config.hieroPath} -i ${TEMP_HIERO_PATH} -o ${config.exportDir}/${config.exportName}.fnt -b`;

        Editor.log("[textmeshpro-tool] 正在输出字体文件，请耐心等待Hiero窗口自行关闭...");
        let time = Date.now();
        exec(cmdStr, (error, stdout, stderr) => {
            if (error) {
                Editor.error(`[textmeshpro-tool exportFont] exec error: ${error}`);
                return;
            }
            utils.parse(`${config.exportDir}/${config.exportName}.fnt`);
            fs.unlinkSync(`${config.exportDir}/${config.exportName}.fnt`);
            Editor.assetdb.refresh("db://assets/");

            Editor.log(`[textmeshpro-tool] 字体文件输出完毕，耗时：${(Date.now() - time) / 1000}s`);
        });
    } catch (error) {
        Editor.error(`[textmeshpro-tool exportFont] error 字体文件导出失败`);
        Editor.error(error);
    }
}

module.exports = {
    load() {
        readConfig();
    },

    unload() {
    },

    messages: {
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
                    cmdStr = `xcopy ${EXAMPLE_PATH.replace(/\//g, "\\")} ${Editor.Project.path}\\assets\\textMeshPro\\ /e`;
                } else {
                    cmdStr = `cp -r ${EXAMPLE_PATH} ${Editor.Project.path}/assets/textMeshPro/`;
                }
                Editor.log(cmdStr);
                exec(cmdStr, (error, stdout, stderr) => {
                    if (error) {
                        Editor.error(`[textmeshpro-tool importExample] exec error: ${error}`);
                        return;
                    }
                    Editor.assetdb.refresh("db://assets/textMeshPro/");
                });
            } catch (error) {
                Editor.error(`[textmeshpro-tool importExample] 文件导入失败，请尝试手动导入 error: ${error}`);
                Editor.error(error);
            }
        },

        openPanel() {
            Editor.Panel.open("textmeshpro-tool");
        },

        onPanelInit() {
            Editor.Ipc.sendToPanel("textmeshpro-tool", "refreshConfig", config);
        },

        onChangeConfig(event, key, value) {
            config[key] = value;
        },

        onClickBtnExportDir() {
            dialog.showOpenDialog({
                defaultPath: config.exportDir || Editor.Project.path,
                properties: ["openDirectory"]
            }).then((res) => {
                if (res.filePaths.length > 0) {
                    config.exportDir = res.filePaths[0];
                    Editor.Ipc.sendToPanel("textmeshpro-tool", "refreshConfig", config);
                }
            });
        },

        onClickBtnFontPath() {
            dialog.showOpenDialog({
                defaultPath: config.fontPath || Editor.Project.path,
                properties: ["openFile"],
                filters: [
                    { name: ".ttf", extensions: ["ttf"] }
                ]
            }).then((res) => {
                if (res.filePaths.length > 0) {
                    config.fontPath = res.filePaths[0];
                    Editor.Ipc.sendToPanel("textmeshpro-tool", "refreshConfig", config);
                }
            });
        },

        onClickBtnHiero() {
            dialog.showOpenDialog({
                defaultPath: config.hieroPath || Editor.Project.path,
                properties: ["openFile"],
                filters: [
                    { name: ".jar", extensions: ["jar"] }
                ]
            }).then((res) => {
                if (res.filePaths.length > 0) {
                    config.hieroPath = res.filePaths[0];
                    Editor.Ipc.sendToPanel("textmeshpro-tool", "refreshConfig", config);
                }
            });
        },

        onClickBtnTextPath() {
            dialog.showOpenDialog({
                defaultPath: config.textPath || Editor.Project.path,
                properties: ["openFile"],
                filters: [
                    { name: ".txt", extensions: ["txt"] }
                ]
            }).then((res) => {
                if (res.filePaths.length > 0) {
                    config.textPath = res.filePaths[0];
                    Editor.Ipc.sendToPanel("textmeshpro-tool", "refreshConfig", config);
                }
            });
        },

        onClickBtnSave(event, arg) {
            if (arg) {
                config = arg;
            }
            writeConfig();
        },

        onClickBtnExport() {
            exportFont();
        }
    }
};
