// pages/editor/editor.js
const app = getApp()

Page({
  data: {
    id: null,
    content: '',
    images: [], // store fileIDs
    tempImages: [], // store local paths for display
    status: 'draft',
    wordCount: 0
  },

  onLoad: function (options) {
    if (options.id) {
      this.setData({ id: options.id });
      this.loadNote(options.id);
    }
  },

  onShow: function() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 1
      })
    }
  },

  loadNote: function(id) {
    wx.showLoading({ title: '加载中' });
    const db = wx.cloud.database();
    db.collection('notes').doc(id).get({
      success: res => {
        this.setData({
          content: res.data.content,
          images: res.data.images || [],
          tempImages: res.data.images || [],
          status: res.data.status,
          wordCount: (res.data.content || '').length
        });
        wx.hideLoading();
      },
      fail: err => {
        console.error(err);
        wx.hideLoading();
        wx.showToast({ title: '加载失败', icon: 'none' });
      }
    });
  },

  onContentInput: function(e) {
    const val = e.detail.value;
    this.setData({
      content: val,
      wordCount: val.length
    });
  },

  previewImage: function(e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({
      current: url,
      urls: this.data.tempImages
    });
  },

  chooseImage: function() {
    wx.chooseMedia({
      count: 9,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: res => {
        const tempFiles = res.tempFiles;
        this.uploadImages(tempFiles);
      }
    });
  },

  uploadImages: function(tempFiles) {
    wx.showLoading({ title: '上传图片中' });
    const uploadTasks = tempFiles.map(file => {
      const cloudPath = 'notes_img/' + Date.now() + '-' + Math.floor(Math.random() * 1000) + file.tempFilePath.match(/\.[^.]+?$/)[0];
      return wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: file.tempFilePath,
      });
    });

    Promise.all(uploadTasks).then(results => {
      const newFileIDs = results.map(res => res.fileID);
      this.setData({
        images: this.data.images.concat(newFileIDs),
        tempImages: this.data.tempImages.concat(newFileIDs) // simplify for now, using fileID for display
      });
      wx.hideLoading();
    }).catch(err => {
      console.error(err);
      wx.hideLoading();
      wx.showToast({ title: '上传失败', icon: 'none' });
    });
  },

  removeImage: function(e) {
    const index = e.currentTarget.dataset.index;
    const images = this.data.images;
    const tempImages = this.data.tempImages;
    images.splice(index, 1);
    tempImages.splice(index, 1);
    this.setData({ images, tempImages });
  },

  save: function(e) {
    const isPublish = e.currentTarget.dataset.type === 'publish';
    const status = isPublish ? 'pending' : 'draft';

    if (!this.data.content && this.data.images.length === 0) {
      wx.showToast({ title: '内容不能为空', icon: 'none' });
      return;
    }

    wx.showLoading({ title: isPublish ? '提交中...' : '保存中...' });
    const db = wx.cloud.database();
    const data = {
      content: this.data.content,
      images: this.data.images,
      status: status,
      updateTime: new Date()
    };

    if (this.data.id) {
      db.collection('notes').doc(this.data.id).update({
        data: data,
        success: res => {
          wx.hideLoading();
          wx.showToast({ title: isPublish ? '已提交审核' : '保存成功' });
          if(isPublish) setTimeout(() => wx.navigateBack(), 1500);
        },
        fail: err => {
          wx.hideLoading();
          wx.showToast({ title: '操作失败', icon: 'none' });
        }
      });
    } else {
      data.createTime = new Date();
      db.collection('notes').add({
        data: data,
        success: res => {
          wx.hideLoading();
          this.setData({ id: res._id });
          wx.showToast({ title: isPublish ? '已提交审核' : '保存成功' });
          if(isPublish) setTimeout(() => wx.navigateBack(), 1500);
        },
        fail: err => {
          wx.hideLoading();
          wx.showToast({ title: '操作失败', icon: 'none' });
        }
      });
    }
  }
});
