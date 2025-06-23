'use client';

import { useUser } from '../../../context/UserContext';
import { useRouter } from 'next/navigation';
import { useState, useEffect, use, useRef, useCallback } from 'react';
import Hls from 'hls.js';
import React from 'react';
import { useFormState } from 'react-dom';

// Separate Video Player Component - completely isolated
const VideoPlayer = React.memo(({ videoData, onSeekTo, onTimeUpdate }) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoError, setVideoError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const videoRef = useRef(null);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const newTime = videoRef.current.currentTime;
      setCurrentTime(newTime);
      // Notify parent of time update
      if (onTimeUpdate) {
        onTimeUpdate(newTime, duration);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const newDuration = videoRef.current.duration;
      setDuration(newDuration);
      // Notify parent of duration update
      if (onTimeUpdate) {
        onTimeUpdate(currentTime, newDuration);
      }
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const seekTo = (time) => {
    console.log('seekTo called with time:', time, 'videoRef.current:', !!videoRef.current);
    if (videoRef.current) {
      // Ensure time is a valid number and handle 0 seconds properly
      const seekTime = Math.max(0, Number(time) || 0);
      console.log('Setting currentTime to:', seekTime);
      
      try {
        videoRef.current.currentTime = seekTime;
        setCurrentTime(seekTime);
        console.log('Successfully set currentTime to:', seekTime);
      } catch (error) {
        console.error('Error setting currentTime:', error);
        // Fallback: try to seek using a small delay
        setTimeout(() => {
          try {
            videoRef.current.currentTime = seekTime;
            setCurrentTime(seekTime);
            console.log('Successfully set currentTime with delay to:', seekTime);
          } catch (delayError) {
            console.error('Error setting currentTime with delay:', delayError);
          }
        }, 100);
      }
    } else {
      console.warn('videoRef.current is null, cannot seek');
    }
  };

  // Expose seekTo function to parent component (only once)
  useEffect(() => {
    if (onSeekTo) {
      onSeekTo(seekTo);
    }
  }, [onSeekTo]);

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Function to load HLS video
  const loadHlsVideo = (videoElement, hlsUrl) => {
    if (Hls.isSupported()) {
      const hls = new Hls({
        debug: false,
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        // Add configuration to handle buffer holes
        maxBufferLength: 30,
        maxMaxBufferLength: 600,
        maxBufferSize: 60 * 1000 * 1000, // 60MB
        maxBufferHole: 0.5,
        highBufferWatchdogPeriod: 2,
        nudgeOffset: 0.2,
        nudgeMaxRetry: 5,
        maxFragLookUpTolerance: 0.25,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10,
        // Enable gap handling
        enableSoftwareAES: true,
        // Better error recovery
        fragLoadingTimeOut: 20000,
        manifestLoadingTimeOut: 10000,
        levelLoadingTimeOut: 10000
      });
      
      hls.loadSource(hlsUrl);
      hls.attachMedia(videoElement);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('HLS manifest parsed successfully');
        setIsLoading(false);
        setVideoError(null);
        videoElement.play().catch(e => console.log('Auto-play prevented:', e));
      });
      
      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS error event:', event);
        console.error('HLS error data:', data);
        
        if (data.fatal) {
          setVideoError(`Video streaming error: ${data.details || 'Unknown error'}`);
          setIsLoading(false);
          switch(data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error('Fatal network error encountered, trying to recover...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error('Fatal media error encountered, trying to recover...');
              hls.recoverMediaError();
              break;
            default:
              console.error('Fatal error, destroying HLS instance');
              hls.destroy();
              break;
          }
        } else {
          // Handle non-fatal errors like buffer holes
          console.warn('Non-fatal HLS error:', data.details);
          
          if (data.details === 'bufferSeekOverHole') {
            console.log('Buffer hole detected, attempting to recover...');
            // Try to recover from buffer holes
            try {
              const currentTime = videoElement.currentTime;
              if (currentTime > 0) {
                // Seek to current time to trigger rebuffering
                videoElement.currentTime = currentTime;
              }
            } catch (seekError) {
              console.warn('Failed to recover from buffer hole:', seekError);
            }
          }
        }
      });

      // Add more event listeners for better debugging
      hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
        console.log('Fragment loaded:', data.frag.url);
      });

      hls.on(Hls.Events.FRAG_PARSED, (event, data) => {
        console.log('Fragment parsed successfully');
      });

      hls.on(Hls.Events.BUFFER_APPENDED, (event, data) => {
        console.log('Buffer appended, duration:', data.details);
      });

      hls.on(Hls.Events.BUFFER_EOS, () => {
        console.log('Buffer end of stream reached');
      });
      
      return hls;
    } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      videoElement.addEventListener('loadedmetadata', () => {
        console.log('Native HLS video loaded');
        setIsLoading(false);
        setVideoError(null);
        videoElement.play().catch(e => console.log('Auto-play prevented:', e));
      });
      videoElement.addEventListener('error', (e) => {
        console.error('Native HLS error:', e);
        setVideoError('Video playback error occurred');
        setIsLoading(false);
      });
      return null;
    } else {
      console.error('HLS is not supported in this browser');
      setVideoError('HLS video streaming is not supported in this browser');
      setIsLoading(false);
      return null;
    }
  };

  // Load HLS video when videoData changes
  useEffect(() => {
    if (videoData && videoData.hlsUrl && videoRef.current && !videoData.blobUrl) {
      let hlsInstance = null;
      let retryCount = 0;
      const maxRetries = 3;

      const loadVideo = () => {
        console.log(`Attempting to load HLS video (attempt ${retryCount + 1}/${maxRetries})`);
        hlsInstance = loadHlsVideo(videoRef.current, videoData.hlsUrl);
        
        if (hlsInstance) {
          hlsInstance.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal && retryCount < maxRetries) {
              console.log(`Fatal HLS error, retrying... (${retryCount + 1}/${maxRetries})`);
              retryCount++;
              setTimeout(() => {
                if (hlsInstance) {
                  hlsInstance.destroy();
                }
                loadVideo();
              }, 2000); // Wait 2 seconds before retry
            }
          });
        }
      };

      loadVideo();
      
      return () => {
        if (hlsInstance) {
          console.log('Cleaning up HLS instance');
          hlsInstance.destroy();
        }
      };
    }
  }, [videoData]);

  return (
    <div className="relative bg-black rounded-lg overflow-hidden shadow-2xl">
      {videoData && (videoData.blobUrl || videoData.hlsUrl) ? (
        <>
          {isLoading && (
            <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center z-10">
              <div className="text-center text-white">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-lg font-semibold">Loading video stream...</p>
                <p className="text-sm text-gray-300 mt-2">Please wait while we connect to the video server</p>
              </div>
            </div>
          )}
          
          {videoError && (
            <div className="absolute inset-0 bg-black bg-opacity-90 flex items-center justify-center z-10">
              <div className="text-center text-white max-w-md mx-auto p-6">
                <div className="w-16 h-16 bg-red-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2">Video Streaming Error</h3>
                <p className="text-gray-300 text-sm mb-4">{videoError}</p>
                <div className="space-y-2 text-xs text-gray-400">
                  <p>• Check your internet connection</p>
                  <p>• Try refreshing the page</p>
                  <p>• Contact support if the issue persists</p>
                </div>
                <button
                  onClick={() => {
                    setVideoError(null);
                    setIsLoading(true);
                    // Trigger video reload
                    if (videoRef.current) {
                      videoRef.current.load();
                    }
                  }}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Retry Video
                </button>
              </div>
            </div>
          )}
          
          <video
            ref={videoRef}
            src={videoData.blobUrl || undefined}
            className="w-full h-auto"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onError={(e) => {
              console.error('Video element error:', e);
              setVideoError('Video playback failed');
              setIsLoading(false);
            }}
            preload="metadata"
          >
            Your browser does not support the video tag.
          </video>
        </>
      ) : (
        <div className="w-full h-96 bg-gray-800 flex items-center justify-center">
          <div className="text-center text-white">
            <div className="w-24 h-24 bg-gray-600 rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Video Not Available</h3>
            <p className="text-gray-400 text-sm">
              No video source available for playback.
            </p>
            {videoData?.hlsUrl && (
              <div className="mt-4">
                <p className="text-gray-400 text-sm mb-2">
                  If the video doesn't play, try opening it directly:
                </p>
                <a 
                  href={videoData.hlsUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open Video Stream
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Custom Video Controls - Show if video is available */}
      {videoData && (videoData.blobUrl || videoData.hlsUrl) && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          {/* Progress Bar */}
          <div className="mb-3">
            <div 
              className="w-full bg-white/30 rounded-full h-1 cursor-pointer"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const percentage = clickX / rect.width;
                seekTo(percentage * duration);
              }}
            >
              <div 
                className="bg-blue-500 h-1 rounded-full transition-all duration-100"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={togglePlay}
                className="text-white hover:text-blue-400 transition-colors duration-200"
              >
                {isPlaying ? (
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                  </svg>
                ) : (
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                )}
              </button>
              
              <div className="text-white text-sm">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button className="text-white hover:text-blue-400 transition-colors duration-200">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                </svg>
              </button>
              
              <button className="text-white hover:text-blue-400 transition-colors duration-200">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

// Separate Chapters Component - also isolated
const ChaptersSection = React.memo(({ videoData, chapters, loading, seekTo, currentTime, duration }) => {
  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Use API chapters if available, otherwise fall back to generated chapters
  const getChapters = () => {
    if (chapters && chapters.length > 0) {
      // Transform API chapters to match the expected format
      return chapters.map(chapter => ({
        id: chapter.chapter_id,
        title: chapter.title,
        summary: chapter.summary,
        startTime: chapter.start_time,
        endTime: chapter.end_time,
        duration: chapter.end_time - chapter.start_time
      }));
    }
    
    // Fallback to generated chapters if no API chapters
    if (!duration || duration <= 0) return [];
    
    const generatedChapters = [];
    const chapterCount = Math.max(3, Math.floor(duration / 300)); // 1 chapter per 5 minutes, minimum 3
    
    for (let i = 0; i < chapterCount; i++) {
      const startTime = (duration / chapterCount) * i;
      const endTime = (duration / chapterCount) * (i + 1);
      generatedChapters.push({
        id: i + 1,
        title: `Chapter ${i + 1}`,
        summary: '',
        startTime,
        endTime,
        duration: endTime - startTime
      });
    }
    
    return generatedChapters;
  };

  const getCurrentChapter = () => {
    const allChapters = getChapters();
    if (!allChapters || allChapters.length === 0) {
      return { title: 'Loading...', startTime: 0, endTime: 0, duration: 0, summary: '' };
    }
    return allChapters.find(chapter => 
      currentTime >= chapter.startTime && currentTime < chapter.endTime
    ) || allChapters[0];
  };

  const allChapters = getChapters();
  const currentChapter = getCurrentChapter();

  const handleChapterClick = (startTime) => {
    if (seekTo) {
      seekTo(startTime);
    }
  };

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Chapters
      </h3>
      <p className="text-sm text-gray-500 mb-4">Navigate through lecture sections and track your progress</p>
      
      {/* Current Chapter Indicator */}
      <div className="bg-blue-50 rounded-lg p-4 mb-4 border border-blue-200">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
          <div>
            <p className="text-blue-700">{currentChapter?.title || 'Loading...'}</p>
            <p className="text-sm text-blue-600 mt-1">
              {formatTime(currentTime)} / {formatTime(duration)}
            </p>
            {currentChapter?.summary && (
              <p className="text-xs text-blue-600 mt-2 italic">
                {currentChapter.summary}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Chapter List */}
      <div className="space-y-2">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-3 rounded-lg bg-gray-50 animate-pulse">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : allChapters && allChapters.length > 0 ? (
          allChapters.map((chapter) => (
            <div
              key={chapter.id}
              className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                currentTime >= chapter.startTime && currentTime < chapter.endTime
                  ? 'bg-blue-100 border border-blue-300'
                  : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
              }`}
              onClick={() => handleChapterClick(chapter.startTime)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-800">{chapter.title}</h4>
                  <p className="text-sm text-gray-600">
                    {formatTime(chapter.startTime)} - {formatTime(chapter.endTime)}
                  </p>
                  {chapter.summary && (
                    <p className="text-xs text-gray-500 mt-1 italic line-clamp-2">
                      {chapter.summary}
                    </p>
                  )}
                </div>
                <div className="text-xs text-gray-500 ml-2 flex-shrink-0">
                  {formatTime(chapter.duration)}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-4 text-gray-500 text-sm">
            <p>Chapters will appear here once video loads</p>
          </div>
        )}
      </div>
    </div>
  );
});

export default function VideoPage({ params }) {
  const { videoId } = use(params);
  
  try {

    const { userRole, userName, isLoggedIn } = useUser(); 
    const router = useRouter();
    const [videoData, setVideoData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showChapters, setShowChapters] = useState(true);
    const [isAnalyzing, setIsAnalyzing] = useState(true);
    const [analysisComplete, setAnalysisComplete] = useState(false);
    const [generatedContent, setGeneratedContent] = useState({
      chapters: false,
      summary: '',
      keyTakeaways: false,
      pacingRecommendations: false,
      quizQuestions: false,
    });
    const [quizChapterSelect, setQuizChapterSelect] = useState(1);

    const [generatedTitle, setGeneratedTitle] = useState(null);
    const [generatedHashtags, setGeneratedHashtags] = useState(null);
    const [generatedTopics, setGeneratedTopics] = useState(null);
    const [titleCompleted, setTitleCompleted] = useState(false);
    const [hashtagsCompleted, setHashtagsCompleted] = useState(false);
    const [topicsCompleted, setTopicsCompleted] = useState(false);
    const [chaptersLoading, setChaptersLoading] = useState(true);
    const [videoSeekTo, setVideoSeekTo] = useState(null);
    const [videoCurrentTime, setVideoCurrentTime] = useState(0);
    const [videoDuration, setVideoDuration] = useState(0);
    const [publishing, setPublishing] = useState(false);

    const handleVideoSeekTo = useCallback((seekFunction) => {
      setVideoSeekTo(() => seekFunction);
    }, []);

    const handleVideoTimeUpdate = useCallback((currentTime, duration) => {
      if (currentTime >= 0) {
        setVideoCurrentTime(currentTime);
      }
      if (duration > 0) {
        setVideoDuration(duration);
      }
    }, []);

    const handleChapterClick = useCallback((time, chapterId = null) => {
      console.log('handleChapterClick called with time:', time, 'chapterId:', chapterId, 'videoSeekTo:', !!videoSeekTo);
      
      if (time !== null && time !== undefined) {
        console.log('Attempting to seek to time:', time);
        if (videoSeekTo) {
          videoSeekTo(time);
        } else {
          console.warn('videoSeekTo function is not available');
        }
      } else {
        console.warn('Time is null or undefined, skipping seek');
      }
      
      if (chapterId !== null && chapterId !== undefined) {
        console.log('Setting quizChapterSelect to:', chapterId);
        setQuizChapterSelect(chapterId);
      } else {
        console.log('chapterId is null or undefined, skipping quiz selection');
      }
    }, [videoSeekTo]);

    useEffect(() => {
      // For now, we'll get video data from localStorage
      // In a real app, you'd fetch this from your API
      
      console.log('Video ID:', videoId);
      console.log('Initial loading state:', loading);
      console.log('Environment variables check:');
      console.log('API URL:', process.env.NEXT_PUBLIC_API_URL);
      console.log('TwelveLabs API Key exists:', !!process.env.NEXT_PUBLIC_TWELVE_LABS_API_KEY);
      console.log('TwelveLabs Index ID:', process.env.NEXT_PUBLIC_TWELVE_LABS_INDEX_ID);

      // Add a timeout to prevent infinite loading
      const loadingTimeout = setTimeout(() => {
        console.log('Loading timeout reached, setting fallback data');
        if (loading) {
          const fallbackData = {
            name: 'Video Loading Timeout',
            size: 0,
            date: new Date().toISOString(),
            blob: null,
            blobUrl: null,
            twelveLabsVideoId: videoId,
            uploadDate: new Date().toISOString()
          };
          setVideoData(fallbackData);
          setLoading(false);
        }
      }, 10000); // 10 second timeout

      // If not in localStorage, fetch from TwelveLabs API
      const options = {
        method: 'GET',
        headers: {
          'x-api-key': process.env.NEXT_PUBLIC_TWELVE_LABS_API_KEY
        }
      }

      const fetchVideo = async () => {
        //console.log('Fetching video data from TwelveLabs...');
        const retrievalURL = `https://api.twelvelabs.io/v1.3/indexes/${process.env.NEXT_PUBLIC_TWELVE_LABS_INDEX_ID}/videos/${videoId}?transcription=true`
        try {
          const retrieveVideoResponse = await fetch(retrievalURL, options);
          //console.log('Response status:', retrieveVideoResponse.status);
          
          if (!retrieveVideoResponse.ok) {
            throw new Error(`HTTP ${retrieveVideoResponse.status}: ${retrieveVideoResponse.statusText}`);
          }
          
          const result = await retrieveVideoResponse.json();
          //console.log('Retrieved video data:', result);

          // Create a fallback video data structure
          const videoData = {
            name: result.system_metadata?.filename || 'Unknown Video',
            size: result.system_metadata?.duration || 0,
            date: result.created_at || new Date().toISOString(),
            blob: null,
            blobUrl: null, // We'll handle this differently
            twelveLabsVideoId: videoId,
            uploadDate: result.created_at || new Date().toISOString(),
            // Store the HLS URL separately for potential future use
            hlsUrl: result.hls?.video_url || null
          }

          console.log('Setting video data:', videoData);
          setVideoData(videoData);
          console.log('Setting loading to false');
          setLoading(false);
          console.log('State updates completed');
          clearTimeout(loadingTimeout);
        } catch (error) {
          console.error('Error fetching video data:', error);
          // Set a fallback video data
          const fallbackData = {
            name: 'Video Not Found',
            size: 0,
            date: new Date().toISOString(),
            blob: null,
            blobUrl: null,
            twelveLabsVideoId: videoId,
            uploadDate: new Date().toISOString()
          };
          console.log('Setting fallback video data:', fallbackData);
          setVideoData(fallbackData);
          console.log('Setting loading to false (error case)');
          setLoading(false);
          clearTimeout(loadingTimeout);
        }
      }

      const fetchExistingCourseMetadata = async () => {
        try {
          console.log('Checking for existing course metadata...');
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/fetch_course_metadata`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ video_id: videoId })
          });

          if (response.ok) {
            const result = await response.json();
            console.log('Found existing course metadata:', result.data);
            
            // Set the existing course data
            setGeneratedContent({
              chapters: result.data.chapters || false,
              summary: result.data.summary || '',
              keyTakeaways: result.data.key_takeaways || false,
              pacingRecommendations: result.data.pacing_recommendations || false,
              quizQuestions: result.data.quiz_questions || false,
            });
            
            // Set the title from existing metadata
            setGeneratedTitle(result.data.title || null);
            
            // Fetch HLS video URL for existing course
            try {
              console.log('Fetching HLS video URL for existing course...');
              const hlsResponse = await fetch('/api/fetch-hls-video', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ videoId })
              });

              if (hlsResponse.ok) {
                const hlsResult = await hlsResponse.json();
                console.log('HLS video URL fetched:', hlsResult.data.hlsUrl);
                
                // Update video data with HLS URL
                setVideoData(prevData => ({
                  ...prevData,
                  hlsUrl: hlsResult.data.hlsUrl,
                  name: hlsResult.data.title || prevData?.name,
                  size: hlsResult.data.duration || prevData?.size
                }));
              } else {
                console.warn('Failed to fetch HLS video URL for existing course');
              }
            } catch (hlsError) {
              console.error('Error fetching HLS video URL:', hlsError);
            }
            
            // Mark analysis as complete since we have existing data
            setIsAnalyzing(false);
            setAnalysisComplete(true);
            setChaptersLoading(false);
            
            console.log('Using existing course metadata');
          } else {
            console.log('No existing course metadata found, will generate new content');
          }
        } catch (error) {
          console.error('Error checking for existing course metadata:', error);
        }
      }

      const fetchCachedAnalysis = async () => {
        try {
          console.log('Fetching cached analysis...');
          const cachedAnalysisResult = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/cached_analysis`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({twelve_labs_video_id: videoId})
          });

          console.log('Cached analysis response status:', cachedAnalysisResult.status);
          
          if (!cachedAnalysisResult.ok) {
            console.warn('Cached analysis failed, continuing without it');
            return;
          }

          const result = await cachedAnalysisResult.json();
          console.log('Cached analysis result:', result);

          if (result && result.data && result.data.twelve_labs) {
            const twelveLabsData = result.data.twelve_labs;
            setGeneratedTitle(twelveLabsData.title || null);
            setGeneratedHashtags(twelveLabsData.hashtags || null);
            setGeneratedTopics(twelveLabsData.topics || null);
          } else {
            console.warn('Cached analysis data structure is not as expected:', result);
            setGeneratedTitle(null);
            setGeneratedHashtags(null);
            setGeneratedTopics(null);
          }
        } catch (error) {
          console.error('Error fetching cached analysis:', error);
          setGeneratedTitle(null);
          setGeneratedHashtags(null);
          setGeneratedTopics(null);
        }
      }

      const generateChapters = async () => {
        try {
          console.log('Generating chapters...');
          setChaptersLoading(true);
          const chaptersResult = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/generate_chapters`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({twelve_labs_video_id: videoId})
          });
          
          if (!chaptersResult.ok) {
            throw new Error(`HTTP ${chaptersResult.status}: ${chaptersResult.statusText}`);
          }
          
          const result = await chaptersResult.json();
          console.log('Chapters generation result:', result);
          
          if (result && result.data && result.data.chapters) {
            console.log('Chapters generated successfully:', result.data.chapters);
            setGeneratedContent(prev => ({
              ...prev,
              chapters: result.data.chapters,
            }));
            setChaptersLoading(false);
          } else if (result && result.chapters) {
            // Handle case where chapters are directly in the result
            console.log('Chapters found in result:', result.chapters);
            setGeneratedContent(prev => ({
              ...prev,
              chapters: result.chapters,
            }));
            setChaptersLoading(false);
          } else {
            console.warn('Chapters generation result is not as expected:', result);
            setGeneratedContent(prev => ({
              ...prev,
              chapters: null,
            }));
            setChaptersLoading(false);
          }
        } catch (error) {
          console.error('Error generating chapters:', error);
          setGeneratedContent(prev => ({
            ...prev,
            chapters: null,
          }));
          setChaptersLoading(false);
        }
      }

      const generateKeyTakeaways = async () => {
        try {
          console.log('Generating key takeaways...');
          const keyTakeawaysResult = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/generate_key_takeaways`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({twelve_labs_video_id: videoId})
          });
          
          if (!keyTakeawaysResult.ok) {
            throw new Error(`HTTP ${keyTakeawaysResult.status}: ${keyTakeawaysResult.statusText}`);
          }

          const result = await keyTakeawaysResult.json();
          console.log('Key takeaways generation result:', result);
          
          if (result && result.data && result.data.key_takeaways) {
            console.log('Key takeaways generated successfully:', result.data.key_takeaways);
            setGeneratedContent(prev => ({
              ...prev,
              keyTakeaways: result.data.key_takeaways,
            }));
          } else {
            console.warn('Key takeaways generation result is not as expected:', result);
            setGeneratedContent(prev => ({
              ...prev,
              keyTakeaways: null,
            }));
          }
        } catch (error) {
          console.error('Error generating key takeaways:', error);
          setGeneratedContent(prev => ({
            ...prev,
            keyTakeaways: null,
          }));
        }
      }

      const generatePacingRecommendations = async () => {
        try {
          const pacingRecommendationsResult = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/generate_pacing_recommendations`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({twelve_labs_video_id: videoId})
          });
          
          if (!pacingRecommendationsResult.ok) {
            throw new Error(`HTTP ${pacingRecommendationsResult.status}: ${pacingRecommendationsResult.statusText}`);
          }
          
          const result = await pacingRecommendationsResult.json();
          console.log('Pacing recommendations generation result:', result);
          
          if (result && result.data && result.data.recommendations) {
            console.log('Pacing recommendations generated successfully:', result.data.pacing_recommendations);
            setGeneratedContent(prev => ({
              ...prev,
              pacingRecommendations: result.data.recommendations,
            }));
          } else {
            console.warn('Pacing recommendations generation result is not as expected:', result);
            setGeneratedContent(prev => ({
              ...prev,
              pacingRecommendations: null,
            }));
          }
        } catch (error) {
          console.error('Error generating pacing recommendations:', error);
          setGeneratedContent(prev => ({
            ...prev,
            pacingRecommendations: null,
          }));
        }
      }

      const generateQuizQuestions = async () => {
        try {
          const quizQuestionsResult = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/generate_quiz_questions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({twelve_labs_video_id: videoId})
          });
          
          if (!quizQuestionsResult.ok) {
            throw new Error(`HTTP ${quizQuestionsResult.status}: ${quizQuestionsResult.statusText}`);
          }

          const result = await quizQuestionsResult.json();
          console.log('Quiz questions generation result:', result);
          
          if (result && result.data && result.data.quiz_questions) {
            console.log('Quiz questions generated successfully:', result.data.quiz_questions);
            setGeneratedContent(prev => ({
              ...prev,
              quizQuestions: result.data.quiz_questions,
            }));
          } else {
            console.warn('Quiz questions generation result is not as expected:', result);
            setGeneratedContent(prev => ({
              ...prev,
              quizQuestions: null,
            }));
          }
        } catch (error) {
          console.error('Error generating quiz questions:', error);
          setGeneratedContent(prev => ({
            ...prev,
            quizQuestions: null,
          }));
        }
      }

      // Main execution flow
      const initializeCourse = async () => {
        // First, fetch video data
        await fetchVideo();
        
        // Then check for existing course metadata
        const hasExistingData = await fetchExistingCourseMetadata();

        console.log('hasExistingData', hasExistingData)
        
        if (hasExistingData) {
          // If we have existing data, just fetch cached analysis for title/hashtags/topics
          await fetchCachedAnalysis();
        } else {
          console.log('no existing data, generating new content')
          // If no existing data, generate new content
          setIsAnalyzing(true);
          setAnalysisComplete(false);
          await fetchCachedAnalysis();
          await generateChapters();
          await analyzeLectureWithAI();
          await generateKeyTakeaways();
          await generatePacingRecommendations();
          await generateQuizQuestions();
        }
      };

      // Start the initialization
      initializeCourse();

      // Cleanup timeout on unmount
      return () => clearTimeout(loadingTimeout);
    }, [videoId]);


    // Helper function to calculate progress percentage
    const calculateProgress = () => {
      const contentTypes = Object.keys(generatedContent);
      let completedCount = 0;
      
      contentTypes.forEach(key => {
        const value = generatedContent[key];
        if (key === 'chapters') {
          // Chapters is complete if it's an array with content
          if (Array.isArray(value) && value.length > 0) {
            completedCount++;
          }
        } else if (key === 'summary') {
          // Summary is complete if it has content
          if (value && typeof value === 'string' && value.trim() !== '') {
            completedCount++;
          }
        } else {
          // Other fields are complete if they have truthy values
          if (value) {
            completedCount++;
          }
        }
      });
      
      return Math.round((completedCount / contentTypes.length) * 100);
    };

    // Effect to handle completion when progress reaches 100%
    useEffect(() => {
      if (isAnalyzing && calculateProgress() === 100) {
        setIsAnalyzing(false);
        setAnalysisComplete(true);
      }
    }, [generatedContent, isAnalyzing]);

    const analyzeLectureWithAI = async () => {
      setIsAnalyzing(true);
      setAnalysisComplete(false);

      console.log('running analysis...')

      try {
        console.log('Running analysis...');
        
        const eventSource = new EventSource(`${process.env.NEXT_PUBLIC_API_URL}/run_analysis?video_id=${videoId}`);

        eventSource.onopen = () => {
            console.log('Event source opened');
        }

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('Message received:', data);
            
            if (data.type === 'summary' && data.status === 'in_progress') {
              setGeneratedContent(prev => ({
                ...prev,
                summary: prev.summary + data.content,
              }));
            } else if (data.status === 'complete') {
                const progress = calculateProgress();

                if (progress === 100) {
                    setAnalysisComplete(true);
                    setIsAnalyzing(false);
                    eventSource.close();
                }
            }
          } catch (error) {
            console.error('Error parsing SSE data:', error);
          }
        };

        eventSource.onerror = (error) => {
          eventSource.close();
        };

      } catch (error) {
        console.error('Error analyzing lecture:', error);
        setIsAnalyzing(false);
      }
    };

    // Skeleton loading components
    const SkeletonLoader = ({ className = "" }) => (
      <div className={`animate-pulse bg-gray-200 rounded ${className}`}></div>
    );

    const ContentSkeleton = ({ title, icon, color, description }) => (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-1 flex items-center gap-2">
          {icon}
          {title}
        </h3>
        <p className="text-sm text-gray-500 mb-4">{description}</p>
        <div className="space-y-3">
          <SkeletonLoader className="h-12 w-full" />
          <SkeletonLoader className="h-12 w-full" />
          <SkeletonLoader className="h-12 w-full" />
          <SkeletonLoader className="h-3/4" />
        </div>
      </div>
    );

    const Typewriter = ({ text, speed = 50, className = "" }) => {
      if (!text) {
        return null;
      }

      const [displayText, setDisplayText] = useState('');
      const [currentIndex, setCurrentIndex] = useState(0);
      const [hasAnimated, setHasAnimated] = useState(false);

      useEffect(() => {
        if (!text) return;

        // If we've already animated this text, just show it immediately
        if (hasAnimated) {
          setDisplayText(text);
          return;
        }

        if (currentIndex < text.length) {
          const timer = setTimeout(() => {
            setDisplayText(prev => prev + text[currentIndex]);
            setCurrentIndex(prev => prev + 1);
          }, speed);

          return () => clearTimeout(timer);
        } else if (currentIndex === text.length && !hasAnimated) {
          // Animation completed
          setHasAnimated(true);
        }
      }, [text, currentIndex, speed, hasAnimated]);

      // Reset only when text actually changes to something different
      useEffect(() => {
        if (text && text !== displayText && !hasAnimated) {
          setDisplayText('');
          setCurrentIndex(0);
          setHasAnimated(false);
        }
      }, [text]);

      return (
        <span className={className}>
          {displayText}
          {currentIndex < text.length && !hasAnimated && (
            <span className="animate-pulse">|</span>
          )}
        </span>
      );
    };

    // Cached Analysis Display Component
    const CachedAnalysisDisplay = ({ title, hashtags, topics }) => {
      // Ensure we have valid data before proceeding
      const hasValidTitle = title && typeof title === 'string' && title.trim() !== '';
      const hasValidHashtags = hashtags && Array.isArray(hashtags) && hashtags.length > 0;
      const hasValidTopics = topics && Array.isArray(topics) && topics.length > 0;
      
      // Return null if there's no valid data to display
      if (!hasValidTitle && !hasValidHashtags && !hasValidTopics) {
        return null;
      }

      useEffect(() => {
        if (hasValidTitle) {
          setTimeout(() => {
            setTitleCompleted(true);
          }, 2000);
        }
        if (hasValidHashtags) {
          setTimeout(() => {
            setHashtagsCompleted(true);
          }, 2000);
        }
        if (hasValidTopics) {
          setTimeout(() => {
            setTopicsCompleted(true);
          }, 2000);
        }
      }, [hasValidTitle, hasValidHashtags, hasValidTopics]);
      

      // Show everything immediately if already completed
      if (titleCompleted && hashtagsCompleted && topicsCompleted) {
        return (
          <div className="mb-8">
            {hasValidTitle && (
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {title}
              </h2>
            )}
            {hasValidHashtags && (
              <div className="flex flex-wrap gap-2 mb-2">
                {hashtags.map((hashtag, idx) => (
                  <span key={idx} className="text-blue-700 bg-blue-100 px-3 py-1 rounded-full text-sm font-medium">#{hashtag}</span>
                ))}
              </div>
            )}
            {hasValidTopics && (
              <div className="flex flex-wrap gap-2">
                {topics.map((topic, idx) => (
                  <span key={idx} className="bg-gray-200 text-gray-800 px-3 py-1 rounded-full text-sm font-medium">{topic}</span>
                ))}
              </div>
            )}
          </div>
        );
      }

      return (
        <div className="mb-8">
          {!titleCompleted && hasValidTitle && (
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              <Typewriter text={title} speed={30} className="inline-block" />
            </h2>
          )}
          {!hashtagsCompleted && hasValidHashtags && (
            <div className="flex flex-wrap gap-2 mb-2 animate-fade-in">
              {hashtags.map((hashtag, idx) => (
                <span key={idx} className="text-blue-700 bg-blue-100 px-3 py-1 rounded-full text-sm font-medium">#{hashtag}</span>
              ))}
            </div>
          )}
          {!topicsCompleted && hasValidTopics && (
            <div className="flex flex-wrap gap-2 animate-fade-in">
              {topics.map((topic, idx) => (
                <span key={idx} className="bg-gray-200 text-gray-800 px-3 py-1 rounded-full text-sm font-medium">{topic}</span>
              ))}
            </div>
          )}
        </div>
      );
    };

    const handlePublish = async () => {
      setPublishing(true);
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/publish_course`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            video_id: videoId,
            summary: generatedContent.summary || '',
            title: generatedTitle || videoData?.name,
            chapters: generatedContent.chapters,
            quiz_questions: generatedContent.quizQuestions,
            key_takeaways: generatedContent.keyTakeaways,
            pacing_recommendations: generatedContent.pacingRecommendations
          }),
        });

        if (response.ok) {
          const result = await response.json();
          console.log('Course published successfully:', result);
          // Show success notification
          alert('Course published successfully!');
          // Redirect back to dashboard
          router.push('/dashboard');
        } else {
          throw new Error('Failed to publish course');
        }
      } catch (error) {
        console.error('Error publishing course:', error);
        alert('Failed to publish course. Please try again.');
      } finally {
        setPublishing(false);
      }
    };

    if (loading) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-white to-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Loading Video...</h2>
            <p className="text-gray-600">Please wait while we load your lecture video</p>
            <p className="text-sm text-gray-500 mt-2">Video ID: {videoId}</p>
          </div>
        </div>
      );
    }

    if (!videoData) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-white to-gray-50">
          {/* Header */}
          <div className="bg-white shadow-sm border-b">
            <div className="max-w-7xl mx-auto px-6 py-4">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-bold text-gray-800">Video Not Found</h1>
                  <p className="text-gray-600 text-sm">Video ID: {videoId}</p>
                </div>
                <button
                  onClick={() => router.push('/dashboard/courses')}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors duration-200 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Courses
                </button>
              </div>
            </div>
          </div>

          <div className="flex h-screen">
            {/* Left Side - Main Content Area */}
            <div className="flex-1 flex flex-col">
              {/* Top Section - Video Player */}
              <div className="flex-1 bg-black flex items-center justify-center p-6">
                <div className="text-center text-white">
                  <div className="w-32 h-32 bg-gray-800 rounded-full mx-auto mb-6 flex items-center justify-center">
                    <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold mb-2">Video Not Found</h2>
                  <p className="text-gray-400 mb-4">The requested video could not be loaded</p>
                  <button
                    onClick={() => router.push('/dashboard/courses')}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                  >
                    Back to Courses
                  </button>
                </div>
              </div>

              {/* Bottom Section - Content Area */}
              <div className="bg-white border-t border-gray-200 p-6">
                <div className="max-w-6xl mx-auto">
                  <div className="text-center text-gray-500">
                    <p>No video content available</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side - Sidebar */}
            <div className="w-80 bg-white border-l border-gray-200 p-6">
              <div className="text-center text-gray-500">
                <p>No video information available</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="h-screen bg-gradient-to-br from-white to-gray-50 flex flex-col">
        {/* Header */}
        <div className="bg-white shadow-sm border-b flex-shrink-0">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">{videoData.name}</h1>
                <p className="text-gray-600 text-sm">Video ID: {videoId}</p>
              </div>
              <button
                onClick={() => router.push('/dashboard/courses')}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors duration-200 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Courses
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-1 overflow-y-hidden">
          {/* Main Content Area */}
          <main className="flex-1 flex flex-col overflow-y-auto">
            {/* Video Player */}
            <div className="bg-black flex items-center justify-center p-6">
              <div className="w-full max-w-4xl">
                <VideoPlayer videoData={videoData} onSeekTo={handleVideoSeekTo} onTimeUpdate={handleVideoTimeUpdate} />
              </div>
            </div>

            {/* Content Area Below Player */}
            <div className="p-6">
              <div className="max-w-6xl mx-auto">
                {/* Cached Analysis Results */}
                {(generatedTitle || (generatedHashtags && Array.isArray(generatedHashtags) && generatedHashtags.length > 0) || (generatedTopics && Array.isArray(generatedTopics) && generatedTopics.length > 0)) && (
                  <CachedAnalysisDisplay 
                    title={generatedTitle}
                    hashtags={generatedHashtags}
                    topics={generatedTopics}
                  />
                )}

                {/* AI Generation Status */}
                {isAnalyzing && (
                  <div className="mb-8 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-200">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <div>
                        <h2 className="text-xl font-bold text-blue-800">AI Content Generation in Progress</h2>
                        <p className="text-blue-600">Analyzing your lecture video and generating comprehensive educational content...</p>
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="w-full bg-blue-200 rounded-full h-3 mb-3">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-500 ease-out shadow-sm"
                        style={{ 
                          width: `${calculateProgress()}%` 
                        }}
                      ></div>
                    </div>
                    
                    {/* Progress Text */}
                    <div className="flex items-center justify-between text-sm text-blue-700">
                      <span>Generating chapters, summaries, quizzes, and study materials...</span>
                      <span className="font-medium">
                        {calculateProgress()}% Complete
                      </span>
                    </div>
                  </div>
                )}

                {/* AI Content Generated Success */}
                {!isAnalyzing && calculateProgress() === 100 && (
                  <div className="mb-8 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-green-800">AI Content Generated</h2>
                        <p className="text-green-600">Your lecture has been successfully analyzed and all educational content is ready!</p>
                      </div>
                    </div>
                    
                    {/* Progress Bar - Full */}
                    <div className="w-full bg-green-200 rounded-full h-3 mb-3">
                      <div 
                        className="bg-gradient-to-r from-green-500 to-emerald-600 h-3 rounded-full transition-all duration-500 ease-out shadow-sm"
                        style={{ 
                          width: '100%' 
                        }}
                      ></div>
                    </div>
                    
                    {/* Success Text */}
                    <div className="flex items-center justify-between text-sm text-green-700">
                      <span>All content generated successfully - ready for publishing</span>
                      <span className="font-medium">
                        100% Complete
                      </span>
                    </div>
                  </div>
                )}

                {/* Content Sections */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Video Summary */}
                  {generatedContent.summary ? (
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-800 mb-1 flex items-center gap-2">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Video Summary
                      </h3>
                      <p className="text-sm text-gray-500 mb-4">Comprehensive overview of the lecture content and key points covered</p>
                      <div className="space-y-3">
                        <p className="text-gray-700">{generatedContent.summary}</p>
                      </div>
                    </div>
                  ) : (
                    <ContentSkeleton 
                      title="Video Summary"
                      icon={<svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>}
                      color="green"
                      description="Comprehensive overview of the lecture content and key points covered"
                    />
                  )}

                  {/* Key Takeaways */}
                  {generatedContent.keyTakeaways && Array.isArray(generatedContent.keyTakeaways) && generatedContent.keyTakeaways.length > 0 ? (
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-800 mb-1 flex items-center gap-2">
                        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        Key Takeaways
                      </h3>
                      <p className="text-sm text-gray-500 mb-4">Essential concepts and insights to remember from this lecture</p>
                      <div className="space-y-3">
                        {generatedContent.keyTakeaways.map((keyTakeaway, index) => (
                          <div className="flex items-start gap-3" key={index}> 
                            <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                            <p className="text-gray-700">{keyTakeaway}</p>
                          </div>
                        ))}
                        
                      </div>
                    </div>
                  ) : (
                    <ContentSkeleton 
                      title="Key Takeaways"
                      icon={<svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>}
                      color="purple"
                      description="Essential concepts and insights to remember from this lecture"
                    />
                  )}

                  {/* Pacing Recommendations */}
                  {generatedContent.pacingRecommendations && Array.isArray(generatedContent.pacingRecommendations) && generatedContent.pacingRecommendations.length > 0 ? (
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-800 mb-1 flex items-center gap-2">
                        <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Pacing Recommendations
                      </h3>
                      <p className="text-sm text-gray-500 mb-4">Suggested study schedule and time allocation for optimal learning</p>
                      <div className="space-y-3">
                        {generatedContent.pacingRecommendations.map((pacingRecommendation, index) => (
                          <div className="flex flex-col p-4 bg-orange-50 rounded-lg space-y-2" key={index}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-sm text-orange-600">
                                  {Math.floor(pacingRecommendation.start_time / 60)}:{String(Math.floor(pacingRecommendation.start_time % 60)).padStart(2, '0')} - 
                                  {Math.floor(pacingRecommendation.end_time / 60)}:{String(Math.floor(pacingRecommendation.end_time % 60)).padStart(2, '0')}
                                </span>
                              </div>
                              <span className={`text-sm font-medium px-2 py-1 rounded ${
                                pacingRecommendation.severity === 'High' ? 'bg-red-100 text-red-700' :
                                pacingRecommendation.severity === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-green-100 text-green-700'
                              }`}>
                                {pacingRecommendation.severity}
                              </span>
                            </div>
                            <p className="text-gray-700">{pacingRecommendation.recommendation}</p>
                          </div>
                        ))}
                        
                      </div>
                    </div>
                  ) : (
                    <ContentSkeleton 
                      title="Pacing Recommendations"
                      icon={<svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>}
                      color="orange"
                      description="Suggested study schedule and time allocation for optimal learning"
                    />
                  )}

                  {/* Study Notes */}
                  {generatedContent.notes ? (
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-800 mb-1 flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Study Notes
                      </h3>
                      <p className="text-sm text-gray-500 mb-4">Detailed notes and important concepts from the lecture</p>
                      <div className="space-y-3">
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <h4 className="font-medium text-blue-800 mb-2">Frontend Development</h4>
                          <p className="text-blue-700 text-sm">Focus on responsive design and modern CSS frameworks. Understand component-based architecture.</p>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <h4 className="font-medium text-blue-800 mb-2">Backend Integration</h4>
                          <p className="text-blue-700 text-sm">Learn API design patterns and database optimization techniques.</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <ContentSkeleton 
                      title="Study Notes"
                      icon={<svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>}
                      color="blue"
                      description="Detailed notes and important concepts from the lecture"
                    />
                  )}
                </div>

                {/* Chapters Section - Full Width */}
                {generatedContent.chapters && generatedContent.chapters.length > 0 && (
                  <div className="mt-8">
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Lecture Quiz (By Chapter)
                      </h3>
                      <p className="text-sm text-gray-500 mb-6">Detailed breakdown of lecture sections with summaries and timestamps</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {generatedContent.chapters.map((chapter) => (
                          <div key={chapter.chapter_id + 'chapter'}>
                             <div
                              key={chapter.chapter_id}
                              className={`rounded-lg p-4 border transition-colors duration-200 cursor-pointer ${
                                videoCurrentTime >= chapter.start_time && videoCurrentTime < chapter.end_time
                                  ? 'bg-indigo-50 border-indigo-300'
                                  : 'bg-gray-50 border-gray-200 hover:border-indigo-300'
                              }`}
                              onClick={() => handleChapterClick(chapter.start_time, chapter.chapter_id)}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <h4 className="font-medium text-gray-800 text-sm">{chapter.title}</h4>
                                <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded">
                                  {Math.floor(chapter.start_time / 60)}:{(chapter.start_time % 60).toString().padStart(2, '0')}
                                </span>
                              </div>
                              <p className="text-xs text-gray-600 line-clamp-3">
                                {chapter.summary}
                              </p>
                              <div className="mt-3 pt-2 border-t border-gray-200">
                                <span className="text-xs text-gray-500">
                                  Duration: {Math.floor((chapter.end_time - chapter.start_time) / 60)}:{((chapter.end_time - chapter.start_time) % 60).toString().padStart(2, '0')}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Quiz Questions Display - Full Width */}
                      {quizChapterSelect && generatedContent.quizQuestions && (
                        <div className="mt-8 w-full p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
                          {(() => {
                            const selectedChapter = generatedContent.chapters?.find(ch => ch.chapter_id === quizChapterSelect);
                            const chapterQuestions = generatedContent.quizQuestions.filter(q => q.chapter_id === quizChapterSelect);
                            
                            return (
                              <div>
                                <div className="flex items-center justify-between mb-6">
                                  <h4 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Quiz Questions - {selectedChapter?.title || 'Chapter'}
                                  </h4>
                                  <div className="flex items-center gap-4">
                                    <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                                      {chapterQuestions.length} questions
                                    </span>
                                    <button 
                                      onClick={() => setQuizChapterSelect(null)}
                                      className="text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                                
                                {chapterQuestions.length > 0 ? (
                                  <div className="space-y-6">
                                    {chapterQuestions.map((question, questionIndex) => {
                                      // Create A,B,C,D options by combining correct answer with wrong answers
                                      const allOptions = [question.answer, ...question.wrong_answers];
                                      // Shuffle the options to randomize A,B,C,D
                                      const shuffledOptions = allOptions.sort(() => Math.random() - 0.5);
                                      const correctOptionIndex = shuffledOptions.indexOf(question.answer);
                                      const optionLabels = ['A', 'B', 'C', 'D'];
                                      
                                      return (
                                        <div key={`${quizChapterSelect}-${questionIndex}`} className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                                          <div className="flex items-start gap-4 mb-4">
                                            <div className="flex-shrink-0 w-8 h-8 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-sm font-semibold">
                                              {questionIndex + 1}
                                            </div>
                                            <div className="flex-1">
                                              <h5 className="font-medium text-gray-800 text-lg mb-4">{question.question}</h5>
                                              
                                              <div className="space-y-3">
                                                {shuffledOptions.map((option, optionIndex) => (
                                                  <div 
                                                    key={optionIndex}
                                                    className={`p-4 rounded-lg border-2 transition-all ${
                                                      optionIndex === correctOptionIndex
                                                        ? 'bg-green-50 border-green-300 text-green-800'
                                                        : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                                                    }`}
                                                  >
                                                    <div className="flex items-center gap-3">
                                                      <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-semibold ${
                                                        optionIndex === correctOptionIndex
                                                          ? 'bg-green-500 text-white'
                                                          : 'bg-gray-200 text-gray-600'
                                                      }`}>
                                                        {optionLabels[optionIndex]}
                                                      </div>
                                                      <span className="font-medium">{option}</span>
                                                      {optionIndex === correctOptionIndex && (
                                                        <div className="ml-auto">
                                                          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                          </svg>
                                                        </div>
                                                      )}
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                              
                                              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                                                <div className="flex items-center gap-2">
                                                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                  </svg>
                                                  <span className="text-sm font-semibold text-green-700">Correct Answer: {optionLabels[correctOptionIndex]}</span>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="text-center py-12">
                                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <h3 className="text-lg font-semibold text-gray-800 mb-2">No Quiz Questions Available</h3>
                                    <p className="text-gray-500 text-sm">No quiz questions have been generated for this chapter yet.</p>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Publish Button Section */}
            <div className="mt-8 p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Ready to Publish?</h3>
                  <p className="text-sm text-gray-600">
                    Publish this course to make it available to your students. All generated content will be included.
                  </p>
                </div>
                <button
                  onClick={handlePublish}
                  disabled={publishing || !generatedContent.chapters}
                  className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                    publishing || !generatedContent.chapters
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700 shadow-md hover:shadow-lg'
                  }`}
                >
                  {publishing ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Publishing...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Publish Course
                    </>
                  )}
                </button>
              </div>
              
              {!generatedContent.chapters && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span className="text-sm text-yellow-700">
                      Generate content first before publishing
                    </span>
                  </div>
                </div>
              )}
            </div>
          </main>

          {/* Right Sidebar - Chapters and Info */}
          <aside className="w-120 bg-white border-l border-gray-200 flex-shrink-0 overflow-y-auto">
            <div className="p-6">
              {/* Video Info */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Video Information</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">Title:</span>
                    <span className="ml-2 font-medium">{videoData?.name || 'Loading...'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Duration:</span>
                    <span className="ml-2 font-medium">{videoData?.size ? `${Math.floor(videoData.size / 60)}:${(videoData.size % 60).toString().padStart(2, '0')}` : 'Loading...'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Upload Date:</span>
                    <span className="ml-2 font-medium">{videoData?.uploadDate ? new Date(videoData.uploadDate).toLocaleDateString() : 'Loading...'}</span>
                  </div>
                </div>
              </div>

              {/* Chapters Section */}
              {showChapters ? (
                <ChaptersSection videoData={videoData} chapters={generatedContent.chapters} loading={chaptersLoading} seekTo={handleChapterClick} currentTime={videoCurrentTime} duration={videoDuration} />
              ) : (
                <div className="text-center py-4 text-gray-500 text-sm">
                  <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Chapters will appear here
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error in VideoPage component:', error);
    return (
      <div className="min-h-screen bg-gradient-to-br from-white to-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">An error occurred</h2>
          <p className="text-gray-600">Please try again later or contact support.</p>
          <p className="text-sm text-gray-500 mt-2">Error: {error.message}</p>
        </div>
      </div>
    );
  }
} 