// pages/index/index.js
const app = getApp()

Page({
  data: {
    notes: [],
    loading: true,
    currentTab: 'my', // 'my' | 'square' | 'shout'
    chatList: [],
    chatInput: '',
    scrollIntoView: '',
    joinTime: 0
  },

  watcher: null,

  onLoad: function() {
    this.setData({ joinTime: new Date().getTime() });
    
    // 确保获取到 openid 后再启动监听（如果需要）
    const app = getApp();
    if (app.globalData.openid) {
      // 已有 openid
    } else {
      // 等待回调
      app.openidCallback = (openid) => {
        // 可以在这里做些什么，但目前 watcher 逻辑不强依赖 openid 的实时性（只用于过滤自己）
      }
    }
  },

  onShow: function() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 0
      })
    }
    // 如果当前是 shout tab，确保 watcher 开启
    if (this.data.currentTab === 'shout' && !this.watcher) {
      this.initWatcher();
    } else if (this.data.currentTab !== 'shout') {
      this.refreshList();
    }
  },

  onHide: function() {
    this.closeWatcher();
  },

  onUnload: function() {
    this.closeWatcher();
  },

  onPullDownRefresh: function() {
    if (this.data.currentTab === 'shout') {
      wx.stopPullDownRefresh();
      return;
    }
    this.refreshList(() => {
      wx.stopPullDownRefresh();
    });
  },

  switchTab: function(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.currentTab) return;
    
    this.setData({ 
      currentTab: tab,
    });

    if (tab === 'shout') {
      this.initWatcher();
    } else {
      this.closeWatcher();
      this.setData({ notes: [], loading: true }, () => {
         this.refreshList();
      });
    }
  },

  // ... (refreshList, getMyNotes, getSquareNotes logic remains same)

  initWatcher: function() {
    if (this.watcher) return;
    
    const db = wx.cloud.database();
    
    // 监听 chat_messages 集合
    // 简化监听逻辑：去掉 orderBy 和 limit，避免因索引或权限问题导致监听失败
    // 只要是新产生的 docChanges，就是新消息
    console.log('Start watching chat_messages...');
    this.watcher = db.collection('chat_messages')
      .watch({
        onChange: snapshot => {
          console.log('Watch onChange:', snapshot);
          if (snapshot.type === 'init') return;

          const newMsgs = [];
          
          if (snapshot.docChanges && Array.isArray(snapshot.docChanges)) {
             snapshot.docChanges.forEach(change => {
                if (change.dataType === 'add') {
                   const doc = change.doc;
                   console.log('New message received:', doc);
                   
                   // 过滤掉自己发的消息
                   if (doc._openid === getApp().globalData.openid) {
                     console.log('Ignored own message');
                     return;
                   }

                   let msgTime = 0;
                   if (doc.createTime instanceof Date) msgTime = doc.createTime.getTime();
                   
                   doc.isMy = false;
                   newMsgs.unshift(doc);
                }
             });
          }

          if (newMsgs.length > 0) {
             console.log('Updating UI with new messages:', newMsgs);
             const list = this.data.chatList.concat(newMsgs.reverse()); 
             this.setData({
               chatList: list,
               scrollIntoView: 'scroll-bottom'
             }, () => {
               this.setData({ scrollIntoView: 'scroll-bottom' });
             });
          }
        },
        onError: err => {
          console.error('Watch error', err);
        }
      });
  },

  closeWatcher: function() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  },

  onChatInput: function(e) {
    this.setData({ chatInput: e.detail.value });
  },

  sendChat: function() {
    const content = this.data.chatInput.trim();
    if (!content) return;

    // 1. 立即上屏 (依靠页面缓存记录)
    const myMsg = {
      _id: 'local_' + Date.now(), // 临时 ID
      content: content,
      nickName: '大蒜',
      isMy: true,
      createTime: new Date().toLocaleString() // 本地时间
    };

    console.log('Adding message to list:', myMsg);
    
    // 使用 concat 创建新数组
    const newList = this.data.chatList.concat([myMsg]);
    
    this.setData({ 
      chatList: newList,
      chatInput: '',
      scrollIntoView: 'scroll-bottom' // 触发滚动
    }, () => {
      console.log('setData complete, chatList length:', this.data.chatList.length);
      // 强制刷新一下 scroll-into-view，防止相同值不触发
      this.setData({ scrollIntoView: 'scroll-bottom' })
    });

    // 2. 默默发送给其他人 (仅作为传输通道)
    wx.cloud.callFunction({
      name: 'shout',
      data: {
        content: content
      },
      success: res => {
        // 发送成功，不做处理
        console.log('Shout success');
      },
      fail: err => {
        console.error('广播失败', err);
        // 既然只是大喊，失败了也无所谓，就不提示用户扫兴了
      }
    });
  },

  refreshList: function(cb) {
    if (this.data.currentTab === 'my') {
      this.getMyNotes(cb);
    } else if (this.data.currentTab === 'square') {
      this.getSquareNotes(cb);
    } else {
      if(cb) cb();
    }
  },

  getMyNotes: function(cb) {
    const db = wx.cloud.database();
    const _ = db.command;
    // 获取自己的笔记 (排除 type='shout' 的聊天记录)
    db.collection('notes')
      .where({
        type: _.neq('shout')
      })
      .orderBy('createTime', 'desc')
      .get({
        success: res => {
          const notes = res.data.map(item => {
            if (item.createTime && item.createTime instanceof Date) {
              item.createTime = item.createTime.toLocaleString();
            }
            return item;
          });
          this.setData({
            notes: notes,
            loading: false
          });
          if (cb) cb();
        },
        fail: err => {
          console.error('查询失败', err);
          this.setData({ loading: false });
          if (cb) cb();
        }
      });
  },

  getSquareNotes: function(cb) {
    // 调用云函数获取公开笔记
    wx.cloud.callFunction({
      name: 'note',
      data: {
        action: 'getPublicNotes'
      },
      success: res => {
        if (res.result && res.result.code === 200) {
          // 云函数返回的时间可能是字符串或对象，取决于云开发SDK版本，这里做个兼容处理
          const notes = res.result.data.map(item => {
             // 如果是字符串ISO格式，转为本地时间字符串
             if (typeof item.createTime === 'string') {
                item.createTime = new Date(item.createTime).toLocaleString();
             }
             return item;
          });
          this.setData({
            notes: notes,
            loading: false
          });
        } else {
          this.setData({ loading: false });
        }
        if (cb) cb();
      },
      fail: err => {
        console.error('获取广场失败', err);
        this.setData({ loading: false });
        if (cb) cb();
      }
    });
  },

  gotoDetail: function(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '../detail/detail?id=' + id,
    });
  },

  // Deprecated: use gotoDetail
  gotoEdit: function(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '../editor/editor?id=' + id,
    });
  }
});
