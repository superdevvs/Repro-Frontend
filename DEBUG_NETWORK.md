# Debugging Network Error in AI Chat

## The Error

The red toast "Unable to connect to the server" appears when Axios reports `ERR_NETWORK` or `Network Error`. This means **the request never reached the Laravel backend** - it failed at the network level.

## Quick Checks

### 1. Verify Backend is Running

Open in browser or use curl:
```
http://localhost:8000/api/ping
```

Should return: `{"status":"success","timestamp":"...","message":"API is working V1"}`

If this fails → **Backend is not running or wrong port**

### 2. Check API Base URL

In browser console (F12), check what URL is being called:
```javascript
// The console will show:
// Network Error - Request never reached backend:
// fullUrl: "http://localhost:8000/api/ai/chat"
```

**Verify:**
- Is this the correct URL where your Laravel server is running?
- Check `repro-frontend/.env` or `.env.local`:
  ```bash
  VITE_API_URL=http://localhost:8000
  # OR
  VITE_API_PORT=8000
  ```

### 3. Test Health Endpoint

Try accessing directly in browser:
```
http://localhost:8000/api/ai/health
```

Should return: `{"status":"ok","service":"Robbie AI Chat",...}`

### 4. Check CORS

Open browser console (F12) → Network tab → Find the failed request → Check:
- **Status**: `(failed)` or `CORS error`
- **Headers**: Look for CORS-related errors
- **Response**: Any CORS error message?

## Common Causes

### Backend Not Running
```bash
cd repro-backend
php artisan serve
# Should see: "Laravel development server started: http://127.0.0.1:8000"
```

### Wrong Port
- Frontend expects: `http://localhost:8000`
- Backend running on: `http://localhost:8001`
- **Fix**: Update `VITE_API_URL` or `VITE_API_PORT` in frontend `.env`

### CORS Blocking
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- **Check**: `repro-backend/config/cors.php` includes `http://localhost:5173`

### Protocol Mismatch
- Frontend: `https://...`
- Backend: `http://...`
- **Fix**: Use same protocol or configure CORS properly

## Debug Steps

1. **Check browser console** (F12) - Look for the detailed network error log I added
2. **Check Network tab** - See the actual request URL and status
3. **Test backend directly** - Use browser/curl to hit `/api/ping`
4. **Check backend logs** - `repro-backend/storage/logs/laravel.log`

## What I Added

1. **Better error logging** - Console now shows the exact URL being called
2. **Troubleshooting hints** - Console shows what to check
3. **Detailed error messages** - Toast now includes the URL that failed

## Next Steps

After checking the above, share:
1. What URL is shown in browser console?
2. Can you access `http://localhost:8000/api/ping` in browser?
3. What port is your Laravel server running on?
4. Any CORS errors in browser console?
