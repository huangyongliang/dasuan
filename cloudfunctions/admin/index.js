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

  // 简单的管理员鉴权：实际项目中应检查 openid 是否在管理员列表中
  // const ADMIN_IDS = ['YOUR_ADMIN_OPENID'];
  // if (!ADMIN_IDS.includes(wxContext.OPENID)) {
  //   return { code: 403, msg: 'Permission denied' }
  // }

  if (action === 'getPending') {
    return await db.collection('notes')
      .where({
        status: 'pending'
      })
      .orderBy('createTime', 'desc')
      .get()
  }

  if (action === 'audit') {
    if (!noteId || !status) return { code: 400, msg: 'Missing params' }
    
    return await db.collection('notes').doc(noteId).update({
      data: {
        status: status,
        auditTime: db.serverDate(),
        auditor: wxContext.OPENID
      }
    })
  }

  return {
    code: 400,
    msg: 'Unknown action'
  }
}
