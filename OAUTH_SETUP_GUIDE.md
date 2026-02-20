# OAuth Setup Guide

This guide will help you set up Google and Facebook authentication for your ecommerce application.

## 🔐 Features

✅ **Google OAuth 2.0** - One-click Google login  
✅ **Facebook Graph API** - Facebook social login  
✅ **Auto-registration** - New users automatically registered  
✅ **Profile Image** - Save user profile pictures  
✅ **JWT Tokens** - Secure session handling  
✅ **Provider Tracking** - Know which OAuth provider user used  

---

## 📋 Prerequisites

- Node.js and npm/yarn
- MongoDB running locally or Atlas
- Google and Facebook developer accounts

---

## 🔧 Part 1: Google OAuth Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (e.g., "Ecommerce App")
3. Enable the **Google+ API**:
   - Search for "Google+ API"
   - Click Enable

### Step 2: Create OAuth Credentials

1. Go to **Credentials** in the sidebar
2. Click **Create Credentials** → **OAuth 2.0 Client IDs**
3. Choose **Web application**
4. Add authorized redirect URIs:
   - `http://localhost:5173` (development)
   - `http://localhost:3000` (if testing locally)
   - `https://yourdomain.com` (production)
5. Add authorized JavaScript origins:
   - `http://localhost:5173`
   - `https://yourdomain.com`

### Step 3: Copy Credentials

1. Click on your OAuth 2.0 Client ID
2. Copy **Client ID** and **Client Secret**
3. Add to `server/.env`:

```env
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
```

---

## 🔷 Part 2: Facebook OAuth Setup

### Step 1: Create Facebook App

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Click **My Apps** → **Create App**
3. Choose **Consumer** as app type
4. Fill in app details and create

### Step 2: Configure Facebook Login

1. Go to **Products** in your app dashboard
2. Add **Facebook Login**
3. Go to **Settings** → **Basic**
4. Copy **App ID** and **App Secret**

### Step 3: Set Valid OAuth Redirect URIs

1. Go to **Facebook Login** → **Settings**
2. Add Valid OAuth Redirect URIs:
   - `http://localhost:5173/` (with trailing slash)
   - `http://localhost:3000/` (if needed)
   - `https://yourdomain.com/` (production)
3. Save changes

### Step 4: Copy Credentials

Add to `server/.env`:

```env
FACEBOOK_APP_ID=your_app_id_here
FACEBOOK_APP_SECRET=your_app_secret_here
```

---

## 📝 Step 3: Environment Variables

Update `server/.env`:

```env
# OAuth Configuration
GOOGLE_CLIENT_ID=ADD_YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=ADD_YOUR_GOOGLE_SECRET
FACEBOOK_APP_ID=ADD_FACEBOOK_APP_ID
FACEBOOK_APP_SECRET=ADD_FACEBOOK_SECRET
```

---

## 🚀 Step 4: Test OAuth Implementation

### Frontend

1. Update `client/src/components/GoogleAuthButton.jsx`:
   - Ensure your `GOOGLE_CLIENT_ID` is correctly set

2. Update `client/src/components/FacebookAuthButton.jsx`:
   - Ensure your `FACEBOOK_APP_ID` is correctly set

### Backend

1. Test endpoint:
```bash
curl http://localhost:5000/api/auth/status
```

Expected response:
```json
{
  "googleClientId": "your_client_id",
  "facebookAppId": "your_app_id"
}
```

---

## 🧪 Testing the OAuth Flow

### Test Google Login

1. Go to `http://localhost:5173/login`
2. Click **Continue with Google**
3. Sign in with your Google account
4. Check that you're redirected and logged in

### Test Facebook Login

1. Go to `http://localhost:5173/login`
2. Click **Continue with Facebook**
3. Sign in with your Facebook account
4. Check that you're redirected and logged in

### Verify Database

Check MongoDB to confirm user was created:

```javascript
// MongoDB Shell
db.users.findOne({ email: "your_email@example.com" })

// Should return something like:
{
  _id: ObjectId(...),
  name: "Your Name",
  email: "your_email@example.com",
  oauthProvider: "google",
  oauthId: "xxx",
  profileImage: "https://...",
  password: "",
  isAdmin: false,
  ...
}
```

---

## 🔄 API Endpoints

### Google OAuth Endpoint

**POST** `/api/auth/google`

Request:
```json
{
  "accessToken": "google_access_token",
  "idToken": "google_id_token"
}
```

Response:
```json
{
  "message": "Logged in successfully",
  "user": {
    "_id": "user_id",
    "name": "User Name",
    "email": "user@example.com",
    "isAdmin": false,
    "avatar": "profile_image_url",
    "profileImage": "profile_image_url",
    "oauthProvider": "google"
  }
}
```

### Facebook OAuth Endpoint

**POST** `/api/auth/facebook`

Request:
```json
{
  "accessToken": "facebook_access_token"
}
```

Response:
```json
{
  "message": "Logged in successfully",
  "user": {
    "_id": "user_id",
    "name": "User Name",
    "email": "user@example.com",
    "isAdmin": false,
    "avatar": "profile_image_url",
    "profileImage": "profile_image_url",
    "oauthProvider": "facebook"
  }
}
```

### Auth Status Endpoint

**GET** `/api/auth/status`

Response:
```json
{
  "googleClientId": "client_id_here",
  "facebookAppId": "app_id_here"
}
```

---

## 🛡️ Security Best Practices

### ✅ Already Implemented

- **JWT Tokens**: 30-day expiration
- **HTTPOnly Cookies**: Tokens stored securely
- **HTTPS Only** (production): `secure: NODE_ENV === 'production'`
- **CSRF Protection**: `sameSite: 'strict'`
- **No Password Required**: OAuth users don't need passwords
- **Profile Image Caching**: Stored in database

### 🔒 Additional Recommendations

1. **CORS Configuration**:
   ```javascript
   // Already configured in server.js
   credentials: true,
   origin: process.env.CLIENT_URL
   ```

2. **Rate Limiting**: Add rate limiter for OAuth endpoints
   ```bash
   npm install express-rate-limit
   ```

3. **Token Refresh**: Implement refresh token mechanism for long sessions

4. **Email Verification**: Consider verifying OAuth emails (optional, already done by providers)

---

## 🐛 Troubleshooting

### Issue: "Google sign-in failed"

**Solution:**
- Check `GOOGLE_CLIENT_ID` in environment
- Verify redirect URI is registered in Google Console
- Check browser console for CORS errors
- Clear browser cookies and try again

### Issue: "Facebook login returns blank profile"

**Solution:**
- Check `FACEBOOK_APP_ID` in environment
- Verify app is in Development mode (not Live)
- Check `public_profile,email` permissions are set
- Ensure Facebook App ID is valid

### Issue: "User created but not logged in"

**Solution:**
- Check JWT token is being set in cookies
- Verify `NODE_ENV` is set correctly
- Check MongoDB connection
- Look at server logs for errors

### Issue: "CORS error on OAuth request"

**Solution:**
```javascript
// In server.js - already configured
app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
}));
```

---

## 📱 Production Deployment

### Before Going Live

1. **Get HTTPS Certificate**
   - Use Let's Encrypt for free SSL

2. **Update Redirect URIs**
   - Google Console: Add your domain
   - Facebook App: Add your domain

3. **Set Environment Variables**
   ```env
   NODE_ENV=production
   CLIENT_URL=https://yourdomain.com
   ```

4. **Update Database Connection**
   ```env
   MONGO_URI=your_production_mongodb_uri
   ```

5. **Enable Secure Cookies**
   - Already configured: `secure: NODE_ENV === 'production'`

### Example Production .env

```env
NODE_ENV=production
CLIENT_URL=https://yourdomain.com
PORT=5000
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname

# OAuth
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
FACEBOOK_APP_ID=xxx
FACEBOOK_APP_SECRET=xxx
```

---

## 📚 File Structure

```
server/
├── routes/
│   └── oauthRoutes.js          # OAuth endpoints
├── controllers/
│   └── oauthController.js      # OAuth logic
├── utils/
│   └── oauthService.js         # OAuth utilities
├── models/
│   └── User.js                 # Updated with OAuth fields

client/
├── pages/
│   ├── LoginPage.jsx           # Updated with OAuth buttons
│   └── RegisterPage.jsx        # Updated with OAuth buttons
├── components/
│   ├── GoogleAuthButton.jsx    # Google OAuth button
│   ├── FacebookAuthButton.jsx  # Facebook OAuth button
└── context/
    └── AuthContext.jsx         # Updated with OAuth methods
```

---

## ✨ Features Implemented

| Feature | Status | Details |
|---------|--------|---------|
| Google OAuth 2.0 | ✅ | Using Access Token + ID Token |
| Facebook Graph API | ✅ | Using Access Token |
| Auto-registration | ✅ | New users auto-created |
| Profile Images | ✅ | Stored in database |
| Provider Tracking | ✅ | Stored in user.oauthProvider |
| JWT Generation | ✅ | 30-day expiration |
| Session Handling | ✅ | HTTPOnly cookies, CSRF protection |
| Error Handling | ✅ | Graceful fallback to email login |
| Mobile Support | ✅ | Responsive design with Framer Motion |

---

## 🎯 Next Steps

1. ✅ Get credentials from Google and Facebook
2. ✅ Add credentials to `.env`
3. ✅ Test OAuth flow on login page
4. ✅ Verify users are created in database
5. ✅ Deploy to production
6. ✅ Monitor OAuth errors in logs

---

## 📞 Support

If you encounter issues:

1. Check the [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
2. Check the [Facebook Login Documentation](https://developers.facebook.com/docs/facebook-login)
3. Review error messages in browser console
4. Check server logs: `npm run server`

---

**Happy authenticating! 🚀**
