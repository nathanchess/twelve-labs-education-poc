'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useRef } from 'react';
import React from 'react';
import VideoPlayer from './VideoPlayer';
import ChaptersSection from './ChaptersSection';
import VideoPreviewHeader from './VideoPreviewHeader';

export default function InstructorCourseView({ videoId }) {
  
  try {

    const router = useRouter();

    const [geminiFileId, setGeminiFileId] = useState(null);
    const [s3Key, setS3Key] = useState(null);

    const [videoData, setVideoData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showChapters, setShowChapters] = useState(true);
    const [isAnalyzing, setIsAnalyzing] = useState(true);
    const [analysisComplete, setAnalysisComplete] = useState(false);

    const [twelveLabsGeneratedContent, setTwelveLabsGeneratedContent] = useState({
      gist: false,
      chapters: false,
      summary: '',
      key_takeaways: false,
      pacing_recommendations: false,
      quiz_questions: false,
      engagement: false,  
      transcript: ''
    });

    const [googleGeneratedContent, setGoogleGeneratedContent] = useState({
      gist: false,
      chapters: false,
      summary: '',
      key_takeaways: false,
      pacing_recommendations: false,
      quiz_questions: false,
      engagement: false,
      transcript: ''
    });

    const [awsGeneratedContent, setAwsGeneratedContent] = useState({
      gist: false,
      chapters: false,
      summary: '',
      key_takeaways: false,
      pacing_recommendations: false,
      quiz_questions: false,
      engagement: false,
      transcript: ''
    });

    
    const [generatedContent, setGeneratedContent] = useState({
      gist: false,
      chapters: false,
      summary: '',
      key_takeaways: false,
      pacing_recommendations: false,
      quiz_questions: false,
      engagement: false,
      transcript: ''
    });
    
    const [twelveLabsDuration, setTwelveLabsDuration] = useState({
      gist: 0,
      chapters: 0,
      summary: 0,
      key_takeaways: 0,
      pacing_recommendations: 0,
      quiz_questions: 0,
      engagement: 0,
      transcript: 0.1
    });

    const [googleDuration, setGoogleDuration] = useState({
      gist: 0,
      chapters: 0,
      summary: 0,
      key_takeaways: 0,
      pacing_recommendations: 0,
      quiz_questions: 0,
      engagement: 0,
      transcript: 0
    });

    const [awsDuration, setAwsDuration] = useState({
      gist: 0,
      chapters: 0,
      summary: 0,
      key_takeaways: 0,
      pacing_recommendations: 0,
      quiz_questions: 0,
      engagement: 0,
      transcript: 0
    });

    const [quizChapterSelect, setQuizChapterSelect] = useState(1);

    const [chaptersLoading, setChaptersLoading] = useState(true);
    const [videoSeekTo, setVideoSeekTo] = useState(null);
    const [videoCurrentTime, setVideoCurrentTime] = useState(0);
    const [videoDuration, setVideoDuration] = useState(0);
    const [publishing, setPublishing] = useState(false);
    const [showTranscript, setShowTranscript] = useState(true);
    const [shuffledOptionsMap, setShuffledOptionsMap] = useState({});
    
    // Quiz section state
    const [selectedQuizProvider, setSelectedQuizProvider] = useState('twelvelabs');
    const [currentQuizQuestionIndex, setCurrentQuizQuestionIndex] = useState(0);
    const [quizShuffledOptions, setQuizShuffledOptions] = useState({});
     const [selectedTranscriptProvider, setSelectedTranscriptProvider] = useState('twelvelabs');
    
    // Add ref to track initialization
    const initializedRef = useRef(false);
    const googleQuizQuestionsRef = useRef(null);
    const awsQuizQuestionsRef = useRef(null);
    const twelveLabsQuizQuestionsRef = useRef(null);

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
      if (typeof window === 'undefined' || !quizChapterSelect || !generatedContent.quiz_questions) return;
      
      const chapterQuestions = generatedContent.quiz_questions.filter(q => q.chapter_id === quizChapterSelect);
      const newShuffledOptions = {};
      chapterQuestions.forEach((question, index) => {
        const allOptions = [question.answer, ...question.wrong_answers];
        newShuffledOptions[`${quizChapterSelect}-${index}`] = shuffleArray(allOptions);
      });
      setShuffledOptionsMap(prev => ({ ...prev, ...newShuffledOptions }));
    }, [quizChapterSelect, generatedContent.quiz_questions]);

    // Helper function to shuffle array
    function shuffleArray(array) {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    }

    function calculateTotalDuration(durationObject) {
      return Math.round(Math.max(...Object.values(durationObject))) + 's';
    }

    const fetchVideo = async () => {
      try {

        console.log(`Fetching video with ${videoId}`)
        
        const result = await fetch('/api/get-twelvelabs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            videoId: videoId
          })
        });

        if (!result.ok) {
          throw new Error(`API request failed with status ${result.status}`);
        }

        const responseData = await result.json();

        console.log(responseData.data)

        let transcriptText = '';
        if (responseData.data.transcription) {
          transcriptText = responseData.data.transcription.map(chunk => chunk.value).join(' ');
          console.log('Full transcript:', transcriptText);
          setTwelveLabsGeneratedContent(prev => {
            const newState = {
              ...prev,
              transcript: transcriptText,
            };
            return newState;
          });
        }

        console.log('Video data:', responseData.data);

        // Create a fallback video data structure
        const videoData = {
          name: responseData.data.system_metadata?.filename || 'Unknown Video',
          size: responseData.data.system_metadata?.duration || 0,
          date: responseData.data.created_at || new Date().toISOString(),
          blob: null,
          blobUrl: null, // We'll handle this differently
          twelveLabsVideoId: videoId,
          uploadDate: responseData.data.created_at || new Date().toISOString(),
          // Store the HLS URL separately for potential future use
          hlsUrl: responseData.data.hls?.video_url || null
        }

        setVideoData(videoData);
        setLoading(false);
        
        return transcriptText;
        
      } catch (error) {
        console.error('Error fetching video data:', error);
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
        
        return '';
      }
    }

    // Helper function to safely render content with error handling
    const renderContent = (content, type, provider) => {
      if (!content) {
        return <div className="h-32 bg-white rounded-lg animate-pulse border"></div>;
      }

      // Check if content has error property (from failed parsing)
      if (content.error) {
        return (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="text-sm text-yellow-700 mb-2">Output incorrect</div>
            <details className="text-xs">
              <summary className="cursor-pointer text-yellow-600">Show raw response</summary>
              <pre className="mt-2 p-2 bg-yellow-100 rounded text-xs overflow-x-auto">{JSON.stringify(content.raw, null, 2)}</pre>
            </details>
          </div>
        );
      }

      // Handle different content types
      switch (type) {
        case 'gist':
          if (typeof content === 'object' && content.title) {
            return (
              <div className="space-y-3">
                <div className="bg-white rounded-lg p-3 border">
                  <div className="text-sm font-semibold text-gray-800 mb-2">{content.title}</div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {content.hashtags?.map((tag, idx) => (
                      <span key={idx} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full font-medium">#{tag}</span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {content.topics?.map((topic, idx) => (
                      <span key={idx} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">{topic}</span>
                    ))}
                  </div>
                </div>
              </div>
            );
          } else {
            return (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="text-sm text-yellow-700 mb-2">Output incorrect</div>
                <details className="text-xs">
                  <summary className="cursor-pointer text-yellow-600">Show raw response</summary>
                  <pre className="mt-2 p-2 bg-yellow-100 rounded text-xs overflow-x-auto">{JSON.stringify(content, null, 2)}</pre>
                </details>
              </div>
            );
          }

        case 'key_takeaways':
          if (Array.isArray(content)) {
            return (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {content.map((takeaway, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-3 border">
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-gray-500 rounded-full mt-2 flex-shrink-0"></div>
                      <span className="text-sm text-gray-700 leading-relaxed">{takeaway}</span>
                    </div>
                  </div>
                ))}
              </div>
            );
          } else {
            return (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="text-sm text-yellow-700 mb-2">Output incorrect</div>
                <details className="text-xs">
                  <summary className="cursor-pointer text-yellow-600">Show raw response</summary>
                  <pre className="mt-2 p-2 bg-yellow-100 rounded text-xs overflow-x-auto">{JSON.stringify(content, null, 2)}</pre>
                </details>
              </div>
            );
          }

        case 'chapters':
          if (Array.isArray(content)) {
            return (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {content.map((chapter, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-3 border">
                    <div className="text-sm font-semibold text-gray-800 mb-1">{chapter.title || `Chapter ${idx + 1}`}</div>
                    <div className="text-xs text-gray-600">{chapter.start_time || '00:00'} - {chapter.end_time || '00:00'}</div>
                  </div>
                ))}
              </div>
            );
          } else {
            return (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="text-sm text-yellow-700 mb-2">Output incorrect</div>
                <details className="text-xs">
                  <summary className="cursor-pointer text-yellow-600">Show raw response</summary>
                  <pre className="mt-2 p-2 bg-yellow-100 rounded text-xs overflow-x-auto">{JSON.stringify(content, null, 2)}</pre>
                </details>
              </div>
            );
          }

        case 'pacing_recommendations':
          if (Array.isArray(content)) {
            return (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {content.map((rec, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-3 border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium text-gray-800">
                        {rec.recommendation || rec}
                      </div>
                      {rec.severity && (
                        <div className={`text-xs px-2 py-1 rounded-full font-medium ${
                          rec.severity === 'high' ? 'bg-red-100 text-red-700' :
                          rec.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {rec.severity}
                        </div>
                      )}
                    </div>
                    
                    {/* Display timing information if available */}
                    {(rec.start_time !== undefined || rec.end_time !== undefined) && (
                      <div className="text-xs text-gray-600 mb-2">
                        {rec.start_time !== undefined && rec.end_time !== undefined ? (
                          <span>
                            Time: {Math.floor(rec.start_time / 60)}:{(rec.start_time % 60).toString().padStart(2, '0')} - {Math.floor(rec.end_time / 60)}:{(rec.end_time % 60).toString().padStart(2, '0')}
                          </span>
                        ) : rec.start_time !== undefined ? (
                          <span>
                            Start: {Math.floor(rec.start_time / 60)}:{(rec.start_time % 60).toString().padStart(2, '0')}
                          </span>
                        ) : (
                          <span>
                            End: {Math.floor(rec.end_time / 60)}:{(rec.end_time % 60).toString().padStart(2, '0')}
                          </span>
                        )}
                      </div>
                    )}
                    
                    {rec.duration && (
                      <div className="text-xs text-gray-500">
                        Impact: {rec.duration} minutes
                      </div>
                    )}
                    
                    {rec.reason && (
                      <div className="text-xs text-gray-500 italic mt-1">
                        {rec.reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          } else {
            return (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="text-sm text-yellow-700 mb-2">Output incorrect</div>
                <details className="text-xs">
                  <summary className="cursor-pointer text-yellow-600">Show raw response</summary>
                  <pre className="mt-2 p-2 bg-yellow-100 rounded text-xs overflow-x-auto">{JSON.stringify(content, null, 2)}</pre>
                </details>
              </div>
            );
          }

        case 'engagement':
          if (Array.isArray(content)) {
            return (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {content.map((event, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-3 border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium text-gray-800">
                        {event.emotion ? (
                          <>
                            <span className="font-bold">{event.emotion}</span>
                            {typeof event.engagement_level === 'number' && (
                              <span className="ml-2 text-xs text-blue-600">Level {event.engagement_level}/5</span>
                            )}
                          </>
                        ) : (
                          JSON.stringify(event)
                        )}
                      </div>
                      {event.timestamp && (
                        <div className="text-xs text-gray-500">
                          {event.timestamp}
                        </div>
                      )}
                    </div>
                    {event.description && (
                      <div className="text-xs text-gray-600">
                        {event.description}
                      </div>
                    )}
                    {event.reason && (
                      <div className="text-xs text-gray-500 italic">
                        {event.reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          } else {
            return (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="text-sm text-yellow-700 mb-2">Output incorrect</div>
                <details className="text-xs">
                  <summary className="cursor-pointer text-yellow-600">Show raw response</summary>
                  <pre className="mt-2 p-2 bg-yellow-100 rounded text-xs overflow-x-auto">{JSON.stringify(content, null, 2)}</pre>
                </details>
              </div>
            );
          }

        default:
          return (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <span className="text-sm text-gray-600">Content type not supported</span>
            </div>
          );
      }
    };

    async function parallelAnalysis(api_urls) {

      let allPendingPromises = [];

      for (const provider in api_urls) {
        const urls = api_urls[provider];
        const pendingPromises = urls.map(url => {
          const promise = fetch(url, {
            method: 'GET',
          }).then(response => {
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
          }).then(result => ({ status: 'success', data: result, url: url, provider: provider })).catch(error => ({ status: 'error', error: error, url: url, provider: provider }));
          
          return {
            promiseObj: promise,
            url: url,
          };
        })
        allPendingPromises.push(...pendingPromises);
      }

      while (allPendingPromises.length > 0) {
        try {
          const result = await Promise.race(allPendingPromises.map(p => p.promiseObj));
          
          if (result.status === 'success') {           
            // Extract data from the response
            let extractedData = null;
            if (result.data && result.data.data && typeof result.data.data === 'object') {
              const keys = Object.keys(result.data.data);
              if (result.data.type === 'gist') {
                extractedData = result.data.data;
              } else if (result.data.type === 'chapters') {
                // For chapters, extract the array directly
                extractedData = result.data.data.chapters || result.data.data[keys[0]];
                // Set chapters loading to false when any provider gets chapters
                if (extractedData && Array.isArray(extractedData)) {
                  setChaptersLoading(false);
                }
              } else if (keys.length > 0) {
                extractedData = result.data.data[keys[0]];
              }
              console.log("API Endpoint: ", result.data.type)
            }
            
            console.log('Extracted data:', extractedData);

            if (!extractedData) {
              console.log("Continued for API Endpoint and Provider: ", result.provider, result.data.type)
              continue;
            }
            
            if (result.provider === 'twelvelabs') {
              setTwelveLabsGeneratedContent(prev => {
                const updatedContent = {
                  ...prev,
                  [result.data.type]: extractedData,
                };
                return updatedContent;
              });
              setTwelveLabsDuration(prev => ({
                ...prev,
                [result.data.type]: result.data.duration,
              }));
            } else if (result.provider === 'google') {
              setGoogleGeneratedContent(prev => {
                const updatedContent = {
                  ...prev,
                  [result.data.type]: extractedData,
                };
                return updatedContent;
              });
              setGoogleDuration(prev => ({
                ...prev,
                [result.data.type]: result.data.duration,
              }));
            } else if (result.provider === 'aws') {
              setAwsGeneratedContent(prev => {    
                const updatedContent = {
                  ...prev,
                  [result.data.type]: extractedData,
                };
                return updatedContent;
              });
              setAwsDuration(prev => ({
                ...prev,
                [result.data.type]: result.data.duration,
              }));
            } else {
              console.log('Unknown provider:', result.provider);
            }
          } else {
            console.log('Error:', result.error);

            // Handle provider errors by setting error data
            const errorData = {
              error: `Provider error: ${result.error.message || result.error}`,
              raw: result
            };
            
            if (result.provider === 'twelvelabs') {
              setTwelveLabsGeneratedContent(prev => ({
                ...prev,
                [result.url.split('/').pop()]: errorData
              }));
            } else if (result.provider === 'google') {
              setGoogleGeneratedContent(prev => ({
                ...prev,
                [result.url.split('/').pop()]: errorData
              }));
            } else if (result.provider === 'aws') {
              setAwsGeneratedContent(prev => ({
                ...prev,
                [result.url.split('/').pop()]: errorData
              }));
            }
          }

          allPendingPromises = allPendingPromises.filter(p => p.url !== result.url);

        } catch (error) {
          console.error('Error in parallel analysis:', error);
          break;
        }
      }
    }
    
    const fetchVideoIds = async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/fetch_video_ids?video_id=${videoId}`, {
        method: 'GET',
      });

      const result = await response.json();
      setGeminiFileId(result.data.gemini_file_id);
      setS3Key(result.data.s3_key);

      return {
        geminiFileIdLocal: result.data.gemini_file_id,
        s3KeyLocal: result.data.s3_key
      };
    }

    const generateChapterQuizQuestions = async (video_key, chapters, provider) => {

      const quizQuestionsResult = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/generate_quiz_questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          video_id: video_key,
          provider: provider,
          chapters: chapters
        })
      });

      const result = await quizQuestionsResult.json();
      return result;
    }

    useEffect(() => {

      if (!videoId) {
        return;
      }

      if (initializedRef.current) {
        return;
      }

      const initializeCourse = async () => {
        // Mark as initialized immediately to prevent double execution
        initializedRef.current = true;

        const { geminiFileIdLocal, s3KeyLocal } = await fetchVideoIds();
        const transcriptFromVideo = await fetchVideo();

        setTwelveLabsGeneratedContent(prev => ({
          ...prev,
          transcript: transcriptFromVideo
        }));
        
        // Testing purposes: Regenerate all content asynchronously
        let api_urls = {};

        // TwelveLabs APIs
        api_urls['twelvelabs'] = [
         `${process.env.NEXT_PUBLIC_API_URL}/generate_gist?video_id=${videoId}&provider=twelvelabs`,
         `${process.env.NEXT_PUBLIC_API_URL}/generate_chapters?video_id=${videoId}&provider=twelvelabs`,
         `${process.env.NEXT_PUBLIC_API_URL}/generate_key_takeaways?video_id=${videoId}&provider=twelvelabs`,
         `${process.env.NEXT_PUBLIC_API_URL}/generate_pacing_recommendations?video_id=${videoId}&provider=twelvelabs`,
         `${process.env.NEXT_PUBLIC_API_URL}/generate_engagement?video_id=${videoId}&provider=twelvelabs`,
         `${process.env.NEXT_PUBLIC_API_URL}/generate_summary?video_id=${videoId}&provider=twelvelabs`,
        ]

        api_urls['google'] = [
          `${process.env.NEXT_PUBLIC_API_URL}/generate_gist?video_id=${geminiFileIdLocal}&provider=google`,
          `${process.env.NEXT_PUBLIC_API_URL}/generate_chapters?video_id=${geminiFileIdLocal}&provider=google`,
          `${process.env.NEXT_PUBLIC_API_URL}/generate_key_takeaways?video_id=${geminiFileIdLocal}&provider=google`,
          `${process.env.NEXT_PUBLIC_API_URL}/generate_pacing_recommendations?video_id=${geminiFileIdLocal}&provider=google`,
          `${process.env.NEXT_PUBLIC_API_URL}/generate_engagement?video_id=${geminiFileIdLocal}&provider=google`,
          `${process.env.NEXT_PUBLIC_API_URL}/generate_summary?video_id=${geminiFileIdLocal}&provider=google`,
          `${process.env.NEXT_PUBLIC_API_URL}/generate_transcript?video_id=${geminiFileIdLocal}&provider=google`,
        ]


        api_urls['aws'] = [
          `${process.env.NEXT_PUBLIC_API_URL}/generate_gist?video_id=${s3KeyLocal}&provider=aws`,
          `${process.env.NEXT_PUBLIC_API_URL}/generate_chapters?video_id=${s3KeyLocal}&provider=aws`,
          `${process.env.NEXT_PUBLIC_API_URL}/generate_key_takeaways?video_id=${s3KeyLocal}&provider=aws`,
          `${process.env.NEXT_PUBLIC_API_URL}/generate_pacing_recommendations?video_id=${s3KeyLocal}&provider=aws`,
          `${process.env.NEXT_PUBLIC_API_URL}/generate_engagement?video_id=${s3KeyLocal}&provider=aws`,
          `${process.env.NEXT_PUBLIC_API_URL}/generate_summary?video_id=${s3KeyLocal}&provider=aws`,
          `${process.env.NEXT_PUBLIC_API_URL}/generate_transcript?video_id=${s3KeyLocal}&provider=aws`,
        ]

        setIsAnalyzing(true);
        setAnalysisComplete(false);

        await parallelAnalysis(api_urls);

      };

      initializeCourse();
      
    }, [videoId]);

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
        } else if (key === 'transcript') {
          // Transcript is complete if it has content and is not the test value
          if (value && typeof value === 'string' && value.trim() !== '' && value !== 'TEST') {
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

    useEffect(() => {
      if (isAnalyzing && calculateProgress() === 100) {
        setIsAnalyzing(false);
        setAnalysisComplete(true);
      }
    }, [generatedContent, isAnalyzing]);

    useEffect(() => {
      const generateTwelveLabsQuizQuestions = async () => {
        twelveLabsQuizQuestionsRef.current = true;
        const twelvelabs_quiz_questions = await generateChapterQuizQuestions(videoId, twelveLabsGeneratedContent.chapters, 'twelvelabs');
        setTwelveLabsGeneratedContent(prev => ({
          ...prev,
          quiz_questions: twelvelabs_quiz_questions.data[Object.keys(twelvelabs_quiz_questions.data)[0]]
        }));
        setTwelveLabsDuration(prev => ({
          ...prev,
          quiz_questions: twelvelabs_quiz_questions.duration
        }));
      }
      if (!twelveLabsQuizQuestionsRef.current && twelveLabsGeneratedContent.chapters && Array.isArray(twelveLabsGeneratedContent.chapters) && !twelveLabsGeneratedContent.quiz_questions) {
        generateTwelveLabsQuizQuestions();
      }

    }, [twelveLabsGeneratedContent]);

    useEffect(() => {
      const generateGoogleQuizQuestions = async () => {
        googleQuizQuestionsRef.current = true;
        const google_quiz_questions = await generateChapterQuizQuestions(geminiFileId, googleGeneratedContent.chapters, 'google');
        setGoogleGeneratedContent(prev => ({
          ...prev,
          quiz_questions: google_quiz_questions.data[Object.keys(google_quiz_questions.data)[0]]
        }));
        setGoogleDuration(prev => ({
          ...prev,
          quiz_questions: google_quiz_questions.duration
        }));
      }
      if (!googleQuizQuestionsRef.current && googleGeneratedContent.chapters && Array.isArray(googleGeneratedContent.chapters) && !googleGeneratedContent.quiz_questions) {
        generateGoogleQuizQuestions();
      }
    }, [googleGeneratedContent]);

    useEffect(() => {
      const generateAwsQuizQuestions = async () => {
        awsQuizQuestionsRef.current = true;  
        const aws_quiz_questions = await generateChapterQuizQuestions(s3Key, awsGeneratedContent.chapters, 'aws');
          setAwsGeneratedContent(prev => ({
            ...prev,
            quiz_questions: aws_quiz_questions.data[Object.keys(aws_quiz_questions.data)[0]]
          }));
          setAwsDuration(prev => ({
            ...prev,
            quiz_questions: aws_quiz_questions.duration
          }));
      }
      if (!awsQuizQuestionsRef.current && awsGeneratedContent.chapters && Array.isArray(awsGeneratedContent.chapters) && !awsGeneratedContent.quiz_questions) {
        generateAwsQuizQuestions();
      }
    }, [awsGeneratedContent]);

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
            gemini_file_id: geminiFileId,
            s3_key: s3Key,
            summary: twelveLabsGeneratedContent.summary || '',
            title: twelveLabsGeneratedContent.gist.title || videoData?.name,
            chapters: twelveLabsGeneratedContent.chapters,
            quiz_questions: twelveLabsGeneratedContent.quiz_questions,
            key_takeaways: twelveLabsGeneratedContent.key_takeaways,
            pacing_recommendations: twelveLabsGeneratedContent.pacing_recommendations,
            engagement: twelveLabsGeneratedContent.engagement,
            transcript: twelveLabsGeneratedContent.transcript,
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
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Loading...</h2>
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

    // Quiz helper functions
    const getCurrentQuizQuestions = () => {
      switch (selectedQuizProvider) {
        case 'twelvelabs':
          return twelveLabsGeneratedContent.quiz_questions || [];
        case 'google':
          return googleGeneratedContent.quiz_questions || [];
        case 'aws':
          return awsGeneratedContent.quiz_questions || [];
        default:
          return [];
      }
    };

    const getShuffledOptions = (questionIndex) => {
      const questions = getCurrentQuizQuestions();
      if (!questions[questionIndex]) return [];
      
      const question = questions[questionIndex];
      const options = [question.answer, ...(question.wrong_answers || [])];
      
      if (!quizShuffledOptions[`${selectedQuizProvider}-${questionIndex}`]) {
        const shuffled = shuffleArray([...options]);
        setQuizShuffledOptions(prev => ({
          ...prev,
          [`${selectedQuizProvider}-${questionIndex}`]: shuffled
        }));
        return shuffled;
      }
      
      return quizShuffledOptions[`${selectedQuizProvider}-${questionIndex}`];
    };

    const handleQuizProviderChange = (provider) => {
      setSelectedQuizProvider(provider);
      setCurrentQuizQuestionIndex(0);
    };

    const getProviderColor = (provider) => {
      switch (provider) {
        case 'twelvelabs':
          return 'blue';
        case 'google':
          return 'green';
        case 'aws':
          return 'orange';
        default:
          return 'gray';
      }
    };

    const getProviderName = (provider) => {
      switch (provider) {
        case 'twelvelabs':
          return 'TwelveLabs';
        case 'google':
          return 'Google Gemini';
        case 'aws':
          return 'AWS Nova';
        default:
          return provider;
      }
    };

    // Helper function to get the current transcript
    const getCurrentTranscript = () => {
      switch (selectedTranscriptProvider) {
        case 'twelvelabs':
          return twelveLabsGeneratedContent.transcript;
        case 'google':
          return googleGeneratedContent.transcript;
        case 'aws':
          return awsGeneratedContent.transcript;
        default:
          return '';
      }
    };

    return (
      <div className="h-screen bg-gradient-to-br from-white to-gray-50 flex flex-col">
        {/* Header */}
        <VideoPreviewHeader videoData={videoData} videoId={videoId} />
        
        <div className="flex flex-1 overflow-y-hidden">
          {/* Main Content Area */}
          <main className="flex-1 flex flex-col overflow-y-auto">
            {/* Video Player */}
            <div className="bg-black flex items-center justify-center p-6">
              <div className="w-full max-w-4xl">
                <VideoPlayer videoData={videoData} onSeekTo={handleVideoSeekTo} onTimeUpdate={handleVideoTimeUpdate} />
              </div>
            </div>
            
            {/* Transcript Section */}
            <div className="bg-white border-b border-gray-200">
              <div className="max-w-7xl mx-auto px-6 py-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">Live Transcript</h3>
                      <p className="text-sm text-gray-600">Real-time transcription with timestamp navigation</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {/* Provider Selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 font-medium">Provider:</span>
                      <select 
                        value={selectedTranscriptProvider}
                        onChange={(e) => setSelectedTranscriptProvider(e.target.value)}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      >
                        <option value="twelvelabs">TwelveLabs</option>
                        <option value="google">Google Gemini</option>
                        <option value="aws">AWS Nova</option>
                      </select>
                    </div>
                    
                    {/* Current Time Display */}
                    <div className="text-sm text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg">
                      <span className="font-medium">Current:</span> {Math.floor(videoCurrentTime / 60)}:{(videoCurrentTime % 60).toFixed(0).padStart(2, '0')}
                    </div>
                    
                    {/* Toggle Button */}
                    <button
                      onClick={() => setShowTranscript(!showTranscript)}
                      className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-2 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                    >
                      {showTranscript ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                          Hide
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                          Show
                        </>
                      )}
                    </button>
                  </div>
                </div>
                
                {showTranscript && (
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
                    <div className="max-h-48 overflow-y-auto">
                      {(() => {
                        const currentTranscript = getCurrentTranscript();
                        
                        if (!currentTranscript || currentTranscript.trim() === '') {
                          return (
                            <div className="text-center py-8">
                              <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-3">
                                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                              </div>
                              <p className="text-gray-500 text-sm">Transcript will appear here once processing is complete</p>
                              <div className="flex items-center justify-center gap-2 mt-2">
                                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
                                <span className="text-xs text-indigo-600">Processing...</span>
                              </div>
                            </div>
                          );
                        }

                        try {
                          // Parse the transcript string to extract words and visual descriptions
                          const parts = currentTranscript.split(/(<word[^>]*>.*?<\/word>|<visual[^>]*>.*?<\/visual>)/g);
                          
                          return (
                            <div className="flex flex-wrap gap-1 text-sm leading-relaxed">
                              {parts.map((part, index) => {
                                // Check if it's a word tag
                                const wordMatch = part.match(/<word[^>]*start_time="([^"]*)"[^>]*end_time="([^"]*)"[^>]*>(.*?)<\/word>/);
                                if (wordMatch) {
                                  const [, startTime, endTime, word] = wordMatch;
                                  const startTimeNum = parseFloat(startTime);
                                  const endTimeNum = parseFloat(endTime);
                                  const isCurrentWord = videoCurrentTime >= startTimeNum && videoCurrentTime < endTimeNum;
                                  const isPastWord = videoCurrentTime >= endTimeNum;
                                  
                                  return (
                                    <span
                                      key={index}
                                      className={`transition-all duration-200 cursor-pointer hover:bg-gray-200 rounded px-1 ${
                                        isCurrentWord
                                          ? 'bg-indigo-500 text-white font-semibold animate-pulse shadow-sm'
                                          : isPastWord
                                          ? 'text-gray-700'
                                          : 'text-gray-400'
                                      }`}
                                      onClick={() => handleVideoSeekTo && handleVideoSeekTo(startTimeNum)}
                                      title={`Click to jump to ${Math.floor(startTimeNum / 60)}:${(startTimeNum % 60).toString().padStart(2, '0')}`}
                                    >
                                      {word}
                                    </span>
                                  );
                                }
                                
                                // Check if it's a visual tag
                                const visualMatch = part.match(/<visual[^>]*start_time="([^"]*)"[^>]*end_time="([^"]*)"[^>]*>(.*?)<\/visual>/);
                                if (visualMatch) {
                                  const [, startTime, endTime, description] = visualMatch;
                                  const startTimeNum = parseFloat(startTime);
                                  const endTimeNum = parseFloat(endTime);
                                  const isCurrentVisual = videoCurrentTime >= startTimeNum && videoCurrentTime < endTimeNum;
                                  
                                  return (
                                    <span
                                      key={index}
                                      className={`inline-block transition-all duration-200 cursor-pointer hover:bg-yellow-200 rounded px-2 py-1 text-xs font-medium ${
                                        isCurrentVisual
                                          ? 'bg-yellow-500 text-white animate-pulse shadow-sm'
                                          : 'text-gray-500 bg-yellow-50'
                                      }`}
                                      onClick={() => handleVideoSeekTo && handleVideoSeekTo(startTimeNum)}
                                      title={`Click to jump to ${Math.floor(startTimeNum / 60)}:${(startTimeNum % 60).toString().padStart(2, '0')}`}
                                    >
                                      [Visual: {description}]
                                    </span>
                                  );
                                }
                                
                                // Regular text (spaces, punctuation, etc.)
                                if (part.trim()) {
                                  return <span key={index} className="text-gray-400">{part}</span>;
                                }
                                
                                return null;
                              })}
                            </div>
                          );
                        } catch (error) {
                          console.error('Error parsing transcript:', error);
                          // Fallback: display the raw transcript text
                          return (
                            <div className="text-gray-700 leading-relaxed">
                              {currentTranscript}
                            </div>
                          );
                        }
                      })()}
                    </div>
                    
                    {/* Transcript Stats */}
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <div className="flex items-center gap-4">
                          <span>Provider: {getProviderName(selectedTranscriptProvider)}</span>
                          <span>Words: {(() => {
                            const transcript = getCurrentTranscript();
                            if (!transcript) return 0;
                            const wordMatches = transcript.match(/<word[^>]*>.*?<\/word>/g);
                            return wordMatches ? wordMatches.length : 0;
                          })()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span>Live</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Content Area Below Player */}
            <div className="p-6">
              <div className="max-w-7xl mx-auto">
                {/* Video Title & Metadata Section */}
                <div className="mb-8 bg-white rounded-xl border border-gray-200 shadow-lg p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2M9 12l2 2 4-4" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">Proposed Video Title & Metadata</h3>
                      <p className="text-gray-600">AI-generated title, hashtags, and topics for your video</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* TwelveLabs Gist */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                          </div>
                          <span className="font-semibold text-blue-800">TwelveLabs</span>
                        </div>
                        {twelveLabsGeneratedContent.gist ? (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">✓ Complete</span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                            <span className="text-xs text-blue-600 font-medium">Processing...</span>
                          </div>
                        )}
                      </div>
                      {renderContent(twelveLabsGeneratedContent.gist, 'gist', 'twelvelabs')}
                    </div>

                    {/* Google Gist */}
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                          </div>
                          <span className="font-semibold text-green-800">Google Gemini</span>
                        </div>
                        {googleGeneratedContent.gist ? (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">✓ Complete</span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-xs text-green-600 font-medium">Processing...</span>
                          </div>
                        )}
                      </div>
                      {renderContent(googleGeneratedContent.gist, 'gist', 'google')}
                    </div>

                    {/* AWS Gist */}
                    <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-4 border border-orange-200">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                          </div>
                          <span className="font-semibold text-orange-800">AWS Nova</span>
                        </div>
                        {awsGeneratedContent.gist ? (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">✓ Complete</span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                            <span className="text-xs text-orange-600 font-medium">Processing...</span>
                          </div>
                        )}
                      </div>
                      {renderContent(awsGeneratedContent.gist, 'gist', 'aws')}
                    </div>
                  </div>
                </div>

                {/* Provider Comparison Header */}
                <div className="mb-8">
                  <h2 className="text-3xl font-bold text-gray-800 mb-3">AI Provider Analysis Dashboard</h2>
                  <p className="text-gray-600 text-lg">Compare comprehensive analysis results from leading AI providers</p>
                </div>

                {/* Vertical Sections with Provider Comparison */}
                <div className="space-y-8">
                  {/* Key Takeaways Section */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-800">Key Learning Points</h3>
                        <p className="text-gray-600">Essential concepts and takeaways from the lecture</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* TwelveLabs Takeaways */}
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                            </div>
                            <span className="font-semibold text-blue-800">TwelveLabs</span>
                          </div>
                          {twelveLabsGeneratedContent.key_takeaways ? (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                              {Array.isArray(twelveLabsGeneratedContent.key_takeaways) ? twelveLabsGeneratedContent.key_takeaways.length : 'Unknown'} points
                            </span>
                          ) : (
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                              <span className="text-xs text-blue-600 font-medium">Processing...</span>
                            </div>
                          )}
                        </div>
                        {renderContent(twelveLabsGeneratedContent.key_takeaways, 'key_takeaways', 'twelvelabs')}
                      </div>

                      {/* Google Takeaways */}
                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                            </div>
                            <span className="font-semibold text-green-800">Google Gemini</span>
                          </div>
                          {googleGeneratedContent.key_takeaways ? (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                              {Array.isArray(googleGeneratedContent.key_takeaways) ? googleGeneratedContent.key_takeaways.length : 'Unknown'} points
                            </span>
                          ) : (
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                              <span className="text-xs text-green-600 font-medium">Processing...</span>
                            </div>
                          )}
                        </div>
                        {renderContent(googleGeneratedContent.key_takeaways, 'key_takeaways', 'google')}
                      </div>

                      {/* AWS Takeaways */}
                      <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-4 border border-orange-200">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                            </div>
                            <span className="font-semibold text-orange-800">AWS Nova</span>
                          </div>
                          {awsGeneratedContent.key_takeaways ? (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                              {Array.isArray(awsGeneratedContent.key_takeaways) ? awsGeneratedContent.key_takeaways.length : 'Unknown'} points
                            </span>
                          ) : (
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                              <span className="text-xs text-orange-600 font-medium">Processing...</span>
                            </div>
                          )}
                        </div>
                        {renderContent(awsGeneratedContent.key_takeaways, 'key_takeaways', 'aws')}
                      </div>
                    </div>
                  </div>

                  {/* Pacing Recommendations Section */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-800">Pacing Insights</h3>
                        <p className="text-gray-600">Recommendations for optimal learning pace and timing</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* TwelveLabs Pacing */}
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                              </div>
                            <span className="font-semibold text-blue-800">TwelveLabs</span>
                          </div>
                          {twelveLabsGeneratedContent.pacing_recommendations ? (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                              {Array.isArray(twelveLabsGeneratedContent.pacing_recommendations) ? twelveLabsGeneratedContent.pacing_recommendations.length : 'Unknown'} insights
                              </span>
                          ) : (
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                              <span className="text-xs text-blue-600 font-medium">Processing...</span>
                            </div>
                          )}
                          </div>
                        {renderContent(twelveLabsGeneratedContent.pacing_recommendations, 'pacing_recommendations', 'twelvelabs')}
                      </div>

                      {/* Google Pacing */}
                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                      </div>
                            <span className="font-semibold text-green-800">Google Gemini</span>
                    </div>
                          {googleGeneratedContent.pacing_recommendations ? (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                              {Array.isArray(googleGeneratedContent.pacing_recommendations) ? googleGeneratedContent.pacing_recommendations.length : 'Unknown'} insights
                            </span>
                          ) : (
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                              <span className="text-xs text-green-600 font-medium">Processing...</span>
                            </div>
                          )}
                        </div>
                        {renderContent(googleGeneratedContent.pacing_recommendations, 'pacing_recommendations', 'google')}
                      </div>

                      {/* AWS Pacing */}
                      <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-4 border border-orange-200">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                                      </div>
                            <span className="font-semibold text-orange-800">AWS Nova</span>
                                    </div>
                          {awsGeneratedContent.pacing_recommendations ? (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                              {Array.isArray(awsGeneratedContent.pacing_recommendations) ? awsGeneratedContent.pacing_recommendations.length : 'Unknown'} insights
                            </span>
                          ) : (
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                              <span className="text-xs text-orange-600 font-medium">Processing...</span>
                                  </div>
                          )}
                                </div>
                        {renderContent(awsGeneratedContent.pacing_recommendations, 'pacing_recommendations', 'aws')}
                      </div>
                                </div>
                              </div>
                              
                  {/* Engagement Analysis Section */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </div>
                                <div>
                        <h3 className="text-xl font-bold text-gray-800">Engagement Analysis</h3>
                        <p className="text-gray-600">Student engagement patterns and emotional responses</p>
                      </div>
                                </div>
                                
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* TwelveLabs Engagement */}
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                                </div>
                            <span className="font-semibold text-blue-800">TwelveLabs</span>
                              </div>
                          {twelveLabsGeneratedContent.engagement ? (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                              {Array.isArray(twelveLabsGeneratedContent.engagement) ? twelveLabsGeneratedContent.engagement.length : 'Unknown'} events
                            </span>
                          ) : (
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                              <span className="text-xs text-blue-600 font-medium">Processing...</span>
                            </div>
                          )}
                      </div>
                        {renderContent(twelveLabsGeneratedContent.engagement, 'engagement', 'twelvelabs')}
                    </div>

                      {/* Google Engagement */}
                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                            </div>
                            <span className="font-semibold text-green-800">Google Gemini</span>
                          </div>
                          {googleGeneratedContent.engagement ? (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                              {Array.isArray(googleGeneratedContent.engagement) ? googleGeneratedContent.engagement.length : 'Unknown'} events
                            </span>
                          ) : (
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                              <span className="text-xs text-green-600 font-medium">Processing...</span>
                            </div>
                          )}
                        </div>
                        {renderContent(googleGeneratedContent.engagement, 'engagement', 'google')}
                </div>

                      {/* AWS Engagement */}
                      <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-4 border border-orange-200">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                              </div>
                            <span className="font-semibold text-orange-800">AWS Nova</span>
                          </div>
                          {awsGeneratedContent.engagement ? (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                              {Array.isArray(awsGeneratedContent.engagement) ? awsGeneratedContent.engagement.length : 'Unknown'} events
                                </span>
                          ) : (
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                              <span className="text-xs text-orange-600 font-medium">Processing...</span>
                              </div>
                          )}
                            </div>
                        {renderContent(awsGeneratedContent.engagement, 'engagement', 'aws')}
                          </div>
                    </div>
                  </div>
                </div> 

                {/* Quiz Questions Section */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-800">Quiz Questions</h3>
                      <p className="text-gray-600">Test knowledge with AI-generated questions per chapter</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <select 
                        value={selectedQuizProvider}
                        onChange={(e) => handleQuizProviderChange(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      >
                        <option value="twelvelabs">TwelveLabs</option>
                        <option value="google">Google Gemini</option>
                        <option value="aws">AWS Nova</option>
                      </select>
                      <div className="text-sm text-gray-600">
                        Question {currentQuizQuestionIndex + 1} of {getCurrentQuizQuestions().length}
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const questions = getCurrentQuizQuestions();
                    const currentQuestion = questions[currentQuizQuestionIndex];
                    
                    if (!questions.length) {
                      return (
                        <div className="text-center py-12">
                          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <h4 className="text-lg font-semibold text-gray-700 mb-2">No Quiz Questions Available</h4>
                          <p className="text-gray-500">Quiz questions will be generated once chapters are available for {getProviderName(selectedQuizProvider)}</p>
                        </div>
                      );
                    }

                    if (!currentQuestion) {
                      return (
                        <div className="text-center py-12">
                          <h4 className="text-lg font-semibold text-gray-700">No more questions</h4>
                        </div>
                      );
                    }

                    const shuffledOptions = getShuffledOptions(currentQuizQuestionIndex);
                    const colorClass = getProviderColor(selectedQuizProvider);

                    return (
                      <div className="space-y-6">
                        <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6 border border-gray-200">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 bg-gradient-to-br from-${colorClass}-500 to-${colorClass}-600 rounded-lg flex items-center justify-center`}>
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                              <div>
                                <h4 className="font-semibold text-gray-800">{getProviderName(selectedQuizProvider)}</h4>
                                <p className="text-sm text-gray-600">Chapter {currentQuestion.chapter_id}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-gray-500">Question {currentQuizQuestionIndex + 1}</div>
                              <div className="text-xs text-gray-400">Multiple Choice</div>
                            </div>
                          </div>
                          
                          <div className="bg-white rounded-lg p-4 border border-gray-200">
                            <h3 className="text-lg font-medium text-gray-800 leading-relaxed">
                              {currentQuestion.question}
                            </h3>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {shuffledOptions.map((option, index) => {
                            const optionLetter = String.fromCharCode(65 + index);
                            const isCorrectAnswer = option === currentQuestion.answer;
                            return (
                              <div 
                                key={index}
                                className={`border-2 rounded-xl p-4 transition-all duration-200 cursor-pointer hover:shadow-sm ${
                                  isCorrectAnswer 
                                    ? 'bg-green-50 border-green-300 hover:border-green-400' 
                                    : 'bg-white border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <div className="flex items-start gap-4">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-semibold text-sm flex-shrink-0 ${
                                    isCorrectAnswer 
                                      ? 'bg-green-500 text-white' 
                                      : 'bg-gray-100 text-gray-700'
                                  }`}>
                                    {optionLetter}
                                  </div>
                                  <div className="flex-1">
                                    <p className={`leading-relaxed ${
                                      isCorrectAnswer ? 'text-green-800 font-medium' : 'text-gray-800'
                                    }`}>
                                      {option}
                                    </p>
                                    {isCorrectAnswer && (
                                      <div className="mt-2 flex items-center gap-2">
                                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span className="text-sm text-green-600 font-medium">Correct Answer</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <h4 className="font-semibold text-blue-800">Answer Explanation</h4>
                          </div>
                          <p className="text-blue-700 leading-relaxed">{currentQuestion.answer_explanation}</p>
                        </div>

                        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <h4 className="font-semibold text-green-800">Correct Answer</h4>
                          </div>
                          <p className="text-green-700 leading-relaxed font-medium">{currentQuestion.answer}</p>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                          <button
                            onClick={() => setCurrentQuizQuestionIndex(prev => Math.max(0, prev - 1))}
                            disabled={currentQuizQuestionIndex === 0}
                            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors"
                          >
                            Previous
                          </button>
                          
                          <div className="flex items-center gap-2">
                            {questions.map((_, index) => (
                              <button
                                key={index}
                                onClick={() => setCurrentQuizQuestionIndex(index)}
                                className={`w-3 h-3 rounded-full transition-colors ${
                                  index === currentQuizQuestionIndex 
                                    ? `bg-${colorClass}-500` 
                                    : 'bg-gray-300 hover:bg-gray-400'
                                }`}
                              />
                            ))}
                          </div>
                          
                          <button
                            onClick={() => setCurrentQuizQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))}
                            disabled={currentQuizQuestionIndex === questions.length - 1}
                            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Overall Progress Indicator */}
                <div className="mt-8 bg-white rounded-xl border border-gray-200 shadow-lg p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                  </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-800">Analysis Progress</h3>
                      <p className="text-gray-600">Real-time completion status across all AI providers</p>
                                </div>
                                            </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* TwelveLabs Progress */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                      <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                                          </svg>
                                                        </div>
                          <div>
                            <h4 className="font-semibold text-blue-800">TwelveLabs</h4>
                            <p className="text-sm text-blue-600">Video Intelligence</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-blue-600">
                            {Object.values(twelveLabsGeneratedContent).filter(Boolean).length}/{Object.values(twelveLabsGeneratedContent).length}
                          </div>
                          <div className="text-xs text-blue-600 font-medium">Complete</div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        {Object.entries(twelveLabsGeneratedContent).map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between">
                            <span className="text-sm text-gray-700 capitalize">{key.replace('_', ' ')}</span>
                            <div className="flex items-center gap-2">
                              {value ? (
                                <>
                                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                  {twelveLabsDuration[key] > 0 && (
                                    <span className="text-xs text-blue-600 font-medium">
                                      {twelveLabsDuration[key].toFixed(1)}s
                                    </span>
                                  )}
                                </>
                              ) : (
                                <div className="w-3 h-3 bg-gray-300 rounded-full animate-pulse"></div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Total Duration */}
                      {Object.values(twelveLabsDuration).some(duration => duration > 0) && (
                        <div className="mt-4 pt-3 border-t border-blue-200">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-blue-700">Total Time</span>
                            <span className="text-sm font-bold text-blue-800">
                              {calculateTotalDuration(twelveLabsDuration)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Google Progress */}
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                                    </svg>
                                                  </div>
                          <div>
                            <h4 className="font-semibold text-green-800">Google Gemini</h4>
                            <p className="text-sm text-green-600">gemini-flash-2.5-pro</p>
                                                </div>
                                                  </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-green-600">
                            {Object.values(googleGeneratedContent).filter(Boolean).length}/{Object.values(googleGeneratedContent).length}
                                                </div>
                          <div className="text-xs text-green-600 font-medium">Complete</div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        {Object.entries(googleGeneratedContent).map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between">
                            <span className="text-sm text-gray-700 capitalize">{key.replace('_', ' ')}</span>
                            <div className="flex items-center gap-2">
                              {value ? (
                                <>
                                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                  {googleDuration[key] > 0 && (
                                    <span className="text-xs text-green-600 font-medium">
                                      {googleDuration[key].toFixed(1)}s
                                    </span>
                                  )}
                                </>
                              ) : (
                                <div className="w-3 h-3 bg-gray-300 rounded-full animate-pulse"></div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Total Duration */}
                      {Object.values(googleDuration).some(duration => duration > 0) && (
                        <div className="mt-4 pt-3 border-t border-green-200">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-green-700">Total Time</span>
                            <span className="text-sm font-bold text-green-800">
                              {calculateTotalDuration(googleDuration)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* AWS Progress */}
                    <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-6 border border-orange-200">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                  </div>
                          <div>
                            <h4 className="font-semibold text-orange-800">AWS Nova</h4>
                            <p className="text-sm text-orange-600">aws-nova-1.0-pro</p>
                              </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-orange-600">
                            {Object.values(awsGeneratedContent).filter(Boolean).length}/{Object.values(awsGeneratedContent).length}
                    </div>
                          <div className="text-xs text-orange-600 font-medium">Complete</div>
                  </div>
                      </div>
                      
                      <div className="space-y-2">
                        {Object.entries(awsGeneratedContent).map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between">
                            <span className="text-sm text-gray-700 capitalize">{key.replace('_', ' ')}</span>
                            <div className="flex items-center gap-2">
                              {value ? (
                                <>
                                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                  {awsDuration[key] > 0 && (
                                    <span className="text-xs text-orange-600 font-medium">
                                      {awsDuration[key].toFixed(1)}s
                                    </span>
                                  )}
                                </>
                              ) : (
                                <div className="w-3 h-3 bg-gray-300 rounded-full animate-pulse"></div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Total Duration */}
                      {Object.values(awsDuration).some(duration => duration > 0) && (
                        <div className="mt-4 pt-3 border-t border-orange-200">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-orange-700">Total Time</span>
                            <span className="text-sm font-bold text-orange-800">
                              {calculateTotalDuration(awsDuration)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
              </div>
            </div>

                  {/* Overall Summary */}
                  <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                        <h4 className="text-lg font-semibold text-gray-800">Overall Completion</h4>
                        <p className="text-sm text-gray-600">Combined progress across all providers</p>
                </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-indigo-600">
                          {Math.round((Object.values(twelveLabsGeneratedContent).filter(Boolean).length + 
                                      Object.values(googleGeneratedContent).filter(Boolean).length + 
                                      Object.values(awsGeneratedContent).filter(Boolean).length) / (Object.keys(twelveLabsGeneratedContent).length + Object.keys(googleGeneratedContent).length + Object.keys(awsGeneratedContent).length) * 100)}%
                        </div>
                        <div className="text-sm text-gray-600">
                          {Object.values(twelveLabsGeneratedContent).filter(Boolean).length + 
                           Object.values(googleGeneratedContent).filter(Boolean).length + 
                           Object.values(awsGeneratedContent).filter(Boolean).length}/{Object.keys(twelveLabsGeneratedContent).length + Object.keys(googleGeneratedContent).length + Object.keys(awsGeneratedContent).length} tasks
                        </div>
                      </div>
              </div>
              
                    {/* Progress Bar */}
                    <div className="mt-4">
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-500"
                          style={{
                            width: `${(Object.values(twelveLabsGeneratedContent).filter(Boolean).length + 
                                     Object.values(googleGeneratedContent).filter(Boolean).length + 
                                     Object.values(awsGeneratedContent).filter(Boolean).length) / (Object.keys(twelveLabsGeneratedContent).length + Object.keys(googleGeneratedContent).length + Object.keys(awsGeneratedContent).length) * 100}%`
                          }}
                        ></div>
                  </div>
                </div>
                  </div>
                </div>
              </div>
            
            {/* Publish Section */}
            {Object.values(twelveLabsGeneratedContent).filter(Boolean).length > 0 && (
              <div className="mt-8 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 shadow-lg p-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                      <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-green-800">Ready to Publish!</h3>
                      <p className="text-green-600">Your course analysis is complete and ready to be published to students</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm text-green-600">Analysis Complete</div>
                      <div className="text-lg font-bold text-green-800">
                        {Object.values(twelveLabsGeneratedContent).filter(Boolean).length}/{Object.keys(twelveLabsGeneratedContent).length} tasks
                      </div>
                    </div>
                    
                    <button
                      onClick={handlePublish}
                      disabled={publishing}
                      className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {publishing ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Publishing...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                          Publish Course
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
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
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50 rounded-t-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-purple-800">Chapter Navigation</h3>
                      <p className="text-sm text-purple-600">Click to jump to specific sections</p>
                    </div>
                  </div>
                </div>
                
                <div className="p-4">
                  {showChapters && (twelveLabsGeneratedContent.chapters || googleGeneratedContent.chapters || awsGeneratedContent.chapters) ? (
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {/* TwelveLabs Chapters */}
                      {twelveLabsGeneratedContent.chapters && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                            </div>
                            <h4 className="text-sm font-semibold text-blue-800">TwelveLabs ({twelveLabsGeneratedContent.chapters.length} chapters)</h4>
                          </div>
                          <div className="space-y-2">
                            {twelveLabsGeneratedContent.chapters.map((chapter, idx) => (
                              <div 
                                key={`twelvelabs-${idx}`} 
                                className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-200 hover:shadow-md transition-all duration-200 cursor-pointer hover:bg-blue-100"
                                onClick={() => handleChapterClick(chapter.start_time, chapter.id || idx + 1)}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div className="font-semibold text-sm text-gray-800 line-clamp-1">{chapter.title}</div>
                                  <div className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                                    {Math.floor(chapter.start_time / 60)}:{(chapter.start_time % 60).toString().padStart(2, '0')}
                                  </div>
                                </div>
                                
                                {chapter.duration && (
                                  <div className="text-xs text-gray-500 mb-2">
                                    Duration: {Math.floor(chapter.duration / 60)}:{(chapter.duration % 60).toString().padStart(2, '0')}
                                  </div>
                                )}
                                
                                {chapter.summary && (
                                  <div className="text-xs text-gray-600 leading-relaxed line-clamp-2">
                                    {chapter.summary}
                                  </div>
                                )}
                                
                                {/* Progress indicator for current chapter */}
                                {videoCurrentTime >= chapter.start_time && 
                                 (!chapter.duration || videoCurrentTime < chapter.start_time + chapter.duration) && (
                                  <div className="mt-2 flex items-center gap-2">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                                    <span className="text-xs text-blue-600 font-medium">Currently playing</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Google Chapters */}
                      {googleGeneratedContent.chapters && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-6 h-6 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                            </div>
                            <h4 className="text-sm font-semibold text-green-800">Google Gemini ({googleGeneratedContent.chapters.length} chapters)</h4>
                          </div>
                          <div className="space-y-2">
                            {googleGeneratedContent.chapters.map((chapter, idx) => (
                              <div 
                                key={`google-${idx}`} 
                                className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 border border-green-200 hover:shadow-md transition-all duration-200 cursor-pointer hover:bg-green-100"
                                onClick={() => handleChapterClick(chapter.start_time, chapter.id || idx + 1)}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div className="font-semibold text-sm text-gray-800 line-clamp-1">{chapter.title}</div>
                                  <div className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                                    {Math.floor(chapter.start_time / 60)}:{(chapter.start_time % 60).toString().padStart(2, '0')}
                                  </div>
                                </div>
                                
                                {chapter.duration && (
                                  <div className="text-xs text-gray-500 mb-2">
                                    Duration: {Math.floor(chapter.duration / 60)}:{(chapter.duration % 60).toString().padStart(2, '0')}
                                  </div>
                                )}
                                
                                {chapter.summary && (
                                  <div className="text-xs text-gray-600 leading-relaxed line-clamp-2">
                                    {chapter.summary}
                                  </div>
                                )}
                                
                                {/* Progress indicator for current chapter */}
                                {videoCurrentTime >= chapter.start_time && 
                                 (!chapter.duration || videoCurrentTime < chapter.start_time + chapter.duration) && (
                                  <div className="mt-2 flex items-center gap-2">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                    <span className="text-xs text-green-600 font-medium">Currently playing</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* AWS Chapters */}
                      {awsGeneratedContent.chapters && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-6 h-6 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                            </div>
                            <h4 className="text-sm font-semibold text-orange-800">AWS Nova ({awsGeneratedContent.chapters.length} chapters)</h4>
                          </div>
                          <div className="space-y-2">
                            {awsGeneratedContent.chapters.map((chapter, idx) => (
                              <div 
                                key={`aws-${idx}`} 
                                className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg p-3 border border-orange-200 hover:shadow-md transition-all duration-200 cursor-pointer hover:bg-orange-100"
                                onClick={() => handleChapterClick(chapter.start_time, chapter.id || idx + 1)}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div className="font-semibold text-sm text-gray-800 line-clamp-1">{chapter.title}</div>
                                  <div className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-medium">
                                    {Math.floor(chapter.start_time / 60)}:{(chapter.start_time % 60).toString().padStart(2, '0')}
                                  </div>
                                </div>
                                
                                {chapter.duration && (
                                  <div className="text-xs text-gray-500 mb-2">
                                    Duration: {Math.floor(chapter.duration / 60)}:{(chapter.duration % 60).toString().padStart(2, '0')}
                                  </div>
                                )}
                                
                                {chapter.summary && (
                                  <div className="text-xs text-gray-600 leading-relaxed line-clamp-2">
                                    {chapter.summary}
                                  </div>
                                )}
                                
                                {/* Progress indicator for current chapter */}
                                {videoCurrentTime >= chapter.start_time && 
                                 (!chapter.duration || videoCurrentTime < chapter.start_time + chapter.duration) && (
                                  <div className="mt-2 flex items-center gap-2">
                                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                                    <span className="text-xs text-orange-600 font-medium">Currently playing</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : chaptersLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3, 4].map((idx) => (
                        <div key={idx} className="bg-gray-50 rounded-lg p-3 animate-pulse">
                          <div className="h-4 bg-gray-200 rounded mb-2"></div>
                          <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                      <p className="text-sm">Chapters will appear here once analysis is complete</p>
                </div>
              )}
                </div>
              </div>
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
 