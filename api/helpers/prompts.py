summary_prompt = """
Summarize the video in less than 5 sentences. Listen to the audio and summarize the video in a way that is helpful for a student to understand the topic being discussed.
"""

key_takeaways_prompt = """
Generate key takeaways from the video. It should be key definitions and bullet points. 
Listen to the audio and generate key takeaways that are helpful for a student to understand the topic being discussed.

Ensure it follows the following data schema:

class KeyTakeawaysSchema(pydantic.BaseModel):
    key_takeaways: list[str]
"""

pacing_recommendations_prompt = """
Generate pacing recommendations for the video. It should be a list of recommendations for the instructor to pace the video. Listen to the audio and generate pacing recommendations that are helpful for a student to understand the topic being discussed.
It should NOT cover every single second of the video. It should be a list of recommendations for the instructor to pace the video.
Make the timestamps very short and specific.
Limit to a maximum of 7 recommendations.

Ensure it follows the following data schema:

class PacingRecommendation(pydantic.BaseModel):
    start_time: float
    end_time: float
    recommendation: str
    severity: str

class PacingRecommendationsSchema(pydantic.BaseModel):
    recommendations: list[PacingRecommendation]

"""

chapter_prompt = """
Generate chapters that covers the detailed subtopics of the video that the instructor is teaching. 
The chapter summary should break down the subtopic into easy to understand instructions, concepts, and more.
Label each chapter with an approrpriate title with the topic being discussed and methodology while being concise.
Each chapter should have a detailed start and end time. The start and end time should be in seconds.
Limit to a maximum number of 9 chapters.

Ensure it follows the following data schema:

class ChapterSchema(pydantic.BaseModel):
    title: str
    summary: str
    start_time: float
    end_time: float
    chapter_id: int

class ChaptersSchema(pydantic.BaseModel):
    chapters: list[ChapterSchema]

Response must be in JSON format. Do not include any preamble or postamble.
"""

quiz_questions_prompt = """
Generate quiz questions for the video. It should be a list of quiz questions that are helpful for a student to understand the topic being discussed.

Here are the chapters of the video:
{}

Please give at least 1 quiz question per chapter with a maximum of 4 questions per chapter. Make sure it is not just a random question, but one that is educational and helps the student understand the topic being discussed.

Ensure it follows the following data schema:

class QuizQuestion(pydantic.BaseModel):
    question: str
    answer: str
    wrong_answers: list[str]
    chapter_id: int
"""