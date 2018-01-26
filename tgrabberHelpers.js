import _ from 'lodash';
import fs from 'fs';

export default {
    async clearFiles(scope) {
        _.each(scope, (item) => {
            fs.unlinkSync(item.file);
        });
    },
    async post(VK, attachments, tags, groupId) {
        return new Promise((resolve, reject) => {
            let time = Date.now() / 1000;
            let diff = time + (86400 * 10); //now + 10 days

            VK.request('wall.post', {
                owner_id: -groupId,
                from_group: 1,
                publish_date: diff,
                message: tags,
                attachments: attachments
            }, function (res) {
                let id = _.get(res.response, 'post_id');

                if (id && id !== null) {
                    return resolve(id);
                }

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