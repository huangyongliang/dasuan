// pages/index/index.js
const app = getApp()

Page({
  data: {
    notes: [],
    loading: true
  },

  onShow: function() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 0
      })
    }
    this.getNotes();
  },

  onPullDownRefresh: function() {
    this.getNotes(() => {
      wx.stopPullDownRefresh();
    });
  },

  getNotes: function(cb) {
    const db = wx.cloud.database();
    const _ = db.command;

    // 获取自己的笔记
    db.collection('notes')
      .orderBy('createTime', 'desc')
      .get({
        success: res => {
          this.setData({
            notes: res.data,
            loading: false
          });
          if (cb) cb();
        },
        fail: err => {
          console.error('查询失败', err);
          wx.showToast({
            icon: 'none',
            title: '查询失败',
          });
          this.setData({
            loading: false
          });
          if (cb) cb();
        }
      });
  },

  gotoEdit: function(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '../editor/editor?id=' + id,
    });
  }
});
