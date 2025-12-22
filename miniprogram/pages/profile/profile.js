// pages/profile/profile.js
const app = getApp()

Page({
  data: {
    isAdmin: false,
    pendingNotes: [],
    openid: ''
  },

  onShow: function() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 2
      })
    }
    this.checkAdmin();
    this.getOpenId();
  },

  getOpenId: function() {
    // 检查缓存或请求云函数获取 openid
    if (this.data.openid) return;
    
    wx.cloud.callFunction({
      name: 'login',
      success: res => {
        if (res.result && res.result.openid) {
          this.setData({ openid: res.result.openid });
        }
      },
      fail: console.error
    });
  },

  copyOpenId: function() {
    wx.setClipboardData({
      data: this.data.openid,
      success: () => {
        wx.showToast({ title: 'OpenID 已复制' });
      }
    });
  },

  checkAdmin: function() {
    wx.showLoading({ title: '检查权限' });
    wx.cloud.callFunction({
      name: 'admin',
      data: {
        action: 'checkAdmin'
      },
      success: res => {
        wx.hideLoading();
        const isAdmin = res.result && res.result.isAdmin;
        this.setData({
          isAdmin: isAdmin
        });
        app.globalData.isAdmin = isAdmin;

        if (isAdmin) {
          this.getPendingNotes();
        }
      },
      fail: err => {
        wx.hideLoading();
        console.error('管理员权限检查失败', err);
        this.setData({ isAdmin: false });
      }
    });
  },

  // 已移除 toggleAdmin 方法，不再允许手动切换


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
    const item = this.data.pendingNotes[index];

    const isDeleteRequest = item.status === 'pending_delete';
    
    let itemList = ['通过', '驳回'];
    if (isDeleteRequest) {
      itemList = ['确认删除', '拒绝删除 (保留)'];
    }

    wx.showActionSheet({
      itemList: itemList,
      success: res => {
        let newStatus;
        if (isDeleteRequest) {
           // 0: 确认删除 -> deleted (逻辑上会触发物理删除), 1: 拒绝 -> published (恢复原状)
           newStatus = res.tapIndex === 0 ? 'deleted' : 'published';
        } else {
           // 0: 通过 -> published, 1: 驳回 -> rejected
           newStatus = res.tapIndex === 0 ? 'published' : 'rejected';
        }
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
