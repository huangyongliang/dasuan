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
        const note = res.data;
        // 格式化时间
        if (note.createTime && note.createTime instanceof Date) {
          note.createTime = note.createTime.toLocaleString();
        }
        
        this.setData({
          note: note,
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
    // 设置全局变量，传递待编辑的 ID
    const app = getApp();
    app.globalData.editNoteId = this.data.note._id;
    
    // 因为 editor 是 TabBar 页面，必须使用 switchTab
    wx.switchTab({
      url: '../editor/editor',
      fail: (err) => {
        console.error('跳转失败', err);
        wx.showToast({ title: '跳转失败', icon: 'none' });
      }
    });
  },

  deleteNote: function() {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条笔记吗？' + (this.data.note.visibility === 'public' && this.data.note.status === 'published' ? '\n(公开笔记需管理员审核后删除)' : ''),
      success: (res) => {
        if (res.confirm) {
          this.doDelete();
        }
      }
    });
  },

  doDelete: function() {
    wx.showLoading({ title: '删除中' });
    wx.cloud.callFunction({
      name: 'note',
      data: {
        action: 'delete',
        data: {
          id: this.data.note._id
        }
      },
      success: res => {
        wx.hideLoading();
        if (res.result.code === 200) {
          wx.showToast({ title: '已删除' });
          setTimeout(() => wx.navigateBack(), 1500);
        } else if (res.result.code === 202) {
          wx.showToast({ title: '申请已提交', icon: 'none' });
          this.getNoteDetail(this.data.note._id); // 刷新状态
        } else {
          wx.showToast({ title: res.result.msg || '删除失败', icon: 'none' });
        }
      },
      fail: err => {
        wx.hideLoading();
        console.error(err);
        wx.showToast({ title: '网络错误', icon: 'none' });
      }
    });
  }
});
