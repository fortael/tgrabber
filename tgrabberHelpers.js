import async from "async";

export default {
    async post(VK, attachments, tags, groupId) {
        return new Promise((resolve) => {
            VK.request('wall.post', {
                owner_id: -groupId,
                from_group: 1,
                message: tags,
                attachments: attachments
            }, function (res) {
                return resolve(res.response.post_id);
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