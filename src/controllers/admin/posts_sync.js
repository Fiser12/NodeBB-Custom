// File: src/controllers/admin/posts_sync.js

'use strict';

const topics = require.main.require('./src/topics');
const posts = require.main.require('./src/posts');

const postsSyncController = module.exports;

postsSyncController.sync = async (req, res) => {
  try {
    const { items, _uid } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Expected an array of items in `items` field.' });
    }

    // The user ID who creates the topics (bot, admin, etc.)
    const results = [];
    console.log('[postsSyncController.sync] starting sync');

    const promises = items.map(async (item) => {
      let { id, tid, title, content, cid } = item;

      // 1) If a tid is provided, confirm it still exists in NodeBB
      let topicExists = false;
      if (tid) {
        const existingTid = await topics.getTopicField(tid, 'tid');
        if (existingTid) {
          topicExists = true;
        } else {
          console.warn(`[postsSyncController.sync] The provided tid=${tid} does NOT exist. A new topic will be created.`);
        }
      }
      // 2) Create a new topic if no tid was provided OR the tid doesn't exist
      if (!tid || !topicExists) {
        const result = await topics.post({
          uid: _uid,
          title,
          content,
          cid
        });
        tid = result?.topicData?.tid;
      }
      if (!tid) {
        console.error('[postsSyncController.sync] Error creating topic:');
        return;
      }
      
      // 3) Store the Payload doc ID on the topic as metadata (optional)
      id && await topics.setTopicField(tid, 'payloadDocId', id);

      // 4) Retrieve the last 20 posts
      const lastPosts = await getLastNPostsFromTopic(tid, 20, 0);

      // 5) Accumulate the results to send back to Payload
      results.push({
        itemId: id,
        tid,
        lastPosts,
      });
    })

    await Promise.all(promises);
    console.log('[postsSyncController.sync] sync complete');
    return res.json(results);
  } catch (error) {
    console.error('[postsSyncController.sync] error:', error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Fetch the last `n` posts from a given topic
 */
async function getLastNPostsFromTopic(tid, n = 20, uid = 0) {
  // 1) Get total post count
  const postCount = await topics.getTopicField(tid, 'postcount');
  if (!postCount || postCount <= 1) {
    // If there's no postcount, the topic might not exist or has 0 posts
    return [];
  }
  
  // 2) Calculate the window for the last N posts
  const start = Math.max(1, postCount - n);
  const stop = postCount - 1;
  const topicData = await topics.getTopicData(tid);
  const postsData = await topics.getTopicPosts(topicData, `tid:${tid}:posts`, start, stop, uid, false);

  // 3) Query for that slice
  if (!Array.isArray(postsData)) {
    return [];
  }

  // 4) Map to a simpler format
  return postsData.map(post => ({
    pid: post.pid,
    content: post.content,
    timestamp: post.timestamp,
    userName: post.user?.username || 'Guest',
  }));
}
