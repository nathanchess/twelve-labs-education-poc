'use client';

import { useUser } from '../../../context/UserContext';
import React from 'react';
import { use } from 'react';
import InstructorCourseView from '../../../components/InstructorCourseView';
import StudentCourseView from '../../../components/StudentCourseView';

export default function VideoPage({ params }) {

  const { videoId } = use(params);
  const { userRole, userName, isLoggedIn } = useUser(); 

  // Show loading state until user role is determined to prevent hydration mismatch
  if (!userRole) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white to-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Loading...</h2>
          <p className="text-gray-600">Please wait while we determine your role</p>
        </div>
      </div>
    );
  }

  if (userRole === 'instructor') {
    return <InstructorCourseView videoId={videoId} />
  } else {
    return <StudentCourseView videoId={videoId} userName={userName} />
  }

} 