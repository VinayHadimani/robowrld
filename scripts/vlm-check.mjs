// VLM screenshot verification for the Supabase Model Studio feature
import ZAI from 'z-ai-web-dev-sdk'
import { readFileSync } from 'node:fs'

const [,, imagePath, prompt] = process.argv
if (!imagePath || !prompt) {
  console.error('usage: node vlm-check.mjs <image.png> <prompt>')
  process.exit(1)
}

async function main() {
  const zai = await ZAI.create()
  const b64 = readFileSync(imagePath).toString('base64')
  const completion = await zai.chat.completions.createVision({
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
        ],
      },
    ],
    thinking: { type: 'disabled' },
  })
  console.log(completion.choices[0]?.message?.content ?? '(no content)')
}

main().catch((err) => {
  console.error('VLM check failed:', err?.message ?? err)
  process.exit(1)
})
