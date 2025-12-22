Component({
  data: {
    selected: 0,
    color: "#666666",
    selectedColor: "#07c160",
    list: [{
      pagePath: "/pages/index/index",
      iconPath: "/images/note.png",
      selectedIconPath: "/images/note-active.png",
      text: "笔记"
    }, {
      pagePath: "/pages/editor/editor",
      iconPath: "/images/add.png",
      selectedIconPath: "/images/add-active.png",
      text: "新建"
    }, {
      pagePath: "/pages/profile/profile",
      iconPath: "/images/profile.png",
      selectedIconPath: "/images/profile-active.png",
      text: "我的"
    }]
  },
  methods: {
    switchTab(e) {
      const data = e.currentTarget.dataset
      const url = data.path
      wx.switchTab({url})
    }
  }
})