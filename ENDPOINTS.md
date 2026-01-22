# Facebook Graph API Endpoints Used in FBTest.vue

## Base URL
`https://graph.facebook.com/v19.0/`

## Available Endpoints

### 1. Get User Info
**Endpoint:** `GET /me`
**Fields:** `id,name`
**Used in:** `fetchPostData()` and `fetchAvailablePosts()`
**Purpose:** Get current user's ID and name
**Example:**
```
GET https://graph.facebook.com/v19.0/me?fields=id,name&access_token={token}
```

### 2. Get Specific Post
**Endpoint:** `GET /{post-id}`
**Fields:** `id,message,created_time,from{name,id},likes.summary(true),comments.summary(true),shares,full_picture,picture,attachments{media,type,subattachments},type,link,permalink_url`
**Used in:** `fetchPostData()`
**Purpose:** Fetch a specific post by its ID
**Example:**
```
GET https://graph.facebook.com/v19.0/{postId}?fields={fields}&access_token={token}
```

### 3. Get User Posts
**Endpoint:** `GET /{user-id}/posts`
**Fields:** `id,message,created_time,from{name,id}` (for list) or full post fields (for search)
**Limit:** 20 (for browse) or 100 (for search)
**Used in:** `fetchPostData()` and `fetchAvailablePosts()`
**Purpose:** Get list of posts from a user
**Required Permission:** `user_posts`
**Example:**
```
GET https://graph.facebook.com/v19.0/{userId}/posts?fields={fields}&limit=20&access_token={token}
```

### 4. Get User's Pages
**Endpoint:** `GET /{user-id}/accounts`
**Fields:** `id,name`
**Used in:** `fetchPostData()` and `fetchAvailablePosts()`
**Purpose:** Get list of pages the user manages
**Required Permission:** `pages_show_list`
**Example:**
```
GET https://graph.facebook.com/v19.0/{userId}/accounts?fields=id,name&access_token={token}
```

### 5. Get Page Posts
**Endpoint:** `GET /{page-id}/posts`
**Fields:** `id,message,created_time,from{name,id}` (for list) or full post fields (for search)
**Limit:** 20 (for browse) or 100 (for search)
**Used in:** `fetchPostData()` and `fetchAvailablePosts()`
**Purpose:** Get list of posts from a page
**Required Permission:** `pages_read_engagement`
**Example:**
```
GET https://graph.facebook.com/v19.0/{pageId}/posts?fields={fields}&limit=20&access_token={token}
```

## Request Flow

### fetchPostData() Flow:
1. Try: `GET /{post-id}` (direct post fetch)
2. If fails: `GET /me` (get user info)
3. Then try: `GET /{user-id}/posts` (search user posts)
4. If fails: `GET /{user-id}/accounts` (get pages)
5. Then try: `GET /{page-id}/posts` (search page posts)

### fetchAvailablePosts() Flow:
1. `GET /me` (get user info)
2. Try: `GET /{user-id}/posts` (get user posts)
3. If fails: `GET /{user-id}/accounts` (get pages)
4. Then try: `GET /{page-id}/posts` (get page posts)

## Required Permissions

- `public_profile` - Basic user info (default)
- `user_posts` - Access user's posts
- `pages_show_list` - List pages user manages
- `pages_read_engagement` - Read page posts and engagement

## Field Definitions

### Post Fields Used:
- `id` - Post ID
- `message` - Post text content
- `created_time` - When post was created
- `from{name,id}` - Post author info
- `likes.summary(true)` - Like count
- `comments.summary(true)` - Comment count
- `shares` - Share count
- `full_picture` - Full-size image
- `picture` - Thumbnail image
- `attachments{media,type,subattachments}` - Post attachments
- `type` - Post type (photo, video, etc.)
- `link` - Post URL
- `permalink_url` - Permanent post URL




