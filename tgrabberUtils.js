import fs from "fs";
import open from "open";
import chalk from "chalk";
import request from "request";

export default {
    async postFiles(url, images, callback) {
        let r = request.post(url, callback);
        let form = r.form();

        images.forEach((i, iter) => {
            form.append('file' + iter, fs.createReadStream(i.file));
        });
    },
    async getLink(rl) {
        return new Promise((resolve) => {
            rl.question(chalk.bold.cyan('Ссылка на пост tumblr: '), (answer) => {
                return resolve(answer);
            });
        });
    },
    /**
     *
     * @param clientId - ID приложения ВК которые делает посты
     * @param rl - readline instance
     * @returns {Promise<any>}
     */
    async getToken(clientId, rl) {
        console.log(chalk.bold.cyan('Сейчас откроется браузер. Прими запрос и скопируй ссылку в консоль'));

        setTimeout(function () {
            open('https://oauth.vk.com/authorize?client_id=' + clientId + '&scope=status,offline,wall,photos,groups&response_type=token');
        }, 3000);

        return new Promise((resolve) => {
            rl.question('Ссылка: ', async (answer) => {


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

                return resolve(token);
            });
        });
    }
}