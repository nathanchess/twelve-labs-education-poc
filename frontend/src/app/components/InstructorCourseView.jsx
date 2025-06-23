'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import React from 'react';
import VideoPlayer from './VideoPlayer';
import ChaptersSection from './ChaptersSection';

export default function InstructorCourseView({ videoId }) {

  const options = {
    method: 'GET',
    headers: {
      'x-api-key': process.env.NEXT_PUBLIC_TWELVE_LABS_API_KEY
    }
  }
  
  try {

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
      engagement: false,
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

    const fetchVideo = async () => {
      const retrievalURL = `https://api.twelvelabs.io/v1.3/indexes/${process.env.NEXT_PUBLIC_TWELVE_LABS_INDEX_ID}/videos/${videoId}?transcription=true`
      try {
        const retrieveVideoResponse = await fetch(retrievalURL, options);
        
        if (!retrieveVideoResponse.ok) {
          throw new Error(`HTTP ${retrieveVideoResponse.status}: ${retrieveVideoResponse.statusText}`);
        }
        
        const result = await retrieveVideoResponse.json();

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
        //clearTimeout(loadingTimeout);
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
        //clearTimeout(loadingTimeout);
      }
    }

    const fetchExistingCourseMetadata = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/fetch_course_metadata`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ video_id: videoId })
        });

        if (response.ok) {
          const result = await response.json();
          console.log('Found existing course metadata:', result.data)
          
          const generatedContent = {
            chapters: result.data.chapters || false,
            summary: result.data.summary || '',
            keyTakeaways: result.data.key_takeaways || false,
            pacingRecommendations: result.data.pacing_recommendations || false,
            quizQuestions: result.data.quiz_questions || false,
            engagement: result.data.engagement || false,
          }

          // Set the existing course data
          setGeneratedContent(generatedContent);
          
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

          return generatedContent;
          
        } else {
          console.log('No existing course metadata found, will generate new content')
          return {};
        }
      } catch (error) {
        console.error('Error checking for existing course metadata:', error);
        return {};
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
        
        let chaptersData = null;
        
        if (result && result.data && result.data.chapters) {
          console.log('Chapters generated successfully:', result.data.chapters);
          chaptersData = result.data.chapters;
          setGeneratedContent(prev => ({
            ...prev,
            chapters: chaptersData,
          }));
          setChaptersLoading(false);
        } else if (result && result.chapters) {
          // Handle case where chapters are directly in the result
          console.log('Chapters found in result:', result.chapters);
          chaptersData = result.chapters;
          setGeneratedContent(prev => ({
            ...prev,
            chapters: chaptersData,
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
        
        // Generate quiz questions with the chapters data
        if (chaptersData) {
          await generateQuizQuestions(chaptersData);
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

    const generateQuizQuestions = async (chapters) => {
      try {
        const quizQuestionsResult = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/generate_quiz_questions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({twelve_labs_video_id: videoId, chapters: chapters})
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

    const generateEngagement = async () => {
      console.log('Generating engagement...');
      try {
        const engagementResult = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/generate_engagement`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({twelve_labs_video_id: videoId})
        });
        
        if (!engagementResult.ok) {
          throw new Error(`HTTP ${engagementResult.status}: ${engagementResult.statusText}`);
        }

        const result = await engagementResult.json();
        console.log('Engagement generation result:', result);
        
        if (result && result.data && result.data.engagement) {
          console.log('Engagement generated successfully:', result.data.engagement);
          setGeneratedContent(prev => ({
            ...prev,
            engagement: result.data.engagement,
          }));
        } else {
          console.warn('Engagement generation result is not as expected:', result);
          setGeneratedContent(prev => ({
            ...prev,
            engagement: null,
          }));
        }
      } catch (error) {
        console.error('Error generating engagement:', error);
        setGeneratedContent(prev => ({
          ...prev,
          engagement: null,
        }));
      }
    }

    useEffect(() => {

      const initializeCourse = async () => {
        await fetchVideo();
        
        const hasExistingData = await fetchExistingCourseMetadata();

        if (hasExistingData.engagement && hasExistingData.chapters && hasExistingData.summary && hasExistingData.keyTakeaways && hasExistingData.pacingRecommendations && hasExistingData.quizQuestions) {
          await fetchCachedAnalysis();
        } else {
          console.log('existing data: ', hasExistingData);
          setIsAnalyzing(true);
          setAnalysisComplete(false);
          await fetchCachedAnalysis();
          if (!hasExistingData.summary) {
            await analyzeLectureWithAI();
          }
          if (!hasExistingData.keyTakeaways) {
          await generateKeyTakeaways();
          }
          if (!hasExistingData.pacingRecommendations) {
            await generatePacingRecommendations();
          }
          if (!hasExistingData.engagement) {
            await generateEngagement();
          }
          if (!hasExistingData.chapters) {
            await generateChapters();
          }
        }
      };

      initializeCourse();

      
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
            pacing_recommendations: generatedContent.pacingRecommendations,
            engagement: generatedContent.engagement,
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

                  {/* Engagement Events */}
                  {generatedContent.engagement && Array.isArray(generatedContent.engagement) && generatedContent.engagement.length > 0 ? (
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-800 mb-1 flex items-center gap-2">
                        <svg className="w-5 h-5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Student Engagement Events
                      </h3>
                      <p className="text-sm text-gray-500 mb-4">Key moments of student engagement and emotional responses during the lecture</p>
                      <div className="space-y-4">
                        {generatedContent.engagement.map((engagement, index) => {
                          // Define emotion colors and icons
                          const emotionConfig = {
                            happy: { color: 'green', bgColor: 'green-50', borderColor: 'green-200', icon: '😊' },
                            sad: { color: 'blue', bgColor: 'blue-50', borderColor: 'blue-200', icon: '😢' },
                            angry: { color: 'red', bgColor: 'red-50', borderColor: 'red-200', icon: '😠' },
                            surprised: { color: 'yellow', bgColor: 'yellow-50', borderColor: 'yellow-200', icon: '😲' },
                            confused: { color: 'purple', bgColor: 'purple-50', borderColor: 'purple-200', icon: '😕' },
                            bored: { color: 'gray', bgColor: 'purple-50', borderColor: 'purple-200', icon: '😴' }
                          };
                          
                          const config = emotionConfig[engagement.emotion.toLowerCase()] || emotionConfig.confused;
                          
                          return (
                            <div key={index} className={`p-4 rounded-lg border-2 ${config.bgColor} ${config.borderColor}`}>
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <span className="text-2xl">{config.icon}</span>
                                  <div>
                                    <h4 className="font-semibold text-gray-800 capitalize">{engagement.emotion}</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="text-sm text-gray-600">Engagement Level:</span>
                                      <div className="flex gap-1">
                                        {[1, 2, 3, 4, 5].map((level) => (
                                          <div
                                            key={level}
                                            className={`w-3 h-3 rounded-full ${
                                              level <= engagement.engagement_level
                                                ? `bg-${config.color}-500`
                                                : 'bg-gray-200'
                                            }`}
                                          />
                                        ))}
                                      </div>
                                      <span className="text-sm font-medium text-gray-700">({engagement.engagement_level}/5)</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="text-sm font-medium text-gray-600 bg-white px-2 py-1 rounded border">
                                    {engagement.timestamp}
                                  </span>
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <div>
                                  <h5 className="text-sm font-medium text-gray-700 mb-1">What happened:</h5>
                                  <p className="text-sm text-gray-600 bg-white p-2 rounded border">
                                    {engagement.description}
                                  </p>
                                </div>
                                
                                <div>
                                  <h5 className="text-sm font-medium text-gray-700 mb-1">Why it occurred:</h5>
                                  <p className="text-sm text-gray-600 bg-white p-2 rounded border">
                                    {engagement.reason}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <ContentSkeleton 
                      title="Student Engagement Events"
                      icon={<svg className="w-5 h-5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>}
                      color="pink"
                      description="Key moments of student engagement and emotional responses during the lecture"
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
                                      disabled={!quizChapterSelect}
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