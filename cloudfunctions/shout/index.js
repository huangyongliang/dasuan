// cloudfunctions/shout/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { content } = event
  const wxContext = cloud.getWXContext()

  try {
    // 1. 发送新消息 (使用独立的 chat_messages 集合)
    await db.collection('chat_messages').add({
      data: {
        content: content,
        createTime: db.serverDate(),
        nickName: '大蒜',
        _openid: wxContext.OPENID
      }
    })

    // 2. 顺手清理旧消息
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
    
    try {
      await db.collection('chat_messages')
        .where({
          createTime: _.lt(tenMinutesAgo)
        })
        .remove()
    } catch (err) {
      console.error('Cleanup failed', err)
    }

    return {
      code: 200,
      msg: 'Shouted'
    }
  } catch (e) {
    return {
      code: 500,
      msg: 'Failed',
      error: e
    }
  }
}
