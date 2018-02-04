import _ from 'lodash';
import fs from 'fs';

let publishTime = 0;

export default {
    async clearFiles(scope) {
        _.each(scope, (item) => {
            fs.unlinkSync(item.file);
        });
    },
    async post(VK, attachments, tags, groupId, moreTime = 0) {
        let time;

        if (publishTime === 0) {
            time = Math.floor(Date.now() / 1000);
            publishTime = time + (86400 * 3) + moreTime;
        }


        return new Promise((resolve, reject) => {
            VK.request('wall.post', {
                owner_id: -groupId,
                from_group: 1,
                publish_date: publishTime,
                message: tags,
                attachments: attachments
            }, function (res) {
                let id = _.get(res.response, 'post_id');

                if (id && id !== null) {
                    publishTime += 120;

                    return resolve(id);
                }

                if (parseInt(_.get(res, 'error.error_code')) === 241) {
                    return this.post(VK, attachments, tags, groupId, 120);
                }

                console.log(_.get(res, 'error.error_code'));
                console.log(res);

                return reject(res);
            });
        });
    },
    async saveUploadedPhotos(VK, data, sourceLink) {
        return new Promise((resolve) => {
            VK.request('photos.saveWallPhoto', data, function (res) {
                let attachments = '';
                let serverData = res.response;
                if (typeof serverData !== "object") {
                    serverData = [serverData];
                }

                serverData.forEach(function (photo) {
                    attachments += 'photo' + photo.owner_id + '_' + photo.id + ','
                });
                attachments += '[source]' + sourceLink + ',';
                attachments += sourceLink;

                resolve(attachments);
            });
        });
    }
}