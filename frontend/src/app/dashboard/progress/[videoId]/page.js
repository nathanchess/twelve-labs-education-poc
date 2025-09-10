'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '../../../context/UserContext';
import VideoPlayer from '../../../components/VideoPlayer';

export default function StudentProgressPage() {
  const params = useParams();
  const router = useRouter();
  const { userName, isLoggedIn } = useUser();
  const videoId = params.videoId;
  
  const [loading, setLoading] = useState(true);
  const [progressData, setProgressData] = useState(null);
  const [courseMetadata, setCourseMetadata] = useState(null);
  const [videoData, setVideoData] = useState(null);
  const [videoSeekTo, setVideoSeekTo] = useState(null);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);

  const [generatingRelatedVideos, setGeneratingRelatedVideos] = useState(false);

  const [relatedVideos, setRelatedVideos] = useState({});

  const handleVideoSeekTo = useCallback((seekFunction) => {
    setVideoSeekTo(() => seekFunction);
  }, []);

  const handleVideoTimeUpdate = useCallback((currentTime) => {
    setVideoCurrentTime(currentTime);
  }, []);

  const handleChapterClick = useCallback((startTime) => {
    if (videoSeekTo) {
      videoSeekTo(startTime);
    }
  }, [videoSeekTo]);

  useEffect(() => {
    if (!isLoggedIn) {
      router.push('/');
      return;
    }

    // Don't proceed if userName is not available yet
    if (!userName || userName.trim() === '') {
      console.log('userName not available yet:', userName);
      return;
    }

    console.log('userName available:', userName);

    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch course metadata first
        const metadataResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/fetch_course_metadata`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ video_id: videoId })
        });
        
        if (metadataResponse.ok) {
          const metadata = await metadataResponse.json();
          setCourseMetadata(metadata.data);
        }

        // Fetch video data (HLS URL)
        try {
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
          
          setVideoData({
            name: responseData.data.system_metadata?.filename || 'Course Video',
            hlsUrl:  responseData.data.hls?.video_url,
            size: responseData.data.system_metadata?.duration || 0,
            uploadDate: responseData.data.created_at                                    
          });

        } catch (videoError) {
          console.log('Video data not available, using fallback');
          // Fallback video data structure
          setVideoData({
            name: courseMetadata?.title || 'Course Video',
            hlsUrl: null,
            size: 0
          });
        }

        let data = null;
        try {
          console.log('Fetching progress report for:', { video_id: videoId, student_name: userName });
          const existingReportResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/get_student_progress_report`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
              video_id: videoId, 
              student_name: userName 
            })
          });

          const existingReportData = await existingReportResponse.json();
          
          if (existingReportData.status === 'success' && existingReportData.data) {
            console.log('Found existing progress report, using cached data');
            data = existingReportData;
          } else if (existingReportData.status === 'not_found') {
            console.log('No existing progress report found, calculating new one');
            // If no existing report, calculate quiz performance
            const calculateResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/calculate_quiz_performance`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ 
                video_id: videoId, 
                student_name: userName 
              })
            });

            data = await calculateResponse.json();
          } else {
            console.log('Error in existing report response:', existingReportData);
            // Fallback to calculating quiz performance
            const calculateResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/calculate_quiz_performance`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ 
                video_id: videoId, 
                student_name: userName 
              })
            });

            data = await calculateResponse.json();
          }
        } catch (error) {
          console.error('Error fetching progress data:', error);
          // Fallback to calculating quiz performance
          const calculateResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/calculate_quiz_performance`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
              video_id: videoId, 
              student_name: userName 
            })
          });

          data = await calculateResponse.json();
        }
        
        console.log('API Response:', data);
        
        if (data.status === 'success' && data.data) {
          // Format the data for the frontend
          const formattedData = {
            quizResults: {
              totalQuestions: data.data.total_questions,
              correctAnswers: data.data.total_questions - data.data.wrong_answers.length,
              accuracy: Math.round((1 - data.data.accuracy) * 100), // Convert to percentage
              timeSpent: 0, // Not provided in API
              chapters: Object.entries(data.data.question_by_chapters).map(([chapterId, questions]) => {
                const wrongAnswersForChapter = data.data.wrong_answers.filter(wa => wa.chapterId === chapterId);
                const correctAnswers = questions.length - wrongAnswersForChapter.length;
                const accuracy = Math.round((correctAnswers / questions.length) * 100);
                
                return {
                  id: chapterId,
                  title: `Chapter ${chapterId}`,
                  correct: correctAnswers,
                  total: questions.length,
                  accuracy: accuracy,
                  start_time: (parseInt(chapterId) - 1) * 300 // Estimate start time based on chapter number
                };
              })
            },
            studyRecommendations: data.data.study_recommendations?.study_recommendations?.map(rec => ({
              type: "review",
              title: rec.recommendation_title,
              description: rec.recommendation_description,
              priority: rec.priority.toLowerCase(),
              estimatedTime: rec.time_to_review,
              recommendedChapters: rec.recommended_chapters
            })) || [],
            conceptMastery: {
              overall: data.data.concept_mastery?.concept_mastery?.length > 0 
                ? (() => {
                    const concepts = data.data.concept_mastery.concept_mastery;
                    console.log('Raw concept mastery data:', concepts);
                    
                    const masteryLevels = concepts.map(concept => {
                      const level = typeof concept.mastery_level === 'string' 
                        ? parseInt(concept.mastery_level, 10) 
                        : concept.mastery_level;
                      console.log(`Concept: ${concept.concept}, Mastery Level: ${level} (type: ${typeof level})`);
                      return level;
                    });
                    
                    const average = Math.round(masteryLevels.reduce((sum, level) => sum + level, 0) / masteryLevels.length);
                    console.log('Calculated average mastery:', average);
                    return average;
                  })()
                : Math.round((1 - data.data.accuracy) * 100),
              concepts: data.data.concept_mastery?.concept_mastery?.map(concept => {
                // Ensure mastery_level is a number
                const masteryLevel = typeof concept.mastery_level === 'string' 
                  ? parseInt(concept.mastery_level, 10) 
                  : concept.mastery_level;
                
                let status = "needs_work";
                if (masteryLevel >= 80) status = "mastered";
                else if (masteryLevel >= 60) status = "developing";
                
                return {
                  name: concept.concept,
                  mastery: masteryLevel,
                  status: status,
                  chapterTitle: concept.chapter_title,
                  reasoning: concept.reasoning
                };
              }) || Object.entries(data.data.question_by_chapters).map(([chapterId, questions]) => {
                const wrongAnswersForChapter = data.data.wrong_answers.filter(wa => wa.chapterId === chapterId);
                const mastery = Math.round(((questions.length - wrongAnswersForChapter.length) / questions.length) * 100);
                
                let status = "needs_work";
                if (mastery >= 80) status = "mastered";
                else if (mastery >= 60) status = "developing";
                
                return {
                  name: `Chapter ${chapterId} Concepts`,
                  mastery: mastery,
                  status: status,
                  chapterTitle: chapterTitleMap[chapterId] || `Chapter ${chapterId}`,
                  reasoning: `Based on ${questions.length - wrongAnswersForChapter.length} correct answers out of ${questions.length} questions.`
                };
              })
            },
            reviewPathways: [
              {
                path: "Quick Review",
                description: "15-minute focused review of key concepts",
                difficulty: "easy",
                topics: ["Basic Principles", "Application"]
              },
              {
                path: "Comprehensive Review",
                description: "45-minute deep dive into all topics",
                difficulty: "medium",
                topics: ["All Concepts"]
              },
              {
                path: "Challenge Mode",
                description: "Advanced problems and critical thinking",
                difficulty: "hard",
                topics: ["Problem Solving", "Critical Analysis"]
              }
            ],
            wrongAnswers: data.data.wrong_answers || []
          };
          
          // Add answer explanations to wrong answers
          if (formattedData.wrongAnswers.length > 0) {
            formattedData.wrongAnswers = formattedData.wrongAnswers.map(wrongAnswer => {
              // Find the corresponding question in question_by_chapters to get the explanation
              const chapterQuestions = data.data.question_by_chapters[wrongAnswer.chapterId] || [];
              const questionData = chapterQuestions.find(q => q.question === wrongAnswer.question);
              
              return {
                ...wrongAnswer,
                answerExplanation: questionData?.answer_explanation || 'No explanation available',
                hint: questionData?.hint || null
              };
            });
          }

          setLoading(false);
          setProgressData(formattedData);
        } else {
          console.error('API returned error:', data);
        }
        
        
      } catch (error) {
        console.error('Error fetching progress data:', error);
        setLoading(false);
      }
    };

    if (videoId && userName) {
      fetchData();
    }
  }, [videoId, userName, isLoggedIn, router]);

  useEffect(() => {

    const fetchRelatedVideos = async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/fetch_related_videos`, {
        method: 'POST',
        body: JSON.stringify({ video_id: videoId })
      });

      const data = await response.json();
      
      setRelatedVideos(data.data);
    }

    console.log(progressData, generatingRelatedVideos);

    if (progressData && !generatingRelatedVideos) {
      setGeneratingRelatedVideos(true);
      fetchRelatedVideos();
    }

  }, [progressData, generatingRelatedVideos])

  // Create chapter title mapping from course metadata
  const chapterTitleMap = {};
  if (courseMetadata?.chapters) {
    courseMetadata.chapters.forEach(chapter => {
      chapterTitleMap[chapter.chapter_id] = chapter.title;
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white to-gray-50 flex items-center justify-center relative overflow-hidden">
        {/* Floating Subject Icons Background */}
        <div className="absolute inset-0 pointer-events-none">
          {/* History Icon */}
          <div className="absolute top-20 left-10 w-16 h-16 bg-orange-100/30 rounded-full flex items-center justify-center animate-float-slow">
            <svg className="w-8 h-8 text-orange-600/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          
          {/* Science Icon */}
          <div className="absolute top-32 right-20 w-20 h-20 bg-blue-100/30 rounded-full flex items-center justify-center animate-float-medium">
            <svg className="w-10 h-10 text-blue-600/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          
          {/* Math Icon */}
          <div className="absolute bottom-40 left-20 w-14 h-14 bg-green-100/30 rounded-full flex items-center justify-center animate-float-fast">
            <svg className="w-7 h-7 text-green-600/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          
          {/* Literature Icon */}
          <div className="absolute bottom-32 right-16 w-18 h-18 bg-purple-100/30 rounded-full flex items-center justify-center animate-float-slow">
            <svg className="w-9 h-9 text-purple-600/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          
          {/* Art Icon */}
          <div className="absolute top-1/2 left-8 w-12 h-12 bg-pink-100/30 rounded-full flex items-center justify-center animate-float-medium">
            <svg className="w-6 h-6 text-pink-600/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z" />
            </svg>
          </div>
          
          {/* Geography Icon */}
          <div className="absolute top-1/3 right-8 w-16 h-16 bg-teal-100/30 rounded-full flex items-center justify-center animate-float-fast">
            <svg className="w-8 h-8 text-teal-600/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          
          {/* Music Icon */}
          <div className="absolute bottom-1/3 left-1/4 w-14 h-14 bg-indigo-100/30 rounded-full flex items-center justify-center animate-float-slow">
            <svg className="w-7 h-7 text-indigo-600/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          
          {/* Computer Science Icon */}
          <div className="absolute top-2/3 right-1/3 w-16 h-16 bg-cyan-100/30 rounded-full flex items-center justify-center animate-float-medium">
            <svg className="w-8 h-8 text-cyan-600/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          
          {/* Physics Icon */}
          <div className="absolute top-1/4 left-1/3 w-12 h-12 bg-yellow-100/30 rounded-full flex items-center justify-center animate-float-fast">
            <svg className="w-6 h-6 text-yellow-600/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          
          {/* Chemistry Icon */}
          <div className="absolute bottom-1/4 right-1/4 w-18 h-18 bg-red-100/30 rounded-full flex items-center justify-center animate-float-slow">
            <svg className="w-9 h-9 text-red-600/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
        </div>
        
        <div className="text-center relative z-10">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Loading Progress...</h2>
          <p className="text-gray-600">Analyzing your performance and generating recommendations</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-gray-50 relative overflow-hidden">
      {/* Floating Subject Icons Background */}
      <div className="absolute inset-0 pointer-events-none">
        {/* History Icon */}
        <div className="absolute top-20 left-10 w-16 h-16 bg-orange-100/30 rounded-full flex items-center justify-center animate-float-slow">
          <svg className="w-8 h-8 text-orange-600/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        
        {/* Science Icon */}
        <div className="absolute top-32 right-20 w-20 h-20 bg-blue-100/30 rounded-full flex items-center justify-center animate-float-medium">
          <svg className="w-10 h-10 text-blue-600/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        </div>
        
        {/* Math Icon */}
        <div className="absolute bottom-40 left-20 w-14 h-14 bg-green-100/30 rounded-full flex items-center justify-center animate-float-fast">
          <svg className="w-7 h-7 text-green-600/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
        
        {/* Literature Icon */}
        <div className="absolute bottom-32 right-16 w-18 h-18 bg-purple-100/30 rounded-full flex items-center justify-center animate-float-slow">
          <svg className="w-9 h-9 text-purple-600/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        
        {/* Art Icon */}
        <div className="absolute top-1/2 left-8 w-12 h-12 bg-pink-100/30 rounded-full flex items-center justify-center animate-float-medium">
          <svg className="w-6 h-6 text-pink-600/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z" />
          </svg>
        </div>
        
        {/* Geography Icon */}
        <div className="absolute top-1/3 right-8 w-16 h-16 bg-teal-100/30 rounded-full flex items-center justify-center animate-float-fast">
          <svg className="w-8 h-8 text-teal-600/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        
        {/* Music Icon */}
        <div className="absolute bottom-1/3 left-1/4 w-14 h-14 bg-indigo-100/30 rounded-full flex items-center justify-center animate-float-slow">
          <svg className="w-7 h-7 text-indigo-600/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        </div>
        
        {/* Computer Science Icon */}
        <div className="absolute top-2/3 right-1/3 w-16 h-16 bg-cyan-100/30 rounded-full flex items-center justify-center animate-float-medium">
          <svg className="w-8 h-8 text-cyan-600/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        
        {/* Physics Icon */}
        <div className="absolute top-1/4 left-1/3 w-12 h-12 bg-yellow-100/30 rounded-full flex items-center justify-center animate-float-fast">
          <svg className="w-6 h-6 text-yellow-600/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        
        {/* Chemistry Icon */}
        <div className="absolute bottom-1/4 right-1/4 w-18 h-18 bg-red-100/30 rounded-full flex items-center justify-center animate-float-slow">
          <svg className="w-9 h-9 text-red-600/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        </div>
      </div>

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 relative z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard/my-courses')}
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors duration-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                {courseMetadata?.title || 'Course Progress'}
              </h1>
              <p className="text-gray-600">Your learning journey and recommendations</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6 relative z-10">
        {/* Video Player */}
        {videoData && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-6">
            <div className="bg-black flex items-center justify-center p-6">
              <div className="w-full max-w-4xl">
                <VideoPlayer 
                  videoData={videoData} 
                  onSeekTo={handleVideoSeekTo} 
                  onTimeUpdate={handleVideoTimeUpdate}
                />
              </div>
            </div>
          </div>
        )}

        {/* Quiz Results Overview */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Quiz Performance</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-semibold text-blue-800">Accuracy</span>
              </div>
              <p className="text-3xl font-bold text-blue-600">{progressData?.quizResults?.accuracy}%</p>
            </div>
            
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-semibold text-green-800">Questions</span>
              </div>
              <p className="text-3xl font-bold text-green-600">
                {progressData?.quizResults?.correctAnswers}/{progressData?.quizResults?.totalQuestions}
              </p>
            </div>
            
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span className="font-semibold text-orange-800">Mastery</span>
              </div>
              <p className="text-3xl font-bold text-orange-600">{progressData?.conceptMastery?.overall}%</p>
            </div>
          </div>

          {/* Chapter Breakdown */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Performance by Chapter</h3>
            <div className="space-y-3">
              {progressData?.quizResults?.chapters?.map((chapter) => (
                <div 
                  key={chapter.id} 
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  onClick={() => handleChapterClick(chapter.start_time)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                      {chapter.id}
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-800">{chapterTitleMap[chapter.id] || chapter.title}</h4>
                      <p className="text-sm text-gray-600">{chapter.correct}/{chapter.total} correct</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-800">{chapter.accuracy}%</p>
                    <div className="w-20 h-2 bg-gray-200 rounded-full mt-1">
                      <div 
                        className={`h-2 rounded-full ${
                          chapter.accuracy >= 80 ? 'bg-green-500' : 
                          chapter.accuracy >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${chapter.accuracy}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Personalized Study Recommendations */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Personalized Study Recommendations</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {progressData?.studyRecommendations?.map((rec, index) => (
              <div key={index} className={`p-4 rounded-lg border-l-4 ${
                rec.priority === 'high' ? 'bg-red-50 border-red-400' :
                rec.priority === 'medium' ? 'bg-yellow-50 border-yellow-400' :
                'bg-green-50 border-green-400'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${
                    rec.priority === 'high' ? 'bg-red-500' :
                    rec.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                  }`}></div>
                  <span className="text-sm font-medium text-gray-600 uppercase">{rec.priority} Priority</span>
                </div>
                <h3 className="font-semibold text-gray-800 mb-2">{rec.title}</h3>
                <p className="text-gray-600 text-sm mb-3">{rec.description}</p>
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{rec.estimatedTime}</span>
                </div>
                {rec.recommendedChapters && rec.recommendedChapters.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {rec.recommendedChapters.map((chapterId, idx) => (
                      <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                        {chapterTitleMap[chapterId] || `Chapter ${chapterId}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Wrong Answers Section */}
        {progressData?.wrongAnswers && progressData.wrongAnswers.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Questions You Got Wrong</h2>
            <div className="space-y-4">
              {progressData.wrongAnswers.map((wrongAnswer, index) => (
                <div key={index} className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-800 mb-2">{wrongAnswer.question}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-3">
                        <div>
                          <span className="text-red-600 font-medium">Your Answer:</span>
                          <p className="text-gray-700 mt-1">{wrongAnswer.studentAnswer}</p>
                        </div>
                        <div>
                          <span className="text-green-600 font-medium">Correct Answer:</span>
                          <p className="text-gray-700 mt-1">{wrongAnswer.correctAnswer}</p>
                        </div>
                      </div>
                      
                      {/* Answer Explanation */}
                      {wrongAnswer.answerExplanation && (
                        <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-sm font-medium text-blue-800">Why this is the correct answer:</span>
                          </div>
                          <p className="text-sm text-blue-700 leading-relaxed">{wrongAnswer.answerExplanation}</p>
                        </div>
                      )}
                      
                      {/* Hint (if available) */}
                      {wrongAnswer.hint && (
                        <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            <span className="text-sm font-medium text-yellow-800">Hint for next time:</span>
                          </div>
                          <p className="text-sm text-yellow-700 leading-relaxed">{wrongAnswer.hint}</p>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          {chapterTitleMap[wrongAnswer.chapterId] || `Chapter ${wrongAnswer.chapterId}`}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(wrongAnswer.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Concept Mastery Tracking */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Concept Mastery Tracking</h2>
          <div className="space-y-4">
            {progressData?.conceptMastery?.concepts?.map((concept, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      concept.status === 'mastered' ? 'bg-green-500' :
                      concept.status === 'developing' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}></div>
                    <div>
                      <h4 className="font-medium text-gray-800">{concept.name}</h4>
                      <p className="text-sm text-gray-600 capitalize">{concept.status.replace('_', ' ')}</p>
                      {concept.chapterTitle && (
                        <p className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded mt-1 inline-block">
                          {concept.chapterTitle}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-800">{concept.mastery}%</p>
                    <div className="w-24 h-2 bg-gray-200 rounded-full mt-1">
                      <div 
                        className={`h-2 rounded-full ${
                          concept.mastery >= 80 ? 'bg-green-500' : 
                          concept.mastery >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${concept.mastery}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
                
                {/* Reasoning Section */}
                {concept.reasoning && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      <span className="text-sm font-medium text-gray-700">Assessment Reasoning</span>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">{concept.reasoning}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* External Resources */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">External Resources</h2>
          <p className="text-gray-600 mb-6">Additional videos to help you master these concepts</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {relatedVideos && Array.isArray(relatedVideos) && relatedVideos.length > 0 ? (
              relatedVideos.map((videoData, index) => {
                // Extract URL and similarity score from the tuple
                const [videoUrl, similarityScore] = videoData;
                
                // Extract video name from URL
                const urlParts = videoUrl.split('/');
                const fileName = decodeURIComponent(urlParts[urlParts.length - 1].split('?')[0]);
                const videoName = fileName.replace(/\.(mp4|avi|mov|mkv)$/i, '').replace(/_/g, ' ');
                
                // Calculate similarity percentage
                const similarityPercentage = Math.round((1 - similarityScore) * 100);
                
                return (
                  <div key={index} className="border border-gray-200 rounded-lg overflow-hidden hover:border-blue-300 transition-colors">
                    <div className="relative">
                      <div className="w-full h-32 bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                        <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                        {similarityPercentage}% Match
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-800 mb-1 line-clamp-2">{videoName}</h3>
                      <p className="text-sm text-gray-600 mb-2">Recommended Video</p>
                      <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                        This video is highly relevant to your current study material
                      </p>
                      <a 
                        href={videoUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Watch Video
                      </a>
                    </div>
                  </div>
                );
              })
            ) : (
              // Fallback content when no related videos are available
              <div className="col-span-full text-center py-8">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-gray-500">No related videos available at the moment</p>
                <p className="text-sm text-gray-400 mt-1">Check back later for personalized recommendations</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}