// pages/detail/detail.js
Page({
  data: {
    note: null,
    loading: true,
    isMine: false,
    comments: [],
    commentInput: '',
    isAdmin: false,
    currentOpenId: ''
  },

  onLoad: function (options) {
    if (options.id) {
      this.getNoteDetail(options.id);
      this.getComments(options.id);
    }
  },

  onShow: function() {
    // Refresh if coming back from edit
    if (this.data.note && this.data.note._id) {
        this.getNoteDetail(this.data.note._id);
        this.getComments(this.data.note._id);
    }
  },

  getNoteDetail: function(id) {
    wx.showLoading({ title: '加载中' });
    
    // 改用云函数获取详情，以解决权限问题（避免非本人无法读取公开笔记）
    wx.cloud.callFunction({
      name: 'note',
      data: {
        action: 'getDetail',
        data: { id: id }
      },
      success: res => {
        if (res.result.code === 200) {
          const note = res.result.data;
          // 格式化时间
          // 云函数返回的时间可能是字符串(ISO)或Date对象
          let createTime = note.createTime;
          if (typeof createTime === 'string') {
             createTime = new Date(createTime);
          }
          if (createTime instanceof Date) {
            note.createTime = createTime.toLocaleString();
          }
          
          this.setData({
            note: note,
            loading: false,
            isMine: res.result.isOwner
          });
        } else {
          wx.showToast({ title: res.result.msg || '无权查看', icon: 'none' });
        }
        wx.hideLoading();
      },
      fail: err => {
        console.error(err);
        wx.hideLoading();
        wx.showToast({ title: '加载失败', icon: 'none' });
      }
    });
  },

  getComments: function(noteId) {
    wx.cloud.callFunction({
      name: 'note',
      data: {
        action: 'getComments',
        data: { noteId: noteId }
      },
      success: res => {
        if (res.result.code === 200) {
          const comments = res.result.data.map(item => {
             // 格式化时间
             if (typeof item.createTime === 'string') {
               item.createTime = new Date(item.createTime).toLocaleString();
             } else if (item.createTime instanceof Date) {
               item.createTime = item.createTime.toLocaleString(); // 实际上云函数返回的通常是字符串
             } else {
               item.createTime = '刚刚'; // fallback
             }
             return item;
          });
          
          this.setData({
            comments: comments,
            isAdmin: res.result.isAdmin,
            currentOpenId: res.result.currentOpenId
          });
        }
      },
      fail: err => console.error('获取评论失败', err)
    });
  },

  onCommentInput: function(e) {
    this.setData({ commentInput: e.detail.value });
  },

  submitComment: function() {
    const content = this.data.commentInput.trim();
    if (!content) {
      wx.showToast({ title: '请输入评论内容', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '提交中' });
    wx.cloud.callFunction({
      name: 'note',
      data: {
        action: 'addComment',
        data: {
          noteId: this.data.note._id,
          content: content
        }
      },
      success: res => {
        wx.hideLoading();
        if (res.result.code === 200) {
          wx.showToast({ title: '评论成功' });
          this.setData({ commentInput: '' });
          this.getComments(this.data.note._id); // 刷新评论列表
        } else {
          wx.showToast({ title: '评论失败', icon: 'none' });
        }
      },
      fail: err => {
        wx.hideLoading();
        console.error(err);
        wx.showToast({ title: '网络错误', icon: 'none' });
      }
    });
  },

  deleteComment: function(e) {
    const commentId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '提示',
      content: '确定删除这条评论吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中' });
          wx.cloud.callFunction({
            name: 'note',
            data: {
              action: 'deleteComment',
              data: { commentId: commentId }
            },
            success: res => {
              wx.hideLoading();
              if (res.result.code === 200) {
                wx.showToast({ title: '已删除' });
                this.getComments(this.data.note._id);
              } else {
                wx.showToast({ title: '删除失败', icon: 'none' });
              }
            },
            fail: err => {
              wx.hideLoading();
              console.error(err);
            }
          });
        }
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
