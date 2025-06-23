import React, { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';


export default function VideoPlayer({ videoData, onSeekTo, onTimeUpdate }) {
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
        if (onTimeUpdate) {
          onTimeUpdate(newTime, duration);
        }
      }
    };
  
    const handleLoadedMetadata = () => {
      if (videoRef.current) {
        const newDuration = videoRef.current.duration;
        setDuration(newDuration);
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
        
        try {
          videoRef.current.currentTime = seekTime;
          setCurrentTime(seekTime);
        } catch (error) {
          console.error('Error setting currentTime:', error);
          // Fallback: try to seek using a small delay
          setTimeout(() => {
            try {
              videoRef.current.currentTime = seekTime;
              setCurrentTime(seekTime);
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
            console.warn('Non-fatal HLS error:', data.details);
            if (data.details === 'bufferSeekOverHole') {
              console.log('Buffer hole detected, attempting to recover...');
              try {
                const currentTime = videoElement.currentTime;
                if (currentTime > 0) {
                  videoElement.currentTime = currentTime;
                }
              } catch (seekError) {
                console.warn('Failed to recover from buffer hole:', seekError);
              }
            }
          }
        });
  
        return hls;
      } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        videoElement.addEventListener('loadedmetadata', () => {
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
  }