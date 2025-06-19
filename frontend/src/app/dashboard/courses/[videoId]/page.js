'use client';

import { useUser } from '../../../context/UserContext';
import { useRouter } from 'next/navigation';
import { useState, useEffect, use, useRef } from 'react';

export default function VideoPage({ params }) {
  const { userRole, userName, isLoggedIn } = useUser();
  const router = useRouter();
  const [videoData, setVideoData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showChapters, setShowChapters] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const videoRef = useRef(null);
  const { videoId } = use(params);

  useEffect(() => {
    // For now, we'll get video data from localStorage
    // In a real app, you'd fetch this from your API
    const storedVideoData = localStorage.getItem(`video_${videoId}`);
    if (storedVideoData) {
      setVideoData(JSON.parse(storedVideoData));
    }
    setLoading(false);
  }, [videoId]);

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
    
    try {
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
        setAnalysisComplete(true);
        // You can store the analysis results here
      } else {
        console.error('Analysis failed:', result.message);
      }
    } catch (error) {
      console.error('Error analyzing lecture:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!isLoggedIn) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white to-gray-50">
        <div className="flex items-center justify-center h-screen">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
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
                <video
                  ref={videoRef}
                  src={videoData.blobUrl}
                  className="w-full h-auto"
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  preload="metadata"
                >
                  Your browser does not support the video tag.
                </video>

                {/* Custom Video Controls */}
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
              </div>
            </div>
          </div>

          {/* Bottom Section - Content Area */}
          <div className="bg-white border-t border-gray-200 p-6">
            <div className="max-w-4xl mx-auto">
              {/* Summary Section */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-800">Video Summary</h2>
                  {!analysisComplete && (
                    <button
                      onClick={analyzeLectureWithAI}
                      disabled={isAnalyzing}
                      className={`px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-75 disabled:cursor-not-allowed flex items-center gap-2 ${
                        isAnalyzing ? 'animate-pulse' : ''
                      }`}
                    >
                      {isAnalyzing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Analyzing...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                          <span>Analyze Lecture with AI</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                
                {!analysisComplete ? (
                  <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 text-center">
                    <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">Waiting for AI Analysis</h3>
                    <p className="text-gray-600 mb-4">
                      Click "Analyze Lecture with AI" to generate a comprehensive summary, key points, and insights from this video.
                    </p>
                    <div className="text-sm text-gray-500">
                      AI analysis will provide: Key takeaways, Important concepts, Timestamps, and Related topics
                    </div>
                  </div>
                ) : (
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-green-800">Analysis Complete!</h3>
                    </div>
                    <p className="text-green-700">
                      AI analysis has been completed. Summary and insights are now available below.
                    </p>
                  </div>
                )}
              </div>

              {/* Additional Content Sections */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Notes Section */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Notes</h3>
                  {!analysisComplete ? (
                    <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200 text-center">
                      <div className="w-12 h-12 bg-yellow-200 rounded-full mx-auto mb-3 flex items-center justify-center">
                        <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </div>
                      <p className="text-sm text-yellow-700 font-medium">Waiting for AI Analysis</p>
                      <p className="text-xs text-yellow-600 mt-1">Personal notes will be available after analysis</p>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                      <p className="text-sm text-gray-600">
                        Add your personal notes here. This section could include:
                      </p>
                      <ul className="list-disc list-inside mt-2 text-sm text-gray-600 space-y-1">
                        <li>Personal observations</li>
                        <li>Questions to follow up on</li>
                        <li>Key insights</li>
                      </ul>
                    </div>
                  )}
                </div>

                {/* Resources Section */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Resources</h3>
                  {!analysisComplete ? (
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 text-center">
                      <div className="w-12 h-12 bg-blue-200 rounded-full mx-auto mb-3 flex items-center justify-center">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <p className="text-sm text-blue-700 font-medium">Waiting for AI Analysis</p>
                      <p className="text-xs text-blue-600 mt-1">Related resources will be suggested after analysis</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 cursor-pointer">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>Download Slides</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 cursor-pointer">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>Reading Materials</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 cursor-pointer">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>FAQ</span>
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
                {analysisComplete && (
                  <button
                    onClick={() => setShowChapters(!showChapters)}
                    className="text-blue-600 hover:text-blue-700 text-sm"
                  >
                    {showChapters ? 'Hide' : 'Show'}
                  </button>
                )}
              </div>
              
              {!analysisComplete ? (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 text-center">
                  <div className="w-12 h-12 bg-gray-200 rounded-full mx-auto mb-3 flex items-center justify-center">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-700 font-medium">Waiting for AI Analysis</p>
                  <p className="text-xs text-gray-600 mt-1">Smart chapters will be generated after analysis</p>
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
            {analysisComplete && currentChapter && (
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