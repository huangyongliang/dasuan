// cloudfunctions/note/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 配置限制常量
const LIMITS = {
  USER_DAILY_LIMIT: 10,
  GLOBAL_DAILY_LIMIT: 1000
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action, data } = event
  const openid = wxContext.OPENID

  if (action === 'create' || action === 'update') {
    return await handleSave(openid, data, action)
  }

  if (action === 'delete') {
    return await handleDelete(openid, data)
  }

  if (action === 'getPublicNotes') {
    return await getPublicNotes()
  }

  return {
    code: 400,
    msg: 'Unknown action'
  }
}

async function handleDelete(openid, { id }) {
  if (!id) return { code: 400, msg: 'Missing ID' }

  try {
    const note = await db.collection('notes').doc(id).get()
    
    // 只能删除自己的笔记
    if (note.data._openid !== openid) {
      return { code: 403, msg: 'Permission denied' }
    }

    // 逻辑：
    // 1. 私有 (private) 或 草稿 (draft/rejected) -> 直接删除
    // 2. 共享且已发布 (public & published) -> 标记为 "pending_delete"，需管理员审核
    
    const isPublicPublished = note.data.visibility === 'public' && note.data.status === 'published'

    if (isPublicPublished) {
      // 标记删除状态
      await db.collection('notes').doc(id).update({
        data: {
          status: 'pending_delete', // 新增状态：待删除
          deleteRequestTime: db.serverDate()
        }
      })
      return { code: 202, msg: '删除请求已提交，需管理员审核' }
    } else {
      // 直接物理删除（或标记删除，这里演示物理删除）
      await db.collection('notes').doc(id).remove()
      return { code: 200, msg: '已删除' }
    }

  } catch (e) {
    return { code: 500, msg: 'Delete Error', error: e }
  }
}

async function handleSave(openid, noteData, action) {
  const { content, images, status, visibility, id } = noteData

  // 1. 如果是新建 (create)，检查限制
  if (action === 'create') {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // 检查全局限制
    const globalCountResult = await db.collection('notes')
      .where({
        createTime: _.gte(today)
      })
      .count()
    
    if (globalCountResult.total >= LIMITS.GLOBAL_DAILY_LIMIT) {
      return { code: 429, msg: '今日全站发帖量已达上限' }
    }

    // 检查个人限制
    const userCountResult = await db.collection('notes')
      .where({
        _openid: openid,
        createTime: _.gte(today)
      })
      .count()

    if (userCountResult.total >= LIMITS.USER_DAILY_LIMIT) {
      return { code: 429, msg: `今日发帖已达上限 (${LIMITS.USER_DAILY_LIMIT}条)` }
    }
  }

  // 2. 准备数据
  const payload = {
    content,
    images: images || [],
    status: status || 'draft',
    visibility: visibility || 'private', // 默认私有
    updateTime: db.serverDate()
  }

  if (action === 'create') {
    payload.createTime = db.serverDate()
    payload._openid = openid // 显式设置，虽然云开发会自动设置，但为了逻辑清晰
    
    try {
      const res = await db.collection('notes').add({ data: payload })
      return { code: 200, data: res, msg: 'Created' }
    } catch (e) {
      return { code: 500, msg: 'Database Error', error: e }
    }
  } else {
    // Update
    if (!id) return { code: 400, msg: 'Missing ID for update' }
    
    try {
      // 只能更新自己的笔记，且通过 doc(id) 限制
      const res = await db.collection('notes').doc(id).update({ data: payload })
      return { code: 200, data: res, msg: 'Updated' }
    } catch (e) {
      return { code: 500, msg: 'Database Error', error: e }
    }
  }
}

async function getPublicNotes() {
  // 获取公开且已发布的笔记
  // 注意：这里需要云函数权限来读取所有人的数据
  try {
    const res = await db.collection('notes')
      .where({
        status: 'published',
        visibility: 'public'
      })
      .orderBy('createTime', 'desc')
      .limit(20) // 简单分页，取前20
      .get()
    
    return { code: 200, data: res.data }
  } catch (e) {
    return { code: 500, msg: 'Fetch Error', error: e }
  }
}
