// pages/index/index.js
const app = getApp()
const lunar = require('../../utils/lunar.js')

Page({
  data: {
    weather: null,
    forecast: [],
    currentCity: {
      name: '深圳',
      latitude: 22.5431,
      longitude: 114.0579
    },
    cities: [
      { name: '深圳', latitude: 22.5431, longitude: 114.0579 },
      { name: '北京', latitude: 39.9042, longitude: 116.4074 },
      { name: '上海', latitude: 31.2304, longitude: 121.4737 },
      { name: '广州', latitude: 23.1291, longitude: 113.2644 },
      { name: '成都', latitude: 30.5728, longitude: 104.0668 },
      { name: '杭州', latitude: 30.2741, longitude: 120.1551 },
      { name: '武汉', latitude: 30.5928, longitude: 114.3055 },
      { name: '天门', latitude: 30.6667, longitude: 113.1667 },
      { name: '西安', latitude: 34.3416, longitude: 108.9398 },
      { name: '南京', latitude: 32.0603, longitude: 118.7969 }
    ]
  },

  onLoad: function() {
    this.updateDate();
    this.getWeather();
  },

  updateDate: function() {
    const now = new Date();
    const weeks = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const weekStr = weeks[now.getDay()];
    const shortDate = `${now.getMonth() + 1}月${now.getDate()}日`;
    
    // Lunar date
    let lunarStr = '';
    try {
      if (lunar && typeof lunar.solar2lunar === 'function') {
        const lunarData = lunar.solar2lunar(now.getFullYear(), now.getMonth() + 1, now.getDate());
        if (lunarData) {
          lunarStr = `农历 ${lunarData.gzYear}年(${lunarData.Animal}) ${lunarData.IMonthCn}${lunarData.IDayCn}`;
        }
      }
    } catch (e) {
      console.error('Lunar calculation error:', e);
    }

    this.setData({
      dateInfo: {
        date: `${shortDate} ${weekStr}`,
        lunar: lunarStr
      }
    });
  },

  showCityPicker: function() {
    // Find current city index
    const index = this.data.cities.findIndex(c => c.name === this.data.currentCity.name);
    this.setData({
      showCityPicker: true,
      tempCityIndex: index >= 0 ? index : 0
    });
  },

  hideCityPicker: function() {
    this.setData({
      showCityPicker: false
    });
  },

  onPickerChange: function(e) {
    this.setData({
      tempCityIndex: e.detail.value[0]
    });
  },

  confirmCity: function() {
    const selectedCity = this.data.cities[this.data.tempCityIndex];
    this.setData({
      currentCity: selectedCity,
      showCityPicker: false,
      weather: null, 
      forecast: []
    }, () => {
      this.getWeather();
    });
  },

  onShow: function() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 0
      })
    }
  },

  onPullDownRefresh: function() {
    this.getWeather();
    wx.stopPullDownRefresh();
  },

  getWeather: function() {
    const { latitude, longitude } = this.data.currentCity;
    wx.request({
      url: `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=Asia%2FShanghai`,
      success: (res) => {
        if (res.statusCode === 200 && res.data) {
          const current = res.data.current_weather;
          const daily = res.data.daily;
          
          const weatherMap = {
            0: '晴朗', 1: '晴间多云', 2: '多云', 3: '阴',
            45: '雾', 48: '白霜',
            51: '小毛毛雨', 53: '中毛毛雨', 55: '大毛毛雨',
            61: '小雨', 63: '中雨', 65: '大雨',
            80: '小阵雨', 81: '中阵雨', 82: '大阵雨',
            95: '雷雨', 96: '雷雨伴冰雹', 99: '重度雷雨伴冰雹'
          };

          // Format daily forecast
          const forecast = daily.time.map((dateStr, index) => {
             const d = new Date(dateStr);
             const month = d.getMonth() + 1;
             const date = d.getDate();
             const weeks = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
             const weekStr = weeks[d.getDay()];

            return {
              date: `${month}/${date}`,
              week: weekStr,
              max: Math.round(daily.temperature_2m_max[index]),
              min: Math.round(daily.temperature_2m_min[index]),
              code: daily.weathercode[index],
              desc: weatherMap[daily.weathercode[index]] || '未知'
            };
          });

          const currentDesc = weatherMap[current.weathercode] || '未知';

          // Construct weather object manually to avoid object spread operator (...)
          // which causes babel helper errors in some environments
          const weatherData = {
            temperature: current.temperature,
            windspeed: current.windspeed,
            winddirection: current.winddirection,
            weathercode: current.weathercode,
            time: current.time,
            desc: currentDesc
          };

          this.setData({
            weather: weatherData,
            forecast: forecast
          });
        }
      },
      fail: (err) => {
        console.error('Weather fetch failed', err);
        // Show error toast if it's likely a domain issue
        if (err.errMsg && (err.errMsg.indexOf('domain') !== -1 || err.errMsg.indexOf('fail') !== -1)) {
          wx.showToast({
            title: '请求失败，请检查网络或配置',
            icon: 'none',
            duration: 3000
          });
        }
        
        // Stop loading state
        this.setData({
          weather: {
            temperature: '--',
            windspeed: '--',
            desc: '数据获取失败'
          }
        });
      }
    });
  }
});
