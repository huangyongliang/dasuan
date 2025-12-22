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

  // 管理员鉴权：只有特定 openid 才能执行
  // 这里的 openid 是之前您报错信息中提供的 'o6zAJs9ZC98oUo-1vrL1JF08FDcE'
  const ADMIN_IDS = ['o6zAJs9ZC98oUo-1vrL1JF08FDcE']; 
  
  if (!ADMIN_IDS.includes(wxContext.OPENID)) {
    return { code: 403, msg: 'Permission denied: Not an admin', isAdmin: false }
  }

  if (action === 'checkAdmin') {
    return { code: 200, isAdmin: true }
  }

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
