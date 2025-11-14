import fs from 'fs'
import { suffix } from 'bun:ffi'

const releasePath = new URL('./release', import.meta.url).pathname

// Check if release directory exists
if (!fs.existsSync(releasePath)) {
  console.log('Release directory does not exist, nothing to clean up.')
  process.exit(0)
}

const files = fs.readdirSync(releasePath)

const { platform, arch } = process
let filename

if (arch === 'x64') {
  filename = `dler-prompt-${platform}-amd64.${suffix}`
} else {
  filename = `dler-prompt-${platform}-${arch}.${suffix}`
}

files.forEach((file) => {
  if (file !== filename) {
    const filePath = `./release/${file}`
    try {
      fs.unlinkSync(filePath)
      console.log(`Removed: ${file}`)
    } catch (error) {
      console.warn(`Failed to remove ${file}:`, error.message)
    }
  }
})
