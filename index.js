const fs = require('fs')
const readline = require('readline')

const filePath = process.argv[2]
const z = Math.round(Number(process.argv[3]) * 100, 2) / 100

const fileStream = fs.createReadStream(filePath)

const originalFileName = filePath.replace('.gcode', '')

const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity
})

const parserCtx = {
  zThreshold: 0.01,
  resumeFrom: z,
  lastLine: null,
  layerChangeStart: null,
  resumeTemplate: fs.readFileSync('resume-template.gcode'),
  readStream: fs.createReadStream(filePath),
  writeStream: fs.createWriteStream(`${originalFileName}-Z${z}-modified.gcode`)
}

const findZ = function (line) {
  if (line.indexOf(';Z:') === -1) {
    return null
  }

  return Math.round(Number(line.substring(3) * 100), 2) / 100
}

const isPossibleZ = function (parserCtx, z) {
  return parserCtx.resumeFrom + parserCtx.zThreshold <= z
}

const isLayerChanged = function (line) {
  return line === ';AFTER_LAYER_CHANGE'
}

const write = function (parserCtx, line) {
  parserCtx.writeStream.write(`${line}\n`)
}

const modify = function (parserCtx) {
  if (parserCtx.resumeTemplate) {
    write(parserCtx, parserCtx.resumeTemplate)
  }

  rl.on('line', (line) => {
    const done = function () {
      parserCtx.lastLine = line
    }

    if (parserCtx.located) {
      write(parserCtx, line)
      return done()
    }

    if (parserCtx.zFound) {
      if (isLayerChanged(line)) {
        parserCtx.located = true
        write(parserCtx, parserCtx.lastLine)
        return done()
      }

      return done()
    }

    const z = findZ(line)

    if (!z) {
      return done()
    }

    if (!isPossibleZ(parserCtx, z)) {
      return done()
    }

    parserCtx.zFound = z

    done()
  })

  rl.on('close', () => {
    parserCtx.writeStream.end()
  })
}

modify(parserCtx)