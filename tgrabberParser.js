import cheerio from "cheerio";
import request from "request";
import chalk from "chalk";
import async from "async";

function parseTag(tag) {
    return tag.replace(/ /g, '').replace('#', '').replace('\'', '').replace('`', '');
}

export default {
    async getImages(scope) {
        return new Promise((resolve) => {
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
                return resolve(images);
            });
        })
    },
    async getTags(scope) {
        console.log('Поиск тегов на странице');

        return new Promise((resolve)=> {
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
                    if (buf[0] === "#") {
                        tags.push(parseTag(buf));
                    }
                });
            }

            //todo:push default tags

            return resolve(tags);
        });
    },
    async getPage(link) {
        return new Promise((resolve) => {
            request(link, function (err, res, body) {

                let $ = cheerio.load(body);
                let $2 = false;

                let photoset = $('iframe.photoset');

                //usually pages contains inside <iframe> tag
                if (photoset.length <= 0) {
                    return resolve([$]);
                }

                request(photoset.attr('src'), function (err2, res2, body2) {
                    $2 = cheerio.load(body2);
                    return resolve([$, $2]);
                });

            });
        });
    }
}