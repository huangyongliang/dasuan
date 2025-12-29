Component({
  data: {
    selected: 0,
    color: "#666666",
    selectedColor: "#07c160",
    list: [{
      pagePath: "/pages/index/index",
      iconPath: "/images/note.png",
      selectedIconPath: "/images/note-active.png",
      text: "天气"
    }, {
      pagePath: "/pages/merit/merit",
      iconPath: "/images/merit.png",
      selectedIconPath: "/images/merit-active.png",
      text: "功德"
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