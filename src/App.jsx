import { useState, useEffect, useRef } from 'react';
import DarkVeil from './animations/DarkVeil.jsx';
import artistsIcon from './assets/artistsicon.png';
import albumsIcon from './assets/albumsicon.png';
import tracksIcon from './assets/tracksicon.png';
import { color } from 'three/tsl';

let streakCalculationRunning = false;
let _lastApiCall = 0;

function App() {

  const [username, setUsername] = useState('');
  const [track, setTrack] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dominantColor, setDominantColor] = useState('#8b5cf6');
  const [topArtists, setTopArtists] = useState([]); 
  const [topTracks, setTopTracks] = useState([]);
  const [timePeriod, setTimePeriod] = useState('overall');
  const [artistImages, setArtistImages] = useState({});
  const [trackImages, setTrackImages] = useState({});
  const [streak, setStreak] = useState(-1);
  const [totalStats, setTotalStats] = useState ({
    artists: 0,
    albums: 0,
    tracks: 0
  });
  const currentStreakCalculationIdRef = useRef(0);


  const fetchPageData = async (username, page, limit) => {
  try {
    await rateLimit(300);
    
    const response = await fetch(
      `http://localhost:3001/api/lastfm?method=user.getrecenttracks&user=${encodeURIComponent(username)}&format=json&limit=${limit}&page=${page}`
    );
    const data = await response.json();
    
    const tracks = data.recenttracks?.track || [];
    

    return tracks
      .filter(t => t.date?.uts)
      .map(t => ({
        date: parseInt(t.date.uts)
      }));
  } catch (error) {
    console.error('Error fetching page:', error);
    return [];
  }
};

const calculateStreakProgressive = async (updateStreakCallback) => {
  if (streakCalculationRunning || !username) {
    console.log("Already calculating or no username");
    return;
  }

  streakCalculationRunning = true;
  console.log("Starting streak calculation");

  try {
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const listeningDays = new Set();
    let page = 1;
    let totalPages = 999; 

    while (page <= totalPages && page <= 500) {
      await rateLimit(500);
  
        try {
        const response = await fetch(
      `http://localhost:3001/api/lastfm?method=user.getrecenttracks&user=${encodeURIComponent(username)}&format=json&limit=200&page=${page}`
      );
    
    if (!response.ok) {
      console.log(`Got ${response.status} at page ${page}, waiting longer...`);
      await new Promise(r => setTimeout(r, 2000));
      continue; 
    }
    
    const data = await response.json();
      
      if (page === 1) {
        totalPages = Math.min(parseInt(data.recenttracks?.['@attr']?.totalPages) || 999, 500);
        console.log(`Total pages to fetch: ${totalPages}`);
      }
      
      const tracks = data.recenttracks?.track || [];
      
      if (tracks.length === 0) {
        console.log("No more tracks at page", page);
        break;
      }

      for (const track of tracks) {
        if (!track.date?.uts) continue; 
        
        const trackDate = new Date(parseInt(track.date.uts) * 1000);
        trackDate.setHours(0, 0, 0, 0);
        const dayKey = trackDate.toISOString().split('T')[0];
        listeningDays.add(dayKey);
      }

      if (page % 10 === 0) {
        console.log(`Fetched page ${page}/${totalPages}, unique days: ${listeningDays.size}`);
      }

      page++;
    } catch (error) {
      console.error(`Error fetching page ${page}:`, error);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

    console.log(`Finished fetching. Total unique days: ${listeningDays.size}`);

    let checkDate = new Date(today);
    while (streak < listeningDays.size) {
      const dayKey = checkDate.toISOString().split('T')[0];
      
      if (listeningDays.has(dayKey)) {
        streak++;
        updateStreakCallback(streak);
        checkDate.setDate(checkDate.getDate() - 1); 
      } else {
        console.log(`Streak broken at ${dayKey}`);
        break;
      }
    }

    updateStreakCallback(streak);
    console.log(`Final streak: ${streak} days`);
    
  } catch (err) {
    console.error("Streak calculation failed:", err);
  } finally {
    streakCalculationRunning = false;
    console.log("Calculation done");
  }
};

const rateLimit = async (minDelay = 300) => {
  const now = Date.now();
  const wait = Math.max(0, minDelay - (now - _lastApiCall));
  if (wait) await new Promise(r => setTimeout(r, wait));
  _lastApiCall = Date.now();
};

const ymd = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};


 const fetchTotalStats = async () => {
  try {
    const artistsResponse = await fetch(
      `http://localhost:3001/api/lastfm?method=user.gettopartists&user=${encodeURIComponent(username)}&format=json&limit=1`
    );
    const artistsData = await artistsResponse.json();
    const totalArtists = artistsData.topartists?.['@attr']?.total || 0;

    const albumsResponse = await fetch(
      `http://localhost:3001/api/lastfm?method=user.gettopalbums&user=${encodeURIComponent(username)}&format=json&limit=1`
    );
    const albumsData = await albumsResponse.json();
    const totalAlbums = albumsData.topalbums?.['@attr']?.total || 0;

    const tracksResponse = await fetch(
      `http://localhost:3001/api/lastfm?method=user.gettoptracks&user=${encodeURIComponent(username)}&format=json&limit=1`
    );
    const tracksData = await tracksResponse.json();
    const totalTracks = tracksData.toptracks?.['@attr']?.total || 0;

    setTotalStats({
      artists: totalArtists,
      albums: totalAlbums,
      tracks: totalTracks
    });


  } catch (error) {
    console.error('Error fetching total stats', error);
  }
};


const fetchStreakSafe = async () => {
  currentStreakCalculationIdRef.current += 1;
  const myCalculationId = currentStreakCalculationIdRef.current;
  setStreak(-1); 

  try {
    await calculateStreakProgressive((progress) => {
      if (myCalculationId !== currentStreakCalculationIdRef.current) return;
      setStreak(progress);
    });
  } catch (error) {
    if (myCalculationId === currentStreakCalculationIdRef.current) setStreak(0);
    console.error('Streak calculation failed:', error);
  }
};

 const fetchTopData = async () => {
  try {
  const artistsResponse = await fetch(`http://localhost:3001/api/lastfm?method=user.gettopartists&user=${encodeURIComponent(username)}&format=json&limit=5&period=${timePeriod}`
  );
  const artistsData = await artistsResponse.json();
  const artists = artistsData.topartists?.artist || [];
  setTopArtists(artistsData.topartists?.artist || []); 

  const tracksResponse = await fetch(`http://localhost:3001/api/lastfm?method=user.gettoptracks&user=${encodeURIComponent(username)}&format=json&limit=5&period=${timePeriod}`);
  const tracksData = await tracksResponse.json();
  const tracks = tracksData.toptracks?.track || [];
  console.log('Tracks data:', tracksData);
  setTopTracks(tracksData.toptracks?.track || []);

  await fetchSpotifyImages(artists, tracks);

} catch (error) {
  console.error('Error fetching top data:', error);
}
 };

 const getCachedImage = (key) => {
  try {
    const cached = localStorage.getItem(`img_${key}`);
    if (cached) {
      const { url, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < 7 * 24 * 60 * 60 * 1000) {
        return url;
      }
    }
  } catch (error) {
    console.error('Error reading cache:', error);
  }
  return null;
 };

 const setCachedImage = (key, url) => {
  try {
    localStorage.setItem(`img_${key}`, JSON.stringify({
      url,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.log('Error writing cache:', error);
  }
 };
  
  const fetchSpotifyImages = async (artists, tracks) => {
    const artistImgs = {};
    const trackImgs = {};

    for (const artist of artists) {
      try {
        const cached = getCachedImage(`artist_${artist.name}`);
        if (cached) {
          console.log('Using cached image for artist:', artist.name);
          artistImgs[artist.name] = cached;
          continue;
        }

        await new Promise(resolve => setTimeout(resolve, 500));

        const response = await fetch(
          `http://localhost:3001/api/search?query=${encodeURIComponent(artist.name)}&type=artist`,
        );
        const data = await response.json();

        console.log('Search result for', artist.name, ':', data.artists?.items?.[0]?.name);

        if (data.artists?.items?.[0]?.images?.[0]) {
          const imageUrl = data.artists.items[0].images[0].url;
          artistImgs[artist.name] = imageUrl;
          setCachedImage(`artist_${artist.name}`, imageUrl);
        }
      } catch (error) {
        console.error('Error fetching artist image:', error);
      }
    }

    for (const track of tracks) {
      try {
        const cacheKey = `track_${track.name}_${track.artist.name}`;
        const cached = getCachedImage(cacheKey);
        if (cached) {
          console.log('Using cached image:', track.name);
          trackImgs[track.name] = cached;
          continue;
        }

        await new Promise(resolve => setTimeout(resolve, 500));

        
        const response = await fetch(
          `http://localhost:3001/api/search?query=${encodeURIComponent(track.name + ' ' + track.artist.name)}&type=track`,
        );
        const data = await response.json();

        console.log('Full Track object', data.tracks?.items?.[0]);
        console.log('Album:', data.tracks?.items?.[0]?.album);
        console.log('Album Images:', data.track?.items?.[0]?.album?.images);


        if (data.tracks?.items?.[0]?.album?.images?.[0]) {
          const imageUrl = data.tracks.items[0].album.images[0].url;
          trackImgs[track.name] = imageUrl;
          setCachedImage(cacheKey, imageUrl);
          console.log('Saved image for:', track.name, ':', imageUrl);
        } else {
          console.log('No image found for:', track.name);
        }
      } catch (error) {
        console.error('Error fetching track image:', error);
      }
    }

    setArtistImages(artistImgs);
    setTrackImages(trackImgs);
  }

  const getTimeAgo = (timestamp) => {
    const seconds = Math.floor(Date.now() / 1000 - timestamp);
    if (seconds < 60) return `${seconds} seconds ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    return `${days} days ago`;
   }

   const fetchCurrentTrackOnly = async () => {
    if (!username) return;

    try {
      const url = `http://localhost:3001/api/lastfm?method=user.getrecenttracks&user=${encodeURIComponent(username)}&format=json&limit=1`;
      const response = await fetch(url);
      const data = await response.json();
      const trackData = data.recenttracks?.track?.[0];
      setTrack(trackData);

      if (trackData?.image?.[3]?.['#text']) {
        extractColor(trackData.image[3]['#text']);
      }
    }catch (error) {
      console.error('Error fetching current track', error);
    } 
   };

   const fetchTotalStatsAndStreak = async () => {
  try {
    const [artistsRes, albumsRes, tracksRes] = await Promise.all([
      fetch(`http://localhost:3001/api/lastfm?method=user.gettopartists&user=${encodeURIComponent(username)}&format=json&limit=1`),
      fetch(`http://localhost:3001/api/lastfm?method=user.gettopalbums&user=${encodeURIComponent(username)}&format=json&limit=1`),
      fetch(`http://localhost:3001/api/lastfm?method=user.gettoptracks&user=${encodeURIComponent(username)}&format=json&limit=1`)
    ]);

    const artistsData = await artistsRes.json();
    const albumsData = await albumsRes.json();
    const tracksData = await tracksRes.json();

    setTotalStats({
      artists: artistsData.topartists?.['@attr']?.total || 0,
      albums: albumsData.topalbums?.['@attr']?.total || 0,
      tracks: tracksData.toptracks?.['@attr']?.total || 0
    });

    await fetchStreakSafe();

  } catch (err) {
    console.error('Error fetching total stats or streak', err);
  }
};

const handleSearch = () => {
  setStreak(-1);                  

  fetchMusic(true);                
  fetchTotalStatsAndStreak();  
  fetchTopData();    
};


useEffect(() => {
  if (!username) return;

  // current track polling
  const trackInterval = setInterval(() => fetchMusic(false, false), 4000);

  // top artists/tracks (less frequent)
  const topDataInterval = setInterval(fetchTopData, 60_000);

  // streak and totals (even less frequent)
  const statsInterval = setInterval(fetchTotalStats, 5 * 60_000);

  return () => {
    clearInterval(trackInterval);
    clearInterval(topDataInterval);
    clearInterval(statsInterval);
  };
}, [username, timePeriod]);


useEffect(() => {
  if (username && track) {
    const interval = setInterval(() => {
      fetchMusic(false);
    }, 4000);

    return () => clearInterval(interval);

  }

}, [username, track]);

useEffect(() =>{
  if (username && track) {
    fetchTopData();
  }
}, [timePeriod]);

const fetchMusic = async (showLoading = true) => {
  if (!username) return;
  if (showLoading) setLoading(true);

  try {
    const url = `http://localhost:3001/api/lastfm?method=user.getrecenttracks&user=${encodeURIComponent(username)}&format=json&limit=1`;
    const response = await fetch(url);
    const data = await response.json();

    const trackData = data.recenttracks?.track?.[0];

    setTimeout(() => {
      setTrack(trackData);
      if (trackData?.image?.[3]?.['#text']) {
        extractColor(trackData.image[3]['#text']);
      }
      if (showLoading) setLoading(false);
    }, 300);
  } catch (error) {
    console.error('Error fetching music:', error);
    if (showLoading) setLoading(false);
  }
};



  const extractColor = (ImageSrc) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = ImageSrc;

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      let r = 0, g = 0, b = 0, count = 0;

      for (let i = 0; i < data.length; i += 4 * 10) {
        r +=data[i];
        g +=data[i + 1];
        b +=data[i + 2];
        count++;
      }

      r = Math.floor(r / count);
      g = Math.floor(g / count);
      b = Math.floor(b / count);

      setDominantColor(`rgb(${r}, ${g}, ${b})`);
      console.log('Extracted color:', `rgb(${r}, ${g}, ${b})`);
    };
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {handleSearch();}
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden', backgroundColor: 'black' }}>
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, opacity: '60%'}}>
        <DarkVeil
        hueShift={20}
        resolutionScale={2.5}
        warpAmount={4} 
        />
      </div>
    
    <div style={{ 
    padding: '40px',
    fontFamily: 'Arial, sans-serif',
    minHeight: '100vh',
    background: 'transparent',
    margin: 0,
    width: '100vw', 
    boxSizing: 'border-box', 
    display: 'flex',
    gap: '40px',
    justifyContent: 'space-between',
    position: 'relative',
    zIndex: 1
    }}>
    
      {/* left side, main content */}
      <div style={{width: '520px', flexShrink: 0}}>
      <h1 style={{
        color: 'white',
        fontSize: '48px',
        fontFamily: 'Brush Script MT',
        marginBottom: '30px',
        animation: 'fadeIn 0.6s ease-in'
      }}>Last.fm Stats Tracker</h1>
      <div style={{ marginBottom: '40px' }}>
      <input
      type = "text"
      value = {username}
      onChange = {(e) => setUsername(e.target.value)}
      onKeyPress={handleKeyPress}
      placeholder = "Enter your last.fm username"
      style ={{
        padding: '15px 20px',
        fontSize: '16px',
        width: '350px',
        borderRadius: '12px',
        border: '2px solid rgba(255, 255, 255, 0.1)',
        background: 'rgba(255, 255, 255, 0.05)',
        color: 'white',
        transition: 'all 0.3s ease',
        outline: 'none'
      }}
      onFocus={(e) => e.target.style.borderColor = '#000000ff'}
      onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
      />

      <button onClick={handleSearch}
      style={{ 
      padding: '15px 30px', 
      marginLeft: '15px',
      fontSize: '16px', 
      borderRadius: '12px',
      border: 'none',
      background: 'linear-gradient(135deg, #03045e 0%, #023e8a 100%)', 
      color: 'white',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      transform: 'scale(1)'
      }}
      onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
      onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
      >
        Search
      </button>
      </div>

      {loading && (
        <div style={{
          color: '#ffffffff',
          fontSize: '18px',
          animation: 'pulse 1.5s ease-in-out infinite'
        }}> Loading...</div>
      )}

      {track && (
        <div style={{ marginTop: '40px', maxWidth: '600px', animation: 'fadeinUp 0.6s ease-out', opacity: 1 }}>
          <img
          src={track.image?.[3]?.['#text']}
          alt="Album Art"
          style={{ width: '350px',
            height: '350px',
            borderRadius: '20px',
            boxShadow: `0 20px 60px ${dominantColor}`,
            marginBottom: '30px',
            animation: 'fadeInScale 0.8s ease-out',
            transition: 'transform 0.3s ease, box-shadow 0.5s ease'
          }}
          onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)' }
          onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
          />

          <h2 style={{
            color: 'white',
            fontSize: '2rem', 
            marginBottom: '10px',
            animation: 'fadeIn 0.8s ease-out 0.2s backwards'
          }}>{track.name}</h2>

          <p style={{
            color: '#a0a0a0',
            fontSize: '1.3rem',
            animation: 'fadeIn 0.8s ease-out 0.3s backwards'
          }}><strong style={{ color: 'white' }}>Artist:</strong> {track.artist?.['#text'] || track.artist}</p>

          <p style={{
            color: '#a0a0a0',
            fontSize: '1.1rem',
            animation: 'fadeIn 0.8s ease-out 0.4s backwards'
          }}><strong style={{color: 'white' }}>Album:</strong> {track.album?.['#text'] || 'Unknown'}</p>

          {track['@attr']?.nowplaying && (
            <p style={{color: '#22c55e',
              fontWeight: 'bold',
              fontSize: '1.2rem',
              marginTop: '20px',
              animation: 'pulse 2s ease-in-out infinite'
            }}>🎵 NOW PLAYING</p>
          )}

          {track.date && (
            <p style ={{
              color: '#666',
              marginTop: '15px',
              animation: 'fadeIn 0.8s ease-out 0.5s backwards'
            }}><strong>Last Played:</strong> {getTimeAgo(track.date.uts)}</p>
          )}
        </div>
      )}
       
      

      </div>
      {/* End of left column */}

      {/* Middle column - Stats */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', marginTop: '115px' }}>
          {totalStats.artists === 0 && totalStats.albums === 0 && totalStats.tracks === 0 ? (
    <div style={{ color: '#ffffffff' }}></div>
  ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '40px',
            maxWidth: '500px'
          }}>
            {/* Total Artists */}
            <div style={{
              padding: '24px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              textAlign: 'center',
              animation: 'fadeIn 0.8s ease-out'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', color: 'white', fontSize: '20px' }}>
                <img src ={artistsIcon} alt="artists" style={{width: '75px', height: '75px', marginLeft: '23px' }}>
                </img>
                </div>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'white' }}>
                {totalStats.artists.toLocaleString()}
              </div>
              <div style={{ color: '#999', fontSize: '0.9rem', marginTop: '4px' }}>
                Artists
              </div>
            </div>

            {/* Total Albums */}
            <div style={{
              padding: '24px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              textAlign: 'center',
              animation: 'fadeIn 0.8s ease-out 0.1s backwards'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', color: 'white', fontSize: '20px'}}>
                <img src={albumsIcon} alt="albums" style={{width: '75px', height: '75px', marginLeft: '23px'}}>
                </img>
                </div>
                <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'white' }}>
                {totalStats.albums.toLocaleString()}
              </div>
              <div style={{ color: '#999', fontSize: '0.9rem', marginTop: '4px' }}>
                Albums
              </div>
            </div>

            {/* Total Tracks */}
            <div style={{
              padding: '24px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              textAlign: 'center',
              animation: 'fadeIn 0.8s ease-out 0.2s backwards'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', fontSize: '20px', color: 'white'}}>
                <img src={tracksIcon} alt="tracks" style={{width: '75px', height: '75px', marginLeft: '23px'}}>
                </img>
                </div>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'white' }}>
                {totalStats.tracks.toLocaleString()}
              </div>
              <div style={{ color: '#999', fontSize: '0.9rem', marginTop: '4px' }}>
                Tracks
              </div>
            </div>

            {/* streak card */}
            <div style={{
              padding: '24px',
              background: 'linear-gradient(135deg, rgba(208, 0, 0, 0.1), rgba(220, 47, 2, 0.1))',
              border: '1px solid rgba(208, 0, 0, 0.3)',
              borderRadius: '16px',
              textAlign: 'center',
              animation: 'fadeIn 0.8s ease-out 0.3s backwards'
            }}> 
              <div style={{ fontSize: '3rem', marginBottom: '8px'}}>🔥</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#dc2f02' }}>
                {streak === -1 ? (
                  <div style={{ fontSize: '1rem'}}>
                    <div className="spinner" style={{
                      border: '3px solid rgba(208, 0, 0, 0.3)',
                      borderTop: '3px solid #dc2f02',
                      borderRadius: '50%',
                      width: '30px',
                      height: '30px',
                      animation: 'spin 1s linear infinite',
                      margin: '0 auto'
                    }}></div> 
                    </div>
                ) : streak}
                </div>
                <div style={{ color: '#999', fontSize: '0.9rem', marginTop: '4px' }}>
                  {streak === -1 ? 'Calculating...' : 'Day Streak'}
                  </div>
                  <h6 style={{ color: '#999', marginTop: '0px', fontWeight: 'normal'}}>
                    (may take a while to load)
                    </h6>
                  
          </div>
          </div>
        )}
      </div>


      {/* right side, top artists/ tracks */}
      {(topArtists.length > 0 || topTracks.length > 0) && (
        <div style={{
          width: '360px',
          flexShrink: 0,
          color: 'white'
        }}>
          {/* time period selector*/}
          <div style={{ marginBottom: '30px'}}>
            <h3 style={{ fontSize: '1rem', marginBottom: '12px', color: '#999'}}>Time Period</h3>
            <div style={{ position: 'relative', width: '200px' }}>
              <select 
              value={timePeriod} 
              onChange={(e) => setTimePeriod(e.target.value)}
              style={{
                fontFamily: 'Gill-Sans, sans-serif', 
                width: '100%',
                padding: '10px 14px',
                fontSize: '0.9rem',
                borderRadius: '10px',
                border: '2px solid',
                borderColor: 'rgba(5, 97, 210, 1)',
                background: 'rgba(0, 0, 0, 0.05)',
                color: '#ffffffff',
                cursor: 'pointer',
                outline: 'none',
                transition: 'all 0.3s ease',                
                MozAppearance: 'none',
                appearance: 'none',
                WebkitAppearance: 'none'
              }}
              onFocus={(e) => (e.target.style.background = 'rgba(0, 0, 0, 0.9)')}
              onBlur={(e) => (e.target.style.background = 'rgba(0, 0, 0, 0.9)')}
              > 
                  <option value='7day'>Last 7 days</option>
                  <option value='1month'>Last month</option>
                  <option value='3month'>Last 3 months</option>
                  <option value='6month'>Last 6 months</option>
                  <option value='12month'>Last year</option>
                  <option value='overall'>All time</option>
                </select>

                <span 
                style={{
                  position:'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  color: '#aaa'
                }}> ▼
                  </span>
              </div>
              </div>


          {/* top artists */}
          {topArtists.length > 0 && (
            <div style={{ marginBottom: '40px'}}>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '20px'}}>Top Artists</h2>
              {topArtists.map((artist, index) => (
                <div key ={artist.name} style={{
                  padding: '12px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '8px',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <span style={{
                    color: '#0077b6',
                    fontWeight: 'bold',
                    fontSize: '1.2rem'
                  }}>
                    {index + 1}
                  </span>

                  <img
                  src={artistImages[artist.name] || 'https://via.placeholder.com/50?text=' + artist.name.charAt(0)}
                  alt={artist.name}
                  style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '8px',
                    objectFit: 'cover'
                  }}
                  >
                    </img>

                  <div> 
                    <div style={{ fontWeight: 'bold'}}>{artist.name}</div>
                    <div style={{ fontSize: '0.85rem', color: '#666' }}>
                     {artist.playcount} plays
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* top tracks */}
          {topTracks.length > 0 && (
            <div>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '20px'}}>Top Tracks</h2>
              {topTracks.map((track, index) => (
                console.log('Track name URL:', track.image?.[2]?.['#text']),
                <div key={track.name} style={{
                  padding: '12px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '8px',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <span style={{
                    color: '#023e8a',
                    fontWeight: 'bold',
                    fontSize: '1.2rem' 
                  }}>
                    {index + 1}
                  </span>

                  <img
                  src={trackImages[track.name] || 'https://via.placeholder.com/50'}
                  alt={track.name}
                  style={{
                    width: '50px',
                    height:'50px',
                    borderRadius: '8px',
                    objectFit: 'cover'
                  }}>
                  </img>

                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem'}}> {/* Fixed: was "0.9 rem" */}
                      {track.name}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#999'}}>
                      {track.artist.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#666'}}> {/* Fixed: was "0.75 rem" */}
                      {track.playcount} plays
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      

      <style>{`
body {
margin: 0;
padding: 0;
overflow-x: hidden;
}

        @keyframes spin{
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.6;
          }
        }

        input::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }
        `}
        </style>
    </div>
    </div>
  );
}

export default App;