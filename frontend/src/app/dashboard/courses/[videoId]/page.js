'use client';

import { useUser } from '../../../context/UserContext';
import { useRouter } from 'next/navigation';
import { useState, useEffect, use, useRef } from 'react';
import Hls from 'hls.js';

export default function VideoPage({ params }) {
  const { userRole, userName, isLoggedIn } = useUser();
  const router = useRouter();
  const [videoData, setVideoData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
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
  
  const videoRef = useRef(null);
  const { videoId } = use(params);

  // Function to load HLS video
  const loadHlsVideo = (videoElement, hlsUrl) => {
    if (Hls.isSupported()) {
      const hls = new Hls({
        debug: false, // Set to true for detailed logging
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
      // Native HLS support (Safari)
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

  // Cleanup HLS instance on unmount
  useEffect(() => {
    let hlsInstance = null;
    
    return () => {
      if (hlsInstance) {
        hlsInstance.destroy();
      }
    };
  }, []);

  // Load HLS video when videoData changes
  useEffect(() => {
    if (videoData && videoData.hlsUrl && videoRef.current && !videoData.blobUrl) {
      console.log('Loading HLS video:', videoData.hlsUrl);
      const hlsInstance = loadHlsVideo(videoRef.current, videoData.hlsUrl);
      
      // Store the HLS instance for cleanup
      return () => {
        if (hlsInstance) {
          hlsInstance.destroy();
        }
      };
    }
  }, [videoData]);

  useEffect(() => {
    // For now, we'll get video data from localStorage
    // In a real app, you'd fetch this from your API
    
    console.log('Video ID:', videoId);
    console.log('Initial loading state:', loading);

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
      }
    }

    const fetchCachedAnalysis = async () => {

      const cachedAnalysisResult = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/cached_analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({twelve_labs_video_id: videoId})
      })

      const result = await cachedAnalysisResult.json();
      console.log('Cached analysis result:', result);

    }

    fetchVideo();
    fetchCachedAnalysis();
  }, [videoId]);

  // Add debugging for state changes
  useEffect(() => {
    console.log('State changed - loading:', loading, 'videoData:', videoData);
  }, [loading, videoData]);

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
    return chapters.find(chapter => 
      currentTime >= chapter.startTime && currentTime < chapter.endTime
    ) || chapters[0];
  };

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
        <SkeletonLoader className="h-12 w-3/4" />
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

  console.log('Component rendering - loading:', loading, 'videoData:', videoData);
  console.log('Authentication state - isLoggedIn:', isLoggedIn, 'userRole:', userRole, 'userName:', userName);

  // Temporarily bypass authentication for testing
  // if (!isLoggedIn) {
  //   console.log('User not logged in, redirecting...');
  //   return (
  //     <div className="min-h-screen bg-gradient-to-br from-white to-gray-50 flex items-center justify-center">
  //       <div className="text-center">
  //         <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
  //         <p className="text-gray-600">Checking authentication...</p>
  //       </div>
  //     </div>
  //   );
  // }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white to-gray-50">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading video...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!videoData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white to-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="w-32 h-32 bg-gray-100 rounded-full mx-auto mb-6 flex items-center justify-center">
              <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Video not found</h3>
            <p className="text-gray-600 mb-4">The video with ID {videoId} could not be found.</p>
            <button
              onClick={() => router.push('/dashboard/courses')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              Back to Courses
            </button>
          </div>
        </div>
      </div>
    );
  }

  const chapters = generateChapters(duration);
  const currentChapter = getCurrentChapter();

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
              {/* Video Container */}
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
            </div>
          </div>

          {/* Bottom Section - Content Area */}
          <div className="bg-white border-t border-gray-200 p-6">
            <div className="max-w-6xl mx-auto">
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

              {/* Summary Section */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-800">Video Summary</h2>
                </div>
                
                {!generatedContent.summary ? (
                  <GeneratingIndicator 
                    title="Video Summary" 
                    isGenerating={isAnalyzing} 
                  />
                ) : (
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-green-800">Summary Generated!</h3>
                    </div>
                    <p className="text-green-700">
                      AI analysis has been completed. All content sections are now available below for instructor review.
                    </p>
                  </div>
                )}
              </div>

              {/* Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column */}
                <div className="space-y-6">
                  {/* Key Takeaways */}
                  {!generatedContent.keyTakeaways ? (
                    <ContentSkeleton 
                      title="Key Takeaways"
                      icon={<svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>}
                      description="Main concepts and important points from the lecture"
                    />
                  ) : (
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-800 mb-1 flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Key Takeaways
                      </h3>
                      <p className="text-sm text-gray-500 mb-4">Main concepts and important points from the lecture</p>
                      <div className="space-y-3">
                        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                          <p className="text-sm text-blue-800 font-medium">Placeholder Key Takeaway 1</p>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                          <p className="text-sm text-blue-800 font-medium">Placeholder Key Takeaway 2</p>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                          <p className="text-sm text-blue-800 font-medium">Placeholder Key Takeaway 3</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Pacing & Clarity Recommendations */}
                  {!generatedContent.pacingRecommendations ? (
                    <ContentSkeleton 
                      title="Pacing & Clarity Recommendations"
                      icon={<svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>}
                      description="Suggestions to improve lecture delivery and student comprehension"
                    />
                  ) : (
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-800 mb-1 flex items-center gap-2">
                        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Pacing & Clarity Recommendations
                      </h3>
                      <p className="text-sm text-gray-500 mb-4">Suggestions to improve lecture delivery and student comprehension</p>
                      <div className="space-y-3">
                        <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                          <p className="text-sm text-purple-800 font-medium">Pacing Recommendation</p>
                          <p className="text-xs text-purple-600 mt-1">Consider slowing down during complex concepts</p>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                          <p className="text-sm text-purple-800 font-medium">Clarity Suggestion</p>
                          <p className="text-xs text-purple-600 mt-1">Add more examples for better understanding</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Chapter Quizzes */}
                  {!generatedContent.quizzes ? (
                    <ContentSkeleton 
                      title="Chapter Quizzes"
                      icon={<svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>}
                      description="Interactive assessments to test student understanding"
                    />
                  ) : (
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-800 mb-1 flex items-center gap-2">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        Chapter Quizzes
                      </h3>
                      <p className="text-sm text-gray-500 mb-4">Interactive assessments to test student understanding</p>
                      <div className="space-y-3">
                        <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                          <p className="text-sm text-green-800 font-medium">Chapter 1 Quiz</p>
                          <p className="text-xs text-green-600 mt-1">5 questions • Multiple choice</p>
                        </div>
                        <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                          <p className="text-sm text-green-800 font-medium">Chapter 2 Quiz</p>
                          <p className="text-xs text-green-600 mt-1">3 questions • True/False</p>
                        </div>
                        <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                          <p className="text-sm text-green-800 font-medium">Chapter 3 Quiz</p>
                          <p className="text-xs text-green-600 mt-1">4 questions • Short answer</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  {/* Notes & Key Concepts */}
                  {!generatedContent.notes ? (
                    <ContentSkeleton 
                      title="Notes & Key Concepts"
                      icon={<svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>}
                      description="Important definitions and explanations of core concepts"
                    />
                  ) : (
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-800 mb-1 flex items-center gap-2">
                        <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Notes & Key Concepts
                      </h3>
                      <p className="text-sm text-gray-500 mb-4">Important definitions and explanations of core concepts</p>
                      <div className="space-y-3">
                        <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                          <p className="text-sm text-yellow-800 font-medium">Key Concept 1</p>
                          <p className="text-xs text-yellow-600 mt-1">Definition and explanation will appear here</p>
                        </div>
                        <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                          <p className="text-sm text-yellow-800 font-medium">Key Concept 2</p>
                          <p className="text-xs text-yellow-600 mt-1">Definition and explanation will appear here</p>
                        </div>
                        <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                          <p className="text-sm text-yellow-800 font-medium">Key Concept 3</p>
                          <p className="text-xs text-yellow-600 mt-1">Definition and explanation will appear here</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Study Materials */}
                  {!generatedContent.studyMaterials ? (
                    <ContentSkeleton 
                      title="Study Materials"
                      icon={<svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>}
                      description="Supplementary resources to enhance learning and retention"
                    />
                  ) : (
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-800 mb-1 flex items-center gap-2">
                        <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        Study Materials
                      </h3>
                      <p className="text-sm text-gray-500 mb-4">Supplementary resources to enhance learning and retention</p>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 bg-indigo-50 rounded-lg p-3 border border-indigo-200">
                          <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div>
                            <p className="text-sm text-indigo-800 font-medium">Lecture Summary PDF</p>
                            <p className="text-xs text-indigo-600">Comprehensive notes and key points</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 bg-indigo-50 rounded-lg p-3 border border-indigo-200">
                          <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div>
                            <p className="text-sm text-indigo-800 font-medium">Flashcards</p>
                            <p className="text-xs text-indigo-600">Key terms and definitions</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 bg-indigo-50 rounded-lg p-3 border border-indigo-200">
                          <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          <div>
                            <p className="text-sm text-indigo-800 font-medium">Practice Questions</p>
                            <p className="text-xs text-indigo-600">Additional exercises and problems</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* External Resources */}
                  {!generatedContent.externalResources ? (
                    <ContentSkeleton 
                      title="External Resources"
                      icon={<svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>}
                      description="Additional learning materials and references for deeper exploration"
                    />
                  ) : (
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-800 mb-1 flex items-center gap-2">
                        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        External Resources
                      </h3>
                      <p className="text-sm text-gray-500 mb-4">Additional learning materials and references for deeper exploration</p>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 bg-red-50 rounded-lg p-3 border border-red-200 cursor-pointer hover:bg-red-100 transition-colors">
                          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          <div>
                            <p className="text-sm text-red-800 font-medium">Related Research Paper</p>
                            <p className="text-xs text-red-600">Deep dive into the topic</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 bg-red-50 rounded-lg p-3 border border-red-200 cursor-pointer hover:bg-red-100 transition-colors">
                          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <div>
                            <p className="text-sm text-red-800 font-medium">Video Tutorial</p>
                            <p className="text-xs text-red-600">Visual explanation of concepts</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 bg-red-50 rounded-lg p-3 border border-red-200 cursor-pointer hover:bg-red-100 transition-colors">
                          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div>
                            <p className="text-sm text-red-800 font-medium">Interactive Demo</p>
                            <p className="text-xs text-red-600">Hands-on practice tool</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Chapters and Info */}
        <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto">
          <div className="p-6">
            {/* Video Information */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">Video Information</h2>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-600">Duration:</span>
                  <span className="ml-2 font-medium">{formatTime(duration)}</span>
                </div>
                <div>
                  <span className="text-gray-600">File Size:</span>
                  <span className="ml-2 font-medium">{(videoData.size / (1024 * 1024)).toFixed(2)} MB</span>
                </div>
                <div>
                  <span className="text-gray-600">Upload Date:</span>
                  <span className="ml-2 font-medium">{new Date(videoData.date).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Chapters */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-800">Chapters</h2>
                {generatedContent.chapters && (
                  <button
                    onClick={() => setShowChapters(!showChapters)}
                    className="text-blue-600 hover:text-blue-700 text-sm"
                  >
                    {showChapters ? 'Hide' : 'Show'}
                  </button>
                )}
              </div>
              
              {!generatedContent.chapters ? (
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    Chapters
                  </h3>
                  <div className="space-y-2">
                    <SkeletonLoader className="h-12 w-full" />
                    <SkeletonLoader className="h-12 w-full" />
                    <SkeletonLoader className="h-12 w-full" />
                    <SkeletonLoader className="h-12 w-3/4" />
                  </div>
                </div>
              ) : showChapters ? (
                <div className="space-y-2">
                  {chapters.map((chapter) => (
                    <div
                      key={chapter.id}
                      onClick={() => seekTo(chapter.startTime)}
                      className={`p-3 rounded-lg cursor-pointer transition-colors duration-200 ${
                        currentChapter?.id === chapter.id
                          ? 'bg-blue-50 border border-blue-200'
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-gray-800">{chapter.title}</h3>
                          <p className="text-sm text-gray-600">
                            {formatTime(chapter.startTime)} - {formatTime(chapter.endTime)}
                          </p>
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatTime(chapter.duration)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500 text-sm">
                  Chapters are hidden
                </div>
              )}
            </div>

            {/* Current Chapter Info */}
            {generatedContent.chapters && currentChapter && (
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h3 className="font-semibold text-blue-800 mb-2">Current Chapter</h3>
                <p className="text-blue-700">{currentChapter.title}</p>
                <p className="text-sm text-blue-600 mt-1">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 