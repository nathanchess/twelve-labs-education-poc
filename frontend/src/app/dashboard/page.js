'use client';

import { useUser } from '../context/UserContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Dashboard() {
  const { userRole, userName, isLoggedIn, logout } = useUser();
  const router = useRouter();
  const [publishedCourses, setPublishedCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) {
      router.push('/');
    }
  }, [isLoggedIn, router]);

  useEffect(() => {
    if (isLoggedIn && userRole === 'instructor') {
      fetchPublishedCourses();
    }
  }, [isLoggedIn, userRole]);

  const fetchPublishedCourses = async () => {
    setLoadingCourses(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/get_published_courses`);
      if (response.ok) {
        const result = await response.json();
        // Filter out courses that do not have chapters metadata...
        const courses = result.data.map((course) => {
          if (!course.chapters) {
            return null;
          }
          return course;
        }).filter(course => course !== null);
        setPublishedCourses(courses || []);
      } else {
        console.error('Failed to fetch published courses');
      }
    } catch (error) {
      console.error('Error fetching published courses:', error);
    } finally {
      setLoadingCourses(false);
    }
  };

  if (!isLoggedIn) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-gray-50 p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">
              Welcome, {userName || (userRole === 'instructor' ? 'Instructor' : 'Student')}!
            </h1>
            <p className="text-gray-600 mt-2">
              You are logged in as: <span className="font-semibold capitalize">{userRole}</span>
            </p>
          </div>
          <button
            onClick={logout}
            className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors duration-200 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>

        {/* Role-specific content */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {userRole === 'instructor' ? (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Instructor Dashboard</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <button
                  onClick={() => router.push('/dashboard/courses')}
                  className="bg-blue-50 rounded-xl p-6 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-all duration-200 cursor-pointer text-left group"
                >
                  <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-2">Course Management</h3>
                  <p className="text-gray-600 text-sm">Manage your courses and content</p>
                </button>
                <button
                  onClick={() => router.push('/dashboard/analytics')}
                  className="bg-green-50 rounded-xl p-6 border border-green-200 hover:bg-green-100 hover:border-green-300 transition-all duration-200 cursor-pointer text-left group"
                >
                  <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-2">Analytics</h3>
                  <p className="text-gray-600 text-sm">View student performance data</p>
                </button>
                <button
                  onClick={() => router.push('/dashboard/students')}
                  className="bg-purple-50 rounded-xl p-6 border border-purple-200 hover:bg-purple-100 hover:border-purple-300 transition-all duration-200 cursor-pointer text-left group"
                >
                  <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-2">Students</h3>
                  <p className="text-gray-600 text-sm">Manage student enrollments</p>
                </button>
              </div>

              {/* Published Courses Section */}
              <div className="mt-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-800">Published Courses</h3>
                  <button
                    onClick={fetchPublishedCourses}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                  </button>
                </div>

                {loadingCourses ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="bg-gray-50 rounded-xl p-6 animate-pulse">
                        <div className="h-4 bg-gray-200 rounded mb-3"></div>
                        <div className="h-3 bg-gray-200 rounded w-2/3 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : publishedCourses.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {publishedCourses.map((course) => (
                      <div
                        key={course.video_id}
                        className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200 hover:border-blue-300 transition-all duration-200 cursor-pointer group"
                        onClick={() => router.push(`/dashboard/courses/${course.video_id}`)}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                            Published
                          </span>
                        </div>
                        <h4 className="font-semibold text-gray-800 mb-2 line-clamp-2">{course.title}</h4>
                        <div className="space-y-2 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span>{course.chapters?.length || 0} chapters</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{course.quiz_questions?.length || 0} quiz questions</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            <span>{course.key_takeaways?.length || 0} key takeaways</span>
                          </div>
                        </div>
                        <div className="mt-4 pt-3 border-t border-blue-200">
                          <p className="text-xs text-gray-500">Click to view course details</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-gray-50 rounded-xl">
                    <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">No Published Courses Yet</h3>
                    <p className="text-gray-600 mb-4">Start by creating and publishing your first course</p>
                    <button
                      onClick={() => router.push('/dashboard/courses')}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center gap-2 mx-auto"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Create Course
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Student Dashboard</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <button
                  onClick={() => router.push('/dashboard/my-courses')}
                  className="bg-blue-50 rounded-xl p-6 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-all duration-200 cursor-pointer text-left group"
                >
                  <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-2">My Courses</h3>
                  <p className="text-gray-600 text-sm">Access your enrolled courses</p>
                </button>
                <button
                  onClick={() => router.push('/dashboard/progress')}
                  className="bg-green-50 rounded-xl p-6 border border-green-200 hover:bg-green-100 hover:border-green-300 transition-all duration-200 cursor-pointer text-left group"
                >
                  <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-2">Progress</h3>
                  <p className="text-gray-600 text-sm">Track your learning progress</p>
                </button>
                <button
                  onClick={() => router.push('/dashboard/study-material')}
                  className="bg-purple-50 rounded-xl p-6 border border-purple-200 hover:bg-purple-100 hover:border-purple-300 transition-all duration-200 cursor-pointer text-left group"
                >
                  <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-2">Study Material</h3>
                  <p className="text-gray-600 text-sm">Access your study material generated by the AI</p>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 