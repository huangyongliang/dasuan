// pages/merit/merit.js
Page({
  data: {
    count: 0,
    sessionCount: 0,
    isAnimating: false,
    isPlusAnimating: false,
    showPlusOne: false,
    showRankModal: false,
    rankList: [],
    myRank: { count: 0, rank: '-', nickname: '神秘人' },
    pendingMerits: 0 // 本地暂存的功德增量
  },

  onLoad: function() {
    this.initMerit();
  },

  onUnload: function() {
    // 页面卸载时，如果有未提交的功德，强制提交一次
    this.flushMerits();
  },

  onHide: function() {
    // 页面隐藏时，也提交
    this.flushMerits();
  },

  onShow: function() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 1
      })
    }
  },

  initMerit: function() {
    wx.cloud.callFunction({
      name: 'merit',
      data: { type: 'init' },
      success: res => {
        if (res.result && res.result.count !== undefined) {
          this.setData({ count: res.result.count });
        }
      },
      fail: console.error
    });
  },

  onTapWoodenFish: function() {
    // 1. 本地立即反馈动画和数值
    this.setData({
      isAnimating: true,
      showPlusOne: false // Reset animation
    }, () => {
      setTimeout(() => {
        this.setData({
          isAnimating: false,
          showPlusOne: true,
          isPlusAnimating: true,
          count: this.data.count + 1,
          sessionCount: this.data.sessionCount + 1 // 增加本次功德数
        });
      }, 50); // Small delay for scale animation
    });

    // 2. 播放触感反馈 (Short vibration)
    wx.vibrateShort({ type: 'light' });

    // 3. 异步调用云函数
    wx.cloud.callFunction({
      name: 'merit',
      data: { type: 'add' },
      success: res => {
        // Optional: consistency check
      },
      fail: err => {
        console.error('Add merit failed', err);
        // Rollback if needed, but for merit +1, usually we can ignore minor inconsistencies
      }
    });
  },

  showRank: function() {
    console.log('Clicked rank button'); // Debug log
    wx.showLoading({ title: '加载中' });
    wx.cloud.callFunction({
      name: 'merit',
      data: { type: 'rank' },
      success: res => {
        console.log('Rank data:', res); // Debug log
        wx.hideLoading();
        if (res.result && res.result.top10) {
          // Process openid for display
          const rankList = res.result.top10.map(item => ({
            ...item,
            _openid_short: item._openid ? item._openid.substr(-4) : '****'
          }));
          
          this.setData({
            rankList: rankList,
            myRank: res.result.myMerit || { count: 0, rank: '未上榜' },
            showRankModal: true
          });
        } else {
          // Handle error returned from cloud function (e.g. collection not found)
          const errorMsg = res.result && res.result.error ? JSON.stringify(res.result.error) : '数据格式错误';
          console.error('Rank result error:', res.result);
          
          wx.showModal({ 
            title: '获取排行榜失败', 
            content: '请确保数据库集合 "merits" 已创建。\n详细错误: ' + errorMsg,
            showCancel: false
          });
        }
      },
      fail: err => {
        console.error('Rank cloud function failed:', err);
        wx.hideLoading();
        wx.showModal({
          title: '加载失败',
          content: err.errMsg || '网络或云函数错误',
          showCancel: false
        });
      }
    });
  },

  hideRank: function() {
    this.setData({ showRankModal: false });
  },

  editNickname: function() {
    this.setData({ 
      showNicknameModal: true,
      tempNickname: this.data.myRank.nickname || ''
    });
  },

  hideNicknameModal: function() {
    this.setData({ showNicknameModal: false });
  },

  onNicknameInput: function(e) {
    this.setData({ tempNickname: e.detail.value });
  },

  updateNickname: function() {
    const newName = this.data.tempNickname.trim();
    if (!newName) {
      wx.showToast({ title: '法号不能为空', icon: 'none' });
      return;
    }
    
    wx.showLoading({ title: '更新中' });
    wx.cloud.callFunction({
      name: 'merit',
      data: { 
        type: 'update_nickname',
        nickname: newName
      },
      success: res => {
        wx.hideLoading();
        if (res.result.success) {
          this.setData({ 
            'myRank.nickname': newName,
            showNicknameModal: false 
          });
          wx.showToast({ title: '修改成功' });
          // Refresh rank list to show new name
          this.showRank();
        } else {
          wx.showToast({ title: '修改失败', icon: 'none' });
        }
      },
      fail: err => {
        wx.hideLoading();
        wx.showToast({ title: '网络错误', icon: 'none' });
      }
    });
  }
});
