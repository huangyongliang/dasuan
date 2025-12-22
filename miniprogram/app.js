// app.js
App({
  onLaunch: function () {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        // env 参数说明：
        //   env 参数决定接下来小程序 API 调用的云开发环境
        //   traceUser: true,
        traceUser: true,
      });
    }

    this.globalData = {
      isAdmin: false, // 将在 profile 页面进行逻辑判断
      openid: null
    };

    // 获取 OpenID
    wx.cloud.callFunction({
      name: 'login',
      success: res => {
        this.globalData.openid = res.result.openid;
        if (this.openidCallback) {
          this.openidCallback(res.result.openid);
        }
      },
      fail: err => {
        console.error('登录失败', err);
      }
    });
  }
});
