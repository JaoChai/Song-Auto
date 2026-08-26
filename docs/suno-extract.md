### quickstart
GET
https://api.kie.ai
curl -X POST "https://api.kie.ai/api/v1/generate" \
"callBackUrl": "https://your-app.com/callback"
}'
curl -X GET "https://api.kie.ai/api/v1/generate/record-info?taskId=YOUR_TASK_ID" \
{
"code": 200,
}
}
{
"code": 200,
"status": "SUCCESS",
{
}
}
}
}
Parameter	Type	Required	Description
customMode	boolean	Yes	Controls parameter complexity: false (Simple Mode) or true (Advanced Mode)
instrumental	boolean	Yes	Determines vocal presence: true (Instrumental only) or false (Includes lyrics)
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
this.baseUrl = 'https://api.kie.ai/api/v1';
}
},
body: JSON.stringify({
callBackUrl: options.callBackUrl || 'https://your-app.com/callback'
})
});
}
}
},
body: JSON.stringify({
callBackUrl: options.callBackUrl || 'https://your-app.com/callback'
})
});
}
}
async generateLyrics(prompt, callBackUrl) {
},
body: JSON.stringify({
callBackUrl
})
});
}
}
case 'SUCCESS':
case 'FIRST_SUCCESS':
case 'TEXT_SUCCESS':
case 'CALLBACK_EXCEPTION':
const callbackError = status.errorMessage || 'Callback process error';
console.error('Error message:', callbackError);
throw new Error(callbackError);
}
}
}
}
}
});
}
}
}
{
}
});
});
} catch (error) {
}
}
const response = await fetch('https://api.kie.ai/api/v1/style/generate', {
},
body: JSON.stringify({
})
});
const response = await fetch('https://api.kie.ai/api/v1/wav/generate', {
},
body: JSON.stringify({
callBackUrl: 'https://your-app.com/callback'
})
});
Async Processing with Callbacks
Set up webhook callbacks for automatic notifications:
callBackUrl: 'https://your-server.com/suno-callback'
});
// Your callback endpoint will receive:
app.post('/suno-callback', (req, res) => {
if (code === 200 && data.callbackType === 'complete') {
});
}
});
Learn More About Callbacks
Complete guide to implementing and handling Suno API callbacks
Status	Description
PENDING	Task is waiting to be processed or currently generating
TEXT_SUCCESS	Lyrics/text generation completed successfully
FIRST_SUCCESS	First track generation completed
SUCCESS	All tracks generated successfully
CREATE_TASK_FAILED	Failed to create task
GENERATE_AUDIO_FAILED	Failed to generate audio
SENSITIVE_WORD_ERROR	Content filtered due to sensitive words
Rate Limiting (Code 429)
Music Generation Callbacks

### generate-music
Music Generation Callbacks
Music Extension Callbacks
Audio Upload and Cover Callbacks
Audio Upload and Extension Callbacks
Add Instrumental Callbacks
Add Vocals Callbacks
Music Cover Generation Callbacks
Replace Music Section Callbacks
POST
POST
POST
POST
POST
POST
GET
POST
POST
POST
GET
POST
POST
POST
GET
POST
If instrumental: true: style and title are required
If instrumental: false: style, prompt, and title are required
Character limits vary by model:
V4: prompt 3000 characters, style 200 characters
V4_5 & V4_5PLUS: prompt 5000 characters, style 1000 characters
V4_5ALL: prompt 5000 characters, style 1000 characters
V5_5 & V5: prompt 5000 characters, style 1000 characters
title length limit: 80 characters (all models)
Only prompt is required regardless of instrumental setting
prompt length limit: 3000 characters
Callback process has three stages: text (text generation), first (first track complete), complete (all tracks complete)
Callbacks
POST
{request.body#/callBackUrl}
Required
string
required
In Custom Mode (customMode: true): Required if instrumental is false. The prompt will be strictly used as the lyrics and sung in the generated track. Character limits by model:
V4: Maximum 3000 characters
V4_5 & V4_5PLUS: Maximum 5000 characters
V4_5ALL: Maximum 5000 characters
V5_5 & V5: Maximum 5000 characters
In Non-custom Mode (customMode: false): Always required. The prompt serves as the core idea, and lyrics will be automatically generated based on it (not strictly matching the input). Maximum 3000 characters.
string
Required in Custom Mode (customMode: true). Defines the genre, mood, or artistic direction.
Character limits by model:
V4: Maximum 200 characters
V4_5 & V4_5PLUS: Maximum 1000 characters
V4_5ALL: Maximum 1000 characters
V5_5 & V5: Maximum 1000 characters
string
Required in Custom Mode (customMode: true).
Max length: 80 characters.
boolean
required
If false: Simplified mode where only prompt is required and other parameters are ignored.
boolean
required
If true: Only style and title are required.
If false: style, title, and prompt are required (with prompt used as the exact lyrics).
In Non-custom Mode (customMode: false): No impact on required fields (prompt only).
enum<string>
required
Required for all requests.
callBackUrl
string <uri>
required
The URL to receive music generation task completion updates. Required for all music generation requests.
Callback process has three stages: text (text generation), first (first track complete), complete (all tracks complete)
Your callback endpoint should accept POST requests with JSON payload containing task results and audio URLs
For detailed callback format and implementation guide, see Music Generation Callbacks
To ensure callback security, see Webhook Verification Guide for signature verification implementation
https://api.example.com/callback
string
enum<string>
string
enum<string>
enum<integer>
429: Rate Limited - Request limit has been exceeded for this resource
451: Unauthorized - Failed to fetch the image. Kindly verify any access limits set by you or your service provider
string
string
curl --location 'https://api.kie.ai/api/v1/generate' \
"callBackUrl": "https://api.example.com/callback",
}'
{
"code": 200,
}
}
Replace Music Section Callbacks

### generate-music-callbacks
Music Generation Callbacks
Music Extension Callbacks
Audio Upload and Cover Callbacks
Audio Upload and Extension Callbacks
Add Instrumental Callbacks
Add Vocals Callbacks
Music Cover Generation Callbacks
Replace Music Section Callbacks
POST
POST
POST
POST
POST
POST
GET
POST
POST
POST
GET
POST
POST
POST
GET
Music Generation Callbacks
System will call this callback when audio generation is complete.
When you submit a music generation task to the Suno API, you can use the callBackUrl parameter to set a callback URL. The system will automatically push the results to your specified address when the task is completed.
Callback Mechanism Overview
The callback mechanism eliminates the need to poll the API for task status. The system will proactively push task completion results to your server.
To ensure the authenticity and integrity of callback requests, we strongly recommend implementing webhook signature verification. See our Webhook Verification Guide for detailed implementation steps.
Callback Timing
The system will send callback notifications in the following situations:
Callback Method
Callback Request Format
When the task is completed, the system will send a POST request to your callBackUrl in the following format:
Complete Success Callback
First Track Success Callback
Text Generation Callback
Failure Callback
{
"code": 200,
"callbackType": "complete",
{
},
{
}
}
}
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
data.callbackType (string, required)
Callback type:
data.task_id (string, required)
data.data[].id (string)
data.data[].audio_url (string)
data.data[].stream_audio_url (string)
data.data[].image_url (string)
data.data[].prompt (string)
data.data[].model_name (string)
data.data[].title (string)
data.data[].tags (string)
data.data[].createTime (string)
Callback Reception Examples
Here are example codes for receiving callbacks in popular programming languages:
PHP
app.post('/suno-callback', (req, res) => {
console.log('Received callback:', {
callbackType: data.callbackType
});
if (data.callbackType === 'complete') {
});
} else if (data.callbackType === 'first') {
} else if (data.callbackType === 'text') {
}
} else {
}
// Return 200 status code to confirm callback received
});
console.log('Callback server running on port 3000');
});
Callback URL Configuration Recommendations
Use HTTPS: Ensure your callback URL uses HTTPS protocol for secure data transmission
Verify Source: Verify the legitimacy of the request source in callback processing
Idempotent Processing: The same task_id may receive multiple callbacks, ensure processing logic is idempotent
Quick Response: Callback processing should return a 200 status code as quickly as possible to avoid timeout
Asynchronous Processing: Complex business logic should be processed asynchronously to avoid blocking callback response
Stage Tracking: Differentiate between different generation stages based on callbackType and arrange business logic appropriately
Callback URL must be a publicly accessible address
If 3 consecutive retries fail, the system will stop sending callbacks
Please ensure the stability of callback processing logic to avoid callback failures due to exceptions
Pay attention to handling different callbackType callbacks, especially the complete type for final results
If you do not receive callback notifications, please check the following:
Callback Type Processing
If you cannot use the callback mechanism, you can also use polling:
Music Extension Callbacks

### get-music-details
Music Generation Callbacks
Music Extension Callbacks
Audio Upload and Cover Callbacks
Audio Upload and Extension Callbacks
Add Instrumental Callbacks
Add Vocals Callbacks
Music Cover Generation Callbacks
Replace Music Section Callbacks
POST
POST
POST
POST
POST
POST
GET
POST
POST
POST
GET
POST
POST
POST
GET
GET
TEXT_SUCCESS: Lyrics/text generation completed successfully
FIRST_SUCCESS: First track generation completed
SUCCESS: All tracks generated successfully
CALLBACK_EXCEPTION: Error during callback process
Maximum query rate: 3 requests per second per task
string
required
enum<integer>
451: Unauthorized - Failed to fetch the image. Kindly verify any access limits set by you or your service provider.
string
string
string
string
enum<string>
PENDING
TEXT_SUCCESS
FIRST_SUCCESS
SUCCESS
CREATE_TASK_FAILED
GENERATE_AUDIO_FAILED
CALLBACK_EXCEPTION
SENSITIVE_WORD_ERROR
enum<string>
enum<string>
enum<integer> <int32>
408: Rate Limited - Timeout.
string
curl --location 'https://api.kie.ai/api/v1/generate/record-info?taskId=5c79****be8e' \
{
"code": 200,
{
}
},
"status": "SUCCESS",
}
}

### extend-music


### generate-lyrics
Lyrics Generation Callbacks
POST
GET
GET
POST
Callback occurs once with all generated variations when complete
Callbacks
POST
{$request.body#/callBackUrl}
Required
string
required
Description of the desired lyrics content. Be specific about theme, mood, style, or story elements you want in the lyrics. More detailed prompts yield better results. The maximum word limit is 200 characters.
callBackUrl
string <uri>
The URL to receive lyrics generation task completion updates. Required for all lyrics generation requests.
Callback includes all generated lyrics variations with titles and structured content
Your callback endpoint should accept POST requests with JSON payload containing lyrics data
For detailed callback format and implementation guide, see Lyrics Generation Callbacks
To ensure callback security, see Webhook Verification Guide for signature verification implementation
https://api.example.com/callback
enum<integer>
405: Rate limit exceeded
string
string
curl --location 'https://api.kie.ai/api/v1/lyrics' \
"callBackUrl": "https://api.example.com/callback"
}'
{
"code": 200,
}
}
Lyrics Generation Callbacks

### get-lyrics-details
Lyrics Generation Callbacks
POST
GET
GET
GET
SUCCESS: Lyrics generated successfully
CALLBACK_EXCEPTION: Error occurred during callback
string
required
enum<integer>
451: Failed to fetch the image. Kindly verify any access limits set by you or your service provider.
string
string
string
enum<string>
PENDING
SUCCESS
CREATE_TASK_FAILED
GENERATE_LYRICS_FAILED
CALLBACK_EXCEPTION
SENSITIVE_WORD_ERROR
enum<number>
string
curl --location 'https://api.kie.ai/api/v1/lyrics/record-info?taskId=11dc****8b0f' \
{
"code": 200,
{
}
},
"status": "SUCCESS",
}
}
Convert to WAV Callbacks

### add-instrumental
Music Generation Callbacks
Music Extension Callbacks
Audio Upload and Cover Callbacks
Audio Upload and Extension Callbacks
Add Instrumental Callbacks
Add Vocals Callbacks
Music Cover Generation Callbacks
Replace Music Section Callbacks
POST
POST
POST
POST
POST
POST
GET
POST
POST
POST
GET
POST
POST
POST
GET
POST
Callback process has three stages: text (text generation), first (first track completed), complete (all completed)
Callbacks
POST
{request.body#/callBackUrl}
Required
string <uri>
required
enum<string>
string
required
string
required
Music styles or characteristics to exclude from the generated audio. Used to avoid specific unwanted music elements.
<= 200 characters
string
required
Music styles or tags to include in the generated music. Defines the desired music style and characteristics.
<= 1000 characters
callBackUrl
string <uri>
required
URL address for receiving instrumental generation task completion updates. This parameter is required for all instrumental generation requests.
Callback process has three stages: text (text generation), first (first track completed), complete (all completed)
Your callback endpoint should be able to accept POST requests containing JSON payloads with music generation results
To ensure callback security, see Webhook Verification Guide for signature verification implementation
https://example.com/callback
enum<string>
enum<integer>
429: Rate limit exceeded - Request limit for this resource has been exceeded
string
string
curl --location 'https://api.kie.ai/api/v1/generate/add-instrumental' \
"callBackUrl": "https://example.com/callback",
}'
{
"code": 200,
}
}

### upload-and-cover-audio
Music Generation Callbacks
Music Extension Callbacks
Audio Upload and Cover Callbacks
Audio Upload and Extension Callbacks
Add Instrumental Callbacks
Add Vocals Callbacks
Music Cover Generation Callbacks
Replace Music Section Callbacks
POST
POST
POST
POST
POST
POST
GET
POST
POST
POST
GET
POST
POST
POST
GET
POST
Character Limits
Character limits vary depending on the model version:
If instrumental is true: style, title, and uploadUrl are required.
If instrumental is false: style, prompt, title, and uploadUrl are required.
Character limits vary by model version (see note above).
Only prompt and uploadUrl are required, regardless of the instrumental setting.
prompt length limit: 500 characters.
Ensure all required parameters are provided based on the customMode and instrumental settings to avoid errors.
Pay attention to character limits for prompt, style, and title to ensure successful processing.
Callback Process Stages: The callback process has three stages: text (text generation complete), first (first track complete), and complete (all tracks complete).
Active Status Check: You can use the Get Music Generation Details endpoint to actively check the task status instead of waiting for callbacks.
vocalGender (string): Vocal gender preference. Use m for male, f for female.
personaId (string): Persona ID to apply to the generated music. Only available when Custom Mode is enabled (i.e., customMode is true). To create one, use Generate Persona.
Callbacks
POST
{request.body#/callBackUrl}
Required
string <uri>
required
The URL for uploading audio files, required regardless of whether customMode and instrumental are true or false. Ensure the uploaded audio does not exceed 8 minutes in length.
string
required
In Custom Mode (customMode: true): Required if instrumental is false. The prompt will be strictly used as the lyrics and sung in the generated track. Character limits by model:
V5_5 & V5: Maximum 5000 characters
V4_5PLUS & V4_5: Maximum 5000 characters
V4_5ALL: Maximum 5000 characters
V4: Maximum 3000 characters
In Non-custom Mode (customMode: false): Always required. The prompt serves as the core idea, and lyrics will be automatically generated based on it (not strictly matching the input). Max length: 500 characters.
string
Required in Custom Mode (customMode: true). Examples: "Jazz", "Classical", "Electronic". Character limits by model:
V5_5 & V5: Maximum 1000 characters
V4_5PLUS & V4_5: Maximum 1000 characters
V4_5ALL: Maximum 1000 characters
V4: Maximum 200 characters
string
Required in Custom Mode (customMode: true). Character limits by model:
V5_5 & V5: Maximum 100 characters
V4_5PLUS & V4_5: Maximum 100 characters
V4_5ALL: Maximum 80 characters
V4: Maximum 80 characters
boolean
required
Set to true to use Custom Mode (requires style and title; prompt required if instrumental is false). The prompt will be strictly used as lyrics if instrumental is false.
Set to false for Non-custom Mode (only prompt is required). Lyrics will be auto-generated based on the prompt.
boolean
required
If true: Only style and title are required.
If false: style, title, and prompt are required (with prompt used as the exact lyrics).
In Non-custom Mode (customMode: false): No impact on required fields (prompt only). Lyrics are auto-generated if instrumental is false.
enum<string>
required
Required for all requests.
string
callBackUrl
string <uri>
required
The URL to receive audio covering task completion updates. Required for all audio covering requests.
Callback includes generated covered audio files with new style while preserving original melody
Your callback endpoint should accept POST requests with JSON payload containing covered track results and audio URLs
For detailed callback format and implementation guide, see Audio Covering Callbacks
To ensure callback security, see Webhook Verification Guide for signature verification implementation
https://api.example.com/callback
enum<string>
string
enum<string>
integer
enum<integer>
429: Rate Limited - Request limit has been exceeded for this resource
451: Unauthorized - Failed to fetch the image. Kindly verify any access limits set by you or your service provider.
string
string
curl --location 'https://api.kie.ai/api/v1/generate/upload-cover' \
"callBackUrl": "https://api.example.com/callback",
}'
{
"code": 200,
}
}

### cover-suno
Music Generation Callbacks
Music Extension Callbacks
Audio Upload and Cover Callbacks
Audio Upload and Extension Callbacks
Add Instrumental Callbacks
Add Vocals Callbacks
Music Cover Generation Callbacks
Replace Music Section Callbacks
POST
POST
POST
POST
POST
POST
GET
POST
POST
POST
GET
POST
POST
POST
GET
POST
Results will be notified through the callback URL upon completion
callBackUrl receives callback address for completion notifications
Callbacks
POST
{$request.body#/callBackUrl}
Required
string
required
callBackUrl
string <uri>
URL address for receiving Cover generation task completion updates. This parameter is required for all Cover generation requests.
Your callback endpoint should be able to accept JSON payloads containing cover image URLs
For detailed callback format and implementation guide, see Cover Generation Callbacks
To ensure callback security, see Webhook Verification Guide for signature verification implementation
https://api.example.com/callback
enum<integer> <int32>
string
string
curl --location 'https://api.kie.ai/api/v1/suno/cover/generate' \
"callBackUrl": "https://api.example.com/callback"
}'
{
"code": 200,
}
}

### get-cover-suno-details
Music Generation Callbacks
Music Extension Callbacks
Audio Upload and Cover Callbacks
Audio Upload and Extension Callbacks
Add Instrumental Callbacks
Add Vocals Callbacks
Music Cover Generation Callbacks
Replace Music Section Callbacks
POST
POST
POST
POST
POST
POST
GET
POST
POST
POST
GET
POST
POST
POST
GET
GET
SUCCESS: Cover generation completed successfully
Cover image URLs are only available when status is SUCCESS in the response
string
required
enum<integer> <int32>
string
string
string
callbackUrl
string
Callback URL
https://api.example.com/callback
string <date-time>
Completion callback time
Completion callback result
enum<integer>
string <date-time>
enum<integer> <int32>
string
curl --location 'https://api.kie.ai/api/v1/suno/cover/record-info?taskId=21aee3c3c2a01fa5e030b3799fa4dd56' \
{
"code": 200,
"callbackUrl": "https://api.example.com/callback",
},
}
}

### replace-section
Music Generation Callbacks
Music Extension Callbacks
Audio Upload and Cover Callbacks
Audio Upload and Extension Callbacks
Add Instrumental Callbacks
Add Vocals Callbacks
Music Cover Generation Callbacks
Replace Music Section Callbacks
POST
POST
POST
POST
POST
POST
GET
POST
POST
POST
GET
POST
POST
POST
GET
POST
Callbacks
POST
{request.body#/callBackUrl}
Required
string
required
string
required
Unique identifier of the audio track to replace. This ID is returned in the callback data after music generation completes.
string
required
string
required
string
required
string
required
required
string
required
callBackUrl
string <uri>
Callback URL for task completion. The system will send a POST request to this URL when replacement is complete, containing task status and results.
Your callback endpoint should be able to accept POST requests containing JSON payloads with replacement results
For detailed callback format and implementation guide, see Replace Music Section Callbacks
To ensure callback security, see Webhook Verification Guide for signature verification implementation
https://example.com/callback
enum<integer>
429: Rate limit exceeded - Exceeded request limit for this resource
string
string
curl --location 'https://api.kie.ai/api/v1/generate/replace-section' \
"callBackUrl": "https://example.com/callback"
}'
{
"code": 200,
}
}

### generate-persona
Music Generation Callbacks
Music Extension Callbacks
Audio Upload and Cover Callbacks
Audio Upload and Extension Callbacks
Add Instrumental Callbacks
Add Vocals Callbacks
Music Cover Generation Callbacks
Replace Music Section Callbacks
POST
POST
POST
POST
POST
POST
GET
POST
POST
POST
GET
POST
POST
POST
GET
POST
Create a personalized music Persona based on generated music, giving the music a unique identity and characteristics.
Use this endpoint to create Personas (music characters) for generated music:
taskId (Required): Can be obtained from the following endpoints:
audioId (Required): Specifies the audio ID to create Persona for
name (Required): Assigns an easily recognizable name to the Persona
description (Required): Describes the Persona's musical characteristics, style, and personality
It is recommended to provide detailed descriptions for Personas to better capture musical characteristics.
The returned personaId can be used in subsequent music generation requests to create music with similar style characteristics.
{
}
NOTE
TIP
Providing detailed and specific descriptions for Personas helps the system more accurately capture musical style characteristics.
Required
string
required
string
required
Unique identifier of the audio track to create Persona for. This ID is returned in the callback data after music generation completes.
string
required
Name for the Persona. A descriptive name that captures the essence of the musical style or character.
string
required
Detailed description of the Persona's musical characteristics, style, and personality. Be specific about genre, mood, instrumentation, and vocal qualities.
string
enum<integer>
429: Rate Limited - Request limit has been exceeded for this resource
451: Unauthorized - Failed to fetch the music data. Kindly verify any access limits set by you or your service provider
string
string
Unique identifier for the generated Persona. This personaId can be used in subsequent music generation requests (Generate Music, Extend Music, Upload And Cover Audio, Upload And Extend Audio) to create music with similar style characteristics.
string
string
Description of the Persona's musical characteristics, style, and personality as provided in the request.
curl --location 'https://api.kie.ai/api/v1/generate/generate-persona' \
}'
{
"code": 200,
}
}

### convert-to-wav
Convert to WAV Callbacks
POST
GET
GET
POST
Callbacks
POST
{$request.body#/callBackUrl}
Required
string
required
string
required
Unique identifier of the specific audio track to convert. This ID is returned in the callback data after music generation completes.
callBackUrl
string <uri>
required
The URL to receive WAV conversion task completion updates. Required for all WAV conversion requests.
Callback includes the high-quality WAV file download URL
Your callback endpoint should accept POST requests with JSON payload containing the WAV file location
For detailed callback format and implementation guide, see WAV Conversion Callbacks
To ensure callback security, see Webhook Verification Guide for signature verification implementation
https://api.example.com/callback
enum<integer>
429: Rate Limited - Request limit has been exceeded for this resource
string
string
curl --location 'https://api.kie.ai/api/v1/wav/generate' \
"callBackUrl": "https://api.example.com/callback"
}'
{
"code": 200,
}
}
Convert to WAV Callbacks

### get-wav-details
Convert to WAV Callbacks
POST
GET
GET
GET
SUCCESS: WAV conversion completed successfully
CALLBACK_EXCEPTION: Error occurred during callback
The WAV file URL is only available in the response when status is SUCCESS
string
required
enum<integer>
451: Failed to fetch the image. Kindly verify any access limits set by you or your service provider.
string
string
string
callbackUrl
string
Callback address
integer
string <date-time>
Complete callback time
enum<string>
PENDING
SUCCESS
CREATE_TASK_FAILED
GENERATE_WAV_FAILED
CALLBACK_EXCEPTION
string <date-time>
enum<number>
string
curl --location 'https://api.kie.ai/api/v1/wav/record-info?taskId=988e****c8d3' \
{
"code": 200,
"callbackUrl": "https://api.example.com/callback",
},
"successFlag": "SUCCESS",
}
}
Audio Separation Callbacks

### separate-vocals
Audio Separation Callbacks
MIDI Generation Callbacks
POST
GET
POST
GET
GET
POST
Mode (type)	Returned Stems	Typical Use Cases	Credit Cost
separate_vocal （default）	2 stems — Vocals + accompaniment	Quick vocal removal, karaoke, and basic mixing	10 credits
split_stem	Up to 12 stems — Vocals, backing vocals, drums, bass, guitar, keyboard, strings, brass, woodwinds, percussion, synthesizer, FX/other;	Advanced mixing, remixing, sound design, and individual instrument extraction	50 credits
split_stem_advanced	Up to 12 stems — Same as split_stem, with support for specifying a single target stem through stemName for precise separation	Individual instrument extraction and detailed post-production	20 credits
Name	Type	Description
taskId	string	The ID of the original music generation task
audioUrl	string	The URL of the user-uploaded audio file. Required when processing user-uploaded audio. Cannot be used together with audioId.
audioId	string	Specifies the audio variant to process when multiple versions exist. Cannot be used together with audioUrl.
type	string	Separation mode: separate_vocal, split_stem, or split_stem_advanced; defaults to separate_vocal
stemName	string	Takes effect only when type is split_stem; specifies the name of the individual stem/instrument to separate;
Separation quality depends on the complexity and mixing characteristics of the original track.
split_stem returns up to 12 independent stems — vocals, backing vocals, drums, bass, guitar, keyboard, strings, brass, woodwinds, percussion, synthesizer, and FX/other.
Callbacks
POST
{$request.body#/callBackUrl}
Required
string
required
string
required
Unique identifier of the specific audio track to process for vocal separation. This ID is returned in the callback data after music generation completes.
enum<string>
enum<string>
required
String Section
Synth Strings
callBackUrl
string <uri>
required
URL used to receive vocal separation task completion updates. Required for all vocal separation requests.
https://api.example.com/callback
enum<integer>
429: Rate Limited - Request limit has been exceeded for this resource
string
string
curl --location 'https://api.kie.ai/api/v1/vocal-removal/generate' \
"callBackUrl": "https://api.example.com/callback",
}'
{
"code": 200,
}
}
MIDI Generation Callbacks

### get-vocal-separation-details
Audio Separation Callbacks
MIDI Generation Callbacks
POST
GET
POST
GET
GET
GET
SUCCESS: Vocal separation completed successfully
CALLBACK_EXCEPTION: Error occurred during callback
Separated audio file URLs are only available when status is SUCCESS
string
required
enum<integer>
451: Failed to fetch the image. Kindly verify any access limits set by you or your service provider.
string
string
string
callbackUrl
string
Callback address
integer
string <date-time>
Complete callback time
enum<string>
PENDING
SUCCESS
CREATE_TASK_FAILED
GENERATE_AUDIO_FAILED
CALLBACK_EXCEPTION
string <date-time>
enum<number>
string
curl --location 'https://api.kie.ai/api/v1/vocal-removal/record-info?taskId=5e72****97c7' \
{
"code": 200,
"callbackUrl": "https://57312fc2e366.ngrok-free.app/api/v1/vocal-removal/test",
{
},
{
}
"stringsUrl": null,
},
"successFlag": "SUCCESS",
}
}

### generate-midi
Audio Separation Callbacks
MIDI Generation Callbacks
POST
GET
POST
GET
GET
POST
Required
Name	Type	Description
taskId	string	Required. Task ID from a completed vocal separation.
callBackUrl	string	Required. URL to receive MIDI generation completion notifications.
audioId	string	Optional. Specifies which separated audio track to generate MIDI from. This audioId can be obtained from the originData array in the Get Vocal Separation Details endpoint response. Each item in originData contains an id field that can be used here. If not provided, MIDI will be generated from all separated tracks.
The callback will contain detailed note data for each detected instrument.
Required
string
required
callBackUrl
string <uri>
required
The URL to receive MIDI generation task completion updates. Required for all MIDI generation requests.
Callback includes detailed note information for each detected instrument with pitch, timing, and velocity
Your callback endpoint should accept POST requests with JSON payload containing MIDI data
For detailed callback format and implementation guide, see MIDI Generation Callbacks
To ensure callback security, see Webhook Verification Guide for signature verification implementation
https://example.callback
string
integer
string
string
Unique identifier for the MIDI generation task. Use this to query task status or receive callback results.
curl --location 'https://api.kie.ai/api/v1/midi/generate' \
"callBackUrl": "https://example.callback",
}'
{
"code": 200,
}
}

### get-midi-details
Audio Separation Callbacks
MIDI Generation Callbacks
POST
GET
POST
GET
GET
GET
string
required
integer
string
string
integer
string
callbackUrl
string
Callback URL provided when creating the task
integer
integer
integer
string  |
string  |
curl --location 'https://api.kie.ai/api/v1/midi/record-info?taskId=5c79****be8e' \
{
"code": 200,
"callbackUrl": "https://example.callback",
{
{
},
{
}
},
{
{
}
}
},
}
}
Music Video Generation Callbacks

### create-music-video
Music Video Generation Callbacks
POST
GET
GET
POST
Callbacks
POST
{$request.body#/callBackUrl}
Required
string
required
string
required
Unique identifier of the specific audio track to visualize. This ID is returned in the callback data after music generation completes.
callBackUrl
string <uri>
required
The URL to receive music video generation task completion updates. Required for all music video generation requests.
Callback includes the generated music video file URL with visual effects and branding
Your callback endpoint should accept POST requests with JSON payload containing the video file location
For detailed callback format and implementation guide, see Music Video Callbacks
To ensure callback security, see Webhook Verification Guide for signature verification implementation
https://api.example.com/callback
string
Artist or creator name to display as a signature on the video cover. Maximum 50 characters. This creates attribution for the music creator.
<= 50 characters
string
Website or brand to display as a watermark at the bottom of the video. Maximum 50 characters. Useful for promotional branding or attribution.
<= 50 characters
enum<integer> <int32>
string
string
curl --location 'https://api.kie.ai/api/v1/mp4/generate' \
"callBackUrl": "https://api.example.com/callback",
}'
{
"code": 0,
}
}
Music Video Generation Callbacks

### get-music-video-details
Music Video Generation Callbacks
POST
GET
GET
GET
SUCCESS: Video generation completed successfully
The video URL is only available in the response when status is SUCCESS
string
required
enum<integer> <int32>
string
string
string
callbackUrl
string
Callback URL
integer <int32>
string <date-time>
Completion callback time
Completion callback result
string
PENDING-Waiting for execution SUCCESS-Success CREATE_TASK_FAILED-Failed to create task GENERATE_MP4_FAILED-Failed to generate MP4
string <date-time>
enum<integer> <int32>
string
curl --location 'https://api.kie.ai/api/v1/mp4/record-info?taskId=taskId_774b9aa0422f' \
{
"code": 200,
"callbackUrl": "https://api.example.com/callback",
},
"successFlag": "SUCCESS",
}
}

### generate-sounds
POST
GET
POST
Supports asynchronous reception of task completion notifications through callback address.
Required
string
required
Sound task type limit: 500 characters
enum<string>
required
boolean
integer
enum<string>
boolean
callBackUrl
string
Callback address
Callback user
enum<integer>
429: Rate Limited - Request limit has been exceeded for this resource
433: Request Limit - Sub-key Usage Exceeds Limit
string
required
string
required
curl --location 'https://api.kie.ai/api/v1/generate/sounds' \
}'
{
"code": 422,
}
}
Suno Voice Generation Callback

### boost-music-style
Music Generation Callbacks
Music Extension Callbacks
Audio Upload and Cover Callbacks
Audio Upload and Extension Callbacks
Add Instrumental Callbacks
Add Vocals Callbacks
Music Cover Generation Callbacks
Replace Music Section Callbacks
POST
POST
POST
POST
POST
POST
GET
POST
POST
POST
GET
POST
POST
POST
GET
POST
Required
string
required
enum<integer>
429: Rate Limited - Request limit has been exceeded for this resource
451: Unauthorized - Failed to fetch the image. Kindly verify any access limits set by you or your service provider.
string
string
string
string
string
enum<integer> <int32>
string
string
curl --location 'https://api.kie.ai/api/v1/style/generate' \
}'
{
"code": 200,
"taskId": "string",
"param": "string",
"result": "string",
"successFlag": "string",
"createTime": "string"
}
}

### generate-mashup
Music Generation Callbacks
Music Extension Callbacks
Audio Upload and Cover Callbacks
Audio Upload and Extension Callbacks
Add Instrumental Callbacks
Add Vocals Callbacks
Music Cover Generation Callbacks
Replace Music Section Callbacks
POST
POST
POST
POST
POST
POST
GET
POST
POST
POST
GET
POST
POST
POST
GET
POST
uploadUrlList is required and must contain exactly 2 audio file URLs.
Character limits for prompt across different models:
Model	prompt Limit	style Limit
V4	3000 characters	200 characters
V4_5 and V4_5PLUS	5000 characters	1000 characters
V4_5ALL	5000 characters	1000 characters
V5 and V5_5	5000 characters	1000 characters
title length limit: 80 characters (all models).
prompt length limit: 500 characters.
TIP
The callback process has three stages: text (text generation), first (first track complete), complete (all complete).
Parameter	Type	Description
vocalGender	string	Vocal gender preference. m for male, f for female. Note: This parameter only takes effect when customMode is true. In practice, this parameter only increases the probability but does not guarantee adherence to the specified vocal gender.
styleWeight	number	Strength of adherence to style. Note: This parameter only takes effect when customMode is true. Range is 0–1, with two decimal places. Example: 0.61.
weirdnessConstraint	number	Creativity/discreteness level. Note: This parameter only takes effect when customMode is true. Range is 0–1, with two decimal places. Example: 0.72.
audioWeight	number	Weight of audio elements. Note: This parameter only takes effect when customMode is true. Range is 0–1, with two decimal places. Example: 0.65.
Callbacks
POST
{request.body#/callBackUrl}
Required
array[string <uri>]
required
string
In Custom Mode (customMode: true): Required if instrumental is false. The prompt will be strictly used as the lyrics and sung in the generated track. Character limits by model:
V4: Maximum 3000 characters
V4_5 & V4_5PLUS: Maximum 5000 characters
V4_5ALL: Maximum 5000 characters
V5 & V5_5: Maximum 5000 characters
In Non-custom Mode (customMode: false): Always required. The prompt serves as the core idea, and lyrics will be automatically generated based on it (not strictly matching the input). Maximum 500 characters.
string
required
Only available and required in Custom Mode (customMode: true). Defines the genre, mood, or artistic direction.
Character limits by model:
V4: Maximum 200 characters
V4_5 & V4_5PLUS: Maximum 1000 characters
V4_5ALL: Maximum 1000 characters
V5 & V5_5: Maximum 1000 characters
string
required
Only available and required in Custom Mode (customMode: true).
Max length: 80 characters.
boolean
required
If false: Simplified mode where only prompt is required and other parameters are ignored.
boolean
If true: Only style and title are required.
If false: style, title, and prompt are required (with prompt used as the exact lyrics).
In Non-custom Mode (customMode: false): No impact on required fields (prompt only).
enum<string>
required
Required for all requests.
callBackUrl
string <uri>
required
The URL to receive music generation task completion updates. Required for all music generation requests.
Callback process has three stages: text (text generation), first (first track complete), complete (all tracks complete)
Your callback endpoint should accept POST requests with JSON payload containing task results and audio URLs
For detailed callback format and implementation guide, see Music Generation Callbacks
To ensure callback security, see Webhook Verification Guide for signature verification implementation
https://example.com/callback
enum<string>
integer
enum<integer>
429: Rate Limited - Request limit has been exceeded for this resource
451: Unauthorized - Failed to fetch the image. Kindly verify any access limits set by you or your service provider
string
string
curl --location 'https://api.kie.ai/api/v1/generate/mashup' \
"callBackUrl": "https://example.com/callback",
}'
{
"code": 200,
}
}
Lyrics Generation Callbacks
