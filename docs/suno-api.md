# KIE.AI — Suno API Reference

> รวมจาก https://docs.kie.ai/suno-api/* (scrape วันที่ 2026-08-26)
> Raw dump ทั้ง 24 หน้าอยู่ที่ `raw-notes.md` / `extend-music.txt` ในโฟลเดอร์นี้

## พื้นฐาน

| | |
|---|---|
| **Base URL** | `https://api.kie.ai` |
| **Auth** | Header `Authorization: Bearer $KIE_API_KEY` |
| **Content-Type** | `application/json` |
| **Response envelope** | `{ "code": 200, "msg": "success", "data": { ... } }` — code != 200 = error |
| **Rate limit (query)** | Get Details: สูงสุด **3 requests/second ต่อ task** |

## Models

| Model | จุดเด่น | Prompt limit | Style limit |
|---|---|---|---|
| `V3_5` | โครงสร้างเพลงดีขึ้น, สูงสุด 4 นาที | 500 (simple) / 3,000 (custom) | 200 |
| `V4` | เสียงร้องดีขึ้น, สูงสุด 4 นาที | 3,000 | 200 |
| `V4_5` | Smart prompts, สูงสุด 8 นาที | 5,000 | 1,000 |
| `V4_5PLUS` | เสียงรวยขึ้น, 8 นาที | 5,000 | 1,000 |
| `V4_5ALL` | เร็ว+ฉลาด, 8 นาที | 5,000 | 1,000 |
| `V5` | musicality ดีสุด + เร็ว, 8 นาที | 5,000 | 1,000 |
| `V5_5` | Custom models ("Unleash Your Voice") | 5,000 | 1,000 |

Title: สูงสุด 80 chars (upload-cover ถึง 100)

---

## Endpoints (Music Generation)

### 1. Generate Music
`POST /api/v1/generate`

```jsonc
{
  "prompt": "...",            // required* — customMode:true + instrumental:false ⇒ ใช้เป็น LYRICS ตรงตัว
  "customMode": true,         // required — true=advanced (style/title มีผล), false=simple (prompt อย่างเดียว)
  "instrumental": false,      // required — true = ไม่มีคำร้อง
  "model": "V4_5",            // required — enum ตามตารางด้านบน
  "style": "Folk, Acoustic",  // customMode:true ⇒ required
  "title": "Childhood Dreams",// customMode:true ⇒ required, ≤80 chars
  "negativeTags": "Heavy Metal", // optional — style ที่ไม่เอา
  "vocalGender": "m",         // optional 'm'|'f' — เฉพาะ customMode:true, เพิ่มโอกาสไม่การันตี
  "styleWeight": 0.65,        // optional 0–1 (2 ตำแหน่ง)
  "weirdnessConstraint": 0.6, // optional 0–1 — ความ experimental
  "audioWeight": 0.65,        // optional 0–1
  "callBackUrl": "https://your-app.com/callback" // required — webhook รับผล
}
```
Response: `{code, msg, data:{taskId}}`

> หมายเหตุ: ถ้า `customMode:false` → ใส่แค่ prompt/instrumental/model/callBackUrl พอ (prompt ≤3000)

### 2. Get Music Task Details (polling)
`GET /api/v1/generate/record-info?taskId={taskId}`

Response `data`: `{taskId, param, status, response:{sunoData:[...]}, errorMessage}`
`sunoData[i]`: `{id, audioUrl, streamAudioUrl, imageUrl, prompt, title, tags, duration, createTime}`

Task status enum:
- `PENDING` — กำลังประมวลผล
- `TEXT_SUCCESS` — lyrics เสร็จ
- `FIRST_SUCCESS` — แทร็กแรกเสร็จ (response มี sunoData บางส่วน)
- `SUCCESS` — ครบทุกแทร็ก
- `CREATE_TASK_FAILED` / `GENERATE_AUDIO_FAILED` / `SENSITIVE_WORD_ERROR` / `CALLBACK_EXCEPTION` — fail (ดู `errorMessage`)

⚠️ Poll ได้แค่ **3 req/s ต่อ taskId**

### 3. Callback (webhook) — Music Generation
`POST` ไปที่ `callBackUrl`, JSON, timeout 15s, 3 stage:

| callbackType | เมื่อไร |
|---|---|
| `text` | lyrics generate เสร็จ |
| `first` | แทร็กแรกเสร็จ |
| `complete` | ทุกแทร็กเสร็จ (บางกรณี text/first อาจถูกข้าม) |

Payload:
```json
{
  "code": 200,
  "msg": "All generated successfully.",
  "data": {
    "callbackType": "complete",
    "task_id": "2fac****9f72",
    "data": [ { "id": "...", "audio_url": "...", "stream_audio_url": "...", "image_url": "...",
                "prompt": "[Verse]...", "model_name": "chirp-v4-5", "title": "...",
                "tags": "...", "duration": 198.44, "createTime": 1786343609818 } ]
  }
}
```
(สังเกต: callback ใช้ snake_case `audio_url` แต่ polling record-info ใช้ camelCase `audioUrl`)

Callback status codes:
| Code | ความหมาย |
|---|---|
| 200 | สำเร็จ |
| 400 | lyrics มีเนื้อหาละเมิดลิขสิทธิ์ |
| 408 | rate limited / timeout |
| 413 | เสียงอัปโหลดซ้ำกับผลงานที่มีอยู่ |
| 500 | server error |
| 501 | สร้างเสียงไม่สำเร็จ |
| 531 | สร้างไม่สำเร็จ — **credit คืนให้แล้ว ลองใหม่** |

Callback endpoint ควรตอบ `200 {"status":"received"}` เร็ว ๆ แล้วค่อย process — และควร verify webhook signature (ดู Webhook Verification Guide ของ kie.ai)

### 4. Extend Music
`POST /api/v1/generate/extend`
- `audioId` (required) — id ของแทร็ก (จาก callback/polling), `model` (required), `callBackUrl` (required)
- `defaultParamFlag` (required): `true` = ระบุเอง (ต้องมี `continueAt`, `prompt`, `style`, `title`) / `false` = ใช้ params เดิมของ audioId (ใส่แค่ audioId)
- `continueAt` (number, วินาที) — จุดเริ่ม extend, >0 และ < ความยาวเพลง
- prompt/style/title/negativeTags/vocalGender/weights เหมือน generate

### 5. Generate Lyrics (แยกต่างหาก)
`POST /api/v1/lyrics`
- `prompt` (required, ≤200 chars) + `callBackUrl` (optional)
- Poll: `GET /api/v1/lyrics/record-info?taskId=` — ได้ title + lyrics หลาย variations

### 6. Add Instrumental to Music (เสียงอัปโหลด → ทำ伴奏)
`POST /api/v1/generate/add-instrumental`
- `uploadUrl` (required, URL เสียง), `title`, `tags` (≤1000), `negativeTags` (≤200), `model`, `callBackUrl` — required ทั้งหมดยกเว้น weights/vocalGender

### 7. Upload And Cover Audio
`POST /api/v1/generate/upload-cover`
- `uploadUrl` (required, **เสียงห้ามเกิน 8 นาที**) + params เหมือน generate (customMode/instrumental/model/callBackUrl required; title ≤100 ที่นี่)

*(Upload & Extend มี endpoint คู่กันใน docs: `/suno-api/upload-and-extend-audio`)*

### 8. Cover Suno (cover จากแทร็กที่ generate เอง)
`POST /api/v1/suno/cover/generate`
- `taskId` (required — taskId เดิมของ generate), `callBackUrl` (optional)
- Poll: `GET /api/v1/suno/cover/record-info?taskId=`

### 9. Replace Section
`POST /api/v1/generate/replace-section`
- `taskId`, `audioId`, `prompt` (lyrics ใหม่ของช่วงนั้น), `tags`, `title`, `fullLyrics` (เนื้อเต็มหลังแก้ — required)
- `infillStartS` / `infillEndS` (วินาที, 2 ตำแหน่ง) — **ช่วงต้องยาว ≥10 วินาที**
- `negativeTags`, `callBackUrl` optional

### 10. Generate Persona
`POST /api/v1/generate/generate-persona`
- `taskId`, `audioId`, `name`, `description` (required); `vocalStart`/`vocalEnd` (optional, default 0→30, **ช่วง 10–30 วิ**), `style` optional
- ได้ `personaId` — ใช้ต่อใน generate/extend/upload-cover เพื่อสไตล์เดิม

### 11. Boost Music Style
`POST /api/v1/style/generate` — body `{content:"Pop, Mysterious"}` → `data.result` = style description ที่ enhance แล้ว

### 12. Generate Mashup
`POST /api/v1/generate/mashup` — params ชุดเดียวกับ generate music

### 13. Generate Sounds (SFX)
`POST /api/v1/generate/sounds` — `prompt` ≤500 chars, `model:"V5"`, `callBackUrl` optional

---

## Endpoints (Audio Processing)

| Feature | Create | Poll |
|---|---|---|
| Convert to WAV | `POST /api/v1/wav/generate` (`taskId`,`audioId`,`callBackUrl` required) | `GET /api/v1/wav/record-info?taskId=` |
| Vocal/Stem Separation | `POST /api/v1/vocal-removal/generate` | `GET /api/v1/vocal-removal/record-info?taskId=` |
| MIDI from Audio | `POST /api/v1/midi/generate` | `GET /api/v1/midi/record-info?taskId=` |
| Music Video (MP4) | `POST /api/v1/mp4/generate` | `GET /api/v1/mp4/record-info?taskId=` |

Separation modes (`type`):
- `separate_vocal` (default) — 2 stems (vocals + instrumental) — 10 credits
- `split_stem` — สูงสุด 12 stems — 50 credits
- `split_stem_advanced` — 12 stems + เลือก stem เดียวด้วย `stemName` — 20 credits
- input: `audioId` หรือ `audioUrl` (ห้ามใช้พร้อมกัน)

Music Video extras: `author` (≤50 chars), `domainName` watermark (≤50 chars)

---

## Error codes (HTTP response envelope)

| Code | ความหมาย |
|---|---|
| 200 | success |
| 400 | invalid parameters / JSON format |
| 401 | unauthorized (key ผิด/หาย) |
| 402 | credits ไม่พอ |
| 429 | rate limited |
| 500 | server error |

## Minimal flow (TypeScript-ish)

```ts
const BASE = "https://api.kie.ai";
const H = { Authorization: `Bearer ${process.env.KIE_API_KEY}`, "Content-Type": "application/json" };

// 1) create
const { data } = await fetch(`${BASE}/api/v1/generate`, {
  method: "POST", headers: H,
  body: JSON.stringify({ prompt, customMode: true, instrumental: false,
    model: "V4_5", style, title, callBackUrl })
}).then(r => r.json());
// data.taskId

// 2) poll (≤3 req/s) จน status === "SUCCESS"
const rec = await fetch(`${BASE}/api/v1/generate/record-info?taskId=${data.taskId}`, { headers: H })
  .then(r => r.json());
rec.data.response.sunoData[0].audioUrl;
```

Support: support@kie.ai
