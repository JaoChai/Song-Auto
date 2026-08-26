

===== PAGE: quickstart =====
KIE.AI
language
language
Market
Support
Market
File Upload API
Common API
Market
File Upload API
Common API
Getting Started with KIE API (Important)
Market
Image Models
Seedream
Z-image
Google
Flux-2
Grok Imagine
GPT Image
Topaz
Recraft
Ideogram
Qwen
4o Image API
Flux Kontext API
Wan
Video Models
Grok Imagine
Kling
Bytedance
Hailuo
Wan
Topaz
Infinitalk
Runway API
PixVerse
MiniMax H3
HappyHorse
Gemini Omni
OmniHuman
Volcengine
Music Models
Chat Models
Suno API
Suno API Quickstart
Music Generation
Lyrics Generation
WAV Conversion
Vocal Removal
Music Video Generation
Sounds Generation
voice
Veo3.1 API
Get Task Details
GET
Suno API
Copy Page
Suno API Quickstart
Get started with the Suno API to generate AI music, lyrics, and audio content in minutes
Welcome to Suno API
The Suno API enables you to create high-quality AI-generated music, lyrics, and audio content using state-of-the-art AI models. Whether you're building a music app, automating creative workflows, or developing audio content, our API provides comprehensive tools for music generation and audio processing.
Generate Music
Create original music tracks with or without lyrics
Extend Music
Extend existing music tracks seamlessly
Generate Lyrics
Create creative lyrics from text prompts
Music Videos
Convert audio tracks into visual music videos
Upload & Cover
Transform uploaded audio into new styles
Upload & Extend
Upload audio files and extend them seamlessly
Add Instrumental
Generate instrumental accompaniment for uploaded audio
Add Vocals
Add vocal singing to uploaded audio files
Separate Vocals
Separate vocals and instrumentals from music
Convert to WAV
Convert audio to high-quality WAV format
Get Lyrics
Retrieve timestamped synchronized lyrics
Authentication
All API requests require authentication using a Bearer token. Get your API key from the API Key Management Page.
Keep your API key secure and never share it publicly. If compromised, reset it immediately.
API Base URL
https://api.kie.ai
Authentication Header
Authorization: Bearer YOUR_API_KEY
Quick Start Guide
Step 1: Generate Your First Music Track
Start with a simple music generation request:
cURL
Node.js
Python
curl -X POST "https://api.kie.ai/api/v1/generate" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A calm and relaxing piano track with soft melodies",
    "customMode": false,
    "instrumental": true,
    "model": "V3_5",
    "callBackUrl": "https://your-app.com/callback"
  }'
Step 2: Check Task Status
Use the returned task ID to check the generation status:
cURL
Node.js
Python
curl -X GET "https://api.kie.ai/api/v1/generate/record-info?taskId=YOUR_TASK_ID" \
  -H "Authorization: Bearer YOUR_API_KEY"
Response Format
Successful Response:
{
  "code": 200,
  "msg": "success",
  "data": {
    "taskId": "5c79****be8e"
  }
}
Task Status Response:
{
  "code": 200,
  "msg": "success",
  "data": {
    "taskId": "5c79****be8e",
    "status": "SUCCESS",
    "response": {
      "sunoData": [
        {
          "id": "e231****-****-****-****-****8cadc7dc",
          "audioUrl": "https://example.cn/****.mp3",
          "streamAudioUrl": "https://example.cn/****",
          "imageUrl": "https://example.cn/****.jpeg",
          "prompt": "A calm and relaxing piano track",
          "title": "Peaceful Piano",
          "tags": "calm, relaxing, piano",
          "duration": 198.44,
          "createTime": "2025-01-01 00:00:00"
        }
      ]
    }
  }
}
Core Features
Text-to-Music: Generate music from text descriptions with AI
Music Extension: Seamlessly extend existing audio tracks
Lyrics Generation: Create structured lyrical content from creative prompts
Audio Upload & Cover: Upload audio files and transform them into different musical styles
Add Instrumental: Generate instrumental accompaniment for uploaded audio files
Add Vocals: Add vocal singing to uploaded audio files with custom styles
Vocal Separation: Isolate vocals, instrumentals, and other audio components
Format Conversion: Support for WAV and other high-quality audio formats
Music Videos: Create visual content synchronized with your audio tracks
Audio Processing: Comprehensive tools for audio enhancement and manipulation
AI Models
Choose the right model for your needs:
V3_5
Better song structure
Max 4 minutes, improved song organization
V4
Improved vocals
Max 4 minutes, enhanced vocal quality
V4_5
Smart prompts
Max 8 minutes, faster generation
V4_5PLUS
Richer sound
Max 8 minutes, new creative ways
V4_5ALL
Smart and fast
Max 8 minutes, smarter prompts, faster generations
V5
Faster generation
Max 8 minutes, superior musicality, improved speed
V5_5
Unleash Your Voice
Custom Models Tailored to Your Unique Taste.
Generation Modes
Parameter Overview
Parameter	Type	Required	Description
customMode	boolean	Yes	Controls parameter complexity: false (Simple Mode) or true (Advanced Mode)
instrumental	boolean	Yes	Determines vocal presence: true (Instrumental only) or false (Includes lyrics)
Key Parameters
Parameter	Type	Required	Description
prompt	string	Yes	Text description used to generate music
style	string	No	Music style instructions (Custom Mode only)
title	string	No	Title for the generated music (Custom Mode only)
Prompt Character Limits
Non-Custom Mode: 500 characters
Custom Mode (V3_5 & V4): 3,000 characters
Custom Mode (V4_5, V4_5PLUS & V5): 5,000 characters
Style Character Limits
V3_5 & V4: 200 characters
V4_5, V4_5PLUS & V5: 1,000 characters
Title Character Limit
Maximum Length: 80 characters
Complete Workflow Example
Here's a complete example that generates music with lyrics and waits for completion:
JavaScript
Python
class SunoAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.kie.ai/api/v1';
  }
  
  async generateMusic(prompt, options = {}) {
    const response = await fetch(`${this.baseUrl}/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt,
        customMode: options.customMode || false,
        instrumental: options.instrumental || false,
        model: options.model || 'V3_5',
        style: options.style,
        title: options.title,
        negativeTags: options.negativeTags,
        callBackUrl: options.callBackUrl || 'https://your-app.com/callback'
      })
    });
    
    const result = await response.json();
    if (!response.ok || result.code !== 200) {
      throw new Error(`Generation failed: ${result.msg || 'Unknown error'}`);
    }
    
    return result.data.taskId;
  }
  
  async extendMusic(audioId, options = {}) {
    const response = await fetch(`${this.baseUrl}/generate/extend`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        audioId,
        defaultParamFlag: options.defaultParamFlag || false,
        model: options.model || 'V3_5',
        prompt: options.prompt,
        style: options.style,
        title: options.title,
        continueAt: options.continueAt,
        callBackUrl: options.callBackUrl || 'https://your-app.com/callback'
      })
    });
    
    const result = await response.json();
    if (!response.ok || result.code !== 200) {
      throw new Error(`Extension failed: ${result.msg || 'Unknown error'}`);
    }
    
    return result.data.taskId;
  }
  
  async generateLyrics(prompt, callBackUrl) {
    const response = await fetch(`${this.baseUrl}/lyrics`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt,
        callBackUrl
      })
    });
    
    const result = await response.json();
    if (!response.ok || result.code !== 200) {
      throw new Error(`Lyrics generation failed: ${result.msg || 'Unknown error'}`);
    }
    
    return result.data.taskId;
  }
  
  async waitForCompletion(taskId, maxWaitTime = 600000) { // 10 minutes max
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const status = await this.getTaskStatus(taskId);
      
      switch (status.status) {
        case 'SUCCESS':
          console.log('All tracks generated successfully!');
          return status.response;
          
        case 'FIRST_SUCCESS':
          console.log('First track generation completed!');
          return status.response;
          
        case 'TEXT_SUCCESS':
          console.log('Lyrics/text generation successful!');
          return status.response;
          
        case 'PENDING':
          console.log('Task is pending...');
          break;
          
        case 'CREATE_TASK_FAILED':
          const createError = status.errorMessage || 'Task creation failed';
          console.error('Error message:', createError);
          throw new Error(createError);
          
        case 'GENERATE_AUDIO_FAILED':
          const audioError = status.errorMessage || 'Audio generation failed';
          console.error('Error message:', audioError);
          throw new Error(audioError);
          
        case 'CALLBACK_EXCEPTION':
          const callbackError = status.errorMessage || 'Callback process error';
          console.error('Error message:', callbackError);
          throw new Error(callbackError);
          
        case 'SENSITIVE_WORD_ERROR':
          const sensitiveError = status.errorMessage || 'Content filtered due to sensitive words';
          console.error('Error message:', sensitiveError);
          throw new Error(sensitiveError);
          
        default:
          console.log(`Unknown status: ${status.status}`);
          if (status.errorMessage) {
            console.error('Error message:', status.errorMessage);
          }
          break;
      }
      
      // Wait 10 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
    
    throw new Error('Generation timeout');
  }
  
  async getTaskStatus(taskId) {
    const response = await fetch(`${this.baseUrl}/generate/record-info?taskId=${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });
    
    const result = await response.json();
    if (!response.ok || result.code !== 200) {
      throw new Error(`Status check failed: ${result.msg || 'Unknown error'}`);
    }
    
    return result.data;
  }
}

// Usage Example
async function main() {
  const api = new SunoAPI('YOUR_API_KEY');
  
  try {
    // Generate music with lyrics
    console.log('Starting music generation...');
    const taskId = await api.generateMusic(
      'A nostalgic folk song about childhood memories',
      { 
        customMode: true,
        instrumental: false,
        model: 'V4_5',
        style: 'Folk, Acoustic, Nostalgic',
        title: 'Childhood Dreams'
      }
    );
    
    // Wait for completion
    console.log(`Task ID: ${taskId}. Waiting for completion...`);
    const result = await api.waitForCompletion(taskId);
    
    console.log('Music generated successfully!');
    console.log('Generated tracks:');
    result.sunoData.forEach((track, index) => {
      console.log(`Track ${index + 1}:`);
      console.log(`  Title: ${track.title}`);
      console.log(`  Audio URL: ${track.audioUrl}`);
      console.log(`  Duration: ${track.duration}s`);
      console.log(`  Tags: ${track.tags}`);
    });
    
    // Extend the first track
    const firstTrack = result.sunoData[0];
    console.log('\nExtending the first track...');
    const extendTaskId = await api.extendMusic(firstTrack.id, {
      defaultParamFlag: true,
      prompt: 'Continue with a hopeful chorus',
      style: 'Folk, Uplifting',
      title: 'Childhood Dreams Extended',
      continueAt: 60,
      model: 'V4_5'
    });
    
    const extendResult = await api.waitForCompletion(extendTaskId);
    console.log('Music extended successfully!');
    console.log('Extended track URL:', extendResult.sunoData[0].audioUrl);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
Advanced Features
Boost Music Style (V4_5 Models)
Enhance your style descriptions for better results:
const response = await fetch('https://api.kie.ai/api/v1/style/generate', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    content: 'Pop, Mysterious'
  })
});

const result = await response.json();
console.log('Enhanced style:', result.data.result);
Audio Processing Features
Convert, separate, and enhance your generated music:
Convert to WAV
Separate Vocals
Create Music Video
const response = await fetch('https://api.kie.ai/api/v1/wav/generate', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    taskId: 'YOUR_TASK_ID',
    audioId: 'YOUR_AUDIO_ID',
    callBackUrl: 'https://your-app.com/callback'
  })
});
Async Processing with Callbacks
Set up webhook callbacks for automatic notifications:
const taskId = await api.generateMusic('Upbeat electronic dance music', {
  customMode: false,
  instrumental: true,
  model: 'V4_5',
  callBackUrl: 'https://your-server.com/suno-callback'
});

// Your callback endpoint will receive:
app.post('/suno-callback', (req, res) => {
  const { code, data } = req.body;
  
  if (code === 200 && data.callbackType === 'complete') {
    console.log('Music ready:', data.data);
    data.data.forEach(track => {
      console.log('Track:', track.audio_url);
    });
  }
  
  res.status(200).json({ status: 'received' });
});
Learn More About Callbacks
Complete guide to implementing and handling Suno API callbacks
Status Codes & Task States
Status	Description
PENDING	Task is waiting to be processed or currently generating
TEXT_SUCCESS	Lyrics/text generation completed successfully
FIRST_SUCCESS	First track generation completed
SUCCESS	All tracks generated successfully
CREATE_TASK_FAILED	Failed to create task
GENERATE_AUDIO_FAILED	Failed to generate audio
SENSITIVE_WORD_ERROR	Content filtered due to sensitive words
Best Practices
Prompt Engineering
Model Selection
Performance Optimization
Content Guidelines
Error Handling
Content Policy Violations (Code 400)
Insufficient Credits (Code 402)
Rate Limiting (Code 429)
Support
Our technical support team is here to assist you.
Email: support@kie.ai
Documentation: docs.kie.ai
API Status: Check our status page for real-time API health
Ready to start creating amazing AI music? Get your API key and begin composing today!
Previous
Grok 4.6
Next
Music Generation Callbacks
LLMs.txt
Clone
Export
Built with

===== PAGE: generate-music =====
KIE.AI
language
language
Market
Support
Market
File Upload API
Common API
Market
File Upload API
Common API
Getting Started with KIE API (Important)
Market
Image Models
Video Models
Music Models
Chat Models
Suno API
Suno API Quickstart
Music Generation
Music Generation Callbacks
Music Extension Callbacks
Audio Upload and Cover Callbacks
Audio Upload and Extension Callbacks
Add Instrumental Callbacks
Add Vocals Callbacks
Music Cover Generation Callbacks
Replace Music Section Callbacks
Generate Music
POST
Extend Music
POST
Upload And Cover Audio
POST
Upload And Extend Audio
POST
Add Instrumental to Music
POST
Add Vocals to Music
POST
Get Music Task Details
GET
Get Timestamped Lyrics
POST
Boost Music Style
POST
Generate Music Cover
POST
Get Cover Generation Details
GET
Replace Music Section
POST
Generate Persona
POST
Generate Mashup Music
POST
Lyrics Generation
WAV Conversion
Vocal Removal
Music Video Generation
Sounds Generation
voice
Veo3.1 API
Get Task Details
GET
Music Generation
Copy Page
Generate Music
POST
/api/v1/generate
Run in Apidog
Generate music with or without lyrics using AI models.
Usage Guide
This endpoint creates music based on your text prompt
Multiple variations will be generated for each request
You can control detail level with custom mode and instrumental settings
Parameter Details
In Custom Mode (customMode: true):
If instrumental: true: style and title are required
If instrumental: false: style, prompt, and title are required
duration is an optional parameter and is only effective when model is set to V5_5.
Character limits vary by model:
V4: prompt 3000 characters, style 200 characters
V4_5 & V4_5PLUS: prompt 5000 characters, style 1000 characters
V4_5ALL: prompt 5000 characters, style 1000 characters
V5_5 & V5: prompt 5000 characters, style 1000 characters
title length limit: 80 characters (all models)
In Non-custom Mode (customMode: false):
Only prompt is required regardless of instrumental setting
prompt length limit: 3000 characters
Other parameters should be left empty
Developer Notes
Recommendation for new users: Start with customMode: false for simpler usage
Generated files are retained for 14 days
Callback process has three stages: text (text generation), first (first track complete), complete (all tracks complete)
Callbacks
audioGenerated
POST
{request.body#/callBackUrl}
Request
Authorization
Bearer Token
Provide your bearer token in the Authorization header when making requests to protected resources.
Example:
Authorization: Bearer ********************
Body Params
application/json
Required
Generate Code
prompt
string 
required
A description of the desired audio content.
In Custom Mode (customMode: true): Required if instrumental is false. The prompt will be strictly used as the lyrics and sung in the generated track. Character limits by model:
V4: Maximum 3000 characters
V4_5 & V4_5PLUS: Maximum 5000 characters
V4_5ALL: Maximum 5000 characters
V5_5 & V5: Maximum 5000 characters
Example: "A calm and relaxing piano track with soft melodies"
In Non-custom Mode (customMode: false): Always required. The prompt serves as the core idea, and lyrics will be automatically generated based on it (not strictly matching the input). Maximum 3000 characters.
Example: "A short relaxing piano tune"
Example:
A calm and relaxing piano track with soft melodies
style
string 
optional
Music style specification for the generated audio.
Required in Custom Mode (customMode: true). Defines the genre, mood, or artistic direction.
Character limits by model:
V4: Maximum 200 characters
V4_5 & V4_5PLUS: Maximum 1000 characters
V4_5ALL: Maximum 1000 characters
V5_5 & V5: Maximum 1000 characters
Common examples: Jazz, Classical, Electronic, Pop, Rock, Hip-hop, etc.
Example:
Classical
title
string 
optional
Title for the generated music track.
Required in Custom Mode (customMode: true).
Max length: 80 characters.
Will be displayed in player interfaces and filenames.
Example:
Peaceful Piano Meditation
customMode
boolean 
required
Determines if advanced parameter customization is enabled.
If true: Allows detailed control with specific requirements for style and title fields.
If false: Simplified mode where only prompt is required and other parameters are ignored.
Example:
true
instrumental
boolean 
required
Determines if the audio should be instrumental (no lyrics).
In Custom Mode (customMode: true):
If true: Only style and title are required.
If false: style, title, and prompt are required (with prompt used as the exact lyrics).
In Non-custom Mode (customMode: false): No impact on required fields (prompt only).
Example:
true
model
enum<string> 
required
The AI model version to use for generation.
Required for all requests.
Available options:
V5_5：Custom Models Tailored to Your Unique Taste.
V5: Superior musical expression, faster generation.
V4_5PLUS: V4.5+ delivers richer sound, new ways to create, max 8 min.
V4_5: V4.5 enables smarter prompts, faster generations, max 8 min.
V4_5ALL: V4.5ALL enables smarter prompts, faster generations, max 8 min.
V4: V4 improves vocal quality, max 4 min.
Allowed values:
V4
V4_5
V4_5PLUS
V4_5ALL
V5
V5_5
Example:
V4
callBackUrl
string <uri>
required
The URL to receive music generation task completion updates. Required for all music generation requests.
System will POST task status and results to this URL when generation completes
Callback process has three stages: text (text generation), first (first track complete), complete (all tracks complete)
Note: Some cases may skip text and first stages and return complete directly
Your callback endpoint should accept POST requests with JSON payload containing task results and audio URLs
For detailed callback format and implementation guide, see Music Generation Callbacks
Alternatively, use the Get Music Details endpoint to poll task status
To ensure callback security, see Webhook Verification Guide for signature verification implementation
Example:
https://api.example.com/callback
negativeTags
string 
optional
Music styles or traits to exclude from the generated audio. Optional. Use to avoid specific styles.
Example:
Heavy Metal, Upbeat Drums
vocalGender
enum<string> 
optional
Vocal gender preference for the singing voice. Optional. Use 'm' for male and 'f' for female. Note: This parameter is only effective when customMode is true. Based on practice, this parameter can only increase the probability but cannot guarantee adherence to male/female voice instructions.
Allowed values:
m
f
Example:
m
styleWeight
number 
optional
Strength of adherence to the specified style. Optional. Range 0–1, up to 2 decimal places.
>= 0
<= 1
Example:
0.65
Multiple of:
0.01
weirdnessConstraint
number 
optional
Controls experimental/creative deviation. Optional. Range 0–1, up to 2 decimal places.
>= 0
<= 1
Example:
0.65
Multiple of:
0.01
audioWeight
number 
optional
Balance weight for audio features vs. other factors. Optional. Range 0–1, up to 2 decimal places.
>= 0
<= 1
Example:
0.65
Multiple of:
0.01
personaId
string 
optional
Only available when Custom Mode (customMode: true) is enabled. Persona ID or Voice ID to apply to the generated music. Optional. Use this to apply a specific persona style to your music generation.
To generate a persona ID, use the Generate Persona endpoint to create a personalized music Persona based on generated music.
To generate a Voice ID, use the Generate Voiceendpoint
Example:
persona_123
personaModel
enum<string> 
optional
The persona model is only available for models version 5 and 5.5.
Allowed values:
style_persona
voice_persona
duration
number 
optional
Audio duration. Optional; only effective when custom_mode is true and model is V5_5.
>= 10
<= 360
Default:
20
Example:
20
Examples
Responses
🟢200
application/json
Request successful
Bodyapplication/json
Generate Code
code
enum<integer> 
optional
Response Status Codes
200: Success - Request has been processed successfully
401: Unauthorized - Authentication credentials are missing or invalid
402: Insufficient Credits - Account does not have enough credits to perform the operation
404: Not Found - The requested resource or endpoint does not exist
409: Conflict - WAV record already exists
422: Validation Error - The request parameters failed validation checks
429: Rate Limited - Request limit has been exceeded for this resource
451: Unauthorized - Failed to fetch the image. Kindly verify any access limits set by you or your service provider
455: Service Unavailable - System is currently undergoing maintenance
500: Server Error - An unexpected error occurred while processing the request
Allowed values:
200
401
402
404
409
422
429
451
455
500
msg
string 
optional
Error message when code != 200
Example:
success
data
object 
optional
taskId
string 
optional
Task ID for tracking task status. Use this ID with the "Get Music Details" endpoint to query task details and results.
Example:
5c79****be8e
🔴500
Error
Request Example
Shell
JavaScript
Java
Swift
cURL
cURL-Windows
Httpie
wget
PowerShell
curl --location 'https://api.kie.ai/api/v1/generate' \
--header 'Authorization: Bearer <token>' \
--header 'Content-Type: application/json' \
--data '{
  "prompt": "A calm and relaxing piano track with soft melodies",
  "customMode": true,
  "instrumental": true,
  "model": "V4",
  "callBackUrl": "https://api.example.com/callback",
  "style": "Classical",
  "title": "Peaceful Piano Meditation",
  "negativeTags": "Heavy Metal, Upbeat Drums",
  "vocalGender": "m",
  "styleWeight": 0.65,
  "weirdnessConstraint": 0.65,
  "audioWeight": 0.65,
  "personaId": "persona_123",
  "personaModel": "style_persona",
  "duration": 20
}'
Response Example
200 - Example 1
{
    "code": 200,
    "msg": "success",
    "data": {
        "taskId": "5c79****be8e"
    }
}
Previous
Replace Music Section Callbacks
Next
Extend Music
LLMs.txt
Clone
Export
Built with

===== PAGE: generate-music-callbacks =====
KIE.AI
language
language
Market
Support
Market
File Upload API
Common API
Market
File Upload API
Common API
Getting Started with KIE API (Important)
Market
Image Models
Video Models
Music Models
Chat Models
Suno API
Suno API Quickstart
Music Generation
Music Generation Callbacks
Music Extension Callbacks
Audio Upload and Cover Callbacks
Audio Upload and Extension Callbacks
Add Instrumental Callbacks
Add Vocals Callbacks
Music Cover Generation Callbacks
Replace Music Section Callbacks
Generate Music
POST
Extend Music
POST
Upload And Cover Audio
POST
Upload And Extend Audio
POST
Add Instrumental to Music
POST
Add Vocals to Music
POST
Get Music Task Details
GET
Get Timestamped Lyrics
POST
Boost Music Style
POST
Generate Music Cover
POST
Get Cover Generation Details
GET
Replace Music Section
POST
Generate Persona
POST
Generate Mashup Music
POST
Lyrics Generation
WAV Conversion
Vocal Removal
Music Video Generation
Sounds Generation
voice
Veo3.1 API
Get Task Details
GET
Music Generation
Copy Page
Music Generation Callbacks
System will call this callback when audio generation is complete.
When you submit a music generation task to the Suno API, you can use the callBackUrl parameter to set a callback URL. The system will automatically push the results to your specified address when the task is completed.
Callback Mechanism Overview
The callback mechanism eliminates the need to poll the API for task status. The system will proactively push task completion results to your server.
Webhook Security
To ensure the authenticity and integrity of callback requests, we strongly recommend implementing webhook signature verification. See our Webhook Verification Guide for detailed implementation steps.
Callback Timing
The system will send callback notifications in the following situations:
Music generation task completed successfully
Music generation task failed
Errors occurred during task processing
Callback Method
HTTP Method: POST
Content Type: application/json
Timeout Setting: 15 seconds
Callback Request Format
When the task is completed, the system will send a POST request to your callBackUrl in the following format:
Complete Success Callback
First Track Success Callback
Text Generation Callback
Failure Callback
{
  "code": 200,
  "msg": "All generated successfully.",
  "data": {
    "callbackType": "complete",
    "task_id": "2fac****9f72",
    "data": [
      {
        "id": "e231****-****-****-****-****8cadc7dc",
        "audio_url": "https://example.cn/****.mp3",
        "stream_audio_url": "https://example.cn/****",
        "image_url": "https://example.cn/****.jpeg",
        "prompt": "[Verse] Night city lights shining bright",
        "model_name": "chirp-v4-5",
        "title": "Iron Man",
        "createTime": 1786343609818,
        "duration": 198.44,
        "tags": "electrifying, rock",
        "source_audio_url":"https://example.cn/****.jpeg",
        "source_image_url":"https://example.cn/****.mp3",
        "source_stream_audio_url":"https://example.cn/****"
      },
      {
        "id": "e231****-****-****-****-****8cadc7dc",
        "audio_url": "https://example.cn/****.mp3",
        "stream_audio_url": "https://example.cn/****",
        "image_url": "https://example.cn/****.jpeg",
        "prompt": "[Verse] Night city lights shining bright",
        "model_name": "chirp-v4-5",
        "title": "Iron Man",
        "createTime": 1786343609818,
        "duration": 198.44,
        "tags": "electrifying, rock",
        "source_audio_url":"https://example.cn/****.jpeg",
        "source_image_url":"https://example.cn/****.mp3",
        "source_stream_audio_url":"https://example.cn/****"
      }
    ]
  }
}
Status Code Description
code (integer, required)
Callback status code indicating task processing result:
Status Code	Description
200	Success - Request has been processed successfully
400	Validation Error - Lyrics contained copyrighted material
408	Rate Limited - Timeout
413	Conflict - Uploaded audio matches existing work of art
500	Server Error - An unexpected error occurred while processing the request
501	Audio generation failed
531	Server Error - Sorry, the generation failed due to an issue. Your credits have been refunded. Please try again
msg (string, required)
Status message providing detailed status description
data.callbackType (string, required)
Callback type:
text - Text generation complete
first - First track complete
complete - All tracks complete
error - Generation failed
data.task_id (string, required)
Task ID, consistent with the task_id returned when you submitted the task
data.data (array)
Generated audio data array, returned on success
data.data[].id (string)
Audio unique identifier (audioId)
data.data[].audio_url (string)
Audio file URL
data.data[].stream_audio_url (string)
Streaming audio URL
data.data[].image_url (string)
Cover image URL
data.data[].prompt (string)
Generation prompt/lyrics
data.data[].model_name (string)
Model name used
data.data[].title (string)
Music title
data.data[].tags (string)
Music tags
data.data[].createTime (string)
Creation time
data.data[].duration (number)
Audio duration (seconds)
Callback Reception Examples
Here are example codes for receiving callbacks in popular programming languages:
Node.js
Python
PHP
const express = require('express');
const app = express();

app.use(express.json());

app.post('/suno-callback', (req, res) => {
  const { code, msg, data } = req.body;
  
  console.log('Received callback:', {
    taskId: data.task_id,
    status: code,
    message: msg,
    callbackType: data.callbackType
  });
  
  if (code === 200) {
    // Task completed successfully
    if (data.callbackType === 'complete') {
      console.log('Music generation completed:', data.data);
      
      // Process generated music data
      data.data.forEach(audio => {
        console.log(`Audio ID: ${audio.id}`);
        console.log(`Audio URL: ${audio.audio_url}`);
        console.log(`Title: ${audio.title}`);
        console.log(`Duration: ${audio.duration} seconds`);
      });
      
    } else if (data.callbackType === 'first') {
      console.log('First track completed');
      
    } else if (data.callbackType === 'text') {
      console.log('Text generation completed');
    }
    
  } else {
    // Task failed
    console.log('Task failed:', msg);
    
    // Handle failure cases...
  }
  
  // Return 200 status code to confirm callback received
  res.status(200).json({ status: 'received' });
});

app.listen(3000, () => {
  console.log('Callback server running on port 3000');
});
Best Practices
Callback URL Configuration Recommendations
1.
Use HTTPS: Ensure your callback URL uses HTTPS protocol for secure data transmission
2.
Verify Source: Verify the legitimacy of the request source in callback processing
3.
Idempotent Processing: The same task_id may receive multiple callbacks, ensure processing logic is idempotent
4.
Quick Response: Callback processing should return a 200 status code as quickly as possible to avoid timeout
5.
Asynchronous Processing: Complex business logic should be processed asynchronously to avoid blocking callback response
6.
Stage Tracking: Differentiate between different generation stages based on callbackType and arrange business logic appropriately
Important Reminders
Callback URL must be a publicly accessible address
Server must respond within 15 seconds, otherwise it will be considered a timeout
If 3 consecutive retries fail, the system will stop sending callbacks
Please ensure the stability of callback processing logic to avoid callback failures due to exceptions
Pay attention to handling different callbackType callbacks, especially the complete type for final results
Troubleshooting
If you do not receive callback notifications, please check the following:
Network Connection Issues
Server Response Issues
Content Format Issues
Callback Type Processing
Alternative Solution
If you cannot use the callback mechanism, you can also use polling:
Poll Query Results
Use the get music details endpoint to regularly query task status. We recommend querying every 30 seconds.
Previous
Suno API Quickstart
Next
Music Extension Callbacks
LLMs.txt
Clone
Export
Built with

===== PAGE: get-music-details =====
KIE.AI
language
language
Market
Support
Market
File Upload API
Common API
Market
File Upload API
Common API
Getting Started with KIE API (Important)
Market
Image Models
Video Models
Music Models
Chat Models
Suno API
Suno API Quickstart
Music Generation
Music Generation Callbacks
Music Extension Callbacks
Audio Upload and Cover Callbacks
Audio Upload and Extension Callbacks
Add Instrumental Callbacks
Add Vocals Callbacks
Music Cover Generation Callbacks
Replace Music Section Callbacks
Generate Music
POST
Extend Music
POST
Upload And Cover Audio
POST
Upload And Extend Audio
POST
Add Instrumental to Music
POST
Add Vocals to Music
POST
Get Music Task Details
GET
Get Timestamped Lyrics
POST
Boost Music Style
POST
Generate Music Cover
POST
Get Cover Generation Details
GET
Replace Music Section
POST
Generate Persona
POST
Generate Mashup Music
POST
Lyrics Generation
WAV Conversion
Vocal Removal
Music Video Generation
Sounds Generation
voice
Veo3.1 API
Get Task Details
GET
Music Generation
Copy Page
Get Music Task Details
GET
/api/v1/generate/record-info
Run in Apidog
Retrieve detailed information about a music generation task.
Usage Guide
Use this endpoint to check task status and access generation results
Task details include status, parameters, and generated tracks
Generated tracks can be accessed through the returned URLs
Status Descriptions
PENDING: Task is waiting to be processed
TEXT_SUCCESS: Lyrics/text generation completed successfully
FIRST_SUCCESS: First track generation completed
SUCCESS: All tracks generated successfully
CREATE_TASK_FAILED: Failed to create task
GENERATE_AUDIO_FAILED: Failed to generate audio
CALLBACK_EXCEPTION: Error during callback process
SENSITIVE_WORD_ERROR: Content filtered due to sensitive words
Developer Notes
For instrumental tracks (instrumental=true), no lyrics data will be included
Maximum query rate: 3 requests per second per task
Response includes direct URLs to audio files, images, and streaming endpoints
Request
Authorization
Bearer Token
Provide your bearer token in the Authorization header when making requests to protected resources.
Example:
Authorization: Bearer ********************
Query Params
Generate Code
taskId
string 
required
Unique identifier of the music generation task to retrieve. This can be either a taskId from a "Generate Music" task or an "Extend Music" task.
Example:
5c79****be8e
Responses
🟢200
application/json
Request successful
Bodyapplication/json
Generate Code
code
enum<integer> 
optional
Response status code
200: Success - Request has been processed successfully
401: Unauthorized - Authentication credentials are missing or invalid
404: Not Found - The requested resource or endpoint does not exist
422: Validation Error - The request parameters failed validation checks
451: Unauthorized - Failed to fetch the image. Kindly verify any access limits set by you or your service provider.
455: Service Unavailable - System is currently undergoing maintenance
500: Server Error - An unexpected error occurred while processing the request
Allowed values:
200
401
404
422
451
455
500
msg
string 
optional
Error message when code != 200
Example:
success
data
object 
optional
taskId
string 
optional
Task ID
parentMusicId
string 
optional
Parent music ID (only valid when extending music)
param
string 
optional
Parameter information for task generation
response
object 
optional
status
enum<string> 
optional
Task status
Allowed values:
PENDING
TEXT_SUCCESS
FIRST_SUCCESS
SUCCESS
CREATE_TASK_FAILED
GENERATE_AUDIO_FAILED
CALLBACK_EXCEPTION
SENSITIVE_WORD_ERROR
type
enum<string> 
optional
Task type
Allowed values:
chirp-v3-5
chirp-v4
operationType
enum<string> 
optional
Operation Type
generate: Generate Music - Create new music works using AI model
extend: Extend Music - Extend or modify existing music works
upload_cover: Upload And Cover Audio - Create new music works based on uploaded audio files
upload_extend: Upload And Extend Audio - Extend or modify music works based on uploaded audio files
Allowed values:
generate
extend
upload_cover
upload_extend
errorCode
enum<integer> <int32>
optional
Error code
400: Validation Error - Lyrics contained copyrighted material.
408: Rate Limited - Timeout.
413: Conflict - Uploaded audio matches existing work of art.
Allowed values:
400
408
413
errorMessage
string 
optional
Error message
Example:
🔴500
Error
Request Example
Shell
JavaScript
Java
Swift
cURL
cURL-Windows
Httpie
wget
PowerShell
curl --location 'https://api.kie.ai/api/v1/generate/record-info?taskId=5c79****be8e' \
--header 'Authorization: Bearer <token>'
Response Example
200 - 成功示例
{
    "code": 200,
    "msg": "success",
    "data": {
        "taskId": "5c79****be8e",
        "parentMusicId": "",
        "param": "{\"prompt\":\"A calm piano track\",\"style\":\"Classical\",\"title\":\"Peaceful Piano\",\"customMode\":true,\"instrumental\":true,\"model\":\"V3_5\"}",
        "response": {
            "taskId": "5c79****be8e",
            "sunoData": [
                {
                    "id": "e231****-****-****-****-****8cadc7dc",
                    "audioUrl": "https://example.cn/****.mp3",
                    "streamAudioUrl": "https://example.cn/****",
                    "imageUrl": "https://example.cn/****.jpeg",
                    "prompt": "[Verse] 夜晚城市 灯火辉煌",
                    "modelName": "chirp-v3-5",
                    "title": "钢铁侠",
                    "tags": "electrifying, rock",
                    "createTime": "2025-01-01 00:00:00",
                    "duration": 198.44
                }
            ]
        },
        "status": "SUCCESS",
        "type": "GENERATE",
        "errorCode": null,
        "errorMessage": null
    }
}
Previous
Add Vocals to Music
Next
Get Timestamped Lyrics
LLMs.txt
Clone
Export
Built with

===== PAGE: extend-music =====


===== PAGE: generate-lyrics =====
KIE.AI
language
language
Market
Support
Market
File Upload API
Common API
Market
File Upload API
Common API
Getting Started with KIE API (Important)
Market
Image Models
Seedream
Z-image
Google
Flux-2
Grok Imagine
GPT Image
Topaz
Recraft
Ideogram
Qwen
4o Image API
Flux Kontext API
Wan
Video Models
Grok Imagine
Kling
Bytedance
Hailuo
Wan
Topaz
Infinitalk
Runway API
PixVerse
MiniMax H3
HappyHorse
Gemini Omni
OmniHuman
Volcengine
Music Models
Chat Models
Suno API
Suno API Quickstart
Music Generation
Lyrics Generation
Lyrics Generation Callbacks
Generate Lyrics
POST
Get Lyrics Task Details
GET
WAV Conversion
Vocal Removal
Music Video Generation
Sounds Generation
voice
Veo3.1 API
Get Task Details
GET
Lyrics Generation
Copy Page
Generate Lyrics
POST
/api/v1/lyrics
Run in Apidog
Generate creative lyrics content based on a text prompt.
Usage Guide
Use this endpoint to create lyrics for music composition
Multiple variations of lyrics will be generated for each request
Each generated lyric set includes title and structured verse/chorus sections
Parameter Details
prompt should describe the theme, style, or subject of the desired lyrics
A detailed prompt yields more targeted and relevant lyrics
Developer Notes
Generated lyrics are retained for 14 days
Callback occurs once with all generated variations when complete
Typically returns 2-3 different lyric variations per request
Each lyric set is formatted with standard section markers ([Verse], [Chorus], etc.)
Callbacks
audioLyricsGenerated
POST
{$request.body#/callBackUrl}
Request
Authorization
Bearer Token
Provide your bearer token in the Authorization header when making requests to protected resources.
Example:
Authorization: Bearer ********************
Body Params
application/json
Required
Generate Code
prompt
string 
required
Description of the desired lyrics content. Be specific about theme, mood, style, or story elements you want in the lyrics. More detailed prompts yield better results. The maximum word limit is 200 characters.
Example:
A nostalgic song about childhood memories and growing up in a small town
callBackUrl
string <uri>
optional
The URL to receive lyrics generation task completion updates. Required for all lyrics generation requests.
System will POST task status and results to this URL when lyrics generation completes
Callback includes all generated lyrics variations with titles and structured content
Your callback endpoint should accept POST requests with JSON payload containing lyrics data
For detailed callback format and implementation guide, see Lyrics Generation Callbacks
Alternatively, use the Get Lyrics Details endpoint to poll task status
To ensure callback security, see Webhook Verification Guide for signature verification implementation
Example:
https://api.example.com/callback
Examples
Responses
🟢200
application/json
Request successful
Bodyapplication/json
Generate Code
code
enum<integer> 
optional
Response status code
200: Request successful
400: Invalid parameters
401: Unauthorized access
404: Invalid request method or path
405: Rate limit exceeded
413: Theme or prompt too long
429: Insufficient credits
430: Your call frequency is too high. Please try again later.
455: System maintenance
500: Server error
Allowed values:
200
400
401
404
405
413
429
430
455
500
msg
string 
optional
Error message when code != 200
Example:
success
data
object 
optional
taskId
string 
optional
Task ID for tracking task status
Example:
5c79****be8e
🔴500
Error
Request Example
Shell
JavaScript
Java
Swift
cURL
cURL-Windows
Httpie
wget
PowerShell
curl --location 'https://api.kie.ai/api/v1/lyrics' \
--header 'Authorization: Bearer <token>' \
--header 'Content-Type: application/json' \
--data '{
  "prompt": "A nostalgic song about childhood memories and growing up in a small town",
  "callBackUrl": "https://api.example.com/callback"
}'
Response Example
200 - Example 1
{
    "code": 200,
    "msg": "success",
    "data": {
        "taskId": "5c79****be8e"
    }
}
Previous
Lyrics Generation Callbacks
Next
Get Lyrics Task Details
LLMs.txt
Clone
Export
Built with

===== PAGE: get-lyrics-details =====
KIE.AI
language
language
Market
Support
Market
File Upload API
Common API
Market
File Upload API
Common API
Getting Started with KIE API (Important)
Market
Image Models
Seedream
Z-image
Google
Flux-2
Grok Imagine
GPT Image
Topaz
Recraft
Ideogram
Qwen
4o Image API
Flux Kontext API
Wan
Video Models
Grok Imagine
Kling
Bytedance
Hailuo
Wan
Topaz
Infinitalk
Runway API
PixVerse
MiniMax H3
HappyHorse
Gemini Omni
OmniHuman
Volcengine
Music Models
Chat Models
Suno API
Suno API Quickstart
Music Generation
Lyrics Generation
Lyrics Generation Callbacks
Generate Lyrics
POST
Get Lyrics Task Details
GET
WAV Conversion
Vocal Removal
Music Video Generation
Sounds Generation
voice
Veo3.1 API
Get Task Details
GET
Lyrics Generation
Copy Page
Get Lyrics Task Details
GET
/api/v1/lyrics/record-info
Run in Apidog
Retrieve detailed information about a lyrics generation task.
Usage Guide
Use this endpoint to check the status of a lyrics generation task
Retrieve generated lyrics content once the task is complete
Track task progress and access any error information if generation failed
Status Descriptions
PENDING: Task is waiting to be processed
SUCCESS: Lyrics generated successfully
CREATE_TASK_FAILED: Failed to create the task
GENERATE_LYRICS_FAILED: Failed during lyrics generation
CALLBACK_EXCEPTION: Error occurred during callback
SENSITIVE_WORD_ERROR: Content filtered due to sensitive words
Developer Notes
Successful tasks will include multiple lyrics variations
Each lyrics set includes both content and a suggested title
Error codes and messages are provided for failed tasks
Request
Authorization
Bearer Token
Provide your bearer token in the Authorization header when making requests to protected resources.
Example:
Authorization: Bearer ********************
Query Params
Generate Code
taskId
string 
required
Unique identifier of the lyrics generation task to retrieve. This is the taskId returned when creating the lyrics generation task.
Example:
11dc****8b0f
Responses
🟢200
application/json
Request successful
Bodyapplication/json
Generate Code
code
enum<integer> 
optional
Response status code
200: Success - Request has been processed successfully
400: Please try rephrasing with more specific details or using a different approach.
Song Description contained artist name:
Song Description flagged for moderation
Unable to generate lyrics from song description
401: Unauthorized - Authentication credentials are missing or invalid
404: Not Found - The requested resource or endpoint does not exist
422: Validation Error - The request parameters failed validation checks
451: Failed to fetch the image. Kindly verify any access limits set by you or your service provider.
455: Service Unavailable - System is currently undergoing maintenance
500: Server Error - An unexpected error occurred while processing the request
Internal Error - Please try again later.
Allowed values:
200
400
401
404
422
451
455
500
msg
string 
optional
Error message when code != 200
Example:
success
data
object 
optional
taskId
string 
optional
Task ID
param
string 
optional
Parameter information for task generation
response
object 
optional
status
enum<string> 
optional
Task status
Allowed values:
PENDING
SUCCESS
CREATE_TASK_FAILED
GENERATE_LYRICS_FAILED
CALLBACK_EXCEPTION
SENSITIVE_WORD_ERROR
errorCode
enum<number> 
optional
Error code, valid when task fails
200: Success - Request has been processed successfully
400: Please try rephrasing with more specific details or using a different approach.
Song Description contained artist name
Song Description flagged for moderation
Unable to generate lyrics from song description
500: Internal Error - Please try again later.
Allowed values:
200
400
500
errorMessage
string 
optional
Error message, valid when task fails
🔴500
Error
Request Example
Shell
JavaScript
Java
Swift
cURL
cURL-Windows
Httpie
wget
PowerShell
curl --location 'https://api.kie.ai/api/v1/lyrics/record-info?taskId=11dc****8b0f' \
--header 'Authorization: Bearer <token>'
Response Example
200 - 成功示例
{
    "code": 200,
    "msg": "success",
    "data": {
        "taskId": "11dc****8b0f",
        "param": "{\"prompt\":\"A song about peaceful night in the city\"}",
        "response": {
            "taskId": "11dc****8b0f",
            "data": [
                {
                    "text": "[Verse]\n我穿越城市黑暗夜\n心中燃烧梦想的烈火",
                    "title": "钢铁侠",
                    "status": "complete",
                    "errorMessage": ""
                }
            ]
        },
        "status": "SUCCESS",
        "errorCode": null,
        "errorMessage": null
    }
}
Previous
Generate Lyrics
Next
Convert to WAV Callbacks
LLMs.txt
Clone
Export
Built with

===== PAGE: add-instrumental =====
KIE.AI
language
language
Market
Support
Market
File Upload API
Common API
Market
File Upload API
Common API
Getting Started with KIE API (Important)
Market
Image Models
Video Models
Music Models
Chat Models
Suno API
Suno API Quickstart
Music Generation
Music Generation Callbacks
Music Extension Callbacks
Audio Upload and Cover Callbacks
Audio Upload and Extension Callbacks
Add Instrumental Callbacks
Add Vocals Callbacks
Music Cover Generation Callbacks
Replace Music Section Callbacks
Generate Music
POST
Extend Music
POST
Upload And Cover Audio
POST
Upload And Extend Audio
POST
Add Instrumental to Music
POST
Add Vocals to Music
POST
Get Music Task Details
GET
Get Timestamped Lyrics
POST
Boost Music Style
POST
Generate Music Cover
POST
Get Cover Generation Details
GET
Replace Music Section
POST
Generate Persona
POST
Generate Mashup Music
POST
Lyrics Generation
WAV Conversion
Vocal Removal
Music Video Generation
Sounds Generation
voice
Veo3.1 API
Get Task Details
GET
Music Generation
Copy Page
Add Instrumental to Music
POST
/api/v1/generate/add-instrumental
Run in Apidog
Generate instrumental accompaniment based on uploaded audio files. This interface allows you to upload audio files and add instrumental tracks to them.
Usage Guide
Use this interface to add instrumental tracks to existing audio
Supports generation of various music style accompaniments
Allows customization of style, exclusion of specific elements, etc.
Parameter Details
uploadUrl specifies the audio file URL to be processed
title specifies the title for the generated music
tags and negativeTags are used to control music style
Supports various optional parameters for fine-tuning generation effects
Developer Notes
Generated files will be retained for 14 days
Callback process has three stages: text (text generation), first (first track completed), complete (all completed)
Callbacks
audioGenerated
POST
{request.body#/callBackUrl}
Request
Authorization
Bearer Token
Provide your bearer token in the Authorization header when making requests to protected resources.
Example:
Authorization: Bearer ********************
Body Params
application/json
Required
Generate Code
uploadUrl
string <uri>
required
URL of the uploaded audio file. Specifies the source audio file location for adding accompaniment.
Example:
https://example.com/music.mp3
model
enum<string> 
optional
The AI model version to use for generation.
Available options:
V5_5：Custom Models Tailored to Your Unique Taste.
V5: Superior musical expression, faster generation.
V4_5PLUS: V4.5+ is richer sound, new ways to create.
Allowed values:
V4_5PLUS
V5
V5_5
Default:
V4_5PLUS
Example:
V4_5PLUS
title
string 
required
Title of the generated music. Will be displayed in the player interface and file name.
Example:
Relaxing Piano
negativeTags
string 
required
Music styles or characteristics to exclude from the generated audio. Used to avoid specific unwanted music elements.
<= 200 characters
Example:
heavy metal, fast drums
tags
string 
required
Music styles or tags to include in the generated music. Defines the desired music style and characteristics.
<= 1000 characters
Example:
relaxing, piano, soothing
callBackUrl
string <uri>
required
URL address for receiving instrumental generation task completion updates. This parameter is required for all instrumental generation requests.
The system will send a POST request to this URL when instrumental generation is completed, including task status and results
Callback process has three stages: text (text generation), first (first track completed), complete (all completed)
Your callback endpoint should be able to accept POST requests containing JSON payloads with music generation results
Alternatively, you can use the get music details interface to poll task status
To ensure callback security, see Webhook Verification Guide for signature verification implementation
Example:
https://example.com/callback
vocalGender
enum<string> 
optional
Vocal gender preference. Optional. 'm' for male, 'f' for female. Based on practice, this parameter can only increase the probability but cannot guarantee adherence to male/female voice instructions.
Allowed values:
m
f
Example:
m
styleWeight
number 
optional
Adherence strength to specified style. Optional. Range 0–1, up to 2 decimal places.
>= 0
<= 1
Example:
0.61
Multiple of:
0.01
weirdnessConstraint
number 
optional
Controls experimental/creative deviation level. Optional. Range 0–1, up to 2 decimal places.
>= 0
<= 1
Example:
0.72
Multiple of:
0.01
audioWeight
number 
optional
Relative weight of audio elements. Optional. Range 0–1, up to 2 decimal places.
>= 0
<= 1
Example:
0.65
Multiple of:
0.01
Examples
Responses
🟢200
application/json
Request successful
Bodyapplication/json
Generate Code
code
enum<integer> 
optional
Response status code
200: Success - Request processed successfully
401: Unauthorized - Authentication credentials missing or invalid
402: Insufficient credits - Account does not have enough credits to perform this operation
404: Not found - Requested resource or endpoint does not exist
409: Conflict - WAV record already exists
422: Validation error - Request parameters failed validation checks
429: Rate limit exceeded - Request limit for this resource has been exceeded
451: Unauthorized - Failed to retrieve image. Please verify any access restrictions set by you or your service provider.
455: Service unavailable - System currently undergoing maintenance
500: Server error - Unexpected error occurred while processing request
Allowed values:
200
401
402
404
409
422
429
451
455
500
msg
string 
optional
Error message when code != 200
Example:
success
data
object 
optional
taskId
string 
optional
Task ID for tracking task status. You can use this ID to query task details and results through the "Get Music Details" interface.
Example:
5c79****be8e
🔴500
Error
Request Example
Shell
JavaScript
Java
Swift
cURL
cURL-Windows
Httpie
wget
PowerShell
curl --location 'https://api.kie.ai/api/v1/generate/add-instrumental' \
--header 'Authorization: Bearer <token>' \
--header 'Content-Type: application/json' \
--data '{
  "uploadUrl": "https://example.com/music.mp3",
  "title": "Relaxing Piano",
  "negativeTags": "heavy metal, fast drums",
  "tags": "relaxing, piano, soothing",
  "callBackUrl": "https://example.com/callback",
  "model": "V4_5PLUS",
  "vocalGender": "m",
  "styleWeight": 0.61,
  "weirdnessConstraint": 0.72,
  "audioWeight": 0.65
}'
Response Example
200 - Example 1
{
    "code": 200,
    "msg": "success",
    "data": {
        "taskId": "5c79****be8e"
    }
}
Previous
Upload And Extend Audio
Next
Add Vocals to Music
LLMs.txt
Clone
Export
Built with

===== PAGE: upload-and-cover-audio =====
KIE.AI
language
language
Market
Support
Market
File Upload API
Common API
Market
File Upload API
Common API
Getting Started with KIE API (Important)
Market
Image Models
Video Models
Music Models
Chat Models
Suno API
Suno API Quickstart
Music Generation
Music Generation Callbacks
Music Extension Callbacks
Audio Upload and Cover Callbacks
Audio Upload and Extension Callbacks
Add Instrumental Callbacks
Add Vocals Callbacks
Music Cover Generation Callbacks
Replace Music Section Callbacks
Generate Music
POST
Extend Music
POST
Upload And Cover Audio
POST
Upload And Extend Audio
POST
Add Instrumental to Music
POST
Add Vocals to Music
POST
Get Music Task Details
GET
Get Timestamped Lyrics
POST
Boost Music Style
POST
Generate Music Cover
POST
Get Cover Generation Details
GET
Replace Music Section
POST
Generate Persona
POST
Generate Mashup Music
POST
Lyrics Generation
WAV Conversion
Vocal Removal
Music Video Generation
Sounds Generation
voice
Veo3.1 API
Get Task Details
GET
Music Generation
Copy Page
Upload And Cover Audio
POST
/api/v1/generate/upload-cover
Run in Apidog
This API creates a cover version of an audio track by transforming it into a new style while retaining its core melody. It incorporates Suno's upload capability, enabling users to upload an audio file for processing. The expected result is a refreshed audio track with a new style, keeping the original melody intact.
Parameter Usage Guide
Character Limits
Character limits vary depending on the model version:
Model V5_5 and V5: style (max 1000 chars), title (max 100 chars), prompt (max 5000 chars)
Models V4.5PLUS and V4.5: style (max 1000 chars), title (max 100 chars), prompt (max 5000 chars)
Model V4.5ALL: style (max 1000 chars), title (max 80 chars), prompt (max 5000 chars)
Model V4: style (max 200 chars), title (max 80 chars), prompt (max 3000 chars)
When customMode is true (Custom Mode):
If instrumental is true: style, title, and uploadUrl are required.
If instrumental is false: style, prompt, title, and uploadUrl are required.
Character limits vary by model version (see note above).
uploadUrl is used to specify the upload location of the audio file; ensure the uploaded audio does not exceed 8 minutes in length.
When customMode is false (Non-custom Mode):
Only prompt and uploadUrl are required, regardless of the instrumental setting.
prompt length limit: 500 characters.
Other parameters should be left empty.
Developer Notes
1.
Quick Start for New Users: Set customMode to false, instrumental to false, and provide only prompt and uploadUrl. This is the simplest configuration to quickly test the API and experience the results.
2.
Generated files will be deleted after 15 days.
3.
Ensure all required parameters are provided based on the customMode and instrumental settings to avoid errors.
4.
Pay attention to character limits for prompt, style, and title to ensure successful processing.
5.
Callback Process Stages: The callback process has three stages: text (text generation complete), first (first track complete), and complete (all tracks complete).
6.
Active Status Check: You can use the Get Music Generation Details endpoint to actively check the task status instead of waiting for callbacks.
7.
The uploadUrl parameter is used to specify the upload location of the audio file; please provide a valid URL.
Optional Parameters
vocalGender (string): Vocal gender preference. Use m for male, f for female.
styleWeight (number): Strength of adherence to style. Range 0–1, up to 2 decimal places. Example: 0.65.
weirdnessConstraint (number): Controls creative deviation. Range 0–1, up to 2 decimal places. Example: 0.65.
audioWeight (number): Balance weight for audio features. Range 0–1, up to 2 decimal places. Example: 0.65.
personaId (string): Persona ID to apply to the generated music. Only available when Custom Mode is enabled (i.e., customMode is true). To create one, use Generate Persona.
Callbacks
audioGenerated
POST
{request.body#/callBackUrl}
Request
Authorization
Bearer Token
Provide your bearer token in the Authorization header when making requests to protected resources.
Example:
Authorization: Bearer ********************
Body Params
application/json
Required
Generate Code
uploadUrl
string <uri>
required
The URL for uploading audio files, required regardless of whether customMode and instrumental are true or false. Ensure the uploaded audio does not exceed 8 minutes in length.
Example:
https://storage.example.com/upload
prompt
string 
required
A description of the desired audio content.
In Custom Mode (customMode: true): Required if instrumental is false. The prompt will be strictly used as the lyrics and sung in the generated track. Character limits by model:
V5_5 & V5: Maximum 5000 characters
V4_5PLUS & V4_5: Maximum 5000 characters
V4_5ALL: Maximum 5000 characters
V4: Maximum 3000 characters
Example: "A calm and relaxing piano track with soft melodies"
In Non-custom Mode (customMode: false): Always required. The prompt serves as the core idea, and lyrics will be automatically generated based on it (not strictly matching the input). Max length: 500 characters.
Example: "A short relaxing piano tune"
Example:
A calm and relaxing piano track with soft melodies
style
string 
optional
The music style or genre for the audio.
Required in Custom Mode (customMode: true). Examples: "Jazz", "Classical", "Electronic". Character limits by model:
V5_5 & V5: Maximum 1000 characters
V4_5PLUS & V4_5: Maximum 1000 characters
V4_5ALL: Maximum 1000 characters
V4: Maximum 200 characters
Example: "Classical"
In Non-custom Mode (customMode: false): Leave empty.
Example:
Classical
title
string 
optional
The title of the generated music track.
Required in Custom Mode (customMode: true). Character limits by model:
V5_5 & V5: Maximum 100 characters
V4_5PLUS & V4_5: Maximum 100 characters
V4_5ALL: Maximum 80 characters
V4: Maximum 80 characters
Example: "Peaceful Piano Meditation"
In Non-custom Mode (customMode: false): Leave empty.
Example:
Peaceful Piano Meditation
customMode
boolean 
required
Enables Custom Mode for advanced audio generation settings.
Set to true to use Custom Mode (requires style and title; prompt required if instrumental is false). The prompt will be strictly used as lyrics if instrumental is false.
Set to false for Non-custom Mode (only prompt is required). Lyrics will be auto-generated based on the prompt.
Example:
true
instrumental
boolean 
required
Determines if the audio should be instrumental (no lyrics).
In Custom Mode (customMode: true):
If true: Only style and title are required.
If false: style, title, and prompt are required (with prompt used as the exact lyrics).
In Non-custom Mode (customMode: false): No impact on required fields (prompt only). Lyrics are auto-generated if instrumental is false.
Example:
true
model
enum<string> 
required
The AI model version to use for generation.
Required for all requests.
Available options:
V5_5：Custom Models Tailored to Your Unique Taste.
V5: Superior musical expression, faster generation.
V4_5PLUS: V4.5+ delivers richer sound, new ways to create, max 8 min.
V4_5: V4.5 enables smarter prompts, faster generations, max 8 min.
V4_5ALL: V4.5ALL enables smarter prompts, faster generations, max 8 min.
V4: V4 improves vocal quality, max 4 min.
Allowed values:
V4
V4_5
V4_5PLUS
V4_5ALL
V5
V5_5
Example:
V4
negativeTags
string 
optional
Music styles or traits to exclude from the generated audio.
Optional. Use to avoid specific styles.
Example: "Heavy Metal, Upbeat Drums"
Example:
Heavy Metal, Upbeat Drums
callBackUrl
string <uri>
required
The URL to receive audio covering task completion updates. Required for all audio covering requests.
System will POST task status and results to this URL when audio covering completes
Callback includes generated covered audio files with new style while preserving original melody
Your callback endpoint should accept POST requests with JSON payload containing covered track results and audio URLs
For detailed callback format and implementation guide, see Audio Covering Callbacks
Alternatively, use the Get Music Details endpoint to poll task status
To ensure callback security, see Webhook Verification Guide for signature verification implementation
Example:
https://api.example.com/callback
vocalGender
enum<string> 
optional
Vocal gender preference for the singing voice. Optional. Use 'm' for male and 'f' for female. Note: This parameter is only effective when customMode is true. Based on practice, this parameter can only increase the probability but cannot guarantee adherence to male/female voice instructions.
Allowed values:
m
f
Example:
m
styleWeight
number 
optional
Strength of adherence to the specified style. Optional. Range 0–1, up to 2 decimal places.
>= 0
<= 1
Example:
0.65
Multiple of:
0.01
weirdnessConstraint
number 
optional
Controls experimental/creative deviation. Optional. Range 0–1, up to 2 decimal places.
>= 0
<= 1
Example:
0.65
Multiple of:
0.01
audioWeight
number 
optional
Balance weight for audio features vs. other factors. Optional. Range 0–1, up to 2 decimal places.
>= 0
<= 1
Example:
0.65
Multiple of:
0.01
personaId
string 
optional
Only available when Custom Mode (customMode: true) is enabled. Persona ID or Voice ID to apply to the generated music. Optional. Use this to apply a specific persona style to your music generation.
To generate a persona ID, use the Generate Persona endpoint to create a personalized music Persona based on generated music.
To generate a Voice ID, use the Generate Voiceendpoint
Example:
persona_123
personaModel
enum<string> 
optional
The persona model is only available for models version 5 and 5.5.
Allowed values:
voice_persona
style_persona
duration
integer 
optional
Duration is selectable; valid only when custom_mode is true and model is V5_5.
>= 10
<= 360
Default:
20
Example:
20
Examples
Responses
🟢200
application/json
Request successful
Bodyapplication/json
Generate Code
code
enum<integer> 
optional
Response status code
200: Success - Request has been processed successfully
401: Unauthorized - Authentication credentials are missing or invalid
402: Insufficient Credits - Account does not have enough credits to perform the operation
404: Not Found - The requested resource or endpoint does not exist
409: Conflict - WAV record already exists
422: Validation Error - The request parameters failed validation checks
429: Rate Limited - Request limit has been exceeded for this resource
451: Unauthorized - Failed to fetch the image. Kindly verify any access limits set by you or your service provider.
455: Service Unavailable - System is currently undergoing maintenance
500: Server Error - An unexpected error occurred while processing the request
Allowed values:
200
401
402
404
409
422
429
451
455
500
msg
string 
optional
Error message when code != 200
Example:
success
data
object 
optional
taskId
string 
optional
Task ID for tracking task status
Example:
5c79****be8e
🔴500
Error
Request Example
Shell
JavaScript
Java
Swift
cURL
cURL-Windows
Httpie
wget
PowerShell
curl --location 'https://api.kie.ai/api/v1/generate/upload-cover' \
--header 'Authorization: Bearer <token>' \
--header 'Content-Type: application/json' \
--data '{
  "uploadUrl": "https://storage.example.com/upload",
  "prompt": "A calm and relaxing piano track with soft melodies",
  "customMode": true,
  "instrumental": true,
  "model": "V4",
  "callBackUrl": "https://api.example.com/callback",
  "style": "Classical",
  "title": "Peaceful Piano Meditation",
  "negativeTags": "Heavy Metal, Upbeat Drums",
  "vocalGender": "m",
  "styleWeight": 0.65,
  "weirdnessConstraint": 0.65,
  "audioWeight": 0.65,
  "personaId": "persona_123",
  "personaModel": "style_persona"
}'
Response Example
200 - Example 1
{
    "code": 200,
    "msg": "success",
    "data": {
        "taskId": "5c79****be8e"
    }
}
Previous
Extend Music
Next
Upload And Extend Audio
LLMs.txt
Clone
Export
Built with

===== PAGE: cover-suno =====
KIE.AI
language
language
Market
Support
Market
File Upload API
Common API
Market
File Upload API
Common API
Getting Started with KIE API (Important)
Market
Image Models
Video Models
Music Models
Chat Models
Suno API
Suno API Quickstart
Music Generation
Music Generation Callbacks
Music Extension Callbacks
Audio Upload and Cover Callbacks
Audio Upload and Extension Callbacks
Add Instrumental Callbacks
Add Vocals Callbacks
Music Cover Generation Callbacks
Replace Music Section Callbacks
Generate Music
POST
Extend Music
POST
Upload And Cover Audio
POST
Upload And Extend Audio
POST
Add Instrumental to Music
POST
Add Vocals to Music
POST
Get Music Task Details
GET
Get Timestamped Lyrics
POST
Boost Music Style
POST
Generate Music Cover
POST
Get Cover Generation Details
GET
Replace Music Section
POST
Generate Persona
POST
Generate Mashup Music
POST
Lyrics Generation
WAV Conversion
Vocal Removal
Music Video Generation
Sounds Generation
voice
Veo3.1 API
Get Task Details
GET
Music Generation
Copy Page
Generate Music Cover
POST
/api/v1/suno/cover/generate
Run in Apidog
Generate personalized cover images based on original music tasks.
Usage Guide
Use this interface to create personalized cover images for generated music
Requires the taskId of the original music task
Each music task can only generate a Cover once; duplicate requests will return the existing taskId
Results will be notified through the callback URL upon completion
Parameter Details
taskId identifies the unique identifier of the original music generation task
callBackUrl receives callback address for completion notifications
Developer Notes
Cover image file URLs will be retained for 14 days
If a Cover has already been generated for this music task, a 400 status code and existing taskId will be returned
It's recommended to call this interface after music generation is complete
Usually generates 2 different style images for selection
Callbacks
onCoverGenerated
POST
{$request.body#/callBackUrl}
Request
Authorization
Bearer Token
Provide your bearer token in the Authorization header when making requests to protected resources.
Example:
Authorization: Bearer ********************
Body Params
application/json
Required
Generate Code
taskId
string 
required
Original music task ID, should be the taskId returned by the music generation interface.
Example:
73d6128b3523a0079df10da9471017c8
callBackUrl
string <uri>
optional
URL address for receiving Cover generation task completion updates. This parameter is required for all Cover generation requests.
The system will send POST requests to this URL when Cover generation is complete, including task status and results
Your callback endpoint should be able to accept JSON payloads containing cover image URLs
For detailed callback format and implementation guide, see Cover Generation Callbacks
Alternatively, you can use the Get Cover Details interface to poll task status
To ensure callback security, see Webhook Verification Guide for signature verification implementation
Example:
https://api.example.com/callback
Examples
Responses
🟢200
application/json
Success
Bodyapplication/json
Generate Code
code
enum<integer> <int32>
optional
Status code
Allowed values:
200
400
401
402
404
409
422
429
455
500
Example:
200
msg
string 
optional
Status message
Example:
success
data
object 
optional
taskId
string 
optional
Task ID
Example:
21aee3c3c2a01fa5e030b3799fa4dd56
🔴500
Error
Request Example
Shell
JavaScript
Java
Swift
cURL
cURL-Windows
Httpie
wget
PowerShell
curl --location 'https://api.kie.ai/api/v1/suno/cover/generate' \
--header 'Authorization: Bearer <token>' \
--header 'Content-Type: application/json' \
--data '{
  "taskId": "73d6128b3523a0079df10da9471017c8",
  "callBackUrl": "https://api.example.com/callback"
}'
Response Example
200 - 成功示例
{
    "code": 200,
    "msg": "success",
    "data": {
        "taskId": "21aee3c3c2a01fa5e030b3799fa4dd56"
    }
}
Previous
Boost Music Style
Next
Get Cover Generation Details
LLMs.txt
Clone
Export
Built with

===== PAGE: get-cover-suno-details =====
KIE.AI
language
language
Market
Support
Market
File Upload API
Common API
Market
File Upload API
Common API
Getting Started with KIE API (Important)
Market
Image Models
Video Models
Music Models
Chat Models
Suno API
Suno API Quickstart
Music Generation
Music Generation Callbacks
Music Extension Callbacks
Audio Upload and Cover Callbacks
Audio Upload and Extension Callbacks
Add Instrumental Callbacks
Add Vocals Callbacks
Music Cover Generation Callbacks
Replace Music Section Callbacks
Generate Music
POST
Extend Music
POST
Upload And Cover Audio
POST
Upload And Extend Audio
POST
Add Instrumental to Music
POST
Add Vocals to Music
POST
Get Music Task Details
GET
Get Timestamped Lyrics
POST
Boost Music Style
POST
Generate Music Cover
POST
Get Cover Generation Details
GET
Replace Music Section
POST
Generate Persona
POST
Generate Mashup Music
POST
Lyrics Generation
WAV Conversion
Vocal Removal
Music Video Generation
Sounds Generation
voice
Veo3.1 API
Get Task Details
GET
Music Generation
Copy Page
Get Cover Generation Details
GET
/api/v1/suno/cover/record-info
Run in Apidog
Get detailed information about Cover generation tasks.
Usage Guide
Use this interface to check Cover generation task status
Access generated cover image URLs upon completion
Track processing progress and any errors that may occur
Status Description
PENDING: Task awaiting processing
SUCCESS: Cover generation completed successfully
CREATE_TASK_FAILED: Cover generation task creation failed
GENERATE_COVER_FAILED: Cover image generation process failed
Developer Notes
Cover image URLs are only available when status is SUCCESS in the response
Error codes and messages are provided for failed tasks
After successful generation, cover images are retained for 14 days
Request
Authorization
Bearer Token
Provide your bearer token in the Authorization header when making requests to protected resources.
Example:
Authorization: Bearer ********************
Query Params
Generate Code
taskId
string 
required
Unique identifier of the Cover generation task to retrieve. This is the taskId returned when creating the Cover generation task.
Example:
21aee3c3c2a01fa5e030b3799fa4dd56
Responses
🟢200
application/json
Success
Bodyapplication/json
Generate Code
code
enum<integer> <int32>
optional
Status code
Allowed values:
200
400
401
402
404
409
422
429
455
500
Example:
200
msg
string 
optional
Status message
Example:
success
data
object 
optional
taskId
string 
optional
Task ID
Example:
21aee3c3c2a01fa5e030b3799fa4dd56
parentTaskId
string 
optional
Original music task ID
Example:
73d6128b3523a0079df10da9471017c8
callbackUrl
string 
optional
Callback URL
Example:
https://api.example.com/callback
completeTime
string <date-time>
optional
Completion callback time
Example:
2025-01-15T10:35:27.000Z
response
object 
optional
Completion callback result
successFlag
enum<integer> 
optional
Task status flag: 0-Pending, 1-Success, 2-Generating, 3-Generation failed
Allowed values:
0
1
2
3
Example:
1
createTime
string <date-time>
optional
Creation time
Example:
2025-01-15T10:33:01.000Z
errorCode
enum<integer> <int32>
optional
Error code
200: Success - Request processed successfully
500: Internal error - Please try again later.
Allowed values:
200
500
Example:
200
errorMessage
string 
optional
Error message
Example:
🔴500
Error
Request Example
Shell
JavaScript
Java
Swift
cURL
cURL-Windows
Httpie
wget
PowerShell
curl --location 'https://api.kie.ai/api/v1/suno/cover/record-info?taskId=21aee3c3c2a01fa5e030b3799fa4dd56' \
--header 'Authorization: Bearer <token>'
Response Example
200 - 成功示例
{
    "code": 200,
    "msg": "success",
    "data": {
        "taskId": "21aee3c3c2a01fa5e030b3799fa4dd56",
        "parentTaskId": "73d6128b3523a0079df10da9471017c8",
        "callbackUrl": "https://api.example.com/callback",
        "completeTime": "2025-01-15T10:35:27.000Z",
        "response": {
            "images": [
                "https://tempfile.aiquickdraw.com/s/1753958521_6c1b3015141849d1a9bf17b738ce9347.png",
                "https://tempfile.aiquickdraw.com/s/1753958524_c153143acc6340908431cf0e90cbce9e.png"
            ]
        },
        "successFlag": 1,
        "createTime": "2025-01-15T10:33:01.000Z",
        "errorCode": 200,
        "errorMessage": ""
    }
}
Previous
Generate Music Cover
Next
Replace Music Section
LLMs.txt
Clone
Export
Built with

===== PAGE: replace-section =====
KIE.AI
language
language
Market
Support
Market
File Upload API
Common API
Market
File Upload API
Common API
Getting Started with KIE API (Important)
Market
Image Models
Video Models
Music Models
Chat Models
Suno API
Suno API Quickstart
Music Generation
Music Generation Callbacks
Music Extension Callbacks
Audio Upload and Cover Callbacks
Audio Upload and Extension Callbacks
Add Instrumental Callbacks
Add Vocals Callbacks
Music Cover Generation Callbacks
Replace Music Section Callbacks
Generate Music
POST
Extend Music
POST
Upload And Cover Audio
POST
Upload And Extend Audio
POST
Add Instrumental to Music
POST
Add Vocals to Music
POST
Get Music Task Details
GET
Get Timestamped Lyrics
POST
Boost Music Style
POST
Generate Music Cover
POST
Get Cover Generation Details
GET
Replace Music Section
POST
Generate Persona
POST
Generate Mashup Music
POST
Lyrics Generation
WAV Conversion
Vocal Removal
Music Video Generation
Sounds Generation
voice
Veo3.1 API
Get Task Details
GET
Music Generation
Copy Page
Replace Music Section
POST
/api/v1/generate/replace-section
Run in Apidog
Replace a specific time segment within existing music.
This interface can replace specific time segments in already generated music. It requires providing the original music's task ID and the time range to be replaced. The replaced audio will naturally blend with the original music.
Time Range Instructions
infillStartS must be less than infillEndS.
Time values are precise to 2 decimal places, e.g., 10.50 seconds.
The replacement time must be at least 10 seconds.
Replacement duration should not exceed 50% of the original music's total duration.
Developer Notes
Replacement segments will be regenerated based on the provided prompt and tags.
Generated replacement segments will automatically blend with the original music's preceding and following parts.
Generated files will be retained for 14 days.
Query task status using the same interface as generating music: Get Music Details.
Callbacks
audioGenerated
POST
{request.body#/callBackUrl}
Request
Authorization
Bearer Token
Provide your bearer token in the Authorization header when making requests to protected resources.
Example:
Authorization: Bearer ********************
Body Params
application/json
Required
Generate Code
optional
One of:
Replace section using existing audio
Replace section using uploaded custom audio
object
taskId
string 
required
Original task ID (parent task), used to identify the source music for section replacement.
Example:
2fac****9f72
audioId
string 
required
Unique identifier of the audio track to replace. This ID is returned in the callback data after music generation completes.
Example:
e231****-****-****-****-****8cadc7dc
prompt
string 
required
Replaced lyrics
Example:
A calm and relaxing piano track.
tags
string 
required
Music style tags, such as jazz, electronic, etc.
Example:
Jazz
title
string 
required
Music title
Example:
Relaxing Piano
negativeTags
string 
optional
Excluded music styles, used to avoid specific style elements in the replacement segment
Example:
Rock
infillStartS
number 
required
Start time point for replacement (seconds), 2 decimal places. Must be less than infillEndS. The time interval (infillEndS - infillStartS) must be at least 10 seconds.
>= 0
Example:
10.5
infillEndS
number 
required
End time point for replacement (seconds), 2 decimal places. Must be greater than infillStartS. The time interval (infillEndS - infillStartS) must be at least 10 seconds.
>= 0
Example:
20.75
fullLyrics
string 
required
Complete lyrics after modification, combining both modified and unmodified lyrics. This parameter contains the full lyrics text that will be used for the entire song after the section replacement.
Example:
[Verse 1] Original lyrics here [Chorus] Modified lyrics for this section [Verse 2] More original lyrics
callBackUrl
string <uri>
optional
Callback URL for task completion. The system will send a POST request to this URL when replacement is complete, containing task status and results.
Your callback endpoint should be able to accept POST requests containing JSON payloads with replacement results
For detailed callback format and implementation guide, see Replace Music Section Callbacks
Alternatively, you can use the get music details interface to poll task status
To ensure callback security, see Webhook Verification Guide for signature verification implementation
Example:
https://example.com/callback
Examples
Responses
🟢200
application/json
Request successful
Bodyapplication/json
Generate Code
code
enum<integer> 
optional
Response status code
200: Success - Request processed successfully
401: Unauthorized - Authentication credentials missing or invalid
402: Insufficient credits - Account does not have enough credits to perform this operation
404: Not found - Requested resource or endpoint does not exist
409: Conflict - WAV record already exists
422: Validation error - Request parameters failed validation checks
429: Rate limit exceeded - Exceeded request limit for this resource
451: Unauthorized - Failed to retrieve image. Please verify any access restrictions set by you or your service provider.
455: Service unavailable - System is currently undergoing maintenance
500: Server error - Unexpected error occurred while processing request
Allowed values:
200
401
402
404
409
422
429
451
455
500
msg
string 
optional
Error message when code != 200
Example:
success
data
object 
optional
taskId
string 
optional
Task ID for tracking task status. You can use this ID to query task details and results through the "Get Music Details" interface.
Example:
5c79****be8e
🔴500
Error
Request Example
Shell
JavaScript
Java
Swift
cURL
cURL-Windows
Httpie
wget
PowerShell
curl --location 'https://api.kie.ai/api/v1/generate/replace-section' \
--header 'Authorization: Bearer <token>' \
--header 'Content-Type: application/json' \
--data '{
    "taskId": "2fac****9f72",
    "audioId": "e231****-****-****-****-****8cadc7dc",
    "prompt": "A calm and relaxing piano track.",
    "tags": "Jazz",
    "title": "Relaxing Piano",
    "negativeTags": "Rock",
    "infillStartS": 10.5,
    "infillEndS": 20.75,
    "fullLyrics": "[Verse 1]\nOriginal lyrics here\n[Chorus]\nModified lyrics for this section\n[Verse 2]\nMore original lyrics",
    "callBackUrl": "https://example.com/callback"
}'
Response Example
200 - Example 1
{
    "code": 200,
    "msg": "success",
    "data": {
        "taskId": "5c79****be8e"
    }
}
Previous
Get Cover Generation Details
Next
Generate Persona
LLMs.txt
Clone
Export
Built with

===== PAGE: generate-persona =====
KIE.AI
language
language
Market
Support
Market
File Upload API
Common API
Market
File Upload API
Common API
Getting Started with KIE API (Important)
Market
Image Models
Video Models
Music Models
Chat Models
Suno API
Suno API Quickstart
Music Generation
Music Generation Callbacks
Music Extension Callbacks
Audio Upload and Cover Callbacks
Audio Upload and Extension Callbacks
Add Instrumental Callbacks
Add Vocals Callbacks
Music Cover Generation Callbacks
Replace Music Section Callbacks
Generate Music
POST
Extend Music
POST
Upload And Cover Audio
POST
Upload And Extend Audio
POST
Add Instrumental to Music
POST
Add Vocals to Music
POST
Get Music Task Details
GET
Get Timestamped Lyrics
POST
Boost Music Style
POST
Generate Music Cover
POST
Get Cover Generation Details
GET
Replace Music Section
POST
Generate Persona
POST
Generate Mashup Music
POST
Lyrics Generation
WAV Conversion
Vocal Removal
Music Video Generation
Sounds Generation
voice
Veo3.1 API
Get Task Details
GET
Music Generation
Copy Page
Generate Persona
POST
/api/v1/generate/generate-persona
Run in Apidog
Create a personalized music Persona based on generated music, giving the music a unique identity and characteristics.
Usage Guide
Use this endpoint to create Personas (music characters) for generated music:
Requires the taskId from music generation related endpoints (generate, extend) and audio ID
Customize the Persona name and description to give music unique personality
Generated Personas can be used for subsequent music creation and style transfer
Parameter Details
taskId (Required): Can be obtained from the following endpoints:
Generate Music (/api/v1/generate)
Extend Music (/api/v1/generate/extend)
audioId (Required): Specifies the audio ID to create Persona for
name (Required): Assigns an easily recognizable name to the Persona
description (Required): Describes the Persona's musical characteristics, style, and personality
Developer Notes
Important Requirements
Ensure the music generation task is fully completed before calling this endpoint. If the music is still generating, this endpoint will return a failure.
Model Requirement: Persona generation only supports taskId from music generated with models above v3.5 (v3.5 itself is not supported).
Each audio ID can only generate a Persona once.
It is recommended to provide detailed descriptions for Personas to better capture musical characteristics.
The returned personaId can be used in subsequent music generation requests to create music with similar style characteristics.
You can apply the personaId to the following endpoints:
Generate Music
Extend Music
Parameter Example
{
  "taskId": "5c79****be8e",
  "audioId": "e231****-****-****-****-****8cadc7dc",
  "name": "Electronic Pop Singer",
  "description": "A modern electronic music style pop singer, skilled in dynamic rhythms and synthesizer tones"
}
NOTE
Ensure that the music generation task corresponding to the taskId is complete and the audioId is within the valid range.
TIP
Providing detailed and specific descriptions for Personas helps the system more accurately capture musical style characteristics.
Request
Authorization
Bearer Token
Provide your bearer token in the Authorization header when making requests to protected resources.
Example:
Authorization: Bearer ********************
Body Params
application/json
Required
Generate Code
taskId
string 
required
Unique identifier of the original music generation task. This can be a taskId returned from any of the following endpoints:
Generate Music (/api/v1/generate)
Extend Music (/api/v1/generate/extend)
Example:
5c79****be8e
audioId
string 
required
Unique identifier of the audio track to create Persona for. This ID is returned in the callback data after music generation completes.
Example:
e231****-****-****-****-****8cadc7dc
name
string 
required
Name for the Persona. A descriptive name that captures the essence of the musical style or character.
Example:
Electronic Pop Singer
description
string 
required
Detailed description of the Persona's musical characteristics, style, and personality. Be specific about genre, mood, instrumentation, and vocal qualities.
Example:
A modern electronic music style pop singer, skilled in dynamic rhythms and synthesizer tones
 vocalStart
number 
optional
Start time (in seconds) for Persona analysis segment extraction. Used to specify the time point in the audio from which to extract the segment for Persona analysis. Must be less than vocalEnd, and vocalEnd - vocalStart must be between 10–30 seconds. Defaults to 0.0.
>= 0
Default:
0
Example:
12.5
 vocalEnd
number 
optional
End time (in seconds) for Persona analysis segment extraction. Together with vocalStart, used to specify the time range for analysis. vocalEnd - vocalStart must be between 10–30 seconds. Defaults to 30.0.
>= 0
Default:
30
Example:
25.8
Multiple of:
0.01
style
string 
optional
Optional. Used to supplement the description of the music style tag corresponding to the Persona, such as "Electronic Pop", "Jazz Trio", etc.
Examples
Responses
🟢200
application/json
Request successful
Bodyapplication/json
Generate Code
code
enum<integer> 
optional
Response Status Codes
200: Success - Request has been processed successfully
401: Unauthorized - Authentication credentials are missing or invalid
402: Insufficient Credits - Account does not have enough credits to perform the operation
404: Not Found - The requested resource or endpoint does not exist
409: Conflict - Persona already exists for this music
422: Validation Error - The request parameters failed validation checks
429: Rate Limited - Request limit has been exceeded for this resource
451: Unauthorized - Failed to fetch the music data. Kindly verify any access limits set by you or your service provider
455: Service Unavailable - System is currently undergoing maintenance
500: Server Error - An unexpected error occurred while processing the request
Allowed values:
200
401
402
404
409
422
429
451
455
500
msg
string 
optional
Error message when code != 200
Example:
success
data
object 
optional
personaId
string 
optional
Unique identifier for the generated Persona. This personaId can be used in subsequent music generation requests (Generate Music, Extend Music, Upload And Cover Audio, Upload And Extend Audio) to create music with similar style characteristics.
Example:
a1b2****c3d4
name
string 
optional
Name of the Persona as provided in the request.
Example:
Electronic Pop Singer
description
string 
optional
Description of the Persona's musical characteristics, style, and personality as provided in the request.
Example:
A modern electronic music style pop singer, skilled in dynamic rhythms and synthesizer tones
🔴500
Error
Request Example
Shell
JavaScript
Java
Swift
cURL
cURL-Windows
Httpie
wget
PowerShell
curl --location 'https://api.kie.ai/api/v1/generate/generate-persona' \
--header 'Authorization: Bearer <token>' \
--header 'Content-Type: application/json' \
--data '{
  "taskId": "5c79****be8e",
  "audioId": "e231****-****-****-****-****8cadc7dc",
  "name": "Electronic Pop Singer",
  "description": "A modern electronic music style pop singer, skilled in dynamic rhythms and synthesizer tones",
  "vocalStart": 0,
  "vocalEnd": 30,
  "style": "Electronic Pop"
}'
Response Example
200 - Example 1
{
    "code": 200,
    "msg": "success",
    "data": {
        "personaId": "a1b2****c3d4",
        "name": "Electronic Pop Singer",
        "description": "A modern electronic music style pop singer, skilled in dynamic rhythms and synthesizer tones"
    }
}
Previous
Replace Music Section
Next
Generate Mashup Music
LLMs.txt
Clone
Export
Built with

===== PAGE: convert-to-wav =====
KIE.AI
language
language
Market
Support
Market
File Upload API
Common API
Market
File Upload API
Common API
Getting Started with KIE API (Important)
Market
Image Models
Seedream
Z-image
Google
Flux-2
Grok Imagine
GPT Image
Topaz
Recraft
Ideogram
Qwen
4o Image API
Flux Kontext API
Wan
Video Models
Grok Imagine
Kling
Bytedance
Hailuo
Wan
Topaz
Infinitalk
Runway API
PixVerse
MiniMax H3
HappyHorse
Gemini Omni
OmniHuman
Volcengine
Music Models
Chat Models
Suno API
Suno API Quickstart
Music Generation
Lyrics Generation
WAV Conversion
Convert to WAV Callbacks
Convert to WAV Format
POST
Get WAV Conversion Details
GET
Vocal Removal
Music Video Generation
Sounds Generation
voice
Veo3.1 API
Get Task Details
GET
WAV Conversion
Copy Page
Convert to WAV Format
POST
/api/v1/wav/generate
Run in Apidog
Convert an existing music track to high-quality WAV format.
Usage Guide
Use this endpoint to obtain WAV format files from your generated music
WAV files provide uncompressed audio for professional editing and processing
Converted files maintain the full quality of the original audio
Parameter Details
taskId identifies the original music generation task
audioId specifies which audio track to convert when multiple variations exist
Developer Notes
Generated WAV files are retained for 14 days
WAV files are typically 5-10 times larger than MP3 equivalents
Processing time may vary depending on the length of the original audio
Callbacks
wavGenerated
POST
{$request.body#/callBackUrl}
Request
Authorization
Bearer Token
Provide your bearer token in the Authorization header when making requests to protected resources.
Example:
Authorization: Bearer ********************
Body Params
application/json
Required
Generate Code
taskId
string 
required
Unique identifier of the music generation task. This should be a taskId returned from either the "Generate Music" or "Extend Music" endpoints.
Example:
5c79****be8e
audioId
string 
required
Unique identifier of the specific audio track to convert. This ID is returned in the callback data after music generation completes.
Example:
e231****-****-****-****-****8cadc7dc
callBackUrl
string <uri>
required
The URL to receive WAV conversion task completion updates. Required for all WAV conversion requests.
System will POST task status and results to this URL when WAV conversion completes
Callback includes the high-quality WAV file download URL
Your callback endpoint should accept POST requests with JSON payload containing the WAV file location
For detailed callback format and implementation guide, see WAV Conversion Callbacks
Alternatively, use the Get WAV Details endpoint to poll task status
To ensure callback security, see Webhook Verification Guide for signature verification implementation
Example:
https://api.example.com/callback
Examples
Responses
🟢200
application/json
Request successful
Bodyapplication/json
Generate Code
code
enum<integer> 
optional
Response status code
200: Success - Request has been processed successfully
400: Format Error - The parameter is not in a valid JSON format.
401: Unauthorized - Authentication credentials are missing or invalid
402: Insufficient Credits - Account does not have enough credits to perform the operation
404: Not Found - The requested resource or endpoint does not exist
409: Conflict - WAV record already exists
422: Validation Error - The request parameters failed validation checks
429: Rate Limited - Request limit has been exceeded for this resource
455: Service Unavailable - System is currently undergoing maintenance
500: Server Error - An unexpected error occurred while processing the request
Build Failed - Audio wav generation failed
Allowed values:
200
400
401
402
404
409
422
429
455
500
msg
string 
optional
Error message when code != 200
Example:
success
data
object 
optional
taskId
string 
optional
Task ID for tracking task status
Example:
5c79****be8e
🔴500
Error
Request Example
Shell
JavaScript
Java
Swift
cURL
cURL-Windows
Httpie
wget
PowerShell
curl --location 'https://api.kie.ai/api/v1/wav/generate' \
--header 'Authorization: Bearer <token>' \
--header 'Content-Type: application/json' \
--data '{
  "taskId": "5c79****be8e",
  "audioId": "e231****-****-****-****-****8cadc7dc",
  "callBackUrl": "https://api.example.com/callback"
}'
Response Example
200 - Example 1
{
    "code": 200,
    "msg": "success",
    "data": {
        "taskId": "5c79****be8e"
    }
}
Previous
Convert to WAV Callbacks
Next
Get WAV Conversion Details
LLMs.txt
Clone
Export
Built with

===== PAGE: get-wav-details =====
KIE.AI
language
language
Market
Support
Market
File Upload API
Common API
Market
File Upload API
Common API
Getting Started with KIE API (Important)
Market
Image Models
Seedream
Z-image
Google
Flux-2
Grok Imagine
GPT Image
Topaz
Recraft
Ideogram
Qwen
4o Image API
Flux Kontext API
Wan
Video Models
Grok Imagine
Kling
Bytedance
Hailuo
Wan
Topaz
Infinitalk
Runway API
PixVerse
MiniMax H3
HappyHorse
Gemini Omni
OmniHuman
Volcengine
Music Models
Chat Models
Suno API
Suno API Quickstart
Music Generation
Lyrics Generation
WAV Conversion
Convert to WAV Callbacks
Convert to WAV Format
POST
Get WAV Conversion Details
GET
Vocal Removal
Music Video Generation
Sounds Generation
voice
Veo3.1 API
Get Task Details
GET
WAV Conversion
Copy Page
Get WAV Conversion Details
GET
/api/v1/wav/record-info
Run in Apidog
Retrieve detailed information about a WAV format conversion task.
Usage Guide
Use this endpoint to check the status of a WAV conversion task
Access the WAV file URL once conversion is complete
Track conversion progress and any errors that may have occurred
Status Descriptions
PENDING: Task is waiting to be processed
SUCCESS: WAV conversion completed successfully
CREATE_TASK_FAILED: Failed to create the conversion task
GENERATE_WAV_FAILED: Failed during WAV file generation
CALLBACK_EXCEPTION: Error occurred during callback
Developer Notes
The WAV file URL is only available in the response when status is SUCCESS
Error codes and messages are provided for failed tasks
WAV files are retained for 14 days after successful conversion
Request
Authorization
Bearer Token
Provide your bearer token in the Authorization header when making requests to protected resources.
Example:
Authorization: Bearer ********************
Query Params
Generate Code
taskId
string 
required
Unique identifier of the WAV conversion task to retrieve. This is the taskId returned when creating the WAV conversion task.
Example:
988e****c8d3
Responses
🟢200
application/json
Request successful
Bodyapplication/json
Generate Code
code
enum<integer> 
optional
Response status code
200: Success - Request has been processed successfully
401: Unauthorized - Authentication credentials are missing or invalid
404: Not Found - The requested resource or endpoint does not exist
422: Validation Error - The request parameters failed validation checks
451: Failed to fetch the image. Kindly verify any access limits set by you or your service provider.
455: Service Unavailable - System is currently undergoing maintenance
500: Server Error - An unexpected error occurred while processing the request
Allowed values:
200
401
404
422
451
455
500
msg
string 
optional
Error message when code != 200
Example:
success
data
object 
optional
taskId
string 
optional
Task ID
musicId
string 
optional
Music ID
callbackUrl
string 
optional
Callback address
musicIndex
integer 
optional
Music index 0 or 1
completeTime
string <date-time>
optional
Complete callback time
response
object 
optional
successFlag
enum<string> 
optional
Task status
Allowed values:
PENDING
SUCCESS
CREATE_TASK_FAILED
GENERATE_WAV_FAILED
CALLBACK_EXCEPTION
createTime
string <date-time>
optional
Creation time
errorCode
enum<number> 
optional
Error code, valid when task fails
200: Success - Request has been processed successfully
500: Internal Error - Please try again later.
Allowed values:
200
500
errorMessage
string 
optional
Error message, valid when task fails
🔴500
Error
Request Example
Shell
JavaScript
Java
Swift
cURL
cURL-Windows
Httpie
wget
PowerShell
curl --location 'https://api.kie.ai/api/v1/wav/record-info?taskId=988e****c8d3' \
--header 'Authorization: Bearer <token>'
Response Example
200 - 成功示例
{
    "code": 200,
    "msg": "success",
    "data": {
        "taskId": "988e****c8d3",
        "musicId": "e231****-****-****-****-****8cadc7dc",
        "callbackUrl": "https://api.example.com/callback",
        "musicIndex": 0,
        "completeTime": "2025-01-01 00:10:00",
        "response": {
            "audioWavUrl": "https://example.com/s/04e6****e727.wav"
        },
        "successFlag": "SUCCESS",
        "createTime": "2025-01-01 00:00:00",
        "errorCode": null,
        "errorMessage": null
    }
}
Previous
Convert to WAV Format
Next
Audio Separation Callbacks
LLMs.txt
Clone
Export
Built with

===== PAGE: separate-vocals =====
KIE.AI
language
language
Market
Support
Market
File Upload API
Common API
Market
File Upload API
Common API
Getting Started with KIE API (Important)
Market
Image Models
Seedream
Z-image
Google
Flux-2
Grok Imagine
GPT Image
Topaz
Recraft
Ideogram
Qwen
4o Image API
Flux Kontext API
Wan
Video Models
Music Models
Chat Models
Suno API
Suno API Quickstart
Music Generation
Lyrics Generation
WAV Conversion
Vocal Removal
Audio Separation Callbacks
MIDI Generation Callbacks
Vocal & Instrument Stem Separation
POST
Get Vocal Separation Details
GET
Generate MIDI from Audio
POST
Get MIDI Generation Details
GET
Music Video Generation
Sounds Generation
voice
Veo3.1 API
Get Task Details
GET
Vocal Removal
Copy Page
Vocal & Instrument Stem Separation
POST
/api/v1/vocal-removal/generate
Run in Apidog
Use advanced audio processing technology to separate music into vocals, accompaniment, and individual instrumental stems.
Usage Guide
Separate platform-generated mixes into vocals, accompaniment, and individual instrumental components.
Supports three processing modes:
separate_vocal — 2-stem separation (vocals + accompaniment)
split_stem — Up to 12-stem separation
split_stem_advanced — Advanced multi-stem separation, supporting precise extraction of a single target stem through stemName
Suitable for karaoke production, mixing, sample extraction, and detailed post-production.
Works best with professional AI-generated mixes that have clearly separated vocals and instruments.
Billing: Each API call consumes credits; repeated calls for the same audio stem will be charged again (no server-side caching).
Pricing: Please check https://kie.ai/pricing for the current credit cost per call.
Separation Mode Description
Mode (type)	Returned Stems	Typical Use Cases	Credit Cost
separate_vocal （default）	2 stems — Vocals + accompaniment	Quick vocal removal, karaoke, and basic mixing	10 credits
split_stem	Up to 12 stems — Vocals, backing vocals, drums, bass, guitar, keyboard, strings, brass, woodwinds, percussion, synthesizer, FX/other;	Advanced mixing, remixing, sound design, and individual instrument extraction	50 credits
split_stem_advanced	Up to 12 stems — Same as split_stem, with support for specifying a single target stem through stemName for precise separation	Individual instrument extraction and detailed post-production	20 credits
Parameters
Name	Type	Description
taskId	string	The ID of the original music generation task
audioUrl	string	The URL of the user-uploaded audio file. Required when processing user-uploaded audio. Cannot be used together with audioId.
audioId	string	Specifies the audio variant to process when multiple versions exist. Cannot be used together with audioUrl.
type	string	Separation mode: separate_vocal, split_stem, or split_stem_advanced; defaults to separate_vocal
stemName	string	Takes effect only when type is split_stem; specifies the name of the individual stem/instrument to separate;
Developer Notes
All returned audio file URLs are valid for 14 days.
Separation quality depends on the complexity and mixing characteristics of the original track.
separate_vocal returns 2 stems — vocals + accompaniment.
split_stem returns up to 12 independent stems — vocals, backing vocals, drums, bass, guitar, keyboard, strings, brass, woodwinds, percussion, synthesizer, and FX/other.
split_stem_advanced supports specifying a single target stem through stemName for precise extraction.
Billing: Each request consumes credits. Repeatedly submitting the same stem will deduct credits again (no server-side caching).
Callbacks
vocalRemovalGenerated
POST
{$request.body#/callBackUrl}
Request
Authorization
Bearer Token
Provide your bearer token in the Authorization header when making requests to protected resources.
Example:
Authorization: Bearer ********************
Body Params
application/json
Required
Generate Code
optional
One of:
Separate using existing audio
Separate using user-uploaded audio
object
taskId
string 
required
Unique identifier of the music generation task. This should be a taskId returned from the Generate Music or Extend Music endpoint.
Example:
5c79****be8e
audioId
string 
required
Unique identifier of the specific audio track to process for vocal separation. This ID is returned in the callback data after music generation completes.
Example:
e231****-****-****-****-****8cadc7dc
type
enum<string> 
optional
Separation type, options:
separate_vocal: Separate vocals and accompaniment, generating a vocal track and an instrumental track.
split_stem: Separate various instrument sounds, generating multiple instrument tracks.
split_stem_advanced: Advanced multi-track separation, supporting the specification of a particular instrument track to generate finer instrument tracks.
Allowed values:
separate_vocal
split_stem
split_stem_advanced
Default:
separate_vocal
Example:
separate_vocal
stemName
enum<string> 
required
Only used when type is split_stem_advanced to request a specific stem track/instrument name.
Allowed values:
Lead Vocal
Drum Kit
Kick
Snare
Risers
Bass
Backing Vocals
Piano
Electric Guitar
Percussion
String Section
Synth
Acoustic Guitar
Sound Effects
Synth Pad
Synth Bass
Guitar
Brass Section
Organ
Electronic Drum Kit
Lead Electric Guitar
Synth Keys
Rhythm Electric Guitar
Electric Piano
Upright Bass
Keyboards
Distorted Electric Guitar
Synth Strings
Synth Lead
Woodwinds
Rhythm Acoustic Guitar
Flute
Harp
Tambourine
Trumpet
Arpeggiator
Accordion
Fiddle
Pedal Steel Guitar
Synth Voice
Violin
Digital Piano
Synth Brass
Mandolin
Choir
Banjo
Bells
Clarinet
Tenor Saxophone
Trombone
Shaker
French Horn
Glockenspiel
Electric Bass
Cello
Timpani
Harmonica
Marimba
Vibraphone
Lap Steel Guitar
Saxophone
Orchestra
Horns
Cymbals
Hand Clap
Oboe
Celesta
Congas
Drone
Alto Saxophone
Double Bass
Ukulele
Harpsichord
Baritone Saxophone
Xylophone
Tuba
Bass Guitar
Whistle
Lead Guitar
Rhodes
808
Bongos
Bassoon
Cowbell
Viola
Sitar
Steel Drums
Piccolo
Theremin
Bagpipes
Hi-Hat
Music Box
Melodica
Tabla
Koto
Djembe
Taiko
Didgeridoo
Example:
Piano
callBackUrl
string <uri>
required
URL used to receive vocal separation task completion updates. Required for all vocal separation requests.
Example:
https://api.example.com/callback
Examples
Responses
🟢200
application/json
Request successful
Bodyapplication/json
Generate Code
code
enum<integer> 
optional
Response status code
200: Success - Request has been processed successfully
400: Format Error - The parameter is not in a valid JSON format
401: Unauthorized - Authentication credentials are missing or invalid
402: Insufficient Credits - Account does not have enough credits to perform the operation
404: Not Found - The requested resource or endpoint does not exist
409: Conflict - WAV record already exists
422: Validation Error - The request parameters failed validation checks
429: Rate Limited - Request limit has been exceeded for this resource
455: Service Unavailable - System is currently undergoing maintenance
500: Server Error - An unexpected error occurred while processing the request
Allowed values:
200
400
401
402
404
409
422
429
455
500
msg
string 
optional
Error message when code != 200
Example:
success
data
object 
optional
taskId
string 
optional
Task ID for tracking task status
Example:
5c79****be8e
🔴500
Error
Request Example
Shell
JavaScript
Java
Swift
cURL
cURL-Windows
Httpie
wget
PowerShell
curl --location 'https://api.kie.ai/api/v1/vocal-removal/generate' \
--header 'Authorization: Bearer <token>' \
--header 'Content-Type: application/json' \
--data '{
  "taskId": "5c79****be8e",
  "audioId": "e231****-****-****-****-****8cadc7dc",
  "callBackUrl": "https://api.example.com/callback",
  "type": "separate_vocal"
}'
Response Example
200 - Example 1
{
    "code": 200,
    "msg": "success",
    "data": {
        "taskId": "5c79****be8e"
    }
}
Previous
MIDI Generation Callbacks
Next
Get Vocal Separation Details
LLMs.txt
Clone
Export
Built with

===== PAGE: get-vocal-separation-details =====
KIE.AI
language
language
Market
Support
Market
File Upload API
Common API
Market
File Upload API
Common API
Getting Started with KIE API (Important)
Market
Image Models
Seedream
Z-image
Google
Flux-2
Grok Imagine
GPT Image
Topaz
Recraft
Ideogram
Qwen
4o Image API
Flux Kontext API
Wan
Video Models
Music Models
Chat Models
Suno API
Suno API Quickstart
Music Generation
Lyrics Generation
WAV Conversion
Vocal Removal
Audio Separation Callbacks
MIDI Generation Callbacks
Vocal & Instrument Stem Separation
POST
Get Vocal Separation Details
GET
Generate MIDI from Audio
POST
Get MIDI Generation Details
GET
Music Video Generation
Sounds Generation
voice
Veo3.1 API
Get Task Details
GET
Vocal Removal
Copy Page
Get Vocal Separation Details
GET
/api/v1/vocal-removal/record-info
Run in Apidog
Retrieve detailed information about a vocal separation task.
Usage Guide
Use this endpoint to check the status of a vocal separation task
Access the URLs for vocal, instrumental, and individual instrument tracks once processing is complete
Track processing progress and any errors that may have occurred
Supports querying results for both separate_vocal and split_stem separation types
Status Descriptions
PENDING: Task is waiting to be processed
SUCCESS: Vocal separation completed successfully
CREATE_TASK_FAILED: Failed to create the separation task
GENERATE_AUDIO_FAILED: Failed during audio processing
CALLBACK_EXCEPTION: Error occurred during callback
Response Data Structure Description
separate_vocal type: Returns instrumentalUrl and vocalUrl fields, other instrument fields are null
split_stem type: Returns detailed instrument separation fields, instrumentalUrl is null
Developer Notes
Separated audio file URLs are only available when status is SUCCESS
Error codes and messages are provided for failed tasks
Separated audio files are retained for 14 days after successful processing
Field structure varies based on the type parameter from the original request
Request
Authorization
Bearer Token
Provide your bearer token in the Authorization header when making requests to protected resources.
Example:
Authorization: Bearer ********************
Query Params
Generate Code
taskId
string 
required
Unique identifier of the vocal separation task to retrieve. This is the taskId returned when creating the vocal separation task.
Example:
5e72****97c7
Responses
🟢200
application/json
Request successful
Bodyapplication/json
Generate Code
code
enum<integer> 
optional
Response status code
200: Success - Request has been processed successfully
401: Unauthorized - Authentication credentials are missing or invalid
404: Not Found - The requested resource or endpoint does not exist
422: Validation Error - The request parameters failed validation checks
451: Failed to fetch the image. Kindly verify any access limits set by you or your service provider.
455: Service Unavailable - System is currently undergoing maintenance
500: Server Error - An unexpected error occurred while processing the request
Allowed values:
200
401
404
422
451
455
500
msg
string 
optional
Error message when code != 200
Example:
success
data
object 
optional
taskId
string 
optional
Task ID
musicId
string 
optional
Music ID
callbackUrl
string 
optional
Callback address
musicIndex
integer 
optional
Music index 0 or 1
completeTime
string <date-time>
optional
Complete callback time
response
object 
optional
Vocal separation response result, fields vary based on the type parameter from the original request
successFlag
enum<string> 
optional
Task status
Allowed values:
PENDING
SUCCESS
CREATE_TASK_FAILED
GENERATE_AUDIO_FAILED
CALLBACK_EXCEPTION
createTime
string <date-time>
optional
Creation time
errorCode
enum<number> 
optional
Error code, valid when task fails
200: Success - Request has been processed successfully
500: Internal Error - Please try again later.
Allowed values:
200
500
errorMessage
string 
optional
Error message, valid when task fails
🔴500
Error
Request Example
Shell
JavaScript
Java
Swift
cURL
cURL-Windows
Httpie
wget
PowerShell
curl --location 'https://api.kie.ai/api/v1/vocal-removal/record-info?taskId=5e72****97c7' \
--header 'Authorization: Bearer <token>'
Response Example
200 - separate_vocal Type Query Result
{
    "code": 200,
    "msg": "success",
    "data": {
        "taskId": "3e63b4cc88d52611159371f6af5571e7",
        "musicId": "376c687e-d439-42c1-b1e4-bcb43b095ec2",
        "callbackUrl": "https://57312fc2e366.ngrok-free.app/api/v1/vocal-removal/test",
        "musicIndex": 0,
        "completeTime": 1753782937000,
        "response": {
            "id": null,
            "originUrl": null,
            "originData": [
                {
                    "duration": 245.6,
                    "audio_url": "https://example001.mp3",
                    "stem_type_group_name": "Vocals",
                    "id": "3d7021c9-fa8b-4eda-91d1-3b9297ddb172"
                },
                {
                    "duration": 245.6,
                    "audio_url": "https://example002.mp3",
                    "stem_type_group_name": "Instrumental",
                    "id": "d92a13bf-c6f4-4ade-bb47-f69738435528"
                }
            ],
            "instrumentalUrl": "https://file.aiquickdraw.com/s/d92a13bf-c6f4-4ade-bb47-f69738435528_Instrumental.mp3",
            "vocalUrl": "https://file.aiquickdraw.com/s/3d7021c9-fa8b-4eda-91d1-3b9297ddb172_Vocals.mp3",
            "backingVocalsUrl": null,
            "drumsUrl": null,
            "bassUrl": null,
            "guitarUrl": null,
            "pianoUrl": null,
            "keyboardUrl": null,
            "percussionUrl": null,
            "stringsUrl": null,
            "synthUrl": null,
            "fxUrl": null,
            "brassUrl": null,
            "woodwindsUrl": null
        },
        "successFlag": "SUCCESS",
        "createTime": 1753782854000,
        "errorCode": null,
        "errorMessage": null
    }
}
Previous
Vocal & Instrument Stem Separation
Next
Generate MIDI from Audio
LLMs.txt
Clone
Export
Built with

===== PAGE: generate-midi =====
KIE.AI
language
language
Market
Support
Market
File Upload API
Common API
Market
File Upload API
Common API
Getting Started with KIE API (Important)
Market
Image Models
Seedream
Z-image
Google
Flux-2
Grok Imagine
GPT Image
Topaz
Recraft
Ideogram
Qwen
4o Image API
Flux Kontext API
Wan
Video Models
Music Models
Chat Models
Suno API
Suno API Quickstart
Music Generation
Lyrics Generation
WAV Conversion
Vocal Removal
Audio Separation Callbacks
MIDI Generation Callbacks
Vocal & Instrument Stem Separation
POST
Get Vocal Separation Details
GET
Generate MIDI from Audio
POST
Get MIDI Generation Details
GET
Music Video Generation
Sounds Generation
voice
Veo3.1 API
Get Task Details
GET
Vocal Removal
Copy Page
Generate MIDI from Audio
POST
/api/v1/midi/generate
Run in Apidog
Convert separated audio tracks into MIDI format with detailed note information for each instrument.
Usage Guide
Convert separated audio tracks into structured MIDI data containing pitch, timing, and velocity information
Requires a completed vocal separation task ID (from the Vocal Removal API)
Generates MIDI note data for multiple detected instruments including drums, bass, guitar, keyboards, and more
Ideal for music transcription, notation, remixing, or educational analysis
Best results on clean, well-separated audio tracks with clear instrument parts
Prerequisites
Required
You must first use the Vocal & Instrument Stem Separation API to separate your audio before generating MIDI.
Parameter Reference
Name	Type	Description
taskId	string	Required. Task ID from a completed vocal separation.
callBackUrl	string	Required. URL to receive MIDI generation completion notifications.
audioId	string	Optional. Specifies which separated audio track to generate MIDI from. This audioId can be obtained from the originData array in the Get Vocal Separation Details endpoint response. Each item in originData contains an id field that can be used here. If not provided, MIDI will be generated from all separated tracks.
Developer Notes
The callback will contain detailed note data for each detected instrument.
Each note includes: pitch (MIDI note number), start (seconds), end (seconds), velocity (0-1).
Not all instruments may be detected — depends on audio content.
Pricing: Check current per-call credit costs at https://kie.ai/pricing.
Request
Authorization
Bearer Token
Provide your bearer token in the Authorization header when making requests to protected resources.
Example:
Authorization: Bearer ********************
Body Params
application/json
Required
Generate Code
taskId
string 
required
Task ID from a completed vocal separation. This should be the taskId returned from the Vocal & Instrument Stem Separation endpoint.
Example:
5c79****be8e
callBackUrl
string <uri>
required
The URL to receive MIDI generation task completion updates. Required for all MIDI generation requests.
System will POST task status and MIDI note data to this URL when generation completes
Callback includes detailed note information for each detected instrument with pitch, timing, and velocity
Your callback endpoint should accept POST requests with JSON payload containing MIDI data
For detailed callback format and implementation guide, see MIDI Generation Callbacks
Alternatively, use the Get MIDI Generation Details endpoint to poll task status
To ensure callback security, see Webhook Verification Guide for signature verification implementation
Example:
https://example.callback
audioId
string 
optional
Optional. Specifies which separated audio track to generate MIDI from. This audioId can be obtained from the originData array in the Get Vocal Separation Details endpoint response. Each item in originData contains an id field that can be used here. If not provided, MIDI will be generated from all separated tracks.
Example:
8ca376e7-******-08aaf2c6dd27
Examples
Responses
🟢200
application/json
MIDI generation task created successfully
Bodyapplication/json
Generate Code
code
integer 
optional
Response status code
Example:
200
msg
string 
optional
Response message
Example:
success
data
object 
optional
Response data containing task information
taskId
string 
optional
Unique identifier for the MIDI generation task. Use this to query task status or receive callback results.
Example:
5c79****be8e
🔴500
Error
Request Example
Shell
JavaScript
Java
Swift
cURL
cURL-Windows
Httpie
wget
PowerShell
curl --location 'https://api.kie.ai/api/v1/midi/generate' \
--header 'Authorization: Bearer <token>' \
--header 'Content-Type: application/json' \
--data '{
  "taskId": "5c79****be8e",
  "callBackUrl": "https://example.callback",
  "audioId": "8ca376e7-******-08aaf2c6dd27"
}'
Response Example
200 - 成功示例
{
    "code": 200,
    "msg": "success",
    "data": {
        "taskId": "5c79****be8e"
    }
}
Previous
Get Vocal Separation Details
Next
Get MIDI Generation Details
LLMs.txt
Clone
Export
Built with

===== PAGE: get-midi-details =====
KIE.AI
language
language
Market
Support
Market
File Upload API
Common API
Market
File Upload API
Common API
Getting Started with KIE API (Important)
Market
Image Models
Seedream
Z-image
Google
Flux-2
Grok Imagine
GPT Image
Topaz
Recraft
Ideogram
Qwen
4o Image API
Flux Kontext API
Wan
Video Models
Music Models
Chat Models
Suno API
Suno API Quickstart
Music Generation
Lyrics Generation
WAV Conversion
Vocal Removal
Audio Separation Callbacks
MIDI Generation Callbacks
Vocal & Instrument Stem Separation
POST
Get Vocal Separation Details
GET
Generate MIDI from Audio
POST
Get MIDI Generation Details
GET
Music Video Generation
Sounds Generation
voice
Veo3.1 API
Get Task Details
GET
Vocal Removal
Copy Page
Get MIDI Generation Details
GET
/api/v1/midi/record-info
Run in Apidog
Retrieve detailed information about a MIDI generation task including complete note data for all detected instruments.
Usage Guide
Use this endpoint to check the status of a MIDI generation task
Access complete MIDI note data once processing is complete
Retrieve detailed instrument and note information
Track processing progress and any errors that may have occurred
Status Descriptions
successFlag: 0: Pending - Task is waiting to be executed
successFlag: 1: Success - MIDI generation completed successfully
successFlag: 2: Failed - Failed to create task
successFlag: 3: Failed - MIDI generation failed
Check errorCode and errorMessage fields for failure details
Developer Notes
The midiData field contains the complete MIDI data as a structured object with instruments and notes
MIDI data includes all detected instruments with pitch, timing, and velocity for each note
MIDI generation records are retained for 14 days
Important: When using vocal separation with type: split_stem, the midiData may be empty
Request
Authorization
Bearer Token
Provide your bearer token in the Authorization header when making requests to protected resources.
Example:
Authorization: Bearer ********************
Query Params
Generate Code
taskId
string 
required
The task ID returned from the MIDI generation request
Example:
5c79****be8e
Responses
🟢200
application/json
MIDI generation task details retrieved successfully
Bodyapplication/json
Generate Code
code
integer 
optional
Response status code
Example:
200
msg
string 
optional
Response message
Example:
success
data
object 
optional
MIDI generation task details
taskId
string 
optional
MIDI generation task ID
recordTaskId
integer 
optional
Internal record task ID
audioId
string 
optional
Audio ID from the vocal separation task
callbackUrl
string 
optional
Callback URL provided when creating the task
completeTime
integer 
optional
Task completion timestamp (milliseconds)
midiData
object 
optional
Complete MIDI data containing detected instruments and notes
successFlag
integer 
optional
Task status flag: 0 = Pending, 1 = Success, 2 = Failed to create task, 3 = MIDI generation failed
createTime
integer 
optional
Task creation timestamp (milliseconds)
errorCode
string  | 
null 
optional
Error code if task failed
errorMessage
string  | 
null 
optional
Error message if task failed
🔴500
Error
Request Example
Shell
JavaScript
Java
Swift
cURL
cURL-Windows
Httpie
wget
PowerShell
curl --location 'https://api.kie.ai/api/v1/midi/record-info?taskId=5c79****be8e' \
--header 'Authorization: Bearer <token>'
Response Example
200 - 成功示例
{
    "code": 200,
    "msg": "success",
    "data": {
        "taskId": "5c79****be8e",
        "recordTaskId": -1,
        "audioId": "e231****-****-****-****-****8cadc7dc",
        "callbackUrl": "https://example.callback",
        "completeTime": 1760335255000,
        "midiData": {
            "state": "complete",
            "instruments": [
                {
                    "name": "Drums",
                    "notes": [
                        {
                            "pitch": 73,
                            "start": 0.036458333333333336,
                            "end": 0.18229166666666666,
                            "velocity": 1
                        },
                        {
                            "pitch": 61,
                            "start": 0.046875,
                            "end": 0.19270833333333334,
                            "velocity": 1
                        }
                    ]
                },
                {
                    "name": "Electric Bass (finger)",
                    "notes": [
                        {
                            "pitch": 44,
                            "start": 7.6875,
                            "end": 7.911458333333333,
                            "velocity": 1
                        }
                    ]
                }
            ]
        },
        "successFlag": 1,
        "createTime": 1760335251000,
        "errorCode": null,
        "errorMessage": null
    }
}
Previous
Generate MIDI from Audio
Next
Music Video Generation Callbacks
LLMs.txt
Clone
Export
Built with

===== PAGE: create-music-video =====
KIE.AI
language
language
Market
Support
Market
File Upload API
Common API
Market
File Upload API
Common API
Getting Started with KIE API (Important)
Market
Image Models
Seedream
Z-image
Google
Flux-2
Grok Imagine
GPT Image
Topaz
Recraft
Ideogram
Qwen
4o Image API
Flux Kontext API
Wan
Video Models
Grok Imagine
Kling
Bytedance
Hailuo
Wan
Topaz
Infinitalk
Runway API
PixVerse
MiniMax H3
HappyHorse
Gemini Omni
OmniHuman
Volcengine
Music Models
Chat Models
Suno API
Suno API Quickstart
Music Generation
Lyrics Generation
WAV Conversion
Vocal Removal
Music Video Generation
Music Video Generation Callbacks
Create Music Video
POST
Get Music Video Details
GET
Sounds Generation
voice
Veo3.1 API
Get Task Details
GET
Music Video Generation
Copy Page
Create Music Video
POST
/api/v1/mp4/generate
Run in Apidog
Create a video with visualizations based on your generated music track.
Usage Guide
Use this endpoint to turn your audio tracks into visually appealing videos
Add artist attribution and branding to your music videos
Videos can be shared on social media or embedded in websites
Parameter Details
taskId identifies the original music generation task
audioId specifies which audio track to visualize when multiple variations exist
Optional author and domainName add customized branding to the video
Developer Notes
Generated video files are retained for 14 days
Videos are optimized for social media sharing
Processing time varies based on audio length and server load
Callbacks
onMp4Generated
POST
{$request.body#/callBackUrl}
Request
Authorization
Bearer Token
Provide your bearer token in the Authorization header when making requests to protected resources.
Example:
Authorization: Bearer ********************
Body Params
application/json
Required
Generate Code
taskId
string 
required
Unique identifier of the music generation task. This should be a taskId returned from either the "Generate Music" or "Extend Music" endpoints.
Example:
taskId_774b9aa0422f
audioId
string 
required
Unique identifier of the specific audio track to visualize. This ID is returned in the callback data after music generation completes.
Example:
e231****-****-****-****-****8cadc7dc
callBackUrl
string <uri>
required
The URL to receive music video generation task completion updates. Required for all music video generation requests.
System will POST task status and results to this URL when video generation completes
Callback includes the generated music video file URL with visual effects and branding
Your callback endpoint should accept POST requests with JSON payload containing the video file location
For detailed callback format and implementation guide, see Music Video Callbacks
Alternatively, use the Get Music Video Details endpoint to poll task status
To ensure callback security, see Webhook Verification Guide for signature verification implementation
Example:
https://api.example.com/callback
author
string 
optional
Artist or creator name to display as a signature on the video cover. Maximum 50 characters. This creates attribution for the music creator.
<= 50 characters
Example:
DJ Electronic
domainName
string 
optional
Website or brand to display as a watermark at the bottom of the video. Maximum 50 characters. Useful for promotional branding or attribution.
<= 50 characters
Example:
music.example.com
Examples
Responses
🟢200
application/json
Success
Bodyapplication/json
Generate Code
code
enum<integer> <int32>
optional
Status code
Allowed values:
200
400
401
402
404
409
422
429
455
500
Example:
0
msg
string 
optional
Status message
Examples:
success
data
object 
optional
taskId
string 
optional
Task ID
Example:
🔴500
Error
Request Example
Shell
JavaScript
Java
Swift
cURL
cURL-Windows
Httpie
wget
PowerShell
curl --location 'https://api.kie.ai/api/v1/mp4/generate' \
--header 'Authorization: Bearer <token>' \
--header 'Content-Type: application/json' \
--data '{
    "taskId": "taskId_774b9aa0422f",
    "audioId": "e231****-****-****-****-****8cadc7dc",
    "callBackUrl": "https://api.example.com/callback",
    "author": "DJ Electronic",
    "domainName": "music.example.com"
}'
Response Example
200 - 成功示例
{
    "code": 0,
    "msg": "",
    "data": {
        "taskId": ""
    }
}
Previous
Music Video Generation Callbacks
Next
Get Music Video Details
LLMs.txt
Clone
Export
Built with

===== PAGE: get-music-video-details =====
KIE.AI
language
language
Market
Support
Market
File Upload API
Common API
Market
File Upload API
Common API
Getting Started with KIE API (Important)
Market
Image Models
Seedream
Z-image
Google
Flux-2
Grok Imagine
GPT Image
Topaz
Recraft
Ideogram
Qwen
4o Image API
Flux Kontext API
Wan
Video Models
Grok Imagine
Kling
Bytedance
Hailuo
Wan
Topaz
Infinitalk
Runway API
PixVerse
MiniMax H3
HappyHorse
Gemini Omni
OmniHuman
Volcengine
Music Models
Chat Models
Suno API
Suno API Quickstart
Music Generation
Lyrics Generation
WAV Conversion
Vocal Removal
Music Video Generation
Music Video Generation Callbacks
Create Music Video
POST
Get Music Video Details
GET
Sounds Generation
voice
Veo3.1 API
Get Task Details
GET
Music Video Generation
Copy Page
Get Music Video Details
GET
/api/v1/mp4/record-info
Run in Apidog
Retrieve detailed information about a music video generation task.
Usage Guide
Use this endpoint to check the status of a video generation task
Access the video URL once generation is complete
Track processing progress and any errors that may have occurred
Status Descriptions
PENDING: Task is waiting to be processed
SUCCESS: Video generation completed successfully
CREATE_TASK_FAILED: Failed to create the video generation task
GENERATE_MP4_FAILED: Failed during video file creation
Developer Notes
The video URL is only available in the response when status is SUCCESS
Error codes and messages are provided for failed tasks
Videos are retained for 14 days after successful generation
Request
Authorization
Bearer Token
Provide your bearer token in the Authorization header when making requests to protected resources.
Example:
Authorization: Bearer ********************
Query Params
Generate Code
taskId
string 
required
Unique identifier of the music video generation task to retrieve. This is the taskId returned when creating the music video generation task.
Example:
taskId_774b9aa0422f
Responses
🟢200
application/json
Success
Bodyapplication/json
Generate Code
code
enum<integer> <int32>
optional
Status code
Allowed values:
200
400
401
402
404
409
422
429
455
500
Example:
0
msg
string 
optional
Status message
Examples:
success
data
object 
optional
taskId
string 
optional
Task ID
Example:
musicId
string 
optional
Music ID
Example:
callbackUrl
string 
optional
Callback URL
Example:
musicIndex
integer <int32>
optional
Music index 0 or 1
Example:
0
completeTime
string <date-time>
optional
Completion callback time
Example:
response
object 
optional
Completion callback result
successFlag
string 
optional
PENDING-Waiting for execution SUCCESS-Success CREATE_TASK_FAILED-Failed to create task GENERATE_MP4_FAILED-Failed to generate MP4
Example:
createTime
string <date-time>
optional
Creation time
Example:
errorCode
enum<integer> <int32>
optional
Error code
200: Success - Request has been processed successfully
500: Internal Error - Please try again later.
Allowed values:
200
500
Example:
0
errorMessage
string 
optional
Error message
Example:
🔴500
Error
Request Example
Shell
JavaScript
Java
Swift
cURL
cURL-Windows
Httpie
wget
PowerShell
curl --location 'https://api.kie.ai/api/v1/mp4/record-info?taskId=taskId_774b9aa0422f' \
--header 'Authorization: Bearer <token>'
Response Example
200 - 成功示例
{
    "code": 200,
    "msg": "success",
    "data": {
        "taskId": "988e****c8d3",
        "musicId": "e231****-****-****-****-****8cadc7dc",
        "callbackUrl": "https://api.example.com/callback",
        "musicIndex": 0,
        "completeTime": "2025-01-01 00:10:00",
        "response": {
            "videoUrl": "https://example.com/s/04e6****e727.mp4"
        },
        "successFlag": "SUCCESS",
        "createTime": "2025-01-01 00:00:00",
        "errorCode": null,
        "errorMessage": null
    }
}
Previous
Create Music Video
Next
Generate sounds
LLMs.txt
Clone
Export
Built with

===== PAGE: generate-sounds =====
KIE.AI
language
language
Market
Support
Market
File Upload API
Common API
Market
File Upload API
Common API
Getting Started with KIE API (Important)
Market
Image Models
Seedream
Z-image
Google
Flux-2
Grok Imagine
GPT Image
Topaz
Recraft
Ideogram
Qwen
4o Image API
Flux Kontext API
Wan
Video Models
Grok Imagine
Kling
Bytedance
Hailuo
Wan
Topaz
Infinitalk
Runway API
PixVerse
MiniMax H3
HappyHorse
Gemini Omni
OmniHuman
Volcengine
Music Models
Chat Models
Suno API
Suno API Quickstart
Music Generation
Lyrics Generation
WAV Conversion
Vocal Removal
Music Video Generation
Sounds Generation
Generate sounds
POST
voice
Veo3.1 API
Get Task Details
GET
Sounds Generation
Copy Page
Generate sounds
POST
/api/v1/generate/sounds
Run in Apidog
Used for creating a sound generation task (Sounds Task). It supports settings for looping, tempo (BPM), pitch (Key), as well as lyrics subtitle capture, etc.
🚀 User Guide
By using this interface, you can generate corresponding audio content based on the input prompt.
It supports setting up loop playback effect, which is suitable for background music, ambient sounds, and other scenarios.
It allows specifying BPM (beats per minute) and pitch (Key) to facilitate control over the style of the generated result.
Optional feature to enable lyric subtitle capture for easier display or processing of lyric content later.
Supports asynchronous reception of task completion notifications through callback address.
📌 Usage Scenarios
🎧 Background music creation
🎮 Game sound effects or looped ambient sounds generation
🌐 Integration of audio content platforms and creative tools
Poll Query Results
Use the get lyrics details endpoint to regularly query task status. We recommend querying every 30 seconds.
Request
Authorization
Bearer Token
Provide your bearer token in the Authorization header when making requests to protected resources.
Example:
Authorization: Bearer ********************
Body Params
application/json
Required
Generate Code
prompt
string 
prompt
required
Sound task type limit: 500 characters
model
enum<string> 
required
Model Name
Allowed values:
V5
V5_5
soundLoop
boolean 
optional
Is it a cycle?
Default:
false
soundTempo
integer 
BPM:Beats per minute
optional
Do not broadcast.
>= 1
<= 300
Default:
null
soundKey
enum<string> 
optional
Allowed values:
Cm
C#m
Dm
D#m
Em
Fm
F#m
Gm
G#m
Am
A#m
Bm
C
C#
D
D#
E
F
F#
G
G#
A
A#
B
Default:
Any
Example:
Any
grabLyrics
boolean 
Grab the lyrics subtitles
optional
Whether to capture the lyrics subtitles
Will the interface be called after completion to obtain the lyrics subtitles?
Default:
false
callBackUrl
string 
Callback address
optional
Callback user
Examples
Responses
🟢200
application/json
Request successful
Bodyapplication/json
Generate Code
code
enum<integer> 
optional
Response status code
200: Success - Request has been processed successfully
401: Unauthorized - Authentication credentials are missing or invalid
402: Insufficient Credits - Account does not have enough credits to perform the operation
404: Not Found - The requested resource or endpoint does not exist
422: Validation Error - The request parameters failed validation checks
429: Rate Limited - Request limit has been exceeded for this resource
433: Request Limit - Sub-key Usage Exceeds Limit
455: Service Unavailable - System is currently undergoing maintenance
500: Server Error - An unexpected error occurred while processing the request
501: Generation Failed - Content generation task failed
505: Feature Disabled - The requested feature is currently disabled
Allowed values:
200
401
402
404
422
429
433
455
500
501
505
msg
string 
optional
Response message, error description when failed
Example:
success
data
object 
required
taskId
string 
required
Task ID, can be used with Get Task Details endpoint to query task status
Request Example
Shell
JavaScript
Java
Swift
cURL
cURL-Windows
Httpie
wget
PowerShell
curl --location 'https://api.kie.ai/api/v1/generate/sounds' \
--header 'Authorization: Bearer <token>' \
--header 'Content-Type: application/json' \
--data '{
  "prompt": "sint",
  "model": "V5",
  "soundLoop": true,
  "soundTempo": 166,
  "soundKey": "D#m",
  "grabLyrics": true
}'
Response Example
{
    "code": 422,
    "msg": "success",
    "data": {
        "taskId": "task38695****935u9043u"
    }
}
Previous
Get Music Video Details
Next
Suno Voice Generation Callback
LLMs.txt
Clone
Export
Built with

===== PAGE: boost-music-style =====
KIE.AI
language
language
Market
Support
Market
File Upload API
Common API
Market
File Upload API
Common API
Getting Started with KIE API (Important)
Market
Image Models
Video Models
Music Models
Chat Models
Suno API
Suno API Quickstart
Music Generation
Music Generation Callbacks
Music Extension Callbacks
Audio Upload and Cover Callbacks
Audio Upload and Extension Callbacks
Add Instrumental Callbacks
Add Vocals Callbacks
Music Cover Generation Callbacks
Replace Music Section Callbacks
Generate Music
POST
Extend Music
POST
Upload And Cover Audio
POST
Upload And Extend Audio
POST
Add Instrumental to Music
POST
Add Vocals to Music
POST
Get Music Task Details
GET
Get Timestamped Lyrics
POST
Boost Music Style
POST
Generate Music Cover
POST
Get Cover Generation Details
GET
Replace Music Section
POST
Generate Persona
POST
Generate Mashup Music
POST
Lyrics Generation
WAV Conversion
Vocal Removal
Music Video Generation
Sounds Generation
voice
Veo3.1 API
Get Task Details
GET
Music Generation
Copy Page
Boost Music Style
POST
/api/v1/style/generate
Run in Apidog
Request
Authorization
Bearer Token
Provide your bearer token in the Authorization header when making requests to protected resources.
Example:
Authorization: Bearer ********************
Body Params
application/json
Required
Generate Code
content
string 
required
Style description. Please describe in concise and clear language the music style you expect to generate. Example: 'Pop, Mysterious'
Example:
Pop, Mysterious
Examples
Responses
🟢200
application/json
Request successful
Bodyapplication/json
Generate Code
code
enum<integer> 
optional
Response status code
200: Success - Request has been processed successfully
401: Unauthorized - Authentication credentials are missing or invalid
402: Insufficient Credits - Account does not have enough credits to perform the operation
404: Not Found - The requested resource or endpoint does not exist
409: Conflict - WAV record already exists
422: Validation Error - The request parameters failed validation checks
429: Rate Limited - Request limit has been exceeded for this resource
451: Unauthorized - Failed to fetch the image. Kindly verify any access limits set by you or your service provider.
455: Service Unavailable - System is currently undergoing maintenance
500: Server Error - An unexpected error occurred while processing the request
Allowed values:
200
401
402
404
409
422
429
451
455
500
msg
string 
optional
Error message when code != 200
Example:
success
data
object 
optional
taskId
string 
optional
Task ID
param
string 
optional
Request parameters
result
string 
optional
The final generated music style text result.
creditsConsumed
number 
optional
Credits consumed, up to 5 digits, up to 2 decimal places
creditsRemaining
number 
optional
Credits remaining after this task
successFlag
string 
optional
Execution result: 0-pending, 1-success, 2-failed
errorCode
enum<integer> <int32>
optional
Error code
400: Validation Error - Failed, The request parameters failed validation checks.
Value:
400
errorMessage
string 
optional
Error message
Example:
createTime
string 
optional
Creation time
🔴500
Error
Request Example
Shell
JavaScript
Java
Swift
cURL
cURL-Windows
Httpie
wget
PowerShell
curl --location 'https://api.kie.ai/api/v1/style/generate' \
--header 'Authorization: Bearer <token>' \
--header 'Content-Type: application/json' \
--data '{
  "content": "Pop, Mysterious"
}'
Response Example
200 - Example 1
{
    "code": 200,
    "msg": "success",
    "data": {
        "taskId": "string",
        "param": "string",
        "result": "string",
        "creditsConsumed": 0,
        "creditsRemaining": 0,
        "successFlag": "string",
        "errorCode": 400,
        "errorMessage": "",
        "createTime": "string"
    }
}
Previous
Get Timestamped Lyrics
Next
Generate Music Cover
LLMs.txt
Clone
Export
Built with

===== PAGE: generate-mashup =====
KIE.AI
language
language
Market
Support
Market
File Upload API
Common API
Market
File Upload API
Common API
Getting Started with KIE API (Important)
Market
Image Models
Video Models
Music Models
Chat Models
Suno API
Suno API Quickstart
Music Generation
Music Generation Callbacks
Music Extension Callbacks
Audio Upload and Cover Callbacks
Audio Upload and Extension Callbacks
Add Instrumental Callbacks
Add Vocals Callbacks
Music Cover Generation Callbacks
Replace Music Section Callbacks
Generate Music
POST
Extend Music
POST
Upload And Cover Audio
POST
Upload And Extend Audio
POST
Add Instrumental to Music
POST
Add Vocals to Music
POST
Get Music Task Details
GET
Get Timestamped Lyrics
POST
Boost Music Style
POST
Generate Music Cover
POST
Get Cover Generation Details
GET
Replace Music Section
POST
Generate Persona
POST
Generate Mashup Music
POST
Lyrics Generation
WAV Conversion
Vocal Removal
Music Video Generation
Sounds Generation
voice
Veo3.1 API
Get Task Details
GET
Music Generation
Copy Page
Generate Mashup Music
POST
/api/v1/generate/mashup
Run in Apidog
Create remix music using AI models by combining multiple audio tracks.
Usage Guide
This interface creates remix music from up to 2 uploaded audio files.
It combines elements from multiple tracks into a coherent new piece.
You can control the level of detail using custom mode and instrumental settings.
Parameter Details
uploadUrlList is required and must contain exactly 2 audio file URLs.
In Custom Mode (customMode: true)
Character limits for prompt across different models:
Model	prompt Limit	style Limit
V4	3000 characters	200 characters
V4_5 and V4_5PLUS	5000 characters	1000 characters
V4_5ALL	5000 characters	1000 characters
V5 and V5_5	5000 characters	1000 characters
title length limit: 80 characters (all models).
In Non-Custom Mode (customMode: false)
prompt length limit: 500 characters.
instrumental: Whether to generate instrumental music.
Other parameters should be left empty.
Developer Notes
TIP
New users are advised to start with customMode: false, which is simpler.
Generated files will be retained for 14 days.
The callback process has three stages: text (text generation), first (first track complete), complete (all complete).
Uploaded audio files must have publicly accessible URLs.
uploadUrlList must contain exactly 2 audio file URLs to initiate remix generation.
Optional Parameters
Parameter	Type	Description
vocalGender	string	Vocal gender preference. m for male, f for female. Note: This parameter only takes effect when customMode is true. In practice, this parameter only increases the probability but does not guarantee adherence to the specified vocal gender.
styleWeight	number	Strength of adherence to style. Note: This parameter only takes effect when customMode is true. Range is 0–1, with two decimal places. Example: 0.61.
weirdnessConstraint	number	Creativity/discreteness level. Note: This parameter only takes effect when customMode is true. Range is 0–1, with two decimal places. Example: 0.72.
audioWeight	number	Weight of audio elements. Note: This parameter only takes effect when customMode is true. Range is 0–1, with two decimal places. Example: 0.65.
Callbacks
audioGenerated
POST
{request.body#/callBackUrl}
Request
Authorization
Bearer Token
Provide your bearer token in the Authorization header when making requests to protected resources.
Example:
Authorization: Bearer ********************
Body Params
application/json
Required
Generate Code
uploadUrlList
array[string <uri>]
required
Array of audio file URLs to mashup. Must contain exactly 2 URLs. Each URL must be publicly accessible.
>= 2 items
<= 2 items
Example:
["https://example.com/audio1.mp3","https://example.com/audio2.mp3"]
prompt
string 
optional
A description of the desired audio content.
In Custom Mode (customMode: true): Required if instrumental is false. The prompt will be strictly used as the lyrics and sung in the generated track. Character limits by model:
V4: Maximum 3000 characters
V4_5 & V4_5PLUS: Maximum 5000 characters
V4_5ALL: Maximum 5000 characters
V5 & V5_5: Maximum 5000 characters
Example: "A calm and relaxing piano track with soft melodies"
In Non-custom Mode (customMode: false): Always required. The prompt serves as the core idea, and lyrics will be automatically generated based on it (not strictly matching the input). Maximum 500 characters.
Example: "A short relaxing piano tune"
Example:
A calm and relaxing piano track with soft melodies
style
string 
required
Music style specification for the generated audio.
Only available and required in Custom Mode (customMode: true). Defines the genre, mood, or artistic direction.
Character limits by model:
V4: Maximum 200 characters
V4_5 & V4_5PLUS: Maximum 1000 characters
V4_5ALL: Maximum 1000 characters
V5 & V5_5: Maximum 1000 characters
Common examples: Jazz, Classical, Electronic, Pop, Rock, Hip-hop, etc.
Example:
Jazz
title
string 
required
Title for the generated music track.
Only available and required in Custom Mode (customMode: true).
Max length: 80 characters.
Will be displayed in player interfaces and filenames.
Example:
Relaxing Piano
customMode
boolean 
required
Determines if advanced parameter customization is enabled.
If true: Allows detailed control with specific requirements for style and title fields.
If false: Simplified mode where only prompt is required and other parameters are ignored.
Example:
true
instrumental
boolean 
optional
Determines if the audio should be instrumental (no lyrics).
In Custom Mode (customMode: true):
If true: Only style and title are required.
If false: style, title, and prompt are required (with prompt used as the exact lyrics).
In Non-custom Mode (customMode: false): No impact on required fields (prompt only).
Example:
true
model
enum<string> 
required
The AI model version to use for generation.
Required for all requests.
Available options:
V5_5: Custom Models Tailored to Your Unique Taste.
V5: Superior musical expression, faster generation.
V4_5PLUS: V4.5+ delivers richer sound, new ways to create, max 8 min.
V4_5: V4.5 enables smarter prompts, faster generations, max 8 min.
V4_5ALL: V4.5ALL enables smarter prompts, faster generations, max 8 min.
V4: V4 improves vocal quality, max 4 min.
Allowed values:
V4
V4_5
V4_5PLUS
V4_5ALL
V5
V5_5
Example:
V4
callBackUrl
string <uri>
required
The URL to receive music generation task completion updates. Required for all music generation requests.
System will POST task status and results to this URL when generation completes
Callback process has three stages: text (text generation), first (first track complete), complete (all tracks complete)
Note: Some cases may skip text and first stages and return complete directly
Your callback endpoint should accept POST requests with JSON payload containing task results and audio URLs
For detailed callback format and implementation guide, see Music Generation Callbacks
Alternatively, use the Get Music Details endpoint to poll task status
To ensure callback security, see Webhook Verification Guide for signature verification implementation
Example:
https://example.com/callback
vocalGender
enum<string> 
optional
Vocal gender preference for the singing voice.
Only available in Custom Mode (customMode: true). Optional. Use 'm' for male and 'f' for female. Based on practice, this parameter can only increase the probability but cannot guarantee adherence to male/female voice instructions.
Allowed values:
m
f
Example:
m
styleWeight
number 
optional
Strength of adherence to the specified style.
Only available in Custom Mode (customMode: true). Optional. Range 0–1, up to 2 decimal places.
>= 0
<= 1
Example:
0.61
Multiple of:
0.01
weirdnessConstraint
number 
optional
Controls experimental/creative deviation.
Only available in Custom Mode (customMode: true). Optional. Range 0–1, up to 2 decimal places.
>= 0
<= 1
Example:
0.72
Multiple of:
0.01
audioWeight
number 
optional
Balance weight for audio features vs. other factors.
Only available in Custom Mode (customMode: true). Optional. Range 0–1, up to 2 decimal places.
>= 0
<= 1
Example:
0.65
Multiple of:
0.01
duration
integer 
optional
Duration is selectable; valid only when custom_mode is true and model is V5_5.
>= 10
<= 360
Default:
20
Example:
20
Examples
Responses
🟢200
application/json
Request successful
Bodyapplication/json
Generate Code
code
enum<integer> 
optional
Response Status Codes
200: Success - Request has been processed successfully
401: Unauthorized - Authentication credentials are missing or invalid
402: Insufficient Credits - Account does not have enough credits to perform the operation
404: Not Found - The requested resource or endpoint does not exist
409: Conflict - WAV record already exists
422: Validation Error - The request parameters failed validation checks
429: Rate Limited - Request limit has been exceeded for this resource
451: Unauthorized - Failed to fetch the image. Kindly verify any access limits set by you or your service provider
455: Service Unavailable - System is currently undergoing maintenance
500: Server Error - An unexpected error occurred while processing the request
Allowed values:
200
401
402
404
409
422
429
451
455
500
msg
string 
optional
Error message when code != 200
Example:
success
data
object 
optional
taskId
string 
optional
Task ID for tracking task status. Use this ID with the "Get Music Details" endpoint to query task details and results.
Example:
5c79****be8e
🔴500
Error
Request Example
Shell
JavaScript
Java
Swift
cURL
cURL-Windows
Httpie
wget
PowerShell
curl --location 'https://api.kie.ai/api/v1/generate/mashup' \
--header 'Authorization: Bearer <token>' \
--header 'Content-Type: application/json' \
--data '{
  "uploadUrlList": [
    "https://example.com/audio1.mp3",
    "https://example.com/audio2.mp3"
  ],
  "customMode": true,
  "model": "V4",
  "callBackUrl": "https://example.com/callback",
  "prompt": "A calm and relaxing piano track with soft melodies",
  "style": "Jazz",
  "title": "Relaxing Piano",
  "instrumental": true,
  "vocalGender": "m",
  "styleWeight": 0.61,
  "weirdnessConstraint": 0.72,
  "audioWeight": 0.65
}'
Response Example
200 - Example 1
{
    "code": 200,
    "msg": "success",
    "data": {
        "taskId": "5c79****be8e"
    }
}
Previous
Generate Persona
Next
Lyrics Generation Callbacks
LLMs.txt
Clone
Export
Built with