// File: src/controllers/admin/posts_sync.js

'use strict';

const getYoutubeVideosController = module.exports;
const nconf = require('nconf');

getYoutubeVideosController.get = async (req, res) => {
  try {
    const { id: playlistId } = req.params;
    if (!playlistId) {
      return res.status(400).json({ error: 'Expected a playlistId in the request body.' });
    }

    
    return res.json(await getYoutubeVideos(playlistId));
  } catch (error) {
    console.error('[postsSyncController.sync] error:', error);
    return res.status(500).json({ error: error.message });
  }
};


const mapApiYoutubeVideoToModel = (video) => {
  const snippet = video.snippet
  const thumbnailUrl =
    snippet.thumbnails.maxres?.url ??
    snippet.thumbnails.standard?.url ??
    snippet.thumbnails.high?.url ??
    snippet.thumbnails.medium?.url ??
    snippet.thumbnails.default?.url
  const id = snippet.resourceId?.videoId ?? video.id

  return {
    id,
    title: snippet.title,
    publishedAt: snippet.publishedAt,
    tags: snippet.tags || [],
    viewCount: video?.statistics?.viewCount ?? -1,
    thumbnailUrl: thumbnailUrl,
    duration: video?.contentDetails?.duration ?? "-1"
  }
}

const getId = (video) => {
  const snippet = video.snippet
  return snippet?.resourceId?.videoId ?? video.id
}

const getYoutubeVideosByPage = async (
  playlistId = 'PLggf90VSN9KOwkevFKymkO4tsS2LeZl6O',
  pageToken = null,
) => {
  const apiKey = nconf.get('youtubeAPIKey')
  if (!apiKey) {
    throw new Error('No API Key found in environment variables.')
  }

  const apiUrl = `https://www.googleapis.com/youtube/v3/playlistItems?key=${apiKey}&playlistId=${playlistId}${pageToken ? `&pageToken=${pageToken}` : ''}&maxResults=50&part=snippet`

  const response = await fetch(apiUrl)
  if (!response.ok) {
    throw new Error(`Error fetching YouTube videos: ${response.statusText}`)
  }
  const data = await response.json()
  const ids = data.items.map(getId).join(',')
  const apiUrlVideos = `https://www.googleapis.com/youtube/v3/videos?key=${apiKey}&id=${ids}&maxResults=50&part=snippet,statistics,contentDetails`

  const response2 = await fetch(apiUrlVideos)
  if (!response2.ok) {
    throw new Error(`Error fetching YouTube videos: ${response.statusText}`)
  }
  const data2 = await response2.json()

  return {
    nextPageToken: data.nextPageToken || null,
    videos: data2.items.map(mapApiYoutubeVideoToModel),
  }
}

const getYoutubeVideos = async (playlistId) => {
  try {
    let nextPageToken = null
    let allVideos = []

    do {
      const { nextPageToken: newPageToken, videos } = await getYoutubeVideosByPage(
        playlistId,
        nextPageToken,
      )
      allVideos = [...allVideos, ...videos]
      nextPageToken = newPageToken
    } while (nextPageToken)

    return allVideos
  } catch (error) {
    throw error
  }
}

