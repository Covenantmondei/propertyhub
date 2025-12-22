# Automatic Token Refresh System

The application now includes automatic JWT token refresh to handle expired access tokens seamlessly.

## How It Works

### Backend Token Configuration
- **Access Token**: Expires in 15 minutes
- **Refresh Token**: Expires in 14 days

### Frontend Auto-Refresh Flow

1. **API Call Made**: User makes an authenticated API request
2. **Token Expired (401)**: Backend returns 401 Unauthorized
3. **Auto Refresh**: Frontend automatically uses refresh token to get new access token
4. **Retry Request**: Original request is retried with new access token
5. **Continue**: User experiences no interruption

### Key Features

✅ **Automatic Retry**: Failed requests due to expired tokens are automatically retried  
✅ **Queue Management**: Multiple simultaneous requests wait for single refresh  
✅ **Session Continuity**: Users stay logged in without interruption  
✅ **Graceful Fallback**: If refresh fails, redirects to login with notification  
✅ **Zero User Interaction**: Everything happens in the background  

## Implementation Details

### Main API Call Function (`main.js`)

```javascript
// Enhanced apiCall with automatic token refresh
async function apiCall(endpoint, options = {}, retryCount = 0) {
    // Make request with current token
    const response = await fetch(...);
    
    // If 401 and first attempt
    if (response.status === 401 && retryCount === 0) {
        // Refresh token
        const newToken = await refreshAccessToken();
        
        // Retry with new token
        return await apiCall(endpoint, options, 1);
    }
    
    return response;
}
```

### Token Refresh Function

```javascript
async function refreshAccessToken() {
    const refreshToken = localStorage.getItem('refreshToken');
    
    // Call refresh endpoint
    const response = await fetch('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken })
    });
    
    // Store new tokens
    localStorage.setItem('authToken', data.access_token);
    localStorage.setItem('refreshToken', data.refresh_token);
    
    return data.access_token;
}
```

### Concurrent Request Handling

When multiple API calls fail simultaneously due to token expiration:

1. First request triggers token refresh
2. Subsequent requests are queued
3. When refresh completes, all queued requests retry
4. Only one refresh call is made

```javascript
let isRefreshing = false;
let refreshSubscribers = [];

// If already refreshing, wait for it
if (isRefreshing) {
    return new Promise((resolve) => {
        subscribeTokenRefresh(() => {
            apiCall(endpoint, options, 1).then(resolve);
        });
    });
}
```

## Usage in Different Files

### Using `apiCall` from `main.js`

Most files should use the global `apiCall` function:

```javascript
// This automatically handles token refresh
const data = await apiCall('/admin/dashboard');
```

### Admin.js Implementation

Admin.js uses `adminApiCall` which wraps the global `apiCall`:

```javascript
async function adminApiCall(endpoint, options = {}) {
    // Use main.js apiCall if available
    if (typeof window.apiCall === 'function') {
        return await window.apiCall(endpoint, options);
    }
    // Fallback implementation
    ...
}
```

## Error Scenarios

### 1. Token Expired (Normal)
- **Status**: 401 Unauthorized
- **Action**: Automatic refresh and retry
- **User Experience**: Seamless, no interruption

### 2. Refresh Token Expired
- **Status**: 401 on refresh endpoint
- **Action**: Clear tokens, show notification, redirect to login
- **User Experience**: "Session expired. Please login again."

### 3. Refresh Token Invalid
- **Status**: 401 on refresh endpoint
- **Action**: Clear tokens, redirect to login
- **User Experience**: Immediate redirect to login

### 4. Network Error
- **Action**: Throw error to calling function
- **User Experience**: Error notification shown by caller

## Testing Token Refresh

### Manual Test

1. Login to application
2. Wait 15+ minutes (or modify `ACCESS_TOKEN_EXPIRE_MINUTES` to 1 minute)
3. Perform any action (click dashboard, approve property, etc.)
4. Check browser console for "Token expired, attempting refresh..."
5. Action should complete successfully

### Developer Tools Test

1. Open browser DevTools → Application → Local Storage
2. Delete `authToken` (keep `refreshToken`)
3. Perform any authenticated action
4. Token should be automatically refreshed

### Backend Log Test

Look for these log entries:
```
DEBUG - JWT Error: Signature has expired.
INFO: 127.0.0.1 - "GET /admin/dashboard HTTP/1.1" 401 Unauthorized
INFO: 127.0.0.1 - "POST /auth/refresh HTTP/1.1" 200 OK
INFO: 127.0.0.1 - "GET /admin/dashboard HTTP/1.1" 200 OK
```

## Security Considerations

✅ **Refresh tokens stored securely** in localStorage  
✅ **New refresh token issued** with each refresh (token rotation)  
✅ **Short-lived access tokens** reduce exposure window  
✅ **Automatic cleanup** of expired tokens  
✅ **Session termination** on refresh failure  

## Troubleshooting

### Infinite Refresh Loop
**Symptom**: Console shows continuous refresh attempts  
**Cause**: Backend refresh endpoint returning 401  
**Fix**: Check refresh token validity on backend

### Token Not Refreshing
**Symptom**: Redirected to login immediately  
**Cause**: No refresh token in localStorage  
**Fix**: Ensure login response includes refresh_token

### Multiple Refresh Calls
**Symptom**: Multiple `/auth/refresh` requests in Network tab  
**Cause**: `isRefreshing` flag not working  
**Fix**: Check that main.js is loaded before other scripts

## Files Modified

- ✅ `frontend/js/main.js` - Added refresh logic
- ✅ `frontend/js/admin.js` - Updated to use refresh-enabled apiCall
- ✅ All HTML files - Ensure main.js loads first

## Backend Endpoint

```
POST /auth/refresh
Content-Type: application/json

{
  "refresh_token": "eyJhbGc..."
}

Response:
{
  "access_token": "new_token...",
  "refresh_token": "new_refresh_token...",
  "token_type": "bearer"
}
```

---

**Status**: ✅ Implemented and Active  
**Last Updated**: December 19, 2025
