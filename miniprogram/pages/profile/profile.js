// pages/profile/profile.js
const app = getApp()

Page({
  data: {
    isAdmin: false,
    openid: ''
  },

  onShow: function() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 1 // My is index 1 now
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
      },
      fail: err => {
        wx.hideLoading();
        console.error('管理员权限检查失败', err);
        this.setData({ isAdmin: false });
      }
    });
  },

  // 已移除 toggleAdmin 方法，不再允许手动切换
});
