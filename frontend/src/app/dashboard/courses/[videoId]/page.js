'use client';

import { useUser } from '../../../context/UserContext';
import { useRouter } from 'next/navigation';
import { useState, useEffect, use, useRef } from 'react';
import Hls from 'hls.js';
import React from 'react';

// Separate Video Player Component - completely isolated
const VideoPlayer = React.memo(({ videoData }) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef(null);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
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
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

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
        backBufferLength: 90
      });
      
      hls.loadSource(hlsUrl);
      hls.attachMedia(videoElement);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('HLS manifest loaded successfully');
        videoElement.play().catch(e => console.log('Auto-play prevented:', e));
      });
      
      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS error event:', event);
        console.error('HLS error data:', data);
        
        if (data.fatal) {
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
          console.warn('Non-fatal HLS error:', data.details);
        }
      });
      
      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        console.log('HLS media attached successfully');
      });
      
      hls.on(Hls.Events.MANIFEST_LOADING, () => {
        console.log('HLS manifest loading...');
      });
      
      return hls;
    } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      console.log('Using native HLS support');
      videoElement.src = hlsUrl;
      videoElement.addEventListener('loadedmetadata', () => {
        console.log('Native HLS loaded successfully');
        videoElement.play().catch(e => console.log('Auto-play prevented:', e));
      });
      videoElement.addEventListener('error', (e) => {
        console.error('Native HLS error:', e);
      });
      return null;
    } else {
      console.error('HLS is not supported in this browser');
      return null;
    }
  };

  // Load HLS video when videoData changes
  useEffect(() => {
    if (videoData && videoData.hlsUrl && videoRef.current && !videoData.blobUrl) {
      console.log('Loading HLS video:', videoData.hlsUrl);
      const hlsInstance = loadHlsVideo(videoRef.current, videoData.hlsUrl);
      
      return () => {
        if (hlsInstance) {
          hlsInstance.destroy();
        }
      };
    }
  }, [videoData]);

  return (
    <div className="relative bg-black rounded-lg overflow-hidden shadow-2xl">
      {videoData && (videoData.blobUrl || videoData.hlsUrl) ? (
        <video
          ref={videoRef}
          src={videoData.blobUrl || undefined}
          className="w-full h-auto"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          preload="metadata"
        >
          Your browser does not support the video tag.
        </video>
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
const ChaptersSection = React.memo(({ videoData }) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef(null);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const seekTo = (time) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const generateChapters = (videoDuration) => {
    if (!videoDuration || videoDuration <= 0) return [];
    
    const chapters = [];
    const chapterCount = Math.max(3, Math.floor(videoDuration / 300)); // 1 chapter per 5 minutes, minimum 3
    
    for (let i = 0; i < chapterCount; i++) {
      const startTime = (videoDuration / chapterCount) * i;
      const endTime = (videoDuration / chapterCount) * (i + 1);
      chapters.push({
        id: i + 1,
        title: `Chapter ${i + 1}`,
        startTime,
        endTime,
        duration: endTime - startTime
      });
    }
    
    return chapters;
  };

  const getCurrentChapter = () => {
    const chapters = generateChapters(duration);
    if (!chapters || chapters.length === 0) {
      return { title: 'Loading...', startTime: 0, endTime: 0, duration: 0 };
    }
    return chapters.find(chapter => 
      currentTime >= chapter.startTime && currentTime < chapter.endTime
    ) || chapters[0];
  };

  const chapters = generateChapters(duration);
  const currentChapter = getCurrentChapter();

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
          </div>
        </div>
      </div>

      {/* Chapter List */}
      <div className="space-y-2">
        {chapters && chapters.length > 0 ? (
          chapters.map((chapter) => (
            <div
              key={chapter.id}
              className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                currentTime >= chapter.startTime && currentTime < chapter.endTime
                  ? 'bg-blue-100 border border-blue-300'
                  : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
              }`}
              onClick={() => seekTo(chapter.startTime)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-800">{chapter.title}</h4>
                  <p className="text-sm text-gray-600">
                    {formatTime(chapter.startTime)} - {formatTime(chapter.endTime)}
                  </p>
                </div>
                <div className="text-xs text-gray-500">
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

      {/* Hidden video element for time tracking */}
      {videoData && (videoData.blobUrl || videoData.hlsUrl) && (
        <video
          ref={videoRef}
          src={videoData.blobUrl || undefined}
          className="hidden"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          preload="metadata"
        />
      )}
    </div>
  );
});

export default function VideoPage({ params }) {
  // Move use(params) outside try-catch to avoid Suspense exception issues
  const { videoId } = use(params);
  
  try {
    console.log('VideoPage component starting...');
    console.log('Params:', params);
    console.log('VideoId extracted:', videoId);
    
    const { userRole, userName, isLoggedIn } = useUser();
    console.log('User context loaded:', { userRole, userName, isLoggedIn });
    
    const router = useRouter();
    const [videoData, setVideoData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showChapters, setShowChapters] = useState(true);
    const [isAnalyzing, setIsAnalyzing] = useState(true);
    const [analysisComplete, setAnalysisComplete] = useState(false);
    const [generatedContent, setGeneratedContent] = useState({
      chapters: false,
      summary: false,
      keyTakeaways: false,
      pacingRecommendations: false,
      quizzes: false,
      notes: false,
      studyMaterials: false,
      externalResources: false
    });

    const [generatedTitle, setGeneratedTitle] = useState(null);
    const [generatedHashtags, setGeneratedHashtags] = useState(null);
    const [generatedTopics, setGeneratedTopics] = useState(null);

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
        console.log('Fetching video data from TwelveLabs...');
        const retrievalURL = `https://api.twelvelabs.io/v1.3/indexes/${process.env.NEXT_PUBLIC_TWELVE_LABS_INDEX_ID}/videos/${videoId}?transcription=true`
        try {
          const retrieveVideoResponse = await fetch(retrievalURL, options);
          console.log('Response status:', retrieveVideoResponse.status);
          
          if (!retrieveVideoResponse.ok) {
            throw new Error(`HTTP ${retrieveVideoResponse.status}: ${retrieveVideoResponse.statusText}`);
          }
          
          const result = await retrieveVideoResponse.json();
          console.log('Retrieved video data:', result);

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

      // Start both fetches
      fetchVideo();
      fetchCachedAnalysis();

      // Cleanup timeout on unmount
      return () => clearTimeout(loadingTimeout);
    }, [videoId]);

    // Add debugging for state changes
    useEffect(() => {
      console.log('State changed - loading:', loading, 'videoData:', videoData);
    }, [loading, videoData]);

    const analyzeLectureWithAI = async () => {
      setIsAnalyzing(true);
      setAnalysisComplete(false);
      setGeneratedContent({
        chapters: false,
        summary: false,
        keyTakeaways: false,
        pacingRecommendations: false,
        quizzes: false,
        notes: false,
        studyMaterials: false,
        externalResources: false
      });
      
      try {
        // Simulate progressive content generation
        const generateContent = async () => {
          // Start with chapters (fastest)
          await new Promise(resolve => setTimeout(resolve, 800));
          setGeneratedContent(prev => ({ ...prev, chapters: true }));
          
          // Summary next
          await new Promise(resolve => setTimeout(resolve, 1200));
          setGeneratedContent(prev => ({ ...prev, summary: true }));
          
          // Key takeaways
          await new Promise(resolve => setTimeout(resolve, 1000));
          setGeneratedContent(prev => ({ ...prev, keyTakeaways: true }));
          
          // Pacing recommendations
          await new Promise(resolve => setTimeout(resolve, 1500));
          setGeneratedContent(prev => ({ ...prev, pacingRecommendations: true }));
          
          // Notes and concepts
          await new Promise(resolve => setTimeout(resolve, 1100));
          setGeneratedContent(prev => ({ ...prev, notes: true }));
          
          // Quizzes (takes longer)
          await new Promise(resolve => setTimeout(resolve, 2000));
          setGeneratedContent(prev => ({ ...prev, quizzes: true }));
          
          // Study materials
          await new Promise(resolve => setTimeout(resolve, 1800));
          setGeneratedContent(prev => ({ ...prev, studyMaterials: true }));
          
          // External resources (last)
          await new Promise(resolve => setTimeout(resolve, 1400));
          setGeneratedContent(prev => ({ ...prev, externalResources: true }));
          
          // Mark as complete
          setAnalysisComplete(true);
          setIsAnalyzing(false);
        };

        // Call placeholder API endpoint
        const response = await fetch('/api/analyze-lecture', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            videoId: videoId,
            videoData: videoData
          }),
        });

        const result = await response.json();
        
        if (result.success) {
          console.log('Lecture analysis completed:', result);
          // Start progressive content generation
          generateContent();
        } else {
          console.error('Analysis failed:', result.message);
          setIsAnalyzing(false);
        }
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

    const GeneratingIndicator = ({ title, isGenerating }) => (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
        {isGenerating && (
          <div className="flex items-center gap-3 text-blue-600">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm font-medium">Generating content...</span>
          </div>
        )}
      </div>
    );

    // Typewriter component for streaming text animation
    const Typewriter = ({ text, speed = 50, className = "" }) => {
      // Return null if text is undefined or null
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

      const [showTitle, setShowTitle] = useState(false);
      const [showHashtags, setShowHashtags] = useState(false);
      const [showTopics, setShowTopics] = useState(false);
      const [hasInitialized, setHasInitialized] = useState(false);

      // Use a ref to track if we've already started the animation sequence
      const animationStartedRef = useRef(false);

      useEffect(() => {
        // Only start the animation sequence once
        if (!hasInitialized && (hasValidTitle || hasValidHashtags || hasValidTopics)) {
          setHasInitialized(true);
          animationStartedRef.current = true;
          
          // Start the animation sequence
          if (hasValidTitle) {
            setTimeout(() => setShowTitle(true), 500);
          }
          if (hasValidHashtags) {
            setTimeout(() => setShowHashtags(true), 2000);
          }
          if (hasValidTopics) {
            setTimeout(() => setShowTopics(true), 3500);
          }
        }
      }, [hasValidTitle, hasValidHashtags, hasValidTopics, hasInitialized]);

      // If we have data but haven't initialized, show everything immediately
      if (!hasInitialized && (hasValidTitle || hasValidHashtags || hasValidTopics)) {
        return (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-200 mb-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-blue-800">AI Generated Video Label</h2>
                <p className="text-blue-600">Analysis complete</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Title */}
              {hasValidTitle && (
                <div className="bg-white rounded-lg p-4 border border-blue-200">
                  <h3 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    Title
                  </h3>
                  <Typewriter 
                    text={title} 
                    speed={30} 
                    className="text-lg font-medium text-gray-800"
                  />
                </div>
              )}

              {/* Hashtags */}
              {hasValidHashtags && (
                <div className="bg-white rounded-lg p-4 border border-blue-200">
                  <h3 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                    </svg>
                    Hashtags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {hashtags.map((hashtag, index) => (
                      <span 
                        key={index}
                        className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium animate-fade-in"
                        style={{ animationDelay: `${index * 200}ms` }}
                      >
                        #{hashtag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Topics */}
              {hasValidTopics && (
                <div className="bg-white rounded-lg p-4 border border-blue-200">
                  <h3 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    Topics
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {topics.map((topic, index) => (
                      <span 
                        key={index}
                        className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium animate-fade-in"
                        style={{ animationDelay: `${index * 200}ms` }}
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      }

      return (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-200 mb-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-blue-800">AI Generated Video Label</h2>
              <p className="text-blue-600">Streaming cached analysis data...</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Title */}
            {showTitle && hasValidTitle && (
              <div className="bg-white rounded-lg p-4 border border-blue-200 animate-fade-in">
                <h3 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  Title
                </h3>
                <Typewriter 
                  text={title} 
                  speed={30} 
                  className="text-lg font-medium text-gray-800"
                />
              </div>
            )}

            {/* Hashtags */}
            {showHashtags && hasValidHashtags && (
              <div className="bg-white rounded-lg p-4 border border-blue-200 animate-fade-in">
                <h3 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                  </svg>
                  Hashtags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {hashtags.map((hashtag, index) => (
                    <span 
                      key={index}
                      className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium animate-fade-in"
                      style={{ animationDelay: `${index * 200}ms` }}
                    >
                      #{hashtag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Topics */}
            {showTopics && hasValidTopics && (
              <div className="bg-white rounded-lg p-4 border border-blue-200 animate-fade-in">
                <h3 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Topics
                </h3>
                <div className="flex flex-wrap gap-2">
                  {topics.map((topic, index) => (
                    <span 
                      key={index}
                      className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium animate-fade-in"
                      style={{ animationDelay: `${index * 200}ms` }}
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    };

    console.log('Component rendering - loading:', loading, 'videoData:', videoData);
    console.log('Authentication state - isLoggedIn:', isLoggedIn, 'userRole:', userRole, 'userName:', userName);

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
      <div className="min-h-screen bg-gradient-to-br from-white to-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
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

        <div className="flex h-screen">
          {/* Left Side - Main Content Area */}
          <div className="flex-1 flex flex-col">
            {/* Top Section - Video Player */}
            <div className="flex-1 bg-black flex items-center justify-center p-6">
              <div className="w-full max-w-4xl">
                <VideoPlayer videoData={videoData} />
              </div>
            </div>

            {/* Bottom Section - Content Area */}
            <div className="bg-white border-t border-gray-200 p-6">
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
                          width: `${Object.values(generatedContent).filter(Boolean).length / Object.keys(generatedContent).length * 100}%` 
                        }}
                      ></div>
                    </div>
                    
                    {/* Progress Text */}
                    <div className="flex items-center justify-between text-sm text-blue-700">
                      <span>Generating chapters, summaries, quizzes, and study materials...</span>
                      <span className="font-medium">
                        {Math.round(Object.values(generatedContent).filter(Boolean).length / Object.keys(generatedContent).length * 100)}% Complete
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
                        <p className="text-gray-700">This lecture provides a comprehensive introduction to modern web development practices, covering essential concepts from frontend frameworks to backend architecture. The instructor demonstrates practical examples and best practices for building scalable applications.</p>
                        <p className="text-gray-700">Key topics include responsive design principles, state management patterns, and performance optimization techniques that are crucial for today's web applications.</p>
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
                  {generatedContent.keyTakeaways ? (
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-800 mb-1 flex items-center gap-2">
                        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        Key Takeaways
                      </h3>
                      <p className="text-sm text-gray-500 mb-4">Essential concepts and insights to remember from this lecture</p>
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                          <p className="text-gray-700">Modern web development requires understanding both frontend and backend technologies</p>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                          <p className="text-gray-700">Performance optimization is crucial for user experience and SEO</p>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                          <p className="text-gray-700">State management patterns help maintain clean and scalable code</p>
                        </div>
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
                  {generatedContent.pacingRecommendations ? (
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-800 mb-1 flex items-center gap-2">
                        <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Pacing Recommendations
                      </h3>
                      <p className="text-sm text-gray-500 mb-4">Suggested study schedule and time allocation for optimal learning</p>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                          <span className="text-gray-700">Watch full lecture</span>
                          <span className="text-orange-600 font-medium">45 min</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                          <span className="text-gray-700">Review key concepts</span>
                          <span className="text-orange-600 font-medium">15 min</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                          <span className="text-gray-700">Practice exercises</span>
                          <span className="text-orange-600 font-medium">30 min</span>
                        </div>
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
              </div>
            </div>

            {/* Right Sidebar - Chapters and Info */}
            <div className="w-80 bg-white border-l border-gray-200 p-6 overflow-y-auto">
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
                <ChaptersSection videoData={videoData} />
              ) : (
                <div className="text-center py-4 text-gray-500 text-sm">
                  <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Chapters will appear here
                </div>
              )}
            </div>
          </div>
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