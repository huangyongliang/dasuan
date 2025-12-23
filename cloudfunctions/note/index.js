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

  if (action === 'getDetail') {
    return await getNoteDetail(openid, data)
  }

  // --- Comment Actions ---
  if (action === 'addComment') {
    return await addComment(openid, data)
  }
  if (action === 'getComments') {
    return await getComments(openid, data)
  }
  if (action === 'deleteComment') {
    return await deleteComment(openid, data)
  }

  return {
    code: 400,
    msg: 'Unknown action'
  }
}

// --- Comment Functions ---

async function checkIsAdmin(openid) {
  const count = await db.collection('admins').where({ openid }).count()
  return count.total > 0
}

async function addComment(openid, { noteId, content }) {
  if (!noteId || !content) return { code: 400, msg: 'Missing params' }
  
  try {
    const res = await db.collection('comments').add({
      data: {
        noteId,
        content,
        createTime: db.serverDate(),
        _openid: openid
      }
    })
    return { code: 200, data: res, msg: 'Comment added' }
  } catch (e) {
    return { code: 500, msg: 'Error adding comment', error: e }
  }
}

async function getComments(openid, { noteId }) {
  if (!noteId) return { code: 400, msg: 'Missing noteId' }

  try {
    const res = await db.collection('comments')
      .where({ noteId })
      .orderBy('createTime', 'asc') // 评论按时间正序
      .get()
    
    const isAdmin = await checkIsAdmin(openid)

    return { 
      code: 200, 
      data: res.data, 
      isAdmin: isAdmin, // 返回管理员身份，用于前端显示删除按钮
      currentOpenId: openid // 返回当前用户ID，用于判断自己评论
    }
  } catch (e) {
    return { code: 500, msg: 'Error fetching comments', error: e }
  }
}

async function deleteComment(openid, { commentId }) {
  if (!commentId) return { code: 400, msg: 'Missing commentId' }

  try {
    const commentRes = await db.collection('comments').doc(commentId).get()
    const comment = commentRes.data
    const isAdmin = await checkIsAdmin(openid)

    // 允许删除的条件：是自己的评论 OR 是管理员
    if (comment._openid === openid || isAdmin) {
      await db.collection('comments').doc(commentId).remove()
      return { code: 200, msg: 'Comment deleted' }
    } else {
      return { code: 403, msg: 'Permission denied' }
    }
  } catch (e) {
    return { code: 500, msg: 'Error deleting comment', error: e }
  }
}

async function getNoteDetail(openid, { id }) {
  if (!id) return { code: 400, msg: 'Missing ID' }

  try {
    const res = await db.collection('notes').doc(id).get()
    const note = res.data

    // 权限检查：
    // 1. 自己的笔记 -> 允许
    // 2. 公开且已发布的笔记 -> 允许
    const isOwner = note._openid === openid
    const isPublicPublished = note.visibility === 'public' && note.status === 'published'

    if (isOwner || isPublicPublished) {
      return { code: 200, data: note, isOwner: isOwner }
    } else {
      return { code: 403, msg: 'Permission denied: Private note' }
    }
  } catch (e) {
    return { code: 500, msg: 'Fetch Error', error: e }
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
      // 直接物理删除
      await db.collection('notes').doc(id).remove()
      
      // 级联删除：删除该笔记下的所有评论
      try {
        await db.collection('comments').where({ noteId: id }).remove()
      } catch (e) {
        console.error('Failed to delete associated comments', e)
        // 不阻断主流程
      }

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
