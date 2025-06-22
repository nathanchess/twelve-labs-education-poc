summary_prompt = """
Summarize the video in less than 5 sentences. Listen to the audio and summarize the video in a way that is helpful for a student to understand the topic being discussed.
Response must be in JSON format. Include a "summary" field. Do not include any preamble or postamble.
"""

key_takeaways_prompt = """
Generate key takeaways from the video. It should be key definitions and bullet points. 
Listen to the audio and generate key takeaways that are helpful for a student to understand the topic being discussed.
Response must be in JSON format. Include a "key_takeaways" field. Do not include any preamble or postamble.
"""

pacing_recommendations_prompt = """
Generate pacing recommendations for the video. It should be a list of recommendations for the instructor to pace the video. Listen to the audio and generate pacing recommendations that are helpful for a student to understand the topic being discussed.
Response must be in JSON format. Do not include any preamble or postamble.
"""

chapter_prompt = """
Generate chapters that covers the detailed subtopics of the video that the instructor is teaching. 
The chapter summary should break down the subtopic into easy to understand instructions, concepts, and more.
Label each chapter with an approrpriate title with the topic being discussed and methodology while being concise.
Each chapter should have a detailed start and end time. The start and end time should be in seconds.

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