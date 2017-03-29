let fs = require('fs');
let nconf = require('nconf');
let async = require('async');
let readline = require('readline');
let open = require('open');
let request = require('request');
let cheerio = require('cheerio');
let trim = require('trim');
let path = require('path');
let http = require('http');
let chalk = require('chalk');
let restler = require('restler');

let tmpDir = path.join(__dirname, 'tmp');

let groupId = '';
let clientId = '';
let secret = '';

let VKsdk = require('vksdk');
let vk = new VKsdk({
    appId: clientId,
    appSecret: secret
});

vk.setSecureRequests(true);

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

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

nconf.file({
    file: getRow(path.join(__dirname, 'config.json')),
    secure: {
        secret: 'TgRaBBer_$alt8312894',
        alg: 'aes-256-ctr'
    }
});

/**
 * Heat-up
 */
function startUp() {
    let tasks = [];
    let token;
    nconf.get('token', function (err, TOKEN) {
        if (typeof TOKEN === "undefined") {
            tasks.push(function (cb) {
                console.log(chalk.bold.cyan('Сейчас откроется браузер. Прими запрос и скопируй ссылку.'));
                setTimeout(function () {
                    open('https://oauth.vk.com/authorize?client_id=' + clientId + '&scope=status,offline,wall,photos,groups&response_type=token');
                    rl.question('Ссылка: ', (answer) => {
                        answer = answer.split('&');

                        let token = false;
                        for (let i = 0, l = answer.length; i < l; i++) {
                            if (answer[i].indexOf('access_token')) {
                                token = answer[i].split('=').pop();
                                break;
                            }
                        }

                        if (token === false) {
                            console.log(chalk.bold.red('Не удалось определить токен'));
                            return false;
                        }

                        nconf.set('token', token);
                        nconf.save();
                        cb(null);
                    });
                }, 3000);
            });
        }

        if (typeof argv.l === "undefined" || argv.l === null) {
            tasks.push(function (done) {
                rl.question(chalk.bold.cyan('Ссылка на пост tumblr: '), (answer) => {
                    argv.l = answer;
                    return done(null);
                });
            });
        }

        async.waterfall(tasks, start);
    });
}

function start() {
    rl.close();
    vk.setToken(nconf.get('token'));

    request(argv.l, function (err, res, body) {

        let $ = cheerio.load(body);
        let $2 = false;

        let photoset = $('iframe.photoset');

        if (photoset.length <= 0) {
            return parse([$]);
        }

        request(photoset.attr('src'), function (err2, res2, body2) {
            console.log(chalk.cyan('Углубленный поиск'));
            $2 = cheerio.load(body2);
            parse([$, $2]);
        });

    });
}

function parseTag(tag) {
    return tag.replace(/ /g, '').replace('#', '').replace('\'', '').replace('`', '');
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

            async.each(scope.images, function (item, done) {
                let short = item.split('/').pop(),
                    file = getRow(path.join(tmpDir, short)),
                    stream = fs.createWriteStream(file);

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
                return cb(null, list);
            });
        },
        vk: function (cb) {
            console.log('Подготовка сервера для загрузки');

            vk.request('photos.getWallUploadServer', {group_id: groupId}, function (res) {
                // console.log(res);
                return cb(null, res.response.upload_url);
            });
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
startUp();
module.exports = {
    assets: "./tmp/*.*",
    dirs: [
        "./tmp"
    ]
};
