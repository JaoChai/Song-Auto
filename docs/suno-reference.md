# KIE.AI Suno API — Reference (scraped 2026-08-26)

Source: https://docs.kie.ai/suno-api/*  | Base URL: https://api.kie.ai | Auth: Authorization: Bearer $KIE_API_KEY


## /suno-api/generate-music

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
Parameter Details
V4: prompt 3000 characters, style 200 characters
V4_5 & V4_5PLUS: prompt 5000 characters, style 1000 characters
V4_5ALL: prompt 5000 characters, style 1000 characters
V5_5 & V5: prompt 5000 characters, style 1000 characters
title length limit: 80 characters (all models)
prompt length limit: 3000 characters
POST
V4: Maximum 3000 characters
V4_5 & V4_5PLUS: Maximum 5000 characters
V4_5ALL: Maximum 5000 characters
V5_5 & V5: Maximum 5000 characters
In Non-custom Mode (customMode: false): Always required. The prompt serves as the core idea, and lyrics will be automatically generated based on it (not strictly matching the input). Maximum 3000 characters.
V4: Maximum 200 characters
V4_5 & V4_5PLUS: Maximum 1000 characters
V4_5ALL: Maximum 1000 characters
V5_5 & V5: Maximum 1000 characters
Max length: 80 characters.
curl --location 'https://api.kie.ai/api/v1/generate' \

## /suno-api/get-music-details

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
Maximum query rate: 3 requests per second per task
param
Parameter information for task generation
curl --location 'https://api.kie.ai/api/v1/generate/record-info?taskId=5c79****be8e' \

## /suno-api/generate-music-callbacks

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
Status Code	Description
200	Success - Request has been processed successfully
400	Validation Error - Lyrics contained copyrighted material
408	Rate Limited - Timeout
413	Conflict - Uploaded audio matches existing work of art
500	Server Error - An unexpected error occurred while processing the request
501	Audio generation failed
531	Server Error - Sorry, the generation failed due to an issue. Your credits have been refunded. Please try again

## /suno-api/extend-music


## /suno-api/generate-lyrics

POST
GET
GET
POST
Parameter Details
POST
Description of the desired lyrics content. Be specific about theme, mood, style, or story elements you want in the lyrics. More detailed prompts yield better results. The maximum word limit is 200 characters.
curl --location 'https://api.kie.ai/api/v1/lyrics' \

## /suno-api/add-instrumental

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
Parameter Details
POST
<= 200 characters
<= 1000 characters
curl --location 'https://api.kie.ai/api/v1/generate/add-instrumental' \

## /suno-api/cover-suno

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
Parameter Details
POST
curl --location 'https://api.kie.ai/api/v1/suno/cover/generate' \