import fs from "fs";
import async from "async";
import readline from "readline";
import request from "request";
import cheerio from "cheerio";
import path from "path";
import http from "http";
import chalk from "chalk";
import restler from "restler";
import _ from 'lodash';

import VKsdk from 'vksdk';
const VK = new VKsdk({
    appId: clientId,
    appSecret: secret
});

const Configstore = require('configstore');
const Config = new Configstore('config.json');

import tgrabberHelpers from './tgrabberHelpers';

let tmpDir = path.join(__dirname, 'tmp');

//Open your group statistics to get real id
//открой стастику группы чтобы получить реальный id
let groupId = '125235721';


//https://vk.com/apps?act=manage
let clientId = '5560324';
let secret = 'gzVHmSWTU4phzBuJIRaN';


//noinspection JSUnresolvedFunction
const argv = require('yargs')
    .usage('$0 <cmd> [args]')
    .option('link', {
        alias: 'l',
        describe: 'link to tumbler post',
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

function getRow(file) {
    return file + '';
}

function parseTag(tag) {
    return tag.replace(/ /g, '').replace('#', '').replace('\'', '').replace('`', '');
}

async function start() {

    // console.log(1);
    // Config.clear();

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const token = Config.get('token');

    if (typeof token === "undefined" || token === null) {
        Config.set('token', await tgrabberHelpers.getToken(clientId, rl))
    }

    if (typeof argv.l === "undefined" || argv.l === null) {
        argv.l = await tgrabberHelpers.getLink(rl);
    }

    rl.close();



    console.log(chalk.cyan('Поиск данных на странице'));

    return new Promise((resolve => {
        request(argv.l, function (err, res, body) {

            let $ = cheerio.load(body);
            let $2 = false;

            let photoset = $('iframe.photoset');

            //usually pages contains inside <iframe> tag
            if (photoset.length <= 0) {
                return resolve(parse([$]));
            }

            request(photoset.attr('src'), function (err2, res2, body2) {
                $2 = cheerio.load(body2);
                return resolve(parse([$, $2]));
            });

        });
    }))
}

function parse(scope) {
    async.parallel({
        tags: function (done) {
            console.log('Поиск тегов на странице');

            let tags = [], buf = '';

            if (scope[0]('.tags').length > 0) {
                scope[0]('.tags a').each(function (i, e) {
                    tags.push(parseTag(scope[0](e).text()));
                });
            }
            else if (scope[0]('a.tag-link').length > 0) {
                scope[0]('a.tag-link').each(function (i, e) {
                    tags.push(parseTag(scope[0](e).text()));
                });
            } else {
                scope[0]('a').each(function (i, e) {
                    buf = scope[0](e).text();
                    if (buf[0] == "#") {
                        tags.push(parseTag(buf));
                    }
                });
            }

            tags.push('stevenuniverse');

            return done(null, tags);

        },
        images: function (done) {
            let images = [], i = 1;

            async.each(scope, function (ctx, cb) {
                console.log('Поиск картинок на странице ' + chalk.green('#' + i));

                let buf = '';
                ctx('img').each(function (i, e) {
                    buf = ctx(e).attr('src');

                    if (buf.indexOf('avatar') === -1) {
                        if (buf.indexOf('media') + 1) {
                            images.push(buf);
                        }
                    }
                });
                i++;
                cb();
            }, function () {
                return done(null, images);
            });
        }
    }, ready);
}

function ready(err, scope) {
    VK.setSecureRequests(true);

    if (argv.d) {
        console.log(scope);
    }
    async.parallel({
        tags: function (cb) {
            console.log('Преобразование тегов');

            cb(null, scope.tags.map(function (i, e) {
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

                console.log(file);


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
                console.log(chalk.green('Файлы загружены:') + ' ' + scope.images.length);
                return cb(null, list);
            });
        },
        vk: function (cb) {
            console.log('Подготовка сервера для загрузки');

            // VK.request('photos.getWallUploadServer', {group_id: groupId}, function (res) {
            //     console.log('Сервер для загрузки найден');
            //     return cb(null, res.response.upload_url);
            // });
        }
    }, repost);
}

function repost(err, scope) {
    async.waterfall([
        /*загрузка картинок из локали в вк*/
        function (callback) {
            let files = [];
            console.log(chalk.blue('Загрузка картинок'));

            scope.images.forEach(function (i, e) {
                files['file' + e] = restler.file(i.file, null, fs.statSync(i.file).size, null, "image/" + i.key.pop())
            });

            restler.post(scope.vk, {
                multipart: true,
                data: files
            }).on('complete', function (answer, header) {
                return callback(null, answer);
            });

            /*Картинки загрузжены подготовка поста*/
        }, function (answer, cb) {
            console.log(chalk.blue('Загружены'));
            if (argv.d) {
                console.log(answer);
            }
            let data = JSON.parse(answer);
            data.group_id = 125235721;


            vk.request('photos.saveWallPhoto', data, function (res) {
                let attachments = '';
                let serverData = res.response;
                if (typeof serverData != "object") {
                    serverData = [serverData];
                }

                serverData.forEach(function (photo) {
                    // console.log(photo.owner_id);
                    attachments += 'photo' + photo.owner_id + '_' + photo.id + ','
                });
                attachments += '[source]' + argv.l + ',';
                attachments += argv.l;
                cb(null, attachments);
            });
            /*публикация поста*/
        }, function (attachments, cb) {
            console.log(chalk.blue('Поиск паролей'));
            // console.log(chalk.blue('Пароли отправлены Захару'));
            console.log(chalk.blue('Публикация поста'));
            if (argv.d) {
                return cb();
            }
            vk.request('wall.post', {
                owner_id: -groupId,
                from_group: 1,
                message: scope.tags,
                attachments: attachments
            }, function (res) {
                async.each(scope.images, function (item) {
                    return fs.unlink(item.file);
                });
                return cb(null, res.response.post_id);
            });
        }, function (id, cb) {
            return cb();
            // vk.request('wall.getById', {
            //     posts: '-' + groupId + '_' + id,
            //     extended: 0
            // }, function (res) {
            //     res.response[0].attachments[1].link.title = ' ';
            //     res.response[0].attachments[1].link.description = 'описание';
            //     vk.request('wall.edit', {
            //         owner_id: res.response[0].owner_id,
            //         post_id: res.response[0].id,
            //         message: res.response[0].text,
            //         friends_only: 0,
            //         attachments: res.response[0].attachments
            //     }, function (res) {
            //         console.log(res);
            //         cb();
            //         //http://steven-universe-fanart.tumblr.com/post/156809455628/felidaeng-my-part-for-sleepydot-thank-you
            //     });
            // });
        }
    ], function () {
        if (argv.d) {
            console.log(chalk.green.bold('Готово') + chalk.red(' (Включен режим дебага, пост не будет опубликован)'));
        } else {
            console.log(chalk.green.bold('Готово'));
        }
        argv.l = null;
        return startUp();
    });
}

start();

module.exports = {
    assets: "./tmp/*.*",
    dirs: [
        "./tmp"
    ]
};
