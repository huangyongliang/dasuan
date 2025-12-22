const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, 'miniprogram/images');
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
}

// 1x1 Pixel PNGs
// Gray #999999
const grayPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mO8/5+hHgAHQwJ/wbP9qQAAAABJRU5ErkJggg==', 'base64');
// Green #07c160
const greenPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mM0cnSsBwADvQG/M6wTmAAAAABJRU5ErkJggg==', 'base64');

const icons = [
    { name: 'note.png', data: grayPng },
    { name: 'note-active.png', data: greenPng },
    { name: 'add.png', data: grayPng },
    { name: 'add-active.png', data: greenPng },
    { name: 'profile.png', data: grayPng },
    { name: 'profile-active.png', data: greenPng }
];

icons.forEach(icon => {
    fs.writeFileSync(path.join(iconsDir, icon.name), icon.data);
    console.log(`Created ${icon.name}`);
});
