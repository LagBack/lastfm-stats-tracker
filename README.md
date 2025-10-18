# 🎧Last.fm stats tracker

A web app that visualizes your Last.fm listening habits — see your top artists, albums, and tracks with smooth charts and a modern interface.

- Displays **top artists, albums, and tracks** from your Last.fm account 
- Shows **listening streaks** and **recent scrobbles in real time** 🔥
- Clean, responsive design built with React

### Website

- [LastFMTracker](https://lastfmtracker.vercel.app/)

## How to use it?

- If you don't already have one, create a <a href='last.fm'>**Last.fm**</a> account
- Simply enter your username and see your music stats along with your current listened to songs in real time

## 🛠️ Installation & Setup

To run the app locally, you need **both the frontend and backend**.

### Clone and run the backend
Your backend handles Spotify authentication and API calls.  
Clone and start it first
 ```bash
git clone https://github.com/LagBack/lastfm-tracker-backend.git
cd lastfm-stats-backend
npm install
node index.js
```
**Then create a .env file in the backend root with:**
```bash
LASTFM_API_KEY=your-api-key
CLIENT_ID=your-client-id
CLIENT_SECRET=your-client-secret
```

1. **Clone the repository:**
   ```bash
   git clone https://github.com/LagBack/lastfm-stats-tracker.git
   cd lastfm-stats-tracker

2. **Install dependendencies**
   ```bash 
   npm install

3. **Create a .env file in the root directory and add your Last.fm API key:**
   ```bash
   VITE_LASTFM_API_KEY=your_api_key_here

5. **Start the development server**
    ```bash
    npm run dev


   