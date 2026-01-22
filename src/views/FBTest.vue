<script setup>
import { ref, onMounted } from 'vue';
import { Facebook, RefreshCw, Calendar, ThumbsUp, MessageCircle, Share2, Image as ImageIcon, Link as LinkIcon } from 'lucide-vue-next';

const userInfo = ref(null);
const latestPost = ref(null);
const topPosts = ref([]);
const loading = ref(false);
const loadingPost = ref(false);
const error = ref(null);

// Facebook Access Token
const accessToken = 'EAALO2Dx7D0IBQYZBpr9VWEKHO4QYkBEUjsqs2ZABRNZATLgH5CzZCevp9MaqCqYOLZAoD8cGsCty3FKLmt0JKxaXaB6U9ZC8G0PNCNeHeRxqxeZArv3UHuluoHl0O5wfbavWqzWQZCqRhVUc0JUPp6FR8n7I456GBe4TynQEpaEb1oba4tZB3IWI8phbZAVw59xToYVJ1Jee8Tsm5PMTkibMMb6hnKZAhMNii2l5AYNnwpIAAFZAFJbDwr4dFr5RFaj2PB8o2GVst7UqNsHPBv3ZASl6ouWHe6RZAL56WVIaymYjrKjYnTlJt9B04YqjZAJvASpGJMu6C8ZD';

// Graph API version
const API_VERSION = 'v19.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

// Fetch user info from /me endpoint
const fetchUserInfo = async () => {
  loading.value = true;
  error.value = null;
  
  try {
    // Request common fields available on /me endpoint
    const fields = 'id,name,email,picture{url,width,height,is_silhouette},link,first_name,last_name,middle_name,age_range,gender,locale,timezone,verified';
    const meUrl = `${BASE_URL}/me?fields=${fields}&access_token=${accessToken}`;
    
    const response = await fetch(meUrl);
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message || 'Failed to fetch user info');
    }
    
    userInfo.value = data;
  } catch (err) {
    console.error('Error fetching user info:', err);
    error.value = err.message || 'Failed to fetch user info.';
    userInfo.value = null;
  } finally {
    loading.value = false;
  }
};

// Fetch top 10 public posts - try /me/posts first, then try pages
const fetchLatestPost = async () => {
  loadingPost.value = true;
  error.value = null;
  
  try {
    // Fields including image fields and privacy
    let postFields = 'id,message,created_time,from{name,id},type,permalink_url,full_picture,picture,privacy';
    
    // Try user posts first - get more posts to filter for public ones
    let postsUrl = `${BASE_URL}/me/posts?fields=${postFields}&limit=50&access_token=${accessToken}`;
    let response = await fetch(postsUrl);
    let data = await response.json();
    
    // If user posts fails, try pages
    if (data.error) {
      console.warn('User posts failed, trying pages:', data.error);
      
      // Get user's pages
      const accountsUrl = `${BASE_URL}/me/accounts?fields=id,name&access_token=${accessToken}`;
      const accountsResponse = await fetch(accountsUrl);
      const accountsData = await accountsResponse.json();
      
      if (!accountsData.error && accountsData.data?.length > 0) {
        // Try first page - get more posts to filter for public ones
        const pageId = accountsData.data[0].id;
        postsUrl = `${BASE_URL}/${pageId}/posts?fields=${postFields}&limit=50&access_token=${accessToken}`;
        response = await fetch(postsUrl);
        data = await response.json();
        
        if (data.error) {
          throw new Error(`Cannot fetch posts. ${data.error.message || 'You may need pages_read_engagement permission for page posts.'}`);
        }
      } else {
        // Check if it's a permission error
        if (data.error.code === 200 || data.error.type === 'OAuthException') {
          throw new Error(`Permission denied: ${data.error.message}. The 'user_posts' permission may require App Review or may not be available for your app type. Try using a Page Token instead.`);
        }
        throw new Error(data.error.message || 'Failed to fetch posts');
      }
    }
    
    if (data.data && data.data.length > 0) {
      // Debug: log what we got
      console.log('Available posts sample:', data.data.slice(0, 5).map(p => ({
        id: p.id,
        hasMessage: !!p.message,
        messageLength: p.message?.length || 0,
        hasImage: !!(p.full_picture || p.picture),
        type: p.type,
        privacy: p.privacy
      })));
      
      // Filter for posts with images first, then prioritize those with captions
      let filteredPosts = data.data.filter(post => {
        // Must have an image
        return post.full_picture || post.picture || post.type === 'photo';
      });
      
      // If no posts with images, use all posts
      if (filteredPosts.length === 0) {
        filteredPosts = data.data;
      }
      
      // Sort: posts with captions first, then by date
      filteredPosts.sort((a, b) => {
        const aHasCaption = a.message && a.message.trim() !== '';
        const bHasCaption = b.message && b.message.trim() !== '';
        
        if (aHasCaption && !bHasCaption) return -1;
        if (!aHasCaption && bHasCaption) return 1;
        
        // Both have or don't have captions, sort by date (newest first)
        return new Date(b.created_time) - new Date(a.created_time);
      });
      
      // Take top 10 posts (prioritizing those with images and captions)
      const topPostsList = filteredPosts.slice(0, 10);
      
      if (topPostsList.length === 0) {
        latestPost.value = null;
        topPosts.value = [];
        throw new Error(`No posts found. Found ${data.data.length} total posts.`);
      }
      
      // Store top posts
      topPosts.value = topPostsList;
      
      // Set latest post to first post (prefer one with both image and caption)
      const postWithBoth = topPostsList.find(post => 
        (post.full_picture || post.picture) && post.message && post.message.trim() !== ''
      );
      
      const postWithImage = topPostsList.find(post => 
        post.full_picture || post.picture || post.type === 'photo'
      );
      
      const post = postWithBoth || postWithImage || topPostsList[0];
      
      // Try to fetch additional fields if available (with error handling)
      try {
        const extendedFields = 'shares,attachments{media,type,subattachments}';
        const extendedUrl = `${BASE_URL}/${post.id}?fields=${extendedFields}&access_token=${accessToken}`;
        const extendedResponse = await fetch(extendedUrl);
        const extendedData = await extendedResponse.json();
        
        if (!extendedData.error) {
          // Merge extended data
          Object.assign(post, extendedData);
        }
      } catch (e) {
        // Ignore errors fetching extended fields
        console.warn('Could not fetch extended fields:', e);
      }
      
      latestPost.value = post;
    } else {
      latestPost.value = null;
      topPosts.value = [];
      throw new Error('No posts found. You may not have any posts, or your token needs the appropriate permissions.');
    }
  } catch (err) {
    console.error('Error fetching latest post:', err);
    error.value = err.message || 'Failed to fetch latest post.';
    latestPost.value = null;
    topPosts.value = [];
  } finally {
    loadingPost.value = false;
  }
};

onMounted(() => {
  fetchUserInfo();
  fetchLatestPost();
});
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="mb-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Facebook class="h-6 w-6 text-blue-600" />
            FB Test - /me Endpoint
          </h1>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Testing Facebook Graph API /me endpoint
          </p>
        </div>
        <div class="flex gap-2">
          <button
            @click="fetchLatestPost"
            :disabled="loadingPost"
            class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <RefreshCw :class="['h-4 w-4', loadingPost && 'animate-spin']" />
            {{ loadingPost ? 'Loading...' : 'Get Latest Post' }}
          </button>
          <button
            @click="fetchUserInfo"
            :disabled="loading"
            class="px-4 py-2 bg-[#01779b] text-white rounded-lg hover:bg-[#015a77] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <RefreshCw :class="['h-4 w-4', loading && 'animate-spin']" />
            {{ loading ? 'Loading...' : 'Refresh /me' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#01779b] mb-4"></div>
        <p class="text-gray-600 dark:text-gray-400">Fetching user info from /me endpoint...</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
      <p class="text-sm text-red-800 dark:text-red-200 font-semibold mb-1">Error:</p>
      <p class="text-sm text-red-700 dark:text-red-300">{{ error }}</p>
    </div>

    <!-- User Info Display -->
    <div v-else-if="userInfo" class="flex-1 overflow-y-auto">
      <div class="max-w-4xl mx-auto space-y-6">
        <!-- User Profile Card -->
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <div class="flex items-start gap-4 mb-6">
            <div v-if="userInfo.picture?.data?.url" class="flex-shrink-0">
              <img 
                :src="userInfo.picture.data.url" 
                alt="Profile" 
                class="w-20 h-20 rounded-full border-2 border-gray-200 dark:border-gray-700"
              />
            </div>
            <div class="flex-1 min-w-0">
              <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {{ userInfo.name }}
              </h2>
              <p v-if="userInfo.first_name || userInfo.last_name" class="text-sm text-gray-500 dark:text-gray-400">
                {{ [userInfo.first_name, userInfo.middle_name, userInfo.last_name].filter(Boolean).join(' ') }}
              </p>
              <p v-if="userInfo.id" class="text-xs text-gray-400 dark:text-gray-500 font-mono mt-1">
                ID: {{ userInfo.id }}
              </p>
            </div>
          </div>

          <!-- User Details Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div v-if="userInfo.email" class="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Email</p>
              <p class="text-sm text-gray-900 dark:text-white">{{ userInfo.email }}</p>
            </div>

            <div v-if="userInfo.link" class="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Profile Link</p>
              <a 
                :href="userInfo.link" 
                target="_blank" 
                rel="noopener noreferrer"
                class="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all"
              >
                {{ userInfo.link }}
              </a>
            </div>

            <div v-if="userInfo.gender" class="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Gender</p>
              <p class="text-sm text-gray-900 dark:text-white capitalize">{{ userInfo.gender }}</p>
            </div>

            <div v-if="userInfo.locale" class="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Locale</p>
              <p class="text-sm text-gray-900 dark:text-white">{{ userInfo.locale }}</p>
            </div>

            <div v-if="userInfo.timezone" class="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Timezone</p>
              <p class="text-sm text-gray-900 dark:text-white">{{ userInfo.timezone }}</p>
            </div>

            <div v-if="userInfo.verified !== undefined" class="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Verified</p>
              <p class="text-sm text-gray-900 dark:text-white">{{ userInfo.verified ? 'Yes' : 'No' }}</p>
            </div>

            <div v-if="userInfo.age_range" class="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Age Range</p>
              <p class="text-sm text-gray-900 dark:text-white">
                {{ userInfo.age_range.min ? `${userInfo.age_range.min}+` : '' }}
                {{ userInfo.age_range.max ? ` - ${userInfo.age_range.max}` : '' }}
              </p>
            </div>

            <div v-if="userInfo.picture?.data" class="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Picture Info</p>
              <p class="text-xs text-gray-600 dark:text-gray-400">
                {{ userInfo.picture.data.width }}x{{ userInfo.picture.data.height }}
                <span v-if="userInfo.picture.data.is_silhouette" class="ml-2 text-gray-500">(Silhouette)</span>
              </p>
            </div>
          </div>
        </div>

        <!-- Raw JSON Display -->
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Raw JSON Response</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400">Endpoint: {{ BASE_URL }}/me</p>
          </div>
          <pre class="bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700 overflow-auto text-xs font-mono text-gray-800 dark:text-gray-200">{{ JSON.stringify(userInfo, null, 2) }}</pre>
        </div>

        <!-- Latest Post Display -->
        <div v-if="loadingPost" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <div class="text-center">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mb-2"></div>
            <p class="text-sm text-gray-600 dark:text-gray-400">Loading latest post...</p>
          </div>
        </div>

        <!-- Permission Error for Posts -->
        <div v-else-if="error && (error.includes('Permission denied') || error.includes('user_posts') || error.includes('Cannot fetch posts'))" class="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800 p-6">
          <div class="flex items-start gap-3">
            <div class="flex-shrink-0">
              <div class="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
                <span class="text-yellow-600 dark:text-yellow-400 text-xl">⚠️</span>
              </div>
            </div>
            <div class="flex-1">
              <h3 class="text-lg font-semibold text-yellow-900 dark:text-yellow-200 mb-2">Permission Issue</h3>
              <p class="text-sm text-yellow-800 dark:text-yellow-300 mb-4">
                The <code class="bg-yellow-100 dark:bg-yellow-900 px-2 py-1 rounded font-mono text-xs">user_posts</code> permission may not be available or requires App Review.
              </p>
              <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-yellow-200 dark:border-yellow-700 space-y-4">
                <div>
                  <p class="text-sm font-semibold text-gray-900 dark:text-white mb-2">Current Permissions:</p>
                  <div class="flex flex-wrap gap-2">
                    <span class="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-xs rounded text-gray-700 dark:text-gray-300">public_profile</span>
                    <span class="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-xs rounded text-gray-700 dark:text-gray-300">user_payment_tokens</span>
                  </div>
                </div>
                
                <div>
                  <p class="text-sm font-semibold text-gray-900 dark:text-white mb-2">Alternative Solutions:</p>
                  <div class="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                    <div>
                      <p class="font-semibold mb-1">Option 1: Use Page Token (Recommended)</p>
                      <ol class="list-decimal list-inside space-y-1 ml-2 text-xs">
                        <li>Go to your Facebook Page</li>
                        <li>Settings → Page Access → Generate Page Access Token</li>
                        <li>Or use Graph API Explorer, select your Page (not User)</li>
                        <li>Generate token with <code class="bg-gray-100 dark:bg-gray-700 px-1 rounded">pages_read_engagement</code> permission</li>
                        <li>Use that token to fetch page posts</li>
                      </ol>
                    </div>
                    <div>
                      <p class="font-semibold mb-1">Option 2: Request App Review</p>
                      <p class="text-xs">If you need user_posts, you may need to submit your app for review. Visit <a href="https://developers.facebook.com/docs/app-review" target="_blank" class="text-blue-600 dark:text-blue-400 hover:underline">App Review documentation</a>.</p>
                    </div>
                    <div>
                      <p class="font-semibold mb-1">Option 3: Test with Page Posts</p>
                      <p class="text-xs">The code will automatically try to fetch posts from pages you manage if user posts fail.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="latestPost" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          <div class="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Latest Post</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400">Endpoint: {{ BASE_URL }}/me/posts?limit=1</p>
          </div>

          <!-- Post Header -->
          <div class="p-4 border-b border-gray-200 dark:border-gray-700">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                <Facebook class="h-6 w-6 text-white" />
              </div>
              <div class="flex-1 min-w-0">
                <h4 class="font-semibold text-gray-900 dark:text-white">
                  {{ latestPost.from?.name || 'Unknown' }}
                </h4>
                <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <Calendar class="h-3 w-3" />
                  <span>{{ new Date(latestPost.created_time).toLocaleString() }}</span>
                </div>
              </div>
              <a
                v-if="latestPost.link || latestPost.permalink_url"
                :href="latestPost.permalink_url || latestPost.link"
                target="_blank"
                rel="noopener noreferrer"
                class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Open on Facebook"
              >
                <LinkIcon class="h-5 w-5" />
              </a>
            </div>
          </div>

          <!-- Post Content -->
          <div class="p-4">
            <p v-if="latestPost.message" class="text-gray-900 dark:text-white whitespace-pre-wrap mb-4">
              {{ latestPost.message }}
            </p>
            <p v-else class="text-gray-500 dark:text-gray-400 italic mb-4">No message content</p>

            <!-- Post Image -->
            <div v-if="latestPost.full_picture" class="mb-4 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
              <img
                :src="latestPost.full_picture"
                alt="Post image"
                class="w-full h-auto"
              />
            </div>

            <!-- Attachments -->
            <div v-if="latestPost.attachments?.data?.length > 0" class="mb-4">
              <div
                v-for="(attachment, index) in latestPost.attachments.data"
                :key="index"
                class="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 mb-2"
              >
                <img
                  v-if="attachment.type === 'photo' && attachment.media?.image"
                  :src="attachment.media.image.src"
                  alt="Post attachment"
                  class="w-full h-auto"
                />
                <div v-else-if="attachment.subattachments?.data?.length > 0" class="grid grid-cols-2 gap-2 p-2">
                  <img
                    v-for="(sub, subIndex) in attachment.subattachments.data"
                    :key="subIndex"
                    :src="sub.media?.image?.src"
                    alt="Sub attachment"
                    class="w-full h-auto rounded"
                  />
                </div>
                <div v-else class="p-8 bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <ImageIcon class="h-12 w-12 text-gray-400" />
                </div>
              </div>
            </div>
          </div>

          <!-- Post Stats -->
          <div class="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <div class="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
              <div class="flex items-center gap-4">
                <div v-if="latestPost.shares" class="flex items-center gap-1">
                  <Share2 class="h-4 w-4" />
                  <span>{{ latestPost.shares.count || 0 }}</span>
                </div>
                <div v-if="latestPost.likes" class="flex items-center gap-1">
                  <ThumbsUp class="h-4 w-4" />
                  <span>{{ latestPost.likes.summary?.total_count || latestPost.likes.data?.length || 0 }}</span>
                </div>
                <div v-if="latestPost.comments" class="flex items-center gap-1">
                  <MessageCircle class="h-4 w-4" />
                  <span>{{ latestPost.comments.summary?.total_count || latestPost.comments.data?.length || 0 }}</span>
                </div>
                <div v-if="!latestPost.shares && !latestPost.likes && !latestPost.comments" class="text-xs text-gray-500">
                  Engagement stats not available
                </div>
              </div>
              <div class="text-xs font-mono text-gray-500 dark:text-gray-400">
                ID: {{ latestPost.id }}
              </div>
            </div>
          </div>

          <!-- Raw JSON -->
          <details class="p-4 border-t border-gray-200 dark:border-gray-700">
            <summary class="text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:text-gray-900 dark:hover:text-gray-100">
              View Raw JSON
            </summary>
            <pre class="mt-2 p-4 bg-gray-50 dark:bg-gray-900 rounded text-xs overflow-auto max-h-60 font-mono text-gray-800 dark:text-gray-200">{{ JSON.stringify(latestPost, null, 2) }}</pre>
          </details>
        </div>

        <!-- Top 10 Posts List -->
        <div v-if="topPosts.length > 0" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Top 10 Posts</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400">Endpoint: {{ BASE_URL }}/me/posts (prioritizing posts with images and captions)</p>
          </div>
          
          <div class="space-y-4">
            <div
              v-for="(post, index) in topPosts"
              :key="post.id"
              class="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div class="flex items-start gap-3">
                <div class="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-sm font-semibold text-blue-600 dark:text-blue-400">
                  {{ index + 1 }}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-start justify-between gap-2 mb-2">
                    <div class="flex-1 min-w-0">
                      <p v-if="post.message" class="text-sm text-gray-900 dark:text-white line-clamp-2 mb-1">
                        {{ post.message }}
                      </p>
                      <p v-else class="text-sm text-gray-500 dark:text-gray-400 italic mb-1">
                        (No message)
                      </p>
                      <p class="text-xs text-gray-500 dark:text-gray-400">
                        {{ new Date(post.created_time).toLocaleString() }}
                      </p>
                    </div>
                    <a
                      v-if="post.permalink_url"
                      :href="post.permalink_url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      title="Open on Facebook"
                    >
                      <LinkIcon class="h-4 w-4" />
                    </a>
                  </div>
                  
                  <!-- Post Image -->
                  <div v-if="post.full_picture || post.picture" class="mt-2 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
                    <img
                      :src="post.full_picture || post.picture"
                      alt="Post image"
                      class="w-full h-auto max-h-48 object-cover"
                    />
                  </div>
                  
                  <div class="mt-2 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <span class="font-mono">ID: {{ post.id }}</span>
                    <span v-if="post.type" class="capitalize">{{ post.type }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <Facebook class="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <p class="text-gray-500 dark:text-gray-400">No user data available</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Additional styles if needed */
</style>
