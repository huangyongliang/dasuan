// cloudfunctions/admin/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action, noteId, status } = event

  // 管理员鉴权：从数据库 'admins' 集合查询当前 openid 是否存在
  // 注意：需要提前在云数据库中创建 'admins' 集合，并添加管理员记录 { "openid": "YOUR_OPENID" }
  const adminRecord = await db.collection('admins')
    .where({
      openid: wxContext.OPENID
    })
    .count()

  const isAdmin = adminRecord.total > 0

  if (!isAdmin) {
    return { code: 403, msg: 'Permission denied: Not an admin', isAdmin: false }
  }

  if (action === 'checkAdmin') {
    return { code: 200, isAdmin: true }
  }

  return {
    code: 400,
    msg: 'Unknown action'
  }
}
