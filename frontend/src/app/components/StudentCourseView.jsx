'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import React from 'react';
import VideoPlayer from './VideoPlayer';

export default function StudentCourseView({ videoId, userName }) {

  const router = useRouter();
  const [videoData, setVideoData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showChapters, setShowChapters] = useState(true);
  const [videoSeekTo, setVideoSeekTo] = useState(null);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [courseMetadata, setCourseMetadata] = useState(null);
  const [reactions, setReactions] = useState([]);
  const [showReactionBar, setShowReactionBar] = useState(true);
  const [currentQuizChapter, setCurrentQuizChapter] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [wrongAnswers, setWrongAnswers] = useState([]);
  const [showQuiz, setShowQuiz] = useState(false);
  const [completedQuizzes, setCompletedQuizzes] = useState(new Set());
  const [shuffledOptions, setShuffledOptions] = useState([]);
  const [expandedChapterId, setExpandedChapterId] = useState(null);

  const handleVideoSeekTo = useCallback((seekFunction) => {
    setVideoSeekTo(() => seekFunction);
  }, []);

  const handleVideoTimeUpdate = useCallback((currentTime) => {
    setVideoCurrentTime(currentTime);
  }, []);

  const handleChapterClick = useCallback((startTime, chapterId) => {
    if (videoSeekTo) {
      videoSeekTo(startTime);
    }
    setExpandedChapterId(prev => prev === chapterId ? null : chapterId);
  }, [videoSeekTo]);

  // Helper function to format timestamp
  const formatTimestamp = (timestamp) => {
    if (typeof timestamp === 'number') {
      const minutes = Math.floor(timestamp / 60);
      const seconds = Math.floor(timestamp % 60);
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    return timestamp;
  };

  // Handle transcript timestamp click
  const handleTranscriptTimestampClick = useCallback((timestamp) => {
    if (videoSeekTo && typeof timestamp === 'number') {
      videoSeekTo(timestamp);
    }
  }, [videoSeekTo]);

  const handleReactionClick = async (emoji, label) => {
    const newReaction = {
      id: Date.now(),
      emoji: emoji,
      label: label,
      timestamp: videoCurrentTime,
      timeString: `${Math.floor(videoCurrentTime / 60)}:${(videoCurrentTime % 60).toFixed(0).padStart(2, '0')}`,
      date: new Date().toISOString()
    };
    
    setReactions(prev => [...prev, newReaction]);
    
    // Save reaction first, then show animation
    const saveSuccess = await saveReaction(newReaction);
    
    if (saveSuccess) {
      const reactionElement = document.getElementById(`reaction-${emoji}`);
      if (reactionElement) {
        reactionElement.classList.add('scale-125', 'bg-green-100');
        setTimeout(() => {
          reactionElement.classList.remove('scale-125', 'bg-green-100');
        }, 300);
      }
    } else {
      // If save failed, remove the reaction from state
      setReactions(prev => prev.filter(r => r.id !== newReaction.id));
      console.error('Failed to save reaction');
    }
  };

  // Save reaction to backend
  const saveReaction = async (reaction) => {
    try {
      console.log('Saving reaction:', reaction);
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/save_student_reaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          video_id: videoId,
          reaction: {
            emoji: reaction.emoji,
            label: reaction.label,
            timestamp: reaction.timestamp,
            time_string: reaction.timeString,
            date: reaction.date
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Reaction saved successfully:', result);
        return true;
      } else {
        console.error('Failed to save reaction:', response.status, response.statusText);
        return false;
      }
    } catch (error) {
      console.error('Error saving reaction:', error);
      return false;
    }
  };

  // Quiz functions
  const startQuiz = (chapterId) => {
    if (!courseMetadata) return;
    
    const chapter = courseMetadata.chapters?.find(ch => ch.chapter_id === chapterId);
    const chapterQuestions = courseMetadata.quiz_questions?.filter(q => q.chapter_id === chapterId) || [];
    
    if (!chapter || chapterQuestions.length === 0) {
      alert('No quiz questions available for this chapter.');
      return;
    }
    
    setCurrentQuizChapter(chapter);
    setCurrentQuestionIndex(0);
    setShowHint(false);
    setSelectedAnswer(null);
    setQuizCompleted(false);
    setWrongAnswers([]);
    setShowQuiz(true);
    // Shuffle options for the first question
    const currentQuestion = chapterQuestions[0];
    if (currentQuestion) {
      const allOptions = [currentQuestion.answer, ...currentQuestion.wrong_answers];
      setShuffledOptions(shuffleArray(allOptions));
    }
  };

  // Shuffle options when question changes
  useEffect(() => {
    if (!showQuiz || !currentQuizChapter || !courseMetadata) return;
    const chapterQuestions = courseMetadata.quiz_questions?.filter(q => q.chapter_id === currentQuizChapter.chapter_id) || [];
    const currentQuestion = chapterQuestions[currentQuestionIndex];
    if (currentQuestion) {
      const allOptions = [currentQuestion.answer, ...currentQuestion.wrong_answers];
      setShuffledOptions(shuffleArray(allOptions));
    }
  }, [currentQuestionIndex, currentQuizChapter, showQuiz, courseMetadata]);

  // Helper function to shuffle array
  function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  const handleAnswerSelect = (answer) => {
    if (selectedAnswer !== null || !courseMetadata || !currentQuizChapter) return; // Prevent multiple selections
    
    setSelectedAnswer(answer);
    
    const currentQuestion = courseMetadata.quiz_questions?.filter(q => q.chapter_id === currentQuizChapter.chapter_id)[currentQuestionIndex];
    
    if (!currentQuestion) return;
    
    const isCorrect = answer === currentQuestion.answer;
    
    if (!isCorrect) {
      // Record wrong answer
      const wrongAnswer = {
        question: currentQuestion.question,
        studentAnswer: answer,
        correctAnswer: currentQuestion.answer,
        chapterId: currentQuizChapter.chapter_id,
        timestamp: new Date().toISOString()
      };
      setWrongAnswers(prev => [...prev, wrongAnswer]);
      
      // Save wrong answer to backend
      saveWrongAnswer(wrongAnswer);
    }
    
    // Move to next question after a short delay
    setTimeout(() => {
      const chapterQuestions = courseMetadata.quiz_questions?.filter(q => q.chapter_id === currentQuizChapter.chapter_id) || [];
      
      if (currentQuestionIndex + 1 < chapterQuestions.length) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        setShowHint(false);
        setSelectedAnswer(null);
      } else {
        setQuizCompleted(true);
      }
    }, 1500);
  };

  const saveWrongAnswer = async (wrongAnswer) => {
    try {
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/save_wrong_answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          video_id: videoId,
          student_name: userName,
          wrong_answer: wrongAnswer
        })
      });

      if (!response.ok) {
        console.error('Failed to save wrong answer');
      }
    } catch (error) {
      console.error('Error saving wrong answer:', error);
    }
  };

  const closeQuiz = () => {
    setShowQuiz(false);
    setCurrentQuizChapter(null);
    setCurrentQuestionIndex(0);
    setShowHint(false);
    setSelectedAnswer(null);
    setQuizCompleted(false);
    setWrongAnswers([]);
  };

  const handleQuizComplete = () => {
    if (currentQuizChapter) {
      setCompletedQuizzes(prev => new Set([...prev, currentQuizChapter.chapter_id]));
    }
  };

  // Reaction bar component
  const ReactionBar = () => (
    <div className="bg-white border-t border-gray-200 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">How are you feeling about this content?</h3>
          <button
            onClick={() => setShowReactionBar(!showReactionBar)}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {showReactionBar && (
          <div className="flex items-center justify-center gap-4">
            <button
              id="reaction-😊"
              onClick={() => handleReactionClick('😊', 'Happy')}
              className="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-gray-50 transition-all duration-200"
              title="Happy - I understand this well"
            >
              <span className="text-2xl">😊</span>
              <span className="text-xs text-gray-600">Happy</span>
            </button>
            
            <button
              id="reaction-🤔"
              onClick={() => handleReactionClick('🤔', 'Confused')}
              className="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-gray-50 transition-all duration-200"
              title="Confused - I need clarification"
            >
              <span className="text-2xl">🤔</span>
              <span className="text-xs text-gray-600">Confused</span>
            </button>
            
            <button
              id="reaction-😮"
              onClick={() => handleReactionClick('😮', 'Surprised')}
              className="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-gray-50 transition-all duration-200"
              title="Surprised - This is unexpected"
            >
              <span className="text-2xl">😮</span>
              <span className="text-xs text-gray-600">Surprised</span>
            </button>
            
            <button
              id="reaction-😴"
              onClick={() => handleReactionClick('😴', 'Bored')}
              className="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-gray-50 transition-all duration-200"
              title="Bored - This is too slow"
            >
              <span className="text-2xl">😴</span>
              <span className="text-xs text-gray-600">Bored</span>
            </button>
            
            <button
              id="reaction-🚀"
              onClick={() => handleReactionClick('🚀', 'Excited')}
              className="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-gray-50 transition-all duration-200"
              title="Excited - This is interesting"
            >
              <span className="text-2xl">🚀</span>
              <span className="text-xs text-gray-600">Excited</span>
            </button>
            
            <button
              id="reaction-💡"
              onClick={() => handleReactionClick('💡', 'Lightbulb')}
              className="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-gray-50 transition-all duration-200"
              title="Lightbulb - I just understood something"
            >
              <span className="text-2xl">💡</span>
              <span className="text-xs text-gray-600">Lightbulb</span>
            </button>
          </div>
        )}
        
        {/* Recent Reactions Display */}
        {reactions.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-medium text-gray-600">Your Recent Reactions</h4>
              <button
                onClick={() => setReactions([])}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Clear All
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {reactions.slice(-6).map((reaction) => (
                <div
                  key={reaction.id}
                  className="flex items-center gap-1 bg-gray-100 rounded-full px-3 py-1 text-xs"
                >
                  <span>{reaction.emoji}</span>
                  <span className="text-gray-700">{reaction.timeString}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Quiz component
  const Quiz = () => {
    if (!showQuiz || !currentQuizChapter || !courseMetadata) return null;
    
    const chapterQuestions = courseMetadata.quiz_questions?.filter(q => q.chapter_id === currentQuizChapter.chapter_id) || [];
    const currentQuestion = chapterQuestions[currentQuestionIndex];
    
    if (!currentQuestion) return null;
    
    // Use shuffled options from state
    const optionLabels = ['A', 'B', 'C', 'D'];
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Quiz Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">
                Quiz: {currentQuizChapter.title}
              </h2>
              <button
                onClick={closeQuiz}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Question {currentQuestionIndex + 1} of {chapterQuestions.length}</span>
              <span>Wrong Answers: {wrongAnswers.length}</span>
            </div>
          </div>
          
          {/* Quiz Content */}
          <div className="p-6">
            {quizCompleted ? (
              <div className="text-center py-8">
                {/* Completion Animation */}
                <div className="w-20 h-20 bg-gradient-to-r from-green-400 to-green-600 rounded-full mx-auto mb-6 flex items-center justify-center animate-pulse">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                
                {/* Completion Title */}
                <h3 className="text-2xl font-bold text-gray-800 mb-2">🎉 Quiz Completed!</h3>
                
                {/* Progress Summary */}
                <div className="bg-gray-50 rounded-xl p-6 mb-6 max-w-md mx-auto">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {courseMetadata?.quiz_questions?.filter(q => q.chapter_id === currentQuizChapter.chapter_id).length || 0}
                      </div>
                      <div className="text-sm text-gray-600">Total Questions</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {wrongAnswers.length}
                      </div>
                      <div className="text-sm text-gray-600">Wrong Answers</div>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="mt-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Accuracy</span>
                      <span>{courseMetadata?.quiz_questions ? Math.round(((courseMetadata.quiz_questions.filter(q => q.chapter_id === currentQuizChapter.chapter_id).length - wrongAnswers.length) / courseMetadata.quiz_questions.filter(q => q.chapter_id === currentQuizChapter.chapter_id).length) * 100) : 0}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all duration-1000"
                        style={{ 
                          width: `${courseMetadata?.quiz_questions ? ((courseMetadata.quiz_questions.filter(q => q.chapter_id === currentQuizChapter.chapter_id).length - wrongAnswers.length) / courseMetadata.quiz_questions.filter(q => q.chapter_id === currentQuizChapter.chapter_id).length) * 100 : 0}%` 
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
                
                {/* Performance Message */}
                <div className="mb-6">
                  {wrongAnswers.length === 0 ? (
                    <div className="text-green-600 font-semibold">
                      🏆 Perfect Score! Excellent work!
                    </div>
                  ) : wrongAnswers.length <= 1 ? (
                    <div className="text-green-600 font-semibold">
                      🌟 Great job! You're doing well!
                    </div>
                  ) : wrongAnswers.length <= 2 ? (
                    <div className="text-yellow-600 font-semibold">
                      👍 Good effort! Keep practicing!
                    </div>
                  ) : (
                    <div className="text-orange-600 font-semibold">
                      📚 Review the material and try again later!
                    </div>
                  )}
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => {
                      handleQuizComplete();
                      closeQuiz();
                    }}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Close Quiz
                  </button>
                  {wrongAnswers.length > 0 && (
                    <button
                      onClick={() => {
                        // Could add functionality to review wrong answers
                        alert('Review feature coming soon!');
                      }}
                      className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                    >
                      Review Mistakes
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Question */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    {currentQuestion.question}
                  </h3>
                  
                  {/* Hint Button */}
                  {currentQuestion.hint && (
                    <div className="mb-4">
                      <button
                        onClick={() => setShowHint(!showHint)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {showHint ? 'Hide Hint' : 'Show Hint'}
                      </button>
                      
                      {showHint && (
                        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-sm text-blue-800">{currentQuestion.hint}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Answer Options */}
                <div className="space-y-3">
                  {shuffledOptions.map((option, index) => {
                    const isSelected = selectedAnswer === option;
                    const isCorrect = option === currentQuestion.answer;
                    const isAnswered = selectedAnswer !== null;
                    
                    let buttonClasses = 'w-full p-4 rounded-lg border-2 transition-all duration-200 text-left cursor-pointer';
                    let circleClasses = 'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold';
                    
                    if (isAnswered) {
                      // Question has been answered
                      if (isSelected && isCorrect) {
                        buttonClasses += ' border-green-500 bg-green-50 text-green-800';
                        circleClasses += ' bg-green-500 text-white';
                      } else if (isSelected && !isCorrect) {
                        buttonClasses += ' border-red-500 bg-red-50 text-red-800';
                        circleClasses += ' bg-red-500 text-white';
                      } else if (isCorrect) {
                        buttonClasses += ' border-green-500 bg-green-50 text-green-800';
                        circleClasses += ' bg-green-500 text-white';
                      } else {
                        buttonClasses += ' border-gray-200 bg-gray-50 text-gray-600';
                        circleClasses += ' bg-gray-200 text-gray-600';
                      }
                    } else {
                      // Question not answered yet
                      buttonClasses += ' border-gray-200 hover:border-blue-300 hover:bg-blue-50';
                      circleClasses += ' bg-gray-200 text-gray-600';
                    }
                    
                    return (
                      <button
                        key={index}
                        onClick={() => !isAnswered && handleAnswerSelect(option)}
                        className={buttonClasses}
                      >
                        <div className="flex items-center gap-3">
                          <div className={circleClasses}>
                            {optionLabels[index]}
                          </div>
                          <span className="font-medium">{option}</span>
                          {isAnswered && isCorrect && (
                            <div className="ml-auto">
                              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                          {isAnswered && isSelected && !isCorrect && (
                            <div className="ml-auto">
                              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
                
                {/* Feedback Message */}
                {selectedAnswer !== null && (
                  <div className={`mt-4 p-3 rounded-lg ${
                    selectedAnswer === currentQuestion.answer
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-red-50 border border-red-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      {selectedAnswer === currentQuestion.answer ? (
                        <>
                          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-sm font-medium text-green-700">Correct!</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          <span className="text-sm font-medium text-red-700">Incorrect. Moving to next question...</span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Answer Explanation */}
                {selectedAnswer !== null && currentQuestion.answer_explanation && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm font-medium text-blue-800">Explanation</span>
                    </div>
                    <p className="text-sm text-blue-700 leading-relaxed">{currentQuestion.answer_explanation}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Fetch video data from TwelveLabs
  const fetchVideo = async () => {
      try {

        console.log("Fetching")
        
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

        // Create a fallback video data structure
        const videoData = {
          name: responseData.data.system_metadata?.filename || 'Unknown Video',
          size: responseData.data.system_metadata?.duration || 0,
          date: responseData.data.created_at || new Date().toISOString(),
          twelveLabsVideoId: videoId,
          uploadDate: responseData.data.created_at || new Date().toISOString(),
          // Store the HLS URL separately for potential future use
          hlsUrl: responseData.data.hls?.video_url || null
        }

        setVideoData(videoData);
        setLoading(false)
        
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
        setLoading(false)
      }
    }

  // Fetch course metadata from database
  const fetchCourseMetadata = async () => {
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
        console.log('Course metadata:', result.data);
        setCourseMetadata(result.data);
      } else {
        console.error('Failed to fetch course metadata');
      }
    } catch (error) {
      console.error('Error fetching course metadata:', error);
    }
  };

  useEffect(() => {
    const initializeCourse = async () => {
      await fetchVideo();
      await fetchCourseMetadata();
    };

    initializeCourse();
  }, [videoId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white to-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Loading Course...</h2>
          <p className="text-gray-600">Please wait while we load your course content.</p>
        </div>
      </div>
    );
  }

  if (!videoData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white to-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Course Not Found</h2>
          <p className="text-gray-600">The requested course could not be loaded.</p>
          <button
            onClick={() => router.push('/dashboard/my-courses')}
            className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            Back to Courses
          </button>
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
              onClick={() => router.push('/dashboard/my-courses')}
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors duration-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{courseMetadata?.title || videoData.name}</h1>
              <p className="text-gray-600">Student Course View</p>
            </div>
          </div>
          
          {/* Done Button */}
          <button
            onClick={() => router.push(`/dashboard/progress/${videoId}`)}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 transform hover:scale-[1.02] hover:shadow-lg font-medium flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Submit Assignment
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto flex">
        {/* Left Side - Video and Content */}
        <main className="flex-1 p-6">
          {/* Video Player */}
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
            {/* Reaction Bar */}
            <ReactionBar />
          </div>

          {/* Course Information */}
          {courseMetadata && (
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Course Information</h2>
              
              {/* Course Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="font-semibold text-blue-800">Chapters</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-600">{courseMetadata.chapters?.length || 0}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-semibold text-green-800">Quiz Questions</span>
                  </div>
                  <p className="text-2xl font-bold text-green-600">{courseMetadata.quiz_questions?.length || 0}</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <span className="font-semibold text-purple-800">Key Takeaways</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-600">{courseMetadata.key_takeaways?.length || 0}</p>
                </div>
              </div>

              {/* Course Summary */}
              {courseMetadata?.summary && (
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Course Summary</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-700 leading-relaxed">{courseMetadata.summary}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Transcript Section */}
          {courseMetadata?.transcript && (
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800">Transcript</h2>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Full transcript with timestamps</span>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto transcript-container">
                <div className="space-y-3">
                  {Array.isArray(courseMetadata.transcript) ? (
                    // If transcript is an array of segments
                    courseMetadata.transcript.map((segment, index) => (
                      <div key={index} className="flex gap-3 p-2 hover:bg-gray-100 rounded transition-colors">
                        {segment.timestamp && (
                          <button
                            onClick={() => handleTranscriptTimestampClick(segment.timestamp)}
                            className="text-sm text-blue-600 font-mono whitespace-nowrap hover:text-blue-800 hover:underline cursor-pointer"
                          >
                            {formatTimestamp(segment.timestamp)}
                          </button>
                        )}
                        <p className="text-gray-700 flex-1">
                          {segment.text || segment.content || segment}
                        </p>
                      </div>
                    ))
                  ) : (
                    // If transcript is a string, split by lines or paragraphs
                    typeof courseMetadata.transcript === 'string' && (
                      <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {courseMetadata.transcript}
                      </div>
                    )
                  )}
                </div>
              </div>
              
              <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Click on timestamps to jump to specific parts of the video</span>
                </div>
                <button
                  onClick={() => {
                    const transcriptElement = document.querySelector('.transcript-container');
                    if (transcriptElement) {
                      transcriptElement.classList.toggle('max-h-96');
                      transcriptElement.classList.toggle('max-h-none');
                    }
                  }}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Show more
                </button>
              </div>
            </div>
          )}
        </main>

        {/* Right Sidebar - Chapters */}
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
              <div className="space-y-4">
                {/* Quiz Progress Summary */}
                {courseMetadata?.quiz_questions && courseMetadata.quiz_questions.length > 0 && (
                  <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-xl p-4 mb-4 border border-blue-200">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-800">Quiz Progress</h4>
                      <div className="text-sm text-gray-600">
                        {completedQuizzes.size} / {new Set(courseMetadata.quiz_questions.map(q => q.chapter_id)).size} completed
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-500"
                        style={{ 
                          width: `${(completedQuizzes.size / new Set(courseMetadata.quiz_questions.map(q => q.chapter_id)).size) * 100}%`
                        }}
                      ></div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>Completed</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                        <span>Remaining</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {courseMetadata?.chapters?.map((chapter, index) => (
                  <div key={chapter.chapter_id}>
                    <div
                      className={`p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center justify-between ${expandedChapterId === chapter.chapter_id ? 'bg-blue-50' : ''}`}
                      onClick={() => handleChapterClick(chapter.start_time, chapter.chapter_id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                          {index + 1}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-800">{chapter.title}</h3>
                          <p className="text-sm text-gray-600">{chapter.time_string}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Quiz Button with Completion Indicator */}
                        {courseMetadata?.quiz_questions?.some(q => q.chapter_id === chapter.chapter_id) && (
                          <div className="flex items-center gap-2">
                            {completedQuizzes.has(chapter.chapter_id) && (
                              <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Completed
                              </div>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (completedQuizzes.has(chapter.chapter_id)) {
                                  alert('You have already completed this quiz!');
                                  return;
                                }
                                startQuiz(chapter.chapter_id);
                              }}
                              className={`px-3 py-1 rounded-lg transition-colors text-sm font-medium ${
                                completedQuizzes.has(chapter.chapter_id)
                                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                                  : 'bg-green-100 text-green-700 hover:bg-green-200'
                              }`}
                              disabled={completedQuizzes.has(chapter.chapter_id)}
                            >
                              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              {completedQuizzes.has(chapter.chapter_id) ? 'Completed' : 'Quiz'}
                            </button>
                          </div>
                        )}
                        <svg className={`w-5 h-5 text-gray-400 transform transition-transform duration-200 ${expandedChapterId === chapter.chapter_id ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                    {/* Chapter Summary Dropdown */}
                    {expandedChapterId === chapter.chapter_id && chapter.summary && (
                      <div className="mt-2 mb-4 ml-12 mr-2 p-4 bg-blue-50 border-l-4 border-blue-400 rounded-lg shadow-sm animate-fade-in">
                        <h4 className="font-semibold text-blue-800 mb-2">Chapter Summary</h4>
                        <p className="text-gray-700 text-sm">{chapter.summary}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
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

      {/* Quiz Component */}
      <Quiz />
    </div>
  );
}