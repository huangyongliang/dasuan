// pages/profile/profile.js
const app = getApp()

Page({
  data: {
    isAdmin: false,
    pendingNotes: []
  },

  onShow: function() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 2
      })
    }
    this.checkAdmin();
  },

  checkAdmin: function() {
    // 模拟管理员检查
    // 在实际生产中，这里应该调用云函数判断 openid 是否在管理员列表中
    // 为了演示，我们暂时通过一个隐藏操作或默认为 false，
    // 这里我们添加一个 toggleAdmin 方法供演示使用
    this.setData({
      isAdmin: app.globalData.isAdmin
    });

    if (app.globalData.isAdmin) {
      this.getPendingNotes();
    }
  },

  // 演示用：切换管理员身份
  toggleAdmin: function() {
    app.globalData.isAdmin = !app.globalData.isAdmin;
    this.setData({ isAdmin: app.globalData.isAdmin });
    if (app.globalData.isAdmin) {
      this.getPendingNotes();
    } else {
      this.setData({ pendingNotes: [] });
    }
    wx.showToast({
      title: app.globalData.isAdmin ? '已切换为管理员' : '已切换为普通用户',
      icon: 'none'
    });
  },

  getPendingNotes: function() {
    // 优先尝试云函数（可读取所有人的待审核笔记）
    wx.cloud.callFunction({
      name: 'admin',
      data: {
        action: 'getPending'
      },
      success: res => {
        if (res.result && res.result.data) {
          this.setData({
            pendingNotes: res.result.data
          });
        }
      },
      fail: err => {
        console.warn('云函数调用失败，降级为本地查询（只能看到自己的）', err);
        // 降级逻辑：本地查询
        const db = wx.cloud.database();
        db.collection('notes')
          .where({
            status: 'pending'
          })
          .orderBy('createTime', 'desc')
          .get({
            success: res => {
              this.setData({
                pendingNotes: res.data
              });
            },
            fail: err => {
              console.error('获取待审核列表失败', err);
            }
          });
      }
    });
  },

  auditNote: function(e) {
    const id = e.currentTarget.dataset.id;
    const index = e.currentTarget.dataset.index;

    wx.showActionSheet({
      itemList: ['通过', '驳回'],
      success: res => {
        const newStatus = res.tapIndex === 0 ? 'published' : 'rejected';
        this.updateStatus(id, newStatus);
      }
    });
  },

  updateStatus: function(id, status) {
    wx.showLoading({ title: '处理中' });
    
    // 优先尝试云函数
    wx.cloud.callFunction({
      name: 'admin',
      data: {
        action: 'audit',
        noteId: id,
        status: status
      },
      success: res => {
        wx.hideLoading();
        wx.showToast({ title: '已处理' });
        this.getPendingNotes();
      },
      fail: err => {
        console.warn('云函数调用失败，尝试本地更新', err);
        const db = wx.cloud.database();
        db.collection('notes').doc(id).update({
          data: {
            status: status
          },
          success: res => {
            wx.hideLoading();
            wx.showToast({ title: '已处理' });
            this.getPendingNotes();
          },
          fail: err => {
            wx.hideLoading();
            wx.showToast({ title: '处理失败', icon: 'none' });
          }
        });
      }
    });
  }
});
