import React from 'react';

export default function ChaptersSection({ videoData, chapters, loading, seekTo, currentTime, duration }) {
    const formatTime = (time) => {
      const minutes = Math.floor(time / 60);
      const seconds = Math.floor(time % 60);
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };
  
    // Use API chapters if available, otherwise fall back to generated chapters
    const getChapters = () => {
      if (chapters && chapters.length > 0) {
        // Transform API chapters to match the expected format
        return chapters.map(chapter => ({
          id: chapter.chapter_id,
          title: chapter.title,
          summary: chapter.summary,
          startTime: chapter.start_time,
          endTime: chapter.end_time,
          duration: chapter.end_time - chapter.start_time
        }));
      }
      return [];
    };
  
    const getCurrentChapter = () => {
      const allChapters = getChapters();
      if (!allChapters || allChapters.length === 0) {
        return { title: 'Loading...', startTime: 0, endTime: 0, duration: 0, summary: '' };
      }
      return allChapters.find(chapter => 
        currentTime >= chapter.startTime && currentTime < chapter.endTime
      ) || allChapters[0];
    };
  
    const allChapters = getChapters();
    const currentChapter = getCurrentChapter();
  
    const handleChapterClick = (startTime) => {
      if (seekTo) {
        seekTo(startTime);
      }
    };
  
    return (
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Chapters
        </h3>
        <p className="text-sm text-gray-500 mb-4">Navigate through lecture sections and track your progress</p>
        
        {/* Current Chapter Indicator */}
        <div className="bg-blue-50 rounded-lg p-4 mb-4 border border-blue-200">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
            <div>
              <p className="text-blue-700">{currentChapter?.title || 'Loading...'}</p>
              <p className="text-sm text-blue-600 mt-1">
                {formatTime(currentTime)} / {formatTime(duration)}
              </p>
              {currentChapter?.summary && (
                <p className="text-xs text-blue-600 mt-2 italic">
                  {currentChapter.summary}
                </p>
              )}
            </div>
          </div>
        </div>
  
        {/* Chapter List */}
        <div className="space-y-2">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-3 rounded-lg bg-gray-50 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          ) : allChapters && allChapters.length > 0 ? (
            allChapters.map((chapter) => (
              <div
                key={chapter.id}
                className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                  currentTime >= chapter.startTime && currentTime < chapter.endTime
                    ? 'bg-blue-100 border border-blue-300'
                    : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
                }`}
                onClick={() => handleChapterClick(chapter.startTime)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-800">{chapter.title}</h4>
                    <p className="text-sm text-gray-600">
                      {formatTime(chapter.startTime)} - {formatTime(chapter.endTime)}
                    </p>
                    {chapter.summary && (
                      <p className="text-xs text-gray-500 mt-1 italic line-clamp-2">
                        {chapter.summary}
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 ml-2 flex-shrink-0">
                    {formatTime(chapter.duration)}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-4 text-gray-500 text-sm">
              <p>Chapters will appear here once video loads</p>
            </div>
          )}
        </div>
      </div>
    );
  };
  