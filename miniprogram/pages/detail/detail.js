// pages/detail/detail.js
Page({
  data: {
    note: null,
    loading: true
  },

  onLoad: function (options) {
    if (options.id) {
      this.getNoteDetail(options.id);
    }
  },

  onShow: function() {
    // Refresh if coming back from edit
    if (this.data.note && this.data.note._id) {
        this.getNoteDetail(this.data.note._id);
    }
  },

  getNoteDetail: function(id) {
    wx.showLoading({ title: '加载中' });
    const db = wx.cloud.database();
    db.collection('notes').doc(id).get({
      success: res => {
        // Format date if needed, or do it in wxml via wxs
        // res.data.createTime = res.data.createTime.toLocaleString(); 
        this.setData({
          note: res.data,
          loading: false
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

  previewImage: function(e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({
      current: url,
      urls: this.data.note.images
    });
  },

  gotoEdit: function() {
    wx.navigateTo({
      url: '../editor/editor?id=' + this.data.note._id,
    });
  }
});
