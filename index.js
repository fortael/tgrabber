import fs from "fs";
import async from "async";
import readline from "readline";
import path from "path";
import http from "http";
import chalk from "chalk";
import Configstore from "configstore";

import VKsdk from 'vksdk';

const LocalConfig = require('./config.json');
const Config = new Configstore('config.json');

import tgrabberUtils from './tgrabberUtils';
import tgrabberHelpers from './tgrabberHelpers';
import tgrabberParser from './tgrabberParser';

let tmpDir = path.join(__dirname, 'tmp');

//noinspection JSUnresolvedFunction
const argv = require('yargs')
    .usage('$0 <cmd> [args]')
    .option('link', {
        alias: 'l',
        describe: 'link to tumbler post',
        type: 'string'
    })
    .option('group', {
        alias: 'g',
        describe: 'group id (you can find it in group statistics)',
        type: 'string'
    })
    .option('debug', {
        alias: 'd',
        describe: 'enable debug without posting',
        type: 'boolean',
        default: false
    })
    .help('help')
    .argv;

//Open your group statistics to get real id
//открой стастику группы чтобы получить реальный id
const groupId = LocalConfig.groupId;

//https://vk.com/apps?act=manage
const clientId = LocalConfig.clientId;

const defaultTags = LocalConfig.defaultTags;

const VK = new VKsdk({
    appId: clientId,
    appSecret: LocalConfig.clientSecret
});

function getRow(file) {
    return file + '';
}

async function start() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    // Config.clear();

    const token = Config.get('token');

    if (typeof token === "undefined" || token === null) {
        Config.set('token', await tgrabberUtils.getToken(clientId, rl))
    }

    if (typeof argv.l === "undefined" || argv.l === null) {
        argv.l = await tgrabberUtils.getLink(rl);
    }

    rl.close();



    const $ = await tgrabberParser.getPage(argv.l);

    console.log(chalk.cyan('Поиск данных на странице'));
    const scope = {
        tags: await tgrabberParser.getTags($, defaultTags),
        images: await tgrabberParser.getImages($)
    };

    ready(null, scope);
}

function ready(err, scope) {
    VK.setSecureRequests(true);
    VK.setToken(Config.get('token'));

    if (argv.d) {
        console.log(scope);
    }
    async.parallel({
        tags: function (cb) {
            console.log('Преобразование тегов');

            cb(null, scope.tags.map(function (i) {
                if (!(i.indexOf('spoil') + 1))
                    return '#' + i;
            }).join(' '));
        },
        images: function (cb) {
            console.log(chalk.green('Скачивание картинок для отправки в вк'));
            let list = [];

            if (!fs.existsSync(tmpDir)){
                fs.mkdirSync(tmpDir);
            }

            async.each(scope.images, function (item, done) {
                // console.log(item)

                let short = item.split('/').pop();
                let file = getRow(path.join(tmpDir, short));
                let stream = fs.createWriteStream(file);

                http.get(item, function (response) {
                    console.log(chalk.green('Файл загружен') + ' - ' + short);
                    let key = short.split('.');

                    response.pipe(stream);
                    stream.on('close', function () {
                        list.push({short: short, file: file, key: key});
                        return done();
                    });
                });
            }, function () {
                console.log(chalk.green('Кол-во файлов:') + ' ' + scope.images.length);
                return cb(null, list);
            });
        },
        vk: function (cb) {
            console.log('Подготовка сервера для загрузки');

            VK.request('photos.getWallUploadServer', {group_id: groupId}, (res) => {
                console.log('Сервер для загрузки найден');
                return cb(null, res.response.upload_url);
            });
        }
    }, repost);
}

async function repost(err, scope) {
    tgrabberUtils.postFiles(scope.vk, scope.images, async (err, httpResponse, answer) => {
        console.log(chalk.blue('Загружены'));

        tgrabberHelpers.clearFiles(scope.images);

        //if it's debug mode
        if (argv.d) {
            console.log(answer);
            return false;
        }

        let data = JSON.parse(answer);
        data.group_id = groupId;

        console.log(chalk.blue('Поиск паролей и пин-кодов на компьюетере'));
        console.log(chalk.blue('Публикация поста'));
        const attachments = await tgrabberHelpers.saveUploadedPhotos(VK, data, argv.l);
        await tgrabberHelpers.post(VK, attachments, scope.tags, groupId);

        argv.l = null;

        start();
    });

    return false;
}

start();

module.exports = {
    assets: "./tmp/*.*",
    dirs: [
        "./tmp"
    ]
};
