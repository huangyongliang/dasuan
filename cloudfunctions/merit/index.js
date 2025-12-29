// cloudfunctions/merit/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const meritsCollection = db.collection('merits')

exports.main = async (event, context) => {
  const { type } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  // Initialize user merit record if not exists
  if (type === 'init') {
    try {
      const res = await meritsCollection.where({
        _openid: openid
      }).get()

      if (res.data.length === 0) {
        await meritsCollection.add({
          data: {
            _openid: openid,
            count: 0,
            nickname: '神秘人', // Default nickname
            updated_at: db.serverDate()
          }
        })
        return { count: 0, nickname: '神秘人' }
      }
      return { count: res.data[0].count, nickname: res.data[0].nickname || '神秘人' }
    } catch (e) {
      return { error: e }
    }
  }

  // Update nickname
  if (type === 'update_nickname') {
    try {
      const { nickname } = event
      if (!nickname) return { success: false, error: 'Nickname required' }
      
      await meritsCollection.where({
        _openid: openid
      }).update({
        data: {
          nickname: nickname,
          updated_at: db.serverDate()
        }
      })
      return { success: true }
    } catch (e) {
      return { error: e }
    }
  }

  // Add merit (supports increment)
  if (type === 'add') {
    const increment = event.increment || 1
    try {
      await meritsCollection.where({
        _openid: openid
      }).update({
        data: {
          count: _.inc(increment),
          updated_at: db.serverDate()
        }
      })
      return { success: true }
    } catch (e) {
      // If update fails (maybe record doesn't exist yet due to race condition), try create
      try {
        await meritsCollection.add({
          data: {
            _openid: openid,
            count: increment,
            nickname: '神秘人',
            updated_at: db.serverDate()
          }
        })
        return { success: true }
      } catch (err) {
        return { success: false, error: err }
      }
    }
  }

  // Get rank
  if (type === 'rank') {
    try {
      // Top 10
      const top10 = await meritsCollection
        .orderBy('count', 'desc')
        .limit(10)
        .get()
      
      // My rank and count
      const myMeritRes = await meritsCollection.where({
        _openid: openid
      }).get()
      
      let myMerit = { count: 0, rank: '未上榜' }
      if (myMeritRes.data.length > 0) {
        const count = myMeritRes.data[0].count
        myMerit.count = count
        
        // Count how many people have more merits than me
        const rankRes = await meritsCollection.where({
          count: _.gt(count)
        }).count()
        myMerit.rank = rankRes.total + 1
      }

      return {
        top10: top10.data,
        myMerit: myMerit
      }
    } catch (e) {
      return { error: e }
    }
  }
}