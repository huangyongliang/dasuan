// pages/editor/editor.js
const app = getApp()

Page({
  data: {
    id: null,
    content: '',
    images: [], // store fileIDs
    tempImages: [], // store local paths for display
    status: 'draft',
    visibility: 'private',
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

    // 检查是否有待编辑的笔记 ID (从详情页跳转过来)
    const app = getApp();
    if (app.globalData.editNoteId) {
      const id = app.globalData.editNoteId;
      // 清除标记，防止重复加载
      app.globalData.editNoteId = null;
      
      this.setData({ id: id });
      this.loadNote(id);
    } else {
      // 如果没有 ID，且当前没有内容（或是刚提交完），可以考虑重置表单
      // 这里暂不强制重置，以免用户误触 Tab 导致草稿丢失
      // 但如果 id 存在（说明之前在编辑模式），现在切回来了，是否要清空？
      // 为了逻辑简单，如果是从 TabBar 直接点击进来的，通常期望是新笔记。
      // 但为了体验，我们只在 id 存在且没有 globalData 时（说明是手动切回来的），不乱动。
      // 或者，我们可以每次进入都重置？不，那样体验不好。
      // 策略：只有明确传递了 null 或者 switchTab 且非编辑模式时...
      // 暂时保持现状，只处理 editNoteId 存在的情况。
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
          visibility: res.data.visibility || 'private',
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

  changeVisibility: function(e) {
    const val = e.currentTarget.dataset.value;
    this.setData({
      visibility: val
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
    
    // 调用云函数进行保存（包含限制检查）
    wx.cloud.callFunction({
      name: 'note',
      data: {
        action: this.data.id ? 'update' : 'create',
        data: {
          id: this.data.id,
          content: this.data.content,
          images: this.data.images,
          status: status,
          visibility: this.data.visibility
        }
      },
      success: res => {
        wx.hideLoading();
        if (res.result && res.result.code === 200) {
          wx.showToast({ title: isPublish ? '已提交审核' : '保存成功' });
          if(isPublish) setTimeout(() => wx.navigateBack(), 1500);
        } else if (res.result && res.result.code === 429) {
          wx.showToast({ title: res.result.msg, icon: 'none', duration: 3000 });
        } else {
          wx.showToast({ title: '操作失败', icon: 'none' });
          console.error('Save failed', res);
        }
      },
      fail: err => {
        wx.hideLoading();
        console.error('Call Function Failed', err);
        wx.showToast({ title: '网络错误', icon: 'none' });
      }
    });
  }
});
