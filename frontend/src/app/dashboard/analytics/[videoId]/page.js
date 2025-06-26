'use client';

import { useUser } from '../../../context/UserContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import VideoPlayer from '../../../components/VideoPlayer';

export default function CourseAnalytics() {
  const { userRole, userName, isLoggedIn } = useUser();
  const router = useRouter();
  const params = useParams();
  const videoId = params.videoId;
  
  const [loading, setLoading] = useState(true);
  const [courseMetadata, setCourseMetadata] = useState(null);
  const [videoData, setVideoData] = useState(null);
  const [studentData, setStudentData] = useState([]);
  const [courseAnalysis, setCourseAnalysis] = useState(null);
  const [courseAnalysisLoading, setCourseAnalysisLoading] = useState(false);
  const [videoSeekTo, setVideoSeekTo] = useState(null);

  const handleVideoSeekTo = useCallback((seekFunction) => {
    setVideoSeekTo(() => seekFunction);
  }, []);

  // Function to generate seating chart data
  const generateSeatingChartData = () => {
    // Extract real student data from the API response
    const realStudents = studentData
      .filter(student => student.student_name && student[`${videoId}_progress_report`])
      .map(student => {
        const progressReport = student[`${videoId}_progress_report`];
        const totalQuestions = progressReport.total_questions || 0;
        const wrongAnswers = progressReport.wrong_answers?.length || 0;
        const correctAnswers = totalQuestions - wrongAnswers;
        const quizPercentage = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
        
        let status = 'excellent';
        if (quizPercentage < 60) status = 'struggling';
        else if (quizPercentage < 80) status = 'average';
        
        return {
          id: student.student_name,
          name: student.student_name,
          quizScore: quizPercentage,
          status: status,
          totalQuestions: totalQuestions,
          correctAnswers: correctAnswers
        };
      });
    
    return realStudents.length > 0 ? realStudents : Array.from({ length: 16 }, (_, i) => ({
      id: i + 1,
      name: `Student ${String.fromCharCode(65 + i)}`,
      quizScore: Math.floor(Math.random() * 30) + 70,
      status: Math.random() > 0.7 ? 'struggling' : Math.random() > 0.5 ? 'average' : 'excellent'
    }));
  };

  const fetchVideo = async () => {
    const retrievalURL = `https://api.twelvelabs.io/v1.3/indexes/${process.env.NEXT_PUBLIC_TWELVE_LABS_INDEX_ID}/videos/${videoId}?transcription=true`
    try {
      const retrieveVideoResponse = await fetch(retrievalURL, {
        method: 'GET',
        headers: {
          'x-api-key': process.env.NEXT_PUBLIC_TWELVE_LABS_API_KEY
        }
      });
      
      if (!retrieveVideoResponse.ok) {
        throw new Error(`HTTP ${retrieveVideoResponse.status}: ${retrieveVideoResponse.statusText}`);
      }
      
      const result = await retrieveVideoResponse.json();

      // Create video data structure matching StudentCourseView
      const videoData = {
        name: result.system_metadata?.filename || 'Unknown Video',
        size: result.system_metadata?.duration || 0,
        date: result.created_at || new Date().toISOString(),
        blob: null,
        blobUrl: null,
        twelveLabsVideoId: videoId,
        uploadDate: result.created_at || new Date().toISOString(),
        hlsUrl: result.hls?.video_url || null
      }

      console.log('Setting video data:', videoData);
      setVideoData(videoData);
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
        uploadDate: new Date().toISOString(),
        hlsUrl: null
      };
      console.log('Setting fallback video data:', fallbackData);
      setVideoData(fallbackData);
    }
  };

  const fetchStudentData = async () => {
    try {
      console.log('Fetching student data for video:', videoId);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/fetch_student_data_from_course`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ video_id: videoId })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Student data fetched successfully:', result);
        if (result.status === 'success' && result.data) {
          setStudentData(result.data);
        }
      } else {
        console.error('Failed to fetch student data:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error fetching student data:', error);
    }
  };

  const fetchCourseAnalysis = async () => {
    try {
      setCourseAnalysisLoading(true);
      console.log('Fetching course analysis for video:', videoId);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/generate_course_analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ video_id: videoId })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Course analysis fetched successfully:', result);
        if (result.status === 'success' && result.data) {
          setCourseAnalysis(result.data);
        }
      } else {
        console.error('Failed to fetch course analysis:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error fetching course analysis:', error);
    } finally {
      setCourseAnalysisLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoggedIn) {
      router.push('/');
      return;
    }

    if (userRole !== 'instructor') {
      router.push('/dashboard');
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch course metadata
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

        // Fetch video data
        await fetchVideo();

        // Fetch student data
        await fetchStudentData();

        // Set loading to false after main data is loaded
        setLoading(false);

        // Fetch course analysis separately (this can take longer)
        fetchCourseAnalysis();
      } catch (error) {
        console.error('Error fetching analytics data:', error);
        setLoading(false);
      }
    };

    if (videoId) {
      fetchData();
    }
  }, [videoId, userName, isLoggedIn, userRole, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white to-gray-50">
        {/* Header Skeleton */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 bg-gray-200 rounded-lg animate-pulse"></div>
              <div className="space-y-2">
                <div className="w-48 h-6 bg-gray-200 rounded animate-pulse"></div>
                <div className="w-32 h-4 bg-gray-200 rounded animate-pulse"></div>
              </div>
            </div>
            <div className="w-24 h-10 bg-gray-200 rounded-lg animate-pulse"></div>
          </div>
        </div>

        {/* Content Skeleton */}
        <div className="max-w-7xl mx-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column Skeleton */}
            <div className="lg:col-span-1 space-y-6">
              {/* Student Performance Skeleton */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="w-48 h-6 bg-gray-200 rounded animate-pulse mb-4"></div>
                
                {/* Seating Chart Skeleton */}
                <div className="mb-6">
                  <div className="w-32 h-5 bg-gray-200 rounded animate-pulse mb-3"></div>
                  <div className="grid grid-cols-4 gap-2">
                    {Array.from({ length: 16 }, (_, i) => (
                      <div key={i} className="h-16 bg-gray-200 rounded-lg animate-pulse"></div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-4">
                    {Array.from({ length: 3 }, (_, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-gray-200 rounded animate-pulse"></div>
                        <div className="w-16 h-3 bg-gray-200 rounded animate-pulse"></div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Class Averages Skeleton */}
                <div className="space-y-4">
                  <div className="w-32 h-5 bg-gray-200 rounded animate-pulse"></div>
                  {Array.from({ length: 4 }, (_, i) => (
                    <div key={i} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-24 h-4 bg-gray-200 rounded animate-pulse"></div>
                        <div className="w-12 h-4 bg-gray-200 rounded animate-pulse"></div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 animate-pulse"></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Class Insights Skeleton */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="w-32 h-6 bg-gray-200 rounded animate-pulse mb-4"></div>
                <div className="space-y-4">
                  {Array.from({ length: 2 }, (_, i) => (
                    <div key={i} className="bg-gray-50 rounded-lg p-4">
                      <div className="w-40 h-5 bg-gray-200 rounded animate-pulse mb-2"></div>
                      <div className="space-y-2">
                        {Array.from({ length: 3 }, (_, j) => (
                          <div key={j} className="w-full h-4 bg-gray-200 rounded animate-pulse"></div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column Skeleton */}
            <div className="lg:col-span-2 space-y-6">
              {/* Video Player Skeleton */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="w-32 h-6 bg-gray-200 rounded animate-pulse mb-4"></div>
                <div className="bg-gray-200 rounded-lg h-64 animate-pulse flex items-center justify-center">
                  <div className="text-gray-400">
                    <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="w-32 h-4 bg-gray-300 rounded animate-pulse mx-auto"></div>
                  </div>
                </div>
              </div>

              {/* Student Reactions Skeleton */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Student Reactions & Reasoning</h3>
                {courseAnalysisLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 4 }, (_, i) => (
                      <div key={i} className="border-l-4 border-gray-200 pl-4">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 bg-gray-200 rounded animate-pulse"></div>
                          <div className="w-24 h-4 bg-gray-200 rounded animate-pulse"></div>
                          <div className="w-20 h-3 bg-gray-200 rounded animate-pulse"></div>
                        </div>
                        <div className="w-full h-4 bg-gray-200 rounded animate-pulse"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="border-l-4 border-purple-500 pl-4">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">😊</span>
                        <span className="text-sm font-medium text-gray-700">2:15 - Happy</span>
                        <span className="text-xs text-gray-500">by Student A</span>
                      </div>
                      <p className="text-sm text-gray-600">"I understand this well - the explanation was clear and the examples helped a lot."</p>
                    </div>
                    
                    <div className="border-l-4 border-yellow-500 pl-4">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">🤔</span>
                        <span className="text-sm font-medium text-gray-700">4:32 - Confused</span>
                        <span className="text-xs text-gray-500">by Student B</span>
                      </div>
                      <p className="text-sm text-gray-600">"Need clarification on this step - the transition from equation 1 to 2 isn't clear."</p>
                    </div>
                    
                    <div className="border-l-4 border-green-500 pl-4">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">💡</span>
                        <span className="text-sm font-medium text-gray-700">6:45 - Lightbulb</span>
                        <span className="text-xs text-gray-500">by Student C</span>
                      </div>
                      <p className="text-sm text-gray-600">"Just understood something - the pattern is becoming clear now!"</p>
                    </div>
                    
                    <div className="border-l-4 border-red-500 pl-4">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">😴</span>
                        <span className="text-sm font-medium text-gray-700">8:20 - Bored</span>
                        <span className="text-xs text-gray-500">by Student D</span>
                      </div>
                      <p className="text-sm text-gray-600">"This is too slow - I already know this part, can we move faster?"</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Engagement Heatmap Skeleton */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="w-48 h-6 bg-gray-200 rounded animate-pulse mb-4"></div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-24 h-4 bg-gray-200 rounded animate-pulse"></div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-4 bg-gray-200 rounded animate-pulse"></div>
                      <div className="flex gap-1">
                        {Array.from({ length: 5 }, (_, i) => (
                          <div key={i} className="w-4 h-4 bg-gray-200 rounded animate-pulse"></div>
                        ))}
                      </div>
                      <div className="w-8 h-4 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-20 gap-1">
                    {Array.from({ length: 20 }, (_, i) => (
                      <div key={i} className="h-8 bg-gray-200 rounded animate-pulse"></div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {Array.from({ length: 2 }, (_, i) => (
                      <div key={i} className="w-full h-4 bg-gray-200 rounded animate-pulse"></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard/analytics')}
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors duration-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                {courseMetadata?.title || 'Course Analytics'}
              </h1>
              <p className="text-gray-600">Performance insights and engagement data</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Student Performance & Class Insights */}
          <div className="lg:col-span-1 space-y-6">
            {/* Individual Student Performance */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Individual Student Performance</h3>
              
              {/* Seating Chart */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Student Seating Chart</h4>
                <div className="grid grid-cols-4 gap-2">
                  {generateSeatingChartData().map((student) => {
                    let bgColor = 'bg-green-100 border-green-300';
                    let textColor = 'text-green-700';
                    if (student.status === 'struggling') {
                      bgColor = 'bg-red-100 border-red-300';
                      textColor = 'text-red-700';
                    } else if (student.status === 'average') {
                      bgColor = 'bg-yellow-100 border-yellow-300';
                      textColor = 'text-yellow-700';
                    }
                    
                    return (
                      <button
                        key={student.id}
                        className={`${bgColor} border-2 rounded-lg p-2 text-center hover:scale-105 transition-transform duration-200 cursor-pointer`}
                        onClick={() => {
                          const details = student.id.startsWith('Student')
                            ? `Viewing ${student.name}'s performance:\nQuiz Score: ${student.quizScore}%\nStatus: ${student.status}`
                            : `Student: ${student.name}\nQuiz Score: ${student.quizScore}%\nCorrect Answers: ${student.correctAnswers}/${student.totalQuestions}\nStatus: ${student.status}`;
                          alert(details);
                        }}
                      >
                        <div className="text-xs font-medium text-gray-800 mb-1">{student.name}</div>
                        <div className={`text-xs font-bold ${textColor}`}>{student.quizScore}%</div>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
                      <span>Excellent (80%+)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-yellow-100 border border-yellow-300 rounded"></div>
                      <span>Average (60-79%)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-red-100 border border-red-300 rounded"></div>
                      <span>Struggling (&lt;60%)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Class Averages */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-700">Class Averages</h4>
                {courseAnalysisLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 3 }, (_, i) => (
                      <div key={i} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="w-24 h-4 bg-gray-200 rounded animate-pulse"></div>
                          <div className="w-12 h-4 bg-gray-200 rounded animate-pulse"></div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 animate-pulse"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Average Quiz Score</span>
                        <span className="text-lg font-bold text-purple-600">
                          {(() => {
                            const students = generateSeatingChartData();
                            if (students.length === 0) return 'N/A';
                            const avgScore = students.reduce((sum, student) => sum + student.quizScore, 0) / students.length;
                            return `${Math.round(avgScore)}%`;
                          })()}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-purple-600 h-2 rounded-full transition-all duration-500" 
                          style={{ 
                            width: `${(() => {
                              const students = generateSeatingChartData();
                              if (students.length === 0) return 0;
                              const avgScore = students.reduce((sum, student) => sum + student.quizScore, 0) / students.length;
                              return Math.round(avgScore);
                            })()}%` 
                          }}
                        ></div>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Students Struggling</span>
                        <span className="text-lg font-bold text-red-600">
                          {courseAnalysis?.most_challenging_class_topic?.percentage_of_students_struggling || 0}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-red-600 h-2 rounded-full transition-all duration-500" 
                          style={{ 
                            width: `${courseAnalysis?.most_challenging_class_topic?.percentage_of_students_struggling || 0}%` 
                          }}
                        ></div>
                      </div>
                    </div>
                    
                    <div className="bg-yellow-50 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-yellow-800 mb-2">Most Challenging Topic</h4>
                      <p className="text-sm text-yellow-700">
                        {courseAnalysis?.most_challenging_class_topic?.topic || 'Analysis in progress...'}
                      </p>
                      <p className="text-xs text-yellow-600 mt-1">
                        {courseAnalysis?.most_challenging_class_topic?.percentage_of_students_struggling || 0}% of students struggled
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Overall Class Insights */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Class Insights</h3>
              {courseAnalysisLoading ? (
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="w-40 h-5 bg-gray-200 rounded animate-pulse mb-2"></div>
                    <div className="space-y-2">
                      {Array.from({ length: 3 }, (_, j) => (
                        <div key={j} className="w-full h-4 bg-gray-200 rounded animate-pulse"></div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-red-50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-red-800 mb-2">Challenging Concepts</h4>
                    {courseAnalysis?.challenging_concepts && courseAnalysis.challenging_concepts.length > 0 ? (
                      <ul className="text-sm text-red-700 space-y-1">
                        {courseAnalysis.challenging_concepts.map((concept, index) => (
                          <li key={index} className="flex items-center gap-2">
                            <span className="text-red-600">•</span>
                            <span>{concept}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-red-600">Analysis in progress...</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Course Analysis */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">AI Course Analysis</h3>
              
              {courseAnalysisLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }, (_, i) => (
                    <div key={i} className="bg-gray-50 rounded-lg p-4">
                      <div className="w-32 h-5 bg-gray-200 rounded animate-pulse mb-2"></div>
                      <div className="space-y-2">
                        {Array.from({ length: 2 }, (_, j) => (
                          <div key={j} className="w-full h-4 bg-gray-200 rounded animate-pulse"></div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : courseAnalysis ? (
                <div className="space-y-4">
                  {/* Most Challenging Topic */}
                  {courseAnalysis.most_challenging_class_topic && (
                    <div className="bg-red-50 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-red-800 mb-2">Most Challenging Topic</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-red-700">Topic:</span>
                          <span className="text-sm text-red-700">{courseAnalysis.most_challenging_class_topic.topic}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-red-700">Students Struggling:</span>
                          <span className="text-sm font-bold text-red-700">{courseAnalysis.most_challenging_class_topic.percentage_of_students_struggling}%</span>
                        </div>
                        <p className="text-sm text-red-600 mt-2">{courseAnalysis.most_challenging_class_topic.reasoning}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Recommended Action */}
                  {courseAnalysis.recommended_action && (
                    <div className="bg-green-50 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-green-800 mb-2">Recommended Action</h4>
                      <p className="text-sm text-green-700">{courseAnalysis.recommended_action}</p>
                    </div>
                  )}
                  
                  {/* Next Steps */}
                  {courseAnalysis.next_steps && (
                    <div className="bg-blue-50 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-blue-800 mb-2">Next Steps</h4>
                      <p className="text-sm text-blue-700">{courseAnalysis.next_steps}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-600">Generating AI analysis...</p>
                  <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Video & Engagement */}
          <div className="lg:col-span-2 space-y-6">
            {/* Video Player */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Course Video</h3>
              {videoData ? (
                <div className="bg-black rounded-lg overflow-hidden">
                  <VideoPlayer
                    videoData={videoData}
                    onSeekTo={handleVideoSeekTo}
                  />
                </div>
              ) : (
                <div className="bg-gray-100 rounded-lg p-8 text-center">
                  <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-gray-600">Video not available</p>
                  <p className="text-sm text-gray-500 mt-2">Loading video data...</p>
                </div>
              )}
            </div>

            {/* Student Reactions */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Student Reactions & Reasoning</h3>
              {courseAnalysisLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 4 }, (_, i) => (
                    <div key={i} className="border-l-4 border-gray-200 pl-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 bg-gray-200 rounded animate-pulse"></div>
                        <div className="w-24 h-4 bg-gray-200 rounded animate-pulse"></div>
                        <div className="w-20 h-3 bg-gray-200 rounded animate-pulse"></div>
                      </div>
                      <div className="w-full h-4 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="border-l-4 border-purple-500 pl-4">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">😊</span>
                      <span className="text-sm font-medium text-gray-700">2:15 - Happy</span>
                      <span className="text-xs text-gray-500">by Student A</span>
                    </div>
                    <p className="text-sm text-gray-600">"I understand this well - the explanation was clear and the examples helped a lot."</p>
                  </div>
                  
                  <div className="border-l-4 border-yellow-500 pl-4">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">🤔</span>
                      <span className="text-sm font-medium text-gray-700">4:32 - Confused</span>
                      <span className="text-xs text-gray-500">by Student B</span>
                    </div>
                    <p className="text-sm text-gray-600">"Need clarification on this step - the transition from equation 1 to 2 isn't clear."</p>
                  </div>
                  
                  <div className="border-l-4 border-green-500 pl-4">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">💡</span>
                      <span className="text-sm font-medium text-gray-700">6:45 - Lightbulb</span>
                      <span className="text-xs text-gray-500">by Student C</span>
                    </div>
                    <p className="text-sm text-gray-600">"Just understood something - the pattern is becoming clear now!"</p>
                  </div>
                  
                  <div className="border-l-4 border-red-500 pl-4">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">😴</span>
                      <span className="text-sm font-medium text-gray-700">8:20 - Bored</span>
                      <span className="text-xs text-gray-500">by Student D</span>
                    </div>
                    <p className="text-sm text-gray-600">"This is too slow - I already know this part, can we move faster?"</p>
                  </div>
                </div>
              )}
            </div>

            {/* Content Engagement Heatmap */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Content Engagement Heatmap</h3>
              {courseAnalysisLoading ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-24 h-4 bg-gray-200 rounded animate-pulse"></div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-4 bg-gray-200 rounded animate-pulse"></div>
                      <div className="flex gap-1">
                        {Array.from({ length: 5 }, (_, i) => (
                          <div key={i} className="w-4 h-4 bg-gray-200 rounded animate-pulse"></div>
                        ))}
                      </div>
                      <div className="w-8 h-4 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-20 gap-1">
                    {Array.from({ length: 20 }, (_, i) => (
                      <div key={i} className="h-8 bg-gray-200 rounded animate-pulse"></div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {Array.from({ length: 2 }, (_, i) => (
                      <div key={i} className="w-full h-4 bg-gray-200 rounded animate-pulse"></div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                    <span>Engagement Level</span>
                    <div className="flex items-center gap-2">
                      <span>Low</span>
                      <div className="flex gap-1">
                        <div className="w-4 h-4 bg-gray-200 rounded"></div>
                        <div className="w-4 h-4 bg-yellow-200 rounded"></div>
                        <div className="w-4 h-4 bg-orange-200 rounded"></div>
                        <div className="w-4 h-4 bg-red-200 rounded"></div>
                        <div className="w-4 h-4 bg-red-400 rounded"></div>
                      </div>
                      <span>High</span>
                    </div>
                  </div>
                  
                  {courseAnalysis?.content_engagement && courseAnalysis.content_engagement.length > 0 ? (
                    <div className="space-y-4">
                      {/* Group engagement by chapter */}
                      {(() => {
                        const chapters = {};
                        courseAnalysis.content_engagement.forEach(engagement => {
                          if (!chapters[engagement.chapter_id]) {
                            chapters[engagement.chapter_id] = [];
                          }
                          chapters[engagement.chapter_id].push(engagement);
                        });
                        
                        return Object.entries(chapters).map(([chapterId, engagements]) => (
                          <div key={chapterId} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h5 className="text-sm font-semibold text-gray-700">Chapter {chapterId}</h5>
                              <div className="text-xs text-gray-500">
                                {engagements.length} engagement event{engagements.length !== 1 ? 's' : ''}
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-10 gap-1 mb-3">
                              {Array.from({ length: 10 }, (_, i) => {
                                // Find engagement for this position (if any)
                                const engagement = engagements.find(e => 
                                  Math.floor((parseInt(e.timestamp.split(':')[1]) || 0) / 6) === i
                                );
                                
                                let bgColor = 'bg-gray-200';
                                let engagementLevel = 0;
                                
                                if (engagement) {
                                  engagementLevel = engagement.engagement_level;
                                  if (engagementLevel >= 4) bgColor = 'bg-red-400';
                                  else if (engagementLevel >= 3) bgColor = 'bg-red-200';
                                  else if (engagementLevel >= 2) bgColor = 'bg-orange-200';
                                  else if (engagementLevel >= 1) bgColor = 'bg-yellow-200';
                                }
                                
                                return (
                                  <div
                                    key={i}
                                    className={`h-6 ${bgColor} rounded cursor-pointer hover:opacity-80 transition-opacity relative`}
                                    title={engagement ? 
                                      `Minute ${i * 6 + 1}-${(i + 1) * 6}: Level ${engagementLevel}/5 - ${engagement.engagement_reason}` :
                                      `Minute ${i * 6 + 1}-${(i + 1) * 6}: No engagement data`
                                    }
                                  >
                                    {engagement && (
                                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full border border-white"></div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            
                            <div className="space-y-2">
                              {engagements.map((engagement, index) => (
                                <div key={index} className="text-xs text-gray-600 bg-gray-50 rounded p-2">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-medium">{engagement.timestamp}</span>
                                    <div className="flex items-center gap-1">
                                      {Array.from({ length: 5 }, (_, i) => (
                                        <div
                                          key={i}
                                          className={`w-2 h-2 rounded-full ${
                                            i < engagement.engagement_level 
                                              ? 'bg-purple-500' 
                                              : 'bg-purple-200'
                                          }`}
                                        ></div>
                                      ))}
                                    </div>
                                  </div>
                                  <p className="text-gray-500">{engagement.engagement_reason}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 border-4 border-gray-300 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-gray-600">No engagement data available</p>
                      <p className="text-sm text-gray-500 mt-2">Engagement analysis will appear here when available</p>
                    </div>
                  )}
                  
                  <div className="text-sm text-gray-600 mt-4">
                    <p><strong>Legend:</strong></p>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-gray-200 rounded"></div>
                        <span>No data</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-yellow-200 rounded"></div>
                        <span>Low (1-2)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-orange-200 rounded"></div>
                        <span>Medium (3)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-red-200 rounded"></div>
                        <span>High (4-5)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span>Event marker</span>
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
  );
} 